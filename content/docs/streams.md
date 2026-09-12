---
title: Streams
type: docs
prev: docs/queueing
next: docs/logging
weight: 11
---

The `stream` package provides an immutable, lazy sequence abstraction for
building pipelines over slices and iterators. A `Stream` wraps Go's
`iter.Seq[T]` protocol with a chainable API of intermediate operations that
return new streams, and terminal operations that execute the pipeline.

## Creating a stream

`Of(slice)` builds a stream from a slice, and `New(seq)` wraps any `iter.Seq[T]`
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
| `Filter(fn)`          | keep only elements for which `fn` is true       |
| `Map(fn)`             | transform each element with `fn`                |
| `FlatMap(fn)`         | concatenate the slices returned by `fn`         |
| `Limit(n)`            | keep at most the first `n` elements             |
| `Skip(n)`             | drop the first `n` elements                     |
| `Sort(cmp)`           | sort with a three-way comparison function        |

The pipeline short-circuits: `Limit` and `Find` stop iterating the upstream
sequence as soon as enough elements have been seen. `Sort` differs from the
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
| `Slice()`       | collect the elements into a slice               |
| `All()`         | return the sequence as an `iter.Seq[T]` for a `for range` loop |
| `Find(fn)`      | the first matching element and whether one was found |
| `Reduce(fn)`    | fold the elements starting from the zero value  |
| `ReduceFrom(a, fn)` | fold the elements starting from accumulator `a` |

```go
total, _ := stream.Of([]int{1, 2, 3, 4, 5}).
	ReduceFrom(0, func(sum, i int) int { return sum + i })

for v := range stream.Of([]string{"a", "b", "c"}).All() {
	// ...
}
```

`Reduce` on an empty stream returns the zero value of the result type;
`ReduceFrom` returns the supplied accumulator untouched.