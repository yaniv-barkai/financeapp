import { NextRequest } from "next/server";
import { DecodedIdToken } from "firebase-admin/auth";
import { verifyIdToken } from "@/lib/firebase-admin";

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export async function requireAdmin(req: NextRequest): Promise<DecodedIdToken> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw new AdminAuthError("Unauthorized", 401);
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await verifyIdToken(token);
  } catch {
    throw new AdminAuthError("Unauthorized", 401);
  }

  if (decoded.admin !== true) {
    throw new AdminAuthError("Forbidden", 403);
  }

  return decoded;
}

export function adminErrorResponse(err: unknown): Response {
  if (err instanceof AdminAuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return Response.json({ error: message }, { status: 500 });
}
