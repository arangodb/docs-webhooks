# docs-webhooks

A [Probot](https://probot.github.io/) app that connects the
[arangodb/docs-hugo](https://github.com/arangodb/docs-hugo) repository with
CircleCI. It runs as two Netlify Functions and acts as the
[arangodb-docs-automation](https://github.com/apps/arangodb-docs-automation)
GitHub App (the bot that comments in docs PRs).

How the CircleCI workflows, the PR comment commands, and the upstream
references work from a docs contributor's point of view is described in
[CIRCLECI.md](https://github.com/arangodb/docs-hugo/blob/main/CIRCLECI.md) of
docs-hugo. This README covers what you need to know to develop this app.

## How it works

```
GitHub (docs-hugo) ──webhook──▶ netlify/functions/github.mjs ──▶ app.js ──▶ CircleCI API
                                                                                    │
GitHub API ◀── netlify/functions/circleci.mjs ◀──── curl callbacks ───────────────┘
```

- **`netlify/functions/github.mjs`**: receives the GitHub webhooks of the app,
  verifies their signature, and passes them to the Probot app in `app.js`:
  - `pull_request.opened` / `pull_request.synchronize`: triggers a
    `plain-build` pipeline for the PR. PRs from forks of non-members of the
    `arangodb` organization are not built automatically. A member needs to
    review them and comment `/build`.
  - `push` to `main`: triggers a `plain-build` pipeline with the
    `deploy-preview-main` deploy URL.
  - `issue_comment.created`: handles the comment commands (`/build`,
    `/generate`, `/generate-commit`, `/commit`, see `commands.js`). Only members
    of the `arangodb` organization can use them. For `/generate` and
    `/generate-commit`, the upstream references are parsed from the PR
    description (`parsePRDescription()` in `pull_request.js`).
- **`netlify/functions/circleci.mjs`**: receives callbacks from the CircleCI
  jobs of docs-hugo (`curl` calls in `.circleci/base_config.yml` of docs-hugo).
  The `docs-webhook-event` header selects the action:
  - `create-summary`: creates a check run (`docs-webhooks: <check name>`) with
    the build report
  - `deploy-preview`: comments the deploy preview link in the PR (once)
  - `scheduled-create-pr`: opens a PR for the scheduled generate workflows

  The requests need to authenticate with the `docs-webhook-token` header
  (see `callback_auth.js`).

The two sides depend on each other: the parameter names of the CircleCI
pipelines, the callback headers, the PR description format
(`PULL_REQUEST_TEMPLATE.md` of docs-hugo), the generator names, and the
validation of upstream references (`REF_PATTERN` in
`.circleci/generate_config.py`) need to match. If you change any of these,
change docs-hugo accordingly, and consider the deployment order (see
[Deployment](#deployment)).

## Where things are

### GitHub repository

<https://github.com/arangodb/docs-webhooks>

### GitHub App

The app that is installed in the `arangodb` organization is
[arangodb-docs-automation](https://github.com/apps/arangodb-docs-automation/installations/37861233).
It is an organization app, and the **helpdesk** has control over its settings
(permissions, subscribed events, webhook URL, private keys, installation).
You cannot change these settings yourself. Ask the helpdesk to change them, for
example, if new code requires additional permissions or events.

`app.yml` documents the permissions and events the app is configured with on
GitHub. Probot only uses this manifest to create a new app, so changing the file
does **not** change the settings of the existing app. Keep it in sync with the
actual settings anyway, with permissions that the code doesn't need commented
out.

The app currently uses:

- Events: `issue_comment`, `pull_request`, `push`
- Permissions: Checks (write), Pull requests (write), Metadata (read),
  Members (read, organization permission, to check the membership of commenters
  and PR authors including private memberships)

Note that GitHub requires the installation (by an organization owner) to accept
new permissions after they are added to the app.

The installation ID is hardcoded in `netlify/functions/circleci.mjs`, as the
callbacks don't come from GitHub and have no installation in their payload.
It needs to be updated if the app is ever reinstalled.

### Netlify project

The app is deployed as the Netlify project `candid-daffodil-f96315`:

- Dashboard: <https://app.netlify.com/projects/candid-daffodil-f96315/overview>
- Function URLs (the GitHub App's webhook URL points to the first one, the
  docs-hugo CircleCI config to the second one):
  - `https://candid-daffodil-f96315.netlify.app/.netlify/functions/github`
  - `https://candid-daffodil-f96315.netlify.app/.netlify/functions/circleci`

In the dashboard, you can find:

- **Cloud compute** > **Functions**: the logs of the `github` and `circleci`
  functions (the `console.log()` output) per function, the first place to look
  if the bot doesn't react or a check is missing
- **Deploys**: the deploy history with the full deploy logs, including the
  option to roll back to (publish) an earlier deploy:
  <https://app.netlify.com/projects/candid-daffodil-f96315/deploys>
- **Project configuration**: the linked repository, branch, and build settings
  (there is no `netlify.toml`, the functions are picked up from the default
  `netlify/functions/` directory), and the secrets of the app in the
  **Environment variables** tab:
  <https://app.netlify.com/projects/candid-daffodil-f96315/configuration/general>

The Netlify project for the docs previews (`docs-hugo`) is a different one.

### Environment variables

Set in the Netlify project. These aren't built-in Netlify variables: Probot
reads `APP_ID`, `PRIVATE_KEY`, and `WEBHOOK_SECRET` (`createProbot()` in
`netlify/functions/github.mjs`), and the code of this app reads the others.

| Variable             | Purpose              |
|:---------------------|:---------------------|
| `APP_ID`             | ID of the GitHub App |
| `PRIVATE_KEY`        | Private key of the GitHub App (newlines may be escaped as `\n`) |
| `WEBHOOK_SECRET`     | Secret to verify the GitHub webhook signatures |
| `CIRCLECI_TOKEN`     | CircleCI API token to trigger pipelines of docs-hugo |
| `DOCS_WEBHOOK_TOKEN` | Shared token to authenticate the CircleCI callbacks. It needs to be the same in the [CircleCI project settings](https://app.circleci.com/settings/project/github/arangodb/docs-hugo/environment-variables) of docs-hugo. Without it, the `circleci` function rejects all requests. |

The GitHub App secrets (`APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET`) come from the
app settings, which means you need the helpdesk to generate a new private key or
webhook secret. Changes to environment variables only take effect with the next
deploy of the Netlify project.

## Development

Requirements: Node.js 24 or later (see [Node.js version](#nodejs-version)).

```sh
npm install
npm run test
```

The tests use Jest with the native ES modules support
(`--experimental-vm-modules`). `test/index.test.js` mocks the `circleci.js` and
`pull_request.js` modules and checks which pipelines and comments the app
triggers for the fixtures in `test/fixtures/`. If you export a new function from
`pull_request.js`, add it to the mock there, too.

### Running the app locally

You can run the app locally with `npm start` (`probot run ./app.js`).
GitHub can't send webhooks to your machine directly, so Probot uses
[smee.io](https://smee.io), a webhook proxy service: you create a channel on the
website, which gives you a public URL. GitHub sends the webhooks to this URL,
and the `smee-client` package (a dev dependency) forwards them to the locally
running app. Set the channel URL as `WEBHOOK_PROXY_URL` in a local `.env` file
(not committed), together with the variables described above.

This requires a GitHub App whose webhook URL is the smee channel URL. As you
can't change the production app, you
would need to register a separate test app with a test repository. Keep in
mind that the app triggers real CircleCI pipelines of docs-hugo with the
`CIRCLECI_TOKEN`.

In most cases, the unit tests are enough, and you can verify the behavior in a
docs-hugo PR after deploying.

## Deployment

Netlify deploys the app when changes are pushed to the `main` branch of
this repository. Check the **Deploys** page of the Netlify project to see whether
the deploy succeeded, and the function logs to see whether the app works.

Test changes in a docs-hugo PR after the deploy, e.g. by pushing a commit (plain
build) and commenting a command. If something breaks, publish the previous
deploy in Netlify to roll back while you fix the problem.

If a change affects both this app and the docs-hugo CI, deploy in an order that
keeps both sides working, or accept a short breakage. For example, if this app
starts to require a new header from the callbacks, add the header to the
docs-hugo CI first.

## Node.js version

The Netlify functions run on AWS Lambda. Netlify uses the Node.js version of
the build for the functions runtime if it is a
[Lambda runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
that isn't deprecated within the next two months. Otherwise, it silently falls
back to a default version
([Netlify docs](https://docs.netlify.com/build/functions/optional-configuration/)).

The version is set in the `.nvmrc` file (major version only, e.g. `24`), which
takes precedence over the setting in the Netlify UI (**Project configuration** >
**Developer settings** > **Continuous deployment** > **Dependency management**).
Keep `engines` in `package.json` in sync with it. Netlify doesn't use `engines`,
it only tells developers which version is required.

To update to a new major version:

1. Pick an LTS version of Node.js
   ([release schedule](https://github.com/nodejs/release#release-schedule)) that
   Lambda supports as a regular runtime, not as a preview, and that isn't
   deprecated soon. Lambda deprecates runtimes when the Node.js version reaches
   its end of life.
2. Update `.nvmrc` and `engines` in `package.json`.
3. Install the version locally and run the tests.
4. Push the changes and check the deploy log for the Node.js version that is used.
   Then check that the app still reacts in a docs-hugo PR.

Check the Node.js version about once a year, before the end of life of the
current version (end of April for even-numbered versions).

## Updating dependencies

1. Check for old packages:

   ```sh
   npm outdated
   ```

2. If major new versions are available, check the dependencies' changelogs and
   check if they are still compatible. Consider changing this app's code so
   newer dependencies can be used.

   Pay special attention to `probot`: the Netlify functions use its lower-level
   APIs (`createProbot()`, `probot.webhooks.verifyAndReceive()`,
   `ProbotOctokit`), which the tests don't cover.

3. To make upgrading easier, you can install this utility:

   ```sh
   npm install -g npm-check-updates
   ```

4. Then, to upgrade all packages in your `package.json` file to the latest
   versions, you can run:

   ```sh
   ncu -u
   npm install
   ```

5. Check `npm outdated` again, there might be more dependencies to update.

6. To upgrade a single dependency to its latest version, use:

   ```sh
   npm install <package_name>@latest
   ```

   npm resolves `latest` to the current version and saves it as a range in
   `package.json`, e.g. `^2.4.0`, not as `latest`. Substitute `latest` with a
   specific version if you want that, e.g. `@2.4.0`, which is saved as
   `^2.4.0`, too. Add `--save-exact` to save the version without the `^`.

   Don't edit `package.json` to use `latest` as the version, as the installed
   version would then change with every fresh install.

7. Check for known vulnerabilities, including the ones of indirect
   dependencies:

   ```sh
   npm audit
   ```

   `npm audit fix` updates them within the allowed version ranges.

8. Run the test suite to find potential problems:

   ```sh
   npm run test
   ```

9. If everything works, commit and push the changes, including
   `package-lock.json`. After Netlify deployed the update, check that the app
   still reacts in a docs-hugo PR (see [Deployment](#deployment)), as a broken
   function only shows up in the Netlify function logs.
