import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { ExtraTimeAvailability } from '../api/contracts';
import { reservation } from '../test/fixtures';
import { ContinuationDialog } from './ContinuationDialog';

function available(maximumMinutes = 60): ExtraTimeAvailability {
  return {
    maximumMinutes,
    startsAtUtc: reservation.endUtc,
    blockedFromUtc: null,
    blockedUntilUtc: null,
    reasonCode: null,
    message: null,
  };
}
function mockAvailability(value = available()) {
  const fetchMock = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(value))),
    );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
async function setMinutes(value: number) {
  const user = userEvent.setup();
  const input = screen.getByLabelText('Additional time');
  await waitFor(() => expect(input).toBeEnabled());
  await user.clear(input);
  await user.type(input, String(value));
  return user;
}

describe('additional time', () => {
  beforeEach(() => mockAvailability());

  it('submits a duration while leaving room, organizer and start time to the server', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <ContinuationDialog
        reservation={reservation}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    const user = await setMinutes(30);
    await user.click(
      screen.getByRole('button', { name: 'Reserve extra time' }),
    );
    expect(save).toHaveBeenCalledWith(reservation.id, 30, expect.any(String));
    expect(
      screen.getByText(/Extra time is reserved separately/),
    ).toBeInTheDocument();
  });

  it('offers the exact two-minute gap and sends no more than that', async () => {
    mockAvailability({
      ...available(2),
      blockedFromUtc: '2030-10-24T11:02:00Z',
      blockedUntilUtc: '2030-10-24T12:00:00Z',
      reasonCode: 'ROOM_OVERLAP',
    });
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <ContinuationDialog
        reservation={reservation}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText('Up to 2 additional minutes available.');
    await waitFor(() =>
      expect(screen.getByLabelText('Additional time')).toHaveValue(2),
    );
    expect(screen.getByLabelText('Additional time')).toHaveAttribute(
      'max',
      '2',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Reserve extra time' }));
    expect(save).toHaveBeenCalledWith(reservation.id, 2, expect.any(String));
  });

  it('blocks an immediate next booking without exposing its title or organizer', async () => {
    mockAvailability({
      ...available(0),
      reasonCode: 'ROOM_OVERLAP',
      message: 'The room is booked immediately after this meeting.',
      blockedFromUtc: reservation.endUtc,
      blockedUntilUtc: '2030-10-24T12:00:00Z',
    });
    const save = vi.fn();
    render(
      <ContinuationDialog
        reservation={reservation}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    await screen.findByText(
      'The room is booked immediately after this meeting.',
    );
    expect(
      screen.getByRole('button', { name: 'Reserve extra time' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('Additional time')).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });

  it('refreshes the gap after a conflicting save instead of closing or silently extending', async () => {
    const fetchMock = mockAvailability();
    const close = vi.fn();
    const save = vi.fn().mockImplementation(() => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(available(2)))),
      );
      throw new ApiError('Only 2 more minutes are available.', 'ROOM_OVERLAP');
    });
    render(
      <ContinuationDialog
        reservation={reservation}
        onSave={save}
        onClose={close}
      />,
    );
    const user = await setMinutes(30);
    await user.click(
      screen.getByRole('button', { name: 'Reserve extra time' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only 2 more minutes',
    );
    await screen.findByText('Up to 2 additional minutes available.');
    expect(screen.getByLabelText('Additional time')).toHaveValue(2);
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
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Reserve extra time' }),
      ).toBeEnabled(),
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

  it('does not allow a save if availability cannot be checked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
    render(
      <ContinuationDialog
        reservation={reservation}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await screen.findByRole('alert');
    expect(
      screen.getByRole('button', { name: 'Reserve extra time' }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled();
  });
});
