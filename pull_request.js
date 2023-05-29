
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
    }

    return res
}



async function parsePRUpstream(line, octokit) {
    if (line.replace(/\s/g,'') == "") return ""

    if (line.includes("https://")) {
      pr_number = line.match(/\d+/gm);
      return await getBranchFromPRNumber(octokit, "arangodb", "arangodb", pr_number).branch
    }
    
    return line
}



async function getBranchFromPRNumber(octokit, owner, repo, pr_number) {
    const response = await octokit.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: pr_number
        })
    console.log(response)
    return {branch: response.data.head.ref, sha: response.data.head.sha};
}


exports.parsePRDescription = parsePRDescription
exports.parsePRUpstream = parsePRUpstream
exports.getBranchFromPRNumber = getBranchFromPRNumber