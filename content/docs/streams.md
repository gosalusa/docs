---
title: Streams
type: docs
prev: docs/queueing
next: docs/logging
weight: 11
---

The [`stream`](https://pkg.go.dev/gosalusa.com/stream) package provides an immutable, lazy sequence abstraction for
building pipelines over slices and iterators. A [`Stream`](https://pkg.go.dev/gosalusa.com/stream#Stream) wraps Go's
`iter.Seq[T]` protocol with a chainable API of intermediate operations that
return new streams, and terminal operations that execute the pipeline.

## Creating a stream

[`Of(slice)`](https://pkg.go.dev/gosalusa.com/stream#Of) builds a stream from a slice, and [`New(seq)`](https://pkg.go.dev/gosalusa.com/stream#New) wraps any `iter.Seq[T]`
iterator such as a generator function:

```go
s := stream.Of([]int{1, 2, 3, 4, 5}).
	Filter(func(i int) bool { return i > 2 }).
	Map(func(i int) string { return "item-" + fmt.Sprint(i) }).
	Slice()
```

`Of` holds a reference to the slice rather than a copy: `Slice` on an
untransformed stream returns the same underlying array, and mutations are
shared.

## Intermediate operations

Each intermediate operation returns a new `Stream` and does no work until a
terminal operation consumes it.

| operation             | effect                                          |
| --------------------- | ----------------------------------------------- |
| [`Filter(fn)`](https://pkg.go.dev/gosalusa.com/stream#Stream.Filter)          | keep only elements for which `fn` is true       |
| [`Map(fn)`](https://pkg.go.dev/gosalusa.com/stream#Stream.Map)             | transform each element with `fn`                |
| [`FlatMap(fn)`](https://pkg.go.dev/gosalusa.com/stream#Stream.FlatMap)         | concatenate the slices returned by `fn`         |
| [`Limit(n)`](https://pkg.go.dev/gosalusa.com/stream#Stream.Limit)            | keep at most the first `n` elements             |
| [`Skip(n)`](https://pkg.go.dev/gosalusa.com/stream#Stream.Skip)             | drop the first `n` elements                     |
| [`Sort(cmp)`](https://pkg.go.dev/gosalusa.com/stream#Stream.Sort)           | sort with a three-way comparison function        |

The pipeline short-circuits: [`Limit`](https://pkg.go.dev/gosalusa.com/stream#Stream.Limit) and [`Find`](https://pkg.go.dev/gosalusa.com/stream#Stream.Find) stop iterating the upstream
sequence as soon as enough elements have been seen. [`Sort`](https://pkg.go.dev/gosalusa.com/stream#Stream.Sort) differs from the
rest — it is eager, consuming and sorting the entire stream when called rather
than when the returned stream is iterated.

```go
names := stream.Of(users).
	Filter(func(u *User) bool { return u.Active }).
	Map(func(u *User) string { return u.Name }).
	Sort(strings.Compare).
	Limit(10).
	Slice()
```

## Terminal operations

| operation       | result                                          |
| --------------- | ----------------------------------------------- |
| [`Slice()`](https://pkg.go.dev/gosalusa.com/stream#Stream.Slice)       | collect the elements into a slice               |
| [`All()`](https://pkg.go.dev/gosalusa.com/stream#Stream.All)         | return the sequence as an `iter.Seq[T]` for a `for range` loop |
| [`Find(fn)`](https://pkg.go.dev/gosalusa.com/stream#Stream.Find)      | the first matching element and whether one was found |
| [`Reduce(fn)`](https://pkg.go.dev/gosalusa.com/stream#Stream.Reduce)    | fold the elements starting from the zero value  |
| [`ReduceFrom(a, fn)`](https://pkg.go.dev/gosalusa.com/stream#Stream.ReduceFrom) | fold the elements starting from accumulator `a` |

```go
total, _ := stream.Of([]int{1, 2, 3, 4, 5}).
	ReduceFrom(0, func(sum, i int) int { return sum + i })

for v := range stream.Of([]string{"a", "b", "c"}).All() {
	// ...
}
```

`Reduce` on an empty stream returns the zero value of the result type;
`ReduceFrom` returns the supplied accumulator untouched.