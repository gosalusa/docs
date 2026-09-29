You are updating the documentation site for the Salusa Go framework after a new
framework release.

The attached file `release-notes.md` contains the changes in the framework
repository between the previously released tag and the newly released tag:

- the commit list for the range
- a diffstat
- the full unified diff of every non-test source file in that range

Test files, `internal/`, snapshots and CI config are excluded from the diff. If
you need more context, the framework source for the released tag is checked out
read-only at `./framework` inside this working tree, and `./release-notes.md`
may be truncated if the diff was very large.

## Your task

1. Read `AGENTS.md` in the repository root. It describes how this Hugo/Hextra
   site is wired: page frontmatter, `weight` ordering, `prev`/`next` nav links,
   the `outputs` list, and the raw-HTML/Markdown-output machinery. Follow it.
2. Work out which of the framework changes in the diff are **user facing**: new
   or removed exported identifiers, signature or behaviour changes, new
   packages, new CLI subcommands, changed configuration, changed defaults.
   Ignore CI, refactors, test-only churn, and internal plumbing.
3. Update the Markdown under `content/docs/` so the documentation is accurate
   for the new release. That means, as applicable:
   - correct existing pages whose documented API changed,
   - document newly added packages, types, methods, or options,
   - remove or clearly mark documentation for anything removed or renamed, and
     add a short migration note when a rename or breaking behaviour change
     affects users,
   - add a new page (with frontmatter and `prev`/`next` links) when a change
     introduces a genuinely new topic rather than a detail of an existing one.
4. Record the release on the release notes page, `content/docs/release-notes.md`.

   Keep it as a single running page, newest release first, one `##` section per
   tag in the form `## v0.29.0 - 2026-01-31`, where the date is the release date
   from the framework repo (`git -C framework log -1 --format=%cs <tag>`). If
   you cannot determine the date, use the tag alone and say so in the report.

   Each section holds a short paragraph of prose plus bullets for the
   user-facing changes from step 2, newest release's section inserted directly
   after the page's opening paragraph, above any existing sections. Cover added,
   changed, and removed API, and put anything requiring action under a
   `### Breaking changes` subheading with a one-line migration step. Group by
   topic (for example `### Database`, `### HTTP`) only when a release has more
   than a handful of changes. Link new identifiers to their godoc and the
   section to the framework release URL. Skip empty sections, and if a release
   genuinely has nothing user facing, do not add a section for it.

   Never rewrite the text of an existing release's section; it is a historical
   record. If the tag already has a section, update that section in place
   instead of adding a duplicate.

5. Update `static/llms.txt` if you added, removed, or retitled a page, including
   the release notes page. Each entry links to
   `https://gosalusa.com/docs/<path>/index.md` and carries a one-line
   description.

## House style

- Prose is wrapped at roughly 80 columns. Keep paragraphs tight and concrete.
- Link identifiers to their godoc, e.g.
  `[optional.Some](https://pkg.go.dev/gosalusa.com/optional#Some)`.
- Go examples go in fenced `go` blocks; shell transcripts in `console` blocks
  (with a `$` prompt) and plain commands in `sh` blocks, matching the existing
  pages.
- Use the existing voice: second person, present tense, no marketing language.
- Do not invent API. If the diff does not show it, do not write it. If you are
  unsure whether something is public, check `./framework` before documenting it.

## Rules

- Only edit files under `content/` and `static/llms.txt`, plus the report file
  named in the task preamble. Edits anywhere else are denied.
- Do not commit, push, or open pull requests. The workflow handles that.
- If the diff contains nothing that changes what a user sees, make no edits and
  say so in the report.

## Output

Write your report as markdown to the report file path given in the task
preamble, **overwriting it**, with these sections:

- `## What changed` — a bullet per documentation edit, with the content path.
  Write `No documentation changes needed.` if there were none.
- `## Framework changes considered` — the user-facing changes you evaluated,
  including any you deliberately did not document, and why.
- `## Needs a human` — anything ambiguous, anything you had to guess at, and
  anything that looks like a framework bug rather than a documentation gap.

Then reply in the terminal with a two-line summary only. The report file is the
source of truth.
