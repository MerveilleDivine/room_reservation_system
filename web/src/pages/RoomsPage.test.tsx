import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoomsPage } from './RoomsPage';
import { people, rooms } from '../test/fixtures';

function setup(failure = false) {
  const onBook = vi.fn();
  const fetchMock = vi.fn(async (url: string) =>
    url.startsWith('/api/room-availability')
      ? failure
        ? new Response(
            JSON.stringify({ detail: 'Choose a start time in the future.' }),
            { status: 400 },
          )
        : new Response(
            JSON.stringify(
              rooms.map((room) => ({
                roomId: room.id,
                isAvailable: room.isActive,
                reason: null,
              })),
            ),
          )
      : new Response(JSON.stringify(rooms)),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <RoomsPage
      allRooms={{ data: rooms, error: null, loading: false }}
      revision={0}
      canBook
      profile={people[0]!.id}
      onBook={onBook}
    />,
  );
  return { fetchMock, onBook };
}

describe('room finder', () => {
  it('checks availability again when the same interval is searched twice', async () => {
    const { fetchMock } = setup();
    await screen.findByRole('button', { name: 'Book this room' });
    const before = fetchMock.mock.calls.filter(([url]) =>
      url.startsWith('/api/room-availability'),
    ).length;
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Find a room' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) =>
          url.startsWith('/api/room-availability'),
        ),
      ).toHaveLength(before + 1),
    );
  });
  it('requires searching changed dates before booking and carries the confirmed interval into the form', async () => {
    const { onBook } = setup();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Book this room' });
    fireEvent.change(screen.getByLabelText('Find rooms from'), {
      target: { value: '2026-11-04T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Find rooms until'), {
      target: { value: '2026-11-04T10:00' },
    });
    const atlas = screen.getAllByRole('article')[0]!;
    expect(
      within(atlas).getByRole('button', { name: 'Check time' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Find a room' }));
    await user.click(
      await screen.findByRole('button', { name: 'Book this room' }),
    );
    expect(onBook).toHaveBeenCalledWith(
      rooms[0]!.id,
      new Date('2026-11-04T09:00').toISOString(),
      new Date('2026-11-04T10:00').toISOString(),
      [],
    );
  });
  it('does not misrepresent an availability failure as a booked room', async () => {
    setup(true);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a start time in the future',
    );
    expect(screen.getByText('Not checked')).toBeInTheDocument();
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check time' })).toBeDisabled();
  });
  it('carries explicit equipment requirements into the booking form', async () => {
    const { onBook } = setup();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Book this room' });
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('checkbox', { name: 'Whiteboard' }));
    await user.click(
      await screen.findByRole('button', { name: 'Book this room' }),
    );
    expect(onBook).toHaveBeenCalledWith(
      rooms[0]!.id,
      expect.any(String),
      expect.any(String),
      ['whiteboard'],
    );
  });
});
