---
title: OpenAPI & ReDoc
type: docs
prev: docs/json-io
next: docs/testing
weight: 20
---

The `openapidoc` package generates an OpenAPI (Swagger) 2.0 document from your
routes and Go types, and serves an interactive ReDoc UI from the app.

## Generating the document

The kernel implements `openapidoc.APIDocer`, building the document from the
routes registered through `router` (the router implements `openapidoc.Pathser`,
and handlers implement `openapidoc.Operationer` via `request.Docs`). The
template wires it up in `routes/routes.go`:

```go
func InitRoutes(config *config.Config) kernel.Routes {
	return kernel.Routes{
		Routes: []kernel.MountFunc{...},
		APIDocumentation: kernel.APIDocumentation{
			MountPath: "/api",
			SwaggerOptions: []openapidoc.SwaggerOption{
				openapidoc.Info(spec.InfoProps{
					Title:       "Salusa API",
					Description: "API for Salusa.",
					Version:     "0.1.0",
				}),
				openapidoc.AddDefaultSecurityDefinition(),
			},
		},
	}
}
```

Routes under the mount path get consolidated into the document. The four
interface contracts are:

| interface              | implemented by                | role                          |
| ---------------------- | ----------------------------- | ----------------------------- |
| `Pathser`              | `router`                      | produces the path definitions |
| `Operationer`          | request handlers              | produces one operation        |
| `OperationMiddleware`  | request handlers              | post-processes an operation   |
| `APIDocer`             | `kernel`                      | produces the final `spec.Swagger` |

## Building schemas from types

`openapidoc.Schema(reflect.Type, requireTag)` converts Go types into
`*spec.Schema`. Structs are built from their fields (using the `json` tag name,
or the field name when `requireTag` is false); slices, maps, and pointers
delegate recursively, and `time.Time` maps to `date-time`. Register mappings
for your own types ahead of time:

```go
openapidoc.RegisterSchema[Status](spec.StringProperty())
openapidoc.RegisterFormat[my.Money]("decimal")
```

`Response(t)` builds a response schema for a handler's return type, and
`RegisterResponse` overrides it. `RegisterContentType` declares the media type
a response type encodes to.

## Serving the UI

`openapidoc.SwaggerUI()` returns an `http.Handler` that serves the ReDoc UI at
its mount path, the raw document at `.../swagger.json`, and a bundled ReDoc
script served gzip-encoded. The kernel mounts it automatically wherever
`APIDocumentation.MountPath` points.

`openapidocdi.Register(ctx)` registers the kernel as the `APIDocer` dependency
so `SwaggerUI` can resolve the built document on request.