import { createHash, randomBytes } from "node:crypto";

export type ApiTokenScope = "read" | "write";

export const API_TOKEN_PREFIX = "fa_";
export const MAX_TOKENS_PER_USER = 20;
export const LAST_USED_UPDATE_MS = 60 * 60 * 1000;

export interface ApiTokenRecord {
  uid: string;
  name: string;
  /** First characters of the raw token, safe to display. */
  prefix: string;
  scope: ApiTokenScope;
  createdAtMs: number;
  lastUsedAtMs?: number;
  revokedAtMs?: number;
}

export function generateRawToken(): string {
  return API_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function displayPrefix(raw: string): string {
  return raw.slice(0, API_TOKEN_PREFIX.length + 6);
}

export function looksLikeApiToken(raw: string | undefined | null): raw is string {
  return typeof raw === "string" && raw.startsWith(API_TOKEN_PREFIX) && raw.length > 20;
}

export function isApiTokenScope(value: unknown): value is ApiTokenScope {
  return value === "read" || value === "write";
}

/** Scopes granted to MCP requests: write tokens can also read. */
export function scopesFor(scope: ApiTokenScope): string[] {
  return scope === "write" ? ["read", "write"] : ["read"];
}

export function hasScope(granted: readonly string[] | undefined, needed: ApiTokenScope): boolean {
  return Boolean(granted?.includes(needed));
}

export function isTokenUsable(
  record: Pick<ApiTokenRecord, "revokedAtMs"> | null,
  accountStatus: string | null
): boolean {
  if (!record || record.revokedAtMs) return false;
  return accountStatus === "active";
}

export function shouldTouchLastUsed(lastUsedAtMs: number | undefined, nowMs: number): boolean {
  return !lastUsedAtMs || nowMs - lastUsedAtMs >= LAST_USED_UPDATE_MS;
}
