import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ServerContext } from "@modelcontextprotocol/server";
import {
  API_TOKEN_PREFIX,
  LAST_USED_UPDATE_MS,
  displayPrefix,
  generateRawToken,
  hasScope,
  hashToken,
  isApiTokenScope,
  isTokenUsable,
  looksLikeApiToken,
  scopesFor,
  shouldTouchLastUsed,
} from "./api-token-core";
import { ToolError, getCaller } from "../mcp/context";

function ctxWith(authInfo?: { scopes: string[]; extra?: Record<string, unknown> }): ServerContext {
  return {
    http: authInfo ? { authInfo: { token: "t", clientId: "c", ...authInfo } } : undefined,
  } as unknown as ServerContext;
}

describe("api token generation", () => {
  it("creates unique prefixed tokens", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    assert.ok(a.startsWith(API_TOKEN_PREFIX));
    assert.notEqual(a, b);
    assert.ok(looksLikeApiToken(a));
  });

  it("hashes deterministically without exposing the token", () => {
    const token = generateRawToken();
    assert.equal(hashToken(token), hashToken(token));
    assert.match(hashToken(token), /^[0-9a-f]{64}$/);
    assert.ok(!hashToken(token).includes(token.slice(3)));
  });

  it("shows only a short prefix", () => {
    const token = generateRawToken();
    const prefix = displayPrefix(token);
    assert.ok(token.startsWith(prefix));
    assert.ok(prefix.length < 12);
  });

  it("rejects values that are not api tokens", () => {
    assert.equal(looksLikeApiToken(undefined), false);
    assert.equal(looksLikeApiToken(""), false);
    assert.equal(looksLikeApiToken("eyJhbGciOiJSUzI1NiJ9.firebase.idtoken"), false);
    assert.equal(looksLikeApiToken("fa_short"), false);
  });
});

describe("token usability", () => {
  it("accepts an active, unrevoked token", () => {
    assert.equal(isTokenUsable({}, "active"), true);
  });

  it("rejects revoked tokens", () => {
    assert.equal(isTokenUsable({ revokedAtMs: Date.now() }, "active"), false);
  });

  it("rejects disabled or unregistered accounts", () => {
    assert.equal(isTokenUsable({}, "disabled"), false);
    assert.equal(isTokenUsable({}, null), false);
    assert.equal(isTokenUsable(null, "active"), false);
  });

  it("throttles last-used writes", () => {
    const now = 10 * LAST_USED_UPDATE_MS;
    assert.equal(shouldTouchLastUsed(undefined, now), true);
    assert.equal(shouldTouchLastUsed(now - 1000, now), false);
    assert.equal(shouldTouchLastUsed(now - LAST_USED_UPDATE_MS, now), true);
  });
});

describe("scopes", () => {
  it("validates scope values", () => {
    assert.equal(isApiTokenScope("read"), true);
    assert.equal(isApiTokenScope("write"), true);
    assert.equal(isApiTokenScope("admin"), false);
  });

  it("write tokens can also read; read tokens cannot write", () => {
    assert.equal(hasScope(scopesFor("write"), "read"), true);
    assert.equal(hasScope(scopesFor("write"), "write"), true);
    assert.equal(hasScope(scopesFor("read"), "read"), true);
    assert.equal(hasScope(scopesFor("read"), "write"), false);
  });
});

describe("getCaller", () => {
  it("takes uid from the verified token", () => {
    const caller = getCaller(ctxWith({ scopes: ["read"], extra: { uid: "u1" } }), "read");
    assert.equal(caller.uid, "u1");
  });

  it("blocks write tools for read-only tokens", () => {
    assert.throws(
      () => getCaller(ctxWith({ scopes: scopesFor("read"), extra: { uid: "u1" } }), "write"),
      ToolError
    );
  });

  it("allows write tools for write tokens", () => {
    const caller = getCaller(ctxWith({ scopes: scopesFor("write"), extra: { uid: "u1" } }), "write");
    assert.equal(caller.uid, "u1");
  });

  it("rejects requests without auth or uid", () => {
    assert.throws(() => getCaller(ctxWith(), "read"), ToolError);
    assert.throws(() => getCaller(ctxWith({ scopes: ["read"] }), "read"), ToolError);
  });
});
