---
title: Relationships
type: docs
prev: docs/database/models
next: docs/database/builder
weight: 2
---

Relationships let you model the associations between tables (a user has many
posts, a post belongs to a user) as fields on a model. They are declared with
the [`builder`](https://pkg.go.dev/gosalusa.com/database/builder) package's generic relationship types and are managed by the
builder: the `model` package skips fields whose type implements
[`relationship.Relationship`](https://pkg.go.dev/gosalusa.com/database/builder#Relationship) during column collection, so no `db` tag is
needed on the field and it never becomes a column.

## Relationship types

There are three kinds of relationship:

- [`builder.HasOne[T]`](https://pkg.go.dev/gosalusa.com/database/builder#HasOne) — the parent model has at most one related model.
- [`builder.HasMany[T]`](https://pkg.go.dev/gosalusa.com/database/builder#HasMany) — the parent model has many related models.
- [`builder.BelongsTo[T]`](https://pkg.go.dev/gosalusa.com/database/builder#BelongsTo) — the parent model holds the foreign key referencing
  another model.

```go
type Author struct {
	model.BaseModel

	ID    int                     `db:"id,primary,autoincrement"`
	Name  string                  `db:"name"`
	Books *builder.HasMany[*Book] `json:"books"`
}

type Book struct {
	model.BaseModel

	ID       int                       `db:"id,primary,autoincrement"`
	AuthorID int                       `db:"author_id"`
	Author   *builder.BelongsTo[*Author] `json:"author"`
}
```

`Author.Books` is a has-many relationship (the `books` table stores the
foreign key) and `Book.Author` is a belongs-to relationship (the `books` table
stores the key that points back at `authors`). Both describe the same
association from opposite ends.

## Naming and keys

By default the columns are inferred from the model's table name and primary
key, so no tags are required when your schema follows the convention:

- **HasOne / HasMany**: the parent is joined on its primary key (`id`), and
  the related table holds a foreign key named `<singular parent table>_<parent
  key>`, e.g. `author_id`.
- **BelongsTo**: the parent table holds a foreign key named
  `<singular related table>_<related key>`, e.g. `author_id`, which references
  the primary key (`id`) of the related table.

Use struct tags to point at non-default columns:

| tag       | relationships | description                                                                                 |
| --------- | ------------- | ------------------------------------------------------------------------------------------- |
| `local`   | HasOne, HasMany | column on the parent model the relationship joins on (default: parent primary key)          |
| `foreign` | HasOne, HasMany | column on the related model holding the key (default: `<singular parent table>_<parent key>`) |
| `foreign` | BelongsTo     | column on the parent model holding the key (default: `<singular related table>_<related key>`) |
| `owner`   | BelongsTo     | column on the related model that the key references (default: related primary key)          |

```go
type Book struct {
	model.BaseModel

	ID        int              `db:"id,primary,autoincrement"`
	PublisherID int            `db:"publisher_id"`
	Publisher *builder.BelongsTo[*Publisher] `db:"-" foreign:"publisher_id" owner:"id"`
}
```

If either model uses a composite primary key you must specify the keys with
tags, because the defaults can only generate a single column.

## Accessing loaded values

Every relationship field exposes two methods:

- [`Value`](https://pkg.go.dev/gosalusa.com/database/builder#Relationship) returns `(T, bool)` — the related value and whether it has been
  fetched.
- [`Loaded`](https://pkg.go.dev/gosalusa.com/database/builder#Relationship) reports whether the relationship has been fetched.

```go
authors, err := builder.From[Author]().With("Books").Get(db)
// ...
for _, author := range authors {
	books, ok := author.Books.Value()
	if ok {
		// process books
	}
}
```

When a model is serialized to JSON, a relationship that has not been loaded
encodes as `null`, while a loaded one encodes as its value.

## Loading relationships

### Eager loading with `With`

[`With`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.With) registers relationships to be loaded in the queries that `Get`
runs. Nested relationships are separated by dots:

```go
authors, err := builder.From[Author]().
	With("Books", "Books.Chapters").
	Get(db)
```

### Loading after the fact

[`Load`](https://pkg.go.dev/gosalusa.com/database/builder#Load) loads a relationship onto already-fetched models, filling it in on
every model in a slice. [`LoadMissing`](https://pkg.go.dev/gosalusa.com/database/builder#LoadMissing) does the same while skipping
relationships that have already been loaded:

```go
err := builder.Load(db, authors, "Books")
err = builder.LoadMissing(db, authors, "Books")
```

Both support dotted paths for nested relationships.

## Constraining queries with `WhereHas`

[`WhereHas`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereHas) adds an `EXISTS` condition so a query only returns rows whose
related records exist and match the callback. The callback constrains the
relationship as a subquery:

```go
authors, err := builder.From[Author]().
	WhereHas("Books", func(q *builder.Builder) *builder.Builder {
		return q.Where("published", "=", true)
	}).
	Get(db)
```

## Migrations

When [`spice generate:migration`](/docs/cli) creates a migration for a model,
each `BelongsTo` field contributes a foreign-key constraint referencing the
related model's table and key. Has-one and has-many relationships do not
create constraints: the foreign key lives on the other table, and is declared
on that model instead.