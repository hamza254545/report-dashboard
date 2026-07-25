const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

export function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

export function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function isValidUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function requireString(value, field, { min = 1, max = 500 } = {}) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    throw new ValidationError(`${field} must be a string between ${min} and ${max} characters.`);
  }
  return value.trim();
}

export function requireEmail(value, field = "email") {
  if (!isValidEmail(value)) {
    throw new ValidationError(`${field} must be a valid email address.`);
  }
  return value.trim().toLowerCase();
}

export function requireUuid(value, field) {
  if (!isValidUuid(value)) {
    throw new ValidationError(`${field} must be a valid UUID.`);
  }
  return value;
}

export function optionalDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (!isValidDate(value)) {
    throw new ValidationError(`${field} must be a date in YYYY-MM-DD format.`);
  }
  return value;
}

export function validateDateRange(startDate, endDate, { maxRangeDays = 400 } = {}) {
  const start = optionalDate(startDate, "startDate");
  const end = optionalDate(endDate, "endDate");
  if (start && end) {
    const startMs = new Date(`${start}T00:00:00Z`).getTime();
    const endMs = new Date(`${end}T00:00:00Z`).getTime();
    if (startMs > endMs) {
      throw new ValidationError("startDate must be before or equal to endDate.");
    }
    const rangeDays = (endMs - startMs) / (24 * 60 * 60 * 1000);
    if (rangeDays > maxRangeDays) {
      throw new ValidationError(`Date range cannot exceed ${maxRangeDays} days.`);
    }
  }
  return { start, end };
}
