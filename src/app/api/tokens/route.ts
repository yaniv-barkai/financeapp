import { NextRequest } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAccountRegistry } from "@/lib/server/account-registry";
import { isApiTokenScope } from "@/lib/server/api-token-core";
import {
  ApiTokenError,
  createApiToken,
  listApiTokens,
  revokeApiToken,
} from "@/lib/server/api-tokens";

async function requireActiveUser(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw new ApiTokenError("Unauthorized", 401);

  let uid: string;
  try {
    uid = (await verifyIdToken(token)).uid;
  } catch {
    throw new ApiTokenError("Unauthorized", 401);
  }

  const registry = await getAccountRegistry(uid);
  if (registry?.status !== "active") throw new ApiTokenError("Forbidden", 403);
  return uid;
}

function errorResponse(err: unknown): Response {
  if (err instanceof ApiTokenError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const uid = await requireActiveUser(req);
    return Response.json({ tokens: await listApiTokens(uid) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await requireActiveUser(req);
    const body = (await req.json()) as { name?: string; scope?: string };
    const name = body.name?.trim().slice(0, 60);
    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }
    if (!isApiTokenScope(body.scope)) {
      return Response.json({ error: "Scope must be read or write" }, { status: 400 });
    }
    const { token, summary } = await createApiToken(uid, name, body.scope);
    return Response.json({ token, summary });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const uid = await requireActiveUser(req);
    const body = (await req.json()) as { id?: string };
    const id = body.id?.trim();
    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }
    await revokeApiToken(uid, id);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
