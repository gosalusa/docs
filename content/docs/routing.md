---
title: Routing
type: docs
prev: docs/application
next: docs/requests
weight: 5
---

The `router` package provides a wrapper around gorilla/mux with Salusa
middleware, named routes, URL generation, and OpenAPI support. Routes are
registered in the generated app's `routes/routes.go` and wired into the kernel
with `kernel.InitRoutes`.

## Defining routes

`Get`, `Post`, `Put`, `Patch`, and `Delete` register a route for a method; the
`*Func` variants take an `http.HandlerFunc`. `Handle` registers a path prefix
that matches any method. Path parameters use the gorilla/mux `{name}` syntax:

```go
func InitRoutes(r *router.Router) {
	r.Get("/", view.View("index.html", nil)).Name("home")
	r.Get("/user/{id}", handlers.UserGet)
	r.Post("/user", handlers.UserCreate)

	r.Handle("/docs", openapidoc.SwaggerUI())
}
```

Each registering method returns a `*Route`:

- `Name(name)` gives the route a name that the URL resolver can target.
- `Middleware(m)` wraps just that route with a middleware.

## Groups

`Group(prefix, cb)` creates a subrouter for a path prefix. Routes registered
inside the callback inherit the middleware from the parent router:

```go
r.Group("/api", func(r *router.Router) {
	auth.RegisterRoutes(r, auth.NewBasicAuthController[*models.User](...))
	r.Get("/user", handlers.UserList)
})
```

## Middleware

Middleware wraps a handler and is applied with `Use`, or per-route with
`Route.Middleware`. A `Middleware` implements `Middleware(next) http.Handler`,
and `MiddlewareFunc` adapts a plain function:

```go
r.Use(request.HandleErrors())
r.Use(auth.AttachUser())
```

`InlineMiddlewareFunc` is a variant that receives the response writer, request,
and next handler together. Middleware can also implement
`openapidoc.OperationMiddleware` to decorate generated API operations.

## URL generation

Inside a handler the `URLResolver` dependency generates URLs from route names or
handlers. During bootstrap `r.Register(ctx)` registers a resolver that builds
URLs from the config's base URL (or the current request's origin), substituting
`{param}` placeholders with the values passed and encoding anything left over as
query parameters:

```go
url := urlResolver.Resolve("user.show", "id", 42)
url := urlResolver.ResolveHandler(handlers.UserGet, "id", &models.User{ID: 42})
```

Parameters are key/value pairs. After the key, a model contributes the value of
its primary key, and numbers and `fmt.Stringer`s are formatted as strings.
`ToAttrs` converts the raw parameter list. `NewTestResolver` returns a resolver
for tests that encodes everything as a query string.

## OpenAPI paths

`Router` implements `openapidoc.Pathser`. `Paths` builds a swagger spec from
the registered routes whose handlers implement `openapidoc.Operationer`,
applying any `OperationMiddleware` from the route's middleware chain. The route
name becomes the operation ID when none is set.

## Utilities

`Routes()` returns every registered route, `PrintRoutes` prints them as a
table, and `Validate` runs the `validate.Validator` interface against each
route's handler so the kernel can catch missing dependencies at startup.