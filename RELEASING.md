# Releasing AnsibleForms

For maintainers. Contributors only need [CONTRIBUTING.md](CONTRIBUTING.md).

Everything below runs in GitHub Actions. Nothing is built or pushed from a laptop, and no
version number or changelog line is ever typed by hand.

## How a release happens

```
feature PR ──squash──▶ main ──▶ release-please updates the open "chore: release x.y.z" PR
                                              │
                           you merge it ──────┘
                                              ▼
                     tag x.y.z + GitHub release + image x.y.z and latest
```

1. Every pull request merged into `main` has a Conventional Commit title
   (`feat: ...`, `fix: ...`). See CONTRIBUTING.md for what each type does to the version.
2. After each merge, the **Release** workflow (`.github/workflows/release.yml`) runs
   release-please. It keeps **one** pull request open, titled `chore: release x.y.z`, that:
   - bumps `server/package.json` and `server/package-lock.json` to the next version
   - adds the section for that version at the top of `CHANGELOG.md`
   - updates `.release-please-manifest.json`
3. That open pull request is the "unreleased" list: its diff shows exactly what the next
   release contains.
4. **Merging it is the release.** The same workflow then creates the tag `x.y.z` (no `v`, like
   the tags before it), the GitHub release with the changelog section as notes, and calls
   **Publish**, which pushes `x.y.z` and `latest` to Docker Hub and GHCR.

### Changing the changelog wording before a release

Edit `CHANGELOG.md` on the release pull request's branch (`release-please--branches--main`)
and push. Once the release exists, you can also edit the GitHub release notes directly.

### Forcing a specific version

Merge any pull request whose **description** ends with a `Release-As:` line. The squash
commit carries the description as its body, and release-please then proposes that version:

```
Release-As: 7.0.0
```

## Release candidates

To test a version before it is released, label a pull request **`release-candidate`**.
Every push to it then publishes:

- `ansibleguy/ansibleforms:<next>-rc.<pr>.<run>`, for example `6.4.0-rc.512.7`
- `ansibleguy/ansibleforms:latest-rc`

and a comment on the pull request lists the tags. The UI and the Status page of that image
show the rc version.

`<next>` is the version the pull request would release. On the release pull request it is
exactly the upcoming version, so labeling that pull request tests the whole release.

Only pull requests from branches of this repository publish. A fork's code never runs with
the registry credentials.

## Publishing an existing release again

Actions → **Publish** → Run workflow → enter the tag (for example `6.3.1`). The workflow
refuses when `server/package.json` at that tag names another version.

## The base image

`ansibleguy/ansibleforms-base` holds node, python, ansible and the os packages. It is
versioned by date (`2026.10.01`, plus `latest`), independent of the application.

- **Build it:** Actions → **Base image** → Run workflow. It also runs by itself when
  `Dockerfile.base` changes on main, and on the 1st of every month for security updates.
- **Use it:** the application `Dockerfile` pins the base by digest, so a new base changes
  nothing until the pin moves. Dependabot opens a `build(deps): bump ansibleforms-base`
  pull request for that. Label it `release-candidate` to test the app on the new base, then
  merge it. Retitle it `fix(base): ...` if the update should appear in the changelog.

## Hotfix on an older version

Rarely needed: while the next release is being prepared on main, you normally fix on main
and release. If an old line must get a fix, branch from its tag, fix, bump
`server/package.json`, tag it by hand and run **Publish** with that tag. Do not move
`latest` backwards: re-publish the current release afterwards if needed.

## Local scripts

- `publish-local.sh` builds the application image on your machine, without pushing.
- `publish-base.sh` builds and pushes the base image by hand, for when the workflow cannot.

A test server does not need an image copied to it: it can pull `latest-rc`.

## Setup this depends on

| What | Where | Used by |
|---|---|---|
| GitHub App `ansibleforms-release` (contents and pull requests: read and write) | installed on this repository only | release.yml |
| `RELEASE_APP_ID` | repository variable | release.yml |
| `RELEASE_APP_PRIVATE_KEY` | repository secret | release.yml |
| `PAT_TOKEN` | repository secret, used by release.yml until `RELEASE_APP_ID` is set | release.yml |
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` | secrets of the `dockerhub` environment | publish.yml, base.yml |
| `DOCKERHUB_REPOSITORY`, `DOCKERHUB_BASE_REPOSITORY` | optional repository variables | publish.yml, base.yml |
| `dockerhub` environment | must allow `main` and pull request refs | publish.yml (rc runs on a pull request) |
| `github-pages` environment | deployment branch `main` | pages.yml |
| label `release-candidate` | repository labels | rc.yml |
| ruleset on `main` | pull request required, squash only, required checks, no force push | everything |

The App token is needed because a pull request opened with the default `GITHUB_TOKEN`
starts no workflows, so the release pull request would never get its required checks.
