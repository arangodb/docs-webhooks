import { jest, describe, test, expect } from "@jest/globals";
import { parsePRUpstream } from "../pull_request.js";

describe("upstream references in PR descriptions", () => {
  const octokit = {
    rest: { pulls: { get: jest.fn(async () => ({ data: { head: { ref: "pr-branch", sha: "cafef00d" } } })) } },
  };

  test("a PR link resolves to the PR's branch", async () => {
    expect(await parsePRUpstream("https://github.com/arangodb/arangodb/pull/123", octokit)).toBe("pr-branch");
  });

  test("a branch link resolves to the branch name", async () => {
    expect(await parsePRUpstream("https://github.com/arangodb/arangodb/tree/feature/new-aql-function", octokit))
      .toBe("feature/new-aql-function");
    expect(await parsePRUpstream("https://github.com/arangodb/arangodb/tree/devel/", octokit)).toBe("devel");
  });

  test("branch names and images are passed through", async () => {
    expect(await parsePRUpstream("feature/foo", octokit)).toBe("feature/foo");
    expect(await parsePRUpstream("arangodb/core-preview:4.0-nightly", octokit)).toBe("arangodb/core-preview:4.0-nightly");
  });

  test("other GitHub links are ignored", async () => {
    expect(await parsePRUpstream("https://github.com/arangodb/arangodb/commit/abc", octokit)).toBe("");
  });
});
