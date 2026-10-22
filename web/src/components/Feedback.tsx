export function ErrorNotice({ error }: { error: Error }) {
  return (
    <div className="notice error" role="alert">
      {error.message}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">◇</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
