// const { ProbotOctokit } = require("probot");

// const octokit = new ProbotOctokit({
//     auth: {
//       appId: process.env.APP_ID,
//       privateKey: process.env.PRIVATE_KEY,
//       installationId: 37861233
//     },
//   });

async function jobCompletedWebhook(req, res) {
    // var branch = req.body.pipeline.vcs.branch;
    // var pipeline_id = req.body.pipeline.id;

    // const jobs = await getPipelineJobs(pipeline_id)

    // const check_runs = await octokit.rest.checks.listForRef({
    //     owner: "arangodb",
    //     repo: "docs-hugo",
    //     ref: branch
    // })

    // for (let check_run of check_runs.data.check_runs) {
    //     for (let job of jobs) {
    //         if (check_run.external_id == job.id) {
    //             const updateBody = createUpdateBody(check_run, job)
    //             octokit.rest.checks.update(updateBody);
    //         }
    //     }
    // }

    // res.send("Hello World");
}

function createJobCheck(job, branch) {
    // console.log("Create Job Check " + branch)
    // var status = "queued";

    // if (job.hasOwnProperty("job_number")) status = "in_progress";

    // octokit.rest.checks.create({
    //     owner: "arangodb",
    //     repo: "docs-hugo",
    //     name: "custom-check: "+job.name,
    //     external_id: job.id,
    //     head_branch: branch.branch,
    //     head_sha: branch.sha,
    //     status: status,
    //     started_at: new Date(),
    //     output: {
    //         title: "Custom check for " + job.name,
    //         summary: "The check has been created!",
    //         },
    //     });

}

async function triggerCircleCIPipeline(branch, params) {
    console.log("Trigger CircleCI Pipeline for branch" + branch)
    console.log("Trigger Params:")
    console.log(params)

    let response = await fetch('https://circleci.com/api/v2/project/gh/arangodb/docs-hugo/pipeline', {
        method: 'POST',
        headers: {'content-type': 'application/json', 'Circle-Token': process.env.CIRCLECI_TOKEN},
        body: JSON.stringify({branch: branch, parameters: params}),
    })
    
    let data = await response.json();
    return data.id;
    }
    
async function getPipelineJobs(pipeline_id) {
    res = []
    console.log("Get Jobs From " + pipeline_id)

    let workflow = await fetch('https://circleci.com/api/v2/pipeline/'+pipeline_id+'/workflow', {
        method: 'GET',
        headers: {'content-type': 'application/json', 'Circle-Token': process.env.CIRCLECI_TOKEN},
    })
    
    let data = await workflow.json();
    console.log(data)
    workflow_id = data.items[0].id;
    console.log("GET WORKFLOW ID " + workflow_id);

    let jobs = await fetch('https://circleci.com/api/v2/workflow/'+workflow_id+'/job', {
        method: 'GET',
        headers: {'content-type': 'application/json', 'Circle-Token': process.env.CIRCLECI_TOKEN},
    })
    
    let jobsData = await jobs.json();
    for (let job of jobsData.items) {
        console.log(job)
        res.push(job)
    }
    console.log("GET JOBs " + res);
    return res
}


function createUpdateBody(check_run, job) {
    // res = {
    //     owner: "arangodb",
    //     repo: "docs-hugo",
    //     check_run_id: check_run.id,
    //     output: {
    //         title: "Status is now " + job.status,
    //         summary: "The check has been created!",
    //         },
    //     }

    // if (job.status == 'queued' || job.status == 'blocked') {
    //     res["status"] = "queued"
    // }

    // if (job.status == 'not_running' || job.status == 'running') {
    //     res["status"] = "in_progress"
    // }

    // if (job.status == 'canceled' || job.status == 'failed' || job.status == 'timedout' || job.status == 'terminated-unknown') {
    //     res["status"] = "completed"
    //     res["conclusion"] = "failure"
    // }

    // if (job.status == 'success') {
    //     res["status"] = "completed"
    //     res["conclusion"] = "success"
    // }
    
    // console.log("RES FOR " + check_run.id + "  " + job.name + " status " + job.status)
    // console.log(res)

    // return res
}

exports.jobCompletedWebhook = jobCompletedWebhook;
exports.createJobCheck = createJobCheck;
exports.triggerCircleCIPipeline = triggerCircleCIPipeline;
exports.getPipelineJobs = getPipelineJobs;