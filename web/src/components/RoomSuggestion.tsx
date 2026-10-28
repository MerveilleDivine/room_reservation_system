import { useEffect, useState } from 'react';
import { equipmentLabels } from '../api/contracts';
import type { Equipment, RoomSuggestion as Suggestion } from '../api/contracts';
import { useApi } from '../hooks/useApi';

export function RoomSuggestion({
  path,
  onChoose,
}: {
  path: string | null;
  onChoose: (roomId: string) => void;
}) {
  const [settledPath, setSettledPath] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledPath(path), 250);
    return () => window.clearTimeout(timer);
  }, [path]);
  const result = useApi<Suggestion[]>(settledPath === path ? path : null, 0);
  const suggestion = result.data?.[0];
  if (!suggestion) return null;
  const { room, missingEquipment } = suggestion;
  const equipment = (items: Equipment[]) =>
    items.map((item) => equipmentLabels[item]).join(', ');

  return (
    <aside
      className="room-suggestion"
      aria-label="Smaller room suggestion"
      aria-live="polite"
    >
      <div>
        <h3>A smaller space could work</h3>
        <p>
          {room.name} seats {room.capacity} and is available for your full
          meeting.
        </p>
        <p className="form-note">
          Floor {room.floor} ·{' '}
          {equipment(room.equipment) || 'No equipment listed'}
        </p>
        {missingEquipment.length ? (
          <p className="form-note">
            Compared with your selected room, it has no{' '}
            {equipment(missingEquipment)}.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="button secondary"
        onClick={() => onChoose(room.id)}
      >
        Use {room.name}
      </button>
    </aside>
  );
}
