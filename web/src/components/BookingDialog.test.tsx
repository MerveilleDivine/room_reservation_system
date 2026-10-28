import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { Room } from '../api/contracts';
import { people, reservation, rooms } from '../test/fixtures';
import { BookingDialog } from './BookingDialog';

const birch: Room = {
  id: '10000000-0000-0000-0000-000000000002',
  name: 'Birch',
  capacity: 6,
  floor: '1',
  equipment: ['projector', 'whiteboard'],
  isActive: true,
};
const futureStart = new Date(Date.now() + 2 * 86400000).toISOString();
const futureEnd = new Date(Date.now() + 2 * 86400000 + 3600000).toISOString();

function setupSuggestion(
  response: unknown = [
    { room: birch, missingEquipment: ['tv', 'videoConferencing'] },
  ],
  status = 200,
) {
  const fetchMock = vi.fn(
    async (_url: string) => new Response(JSON.stringify(response), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <BookingDialog
      organizerId={people[0]!.id}
      rooms={[...rooms, birch]}
      people={people}
      initial={null}
      preferredStartUtc={futureStart}
      preferredEndUtc={futureEnd}
      requiredEquipment={['whiteboard']}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  return { fetchMock, save };
}

describe('reservation form', () => {
  it('suggests a smaller room for the entered attendees and changes only the room when accepted', async () => {
    const { fetchMock, save } = setupSuggestion();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('Meeting title'),
      'Six-person review',
    );
    fireEvent.change(screen.getByLabelText('Number of attendees'), {
      target: { value: '6' },
    });
    const start = (screen.getByLabelText('Starts') as HTMLInputElement).value;
    const end = (screen.getByLabelText('Ends') as HTMLInputElement).value;
    const choose = await screen.findByRole('button', { name: 'Use Birch' });
    const query = new URL(
      String(fetchMock.mock.calls.at(-1)![0]),
      'http://localhost',
    ).searchParams;
    expect(query.get('attendees')).toBe('6');
    expect(query.get('equipment')).toBe('whiteboard');
    expect(query.get('startUtc')).toBe(new Date(start).toISOString());
    expect(query.get('endUtc')).toBe(new Date(end).toISOString());
    expect(
      screen.getByText(/Compared with your selected room/),
    ).toHaveTextContent('TV screen, Video conferencing');
    await user.click(choose);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Room' })).toHaveValue(
      birch.id,
    );
    expect(screen.getByLabelText('Meeting title')).toHaveValue(
      'Six-person review',
    );
    expect(screen.getByLabelText('Number of attendees')).toHaveValue(6);
    expect(screen.getByLabelText('Starts')).toHaveValue(start);
    expect(screen.getByLabelText('Ends')).toHaveValue(end);
    expect(
      screen.queryByLabelText('Smaller room suggestion'),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Create reservation' }),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: birch.id, attendees: 6 }),
      undefined,
      expect.any(String),
    );
  });

  it('leaves the original room selected unless the suggestion is accepted', async () => {
    const { save } = setupSuggestion();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('Meeting title'),
      'Keep the larger room',
    );
    await screen.findByRole('button', { name: 'Use Birch' });
    await user.click(
      screen.getByRole('button', { name: 'Create reservation' }),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: rooms[0]!.id }),
      undefined,
      expect.any(String),
    );
  });

  it('hides an obsolete suggestion immediately when the attendee count or interval changes', async () => {
    setupSuggestion();
    await screen.findByRole('button', { name: 'Use Birch' });
    fireEvent.change(screen.getByLabelText('Number of attendees'), {
      target: { value: '7' },
    });
    expect(
      screen.queryByRole('button', { name: 'Use Birch' }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Number of attendees'), {
      target: { value: '6' },
    });
    await screen.findByRole('button', { name: 'Use Birch' });
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '' } });
    expect(
      screen.queryByRole('button', { name: 'Use Birch' }),
    ).not.toBeInTheDocument();
  });

  it('still allows booking when the optional suggestion request fails', async () => {
    const { fetchMock, save } = setupSuggestion(
      { detail: 'Temporarily unavailable' },
      503,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Meeting title'), 'Normal booking');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      screen.queryByLabelText('Smaller room suggestion'),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Create reservation' }),
    );
    expect(save).toHaveBeenCalledOnce();
  });

  it('submits the selected room, organizer and UTC timestamps', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <BookingDialog
        rooms={rooms}
        people={people}
        initial={null}
        preferredRoomId={rooms[0]!.id}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Meeting title'), 'Sprint planning');
    await user.selectOptions(screen.getByLabelText('Organizer'), people[0]!.id);
    fireEvent.change(screen.getByLabelText('Starts'), {
      target: { value: '2026-10-25T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Ends'), {
      target: { value: '2026-10-25T10:00' },
    });
    await user.click(
      screen.getByRole('button', { name: 'Create reservation' }),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: rooms[0]!.id,
          organizerId: people[0]!.id,
          title: 'Sprint planning',
          startUtc: new Date('2026-10-25T09:00').toISOString(),
          endUtc: new Date('2026-10-25T10:00').toISOString(),
        }),
        undefined,
        expect.any(String),
      ),
    );
  });

  it('preserves the form and displays backend validation failures', async () => {
    const close = vi.fn();
    render(
      <BookingDialog
        rooms={rooms}
        people={people}
        initial={null}
        preferredRoomId={rooms[0]!.id}
        onSave={vi
          .fn()
          .mockRejectedValue(
            new ApiError(
              'This room is already booked during that time.',
              'ROOM_OVERLAP',
            ),
          )}
        onClose={close}
      />,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Meeting title'), 'Keep this title');
    await user.selectOptions(screen.getByLabelText('Organizer'), people[0]!.id);
    await user.click(
      screen.getByRole('button', { name: 'Create reservation' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'already booked',
    );
    expect(screen.getByLabelText('Meeting title')).toHaveValue(
      'Keep this title',
    );
    expect(close).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Create reservation' }),
    ).toBeEnabled();
  });

  it('does not offer inactive rooms for selection', () => {
    render(
      <BookingDialog
        rooms={rooms}
        people={people}
        initial={null}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('option', { name: /Studio/ })).toBeDisabled();
  });

  it('retries an unconfirmed booking with the exact same payload and identifier', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(
          'Confirmation was lost. Retry this request.',
          'BOOKING_UNCONFIRMED',
          true,
        ),
      )
      .mockResolvedValueOnce(undefined);
    render(
      <BookingDialog
        rooms={rooms}
        people={people}
        initial={reservation}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confirmation was lost',
    );
    expect(screen.getByLabelText('Meeting title')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry reservation' }));
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
    expect(save.mock.calls[1]![0]).toMatchObject({
      title: reservation.title,
      roomId: reservation.roomId,
    });
  });

  it('assigns a new identifier when input changes after a definite rejection', async () => {
    const save = vi
      .fn()
      .mockRejectedValue(new ApiError('Room is busy.', 'ROOM_OVERLAP'));
    render(
      <BookingDialog
        rooms={rooms}
        people={people}
        initial={reservation}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    await user.type(screen.getByLabelText('Meeting title'), ' revised');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(save.mock.calls[1]![2]).not.toBe(save.mock.calls[0]![2]);
  });
});
