
export async function parsePRDescription(body, octokit) {
  let res = {}
  for (let line of body) {
    // This needs to match with PULL_REQUEST_TEMPLATE.md in arangodb/docs-hugo
    const matches = line.match(/^- (\d{1,2}\.(?:\d{1,2}|x)):\s*(\S+)/)
    if (matches) {
      const image = matches[2]
      const branch_name = await parsePRUpstream(image, octokit)
      if (branch_name == "") continue

      const version = matches[1]
      const version_underscore_lower = version.replace(".", "_").toLowerCase()
      res["arangodb-" + version_underscore_lower] = branch_name
      continue
    }
  }

    return res
}

export async function parsePRUpstream(line, octokit) {
    if (line == "") return ""

    if (line.includes("https://github.com/")) {
      console.log("Parse PR Upstream ")

      // Link to a branch (no pull request needed), e.g.
      // https://github.com/arangodb/arangodb/tree/feature/new-aql-function
      const branch = line.match(/\/arangodb\/arangodb\/tree\/(\S+?)\/?$/)
      if (branch) return decodeURIComponent(branch[1])

      const match = line.match(/\/pull\/(\d+)/)
      if (!match) return "" // Ignore invalid link
      const pr_number = match[1]
      const branch_info = await getBranchFromPRNumber(octokit, "arangodb", "arangodb", pr_number)
      return branch_info.branch
    }
    
    return line
}

export async function getBranchFromPR(octokit, owner, repo, pr) {
  console.log("[DEBUG] pull_request repo object " + JSON.stringify(pr.head))

  if (pr.head.repo.full_name != "arangodb/docs-hugo") 
      return { branch: "pull/" + pr.number + "/head", sha: "" };

  return await getBranchFromPRNumber(octokit, owner, repo, pr.number)
}

export async function getBranchFromPRNumber(octokit, owner, repo, pr_number) {
    const response = await octokit.rest.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: pr_number
        })
    return { branch: response.data.head.ref, sha: response.data.head.sha };
}

// Whether a user is a member of the arangodb GitHub organization. Requires the
// "Members" organization permission (read) of the GitHub App, false otherwise.
export async function isOrgMember(octokit, username) {
  try {
    // 204 for members, an error (404) otherwise
    await octokit.rest.orgs.checkMembershipForUser({ org: "arangodb", username: username })
    return true
  } catch (error) {
    console.log("[isOrgMember] " + username + ": " + error.status)
    return false
  }
}

export async function createPRComment(octokit, owner, repo, pr_number, body) {
  await octokit.rest.issues.createComment({
    owner: owner,
    repo: repo,
    issue_number: pr_number,
    body: body
  })
}

// Reacts to a comment, e.g. with "rocket" to acknowledge a command. Failures are
// only logged, as the reaction is just a convenience.
export async function addCommentReaction(octokit, owner, repo, comment_id, content) {
  try {
    await octokit.rest.reactions.createForIssueComment({
      owner: owner,
      repo: repo,
      comment_id: comment_id,
      content: content
    })
  } catch (e) {
    console.log("[addCommentReaction] Failed: " + e.message)
  }
}

export async function createPR(octokit, head, title, body) {
  console.log("createPR invoked")
  await octokit.rest.pulls.create({
    owner: "arangodb",
    repo: "docs-hugo",
    title: title,
    body: body,
    head: head,
    base: "main"
  })
}

export async function createSummary(octokit, branch_name, check_name, branch_sha, body, conclusion = "success") {
  await octokit.rest.checks.create({
      owner: "arangodb",
      repo: "docs-hugo",
      name: "docs-webhooks: " + check_name,
      head_branch: branch_name,
      head_sha: branch_sha,
      status: "completed",
      conclusion: conclusion,
      started_at: new Date(),
      output: {
          title: "",
          summary: "<h1>Build Report</h1>",
          text: body
          },
      });
}

export async function getCommitMessage(octokit, branch_name) {
  const response = await octokit.git.getCommit({
    owner: "arangodb",
    repo: "docs-hugo",
    ref: "heads/"+branch_name
  })
  console.log(response)
}
