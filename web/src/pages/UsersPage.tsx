import type { Person } from '../api/contracts';
import { EmptyState, ErrorNotice } from '../components/Feedback';
import type { ApiResource } from '../hooks/useApi';

export function UsersPage({ people }: { people: ApiResource<Person[]> }) {
  return (
    <section aria-labelledby="users-heading">
      <div className="section-heading">
        <h2 id="users-heading">Your organizers</h2>
        <span>People, not just calendar slots</span>
      </div>
      {people.error ? (
        <ErrorNotice error={people.error} />
      ) : people.loading ? (
        <p className="loading" role="status">
          Loading users…
        </p>
      ) : people.data?.length ? (
        <div className="people-list">
          {people.data.map((person) => (
            <article key={person.id} className="person-card">
              <span className="person-avatar" aria-hidden="true">
                {person.firstName[0]}
                {person.lastName[0]}
              </span>
              <div>
                <h3>
                  {person.firstName} {person.lastName}
                </h3>
                <small className="person-id">ID: {person.id}</small>
              </div>
              <div className="person-count">
                <strong>{person.activeReservationCount}</strong>
                <span>active reservations</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No organizers yet."
          description="Seeded users will appear when the API is running."
        />
      )}
    </section>
  );
}
