---
title: Builder
type: docs
prev: docs/database/relationships
next: docs/database/migrations
weight: 3
---

The [`builder`](https://pkg.go.dev/gosalusa.com/database/builder) package provides a fluent, chainable query builder for the
database package. It lets you construct and execute SELECT, UPDATE, and DELETE
statements against models without writing raw SQL.

## Builder and ModelBuilder

There are two builder types. [`Builder`](https://pkg.go.dev/gosalusa.com/database/builder#Builder) represents a query before any model is
attached and exposes the full set of query operations. The generic
[`ModelBuilder[T]`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder) is bound to a model type and adds the type-safe terminal
operations for loading, counting, updating, and deleting records. `Builder`
is also used directly for subqueries and the callbacks passed to [`WhereHas`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereHas)
and [`JoinOn`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.JoinOn).

## Starting a query

Create a query with [`New`](https://pkg.go.dev/gosalusa.com/database/builder#New), [`From`](https://pkg.go.dev/gosalusa.com/database/builder#From), or [`NewEmpty`](https://pkg.go.dev/gosalusa.com/database/builder#NewEmpty):

- [`From[T]()`](https://pkg.go.dev/gosalusa.com/database/builder#From) starts from the model's table with `table.*` selected.
- [`New[T]()`](https://pkg.go.dev/gosalusa.com/database/builder#New) starts with `*` selected but no table set (useful when the table
  comes from a subquery or join).
- [`NewEmpty[T]()`](https://pkg.go.dev/gosalusa.com/database/builder#NewEmpty) starts with nothing selected and no table.

```go
users, err := builder.From[User]().
	Where("active", "=", true).
	OrderByDesc("name").
	Limit(10).
	Get(db)
```

## Query operations

Builder methods generally mutate the receiver and return it so calls can be
chained. [`Clone`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Clone) returns an independent copy of a query, so mutating the
returned builder (or the original) does not affect the other.

### Selecting columns

[`Select`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Select), [`AddSelect`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.AddSelect), and their raw variants control which columns are
returned. [`SelectSubquery`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.SelectSubquery) adds a scalar subquery as a column, and
[`SelectFunction`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.SelectFunction) selects a column wrapped in a SQL function (for example
`count`). [`Distinct`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Distinct) forces the query to return only distinct rows.

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

[`Where`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Where) adds a condition built from a column, an operator, and a value:

```go
builder.From[User]().Where("email", "=", "a@example.com")
```

[`OrWhere`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.OrWhere) adds a condition with an `OR`. [`WhereColumn`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereColumn) compares two columns,
[`WhereIn`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereIn) tests membership in a list of values, and [`WhereRaw`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereRaw) inserts an
unencoded SQL fragment with bound arguments. [`Exists`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereExists), [`NotExists`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereNotExists), and
[`Subquery`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereSubquery) variants each work against a nested query. The [`And`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.And) and [`Or`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Or)
methods group a set of conditions inside parentheses:

```go
builder.From[User]().
	Where("active", "=", true).
	Or(builder.And(func(q *builder.Conditions) {
		q.Where("plan", "=", "pro").
			Where("plan", "=", "team")
	}))
```

Every `Where*` method has a matching [`Having*`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Having) method that applies the
condition to the `HAVING` clause of an aggregated query.

### Joins

[`Join`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Join), [`LeftJoin`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.LeftJoin), [`RightJoin`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.RightJoin), [`InnerJoin`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.InnerJoin), and [`CrossJoin`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.CrossJoin) take a table, a
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

[`GroupBy`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.GroupBy) and [`AddGroupBy`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.AddGroupBy) set or add columns to the `GROUP BY` clause.
[`OrderBy`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.OrderBy) and [`OrderByDesc`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.OrderByDesc) add columns to the `ORDER BY` clause, and
[`Unordered`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Unordered) removes all ordering. [`Limit`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Limit) caps the number of rows and [`Offset`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Offset)
skips rows, which together implement pagination.

### Locking rows

[`ForUpdate`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.ForUpdate) adds `FOR UPDATE` to the query, locking the selected rows until the
transaction commits. [`ForUpdateSkipLocked`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.ForUpdateSkipLocked) skips rows that are already locked.

## Executing the query

### Loading records

- [`Get`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Get) executes the query and returns a slice of the model type.
- [`First`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.First) returns the first matching record, or the zero value of `T`.
- [`Find`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Find) returns the record with a matching primary key (single-key tables only).
- [`Load`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Load) fills a passed-in value, useful for loading into custom aggregates.
- [`Count`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Count) executes a `count(*)` select and returns the number of records.

```go
user, err := builder.From[User]().Find(db, 42)

total, err := builder.From[User]().Where("active", "=", true).Count(db)
```

### Batching results

[`Chunk`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Chunk) iterates over results in batches of 1000 records, calling the callback
for each batch. [`ChunkN`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.ChunkN) does the same with a custom batch size, and [`Each`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Each)
iterates over individual records.

### Updating and deleting

[`Update`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Update) sets columns for every record matched by the query's where clauses.
[`UpdateReturning`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.UpdateReturning) is the same but returns the updated records. [`Delete`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.Delete)
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

[`With`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.With) registers relationships to be loaded in the queries that `Get` runs.
Nested relationships are separated by dots:

```go
users, err := builder.From[User]().
	With("Posts", "Posts.Comments").
	Get(db)
```

### Loading after the fact

[`Load`](https://pkg.go.dev/gosalusa.com/database/builder#Load) loads a relationship onto already-fetched models, and [`LoadMissing`](https://pkg.go.dev/gosalusa.com/database/builder#LoadMissing) does
the same while skipping relationships that have already been loaded. Both
support dotted paths for nested relationships.

### Constraining by relationship with `WhereHas`

[`WhereHas`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WhereHas) adds a condition that the related records exist, with a callback
that constrains the relationship subquery:

```go
users, err := builder.From[User]().
	WhereHas("Posts", func(q *builder.Builder) *builder.Builder {
		return q.Where("published", "=", true)
	}).
	Get(db)
```

## Scopes

A [`Scope`](https://pkg.go.dev/gosalusa.com/database/builder#Scope) is a reusable modifier for a query. Models can implement [`Scoper`](https://pkg.go.dev/gosalusa.com/database/builder#Scoper) to
define global scopes that are applied to every query, limited to a
`Query` function and a `Delete` function. [`WithScope`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WithScope) and [`WithoutScope`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WithoutScope) add
and remove local scopes, while [`WithoutGlobalScope`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WithoutGlobalScope) skips a global scope for a
single query. [`ActiveScopes`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.ActiveScopes) returns the scopes currently in effect.

## Context and debugging

[`WithContext`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.WithContext) attaches a `context.Context` that is used when executing the
query, and [`Context`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Context) returns it. [`Dump`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.Dump) prints the encoded SQL for the query to
stdout and returns the receiver so it can be dropped into the middle of a
chain.
