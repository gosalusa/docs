---
title: JSON I/O
type: docs
prev: docs/collections
next: docs/openapi
weight: 19
---

The `jsonio` package exposes a value as an `io.Reader` (`JsonReader`) or an
`io.Writer` (`JsonWriter`) by marshaling/unmarshaling it over an `io.Pipe`.
This is useful when an API wants to speak in terms of `io.Reader`/`io.Writer`
but the payload is a typed Go value.

## Reading through a JsonReader

`NewReader(v)` wraps `io.Pipe()` and encodes `v` into the pipe in the
background. The returned `*JsonReader` is an `io.Reader` that yields the JSON
encoding of `v`:

```go
r := jsonio.NewReader(order)
resp, err := http.Post("https://example.com/orders", "application/json", r)
```

An encoding failure is delivered as a read error, so the consumer observes it
at `io.ReadAll` or upload time rather than at construction.

## Writing through a JsonWriter

`NewWriter(v)` returns an `io.Writer`. Anything written to it is JSON-decoded
into the destination `v` when the writer is closed; decodes happen incrementally
as bytes arrive:

```go
var got userCreateRequest
w := jsonio.NewWriter(&got)

resp := httptest.NewRequest("POST", "/users", w)

w.Close()       // flush and finish decoding into got
```

This keeps handlers that accept streaming uploads usable for JSON requests
without buffering the whole body in memory yourself.