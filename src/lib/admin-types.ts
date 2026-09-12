export type AccountListItem = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  creationTime: string | null;
  lastSignInTime: string | null;
  provisioned: boolean;
  status: "active" | "disabled" | "unprovisioned";
};
