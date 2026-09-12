---
title: Logging
type: docs
prev: docs/streams
next: docs/email
weight: 12
---

The `clog` package wires `log/slog` into Salusa. It registers the logger as a
DI dependency, attaches request-scoped attributes to a context, and picks a
handler: human-friendly colored output on a terminal, text output otherwise,
or any custom `slog.Handler`.

## Registering a logger

`RegisterDefault(ctx)` is called during kernel bootstrap in the generated
template. It builds a lazy singleton `RootLogger` at `Info` level and registers
`*slog.Logger` as a dependency:

```go
kernel.Register(func(ctx context.Context, c *config.Config) {
	clog.RegisterDefault(ctx)
})
```

For a custom setup, `Register(ctx, cfg)` builds the handler from a `Config` (a
type with `Handler() (slog.Handler, error)`), and `RegisterWith(ctx, h)` takes
a `slog.Handler` directly. `DefaultConfig` wraps a `slog.Level` so the level
can come from the environment:

```go
clog.Register(ctx, clog.NewDefaultConfig(level))
```

`DefaultHandler(level)` returns a tint handler with error-aware rendering when
stderr is a TTY and a plain text handler otherwise.

## Using the logger

The `*slog.Logger` is an ordinary injectable dependency, and `clog.Use(ctx)`
resolves it (falling back to `slog.Default` if none is registered):

```go
type Handler struct {
	Logger *slog.Logger `inject:""`
}

func (h *Handler) Handle(ctx context.Context) {
	h.Logger.Info("processing order", slog.Int("id", 42))
}
```

The kernel resolves the logger through `clog.Use` for its own startup and
shutdown messages, and `clog.RegisterDefault` also sets it as the global
`log/slog` default so anything using `slog.Default()` participates.

## Context attributes

`clog.With(ctx, attrs...)` returns a context that adds the attributes to any
logger resolved from it. Attributes accumulate:

```go
ctx := clog.With(r.Context(), slog.String("request_id", reqID))
ctx = clog.With(ctx, slog.String("user_id", userID))

logger := clog.Use(ctx)  // carries both attributes
```

The kernel uses this to tag service logs (`logger.With("service", name)` via
`StartServices`), so every log line from a background service identifies its
source.

## Sending logs to Loki

The `clog/loki` subpackage provides a `Config` that sends logs to a Grafana
Loki endpoint through `slogloki`:

```go
clog.Register(ctx, &loki.Config{
	Level:    slog.LevelInfo,
	URL:      "http://loki:3100/loki/api/v1/push",
	TenantID: "my-app",
})
```