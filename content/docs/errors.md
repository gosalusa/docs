---
title: Errors & Stack Traces
type: docs
prev: docs/email
next: docs/nullable
weight: 16
---

The [`errors`](https://pkg.go.dev/gosalusa.com/errors) package builds errors that capture a stack trace at the point they
are created, so logged failures carry their origin sites without manual
annotation.

## Stack-capturing errors

[`errors.New(message)`](https://pkg.go.dev/gosalusa.com/errors#New) returns an error that records `debug.Stack()` at creation
time; [`errors.WithStack(err)`](https://pkg.go.dev/gosalusa.com/errors#WithStack) wraps an existing error the same way while
supporting `Unwrap`:

```go
if err != nil {
	return errors.WithStack(err)
}

return errors.New("missing user")
```

Both implement [`Stacker`](https://pkg.go.dev/gosalusa.com/errors#Stacker):

```go
type Stacker interface {
	Stack() []byte
}
```

A logger can render the stack for those errors and skip it for others. This is
how the request package's `HandleErrors` surfaces request-time failures.

## Sentinel errors

[`SentinelError(string)`](https://pkg.go.dev/gosalusa.com/errors#SentinelError) is a string-backed error value for defining package
level sentinels that work with `errors.Is`:

```go
var ErrNotFound = errors.SentinelError("not found")

if record == nil {
	return ErrNotFound
}
```

## Standard library compatibility

[`Is`](https://pkg.go.dev/gosalusa.com/errors#Is), [`As`](https://pkg.go.dev/gosalusa.com/errors#As), [`Join`](https://pkg.go.dev/gosalusa.com/errors#Join), and [`Unwrap`](https://pkg.go.dev/gosalusa.com/errors#Unwrap) re-export the matching functions from the
standard library, so code depending on the framework package can use one import
for both rich and plain errors:

```go
if errors.Is(err, ErrNotFound) {
	// ...
}

var target *MyErr
if errors.As(err, &target) {
	// ...
}
```