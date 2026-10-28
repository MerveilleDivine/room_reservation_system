import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { people, reservation, rooms } from '../test/fixtures';
import { readProfile, storeProfile } from '../lib/profile';

const other = {
  ...people[0]!,
  id: '20000000-0000-0000-0000-000000000002',
  firstName: 'Emilija',
  lastName: 'Petrauskaite',
};

function mockWorkspace() {
  const fetchMock = vi.fn(async (url: string) => {
    const otherBooking = {
      ...reservation,
      organizerId: other.id,
      organizerName: 'Emilija Petrauskaite',
    };
    const parameters = new URL(url, 'http://roomwise.test').searchParams;
    const items =
      parameters.get('organizerId') === people[0]!.id ? [] : [otherBooking];
    const data = url.startsWith('/api/rooms')
      ? rooms
      : url.startsWith('/api/users')
        ? [...people, other]
        : { items, totalCount: items.length, page: 1, pageSize: 6 };
    return new Response(JSON.stringify(data));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('profile ownership', () => {
  it('hides other members bookings and administrative views, while admin can manage them', async () => {
    mockWorkspace();
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New reservation' }),
      ).toBeEnabled(),
    );
    await screen.findByRole('heading', {
      name: 'A little room in your schedule.',
    });
    expect(
      screen.queryByRole('heading', { name: 'Planning' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Everyone' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'People' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Current profile'), 'admin');
    expect(
      await screen.findByRole('button', { name: 'Edit' }),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Current profile'),
      people[0]!.id,
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Edit' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('fills a members organizer automatically and closes an open form when profiles change', async () => {
    mockWorkspace();
    render(<App />);
    const user = userEvent.setup();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New reservation' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'New reservation' }));
    expect(screen.getByLabelText('Organizer')).toHaveValue('Alex Morgan');
    expect(screen.getByLabelText('Organizer')).toHaveAttribute('readonly');
    await user.selectOptions(
      screen.getByLabelText('Current profile'),
      other.id,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New reservation' }));
    expect(screen.getByLabelText('Organizer')).toHaveValue(
      'Emilija Petrauskaite',
    );
    expect(readProfile()).toBe(other.id);
  });

  it('sends the selected profile with requests and restores it on mount', async () => {
    storeProfile(other.id);
    const fetchMock = mockWorkspace();
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'New reservation' }),
      ).toBeEnabled(),
    );
    expect(screen.getByLabelText('Current profile')).toHaveValue(other.id);
    for (const call of fetchMock.mock.calls) {
      expect(
        new Headers((call as unknown as [string, RequestInit])[1].headers).get(
          'X-Roomwise-Profile',
        ),
      ).toBe(other.id);
    }
  });
});
