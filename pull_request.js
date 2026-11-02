// Image references and branch names. They end up in shell commands of the CI of
// docs-hugo, which validates them, too (REF_PATTERN in .circleci/generate_config.py).
const UPSTREAM_REF = /^[A-Za-z0-9][A-Za-z0-9._/:@+-]*$/;

// The upstream references of a PR description (lines) as CircleCI pipeline
// parameters, and errors for invalid ones
export async function parsePRDescription(body, octokit) {
  let params = {}
  let errors = []
  for (let line of body) {
    // This needs to match with PULL_REQUEST_TEMPLATE.md in arangodb/docs-hugo
    const matches = line.match(/^- (\d{1,2}\.(?:\d{1,2}|x)):\s*(\S+)/)
    if (matches) {
      const image = matches[2]
      const branch_name = await parsePRUpstream(image, octokit)
      if (branch_name == "") continue

      const version = matches[1]
      if (!UPSTREAM_REF.test(branch_name)) {
        errors.push("Invalid upstream reference for " + version + ": `" + branch_name.replace(/[`\r\n]/g, "") + "`")
        continue
      }
      const version_underscore_lower = version.replace(".", "_").toLowerCase()
      params["arangodb-" + version_underscore_lower] = branch_name
      continue
    }
  }

  return { params, errors }
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

// Whether a pull request comes from a fork (or a deleted one), i.e. its branch
// isn't in the repository itself
export function isForkPR(pr, owner, repo) {
  return pr.head.repo?.full_name !== owner + "/" + repo
}

export async function getBranchFromPR(octokit, owner, repo, pr) {
  console.log("[DEBUG] pull_request repo object " + JSON.stringify(pr.head))

  if (isForkPR(pr, owner, repo))
      return { branch: "pull/" + pr.number + "/head", sha: "" };

  return await getBranchFromPRNumber(octokit, owner, repo, pr.number)
}

// The branch of a pull request, pull/<number>/head for forks (which CircleCI
// can build, unlike the branch name of the fork)
export async function getBranchFromPRNumber(octokit, owner, repo, pr_number) {
    const response = await octokit.rest.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: pr_number
        })
    if (isForkPR(response.data, owner, repo))
      return { branch: "pull/" + pr_number + "/head", sha: response.data.head.sha, fork: true };
    return { branch: response.data.head.ref, sha: response.data.head.sha, fork: false };
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

export const DEPLOY_PREVIEW_COMMENT = "**Deploy Preview Available Via**<br>"

// Comments the deploy preview link on a pull request once (the CI calls it after
// every deployment of the preview)
export async function commentDeployPreview(octokit, pr_number) {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: "arangodb",
    repo: "docs-hugo",
    issue_number: pr_number,
    per_page: 100
  })
  if (comments.some((c) => c.user?.type === "Bot" && c.body?.startsWith(DEPLOY_PREVIEW_COMMENT))) {
    return false
  }
  await createPRComment(octokit, "arangodb", "docs-hugo", pr_number,
    DEPLOY_PREVIEW_COMMENT + "https://deploy-preview-" + pr_number + "--docs-hugo.netlify.app")
  return true
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
