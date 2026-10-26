import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Person, Reservation, UsageReport } from '../src/api/contracts';

test.use({ extraHTTPHeaders: { 'X-Roomwise-Profile': 'admin' } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('roomwise.profile.v1'))
      sessionStorage.setItem('roomwise.profile.v1', 'admin');
  });
});

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
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Atlas', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Room details for Atlas').click();
    await expect(page.getByText('ID: ' + atlas, { exact: true })).toBeVisible();
    await page.getByLabel('Room details for Atlas').click();
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
    await expect(updatedRow).toHaveCount(0);
    await page.getByRole('button', { name: 'History', exact: true }).click();
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
    await expect(page.getByRole('alert')).toContainText(
      'This room is already booked',
    );
    await expect(page.getByLabel('Meeting title')).toHaveValue(
      'Keep my meeting title',
    );
    await expect(page.getByRole('dialog')).toBeVisible();
  } finally {
    await request.post('/api/reservations/' + existing.id + '/cancel');
  }
});

test('extra time respects the next room and organizer bookings', async ({
  page,
  request,
}, info) => {
  const meetings = (await (
    await request.get('/api/reservations')
  ).json()) as Reservation[];
  const parent = meetings.find(
    (meeting) => meeting.title === 'Engineering sync',
  )!;
  const createdIds: string[] = [];
  const blocker = {
    ...booking(1, parent.roomId, alex),
    title: 'Next team has priority',
    startUtc: parent.endUtc,
    endUtc: new Date(Date.parse(parent.endUtc) + 60 * 60 * 1000).toISOString(),
  };
  try {
    const roomBlock = await request.post('/api/reservations', {
      data: blocker,
    });
    expect(roomBlock.status()).toBe(201);
    const roomBooking = (await roomBlock.json()) as Reservation;
    createdIds.push(roomBooking.id);
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Reservations', exact: true })
      .click();
    await page
      .getByRole('article')
      .filter({
        has: page.getByRole('heading', { name: parent.title, exact: true }),
      })
      .getByRole('button', { name: 'Reserve more time' })
      .click();
    await expect(page.getByLabel('Additional time')).toBeFocused();
    await page.getByLabel('Additional time').selectOption('30');
    await page.screenshot({
      path: info.outputPath('extra-time-desktop.png'),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Reserve extra time', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'This room is already booked',
    );
    await expect(page.getByLabel('Additional time')).toHaveValue('30');
    await request.post(`/api/reservations/${roomBooking.id}/cancel`);
    const organizerBlock = await request.post('/api/reservations', {
      data: { ...blocker, roomId: atlas, organizerId: parent.organizerId },
    });
    expect(organizerBlock.status()).toBe(201);
    const organizerBooking = (await organizerBlock.json()) as Reservation;
    createdIds.push(organizerBooking.id);
    await page
      .getByRole('button', { name: 'Reserve extra time', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'The organizer already has a meeting',
    );
    await request.post(`/api/reservations/${organizerBooking.id}/cancel`);
    const confirmation = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/reservations/${parent.id}/continuations`) &&
        response.status() === 201,
    );
    await page
      .getByRole('button', { name: 'Reserve extra time', exact: true })
      .click();
    const child = (await (await confirmation).json()) as Reservation;
    createdIds.push(child.id);
    expect(child.continuationOfId).toBe(parent.id);
    expect(child.startUtc).toBe(parent.endUtc);
    expect(Date.parse(child.endUtc) - Date.parse(child.startUtc)).toBe(
      30 * 60 * 1000,
    );
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByText('Additional time', { exact: true }),
    ).toBeVisible();
  } finally {
    for (const id of createdIds)
      await request.post(`/api/reservations/${id}/cancel`);
  }
});

test('a lost HTTP confirmation is recovered without creating a duplicate', async ({
  page,
  request,
}) => {
  const value = { ...booking(6), title: 'Recover a lost confirmation' };
  let createdId: string | undefined;
  let submissionKey: string | undefined;
  // Fault injection only: the real API commits, then the browser loses its response.
  await page.route(
    '**/api/reservations',
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      submissionKey = route.request().headers()['idempotency-key'];
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      createdId = ((await response.json()) as Reservation).id;
      await route.abort('failed');
    },
    { times: 1 },
  );
  try {
    await page.goto('/');
    await page
      .getByRole('button', { name: 'New reservation', exact: true })
      .click();
    await fillBooking(page, value);
    await page
      .getByRole('button', { name: 'Create reservation', exact: true })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: value.title, exact: true }),
    ).toBeVisible();
    expect(submissionKey).toBeTruthy();
    const reservations = (await (
      await request.get('/api/reservations')
    ).json()) as Reservation[];
    expect(
      reservations.filter((reservation) => reservation.title === value.title),
    ).toHaveLength(1);
    const recovered = (await (
      await request.get(`/api/booking-requests/${submissionKey}`)
    ).json()) as Reservation;
    expect(recovered.id).toBe(createdId);
  } finally {
    if (createdId) await request.post(`/api/reservations/${createdId}/cancel`);
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
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('Completed');
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
  ).toHaveCount(0);
});

test('mobile layout and booking dialog support keyboard dismissal', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Workspace schedule', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Roadmap review', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Rooms', exact: true }).click();
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
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
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

test('profile switching keeps other bookings read-only and preserves the selected member', async ({
  page,
  request,
}) => {
  const value = {
    ...booking(7, birch, emilija),
    title: 'Member ownership review',
  };
  const created = await request.post('/api/reservations', { data: value });
  expect(created.status()).toBe(201);
  const reservation = (await created.json()) as Reservation;
  try {
    await page.goto('/');
    await page.getByLabel('Current profile').selectOption(alex);
    await page.getByRole('button', { name: 'Everyone', exact: true }).click();
    await page
      .getByRole('button', { name: 'Reservations', exact: true })
      .click();
    const row = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: value.title, exact: true }),
    });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button')).toHaveCount(0);
    const denied = await request.post(
      '/api/reservations/' + reservation.id + '/cancel',
      { headers: { 'X-Roomwise-Profile': alex } },
    );
    expect(denied.status()).toBe(403);
    await page.getByLabel('Current profile').selectOption(emilija);
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(
      page.getByRole('textbox', { name: 'Organizer', exact: true }),
    ).toHaveValue('Emilija Petrauskaite');
    await expect(
      page.getByRole('textbox', { name: 'Organizer', exact: true }),
    ).toHaveAttribute('readonly', '');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByLabel('Current profile')).toHaveValue(emilija);
    await page
      .getByRole('button', { name: 'New reservation', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'Organizer', exact: true }),
    ).toHaveValue('Emilija Petrauskaite');
    await page.keyboard.press('Escape');
    await page.getByLabel('Current profile').selectOption('admin');
    await page
      .getByRole('button', { name: 'Reservations', exact: true })
      .click();
    await expect(
      row.getByRole('button', { name: 'Edit', exact: true }),
    ).toBeVisible();
  } finally {
    await request.post('/api/reservations/' + reservation.id + '/cancel');
  }
});

test('a new booking is visible immediately after history or pagination, even far in the future', async ({
  page,
  request,
}) => {
  const createdIds: string[] = [];
  try {
    for (let index = 0; index < 7; index++) {
      const response = await request.post('/api/reservations', {
        data: { ...booking(15 + index), title: `Schedule page ${index}` },
      });
      expect(response.status()).toBe(201);
      createdIds.push(((await response.json()) as Reservation).id);
    }
    await page.goto('/');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    await page
      .getByRole('button', { name: 'New reservation', exact: true })
      .click();
    const value = { ...booking(60), title: 'Visible without hunting' };
    await fillBooking(page, value);
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/reservations') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Create reservation', exact: true })
      .click();
    const created = (await (await response).json()) as Reservation;
    createdIds.push(created.id);
    await expect(
      page.getByRole('heading', { name: 'You’re booked', exact: true }),
    ).toBeFocused();
    const title = page.getByRole('heading', { name: value.title, exact: true });
    await expect(title).toBeVisible();
    expect((await title.boundingBox())!.y).toBeLessThan(500);
    await expect(title).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Upcoming', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('heading', { name: 'Roadmap review', exact: true }),
    ).toHaveCount(0);
  } finally {
    for (const id of createdIds)
      await request.post(`/api/reservations/${id}/cancel`);
  }
});

test('room search checks the selected time and carries it into the booking', async ({
  page,
  request,
}) => {
  const blocker = { ...booking(40), title: 'Reserved room search slot' };
  const setup = await request.post('/api/reservations', { data: blocker });
  expect(setup.status()).toBe(201);
  const createdIds = [((await setup.json()) as Reservation).id];
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Rooms', exact: true }).click();
    const local = await page.evaluate(
      ({ start, end }) => {
        function input(value: string) {
          const date = new Date(value);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        }
        return { start: input(start), end: input(end) };
      },
      { start: blocker.startUtc, end: blocker.endUtc },
    );
    await page.getByLabel('Find rooms from', { exact: true }).fill(local.start);
    await page.getByLabel('Find rooms until', { exact: true }).fill(local.end);
    await page
      .getByRole('button', { name: 'Find a room', exact: true })
      .click();
    const atlasRow = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: 'Atlas', exact: true }),
    });
    await expect(
      atlasRow.getByRole('button', { name: 'Unavailable', exact: true }),
    ).toBeDisabled();
    const birchRow = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: 'Birch', exact: true }),
    });
    await birchRow
      .getByRole('button', { name: 'Book this room', exact: true })
      .click();
    await expect(page.getByLabel('Starts', { exact: true })).toHaveValue(
      local.start,
    );
    await expect(page.getByLabel('Ends', { exact: true })).toHaveValue(
      local.end,
    );
    await page.getByLabel('Meeting title').fill('Room search handoff');
    await page
      .getByRole('combobox', { name: 'Organizer', exact: true })
      .selectOption(emilija);
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/reservations') &&
        response.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Create reservation', exact: true })
      .click();
    const created = (await (await response).json()) as Reservation;
    createdIds.push(created.id);
    expect(created.roomId).toBe(birch);
    expect(Date.parse(created.startUtc)).toBe(Date.parse(blocker.startUtc));
    expect(Date.parse(created.endUtc)).toBe(Date.parse(blocker.endUtc));
    await expect(
      page.getByRole('heading', { name: 'Room search handoff', exact: true }),
    ).toBeVisible();
  } finally {
    for (const id of createdIds)
      await request.post(`/api/reservations/${id}/cancel`);
  }
});
