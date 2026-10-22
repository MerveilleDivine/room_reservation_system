export function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toUtc(localValue: string): string {
  return new Date(localValue).toISOString();
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}
export function formatTime(value: string) {
  return timeFormatter.format(new Date(value));
}
