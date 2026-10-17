---
title: Option Values
type: docs
prev: docs/errors
next: docs/collections
weight: 17
---

The [`option`](https://pkg.go.dev/gosalusa.com/option) package models values that can be absent — a typed alternative to
raw pointers and to the single field types in `database/sql`.

## option.Option[T]

[`option.Option[T]`](https://pkg.go.dev/gosalusa.com/option#Option) wraps any type `T` with a validity flag and
interoperates with JSON, `database/sql`, and `database/sql/driver`:

```go
type Option[T any] struct {
	// has unexported fields
}
```

The wrapped value is private, so an `Option` is built and read through the
package's functions and methods rather than through its fields.

The zero value is already an invalid `Option`, so a struct field needs no
initialization to mean "absent". Build a valid one with
[`Some(v)`](https://pkg.go.dev/gosalusa.com/option#Some), or an explicitly empty
one with [`None[T]()`](https://pkg.go.dev/gosalusa.com/option#None):

```go
avatar := option.Some("https://example.com/a.png")
missing := option.None[string]()
// equivalent to
missing := option.Option[string]{}
```

`Some` marks the value present even when what it is given is the zero value of
its own type: `option.Some(0)` and `option.Some("")` are both valid, not
absent. Only the zero value of `Option` itself — or a JSON `null` on the way
in — means absent.

Read the wrapped value with [`OrElse(fallback)`](https://pkg.go.dev/gosalusa.com/option#Option.OrElse), which returns the
value when it is valid and the fallback when it is not:

```go
name := option.Some("Salusa").OrElse("unknown") // "Salusa"
age := option.Option[int]{}.OrElse(0)         // 0
```

[`Valid()`](https://pkg.go.dev/gosalusa.com/option#Option.Valid) reports
whether the value is present, which is what you branch on when the valid and
absent cases need different code:

```go
if avatar.Valid() {
	// ...
}
```

[`Ok()`](https://pkg.go.dev/gosalusa.com/option#Option.Ok) returns the
wrapped value and a bool in one step, for when you need both without a branch:

```go
avatar, ok := user.AvatarURL.Ok()
if !ok {
	return errors.New("avatar is required")
}
saveAvatar(user, avatar)
```

### JSON

An invalid `Option` marshals to `null`, and a JSON `null` unmarshals to an
invalid instance holding the zero value of `T`. Anything else marshals and
unmarshals as the wrapped type, so time values, slices, pointers, and structs
all round-trip without a custom `MarshalJSON`:

```go
type User struct {
	ID        int64                 `db:"id"`
	AvatarURL option.Option[string] `db:"avatar_url"`
}
```

```go
// option.None[string]() marshals to: null
// option.Some("a.png")  marshals to: "a.png"
```

A JSON decoding error leaves the value valid and the wrapped value partially
decoded, so an `Option` reused across decodes should be reset to its zero
value first.

### SQL

Through `database/sql`, `Scan(nil)` clears the value and marks it invalid, and
`Value()` produces `nil` for an invalid instance. Nullable columns therefore
round-trip through a model with no special handling on either side.

`Option[T]` implements the interfaces on both the value and the pointer,
matching what the standard library does for `sql.Null[T]`:

```go
var _ json.Marshaler = Option[int]{}    // value
var _ json.Unmarshaler = (*Option[int])(nil)
var _ sql.Scanner = (*Option[int])(nil) // pointer: database/sql takes the address of a field
var _ driver.Valuer = Option[int]{}     // value: usable directly as a query argument
```

Because `Value()` is on the value type, an `Option` can be handed to
`database/sql` as an argument with no pointer and no unwrapping — an invalid one
becomes SQL `NULL`:

```go
db.ExecContext(ctx, "UPDATE users SET avatar_url = $1 WHERE id = $2", avatar, id)
// avatar == option.Some("a.png")  ->  stores 'a.png'
// avatar == option.None[string]() ->  stores NULL
```

### Text

[`MarshalText`](https://pkg.go.dev/gosalusa.com/option#Option.MarshalText) and
[`UnmarshalText`](https://pkg.go.dev/gosalusa.com/option#Option.UnmarshalText) implement
[`encoding.TextMarshaler`](https://pkg.go.dev/encoding#TextMarshaler) and
[`encoding.TextUnmarshaler`](https://pkg.go.dev/encoding#TextUnmarshaler). An invalid
`Option` marshals to empty text, and empty text unmarshals to an invalid
`Option` rather than to the zero value of `T`.

That is what makes an `Option` bind cleanly from a missing or blank query
parameter, which is how `request` decodes `query`, `path`, and form fields:

```go
type ListUsersRequest struct {
	AvatarURL option.Option[string] `query:"avatar_url"`
	Age       option.Option[int]    `query:"age"`
}

// GET /users?age=21      -> Age == option.Some(21)
// GET /users             -> Age == option.None[int]()
// GET /users?age=        -> Age == option.None[int]()
```

Values that implement `encoding.TextMarshaler` use their own text encoding, a
wrapped `string` is used verbatim, and anything else falls back to its JSON
encoding — so a wrapped `time.Time` is written as `2026-09-27T12:00:00Z` while a
wrapped struct is written as JSON, and must be read back as JSON.

### Migrations

Migration generation recognises an `Option[T]` field through
[`Unwrap`](https://pkg.go.dev/gosalusa.com/option#Unwrap), which returns the
wrapped type for a `reflect.Type` and reports whether the type is an
`Option`:

```go
wrapped, ok := option.Unwrap(reflect.TypeFor[option.Option[string]]())
// wrapped == reflect.TypeFor[string](), ok == true
```

The column is then generated as a nullable `T`, so no `nullable` tag is needed
alongside the field type:

```go
type User struct {
	Nickname  string                `db:"nickname"`
	AvatarURL option.Option[string] `db:"avatar_url"`
}
```

The `avatar_url` column above generates as a nullable column, the same output as
an explicit `nullable` tag:

```go
table.String("avatar_url").Nullable()
```

### Mapping

[`Map[U](fn)`](https://pkg.go.dev/gosalusa.com/option#Option.Map) applies `fn` to the
wrapped value and returns the result as a valid `Option[U]`. An invalid
`Option` comes back invalid and `fn` is never called, so the function does not
have to handle the zero value of `T`:

```go
age := option.Some(21).Map(func(age int) string {
	return fmt.Sprintf("%d years old", age)
})
// age == option.Some("21 years old")

missing := option.Option[int]{}.Map(func(int) string {
	return "never mapped"
})
// missing == option.None[string]()
```

Because the wrapped type can change, `Map` is also the way to convert an
`Option` to a different type in one step:

```go
created := option.Some(user.CreatedAt).Map(func(t time.Time) string {
	return t.Format("2006-01-02")
})
```

[`FlatMap[U](fn)`](https://pkg.go.dev/gosalusa.com/option#Option.FlatMap) is
`Map` for a function that itself returns an `Option`, so the result is not
wrapped a second time. An invalid `Option` comes back invalid and `fn` is never
called:

```go
nickname := option.Some(userID).FlatMap(func(id int64) option.Option[string] {
	return lookupNickname(id)
})
// nickname is the Option returned by lookupNickname, not Option[Option[string]]
```

### Lazy fallbacks

[`Or(fn)`](https://pkg.go.dev/gosalusa.com/option#Option.Or) resolves a
fallback that is only built when the value is absent. A valid `Option` is
returned unchanged and `fn` is never called, so an expensive default costs
nothing on the common path:

```go
nickname := user.Nickname.Or(func() option.Option[string] {
	return option.Some(displayNameFor(user))
})
```

This is the `Option[T]`-shaped counterpart of `OrElse`: `OrElse` takes an
eagerly built value, `Or` takes a function.

### Iteration

[`All()`](https://pkg.go.dev/gosalusa.com/option#Option.All) returns an
[`iter.Seq[T]`](https://pkg.go.dev/iter#Seq) over the wrapped value — one value
for a valid `Option`, nothing for an invalid one:

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
import "gosalusa.com/option"

type User struct {
	AvatarURL option.Option[string] `db:"avatar_url"`
}
```
