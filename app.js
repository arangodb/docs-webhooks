import { triggerCircleCIPipeline } from './circleci.js';
import { createPRComment, getBranchFromPR, parsePRDescription, getBranchFromPRNumber, isOrgMember, addCommentReaction, isForkPR } from './pull_request.js';
import { parseCommand } from './commands.js';

// Builds of pull requests run their code in CircleCI, with access to its secrets
// (e.g. the Netlify and Docker Hub credentials), so the builds of pull requests
// from forks of people outside the organization need to be started by a member.
export const FORK_NOTICE = "This pull request comes from a fork, so it isn't built automatically. " +
  "A member of the arangodb organization can start the build with a `/build` comment " +
  "after reviewing the changes, especially to `.circleci/` and `toolchain/`, as builds " +
  "run with access to the CI secrets. New commits need another `/build`."

export default (app) => {
  app.on(["issue_comment.created"], pullRequestComment);
  app.on(["pull_request.opened", "pull_request.synchronize"], pullRequestOpened);
  app.on("push", pushToMain);

  async function pullRequestOpened(context) {
    console.log("[START] [pullRequestOpened] Invoke")

    // The deploy preview link is commented by the CI after deploying (deploy-preview
    // event of netlify/functions/circleci.mjs)
    const pr = context.payload.pull_request
    const deploy_preview = "deploy-preview-"+pr.number

    if (isForkPR(pr, "arangodb", "docs-hugo") && !(await isMember(context, pr.author_association, pr.user?.login))) {
      console.log("[pullRequestOpened] Pull request from a fork of a non-member, not building it")
      if (context.payload.action == "opened") {
        await createPRComment(context.octokit, "arangodb", "docs-hugo", pr.number, FORK_NOTICE)
      }
      return
    }

    const branch_info =  await getBranchFromPR(context.octokit, "arangodb", "docs-hugo", pr)
    if (branch_info == undefined || branch_info.branch == undefined) {
      console.log("[ERROR] [pullRequestOpened] branch_info undefined")
      await createPRComment(context.octokit, "arangodb", "docs-hugo", pr.number, "There was an error triggering checks!")
      return
    }

    const ci_params = { "workflow": "plain-build", "deploy-url": deploy_preview }
    const pipeline_id = await triggerCircleCIPipeline(branch_info.branch, ci_params)
    console.log("PIPELINE ID " + pipeline_id)
    if (pipeline_id == undefined) {
      await createPRComment(context.octokit, "arangodb", "docs-hugo", pr.number, "There was an error triggering checks!")
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

  // Whether a user is a member of the arangodb organization. author_association
  // covers public memberships, the API also private ones.
  async function isMember(context, association, login) {
    if (association === "OWNER" || association === "MEMBER") return true
    if (!login) return false
    return await isOrgMember(context.octokit, login)
  }

  // Triggers a pipeline for the pull request of a comment and reacts to the
  // comment if it was triggered
  async function triggerForComment(context, ci_params) {
    const pr_number = context.payload.issue.number
    const branch_info =  await getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", pr_number)
    if (branch_info == undefined || branch_info.branch == undefined) {
      app.log.info("[ERROR] [pullRequestComment] branch_info undefined")
      await createPRComment(context.octokit, "arangodb", "docs-hugo", pr_number, "There was an error triggering checks!")
      return
    }

    const pipeline_id = await triggerCircleCIPipeline(branch_info.branch, ci_params)
    app.log.info("PIPELINE ID " + pipeline_id)
    if (pipeline_id == undefined) {
      await createPRComment(context.octokit, "arangodb", "docs-hugo", pr_number, "There was an error triggering checks!")
      return
    }
    await addCommentReaction(context.octokit, "arangodb", "docs-hugo", context.payload.comment.id, "rocket")
  }

  async function pullRequestComment(context) {
    context.log.info("Github Webhook: issue_comment.created")
    const comment = context.payload.comment.body.trim();

    context.log.info("Comment: " + comment)

    const parsed = parseCommand(comment)
    if (parsed == null) return
    const command = parsed.command
    // Comments on issues (not pull requests)
    if (!context.payload.issue.pull_request) return

    const pr_number = context.payload.issue.number

    // Only members of the arangodb organization can trigger the slash commands, as
    // they run CircleCI workflows with the code of the pull request
    if (!(await isMember(context, context.payload.comment.author_association, context.payload.comment.user.login))) {
      context.log.info("[pullRequestComment] Not a member of the arangodb organization: " + context.payload.comment.user.login)
      await createPRComment(context.octokit, "arangodb", "docs-hugo", pr_number, "Only members of the arangodb organization can use `" + command + "`.")
      return
    }

    if (parsed.error != null) {
      await createPRComment(context.octokit, "arangodb", "docs-hugo", pr_number, parsed.error)
      return
    }

    if (command == "/build") {
      await triggerForComment(context, { "workflow": "plain-build", "deploy-url": "deploy-preview-" + pr_number })
    }

    if (command == "/generate" || command == "/generate-commit") {
      const body_lines = (context.payload.issue.body || "").match(/[^\r\n]+/g) || [];
      const upstream = await parsePRDescription(body_lines, context.octokit);
      if (upstream.errors.length > 0) {
        await createPRComment(context.octokit, "arangodb", "docs-hugo", pr_number, upstream.errors.join("<br>"))
        return
      }

      let ci_params = upstream.params
      ci_params["workflow"] = "generate"
      ci_params["generators"] = "examples"
      ci_params["deploy-url"] = "deploy-preview-" + pr_number
      if (command == "/generate-commit") ci_params["commit-generated"] = true
      // Arguments of the command (scope, override, generators)
      Object.assign(ci_params, parsed.params)

      await triggerForComment(context, ci_params)
    }

    if (command == "/commit") {
      // Commits the generated data of the last generate workflow, no upstream references needed
      await triggerForComment(context, { "workflow": "commit-generated" })
    }
  }

};
