import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { reservation } from '../test/fixtures';
import { ContinuationDialog } from './ContinuationDialog';

describe('additional time', () => {
  it('submits a duration while leaving room, organizer and start time to the server', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <ContinuationDialog
        reservation={reservation}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Additional time'), '30');
    await user.click(
      screen.getByRole('button', { name: 'Reserve extra time' }),
    );
    expect(save).toHaveBeenCalledWith(reservation.id, 30, expect.any(String));
    expect(
      screen.getByText(/Ending this meeting early keeps/),
    ).toBeInTheDocument();
  });

  it('preserves the duration when the next team already has the room', async () => {
    const close = vi.fn();
    render(
      <ContinuationDialog
        reservation={reservation}
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
    await user.selectOptions(screen.getByLabelText('Additional time'), '60');
    await user.click(
      screen.getByRole('button', { name: 'Reserve extra time' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('ROOM_OVERLAP');
    expect(screen.getByLabelText('Additional time')).toHaveValue('60');
    expect(close).not.toHaveBeenCalled();
  });

  it('retries the same duration and identifier after an uncertain confirmation', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError('Retry this request.', 'BOOKING_UNCONFIRMED', true),
      )
      .mockResolvedValueOnce(undefined);
    render(
      <ContinuationDialog
        reservation={reservation}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Reserve extra time' }),
    );
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Additional time')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry reservation' }));
    expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
  });
});
