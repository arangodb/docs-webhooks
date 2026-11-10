import { jest, describe, test, expect } from "@jest/globals";
import { parsePRUpstream, parsePRDescription, getBranchFromPRNumber, commentDeployPreview } from "../pull_request.js";

describe("upstream references in PR descriptions", () => {
  const octokit = {
    rest: { pulls: { get: jest.fn(async () => ({ data: { head: { ref: "pr-branch", sha: "cafef00d", repo: { full_name: "arangodb/arangodb" } } } })) } },
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

describe("upstream references of PR descriptions", () => {
  const octokit = {
    rest: { pulls: { get: jest.fn(async () => ({ data: { head: { ref: "pr-branch", sha: "cafef00d", repo: { full_name: "arangodb/arangodb" } } } })) } },
  };

  test("valid references become pipeline parameters", async () => {
    const result = await parsePRDescription([
      "- 3.10: ",
      "- 3.11: https://github.com/arangodb/arangodb/pull/123",
      "- 3.12: arangodb/enterprise-preview:3.12-nightly",
      "- 4.x: feature/new-aql-function",
    ], octokit);
    expect(result).toEqual({
      params: {
        "arangodb-3_11": "pr-branch",
        "arangodb-3_12": "arangodb/enterprise-preview:3.12-nightly",
        "arangodb-4_x": "feature/new-aql-function",
      },
      errors: [],
    });
  });

  test("references with characters that the shell interprets are rejected", async () => {
    const result = await parsePRDescription([
      "- 3.12: x$(id)",
      "- 4.x: https://github.com/arangodb/arangodb/tree/a%0Ab",
    ], octokit);
    expect(result.params).toEqual({});
    expect(result.errors).toEqual([
      "Invalid upstream reference for 3.12: `x$(id)`",
      "Invalid upstream reference for 4.x: `ab`",
    ]);
  });
});

describe("branches of pull requests", () => {
  const octokitFor = (full_name) => ({
    rest: { pulls: { get: jest.fn(async () => ({ data: { head: { ref: "feature", sha: "cafef00d", repo: full_name ? { full_name } : null } } })) } },
  });

  test("pull requests of the repository use their branch", async () => {
    expect(await getBranchFromPRNumber(octokitFor("arangodb/docs-hugo"), "arangodb", "docs-hugo", 7))
      .toEqual({ branch: "feature", sha: "cafef00d", fork: false });
  });

  test("pull requests from forks (also deleted ones) use pull/<number>/head", async () => {
    expect(await getBranchFromPRNumber(octokitFor("someone/docs-hugo"), "arangodb", "docs-hugo", 7))
      .toEqual({ branch: "pull/7/head", sha: "cafef00d", fork: true });
    expect((await getBranchFromPRNumber(octokitFor(null), "arangodb", "docs-hugo", 7)).branch).toBe("pull/7/head");
  });
});

describe("deploy preview comments", () => {
  const octokitWith = (comments) => {
    const createComment = jest.fn(async () => ({}));
    return {
      createComment,
      paginate: jest.fn(async () => comments),
      rest: { issues: { listComments: jest.fn(), createComment } },
    };
  };

  test("comments the link if there's no such comment yet", async () => {
    const octokit = octokitWith([{ user: { type: "User" }, body: "**Deploy Preview Available Via**<br>fake" }]);
    expect(await commentDeployPreview(octokit, 42)).toBe(true);
    expect(octokit.createComment).toHaveBeenCalledWith({
      owner: "arangodb",
      repo: "docs-hugo",
      issue_number: 42,
      body: "**Deploy Preview Available Via**<br>https://deploy-preview-42--docs-hugo.netlify.app",
    });
  });

  test("doesn't comment again", async () => {
    const octokit = octokitWith([{ user: { type: "Bot" }, body: "**Deploy Preview Available Via**<br>https://deploy-preview-42--docs-hugo.netlify.app" }]);
    expect(await commentDeployPreview(octokit, 42)).toBe(false);
    expect(octokit.createComment).not.toHaveBeenCalled();
  });
});
