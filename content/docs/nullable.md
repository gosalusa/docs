---
title: Optional Values
type: docs
prev: docs/errors
next: docs/collections
weight: 17
---

The [`optional`](https://pkg.go.dev/gosalusa.com/optional) package models values that can be absent — a typed alternative to
raw pointers and to the single field types in `database/sql`.

## optional.Optional[T]

[`optional.Optional[T]`](https://pkg.go.dev/gosalusa.com/optional#Optional) wraps any type `T` with a validity flag and
interoperates with JSON, `database/sql`, and `database/sql/driver`:

```go
type Optional[T any] struct {
	// has unexported fields
}
```

The wrapped value is private, so an `Optional` is built and read through the
package's functions and methods rather than through its fields.

The zero value is already an invalid `Optional`, so a struct field needs no
initialization to mean "absent". Build a valid one with
[`Some(v)`](https://pkg.go.dev/gosalusa.com/optional#Some), or an explicitly empty
one with [`None[T]()`](https://pkg.go.dev/gosalusa.com/optional#None):

```go
avatar := optional.Some("https://example.com/a.png")
missing := optional.None[string]()
// equivalent to
missing := optional.Optional[string]{}
```

`Some` marks the value present even when what it is given is the zero value of
its own type: `optional.Some(0)` and `optional.Some("")` are both valid, not
absent. Only the zero value of `Optional` itself — or a JSON `null` on the way
in — means absent.

Read the wrapped value with [`OrElse(fallback)`](https://pkg.go.dev/gosalusa.com/optional#Optional.OrElse), which returns the
value when it is valid and the fallback when it is not:

```go
name := optional.Some("Salusa").OrElse("unknown") // "Salusa"
age := optional.Optional[int]{}.OrElse(0)         // 0
```

[`Valid()`](https://pkg.go.dev/gosalusa.com/optional#Optional.Valid) reports
whether the value is present, which is what you branch on when the valid and
absent cases need different code:

```go
if avatar.Valid() {
	// ...
}
```

[`Ok()`](https://pkg.go.dev/gosalusa.com/optional#Optional.Ok) returns the
wrapped value and a bool in one step, for when you need both without a branch:

```go
avatar, ok := user.AvatarURL.Ok()
if !ok {
	return errors.New("avatar is required")
}
saveAvatar(user, avatar)
```

### JSON

An invalid `Optional` marshals to `null`, and a JSON `null` unmarshals to an
invalid instance holding the zero value of `T`. Anything else marshals and
unmarshals as the wrapped type, so time values, slices, pointers, and structs
all round-trip without a custom `MarshalJSON`:

```go
type User struct {
	ID        int64                   `db:"id"`
	AvatarURL optional.Optional[string] `db:"avatar_url"`
}
```

```go
// optional.None[string]() marshals to: null
// optional.Some("a.png")  marshals to: "a.png"
```

A JSON decoding error leaves the value valid and the wrapped value partially
decoded, so an `Optional` reused across decodes should be reset to its zero
value first.

### SQL

Through `database/sql`, `Scan(nil)` clears the value and marks it invalid, and
`Value()` produces `nil` for an invalid instance. Nullable columns therefore
round-trip through a model with no special handling on either side.

`Optional[T]` implements the interfaces on both the value and the pointer,
matching what the standard library does for `sql.Null[T]`:

```go
var _ json.Marshaler = Optional[int]{}    // value
var _ json.Unmarshaler = (*Optional[int])(nil)
var _ sql.Scanner = (*Optional[int])(nil) // pointer: database/sql takes the address of a field
var _ driver.Valuer = Optional[int]{}     // value: usable directly as a query argument
```

Because `Value()` is on the value type, an `Optional` can be handed to
`database/sql` as an argument with no pointer and no unwrapping — an invalid one
becomes SQL `NULL`:

```go
db.ExecContext(ctx, "UPDATE users SET avatar_url = $1 WHERE id = $2", avatar, id)
// avatar == optional.Some("a.png")  ->  stores 'a.png'
// avatar == optional.None[string]() ->  stores NULL
```

### Text

[`MarshalText`](https://pkg.go.dev/gosalusa.com/optional#Optional.MarshalText) and
[`UnmarshalText`](https://pkg.go.dev/gosalusa.com/optional#Optional.UnmarshalText) implement
[`encoding.TextMarshaler`](https://pkg.go.dev/encoding#TextMarshaler) and
[`encoding.TextUnmarshaler`](https://pkg.go.dev/encoding#TextUnmarshaler). An invalid
`Optional` marshals to empty text, and empty text unmarshals to an invalid
`Optional` rather than to the zero value of `T`.

That is what makes an `Optional` bind cleanly from a missing or blank query
parameter, which is how `request` decodes `query`, `path`, and form fields:

```go
type ListUsersRequest struct {
	AvatarURL optional.Optional[string] `query:"avatar_url"`
	Age       optional.Optional[int]    `query:"age"`
}

// GET /users?age=21      -> Age == optional.Some(21)
// GET /users             -> Age == optional.None[int]()
// GET /users?age=        -> Age == optional.None[int]()
```

Values that implement `encoding.TextMarshaler` use their own text encoding, a
wrapped `string` is used verbatim, and anything else falls back to its JSON
encoding — so a wrapped `time.Time` is written as `2026-09-27T12:00:00Z` while a
wrapped struct is written as JSON, and must be read back as JSON.

### Migrations

Migration generation recognises an `Optional[T]` field through
[`Unwrap`](https://pkg.go.dev/gosalusa.com/optional#Unwrap), which returns the
wrapped type for a `reflect.Type` and reports whether the type is an
`Optional`:

```go
wrapped, ok := optional.Unwrap(reflect.TypeFor[optional.Optional[string]]())
// wrapped == reflect.TypeFor[string](), ok == true
```

The column is then generated as a nullable `T`, so no `nullable` tag is needed
alongside the field type:

```go
type User struct {
	Nickname  string                    `db:"nickname"`
	AvatarURL optional.Optional[string] `db:"avatar_url"`
}
```

The `avatar_url` column above generates as a nullable column, the same output as
an explicit `nullable` tag:

```go
table.String("avatar_url").Nullable()
```

### Mapping

[`Map[U](fn)`](https://pkg.go.dev/gosalusa.com/optional#Optional.Map) applies `fn` to the
wrapped value and returns the result as a valid `Optional[U]`. An invalid
`Optional` comes back invalid and `fn` is never called, so the function does not
have to handle the zero value of `T`:

```go
age := optional.Some(21).Map(func(age int) string {
	return fmt.Sprintf("%d years old", age)
})
// age == optional.Some("21 years old")

missing := optional.Optional[int]{}.Map(func(int) string {
	return "never mapped"
})
// missing == optional.None[string]()
```

Because the wrapped type can change, `Map` is also the way to convert an
`Optional` to a different type in one step:

```go
created := optional.Some(user.CreatedAt).Map(func(t time.Time) string {
	return t.Format("2006-01-02")
})
```

### Lazy fallbacks

[`Or(fn)`](https://pkg.go.dev/gosalusa.com/optional#Optional.Or) resolves a
fallback that is only built when the value is absent. A valid `Optional` is
returned unchanged and `fn` is never called, so an expensive default costs
nothing on the common path:

```go
nickname := user.Nickname.Or(func() optional.Optional[string] {
	return optional.Some(displayNameFor(user))
})
```

This is the `Optional[T]`-shaped counterpart of `OrElse`: `OrElse` takes an
eagerly built value, `Or` takes a function.

### Iteration

[`All()`](https://pkg.go.dev/gosalusa.com/optional#Optional.All) returns an
[`iter.Seq[T]`](https://pkg.go.dev/iter#Seq) over the wrapped value — one value
for a valid `Optional`, nothing for an invalid one:

```go
for name := range user.Nickname.All() {
	fmt.Println(name)
}
```

Because it is a plain iterator sequence, it composes with `range`-over-func
and with the [`stream`](https://pkg.go.dev/gosalusa.com/stream) package
described in [Streams](/docs/streams):

```go
parts := stream.New(user.Nickname.All()).Slice()
// parts is a zero- or one-element slice
```

## Import

```go
import "gosalusa.com/optional"

type User struct {
	AvatarURL optional.Optional[string] `db:"avatar_url"`
}
```
