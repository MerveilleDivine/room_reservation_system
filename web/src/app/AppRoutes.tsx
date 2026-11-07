import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ReservationsPage } from '../pages/ReservationsPage';
import { RoomsPage } from '../pages/RoomsPage';
import { UsagePage } from '../pages/UsagePage';
import { UsersPage } from '../pages/UsersPage';
import { WorkspaceShell } from './WorkspaceShell';
import { useWorkspace } from './useWorkspace';

function ReservationsRoute() {
  const { profile, allRooms, people, revision, workflow, refresh } =
    useWorkspace();
  return (
    <ReservationsPage
      key={profile}
      profile={profile}
      rooms={allRooms.data ?? []}
      people={people.data ?? []}
      revision={revision}
      pending={workflow.pending}
      saved={workflow.saved}
      onDismissSaved={workflow.dismissSaved}
      onBook={() => workflow.openBooking()}
      onRefresh={refresh}
      onAction={workflow.handleAction}
    />
  );
}

function RoomsRoute() {
  const { profile, allRooms, revision, canBook, workflow } = useWorkspace();
  return (
    <RoomsPage
      allRooms={allRooms}
      revision={revision}
      canBook={canBook}
      profile={profile}
      onBook={(roomId, startUtc, endUtc, requiredEquipment) =>
        workflow.openBooking({
          reservation: null,
          roomId,
          startUtc,
          endUtc,
          requiredEquipment,
        })
      }
    />
  );
}

function PeopleRoute() {
  const { profile, people } = useWorkspace();
  return profile === 'admin' ? (
    <UsersPage people={people} />
  ) : (
    <Navigate to="/reservations" replace />
  );
}

function UsageRoute() {
  const { profile, allRooms, revision } = useWorkspace();
  return profile === 'admin' ? (
    <UsagePage rooms={allRooms.data ?? []} revision={revision} />
  ) : (
    <Navigate to="/reservations" replace />
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<WorkspaceShell />}>
        <Route index element={<Navigate to="/reservations" replace />} />
        <Route path="reservations" element={<ReservationsRoute />} />
        <Route path="rooms" element={<RoomsRoute />} />
        <Route path="people" element={<PeopleRoute />} />
        <Route path="usage" element={<UsageRoute />} />
        <Route
          path="*"
          element={
            <section>
              <h1>Page not found</h1>
              <p>That page does not exist.</p>
              <Link className="button secondary" to="/reservations">
                Back to reservations
              </Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}
