const app = require("../../app");
const pull_request = require("../../pull_request")
const { ProbotOctokit } = require("probot");

const octokit = new ProbotOctokit({
    auth: {
      appId: process.env.APP_ID,
      privateKey: process.env.PRIVATE_KEY,
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
    await probot.webhooks.verifyAndReceive({
      id:
        event.headers["X-GitHub-Delivery"] ||
        event.headers["x-github-delivery"],
      name: event.headers["X-GitHub-Event"] || event.headers["x-github-event"],
      signature:
        event.headers["X-Hub-Signature-256"] ||
        event.headers["x-hub-signature-256"],
      payload: JSON.parse(event.body),
    });

    if (event.headers["docs-webhook-event"] == "scheduled-create-pr") {
        pull_request.createPR(octokit)
    }

    return {
      statusCode: 200,
      body: '{"ok":true}',
    };
  } catch (error) {
    app.log.error(error);

    return {
      statusCode: error.status || 500,
      error: "ooops",
    };
  }
};