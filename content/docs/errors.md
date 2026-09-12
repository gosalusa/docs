---
title: Errors & Stack Traces
type: docs
prev: docs/environment
next: docs/nullable
weight: 16
---

The `errors` package builds errors that capture a stack trace at the point they
are created, so logged failures carry their origin sites without manual
annotation.

## Stack-capturing errors

`errors.New(message)` returns an error that records `debug.Stack()` at creation
time; `errors.WithStack(err)` wraps an existing error the same way while
supporting `Unwrap`:

```go
if err != nil {
	return errors.WithStack(err)
}

return errors.New("missing user")
```

Both implement `Stacker`:

```go
type Stacker interface {
	Stack() []byte
}
```

A logger can render the stack for those errors and skip it for others. This is
how the request package's `HandleErrors` surfaces request-time failures.

## Sentinel errors

`SentinelError(string)` is a string-backed error value for defining package
level sentinels that work with `errors.Is`:

```go
var ErrNotFound = errors.SentinelError("not found")

if record == nil {
	return ErrNotFound
}
```

## Standard library compatibility

`Is`, `As`, `Join`, and `Unwrap` re-export the matching functions from the
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