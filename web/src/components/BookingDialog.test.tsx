import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { people, rooms } from '../test/fixtures';
import { BookingDialog } from './BookingDialog';

describe('reservation form', () => {
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
    expect(await screen.findByRole('alert')).toHaveTextContent('ROOM_OVERLAP');
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
});
