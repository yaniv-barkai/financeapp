import { auth } from "../firebase";

export class UnauthorizedError extends Error {
  constructor(message = "Not authorized to access this data") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Ensures the signed-in user matches the Firestore path owner. */
export function assertOwner(uid: string): void {
  const current = auth.currentUser;
  if (!current || current.uid !== uid) {
    throw new UnauthorizedError();
  }
}
