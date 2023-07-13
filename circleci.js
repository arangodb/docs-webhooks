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
    workflow_id = data.items[0].id;
    console.log("GET WORKFLOW ID " + workflow_id);

    let jobs = await fetch('https://circleci.com/api/v2/workflow/'+workflow_id+'/job', {
        method: 'GET',
        headers: {'content-type': 'application/json', 'Circle-Token': process.env.CIRCLECI_TOKEN},
    })
    
    let jobsData = await jobs.json();
    for (let job of jobsData.items) {
        res.push(job)
    }
    return res
}



exports.triggerCircleCIPipeline = triggerCircleCIPipeline;
exports.getPipelineJobs = getPipelineJobs;