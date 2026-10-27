import test from "node:test";
import assert from "node:assert/strict";
import {
  number,
  gw,
  signed,
  nextDay,
  exportUrl,
  publicationLabel,
} from "../src/lib/format.mjs";

test("null and nonfinite values never masquerade as zero", () => {
  assert.equal(number(null), "—");
  assert.equal(number(undefined), "—");
  assert.equal(number(NaN), "—");
  assert.equal(number(0), "0.0");
  assert.equal(gw(null), null);
});
test("power conversion and signed bias are explicit", () => {
  assert.equal(gw(2500), 2.5);
  assert.equal(signed(1.5), "+1.50");
  assert.equal(signed(-1.5), "-1.50");
  assert.equal(signed(null), "—");
});
test("last January decision includes February delivery", () => {
  assert.equal(nextDay("2026-01-31"), "2026-02-01");
});
test("exports preserve the selected decision cutoff and scope", () => {
  const url = new URL(
    exportUrl("2026-01-31", "08:30", true),
    "http://localhost",
  );
  assert.equal(url.searchParams.get("date"), "2026-01-31");
  assert.equal(url.searchParams.get("cutoff"), "08:30");
  assert.equal(url.searchParams.get("scope"), "month");
});
test("publication formatting uses UK time, not the visitor timezone", () => {
  assert.match(publicationLabel("2026-01-15T07:30:00Z"), /07:30/);
});
