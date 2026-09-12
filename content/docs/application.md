---
title: Application & Kernel
type: docs
prev: docs/dependency-injection
next: docs/routing
weight: 4
---

The `kernel` package wires everything together: it builds the root HTTP handler,
runs long-lived services, registers the config as a dependency, and validates
the dependency graph at startup. A `Kernel` is created with functional options
in the generated `app/kernel.go` file and bootstrapped and run from `main.go`.

## Building a kernel

```go
var Kernel = kernel.New(
	kernel.Config(config.Load),
	kernel.Bootstrap(
		providers.Register,
		kernel.Register(func(ctx context.Context, c *config.Config) {
			database.Register(ctx, c.Database, migrations.Use())
			email.Register(ctx, c.Mail)
		}),
	),
	kernel.Services(
		event.Service(event.NewListener[*jobs.LogJob]()),
	),
	kernel.InitRoutes(routes.InitRoutes),
	kernel.APIDocumentation(
		openapidoc.Info(spec.InfoProps{Title: "Example API"}),
	),
)
```

The `KernelOption` functions:

| option                | purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `Config(cb)`          | build the config, register it as a `salusaconfig.Config` and as itself |
| `Bootstrap(...steps)` | run one-time startup steps, or `kernel.Register` to register DI providers with the resolved config |
| `Services(...)`       | start long-running background services with `Run` and `StartServices` |
| `InitRoutes(cb)`      | build the root handler from a `router.Router`                  |
| `RootHandler(f)`      | supply the root handler directly                               |
| `Middleware(ms)`      | add global middleware applied to every request                 |
| `APIDocumentation(...)` | seed the OpenAPI spec                                       |
| `FetchAuth(cb)`       | authenticate requests made with `spice dev --fetch`            |

## Services

A `Service` runs continuously until it returns `nil`:

```go
type Service interface {
	Run(ctx context.Context) error
	Name() string
}
```

`StartServices` runs each service in its own goroutine and fills its `inject`
fields from the dependency provider before the first run. A service that returns
an error is restarted if it implements `Restarter` (`Restart()` method). The
`ServiceFunc` and `ServiceFuncRestart` adapters turn plain functions into
services.

## Bootstrap

`Bootstrap(ctx)` builds the root handler, registers every service and the kernel
itself as dependencies, runs each bootstrap step in order, and marks the kernel
bootstrapped. Calling it twice returns `ErrAlreadyBootstrapped`.

`registerConfig` runs during bootstrap. `kernel.Register` resolves the config of
the given type and passes it to a callback, which is how the generated template
registers the database, email, auth, and other providers:

```go
kernel.Register(func(ctx context.Context, c *config.Config) {
	database.Register(ctx, c.Database, migrations.Use())
})
```

## Running

After `Bootstrap`, `main.go` calls `Run`, which parses command-line flags, runs
validation, starts the services, and serves HTTP:

```go
func main() {
	ctx := di.ContextWithDependencyProvider(
		context.Background(),
		di.NewDependencyProvider(),
	)

	err := app.Kernel.Bootstrap(ctx)
	if err != nil {
		clog.Use(ctx).Error("error bootstrapping", "error", err)
		os.Exit(1)
	}

	err = app.Kernel.Run(ctx)
	if err != nil {
		clog.Use(ctx).Error("error running", "error", err)
		os.Exit(1)
	}
}
```

`Run` supports flags parsed by pflag: `--validate` validates the dependency
provider and exits, `--fetch` runs a single request and prints the response to
stdout, and `-m`, `-h`, `-b`, and `-u` set the method, headers, body, and
username for the fetch. `HttpServer` returns the configured `http.Server`,
registered as a singleton dependency.

On shutdown the kernel closes every built singleton that implements
`io.Closer`.

## The generated app layout

`spice init` creates a project from the `static` template with this layout:

```
root
├ app
│ ├ events      # events the application can emit
│ ├ handlers    # http handlers
│ ├ jobs        # event listeners / queue jobs
│ ├ kernel.go   # the Kernel definition
│ ├ models      # database models
│ └ providers   # custom DI providers
├ config        # the Config struct and its loader
├ migrations    # generated migrations
├ resources     # views and static assets
└ routes        # route definitions
```

Providers follow a simple pattern: an `Add` function appends a registrar, and
`Register` runs them all during bootstrap so `init` wiring stays centralized.

## Configuration

The config type passed to `Config` must implement `salusaconfig.Config`, which
requires `GetHTTPPort() int` and `GetBaseURL() string`. The default template
config reads a `.env` file and builds sub-configs for the database, mail, and
file system. `Kernel.Config()` returns the config, and it is also resolvable as
a dependency by injecting `salusaconfig.Config` or the concrete type.