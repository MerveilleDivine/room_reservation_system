import { NavLink } from 'react-router-dom';
import type { Person } from '../api/contracts';
import { Icon } from '../components/Icon';
import { pages } from './navigation';

interface Props {
  profile: string;
  people: Person[] | null;
  pending: boolean;
  canBook: boolean;
  onProfileChange: (profile: string) => void;
  onNavigate: () => void;
  onRefresh: () => void;
  onBook: () => void;
}

export function WorkspaceHeader({
  profile,
  people,
  pending,
  canBook,
  onProfileChange,
  onNavigate,
  onRefresh,
  onBook,
}: Props) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink className="brand" to="/reservations" onClick={onNavigate}>
          <span className="brand-mark">
            <Icon name="door" size={20} />
          </span>
          <span>Roomwise</span>
        </NavLink>
        <nav aria-label="Main navigation">
          {Object.entries(pages)
            .filter(
              ([key]) =>
                profile === 'admin' || (key !== 'people' && key !== 'usage'),
            )
            .map(([key, page]) => (
              <NavLink
                key={key}
                to={page.path}
                className={({ isActive }) =>
                  isActive ? 'nav-item selected' : 'nav-item'
                }
                onClick={onNavigate}
              >
                <span>{page.label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="header-actions">
          <label className="profile-switcher">
            <span className="sr-only">Current profile</span>
            <select
              aria-label="Current profile"
              value={profile}
              disabled={pending || !people}
              onChange={(event) => onProfileChange(event.target.value)}
            >
              {!people ? <option value={profile}>Profile</option> : null}
              {people?.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
              <option value="admin">Administrator</option>
            </select>
          </label>
          <button
            className="icon-button"
            aria-label="Refresh workspace"
            title="Refresh"
            onClick={onRefresh}
          >
            <Icon name="refresh" size={17} />
          </button>
          <button
            className="button primary new-booking"
            disabled={!canBook || pending}
            onClick={onBook}
          >
            <Icon name="plus" size={16} />
            <span className="booking-button-label">New reservation</span>
          </button>
        </div>
      </div>
    </header>
  );
}
