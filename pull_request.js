
async function parsePRDescription(body, octokit) {
  res = {}
  for (let line of body) {
    // This needs to match with PULL_REQUEST_TEMPLATE.md in arangodb/docs-hugo
    const matches = line.match(/^- (\d\.\d{1,2}|OEM):([\w\W]+)/)
    if (matches) {
      var image = matches[2].trim()
      const branch_name = await parsePRUpstream(image, octokit)
      if (branch_name == "") continue

      var version = matches[1].trim()
      var version_underscore_lower = version.replace(".", "_").toLowerCase()
      res["arangodb-" + version_underscore_lower] = branch_name
      continue
    }
  }

    return res
}



async function parsePRUpstream(line, octokit) {
    if (line == "") return ""

    if (line.includes("https://github.com/")) {
      console.log("Parse PR Upstream ")

      match = line.match(/\/pull\/(\d+)/)
      if (!match) return "" // Ignore invalid link
      pr_number = match[1]
      var branch_info = await getBranchFromPRNumber(octokit, "arangodb", "arangodb", pr_number)
      return branch_info.branch
    }
    
    return line
}


async function getBranchFromPR(octokit, owner, repo, pr) {
  console.log("[DEBUG] pull_request repo object " + JSON.stringify(pr.head))

  if (pr.head.repo.full_name != "arangodb/docs-hugo") 
      return { branch: "pull/" + pr.number + "/head", sha: "" };

  return await getBranchFromPRNumber(octokit, owner, repo, pr.number)
}


async function getBranchFromPRNumber(octokit, owner, repo, pr_number) {
    const response = await octokit.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: pr_number
        })
    return { branch: response.data.head.ref, sha: response.data.head.sha };
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
    base: "main"
  })
}

async function createSummary(octokit, branch_name, check_name, branch_sha, body) {
  await octokit.rest.checks.create({
      owner: "arangodb",
      repo: "docs-hugo",
      name: "docs-webhooks: " + check_name,
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
exports.getBranchFromPR = getBranchFromPR
exports.createPRComment = createPRComment
exports.createPR = createPR
exports.createSummary = createSummary
exports.getCommitMessage = getCommitMessage
