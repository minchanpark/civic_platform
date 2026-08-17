import { timingSafeEqual } from "node:crypto";

export function validJobAuthorization(header: string | null, secret: string | undefined) {
  if (!header?.startsWith("Bearer ") || !secret || secret.length < 32) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
