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
  const fetchMock = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.startsWith('/api/rooms')
            ? rooms
            : url.startsWith('/api/users')
              ? [...people, other]
              : [
                  {
                    ...reservation,
                    organizerId: other.id,
                    organizerName: 'Emilija Petrauskaite',
                  },
                ],
        ),
      ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('profile ownership', () => {
  it('keeps another members booking visible and read-only, while admin can manage it', async () => {
    mockWorkspace();
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Atlas' });
    await user.click(screen.getByRole('button', { name: 'Reservations' }));
    await screen.findByRole('heading', { name: 'Planning' });
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
    await screen.findByRole('heading', { name: 'Atlas' });
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
    await screen.findByRole('heading', { name: 'Atlas' });
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
