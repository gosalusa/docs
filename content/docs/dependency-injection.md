---
title: Dependency Injection
type: docs
prev: docs/database/migrations
next: docs/application
weight: 3
---

The `di` package is the core of the Salusa framework. Dependencies are
registered as factories on a `DependencyProvider` and are either resolved
directly with `Resolve` or filled implicitly into structs whose fields carry an
`inject` tag.

## Registering dependencies

Registration happens on a `context.Context`; the context determines which
`DependencyProvider` receives the registration. `TestDependencyProviderContext`
returns a background context carrying a fresh provider, handy in tests and in
`init` in the generated template:

```go
ctx := di.TestDependencyProviderContext()
di.RegisterSingleton(ctx, func() *Config {
	return loadConfig()
})
```

The `Register` family:

| function                                        | behavior                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `Register(ctx, factory)`                        | calls the factory on every resolve                                         |
| `RegisterWith[T, W](ctx, factory)`              | fills a `W` with dependencies, then calls the factory on every resolve     |
| `RegisterSingleton(ctx, factory)`               | builds once at registration time, returns the same value on every resolve  |
| `RegisterLazySingleton(ctx, factory)`           | builds at most once, on the first resolve                                  |
| `RegisterLazySingletonWith[T, W](ctx, factory)` | fills a `W` with dependencies, then builds at most once                    |
| `RegisterValue(ctx, t, factory)`                | registers a factory for a type known only dynamically (`reflect.Type`)     |

`NewDependencyProvider()` creates an independent provider that can resolve
itself and the surrounding `context.Context`. Registering the same type twice
replaces the previous factory.

## Resolving dependencies

`Resolve[T]` builds a value of type `T` from the provider carried by `ctx`:

```go
cfg, err := di.Resolve[*Config](ctx)
```

If `T` is a fillable struct, its `inject` fields are filled recursively instead
of being built by a factory.

## Filling structs

A struct whose fields carry an `inject` tag can be filled with `Fill`. The first
tag value names the dependency and is passed to the factory, which lets one
factory serve dependencies of the same type under different names. The remaining
values are flags; `optional` leaves the field as its zero value when the
dependency is not registered:

```go
type handler struct {
	Config *Config `inject:""`
	DB     *sql.DB `inject:"db,optional"`
	Cache  *redis.Client
}

filled, err := di.Fill(ctx, &handler{})
```

Fields without an `inject` tag are left untouched. A dependency that is not
registered and is not `optional` produces an error wrapping
`di.ErrNotRegistered`.

## Dependency-aware factories

`RegisterWith` and `RegisterLazySingletonWith` pass a filled struct to the
factory, so a dependency can declare what it needs without resolving anything
itself:

```go
type mailerDeps struct {
	Config *Config   `inject:""`
	Logger *slog.Logger `inject:""`
}

di.RegisterLazySingletonWith(ctx, func(deps mailerDeps) (*Mailer, error) {
	return NewMailer(deps.Config, deps.Logger)
})
```

## Wrapping functions

`PrepareFunc` turns a function whose extra parameters are dependencies into a
function with a fixed signature. `PrepareFuncCtx` is the same, resolving the
extra parameters from the provider carried by the context passed at call
time:

```go
func send(ctx context.Context, user *User) error { ... }

sendUser := di.PrepareFuncCtx[func(ctx context.Context, user *User) error](send)
```

If filling the extra parameters fails and the wrapped function does not return
an error, the call panics.

## Validation

`DependencyProvider.Validate` checks the registered factories for missing
dependencies and dependency cycles. `Validator` returns a `DIValidator` for a
root type that verifies every `inject` field has a registered factory:

```go
err := dp.Validate(ctx)
```

The kernel calls this on startup so a misconfigured provider fails fast.