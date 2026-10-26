import { useState } from 'react';
import type { Room, UsageReport } from '../api/contracts';
import { ErrorNotice } from '../components/Feedback';
import { useApi } from '../hooks/useApi';
import { formatDate, formatTime, toLocalInput, toUtc } from '../lib/dates';

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function UsagePage({
  rooms,
  revision,
}: {
  rooms: Room[];
  revision: number;
}) {
  const [dates, setDates] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from: toLocalInput(start), to: toLocalInput(end) };
  });
  const [roomId, setRoomId] = useState('');
  const [query, setQuery] = useState(
    () =>
      '?' +
      new URLSearchParams({ from: toUtc(dates.from), to: toUtc(dates.to) }),
  );
  const [reportRevision, setReportRevision] = useState(0);
  const report = useApi<UsageReport>(
    '/usage' + query,
    revision + reportRevision,
  );

  return (
    <section aria-labelledby="usage-heading">
      <h2 id="usage-heading" className="section-title">
        Room activity
      </h2>
      <form
        className="filters usage-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const parameters = new URLSearchParams({
            from: toUtc(dates.from),
            to: toUtc(dates.to),
          });
          if (roomId) parameters.set('roomId', roomId);
          setQuery('?' + parameters);
          setReportRevision((value) => value + 1);
        }}
      >
        <label>
          From
          <input
            type="datetime-local"
            required
            value={dates.from}
            onChange={(event) =>
              setDates((current) => ({ ...current, from: event.target.value }))
            }
          />
        </label>
        <label>
          Until
          <input
            type="datetime-local"
            required
            value={dates.to}
            onChange={(event) =>
              setDates((current) => ({ ...current, to: event.target.value }))
            }
          />
        </label>
        <label>
          Room
          <select
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
          >
            <option value="">All rooms</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" type="submit">
          Update report
        </button>
      </form>
      {report.error ? (
        <ErrorNotice error={report.error} />
      ) : report.loading ? (
        <p className="loading" role="status">
          Loading room activity…
        </p>
      ) : report.data ? (
        <>
          <div className="report-context">
            <p>
              {formatDate(report.data.fromUtc)} –{' '}
              {formatDate(report.data.toUtc)}
            </p>
            <span>Updated {formatTime(report.data.asOfUtc)}</span>
          </div>
          <div
            className="usage-table-wrap"
            role="region"
            aria-label="Room activity report"
            tabIndex={0}
          >
            <table className="usage-table">
              <caption className="sr-only">
                Room booking and check-in time in minutes
              </caption>
              <thead>
                <tr>
                  <th scope="col">Room</th>
                  <th scope="col">Bookings</th>
                  <th scope="col">Scheduled</th>
                  <th scope="col">Reported use</th>
                  <th scope="col">Unconfirmed</th>
                  <th scope="col">Freed</th>
                  <th scope="col">Reported share</th>
                </tr>
              </thead>
              <tbody>
                {report.data.rooms.map((room) => (
                  <tr key={room.roomId}>
                    <th scope="row">
                      <strong>{room.roomName}</strong>
                      <span>
                        Floor {room.floor}
                        {!room.isActive ? ' · Inactive' : ''}
                      </span>
                    </th>
                    <td>{room.reservationCount}</td>
                    <td>
                      {number.format(room.scheduledMinutes)} <small>min</small>
                    </td>
                    <td>
                      {number.format(room.observedMinutes)} <small>min</small>
                    </td>
                    <td>
                      {number.format(room.unconfirmedMinutes)}{' '}
                      <small>min</small>
                    </td>
                    <td>
                      {number.format(room.releasedMinutes)} <small>min</small>
                    </td>
                    <td>
                      {room.confirmedSharePercent === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <div className="confirmed-share">
                          <span>
                            {number.format(room.confirmedSharePercent)}%
                          </span>
                          <progress
                            max={100}
                            value={room.confirmedSharePercent}
                            aria-label={room.roomName + ' reported share'}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
