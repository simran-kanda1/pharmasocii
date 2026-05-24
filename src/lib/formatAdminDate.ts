export function formatAdminDate(value?: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}`;
}

export function formatAdminDateTime(value?: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) return "—";
  const date = formatAdminDate(value);
  const hours = value.getHours();
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date} ${h12}:${pad(value.getMinutes())} ${ampm}`;
}
