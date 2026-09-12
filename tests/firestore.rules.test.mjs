/**
 * Firestore security rules tests (isolation / admin cannot read other ledgers).
 *
 * Run:
 *   npx firebase emulators:exec --only firestore "npx mocha --timeout 20000 tests/firestore.rules.test.mjs"
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const PROJECT_ID = "finance-app-rules-test";
const RULES = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

async function seedRegistry(uid, status = "active") {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "accountRegistry", uid), { status, email: `${uid}@example.com` });
    await setDoc(doc(db, "users", uid), { defaultBookId: "book1", currency: "ILS" });
    await setDoc(doc(db, "users", uid, "books", "book1"), { name: "Personal", color: "#000", currency: "ILS" });
    await setDoc(doc(db, "users", uid, "books", "book1", "transactions", "tx1"), {
      amount: 42,
      type: "expense",
      categoryId: "c1",
      tags: [],
    });
    await setDoc(doc(db, "users", uid, "books", "book1", "categories", "c1"), {
      name: "Food",
      type: "expense",
      icon: "🍕",
      color: "#000",
      pinned: false,
      order: 0,
    });
    await setDoc(doc(db, "users", uid, "books", "book1", "merchants", "cafe"), {
      displayName: "Cafe",
      defaultCategoryId: "c1",
      count: 1,
    });
    await setDoc(doc(db, "users", uid, "books", "book1", "monthlyBudgets", "2026-09"), {
      monthKey: "2026-09",
      amounts: { c1: 500 },
    });
    await setDoc(doc(db, "users", uid, "books", "book1", "recurring", "r1"), {
      type: "expense",
      amount: 10,
      categoryId: "c1",
      cadence: "monthly",
      active: true,
    });
    await setDoc(doc(db, "users", uid, "books", "book1", "tags", "t1"), {
      name: "work",
      color: "#000",
    });
    await setDoc(doc(db, "users", uid, "alertState", "c1_2026-09"), {
      lastThresholdSent: 80,
    });
  });
}

describe("Firestore isolation", () => {
  it("AC1: user A cannot read user B transactions", async () => {
    await seedRegistry("userA");
    await seedRegistry("userB");
    const alice = testEnv.authenticatedContext("userA");
    await assertFails(getDoc(doc(alice.firestore(), "users", "userB", "books", "book1", "transactions", "tx1")));
  });

  it("AC1: user A cannot write user B settings", async () => {
    await seedRegistry("userA");
    await seedRegistry("userB");
    const alice = testEnv.authenticatedContext("userA");
    await assertFails(setDoc(doc(alice.firestore(), "users", "userB"), { currency: "USD" }, { merge: true }));
  });

  it("AC1: user A cannot read user B categories/merchants/budgets/recurring/tags/alertState", async () => {
    await seedRegistry("userA");
    await seedRegistry("userB");
    const alice = testEnv.authenticatedContext("userA");
    const db = alice.firestore();
    await assertFails(getDoc(doc(db, "users", "userB", "books", "book1", "categories", "c1")));
    await assertFails(getDoc(doc(db, "users", "userB", "books", "book1", "merchants", "cafe")));
    await assertFails(getDoc(doc(db, "users", "userB", "books", "book1", "monthlyBudgets", "2026-09")));
    await assertFails(getDoc(doc(db, "users", "userB", "books", "book1", "recurring", "r1")));
    await assertFails(getDoc(doc(db, "users", "userB", "books", "book1", "tags", "t1")));
    await assertFails(getDoc(doc(db, "users", "userB", "alertState", "c1_2026-09")));
  });

  it("AC1: owner can read own book", async () => {
    await seedRegistry("userA");
    const alice = testEnv.authenticatedContext("userA");
    await assertSucceeds(getDoc(doc(alice.firestore(), "users", "userA", "books", "book1")));
  });

  it("AC2: user A cannot read accountRegistry of B", async () => {
    await seedRegistry("userA");
    await seedRegistry("userB");
    const alice = testEnv.authenticatedContext("userA");
    await assertFails(getDoc(doc(alice.firestore(), "accountRegistry", "userB")));
  });

  it("AC2: user A cannot write own accountRegistry", async () => {
    await seedRegistry("userA");
    const alice = testEnv.authenticatedContext("userA");
    await assertFails(
      setDoc(doc(alice.firestore(), "accountRegistry", "userA"), { status: "active" }, { merge: true })
    );
  });

  it("AC7: unprovisioned auth user cannot read users tree", async () => {
    await seedRegistry("userA");
    const stranger = testEnv.authenticatedContext("stranger");
    await assertFails(getDoc(doc(stranger.firestore(), "users", "stranger")));
    await assertFails(getDoc(doc(stranger.firestore(), "users", "userA")));
  });

  it("AC8: disabled registry blocks owner access", async () => {
    await seedRegistry("userA", "disabled");
    const alice = testEnv.authenticatedContext("userA");
    await assertFails(getDoc(doc(alice.firestore(), "users", "userA")));
  });

  it("AC12: admin claim does not grant cross-user ledger access", async () => {
    await seedRegistry("userA");
    await seedRegistry("userB");
    const admin = testEnv.authenticatedContext("userA", { admin: true });
    await assertSucceeds(getDoc(doc(admin.firestore(), "users", "userA")));
    await assertFails(getDoc(doc(admin.firestore(), "users", "userB", "books", "book1", "transactions", "tx1")));
  });
});
