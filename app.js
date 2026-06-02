import { triggerCircleCIPipeline } from './circleci';
import { createPRComment, getBranchFromPR, parsePRDescription, getBranchFromPRNumber } from './pull_request';

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

  async function pullRequestComment(context) {
    context.log.info("Github Webhook: issue_comment.created")
    const comment = context.payload.comment.body.trim();
    
    // const user = context.payload.comment.user.login;
    // const isAnArangoMember = await context.octokit.rest.request('GET /orgs/arangodb/memberships/'+user, {
    //   org: 'arangodb',
    //   username: user,
    //   headers: {
    //     'X-GitHub-Api-Version': '2022-11-28'
    //   }
    // })

    // console.log("IS ARANGODB")
    // console.log(isAnArangoMember)

    context.log.info("Comment: " + comment)

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
        await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
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
        await createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
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
