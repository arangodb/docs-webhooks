import { describe, test, expect } from "@jest/globals";
import { parseCommand } from "../commands.js";

describe("parseCommand", () => {
  test("ignores comments that aren't commands", () => {
    expect(parseCommand("Looks good, thanks!")).toBeNull();
    expect(parseCommand("/generated output looks wrong")).toBeNull();
  });

  test("parses commands without arguments", () => {
    expect(parseCommand("  /generate \n")).toEqual({ command: "/generate", params: {}, error: null });
    expect(parseCommand("/commit")).toEqual({ command: "/commit", params: {}, error: null });
  });

  test("maps the arguments to pipeline parameters", () => {
    const parsed = parseCommand("/generate-commit scope=changed override=^aql,RestVersion generators=examples,options,examples");
    expect(parsed.error).toBeNull();
    expect(parsed.params).toEqual({
      "examples-scope": "changed",
      override: "^aql,RestVersion",
      generators: "examples options",
    });
  });

  test("accepts override=.* to refresh all examples", () => {
    expect(parseCommand("/generate override=.*").params).toEqual({ override: ".*" });
  });

  test.each([
    ["/generate scope=some", "Invalid `scope`"],
    ["/generate generators=examples,docs", "Invalid `generators`"],
    ["/generate generators=", "Invalid `generators`"],
    ["/generate override='.*'", "Invalid `override`"],
    ["/generate override=a(", "Invalid regular expression"],
    ["/generate scope=all scope=changed", "more than once"],
    ["/generate please", "expected `key=value`"],
    ["/generate version=4.x", "Unknown argument `version`"],
    ["/commit scope=changed", "doesn't accept arguments"],
  ])("rejects %s", (comment, message) => {
    expect(parseCommand(comment).error).toContain(message);
  });
});
