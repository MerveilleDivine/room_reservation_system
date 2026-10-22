import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Person, Reservation, UsageReport } from '../src/api/contracts';

const atlas = '10000000-0000-0000-0000-000000000001';
const birch = '10000000-0000-0000-0000-000000000002';
const alex = '20000000-0000-0000-0000-000000000001';
const emilija = '20000000-0000-0000-0000-000000000002';

function booking(days: number, roomId = atlas, organizerId = alex) {
  const start = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  start.setUTCMinutes(0, 0, 0);
  return {
    roomId,
    organizerId,
    title: 'Browser booking',
    startUtc: start.toISOString(),
    endUtc: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
    attendees: 2,
  };
}

async function fillBooking(page: Page, value: ReturnType<typeof booking>) {
  await page.getByLabel('Meeting title').fill(value.title);
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Room', exact: true })
    .selectOption(value.roomId);
  await page
    .getByRole('combobox', { name: 'Organizer', exact: true })
    .selectOption(value.organizerId);
  const local = await page.evaluate(
    ({ start, end }) => {
      const format = (iso: string) => {
        const date = new Date(iso);
        const pad = (value: number) => String(value).padStart(2, '0');
        return (
          date.getFullYear() +
          '-' +
          pad(date.getMonth() + 1) +
          '-' +
          pad(date.getDate()) +
          'T' +
          pad(date.getHours()) +
          ':' +
          pad(date.getMinutes())
        );
      };
      return { start: format(start), end: format(end) };
    },
    { start: value.startUtc, end: value.endUtc },
  );
  await page.getByLabel('Starts', { exact: true }).fill(local.start);
  await page.getByLabel('Ends', { exact: true }).fill(local.end);
  await page.getByLabel('Number of attendees').fill(String(value.attendees));
}

test('create, reload, edit and cancel a booking through the real API', async ({
  page,
  request,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const usersBefore = (await (
    await request.get('/api/users')
  ).json()) as Person[];
  const baseline = usersBefore.find(
    (user) => user.id === alex,
  )!.activeReservationCount;
  let createdId: string | undefined;
  try {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Atlas', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath('rooms-desktop.png'),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'New reservation', exact: true })
      .click();
    const value = { ...booking(3), title: 'Browser product review' };
    await fillBooking(page, value);
    await page.screenshot({
      path: info.outputPath('booking-desktop.png'),
      fullPage: true,
    });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/reservations') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Create reservation', exact: true })
      .click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const created = (await response.json()) as Reservation;
    createdId = created.id;
    expect(Date.parse(created.startUtc)).toBe(Date.parse(value.startUtc));
    await expect(
      page.getByRole('heading', { name: value.title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole('button', { name: 'Reservations', exact: true })
      .click();
    const row = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: value.title, exact: true }),
    });
    await expect(row).toBeVisible();
    const usersAfter = (await (
      await request.get('/api/users')
    ).json()) as Person[];
    expect(
      usersAfter.find((user) => user.id === alex)!.activeReservationCount,
    ).toBe(baseline + 1);
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByLabel('Meeting title').fill('Updated browser review');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const updatedRow = page.getByRole('article').filter({
      has: page.getByRole('heading', {
        name: 'Updated browser review',
        exact: true,
      }),
    });
    await expect(updatedRow).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await updatedRow
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(
      updatedRow.getByText('Cancelled', { exact: true }),
    ).toBeVisible();
    const finalUsers = (await (
      await request.get('/api/users')
    ).json()) as Person[];
    expect(
      finalUsers.find((user) => user.id === alex)!.activeReservationCount,
    ).toBe(baseline);
    expect(errors).toEqual([]);
  } finally {
    if (createdId)
      await request.post('/api/reservations/' + createdId + '/cancel');
  }
});

