
async function parsePRDescription(body, octokit) {
    res = {}
    for (let line of body) {
        if (line.match(/(?<=- 3.10: )[\w\W]+/gm)) { 
          const branch_name = await parsePRUpstream(line.match(/(?<=- 3.10: )[\w\W]+/gm)[0], octokit)
          if (branch_name == "") continue

          res["arangodb-branch"] = "stable,"+branch_name+",3.10,"
          continue
        }

        if (line.match(/(?<=- 3.11: )[\w\W]+/gm)) { 
          const branch_name = await parsePRUpstream(line.match(/(?<=- 3.11: )[\w\W]+/gm)[0], octokit)
          if (branch_name == "") continue

          res["arangodb-branch-2"] = "stable,"+branch_name+",3.11,"
          continue
        }

        if (line.match(/(?<=- 3.12: )[\w\W]+/gm)) { 
          const branch_name = await parsePRUpstream(line.match(/(?<=- 3.12: )[\w\W]+/gm)[0], octokit)
          if (branch_name == "") continue

          res["arangodb-branch-3"] = "stable,"+branch_name+",3.12,"
          continue
        }

        if (line.match(/(?<=- devel: )[\w\W]+/gm)) { 
          const branch_name = await parsePRUpstream(line.match(/(?<=- devel: )[\w\W]+/gm)[0], octokit)
          if (branch_name == "") continue

          res["arangodb-branch-4"] = "stable,"+branch_name+",devel,"
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

async function createPR(octokit) {
  console.log("createPR invoked")
  const response = await octokit.pulls.create({
    owner: "arangodb",
    repo: "docs-hugo",
    title: "[CircleCI Generated] Scheduled generated content",
    body: "Test create PR",
    head: "scheduled-content-generate",
    base: "main"
  })
}

async function createSummary(octokit, branch_name, branch_sha, body) {
  await octokit.rest.checks.create({
      owner: "arangodb",
      repo: "docs-hugo",
      name: "create summary",
      head_branch: branch_name,
      head_sha: branch_sha,
      status: "completed",
      conclusion: "success",
      started_at: new Date(),
      output: {
          title: "Summary available in checks",
          summary: body,
          },
      });

}

exports.parsePRDescription = parsePRDescription
exports.parsePRUpstream = parsePRUpstream
exports.getBranchFromPRNumber = getBranchFromPRNumber
exports.createPRComment = createPRComment
exports.createPR = createPR
exports.createSummary = createSummary