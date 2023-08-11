
async function parsePRDescription(body, octokit) {
    res = {}
    for (let line of body) {
        if (line.match(/(?<=- 3.10: )[\w\W]+/gm)) { 
          const branch_name = await parsePRUpstream(line.match(/(?<=- 3.10: )[\w\W]+/gm)[0], octokit)
          if (branch_name == "") continue

          res["arangodb-3_10"] = branch_name
          continue
        }

        if (line.match(/(?<=- 3.11: )[\w\W]+/gm)) { 
          const branch_name = await parsePRUpstream(line.match(/(?<=- 3.11: )[\w\W]+/gm)[0], octokit)
          if (branch_name == "") continue

          res["arangodb-3_11"] = branch_name
          continue
        }

        if (line.match(/(?<=- 3.12: )[\w\W]+/gm)) { 
          const branch_name = await parsePRUpstream(line.match(/(?<=- 3.12: )[\w\W]+/gm)[0], octokit)
          if (branch_name == "") continue

          res["arangodb-3_12"] = branch_name
          continue
        }
    }

    return res
}



async function parsePRUpstream(line, octokit) {
    if (line.replace(/\s/g,'') == "") return ""

    if (line.includes("https://")) {
      console.log("Parse PR Upstream ")

      pr_number = line.match(/\d+/gm);
      var branch_info = await getBranchFromPRNumber(octokit, "arangodb", "arangodb", pr_number)
      return branch_info.branch
    }
    
    return line
}



async function getBranchFromPRNumber(octokit, owner, repo, pr_number) {
    const response = await octokit.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: pr_number
        })
    return {branch: response.data.head.ref, sha: response.data.head.sha};
}

async function createPRComment(octokit, owner, repo, pr_number, body) {
  await octokit.rest.issues.createComment({
    owner: owner,
    repo: repo,
    issue_number: pr_number,
    body: body
  })
}

async function createPR(octokit, head, title, body) {
  console.log("createPR invoked")
  const response = await octokit.pulls.create({
    owner: "arangodb",
    repo: "docs-hugo",
    title: title,
    body: body,
    head: head,
    base: "frontend-preview"
  })
}

async function createSummary(octokit, branch_name, branch_sha, body) {
  await octokit.rest.checks.create({
      owner: "arangodb",
      repo: "docs-hugo",
      name: "docs-webhooks: create-summary",
      head_branch: branch_name,
      head_sha: branch_sha,
      status: "completed",
      conclusion: "success",
      started_at: new Date(),
      output: {
          title: "",
          summary: "<h1>Build Report</h1>",
          text: body
          },
      });
}

async function getCommitMessage(octokit, branch_name) {
  const response = await octokit.git.getCommit({
    owner: "arangodb",
    repo: "docs-hugo",
    ref: "heads/"+branch_name
  })
  console.log(response)
}

exports.parsePRDescription = parsePRDescription
exports.parsePRUpstream = parsePRUpstream
exports.getBranchFromPRNumber = getBranchFromPRNumber
exports.createPRComment = createPRComment
exports.createPR = createPR
exports.createSummary = createSummary
exports.getCommitMessage = getCommitMessage