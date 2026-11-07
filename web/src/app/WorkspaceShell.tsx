import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Person, Room } from '../api/contracts';
import { ErrorNotice } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { peopleApi } from '../features/people/api';
import { roomsApi } from '../features/rooms/api';
import { useApi } from '../hooks/useApi';
import { readProfile, storeProfile } from '../lib/profile';
import { useApiCache } from '../shared/api/useApiCache';
import { pages } from './navigation';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceDialogs } from './WorkspaceDialogs';
import { useReservationWorkflow } from './useReservationWorkflow';

export function WorkspaceShell() {
  const [profile, setProfile] = useState(readProfile);
  const [revision, setRevision] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const cache = useApiCache();
  const workflow = useReservationWorkflow(profile, () =>
    navigate('/reservations'),
  );
  const allRooms = useApi<Room[]>(roomsApi.listPath(), revision, profile);
  const people = useApi<Person[]>(peopleApi.listPath, revision, profile);
  const current = Object.values(pages).find(
    (page) => page.path === location.pathname,
  );
  const isReservations = location.pathname === '/reservations';
  const person = people.data?.find((item) => item.id === profile);
  const displayName = profile === 'admin' ? 'Administrator' : person?.firstName;
  const today = new Date();
  const greeting =
    today.getHours() < 12
      ? 'Good morning'
      : today.getHours() < 18
        ? 'Good afternoon'
        : 'Good evening';
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(today);
  const canBook = Boolean(
    allRooms.data &&
      people.data &&
      !allRooms.error &&
      !people.error &&
      (profile === 'admin' ||
        people.data.some((person) => person.id === profile)),
  );

  function refresh() {
    workflow.clearFeedback();
    setRevision((value) => value + 1);
  }

  function changeProfile(next: string) {
    if (workflow.pending) return;
    void cache.clearProfile(profile);
    storeProfile(next);
    setProfile(next);
    workflow.reset();
    navigate('/reservations');
  }

  const context = {
    profile,
    allRooms,
    people,
    revision,
    canBook,
    workflow,
    refresh,
  };
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <WorkspaceHeader
        profile={profile}
        people={people.data}
        pending={workflow.pending}
        canBook={canBook}
        onProfileChange={changeProfile}
        onNavigate={() => {
          workflow.clearFeedback();
          window.scrollTo({ top: 0 });
        }}
        onRefresh={refresh}
        onBook={() => workflow.openBooking()}
      />
      <main id="main" tabIndex={-1} aria-busy={workflow.pending}>
        <div className="main-content">
          {current ? (
            <section className="page-intro">
              <div className="intro-text">
                <p className="eyebrow">
                  {isReservations ? dateLabel : 'Your workspace'}
                </p>
                <h1>
                  {isReservations
                    ? `${greeting}${displayName ? `, ${displayName}` : ''}.`
                    : current.title}
                </h1>
                <p className="intro-copy">
                  {isReservations
                    ? profile === 'admin'
                      ? 'A clear view of what’s next across the workspace.'
                      : 'Your meetings, without the back and forth.'
                    : current.description}
                </p>
              </div>
            </section>
          ) : null}
          {workflow.notice ? (
            <div className="notice success" role="status">
              <Icon name="check" size={18} />
              <span>{workflow.notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss confirmation"
                onClick={workflow.dismissNotice}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ) : null}
          {workflow.actionError && workflow.dialog.kind !== 'confirmation' ? (
            <ErrorNotice error={workflow.actionError} />
          ) : null}
          {people.error &&
          !allRooms.error &&
          location.pathname !== '/people' ? (
            <ErrorNotice error={people.error} />
          ) : null}
          <Outlet context={context} />
          <footer className="main-footer">
            <span>© {today.getFullYear()} Mervine Muganguzi · Roomwise</span>
          </footer>
        </div>
      </main>
      <WorkspaceDialogs
        profile={profile}
        rooms={allRooms.data}
        people={people.data}
        workflow={workflow}
      />
    </div>
  );
}
