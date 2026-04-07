export function formatEta(etaMinutes: number): string {
  if (etaMinutes < 1) return 'Nu';
  if (etaMinutes === 1) return '1 min';
  return `${Math.round(etaMinutes)} min`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (isSameDay(date, today)) return 'Hoy';
  if (isSameDay(date, tomorrow)) return 'Mañana';
  return date.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function secondsToMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}
