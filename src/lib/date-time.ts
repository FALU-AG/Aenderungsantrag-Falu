export const BUSINESS_TIME_ZONE = "Europe/Zurich";

const dateTimeZurichFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateZurichFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatDateTimeZurich(value: Date | string | number) {
  return dateTimeZurichFormatter.format(new Date(value));
}

export function formatDateZurich(value: Date | string | number) {
  return dateZurichFormatter.format(new Date(value));
}
