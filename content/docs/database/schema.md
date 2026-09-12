---
title: Schema
type: docs
prev: docs/database/builder
next: docs/dependency-injection
weight: 3
---

The `schema` package builds the SQL statements that define your database:
tables, columns, indexes, foreign keys, and views. It is the foundation for
migrations, and the migration generator emits `schema` code from your models'
`db` tags.

## Blueprints and runners

A `Blueprint` describes a table: the columns to add or change, indexes,
foreign keys, and primary keys. It is built with a callback:

```go
schema.Create("users", func(table *schema.Blueprint) {
	table.String("name").Primary()
	table.Bool("active")
	table.DateTime("created_at").DefaultCurrentTime()
})
```

Schema operations implement `Runner`, which has a single method,
`Run(ctx context.Context, tx database.DB) error`. Every schema builder
(`CreateTableBuilder`, `UpdateTableBuilder`, and `ViewBuilder`) and `Raw` is a
`Runner`, so they can all be passed anywhere a migration step is expected.

## Creating tables

`Create(name, cb)` returns a `CreateTableBuilder`. Call `IfNotExists()` to skip
creation when the table already exists, or `Temporary()` to create a temporary
table, then `Run` to execute:

```go
err := schema.Create("users", func(table *schema.Blueprint) {
	table.Int("id").AutoIncrement()
	table.String("name")
	table.String("email").Unique()
}).IfNotExists().Run(ctx, db)
```

### Column types

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

## Altering tables

`Table(name, cb)` returns an `UpdateTableBuilder` that changes an existing
table. Columns added in the callback are added to the table, columns marked
with `Change()` are modified in place, and `DropColumn` removes a column:

```go
err := schema.Table("users", func(table *schema.Blueprint) {
	table.String("nickname").Nullable()
	table.String("email").Nullable().Change()
	table.DropColumn("legacy_flag")
}).Run(ctx, db)
```

## Dropping tables

`Drop(table)` removes a table and `DropIfExists(table)` removes it only if it
already exists:

```go
err := schema.DropIfExists("users").Run(ctx, db)
```

## Views

`View(name, query)` creates a database view backed by a raw SELECT statement:

```go
err := schema.View("active_users",
	"SELECT * FROM users WHERE active = true",
).Run(ctx, db)
```

## Raw SQL

`Raw` runs a raw SQL statement with no processing:

```go
err := schema.Raw("CREATE EXTENSION IF NOT EXISTS pgcrypto").Run(ctx, db)
```
