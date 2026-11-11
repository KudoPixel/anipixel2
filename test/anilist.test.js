import test from "node:test";
import assert from "node:assert/strict";

test("project metadata declares an ES module Worker", async () => {
  const config = await import("../package.json", { with: { type: "json" } });
  assert.equal(config.default.type, "module");
  assert.equal(config.default.name, "anipixel2");
});

test("Telegram callback payloads stay compact", () => {
  const payload = `d:${123456789}:abcdef123456`;
  assert.ok(new TextEncoder().encode(payload).length <= 64);
});
