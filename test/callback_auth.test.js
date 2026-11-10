import { describe, test, expect } from "@jest/globals";
import { isAuthorizedCallback } from "../callback_auth.js";

describe("authentication of CircleCI callbacks", () => {
  test("accepts the shared token", () => {
    expect(isAuthorizedCallback({ "docs-webhook-token": "s3cret" }, "s3cret")).toBe(true);
  });

  test.each([
    [{}, "s3cret"],
    [{ "docs-webhook-token": "" }, "s3cret"],
    [{ "docs-webhook-token": "wrong" }, "s3cret"],
    [{ "docs-webhook-token": "s3cret-but-longer" }, "s3cret"],
    [{ "docs-webhook-token": "" }, ""],
    [{ "docs-webhook-token": "anything" }, undefined],
  ])("rejects %j with secret %j", (headers, secret) => {
    expect(isAuthorizedCallback(headers, secret)).toBe(false);
  });
});
