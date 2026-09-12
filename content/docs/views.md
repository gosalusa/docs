---
title: Views
type: docs
prev: docs/requests
next: docs/authentication
weight: 7
---

The `view` package renders server-side HTML from templates stored in an
`io/fs` filesystem. Templates are standard `html/template` files with two
extra functions: `route`, which resolves a named route to a URL, and `dd`,
which dumps a value for debugging.

## Registering templates

`Register(fsys, patterns...)` returns a bootstrap step that registers a
`ViewTemplate` singleton. In the generated kernel:

```go
kernel.Bootstrap(
	view.Register(resources.Content, "**/*.html"),
	...
)
```

The default pattern is `**/*.html`. `NewViewTemplate` builds a template
directly for manual registration.

## Rendering a view

`View(file, data)` returns a `ViewHandler` that renders the named template
with the given data. It implements `request.Responder` and `http.Handler`, so
it can be routed directly:

```go
r.Get("/", view.View("index.html", nil)).Name("home")
r.Get("/user/create", view.View("create_user.html", nil)).Name("user.create")
```

A template can inject data passed to it, resolve URLs from the
`router.URLResolver`, and use the `route` function:

```html
<html>
  <h1>Hello {{ .Name }}</h1>
  <a href="{{ route "home" }}">Home</a>
</html>
```

## Template data and dependency injection

`ViewData` carries the dependencies a template render needs — the
`URLResolver` and the `ViewTemplate` — and is resolved from the DI container
with inject fields:

```go
type ViewData struct {
	URL      router.URLResolver `inject:""`
	Template *ViewTemplate      `inject:""`
}
```

`Execute(ctx, w)` resolves the `*ViewData` and renders; `ExecuteData(d, w)`
renders with data already resolved. Both parse the templates with the context's
`ViewTemplate` and execute the named file.

## Rendering without an HTTP request

`Bytes(ctx)` and `BytesData(d)` render to a `[]byte`, which is useful for
rendering views in tests, emails, or notifications:

```go
body, err := view.View("welcome.html", map[string]string{"Name": name}).Bytes(ctx)
```

## Templates in development

The generated project keeps two embed setups in `resources`: `embed.go`
embeds the compiled `dist` directory for production builds, while
`embed_dev.go` serves templates from disk during `spice dev`, so template
changes are picked up without rebuilding.