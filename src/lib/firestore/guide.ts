import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { GuideItemId, GuideState } from "../types";
import { assertOwner } from "./auth";
import { GUIDE_SNOOZE_DAYS } from "@/lib/guide/evaluate";

function guideStateRef(uid: string, bookId: string) {
  assertOwner(uid);
  return doc(db, "users", uid, "books", bookId, "guideState", "main");
}

export async function getGuideState(
  uid: string,
  bookId: string
): Promise<GuideState> {
  const snap = await getDoc(guideStateRef(uid, bookId));
  if (!snap.exists()) return {};
  return snap.data() as GuideState;
}

export async function markCategoriesReviewed(
  uid: string,
  bookId: string
): Promise<void> {
  assertOwner(uid);
  await setDoc(
    guideStateRef(uid, bookId),
    {
      categoriesReviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function snoozeGuideItem(
  uid: string,
  bookId: string,
  itemId: GuideItemId,
  days: number = GUIDE_SNOOZE_DAYS
): Promise<void> {
  assertOwner(uid);
  const until = Timestamp.fromDate(
    new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  );
  const ref = guideStateRef(uid, bookId);
  const existing = await getDoc(ref);
  const prev = (existing.data()?.snoozedUntil as Record<string, Timestamp>) ?? {};
  await setDoc(
    ref,
    {
      snoozedUntil: { ...prev, [itemId]: until },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function guideStateToSnoozeMap(
  state: GuideState
): Record<string, Date> {
  const out: Record<string, Date> = {};
  const raw = state.snoozedUntil ?? {};
  for (const [id, ts] of Object.entries(raw)) {
    if (ts && typeof (ts as Timestamp).toDate === "function") {
      out[id] = (ts as Timestamp).toDate();
    }
  }
  return out;
}
