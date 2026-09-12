---
title: Spice CLI
type: docs
prev: docs/testing
weight: 22
---

`spice` is the command-line companion to Salusa. It scaffolds new applications,
runs a hot-reloading development server, and generates models and migrations.

## init

`spice init <module>` scaffolds a new project from the framework template. It
copies the generated layout, replaces the template module path with yours,
initializes a git repository with an `origin` remote derived from the module
name, and runs `go mod init` and `go mod tidy`:

```console
$ spice init github.com/acme/webapp
```

The resulting tree matches the layout described in
[Application & Kernel](docs/application): `app/`, `config/`, `routes/`,
`migrations/`, `resources/`, and `spice.yml`.

## dev

`spice dev` runs the app through Air, rebuilding and restarting it whenever a
`.go`, `.tpl`, `.tmpl`, `.html`, or `.env` file changes. Builds use the `dev`
tag (running `go build -tags dev`), so `resources/embed_dev.go` is selected and
template and asset changes are served straight from disk without a rebuild —
see [Files & File Serving](docs/files).

```console
$ spice dev
```

This is also where the `--fetch` flag (matched by the kernel's `FetchAuth`)
typically comes in when developing against an authenticated upstream.

## make:model

`spice make:model <name>` writes a model file into the model directory from
`spice.yml`. Names are normalized: `make:model my-cool-user` produces
`app/models/my-cool-user.go` with a `MyCoolUser` type:

```go
package models

import (
	"context"

	"gosalusa.com/database/builder"
	"gosalusa.com/database/model"
)

//go:generate spice generate:migration
type MyCoolUser struct {
	model.BaseModel

	ID int `json:"id" db:"id,primary,autoincrement"`
}

func init() {
	providers.Add(modeldi.Register[*MyCoolUser])
}

func MyCoolUserQuery(ctx context.Context) *builder.ModelBuilder[*MyCoolUser] {
	return builder.From[*MyCoolUser]().WithContext(ctx)
}
```

## make:migration

`spice make:migration <name...>` creates a timestamped migration file:

```console
$ spice make:migration create users
# writes migrations/20260912_101530_create_users.go
```

The file contains empty `Up`/`Down` blocks; in the `Up` block you use the
schema builder (e.g. `schema.Create("users", ...)`), and `Down` typically drops
the same table. Migration names join the arguments with `_` and are prefixed
with the current timestamp so they apply in creation order (see the
[migrations](docs/database/builder) docs).

## generate:migration

`spice generate:migration` is a hidden `go:generate` target invoked from a model
file. It inspects the current struct in `GOFILE`/`GOLINE`, builds a migration
that brings the schema in line with the model, and writes it to the migrations
directory. You don't run it by hand; it runs via `go generate` on the model
files produced by `make:model`.

## spice.yml

The generator reads a small YAML config, looked up by walking up to the nearest
`spice.yml` (the CLI stops at the first `go.mod` / git root):

```yaml
module: github.com/acme/webapp
model:
  dir: app/models
  package: models
  import: github.com/acme/webapp/app/models
migration:
  dir: migrations
  package: migrations
  import: github.com/acme/webapp/migrations
```

If the file is omitted, `app/models` and `migrations` are used as defaults with
package names derived from the directory names.