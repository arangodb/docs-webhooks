import { createPR, createSummary, commentDeployPreview } from "../../pull_request.js";
import { isAuthorizedCallback } from "../../callback_auth.js";
import { ProbotOctokit } from "probot";

const octokit = new ProbotOctokit({
    auth: {
      appId: process.env.APP_ID,
      privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
      installationId: 37861233
    },
  });

/**
 * Netlify function to handle webhook event requests from GitHub
 *
 * @param {import("@netlify/functions").HandlerEvent} event
 * @param {import("@netlify/functions").HandlerContext} context
 */
export async function handler (event, context) {
  // Only the CI of docs-hugo may create check runs and pull requests
  if (!process.env.DOCS_WEBHOOK_TOKEN) {
    console.log("[CIRCLECI-WEBHOOK] DOCS_WEBHOOK_TOKEN isn't set, rejecting all requests")
    return { statusCode: 500, body: '{"ok":false}' };
  }
  if (!isAuthorizedCallback(event.headers, process.env.DOCS_WEBHOOK_TOKEN)) {
    console.log("[CIRCLECI-WEBHOOK] Rejected request without a valid docs-webhook-token header")
    return { statusCode: 401, body: '{"ok":false}' };
  }

  try {
    // Not all headers, as they include the token
    console.log("[CIRCLECI-WEBHOOK] received event " + event.headers["docs-webhook-event"] +
      " for branch " + event.headers["docs-branch-name"])
    if (event.headers["docs-webhook-event"] == "scheduled-create-pr") {
        console.log("[CIRCLECI-WEBHOOK] [scheduled-create-pr] received")
        const branch_name = event.headers["docs-branch-name"]
        const pr_title = event.headers["docs-pr-title"]
        const pr_body = event.headers["docs-pr-body"]
        await createPR(octokit, branch_name, pr_title, pr_body)
    }

    // After the deployment of a preview, so that the link works
    if (event.headers["docs-webhook-event"] == "deploy-preview") {
      const pr_number = event.headers["docs-pr-number"]
      if (!/^[0-9]+$/.test(pr_number || "")) {
        return { statusCode: 400, body: '{"ok":false}' };
      }
      await commentDeployPreview(octokit, Number(pr_number))
    }

    if (event.headers["docs-webhook-event"] == "create-summary") {
      console.log("[CIRCLECI-WEBHOOK] [create-summary] received")
      const branch_name = event.headers["docs-branch-name"]
      const branch_sha = event.headers["docs-branch-sha"]
      const check_name = event.headers["docs-check-name"]
      // Set by the docs-hugo CI if the report contains errors
      const conclusion = ["success", "failure", "neutral"].includes(event.headers["docs-check-conclusion"])
        ? event.headers["docs-check-conclusion"] : "success"

      await createSummary(octokit, branch_name, check_name, branch_sha, event.body, conclusion)
  }

    return {
      statusCode: 200,
      body: '{"ok":true}',
    };
  } catch (error) {
    console.log(error);

    return {
      statusCode: error.status || 500,
      body: '{"ok":false}',
    };
  }
}
