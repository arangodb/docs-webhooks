const circleci = require('./circleci')
const pull_request = require('./pull_request')

var bodyParser = require('body-parser')
var jsonParser = bodyParser.json()



module.exports = (app, { getRouter }) => {
  //  const router = getRouter("/");
  //  router.use(require("express").static("public"));

  //  router.post("/circleci", jsonParser, (req, res) => {
  //   console.log("CIRCLECI WEBHOOK")
  //   // console.log(req.body)

  //   // circleci.jobCompletedWebhook(req, res)
  //  });

  
  app.on(["issue_comment.created"], pullRequestComment);
  // app.on(["pull_request.opened", "pull_request.synchronize"], pullRequestOpened);

  // async function pullRequestOpened(context) {
  //   const branch_info =  await pull_request.getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", context.payload.pull_request.number)
  //   console.log(branch_info)

  //   ci_params = {"workflow": "plain-build"}
  //   let pipeline_id = await circleci.triggerCircleCIPipeline(branch_info.branch, ci_params)
  //   app.log.info("PIPELINE ID " + pipeline_id)

  //   let jobs = await circleci.getPipelineJobs(pipeline_id)
  //   for (let job of jobs) {
  //     circleci.createJobCheck(job, branch_info)
  //     app.log.info("check created")
  //   }
  // }



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

    if (comment == "/generate") {

      const pr_body = context.payload.issue.body;
      context.log("PR Body: " + pr_body)

      const body_lines = pr_body.match(/[^\r\n]+/g);

      var ci_params = await pull_request.parsePRDescription(body_lines, context.octokit);
      ci_params["workflow"] = "generate"
      ci_params["generators"] = "'examples api-docs'"

      const branch_info =  await pull_request.getBranchFromPRNumber(context.octokit, "arangodb", "docs-hugo", context.payload.issue.number)
      console.log(branch_info)
      
      let pipeline_id = await circleci.triggerCircleCIPipeline(branch_info.branch, ci_params)
      app.log.info("PIPELINE ID " + pipeline_id)

      let jobs = await circleci.getPipelineJobs(pipeline_id)
      for (let job of jobs) {
        // circleci.createJobCheck(job, branch_info)
        // app.log.info("check created")
      }
    }
  }

};
