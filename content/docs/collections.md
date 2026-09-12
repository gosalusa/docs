---
title: Maps & Sets
type: docs
prev: docs/nullable
next: docs/json-io
weight: 18
---

The `extra/maps` and `extra/sets` packages provide typed, `iter`-compatible
collection types.

## maps

`maps.Map[K, V]` is a small interface around set/get/remove plus `All()` for
iteration:

```go
type Map[K comparable, V any] interface {
	Set(key K, value V)
	Get(key K) (V, bool)
	Remove(key K)
	All() iter.Seq2[K, V]
}
```

`Sync[K, V]` implements it on top of `sync.Map` and adds the atomic operations
`Load`, `Store`, `LoadOrStore`, `LoadAndDelete`, `Swap`, `CompareAndSwap`,
`CompareAndDelete`, `Range`, and `Clear`. It is safe for concurrent use, which
makes it the natural store for caches shared across services:

```go
cache := &maps.Sync[string, *Order]{}

cache.Set(id, order)
if cached, ok := cache.Get(id); ok {
	// ...
}
```

## sets

`sets.Set[T]` is an interface implemented by three distinct structures:

```go
type Set[T comparable] interface {
	Add(v ...T)
	Delete(v ...T)
	Has(v T) bool
	Len() int
	All() iter.Seq[T]
	Clone() Set[T]
}
```

| type           | storage      | ordering   | lookup      |
| -------------- | ------------ | ---------- | ----------- |
| `MapSet`       | `map[T]struct{}` | unordered | hash       |
| `OrderedSet`   | slice        | insertion  | linear scan |
| `SliceSet`     | sorted slice | sorted     | binary search |

`New[T](values...)` returns the default `MapSet`. `NewOrderedSet` preserves
insertion order and is backed by a slice; `NewSliceSet` keeps elements sorted
(requiring `T cmp.Ordered`) and searches with `slices.BinarySearch`. All three
support two-index `Get(i)`.

```go
seen := sets.NewOrderedSet("parse", "build", "deploy")
seen.Add("test")

for step := range seen.All() {
	// step is visited in insertion order
}
```

Choose `MapSet` for membership tests on large workloads, `OrderedSet` when
iteration order matters, and `SliceSet` when you also need efficient `Get` by
index.