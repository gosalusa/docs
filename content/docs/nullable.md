---
title: Nullable & Optional Values
type: docs
prev: docs/errors
next: docs/collections
weight: 17
---

The [`nulls`](https://pkg.go.dev/gosalusa.com/nulls) and [`optional`](https://pkg.go.dev/gosalusa.com/optional) packages model fields that can be absent — typed
alternatives to raw pointers and to `sql.Null*`.

## nulls.Null[T]

[`nulls.Null[T]`](https://pkg.go.dev/gosalusa.com/nulls#Null) wraps any type `T` with a `Valid` flag and interoperates with
JSON, `database/sql`, and `database/sql/driver`:

```go
type Null[T any] struct {
	V     T
	Valid bool
}
```

```go
var _ json.Marshaler = Null[int]{}
var _ json.Unmarshaler = (*Null[int])(nil)
var _ sql.Scanner = (*Null[int])(nil)
var _ driver.Valuer = Null[int]{}
```

[`New(v)`](https://pkg.go.dev/gosalusa.com/nulls#New) builds a valid value. In JSON, an invalid `Null` marshals to `null`
and a JSON `null` unmarshals to an invalid instance; non-null values
marshal/unmarshal as the wrapped type — including time values, slices, pointers,
and structs. Through `sql`, `Scan(nil)` clears the value and `Value()` produces
`nil` for an invalid instance, so nullable database columns round-trip without
special handling:

```go
type User struct {
	ID        int64        `db:"id"`
	AvatarURL nulls.Null[string] `db:"avatar_url"`
}
```

## optional.Option[T]

[`optional.Option[T]`](https://pkg.go.dev/gosalusa.com/optional#Option) is the same idea as a plain value with a presence flag, and
[`Some(v)`](https://pkg.go.dev/gosalusa.com/optional#Some)/[`None[T]()`](https://pkg.go.dev/gosalusa.com/optional#None) build it:

```go
type Option[T any] struct {
	Value T
	Valid bool
}
```

```go
opt := optional.Some("pending")
// or
opt := optional.None[string]()

if opt.Valid {
	// ...
}
```

Note that the optional package is still a stub: its `MarshalJSON`,
`UnmarshalJSON`, and text/binary encoding methods currently panic. Use
`nulls.Null[T]` when a nullable value must cross a JSON or database boundary.