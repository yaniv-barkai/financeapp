import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { adminErrorResponse, requireAdmin } from "@/lib/server/require-admin";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json()) as { uid?: string; email?: string };
    const auth = getAdminAuth();

    let email = body.email?.trim().toLowerCase();
    if (!email && body.uid?.trim()) {
      const user = await auth.getUser(body.uid.trim());
      email = user.email?.toLowerCase();
    }
    if (!email) {
      return Response.json({ error: "email or uid is required" }, { status: 400 });
    }

    const resetLink = await auth.generatePasswordResetLink(email);
    return Response.json({ resetLink });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
