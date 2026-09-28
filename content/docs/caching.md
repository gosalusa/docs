---
title: Caching
type: docs
prev: docs/collections
next: docs/json-io
weight: 19
---

The [`cache`](https://pkg.go.dev/gosalusa.com/cache) package provides a small, byte-oriented cache
abstraction for values that are expensive to recompute — rendered templates,
serialized API payloads, or the result of an expensive query. The shipped
implementation is an in-process map; the interface is the extension point for a
shared cache such as memcached or Redis.

## MemoryCache

[`MemoryCache`](https://pkg.go.dev/gosalusa.com/cache#MemoryCache) is the interface every implementation
satisfies:

```go
type MemoryCache interface {
	Get(key string, defaultValue []byte) ([]byte, error)
	GetOrCreate(key string, factory func() []byte) ([]byte, error)
	Set(key string, value []byte, options *SetOptions) error
	Remove(key string) error
}
```

The cache stores `[]byte`, so structured values are encoded and decoded by the
caller. Keys are plain strings, and there is no namespacing or tagging built
in, so include anything that distinguishes tenants or entity types in the key
yourself.

| method                                    | behavior                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| [`Get(key, defaultValue)`](https://pkg.go.dev/gosalusa.com/cache#MemoryCache.Get)     | returns the cached bytes, or `defaultValue` on a miss; a miss is **not** cached |
| [`GetOrCreate(key, factory)`](https://pkg.go.dev/gosalusa.com/cache#MemoryCache.GetOrCreate) | returns the cached bytes, or calls `factory` on a miss and caches the result |
| [`Set(key, value, options)`](https://pkg.go.dev/gosalusa.com/cache#MemoryCache.Set)   | stores bytes under `key`                                                        |
| [`Remove(key)`](https://pkg.go.dev/gosalusa.com/cache#MemoryCache.Remove)             | deletes `key`; removing a key that is not present is not an error                |

The distinction between `Get` and `GetOrCreate` is the important one. `Get`
is a pure read — it never writes — so it suits a fallback you already have in
hand, such as a default or a value fetched from the database. `GetOrCreate`
memoizes: it invokes `factory` only on a miss and stores what the factory
returns.

```go
// Read-through: falls back to a value we already have, without caching the miss.
cached, err := c.Get(key, renderDefault())
if err != nil {
	return err
}

// Memoize: the expensive work only happens on a miss.
body, err := c.GetOrCreate(key, func() []byte {
	return renderExpensiveReport(id)
})
```

`SetOptions` is currently an empty struct, a placeholder for per-write options
such as a custom expiration. Callers must pass a `*SetOptions` — `nil` is
accepted by the current implementations — so prefer `&cache.SetOptions{}` for
forward compatibility.

## MapCache

[`MapCache`](https://pkg.go.dev/gosalusa.com/cache#MapCache) is the in-process implementation. It is safe
for concurrent use, and [`NewMapCache()`](https://pkg.go.dev/gosalusa.com/cache#NewMapCache) constructs one
with a five-minute TTL:

```go
c := cache.NewMapCache()
```

Each entry is a [`MapCacheItem`](https://pkg.go.dev/gosalusa.com/cache#MapCacheItem) holding the bytes and an
absolute expiration time. Expiration is evaluated lazily: an expired entry is
dropped the next time its key is read, not by a background sweeper. Two
consequences follow. A key that is written and then never read again holds onto
its bytes indefinitely, so caches holding many distinct keys should have their
lifetimes bounded by the process. And because expiry is only noticed on access,
`Get` and `GetOrCreate` can both return a miss for a key that is present but
stale, and will then rebuild or re-store it.

The TTL is fixed at construction and is not currently adjustable through the
public API; to use a different one, register your own `MemoryCache` rather than
constructing a `MapCache`.

## Registering the cache

[`cache.Register(ctx)`](https://pkg.go.dev/gosalusa.com/cache#Register) is a bootstrap step that registers a
`MemoryCache` as a lazy singleton, so every resolve in the process shares one
instance:

```go
kernel.Register(func(ctx context.Context, c *config.Config) {
	cache.Register(ctx)
})
```

From then on any struct can inject the interface and get the shared cache:

```go
type ReportHandler struct {
	Cache  cache.MemoryCache `inject:""`
	Logger *slog.Logger      `inject:""`
}
```

Inject the `MemoryCache` interface rather than `*MapCache` — that is what allows
a different implementation to be registered in its place.

## Using a shared cache

To back the interface with a network cache, implement `MemoryCache` over that
client and register it in place of the built-in one:

```go
type redisCache struct {
	client *redis.Client
	ttl    time.Duration
}

func (c *redisCache) Get(key string, defaultValue []byte) ([]byte, error) {
	b, err := c.client.Get(context.Background(), key).Bytes()
	if errors.Is(err, redis.Nil) {
		return defaultValue, nil
	}
	return b, err
}

// GetOrCreate, Set, and Remove follow the same contract.

di.RegisterLazySingleton(ctx, func() (cache.MemoryCache, error) {
	return &redisCache{client: client, ttl: 5 * time.Minute}, nil
})
```

Two things to keep in mind when moving off the in-process map. A shared cache
is network-visible, so keys and values must not carry data that is sensitive
per-user without being scoped in the key. And a distributed cache loses the
in-process guarantee that a read and a subsequent write are ordered, so
[`GetOrCreate`](https://pkg.go.dev/gosalusa.com/cache#MemoryCache.GetOrCreate) is a
cache stampede risk: several callers can miss at once and run `factory`
concurrently. The in-process `MapCache` has the same race, so the factory should
be cheap or the caller should coalesce the work.
