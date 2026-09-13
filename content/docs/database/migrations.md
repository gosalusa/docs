---
title: Migrations
type: docs
prev: docs/database/builder
next: docs/dependency-injection
weight: 3
---

Migrations are versioned schema changes: each one contains the operations that
move your database forward (`Up`) and the operations that undo them (`Down`).
They are applied in order on startup, so every environment converges on the
same schema.

## Where migrations live

Migrations live in the `migrations/` package. The package exposes a single
`Migrations` registry through `Use()`, which is wired into the database in the
kernel:

```go
database.Register(ctx, c.Database, migrations.Use())
```

Running `spice init` scaffolds a `migrations/` directory with two files:

`migrations/migrations.go` creates the registry:

```go
package migrations

import (
	"gosalusa.com/database/migrate"
)

var migrations = migrate.New()

func Use() *migrate.Migrations {
	return migrations
}
```

Each `migrations/2024*-*.go` file registers its migration in an `init`
function:

```go
func init() {
	migrations.Add(&migrate.Migration{
		Name: "20240322_143359-Foo",
		...
	})
}
```

## How migrations run

When the database is registered, `Migrations.Up` is invoked before the
connection is handed out. It creates a `migrations` table if it does not exist,
reads the names of the migrations that have already run, then applies every
pending migration in name order. Because names are prefixed with a timestamp,
lexicographic order is creation order. Each migration runs inside its own
transaction: a row recording the migration is written to `migrations` before
`Up` executes and marked as run after it succeeds, so a failed migration is
rolled back and can be retried as-is.

## Anatomy of a migration

A migration is a `migrate.Migration` with three fields:

- `Name` — the timestamped file stem, e.g. `20240322_143359-Foo`.
- `Up` — the operations that apply the change.
- `Down` — the operations that reverse it.

Both `Up` and `Down` are `schema.Runner`s, so any schema builder below can be
assigned directly. A typical migration creates a table in `Up` and drops it in
`Down`:

```go
package migrations

import (
	"gosalusa.com/database/migrate"
	"gosalusa.com/database/schema"
)

func init() {
	migrations.Add(&migrate.Migration{
		Name: "20240322_143359-Foo",
		Up: schema.Create("foos", func(table *schema.Blueprint) {
			table.Int("id").Primary().AutoIncrement()
		}),
		Down: schema.DropIfExists("foos"),
	})
}
```

`GoStringer`s such as `schema.Raw` or `schema.Run` may be used for steps that
are not pure schema, for example a data backfill:

```go
Up: schema.Run(func(ctx context.Context, tx database.DB) error {
	_, err := database.Exec(ctx, tx, "UPDATE users SET plan = 'basic' WHERE plan = ''")
	return err
}),
```

## Creating a migration

Use `spice make:migration` to scaffold a timestamped migration file:

```console
$ spice make:migration create users
# writes migrations/20260913_101530_create_users.go
```

Arguments are joined with `_` and prefixed with the current timestamp
(`create users` becomes `20260913_101530_create_users`). The generated file
contains empty `Up`/`Down` steps; fill them in with the schema builder. One
migration file holds one logical change.

`spice generate:migration` (a hidden `go:generate` target) is the other way to
produce a migration: it builds one from a model's `db` tags, keeping the
model's table in sync with its struct. See [Models](docs/database/models) for
details.

## Editing migrations

The schema for a table evolves by *adding* migrations, never by editing a
migration that has already run. Since `Up` runs once and is tracked in the
`migrations` table, changing an applied migration does nothing — the row is
already marked as run. If a migration has not been applied yet, you may edit it
in place, but once it exists in any deployed environment, create a new one for
the change.

A follow-up migration uses the `schema.Table` builder to alter the existing
table. Columns added in the callback are added, columns marked with `Change()`
are modified in place, and `DropColumn` removes a column:

