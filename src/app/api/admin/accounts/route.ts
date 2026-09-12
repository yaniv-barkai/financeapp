import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import type { AccountListItem } from "@/lib/admin-types";
import {
  deleteAccountRegistry,
  deleteUserFinanceData,
  getAccountRegistry,
  upsertAccountRegistry,
} from "@/lib/server/account-registry";
import { adminErrorResponse, requireAdmin } from "@/lib/server/require-admin";

function randomPassword(): string {
  return randomBytes(24).toString("base64url");
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const auth = getAdminAuth();
    const accounts: AccountListItem[] = [];
    let pageToken: string | undefined;

    do {
      const result = await auth.listUsers(1000, pageToken);
      for (const u of result.users) {
        const registry = await getAccountRegistry(u.uid);
        const status: AccountListItem["status"] = !registry
          ? "unprovisioned"
          : registry.status === "disabled" || u.disabled
            ? "disabled"
            : "active";
        accounts.push({
          uid: u.uid,
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          disabled: u.disabled,
          creationTime: u.metadata.creationTime ?? null,
          lastSignInTime: u.metadata.lastSignInTime ?? null,
          provisioned: Boolean(registry),
          status,
        });
      }
      pageToken = result.pageToken;
    } while (pageToken);

    accounts.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    return Response.json({ accounts });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json()) as {
      email?: string;
      displayName?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const displayName = body.displayName?.trim() ?? "";
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const user = await auth.createUser({
      email,
      displayName: displayName || undefined,
      password: randomPassword(),
      emailVerified: false,
      disabled: false,
    });

    await upsertAccountRegistry(user.uid, {
      status: "active",
      email,
      displayName: displayName || undefined,
      createdBy: admin.uid,
    });

    const resetLink = await auth.generatePasswordResetLink(email);

    return Response.json({
      uid: user.uid,
      email: user.email ?? email,
      displayName: user.displayName ?? displayName ?? null,
      resetLink,
    });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json()) as {
      uid?: string;
      disabled?: boolean;
    };
    const uid = body.uid?.trim();
    if (!uid || typeof body.disabled !== "boolean") {
      return Response.json({ error: "uid and disabled are required" }, { status: 400 });
    }
    if (uid === admin.uid) {
      return Response.json({ error: "Cannot disable your own account" }, { status: 400 });
    }

    const auth = getAdminAuth();
    await auth.updateUser(uid, { disabled: body.disabled });
    const user = await auth.getUser(uid);
    await upsertAccountRegistry(uid, {
      status: body.disabled ? "disabled" : "active",
      email: user.email,
      displayName: user.displayName,
    });

    return Response.json({ ok: true });
  } catch (err) {
    return adminErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json()) as { uid?: string };
    const uid = body.uid?.trim();
    if (!uid) {
      return Response.json({ error: "uid is required" }, { status: 400 });
    }
    if (uid === admin.uid) {
      return Response.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const auth = getAdminAuth();
    await deleteUserFinanceData(uid);
    await deleteAccountRegistry(uid);
    await auth.deleteUser(uid);

    return Response.json({ ok: true });
  } catch (err) {
    return adminErrorResponse(err);
  }
}
