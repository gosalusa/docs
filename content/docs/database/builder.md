---
title: Builder
type: docs
prev: docs/database/models
next: docs/database/schema
weight: 2
---

The `builder` package provides a fluent, chainable query builder for the
database package. It lets you construct and execute SELECT, UPDATE, and DELETE
statements against models without writing raw SQL.

## Builder and ModelBuilder

There are two builder types. `Builder` represents a query before any model is
attached and exposes the full set of query operations. The generic
`ModelBuilder[T]` is bound to a model type and adds the type-safe terminal
operations for loading, counting, updating, and deleting records. `Builder`
is also used directly for subqueries and the callbacks passed to `WhereHas`
and `JoinOn`.

## Starting a query

Create a query with `New`, `From`, or `NewEmpty`:

- `From[T]()` starts from the model's table with `table.*` selected.
- `New[T]()` starts with `*` selected but no table set (useful when the table
  comes from a subquery or join).
- `NewEmpty[T]()` starts with nothing selected and no table.

```go
users, err := builder.From[User]().
	Where("active", "=", true).
	OrderByDesc("name").
	Limit(10).
	Get(db)
```

## Query operations

Builder methods generally mutate the receiver and return it so calls can be
chained. `Clone` returns an independent copy of a query, so mutating the
returned builder (or the original) does not affect the other.

### Selecting columns

`Select`, `AddSelect`, and their raw variants control which columns are
returned. `SelectSubquery` adds a scalar subquery as a column, and
`SelectFunction` selects a column wrapped in a SQL function (for example
`count`). `Distinct` forces the query to return only distinct rows.

```go
categories, err := builder.From[Category]().
	AddSelectSubquery(
		builder.NewEmpty[Product]().WhereColumn("category_id", "=", "categories.id").SelectFunction("count", "*"),
		"product_count",
	).
	OrderByDesc("product_count").
	Get(db)
```

### Where, Having, and grouped conditions

`Where` adds a condition built from a column, an operator, and a value:

```go
builder.From[User]().Where("email", "=", "a@example.com")
```

`OrWhere` adds a condition with an `OR`. `WhereColumn` compares two columns,
`WhereIn` tests membership in a list of values, and `WhereRaw` inserts an
unencoded SQL fragment with bound arguments. `Exists`, `NotExists`, and
`Subquery` variants each work against a nested query. The `And` and `Or`
methods group a set of conditions inside parentheses:

```go
builder.From[User]().
	Where("active", "=", true).
	Or(builder.And(func(q *builder.Conditions) {
		q.Where("plan", "=", "pro").
			Where("plan", "=", "team")
	}))
```

Every `Where*` method has a matching `Having*` method that applies the
condition to the `HAVING` clause of an aggregated query.

### Joins

`Join`, `LeftJoin`, `RightJoin`, `InnerJoin`, and `CrossJoin` take a table, a
local column, an operator, and a foreign column. If the `ON` condition needs to
be more complex, the matching `*JoinOn` methods accept a callback that builds
the condition with `WhereColumn` and friends:

```go
posts, err := builder.From[Post]().
	JoinOn("users", func(q *builder.Conditions) {
		q.WhereColumn("users.id", "=", "posts.user_id").
			WhereColumn("users.active", "=", "posts.draft")
	}).
	Get(db)
```

### Grouping, ordering, and pagination

`GroupBy` and `AddGroupBy` set or add columns to the `GROUP BY` clause.
`OrderBy` and `OrderByDesc` add columns to the `ORDER BY` clause, and
`Unordered` removes all ordering. `Limit` caps the number of rows and `Offset`
skips rows, which together implement pagination.

### Locking rows

`ForUpdate` adds `FOR UPDATE` to the query, locking the selected rows until the
transaction commits. `ForUpdateSkipLocked` skips rows that are already locked.

## Executing the query

### Loading records

- `Get` executes the query and returns a slice of the model type.
- `First` returns the first matching record, or the zero value of `T`.
- `Find` returns the record with a matching primary key (single-key tables only).
- `Load` fills a passed-in value, useful for loading into custom aggregates.
- `Count` executes a `count(*)` select and returns the number of records.

```go
user, err := builder.From[User]().Find(db, 42)

total, err := builder.From[User]().Where("active", "=", true).Count(db)
```

### Batching results

`Chunk` iterates over results in batches of 1000 records, calling the callback
for each batch. `ChunkN` does the same with a custom batch size, and `Each`
iterates over individual records.

### Updating and deleting

`Update` sets columns for every record matched by the query's where clauses.
`UpdateReturning` is the same but returns the updated records. `Delete`
removes the matched records, subject to any active delete scopes (a soft delete
scope, for example, rewrites the delete into an update of `deleted_at`).

```go
err := builder.From[User]().Where("active", "=", false).
	Update(db, builder.Updates{"plan": "basic"})

err := builder.From[Post]().Where("created_at", "<", twoYearsAgo).Delete(db)
```

## Relationships

Relationships declared as fields on a model are loaded through the builder
rather than the model package.

### Eager loading with `With`

`With` registers relationships to be loaded in the queries that `Get` runs.
Nested relationships are separated by dots:

```go
users, err := builder.From[User]().
	With("Posts", "Posts.Comments").
	Get(db)
```

### Loading after the fact

`Load` loads a relationship onto already-fetched models, and `LoadMissing` does
the same while skipping relationships that have already been loaded. Both
support dotted paths for nested relationships.

### Constraining by relationship with `WhereHas`

`WhereHas` adds a condition that the related records exist, with a callback
that constrains the relationship subquery:

```go
users, err := builder.From[User]().
	WhereHas("Posts", func(q *builder.Builder) *builder.Builder {
		return q.Where("published", "=", true)
	}).
	Get(db)
```

## Scopes

A `Scope` is a reusable modifier for a query. Models can implement `Scoper` to
define global scopes that are applied to every query, limited to a
`Query` function and a `Delete` function. `WithScope` and `WithoutScope` add
and remove local scopes, while `WithoutGlobalScope` skips a global scope for a
single query. `ActiveScopes` returns the scopes currently in effect.

## Context and debugging

`WithContext` attaches a `context.Context` that is used when executing the
query, and `Context` returns it. `Dump` prints the encoded SQL for the query to
stdout and returns the receiver so it can be dropped into the middle of a
chain.
