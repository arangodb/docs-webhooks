import { triggerCircleCIPipeline } from './circleci';
import { createPRComment, getBranchFromPR, parsePRDescription, getBranchFromPRNumber, isOrgMember } from './pull_request';

export default (app) => {
  app.on(["issue_comment.created"], pullRequestComment);
  app.on(["pull_request.opened", "pull_request.synchronize"], pullRequestOpened);
  app.on("push", pushToMain);

  async function pullRequestOpened(context) {
    console.log("[START] [pullRequestOpened] Invoke")

    const deploy_preview = "deploy-preview-"+context.payload.pull_request.number

    if (context.payload.action == "opened") {
      await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "**Deploy Preview Available Via**<br>https://"+deploy_preview+"--docs-hugo.netlify.app")
    }
    const branch_info =  await getBranchFromPR(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request)
    if (branch_info == undefined || branch_info.branch == undefined) {
      console.log("[ERROR] [pullRequestOpened] branch_info undefined")
      await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
      return
    }

    const ci_params = { "workflow": "plain-build", "deploy-url": deploy_preview }
    const pipeline_id = await triggerCircleCIPipeline(branch_info.branch, ci_params)
    console.log("PIPELINE ID " + pipeline_id)
    if (pipeline_id == undefined) {
      await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
      return
    }
  }

  async function pushToMain(context) {
    if (context.payload.ref !== "refs/heads/main") return;
    console.log("[START] [pushToMain] Invoke")

    const ci_params = { "workflow": "plain-build", "deploy-url": "deploy-preview-main" }
    const pipeline_id = await triggerCircleCIPipeline("main", ci_params)
    console.log("PIPELINE ID " + pipeline_id)
  }

  // Only members of the arangodb organization can trigger the slash commands, as
  // they run CircleCI workflows (example generation with images isn't approved).
  // author_association covers public memberships, the API also private ones.
  async function isAllowed(context) {
    const association = context.payload.comment.author_association
    if (association === "OWNER" || association === "MEMBER") return true
    return await isOrgMember(context.octokit, context.payload.comment.user.login)
  }

  async function pullRequestComment(context) {
    context.log.info("Github Webhook: issue_comment.created")
    const comment = context.payload.comment.body.trim();

    context.log.info("Comment: " + comment)

    if (!["/generate", "/generate-commit", "/commit"].includes(comment)) return
    // Comments on issues (not pull requests)
    if (!context.payload.issue.pull_request) return

    if (!(await isAllowed(context))) {
      context.log.info("[pullRequestComment] Not a member of the arangodb organization: " + context.payload.comment.user.login)
      await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number, "Only members of the arangodb organization can use `" + comment + "`.")
      return
    }

    if (comment == "/generate" || comment == "/generate-commit") {
      const pr_body = context.payload.issue.body;
      const body_lines = pr_body.match(/[^\r\n]+/g);

      let deploy_preview = "deploy-preview-"+context.payload.issue.number

      let ci_params = await parsePRDescription(body_lines, context.octokit);
      ci_params["workflow"] = "generate"
      ci_params["generators"] = "examples api-docs"
      ci_params["deploy-url"] = deploy_preview
      if (comment == "/generate-commit") ci_params["commit-generated"] = true

      const branch_info =  await getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number)
      if (branch_info == undefined || branch_info.branch == undefined) {
        app.log.info("[ERROR] [pullRequestComment] branch_info undefined")
        await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number, "There was an error triggering checks!")
        return
      }

      const pipeline_id = await triggerCircleCIPipeline(branch_info.branch, ci_params)
      app.log.info("PIPELINE ID " + pipeline_id)
      if (pipeline_id == undefined) {
        await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number, "There was an error triggering checks!")
        return
      }

    }

    if (comment == "/commit") {
      const pr_body = context.payload.issue.body;
      const body_lines = pr_body.match(/[^\r\n]+/g);

      let ci_params = await parsePRDescription(body_lines, context.octokit);
      ci_params["workflow"] = "commit-generated"

      const branch_info =  await getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number)
      if (branch_info == undefined || branch_info.branch == undefined) {
        app.log.info("[ERROR] [pullRequestComment] branch_info undefined")
        await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number, "There was an error triggering checks!")
        return
      }

      const pipeline_id = await triggerCircleCIPipeline(branch_info.branch, ci_params)
      app.log.info("PIPELINE ID " + pipeline_id)
      if (pipeline_id == undefined) {
        await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number, "There was an error triggering checks!")
        return
      }

    }
  }

};
