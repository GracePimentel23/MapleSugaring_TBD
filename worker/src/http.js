/** Small HTTP helpers shared by the routers: errors with a status, async handlers, input parsing. */

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function idParam(value, prefix = "") {
  const id = Number(String(value).replace(prefix, ""));
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "invalid id");
  return id;
}

export function optionalNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, `${name} must be a number between ${min} and ${max}`);
  }
  return number;
}

export function optionalText(value, name, max = 200) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text.length > max) throw new HttpError(400, `${name} is longer than ${max} characters`);
  return text || null;
}

export function optionalDate(value, name) {
  if (value === undefined || value === null || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new HttpError(400, `${name} must be YYYY-MM-DD`);
  return String(value);
}
