---
title: Configuration & Environment
type: docs
prev: docs/files
next: docs/errors
weight: 15
---

The `env` package reads typed values from environment variables, and
`salusaconfig` defines the minimal two-method interface the kernel requires
from your application config.

## Reading environment variables

Each helper takes a key and a default value, and returns the default when the
variable is unset or cannot be parsed:

| function            | returns          |
| ------------------- | ---------------- |
| `env.String`        | raw string value |
| `env.Bool`          | true/false from `true`, `1` (case-insensitive) |
| `env.Int`           | parsed integer   |
| `env.Float64`       | parsed float     |
| `env.Float32`       | parsed float32   |

Parsing failures log a warning through `slog` and fall back to the default:

```go
type Config struct {
	Port int
}

func NewConfig() *Config {
	return &Config{
		Port: env.Int("HTTP_PORT", 8080),
	}
}
```

## The salusaconfig interface

The kernel's `Config` and `kerneltest.New` accept any type implementing
`salusaconfig.Config`:

```go
type Config interface {
	GetHTTPPort() int
	GetBaseURL() string
}
```

The generated `config.Config` satisfies it:

```go
func (c *Config) GetHTTPPort() int {
	return c.ServerPort
}

func (c *Config) GetBaseURL() string {
	return c.BaseURL
}
```

`GetHTTPPort` is the port the HTTP server listens on, and `GetBaseURL` is the
fully-qualified base URL used by the router's `URLResolver` when generating
absolute URLs in views. Only these two methods are required; everything else on
your config type is free-form and consumed by your own packages.