export async function triggerCircleCIPipeline(branch, params) {
    console.log("Trigger CircleCI Pipeline for branch " + branch)
    console.log("Trigger Params:")
    console.log(params)

    const response = await fetch('https://circleci.com/api/v2/project/gh/arangodb/docs-hugo/pipeline', {
        method: 'POST',
        headers: {'content-type': 'application/json', 'Circle-Token': process.env.CIRCLECI_TOKEN},
        body: JSON.stringify({branch: branch, parameters: params}),
    })
    
    const data = await response.json();
    return data.id;
    }
    
export async function getPipelineJobs(pipeline_id) {
    let res = []
    console.log("Get Jobs From " + pipeline_id)

    const workflow = await fetch('https://circleci.com/api/v2/pipeline/'+pipeline_id+'/workflow', {
        method: 'GET',
        headers: {'content-type': 'application/json', 'Circle-Token': process.env.CIRCLECI_TOKEN},
    })
    
    const data = await workflow.json();
    const workflow_id = data.items[0].id;
    console.log("GET WORKFLOW ID " + workflow_id);

    const jobs = await fetch('https://circleci.com/api/v2/workflow/'+workflow_id+'/job', {
        method: 'GET',
        headers: {'content-type': 'application/json', 'Circle-Token': process.env.CIRCLECI_TOKEN},
    })
    
    const jobsData = await jobs.json();
    for (const job of jobsData.items) {
        res.push(job)
    }
    return res
}
