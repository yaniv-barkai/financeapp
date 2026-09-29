import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { monthKeyToProjection, projectionMonthKey } from "./debt-due";

describe("projection month keys", () => {
  it("round-trips across year boundaries", () => {
    for (const n of [-3, 0, 1, 4, 12, 15, 59]) {
      assert.equal(monthKeyToProjection(projectionMonthKey(n)), n);
    }
  });

  it("rejects malformed keys", () => {
    assert.equal(monthKeyToProjection("2027-1"), null);
    assert.equal(monthKeyToProjection(""), null);
  });
});