```go
migrations.Add(&migrate.Migration{
	Name: "20260913_101530_rename_foo",
	Up: schema.Table("foos", func(table *schema.Blueprint) {
		table.String("title").Change()
		table.String("slug").Unique()
		table.DropColumn("legacy_flag")
	}),
	Down: schema.Table("foos", func(table *schema.Blueprint) {
		table.String("legacy_flag").Nullable()
		table.DropColumn("slug")
	}),
})
```

Write `Down` as a mirror image of `Up` so the change can be reversed: drop what
`Up` added, restore what `Up` removed.

## Building schema

Schema steps are all `Runner`s, so anything below works directly as an `Up` or
`Down` step.

### Creating tables

`Create(name, cb)` returns a `CreateTableBuilder`. Call `IfNotExists()` to skip
creation when the table already exists, or `Temporary()` to create a temporary
table:

```go
schema.Create("users", func(table *schema.Blueprint) {
	table.Int("id").AutoIncrement()
	table.String("name")
	table.String("email").Unique()
}).IfNotExists()
```

### Altering tables

`Table(name, cb)` returns an `UpdateTableBuilder` that changes an existing
table, as shown in [Editing migrations](#editing-migrations).

### Dropping tables

`Drop(table)` removes a table and `DropIfExists(table)` removes it only if it
already exists:

```go
schema.DropIfExists("users")
```

### Views and raw SQL

`View(name, query)` creates a database view backed by a raw SELECT statement,
and `Raw` runs a statement with no processing:

```go
schema.View("active_users", "SELECT * FROM users WHERE active = true")

schema.Raw("CREATE EXTENSION IF NOT EXISTS pgcrypto")
```

## Column types

| method                                        | SQL type                       |
| --------------------------------------------- | ------------------------------ |
| `String(name)`                                | a sized string, e.g. `VARCHAR` |
| `Text(name)`                                  | a long text value              |
| `Bool(name)`                                  | a boolean                      |
| `Int`, `Int8`, `Int16`, `Int32`, `Int64`      | signed integers                |
| `UInt`, `UInt8`, `UInt16`, `UInt32`, `UInt64` | unsigned integers              |
| `Float`, `Float32`, `Float64`                 | floating point numbers         |
| `JSON(name)`                                  | JSON data                      |
| `Date(name)`                                  | a calendar date                |
| `DateTime(name)`                              | a date and time                |
| `Blob(name)`                                  | raw binary data                |

`OfType(datatype, name)` adds a column of an arbitrary dialect data type.

### Column modifiers

Each type method returns a `ColumnBuilder` that is configured by chaining
modifiers, all of which mutate and return the builder:

| modifier                       | effect                                      |
| ------------------------------ | ------------------------------------------- |
| `Nullable()` / `NotNullable()` | allow or forbid NULL                        |
| `Primary()`                    | mark the column as part of the primary key  |
| `AutoIncrement()`              | let the database assign the value on insert |
| `Default(v)`                   | set a default value                         |
| `DefaultCurrentTime()`         | default to the current timestamp            |
| `Unique()`                     | add a unique constraint                     |
| `Index()`                      | create an index on the column               |
| `Size(s)`                      | set the string size, e.g. `VARCHAR(100)`    |
| `After(column)`                | position the column after another (MySQL)   |
| `Change()`                     | alter the column in place (update only)     |

A composite primary key is declared separately with `PrimaryKey`, taking the
columns in order:

```go
schema.Create("memberships", func(table *schema.Blueprint) {
	table.Int64("user_id")
	table.Int64("group_id")
	table.PrimaryKey("user_id", "group_id")
})
```

### Indexes

`Index(name)` adds an index column by column via `AddColumn`, and optional
`Unique()` makes it a unique index:

```go
schema.Table("users", func(table *schema.Blueprint) {
	table.Index("users_email_unique").AddColumn("email").Unique()
})
```

### Foreign keys

`ForeignKey(localKey, relatedTable, relatedKey)` adds a foreign key constraint
reference from one column to another table's column:

```go
schema.Create("posts", func(table *schema.Blueprint) {
	table.Int("id").AutoIncrement()
	table.Int("user_id").Index()
	table.String("title")
	table.ForeignKey("user_id", "users", "id")
})
```