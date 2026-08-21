import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMessage } from "../src/format-message.js";

test("formats a Make OTP envelope into a clean bold-code message", () => {
  const raw = '{"$1":"Hulu"}: {"$1":"842791"}';
  assert.equal(formatMessage(raw), "Here's your one-time passcode for Hulu\n\n*842791*");
});

test("formats a Disney+ envelope the same way", () => {
  const raw = '{"$1":"Disney+"}: {"$1":"734347"}';
  assert.equal(formatMessage(raw), "Here's your one-time passcode for Disney+\n\n*734347*");
});

test("passes through text that doesn't match the envelope shape", () => {
  const raw = "just a plain forwarded message";
  assert.equal(formatMessage(raw), raw);
});