test('conflicting booking keeps form data and shows the backend error', async ({
  page,
  request,
}) => {
  const value = { ...booking(4, birch), title: 'Existing browser meeting' };
  const setup = await request.post('/api/reservations', { data: value });
  expect(setup.status()).toBe(201);
  const existing = (await setup.json()) as Reservation;
  try {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'New reservation', exact: true })
      .click();
    await fillBooking(page, { ...value, title: 'Keep my meeting title' });
    await page
      .getByRole('button', { name: 'Create reservation', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText('ROOM_OVERLAP');
    await expect(page.getByLabel('Meeting title')).toHaveValue(
      'Keep my meeting title',
    );
    await expect(page.getByRole('dialog')).toBeVisible();
  } finally {
    await request.post('/api/reservations/' + existing.id + '/cancel');
  }
});

test('check-in and early completion release the ongoing room', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Reservations', exact: true }).click();
  const row = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Engineering sync', exact: true }),
  });
  await row.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(row.getByText(/Checked in at/)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'End early', exact: true }).click();
  await expect(row.getByText('Completed', { exact: true })).toBeVisible();
  const meetings = (await (
    await request.get('/api/reservations')
  ).json()) as Reservation[];
  const ended = meetings.find(
    (meeting) => meeting.title === 'Engineering sync',
  )!;
  expect(ended.checkedInAtUtc).not.toBeNull();
  expect(ended.actualEndUtc).not.toBeNull();
  const replacement = {
    ...booking(1),
    roomId: ended.roomId,
    organizerId: ended.organizerId,
    title: 'Released room slot',
    startUtc: new Date(Date.now() + 120_000).toISOString(),
    endUtc: ended.endUtc,
  };
  const response = await request.post('/api/reservations', {
    data: replacement,
  });
  expect(response.status()).toBe(201);
  const created = (await response.json()) as Reservation;
  await request.post('/api/reservations/' + created.id + '/cancel');
});

test('usage report renders backend totals and filters a room', async ({
  page,
  request,
}, info) => {
  const report = (await (
    await request.get('/api/usage')
  ).json()) as UsageReport;
  const atlasUsage = report.rooms.find((room) => room.roomId === atlas)!;
  expect(atlasUsage.scheduledMinutes).toBe(120);
  expect(atlasUsage.observedMinutes).toBe(93);
  await page.goto('/');
  await page.getByRole('button', { name: 'Usage', exact: true }).click();
  const table = page.getByRole('region', { name: 'Room activity report' });
  const row = table.getByRole('row').filter({ hasText: 'Atlas' });
  await expect(row).toContainText('93 min');
  await expect(row).toContainText('20 min');
  await page.screenshot({
    path: info.outputPath('usage-desktop.png'),
    fullPage: true,
  });
  await page
    .getByRole('combobox', { name: 'Room', exact: true })
    .selectOption(atlas);
  await page.getByRole('button', { name: 'Update report' }).click();
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(
    page.getByText(report.observationNote, { exact: true }),
  ).toBeVisible();
});

test('mobile layout and booking dialog support keyboard dismissal', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Atlas', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('rooms-mobile.png'),
    fullPage: true,
  });
  const trigger = page.getByRole('button', {
    name: 'New reservation',
    exact: true,
  });
  await trigger.click();
  await expect(page.getByLabel('Meeting title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.getByRole('button', { name: 'Usage', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('concurrent HTTP requests cannot double-book a room or organizer', async ({
  request,
}) => {
  const first = booking(5);
  const responses = await Promise.all([
    request.post('/api/reservations', { data: first }),
    request.post('/api/reservations', {
      data: { ...first, organizerId: emilija },
    }),
  ]);
  expect(responses.map((response) => response.status()).sort()).toEqual([
    201, 409,
  ]);
  const winner = responses.find((response) => response.status() === 201)!;
  const created = (await winner.json()) as Reservation;
  try {
    const conflict = await request.post('/api/reservations', {
      data: { ...first, roomId: birch, organizerId: created.organizerId },
    });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).code).toBe('ORGANIZER_OVERLAP');
  } finally {
    await request.post('/api/reservations/' + created.id + '/cancel');
  }
});
