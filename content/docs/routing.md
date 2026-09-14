---
title: Routing
type: docs
prev: docs/environment
next: docs/requests
weight: 6
---

The [`router`](https://pkg.go.dev/gosalusa.com/router) package provides a wrapper around gorilla/mux with Salusa
middleware, named routes, URL generation, and OpenAPI support. Routes are
registered in the generated app's `routes/routes.go` and wired into the kernel
with [`kernel.InitRoutes`](https://pkg.go.dev/gosalusa.com/kernel#InitRoutes).

## Defining routes

[`Get`](https://pkg.go.dev/gosalusa.com/router#Router.Get), [`Post`](https://pkg.go.dev/gosalusa.com/router#Router.Post), [`Put`](https://pkg.go.dev/gosalusa.com/router#Router.Put), [`Patch`](https://pkg.go.dev/gosalusa.com/router#Router.Patch), and [`Delete`](https://pkg.go.dev/gosalusa.com/router#Router.Delete) register a route for a method; the
`*Func` variants take an `http.HandlerFunc`. [`Handle`](https://pkg.go.dev/gosalusa.com/router#Router.Handle) registers a path prefix
that matches any method. Path parameters use the gorilla/mux `{name}` syntax:

```go
func InitRoutes(r *router.Router) {
	r.Get("/", view.View("index.html", nil)).Name("home")
	r.Get("/user/{id}", handlers.UserGet)
	r.Post("/user", handlers.UserCreate)

	r.Handle("/docs", openapidoc.SwaggerUI())
}
```

Each registering method returns a [`*Route`](https://pkg.go.dev/gosalusa.com/router#Route):

- [`Name(name)`](https://pkg.go.dev/gosalusa.com/router#Route.Name) gives the route a name that the URL resolver can target.
- [`Middleware(m)`](https://pkg.go.dev/gosalusa.com/router#Route.Middleware) wraps just that route with a middleware.

## Groups

[`Group(prefix, cb)`](https://pkg.go.dev/gosalusa.com/router#Router.Group) creates a subrouter for a path prefix. Routes registered
inside the callback inherit the middleware from the parent router:

```go
r.Group("/api", func(r *router.Router) {
	auth.RegisterRoutes(r, auth.NewBasicAuthController[*models.User](...))
	r.Get("/user", handlers.UserList)
})
```

## Middleware

Middleware wraps a handler and is applied with [`Use`](https://pkg.go.dev/gosalusa.com/router#Router.Use), or per-route with
`Route.Middleware`. A [`Middleware`](https://pkg.go.dev/gosalusa.com/router#Middleware) implements `Middleware(next) http.Handler`,
and [`MiddlewareFunc`](https://pkg.go.dev/gosalusa.com/router#MiddlewareFunc) adapts a plain function:

```go
r.Use(request.HandleErrors())
r.Use(auth.AttachUser())
```

[`InlineMiddlewareFunc`](https://pkg.go.dev/gosalusa.com/router#InlineMiddlewareFunc) is a variant that receives the response writer, request,
and next handler together. Middleware can also implement
[`openapidoc.OperationMiddleware`](https://pkg.go.dev/gosalusa.com/openapidoc#OperationMiddleware) to decorate generated API operations.

## URL generation

Inside a handler the [`URLResolver`](https://pkg.go.dev/gosalusa.com/router#URLResolver) dependency generates URLs from route names or
handlers. During bootstrap [`r.Register(ctx)`](https://pkg.go.dev/gosalusa.com/router#Router.Register) registers a resolver that builds
URLs from the config's base URL (or the current request's origin), substituting
`{param}` placeholders with the values passed and encoding anything left over as
query parameters:

```go
url := urlResolver.Resolve("user.show", "id", 42)
url := urlResolver.ResolveHandler(handlers.UserGet, "id", &models.User{ID: 42})
```

Parameters are key/value pairs. After the key, a model contributes the value of
its primary key, and numbers and `fmt.Stringer`s are formatted as strings.
[`ToAttrs`](https://pkg.go.dev/gosalusa.com/router#ToAttrs) converts the raw parameter list. [`NewTestResolver`](https://pkg.go.dev/gosalusa.com/router#NewTestResolver) returns a resolver
for tests that encodes everything as a query string.

## OpenAPI paths

[`Router`](https://pkg.go.dev/gosalusa.com/router#Router) implements [`openapidoc.Pathser`](https://pkg.go.dev/gosalusa.com/openapidoc#Pathser). [`Paths`](https://pkg.go.dev/gosalusa.com/router#Router.Paths) builds a swagger spec from
the registered routes whose handlers implement [`openapidoc.Operationer`](https://pkg.go.dev/gosalusa.com/openapidoc#Operationer),
applying any `OperationMiddleware` from the route's middleware chain. The route
name becomes the operation ID when none is set.

## Utilities

[`Routes()`](https://pkg.go.dev/gosalusa.com/router#Router.Routes) returns every registered route, [`PrintRoutes`](https://pkg.go.dev/gosalusa.com/router#Router.PrintRoutes) prints them as a
table, and [`Validate`](https://pkg.go.dev/gosalusa.com/router#Router.Validate) runs the [`validate.Validator`](https://pkg.go.dev/gosalusa.com/validate#Validator) interface against each
route's handler so the kernel can catch missing dependencies at startup.