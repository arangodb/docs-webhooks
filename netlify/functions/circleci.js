const app = require("../../app");
const pull_request = require("../../pull_request")
const { ProbotOctokit } = require("probot");

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
exports.handler = async function (event, context) {
  try {
    console.log("[CIRCLECI-WEBHOOK] received event ")
    console.log(event.headers)
    if (event.headers["docs-webhook-event"] == "scheduled-create-pr") {
        console.log("[CIRCLECI-WEBHOOK] [scheduled-create-pr] received")
        const branch_name = event.headers["docs-branch-name"]
        const pr_title = event.headers["docs-pr-title"]
        const pr_body = event.headers["docs-pr-body"]
        await pull_request.createPR(octokit, branch_name, pr_title, pr_body)
    }

    if (event.headers["docs-webhook-event"] == "create-summary") {
      console.log("[CIRCLECI-WEBHOOK] [create-summary] received")
      const branch_name = event.headers["docs-branch-name"]
      const branch_sha = event.headers["docs-branch-sha"]
      const check_name = event.headers["docs-check-name"]

      await pull_request.createSummary(octokit, branch_name, check_name, branch_sha, event.body)
  }

    return {
      statusCode: 200,
      body: '{"ok":true}',
    };
  } catch (error) {
    console.log(error);

    return {
      statusCode: error.status || 500,
      error: "ooops",
    };
  }
};