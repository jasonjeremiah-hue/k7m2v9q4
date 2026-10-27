import test from "node:test";
import assert from "node:assert/strict";
import { fetchJson } from "../src/lib/api.mjs";

const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
test("loads valid JSON from the same-origin service", async () => {
  assert.deepEqual(
    await fetchJson("/api/health", null, async () => json({ status: "ok" })),
    { status: "ok" },
  );
});
test("preserves useful validated API errors", async () => {
  await assert.rejects(
    fetchJson(
      "/api/analysis",
      null,
      async () =>
        new Response(
          JSON.stringify({ error: "Choose a January decision date" }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    ),
    /Choose a January/,
  );
});
test("does not expose raw HTML gateway failures", async () => {
  await assert.rejects(
    fetchJson(
      "/api/analysis",
      null,
      async () => new Response("<html>gateway secret</html>", { status: 502 }),
    ),
    /data service is unavailable/,
  );
});
test("handles an invalid JSON body", async () => {
  await assert.rejects(
    fetchJson(
      "/api/analysis",
      null,
      async () =>
        new Response("{bad", {
          headers: { "content-type": "application/json" },
        }),
    ),
    /unreadable response/,
  );
});
test("rejects unexpected successful scalar responses", async () => {
  await assert.rejects(
    fetchJson("/api/analysis", null, async () => json(null)),
    /unexpected response/,
  );
});
test("network failures have a user-readable message", async () => {
  await assert.rejects(
    fetchJson("/api/analysis", null, async () => {
      throw new TypeError("network-specific details");
    }),
    /data service is unavailable/,
  );
});
test("an aborted request remains distinguishable from a failure", async () => {
  await assert.rejects(
    fetchJson("/api/analysis", null, async () => {
      throw new DOMException("Aborted", "AbortError");
    }),
    { name: "AbortError" },
  );
});
test("aborting during JSON decoding is not reclassified as a service failure", async () => {
  await assert.rejects(
    fetchJson("/api/analysis", null, async () => ({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => {
        throw new DOMException("Aborted", "AbortError");
      },
    })),
    { name: "AbortError" },
  );
});
