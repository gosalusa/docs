---
title: Release Notes
type: docs
prev: docs/cli
weight: 24
---

User-facing changes in each Salusa framework release, newest first. New
identifiers link to their documentation on
[pkg.go.dev](https://pkg.go.dev/gosalusa.com); each section links to the
framework release itself.

## v0.29.0 - 2026-09-29

`optional.Optional[T]` is now a struct with an unexported
`sql.Null[T]` inside it rather than a defined type over it, so the wrapped
value and its validity flag can no longer be reached through fields. Three
methods replace the field access that is gone: `Valid()` for a plain check,
`Or` for a lazily built fallback, and `All` for iteration.
Release: [v0.29.0](https://github.com/gosalusa/framework/releases/tag/v0.29.0).

- [`optional.Optional[T]`](https://pkg.go.dev/gosalusa.com/optional#Optional)
  no longer exposes `V` and `Valid` as exported fields. Build values with
  [`Some`](https://pkg.go.dev/gosalusa.com/optional#Some) and
  [`None[T]()`](https://pkg.go.dev/gosalusa.com/optional#None) instead of a
  composite literal, and read the wrapped value with
  [`OrElse`](https://pkg.go.dev/gosalusa.com/optional#Optional.OrElse) or
  [`Ok`](https://pkg.go.dev/gosalusa.com/optional#Optional.Ok). See
  [Optional Values](/docs/nullable).
- New
  [`Optional.Valid()`](https://pkg.go.dev/gosalusa.com/optional#Optional.Valid)
  method reporting whether the value is present.
- New [`Optional.Or`](https://pkg.go.dev/gosalusa.com/optional#Optional.Or),
  which returns the value unchanged when it is valid and otherwise calls a
  function for the fallback. The function is only evaluated when the value is
  absent, so an expensive default costs nothing on the common path.
- New [`Optional.All`](https://pkg.go.dev/gosalusa.com/optional#Optional.All),
  returning an [`iter.Seq[T]`](https://pkg.go.dev/iter#Seq) that yields the
  wrapped value once when the `Optional` is valid and nothing when it is not.
  It drops straight into `range` and into
  [`stream`](https://pkg.go.dev/gosalusa.com/stream) pipelines.
- [`optional.OfNull`](https://pkg.go.dev/gosalusa.com/optional#OfNull) gained
  a correct doc comment; it is unchanged.

### Breaking changes

- `Optional.IfPresent` was removed. Replace `n.IfPresent(fn)` with
  `n.Or(func() optional.Optional[T] { /* fallback */ return optional.None[T]() })`
  when you want a value back, or branch on `n.Valid()` and call `fn` yourself.
- The `V` and `Valid` fields of
  [`Optional[T]`](https://pkg.go.dev/gosalusa.com/optional#Optional) are no
  longer exported. Replace `optional.Optional[string]{V: "a", Valid: true}`
  with `optional.Some("a")`, and `n.Valid` with `n.Valid()`.

## v0.27.0 - 2026-09-25

A small release with three new pieces of API: a cache abstraction with an
in-process implementation, a minimal nullable wrapper published at a `/v2`
import path, and a builder option on the event service. The query builder also
grows raw ordering. Release: [v0.27.0](https://github.com/gosalusa/framework/releases/tag/v0.27.0).

- New [`cache`](https://pkg.go.dev/gosalusa.com/cache) package. The
  [`MemoryCache`](https://pkg.go.dev/gosalusa.com/cache#MemoryCache) interface
  covers `Get`, `GetOrCreate`, `Set`, and `Remove` over `[]byte`, and
  [`SetOptions`](https://pkg.go.dev/gosalusa.com/cache#SetOptions) is a
  placeholder for per-write options. See [Caching](/docs/caching).
- [`MapCache`](https://pkg.go.dev/gosalusa.com/cache#MapCache) is the shipped
  in-process implementation, built by
  [`NewMapCache`](https://pkg.go.dev/gosalusa.com/cache#NewMapCache) with a
  five-minute TTL, and entries are
  [`MapCacheItem`](https://pkg.go.dev/gosalusa.com/cache#MapCacheItem) values
  with an absolute expiration.
- [`cache.Register`](https://pkg.go.dev/gosalusa.com/cache#Register) registers a
  `MemoryCache` as a lazy singleton, so handlers can inject the interface
  rather than constructing a cache.
- [`Builder.OrderByRaw`](https://pkg.go.dev/gosalusa.com/database/builder#Builder.OrderByRaw)
  and
  [`ModelBuilder.OrderByRaw`](https://pkg.go.dev/gosalusa.com/database/builder#ModelBuilder.OrderByRaw)
  append an unencoded sort expression to `ORDER BY`, for the cases a column
  name cannot express: a `CASE`, or a function call. See
  [Builder](/docs/database/builder).
- [`EventService.Synchronous`](https://pkg.go.dev/gosalusa.com/event#EventService.Synchronous)
  is a new builder option on the service returned by
  [`event.Service`](https://pkg.go.dev/gosalusa.com/event#Service), for
  choosing between handling each dequeued message inline and handling it on its
  own goroutine. See [Events](/docs/events).
- New [`nulls/v2`](https://pkg.go.dev/gosalusa.com/nulls/v2) package holding
  [`Null[T]`](https://pkg.go.dev/gosalusa.com/nulls/v2#Null), a `sql.Null[T]`
  wrapper with JSON and SQL support only. It is a smaller alternative to
  `optional.Optional[T]`; see [Optional Values](/docs/nullable).

### Breaking changes

- [`dialects.OrderColumn`](https://pkg.go.dev/gosalusa.com/database/dialects#OrderColumn).Column
  is now a [`dialects.Column`](https://pkg.go.dev/gosalusa.com/database/dialects#Column)
  rather than a `string`, so an order column can carry a raw expression. If
  you build `OrderColumn` values directly, wrap the name:
  `dialects.OrderColumn{Column: dialects.Column{Column: "name"}, Descending: true}`.
  Queries built through the builder's `OrderBy` and `OrderByDesc` need no
  change.
