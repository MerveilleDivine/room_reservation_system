import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { UsageReport } from '../api/contracts';
import { rooms } from '../test/fixtures';
import { UsagePage } from './UsagePage';

const report: UsageReport = {
  fromUtc: '2026-10-15T08:00:00Z',
  toUtc: '2026-10-22T08:00:00Z',
  asOfUtc: '2026-10-22T08:00:00Z',
  measurementSource: 'Manual check-in',
  observationNote:
    'Time without a check-in is unconfirmed, not evidence that a room was unused.',
  rooms: [
    {
      roomId: rooms[0]!.id,
      roomName: 'Atlas',
      floor: '1',
      isActive: true,
      reservationCount: 2,
      scheduledMinutes: 120,
      elapsedReservedMinutes: 100,
      observedMinutes: 93,
      unconfirmedMinutes: 7,
      releasedMinutes: 20,
      unconfirmedCompletedCount: 0,
      confirmedSharePercent: 93,
    },
  ],
};

describe('room usage', () => {
  it('renders API-calculated time and explains unconfirmed observations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(report))),
    );
    render(<UsagePage rooms={rooms} revision={0} />);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Atlas')).toBeInTheDocument();
    expect(within(table).getByText('93%')).toBeInTheDocument();
    expect(screen.getByText(report.observationNote)).toBeInTheDocument();
    expect(
      within(table).getByRole('progressbar', { name: 'Atlas confirmed share' }),
    ).toHaveAttribute('value', '93');
  });

  it('sends selected room and local date range as UTC to the backend', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(report))),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<UsagePage rooms={rooms} revision={0} />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-10-19T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Until'), {
      target: { value: '2026-10-22T09:00' },
    });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Room'), rooms[0]!.id);
    await user.click(screen.getByRole('button', { name: 'Update report' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/usage?' +
          new URLSearchParams({
            from: new Date('2026-10-19T09:00').toISOString(),
            to: new Date('2026-10-22T09:00').toISOString(),
            roomId: rooms[0]!.id,
          }),
        expect.anything(),
      ),
    );
  });

  it('preserves the range when the backend rejects it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(report)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'INVALID_REPORT_RANGE',
            detail: 'Choose a report end after its start.',
          }),
          { status: 400 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<UsagePage rooms={rooms} revision={0} />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-10-22T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Until'), {
      target: { value: '2026-10-19T09:00' },
    });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Update report' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a report end after its start.',
    );
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-22T09:00');
  });
});
