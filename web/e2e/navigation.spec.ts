import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Reservation } from '../src/api/contracts';

const atlas = '10000000-0000-0000-0000-000000000001';
const birch = '10000000-0000-0000-0000-000000000002';
const alex = '20000000-0000-0000-0000-000000000001';

async function localSlot(page: Page, start: Date, end: Date) {
  return page.evaluate(
    ({ start, end }) => {
      function local(iso: string) {
        const value = new Date(iso);
        const pad = (part: number) => String(part).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
      }
      return { start: local(start), end: local(end) };
    },
    { start: start.toISOString(), end: end.toISOString() },
  );
}

test.use({ extraHTTPHeaders: { 'X-Roomwise-Profile': 'admin' } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('roomwise.profile.v1'))
      sessionStorage.setItem('roomwise.profile.v1', 'admin');
  });
});

test('routes support direct loads, reloads and browser history', async ({
  page,
}) => {
  await page.goto('/rooms');
  await expect(
    page.getByRole('heading', { name: 'Find your room.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Rooms', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Atlas', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'People', exact: true }).click();
  await expect(page).toHaveURL(/\/people$/);
  await expect(
    page.getByRole('heading', { name: 'People', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(
    page.getByRole('heading', { name: 'Atlas', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/people$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'People', exact: true }),
  ).toBeVisible();
  await page.goto('/usage');
  await expect(
    page.getByRole('heading', { name: 'Room usage', exact: true }),
  ).toBeVisible();
});

test('reservation filters survive reload, sharing and Back/Forward', async ({
  page,
}) => {
  const initial = `/reservations?view=history&roomId=${atlas}&status=Completed`;
  await page.goto(initial);
  await expect(
    page.getByRole('button', { name: 'History', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /^Filters/ }).click();
  const room = page.getByRole('combobox', { name: 'Room', exact: true });
  await expect(room).toHaveValue(atlas);
  await expect(
    page.getByRole('combobox', { name: 'Status', exact: true }),
  ).toHaveValue('Completed');
  await room.selectOption(birch);
  await expect(page).toHaveURL(new RegExp(`roomId=${birch}`));
  const sharedUrl = page.url();
  await page.goBack();
  await expect(room).toHaveValue(atlas);
  await page.goForward();
  await expect(room).toHaveValue(birch);
  await page.reload();
  await expect(page).toHaveURL(sharedUrl);
  const filters = page.getByRole('button', { name: /^Filters/ });
  if ((await filters.getAttribute('aria-expanded')) === 'false')
    await filters.click();
  await expect(room).toHaveValue(birch);
  await expect(
    page.getByRole('combobox', { name: 'Status', exact: true }),
  ).toHaveValue('Completed');
  await page.getByRole('link', { name: 'Rooms', exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(sharedUrl);
  await expect(
    page.getByRole('button', { name: 'History', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('member direct loads of administrator routes return to their reservations', async ({
  page,
}) => {
  await page.goto('/rooms');
  await page.getByLabel('Current profile').selectOption(alex);
  await expect(page).toHaveURL(/\/reservations$/);
  for (const path of ['/people', '/usage']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/reservations$/);
    await expect(
      page.getByRole('heading', {
        name: 'Your upcoming meetings',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'People', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Usage', exact: true }),
    ).toHaveCount(0);
  }
});

test('unknown frontend routes show a useful page while API and asset misses stay 404s', async ({
  page,
  request,
}) => {
  await page.goto('/this-route-does-not-exist');
  await expect(
    page.getByRole('heading', { name: /Page not found/i }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Reservations', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations$/);
  const api = await request.get('/api/this-endpoint-does-not-exist');
  expect(api.status()).toBe(404);
  expect(api.headers()['content-type'] ?? '').not.toContain('text/html');
  const asset = await request.get('/assets/this-asset-does-not-exist.js', {
    headers: { Accept: 'application/javascript' },
  });
  expect(asset.status()).toBe(404);
  expect(await asset.text()).not.toContain('<div id="root">');
});

test('identical room searches check the server again after another booking', async ({
  page,
  request,
}) => {
  let createdId: string | undefined;
  const start = new Date(Date.now() + 65 * 24 * 60 * 60 * 1000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  try {
    await page.goto('/rooms');
    const slot = await localSlot(page, start, end);
    await page.getByLabel('Find rooms from', { exact: true }).fill(slot.start);
    await page.getByLabel('Find rooms until', { exact: true }).fill(slot.end);
    const search = page.getByRole('button', {
      name: 'Find a room',
      exact: true,
    });
    await search.click();
    const atlasRow = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: 'Atlas', exact: true }),
    });
    await expect(
      atlasRow.getByRole('button', { name: 'Book this room', exact: true }),
    ).toBeEnabled();
    const created = await request.post('/api/reservations', {
      data: {
        roomId: atlas,
        organizerId: alex,
        title: 'Room search freshness check',
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        attendees: 2,
      },
    });
    expect(created.status()).toBe(201);
    createdId = ((await created.json()) as Reservation).id;
    const refreshed = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/room-availability' &&
        Date.parse(url.searchParams.get('startUtc') ?? '') === start.getTime()
      );
    });
    await search.click();
    expect((await refreshed).status()).toBe(200);
    await expect(
      atlasRow.getByRole('button', { name: 'Unavailable', exact: true }),
    ).toBeDisabled();
  } finally {
    if (createdId) await request.post(`/api/reservations/${createdId}/cancel`);
  }
});

test('confirmation restores focus on dismissal and blocks duplicate actions while saving', async ({
  page,
  request,
}) => {
  const start = new Date(Date.now() + 66 * 24 * 60 * 60 * 1000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const created = await request.post('/api/reservations', {
    data: {
      roomId: atlas,
      organizerId: alex,
      title: 'Confirmation keyboard and pending check',
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      attendees: 2,
    },
  });
  expect(created.status()).toBe(201);
  const reservation = (await created.json()) as Reservation;
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let sawRequest = () => {};
  const intercepted = new Promise<void>((resolve) => {
    sawRequest = resolve;
  });
  let cancelRequests = 0;
  await page.route(
    `**/api/reservations/${reservation.id}/cancel`,
    async (route) => {
      cancelRequests++;
      sawRequest();
      await released;
      await route.continue();
    },
  );
  try {
    const slot = await localSlot(page, start, end);
    await page.goto(
      `/reservations?from=${encodeURIComponent(slot.start)}&to=${encodeURIComponent(slot.end)}`,
    );
    const row = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: reservation.title, exact: true }),
    });
    const trigger = row.getByRole('button', { name: 'Cancel', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Cancel reservation?' });
    await expect(dialog).toContainText(reservation.title);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(cancelRequests).toBe(0);
    await trigger.click();
    await dialog
      .getByRole('button', { name: 'Cancel reservation', exact: true })
      .click();
    await intercepted;
    await expect(dialog).toHaveAttribute('aria-busy', 'true');
    await expect(
      dialog.getByRole('button', { name: 'Updating…', exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole('button', { name: 'Go back', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(cancelRequests).toBe(1);
    release();
    await expect(dialog).not.toBeVisible();
    await expect(row).toHaveCount(0);
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await expect(row.getByText('Cancelled', { exact: true })).toBeVisible();
    expect(cancelRequests).toBe(1);
  } finally {
    release();
    await page.unroute(`**/api/reservations/${reservation.id}/cancel`);
    await request.post(`/api/reservations/${reservation.id}/cancel`);
  }
});
