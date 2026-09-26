import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Simulation, SimulationWhatIfCategory } from "../types";
import { assertOwner } from "./auth";

export const SIMULATION_DOC_ID = "main";

function simulationRef(uid: string, bookId: string) {
  assertOwner(uid);
  return doc(db, "users", uid, "books", bookId, "simulations", SIMULATION_DOC_ID);
}

/** Firestore rejects undefined field values — strip them before write. */
function withoutUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as T;
}

export function emptySimulation(): Simulation {
  return {
    amounts: {},
    whatIfCategories: [],
    whatIfAmounts: {},
  };
}

export async function getSimulation(
  uid: string,
  bookId: string
): Promise<Simulation | null> {
  const snap = await getDoc(simulationRef(uid, bookId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    amounts: (data.amounts as Record<string, number>) ?? {},
    whatIfCategories: (data.whatIfCategories as SimulationWhatIfCategory[]) ?? [],
    whatIfAmounts: (data.whatIfAmounts as Record<string, number>) ?? {},
    updatedAt: data.updatedAt,
  };
}

export async function saveSimulation(
  uid: string,
  bookId: string,
  data: Omit<Simulation, "updatedAt">
): Promise<void> {
  await setDoc(
    simulationRef(uid, bookId),
    withoutUndefined({
      amounts: data.amounts,
      whatIfCategories: data.whatIfCategories,
      whatIfAmounts: data.whatIfAmounts,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}
