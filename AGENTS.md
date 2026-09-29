# AGENTS.md

Salusa docs site. Hugo static site using the **Hextra** theme (pulled in as a Go module), deployed to Netlify.

## Prerequisites

- Hugo **extended** edition is required (Hextra compiles SCSS). Netlify and the devcontainer pin `0.156.0`. A non-extended `hugo` binary will fail at build.
- The theme is a Go module dependency, not vendored: any `go.mod`/`hugo.yaml` module changes need `hugo mod tidy`.

## Commands

- Dev server: `hugo server -D` (serves draft content; site lives in `content/`, not root)
- Build: `hugo --gc --minify` (matches the Netlify command in `netlify.toml`)
- `public/`, `resources/`, and `.hugo_build.lock` are gitignored build artifacts — never commit them.

## How the site is wired

- **Docs content**: `content/docs/**`. Every subsection uses `_index.md`; pages use frontmatter `type: docs` plus `prev:` / `next:` for nav ordering (relative paths, no leading `/`). See `content/docs/getting-started.md` for the pattern.
- **Vanity Go import**: `layouts/_partials/custom/head-end.html` emits the `go-import` meta tag pointing `gosalusa.com` at `github.com/gosalusa/framework`, and `netlify.toml` force-returns `200` for any `?go-get=1` request. Together these make `go get gosalusa.com/...` resolve. Do not remove these, or Go tooling breaks.
- **Markdown output & LLM endpoints**: `hugo.yaml` defines a `MARKDOWN` output format, and site overrides in `layouts/{home,page,section}.markdown.md` emit each page's raw content as `.md` (used by the Go tooling flow above). `static/llms.txt` provides the curated documentation index for AI agents, and the `LLMSFULL` output format (`layouts/home.llmsfull.txt`) renders `/llms-full.txt` — every `/docs` page concatenated, ordered by `weight` with subsection children following their parent. Both are produced by the normal `hugo` build; there is no separate generator step. Keep the `outputs` list (HTML + MARKDOWN + LLMSFULL) intact.
- Raw HTML in content is allowed (`markup.goldmark.renderer.unsafe: true`).
- Hextra shortcodes like `{{< cards >}}` / `{{< card link=... >}}` are used in `content/_index.md` — prefer them over hand-rolled HTML.
- `build/main.go` is an empty placeholder; ignore it. There are no tests or lint setup for this repo.

## Branches / deploy

- Default branch is `main`; deploy is via Netlify (branch for "edit this page" links).

## Release docs sync

`.github/workflows/release-docs-sync.yml` keeps the docs in step with framework releases. It is triggered by a `repository_dispatch` of type `release-published` from `gosalusa/framework` (see that repo's `.github/workflows/notify-docs.yml`) or by hand via `workflow_dispatch`.

What it does:

1. Checks out the framework repo at the released tag and diffs it against the previous tag, excluding tests, `internal/`, snapshots and CI config. The diff goes into `release-notes.md`.
2. Runs `opencode run --auto` in this repo with `.github/release-docs-prompt.md` as the instructions and the diff attached. The agent edits only `content/` and `static/llms.txt` and writes a report to `$RUNNER_TEMP/release-report.md`.
3. Builds with `hugo --gc --minify`, then opens a PR from `docs/<tag>` with the report as the body.

Editing `.github/release-docs-prompt.md` changes the agent's behaviour — it is the place to add rules about tone, new sections, or what counts as a user-facing change.

**Edit the prompt, not the workflow**, for behavioural changes; the workflow only wires up inputs, permissions, and the PR.

### Setup

- Secret `OPENCODE_API_KEY` in this repo (from <https://opencode.ai/auth>, provider "OpenCode Zen"). The workflow default model is `opencode/claude-sonnet-4-5`; override it with the `model` input.
- Secret `DOCS_DISPATCH_TOKEN` in **framework** — a token with `repo` scope on `gosalusa/docs`, so the framework repo can fire `repository_dispatch`.
- Without a change under `content/` or `static/` the workflow opens no PR and says so in the log.
