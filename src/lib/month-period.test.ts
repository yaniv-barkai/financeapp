import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMonthRange, getPeriodKey, normalizeMonthStartDay } from "./utils";

describe("getMonthRange with a start day", () => {
  it("defaults to the calendar month", () => {
    const { start, end } = getMonthRange("2026-02");
    assert.deepEqual(start, new Date(2026, 1, 1));
    assert.deepEqual(end, new Date(2026, 1, 28, 23, 59, 59, 999));
  });

  it("runs from the start day to the day before it next month", () => {
    const { start, end } = getMonthRange("2026-10", 10);
    assert.deepEqual(start, new Date(2026, 9, 10));
    assert.deepEqual(end, new Date(2026, 10, 9, 23, 59, 59, 999));
  });

  it("crosses the year boundary", () => {
    const { start, end } = getMonthRange("2026-12", 15);
    assert.deepEqual(start, new Date(2026, 11, 15));
    assert.deepEqual(end, new Date(2027, 0, 14, 23, 59, 59, 999));
  });
});

describe("getPeriodKey", () => {
  it("uses the calendar month by default", () => {
    assert.equal(getPeriodKey(new Date(2026, 9, 2)), "2026-10");
  });

  it("belongs to the previous month before the start day", () => {
    assert.equal(getPeriodKey(new Date(2026, 9, 9, 23, 59), 10), "2026-09");
    assert.equal(getPeriodKey(new Date(2026, 9, 10), 10), "2026-10");
    assert.equal(getPeriodKey(new Date(2027, 0, 5), 10), "2026-12");
  });
});

describe("normalizeMonthStartDay", () => {
  it("clamps to 1–28", () => {
    assert.equal(normalizeMonthStartDay(undefined), 1);
    assert.equal(normalizeMonthStartDay(0), 1);
    assert.equal(normalizeMonthStartDay("15"), 15);
    assert.equal(normalizeMonthStartDay(31), 28);
  });
});
