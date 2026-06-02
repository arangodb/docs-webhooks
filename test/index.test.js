import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import { Probot } from "probot";
import { readFileSync } from "fs";
import { join } from "path";
// Fixtures
import pushMainPayload from "./fixtures/push.main.json" with { type: "json" };
import pullRequestOpenedPayload from "./fixtures/pull_request.opened.json" with { type: "json" };
import issueCommentGeneratePayload from "./fixtures/issue_comment.generate.json" with { type: "json" };

// app.js is pure orchestration: it decides which CircleCI pipeline / PR comment
// to fire for each webhook event. We mock its collaborator modules and assert
// the routing, rather than mocking HTTP (Octokit's fetch isn't reliably
// interceptable under Jest's ESM VM loader).
const triggerCircleCIPipeline = jest.fn();
jest.unstable_mockModule("../circleci.js", () => ({
  triggerCircleCIPipeline,
  getPipelineJobs: jest.fn(),
}));

const createPRComment = jest.fn();
const getBranchFromPR = jest.fn();
const getBranchFromPRNumber = jest.fn();
const parsePRDescription = jest.fn();
jest.unstable_mockModule("../pull_request.js", () => ({
  createPRComment,
  getBranchFromPR,
  getBranchFromPRNumber,
  parsePRDescription,
  parsePRUpstream: jest.fn(),
  createPR: jest.fn(),
  createSummary: jest.fn(),
  getCommitMessage: jest.fn(),
}));

// Must import the app AFTER registering the module mocks.
const { default: myProbotApp } = await import("../app.js");

const privateKey = readFileSync(
  join(import.meta.dirname, "fixtures/mock-cert.pem"),
  "utf-8"
);

describe("ArangoDB docs automation app", () => {
  let probot;

  beforeEach(() => {
    jest.clearAllMocks();
    // Sensible default return values; individual tests override as needed.
    triggerCircleCIPipeline.mockResolvedValue("pipeline-123");
    createPRComment.mockResolvedValue(undefined);
    getBranchFromPR.mockResolvedValue({ branch: "pull/42/head", sha: "" });
    getBranchFromPRNumber.mockResolvedValue({
      branch: "generate-branch",
      sha: "cafef00d",
    });
    parsePRDescription.mockResolvedValue({});

    probot = new Probot({
      appId: 123,
      privateKey,
      githubToken: "test",
    });
    probot.load(myProbotApp);
  });

  test("push to main triggers a plain-build pipeline on main", async () => {
    await probot.receive({ name: "push", payload: pushMainPayload });

    expect(triggerCircleCIPipeline).toHaveBeenCalledTimes(1);
    expect(triggerCircleCIPipeline).toHaveBeenCalledWith("main", {
      workflow: "plain-build",
      "deploy-url": "deploy-preview-main",
    });
  });

  test("push to a non-main branch triggers nothing", async () => {
    await probot.receive({
      name: "push",
      payload: { ...pushMainPayload, ref: "refs/heads/feature" },
    });

    expect(triggerCircleCIPipeline).not.toHaveBeenCalled();
  });

  test("opening a PR comments the preview URL and triggers plain-build", async () => {
    await probot.receive({
      name: "pull_request",
      payload: pullRequestOpenedPayload,
    });

    expect(createPRComment).toHaveBeenCalledWith(
      expect.anything(),
      "arangodb",
      "docs-hugo",
      42,
      "**Deploy Preview Available Via**<br>https://deploy-preview-42--docs-hugo.netlify.app"
    );
    expect(triggerCircleCIPipeline).toHaveBeenCalledWith("pull/42/head", {
      workflow: "plain-build",
      "deploy-url": "deploy-preview-42",
    });
  });

  test("a /generate comment looks up the branch and triggers a generate build", async () => {
    await probot.receive({
      name: "issue_comment",
      payload: issueCommentGeneratePayload,
    });

    expect(getBranchFromPRNumber).toHaveBeenCalledWith(
      expect.anything(),
      "arangodb",
      "docs-hugo",
      7
    );
    expect(triggerCircleCIPipeline).toHaveBeenCalledWith("generate-branch", {
      workflow: "generate",
      generators: "examples api-docs",
      "deploy-url": "deploy-preview-7",
    });
  });
});
