const circleci = require('./circleci')
const pull_request = require('./pull_request')

var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()



module.exports = (app, { getRouter }) => {
  app.on(["issue_comment.created"], pullRequestComment);
  app.on(["pull_request.opened", "pull_request.synchronize"], pullRequestOpened);

  async function pullRequestOpened(context) {
    console.log("[START] [pullRequestOpened] Invoke")

    var deploy_preview = "deploy-preview-"+context.payload.pull_request.number

    if (context.payload.action == "opened") {
      pull_request.createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "**Deploy Preview Available Via**<br>https://"+deploy_preview+"--docs-hugo.netlify.app")
    }

    const branch_info =  await pull_request.getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number)
    if (branch_info == undefined || branch_info.branch == undefined) {
      console.log("[ERROR] [pullRequestOpened] branch_info undefined")
      pull_request.createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
      return
    }

    ci_params = {"workflow": "plain-build", "deploy-url": deploy_preview}
    let pipeline_id = await circleci.triggerCircleCIPipeline(branch_info.branch, ci_params)
    console.log("PIPELINE ID " + pipeline_id)
    if (pipeline_id == undefined) {
      pull_request.createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
      return
    }
  }




  async function pullRequestComment(context) {
    context.log("Github Webhook: issue_comment.created")
    const comment = context.payload.comment.body;
    const user = context.payload.comment.user.login;
    
    // const isAnArangoMember = await context.octokit.request('GET /orgs/arangodb/members/'+user, {
    //   org: 'arangodb',
    //   username: user,
    //   headers: {
    //     'X-GitHub-Api-Version': '2022-11-28'
    //   }
    // })

    // console.log("IS ARANGODB")
    // console.log(isAnArangoMember)

    context.log("Comment: " + comment)

    if (comment.includes("/generate")) {
      const pr_body = context.payload.issue.body;
      const body_lines = pr_body.match(/[^\r\n]+/g);

      var deploy_preview = "deploy-preview-"+context.payload.issue.number


      var ci_params = await pull_request.parsePRDescription(body_lines, context.octokit);
      ci_params["workflow"] = "generate"
      ci_params["generators"] = "examples api-docs"
      ci_params["deploy-url"] = deploy_preview
      if (comment.includes("commit")) ci_params["commit-generated"] = true

      const branch_info =  await pull_request.getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number)
      if (branch_info == undefined || branch_info.branch == undefined) {
        app.log.info("[ERROR] [pullRequestComment] branch_info undefined")
        pull_request.createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
        return
      }
      
      let pipeline_id = await circleci.triggerCircleCIPipeline(branch_info.branch, ci_params)
      app.log.info("PIPELINE ID " + pipeline_id)
      if (pipeline_id == undefined) {
        pull_request.createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number, "There was an error triggering checks!")
        return
      }

    }

    if (comment == "/commit-generated") {
      const pr_body = context.payload.issue.body;
      const body_lines = pr_body.match(/[^\r\n]+/g);

      var ci_params = await pull_request.parsePRDescription(body_lines, context.octokit);
      ci_params["workflow"] = "commit-generated"

      const branch_info =  await pull_request.getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number)
      if (branch_info == undefined || branch_info.branch == undefined) {
        app.log.info("[ERROR] [pullRequestComment] branch_info undefined")
        pull_request.createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number, "There was an error triggering checks!")
        return
      }
      
      let pipeline_id = await circleci.triggerCircleCIPipeline(branch_info.branch, ci_params)
      app.log.info("PIPELINE ID " + pipeline_id)
      if (pipeline_id == undefined) {
        pull_request.createPRComment(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number, "There was an error triggering checks!")
        return
      }

    }
  }

};
