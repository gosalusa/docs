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