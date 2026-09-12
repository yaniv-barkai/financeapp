import { getIdToken } from "@/lib/auth-token";
import type { AccountListItem } from "@/lib/admin-types";

async function adminFetch(path: string, init?: RequestInit) {
  const token = await getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data;
}

export async function listAdminAccounts(): Promise<AccountListItem[]> {
  const data = (await adminFetch("/api/admin/accounts")) as { accounts: AccountListItem[] };
  return data.accounts;
}

export async function createAdminAccount(email: string, displayName: string) {
  return adminFetch("/api/admin/accounts", {
    method: "POST",
    body: JSON.stringify({ email, displayName }),
  }) as Promise<{ uid: string; email: string; displayName: string | null; resetLink: string }>;
}

export async function setAdminAccountDisabled(uid: string, disabled: boolean) {
  return adminFetch("/api/admin/accounts", {
    method: "PATCH",
    body: JSON.stringify({ uid, disabled }),
  }) as Promise<{ ok: true }>;
}

export async function deleteAdminAccount(uid: string) {
  return adminFetch("/api/admin/accounts", {
    method: "DELETE",
    body: JSON.stringify({ uid }),
  }) as Promise<{ ok: true }>;
}

export async function resetAdminAccountPassword(uid: string, email?: string | null) {
  return adminFetch("/api/admin/accounts/reset", {
    method: "POST",
    body: JSON.stringify({ uid, email }),
  }) as Promise<{ resetLink: string }>;
}
