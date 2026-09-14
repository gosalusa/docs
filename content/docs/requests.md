---
title: Requests & Responses
type: docs
prev: docs/routing
next: docs/views
weight: 7
---

The [`request`](https://pkg.go.dev/gosalusa.com/request) package turns HTTP requests into typed Go structs and back into
JSON responses. [`request.Handler`](https://pkg.go.dev/gosalusa.com/request#Handler) builds an `http.Handler` from a function that
takes a request struct and returns a response.

## Defining a handler

```go
type CreateUserRequest struct {
	Name  string `json:"name" validate:"required|min:3"`
	Email string `json:"email" validate:"required|email"`
}

type CreateUserResponse struct {
	ID int `json:"id"`
}

userCreate := request.Handler(func(r *CreateUserRequest) (*CreateUserResponse, error) {
	user, err := model.Save(tx, &User{Name: r.Name, Email: r.Email})
	if err != nil {
		return nil, err
	}
	return &CreateUserResponse{ID: user.ID}, nil
})
```

## Populating the request

[`Run`](https://pkg.go.dev/gosalusa.com/request#Run) reads the request into the struct. Every exported field that should be
populated must carry one of these tags, or the handler's `Validate` fails at
startup:

| tag      | source                                                                          |
| -------- | ------------------------------------------------------------------------------- |
| `json`   | the JSON body field, or a form field when the content type is form-encoded or `multipart/form-data` |
| `query`  | a query string parameter                                                        |
| `path`   | a gorilla/mux path variable (`{name}` in the route)                             |
| `inject` | a dependency from the DI container instead of request data                       |

Supported types are the built-in numerics, `string`, `bool`, and slices of
those, plus types (or pointers to types) that implement
`encoding.TextUnmarshaler`. Query and path values are decoded with the same
logic; JSON bodies are decoded with `encoding/json`, where a pointer field
requested as `null` stays `nil`. A field of type `fs.File` is populated from a
`multipart/form-data` upload with a matching `json` tag.

Fields with an `inject` tag are filled from the dependency provider. A model
field marked `inject:"id"` is loaded by its primary key from the route or
query, as described in the models and DI pages.

## Responses

The handler's return value is converted to a response with `respond`:

- a [`Responder`](https://pkg.go.dev/gosalusa.com/request#Responder) (an `http.Handler` too, or `*http.Response`) is served as-is;
- an `http.Handler` is invoked directly;
- anything else is encoded as JSON with [`NewJSONResponse`](https://pkg.go.dev/gosalusa.com/request#NewJSONResponse).

[`NewResponse(body)`](https://pkg.go.dev/gosalusa.com/request#NewResponse) builds a `Responder` from an `io.Reader` with a chainable
[`SetStatus`](https://pkg.go.dev/gosalusa.com/request#ResponseBuilder.SetStatus)/[`AddHeader`](https://pkg.go.dev/gosalusa.com/request#ResponseBuilder.AddHeader) builder, [`NewHTMLResponse`](https://pkg.go.dev/gosalusa.com/request#NewHTMLResponse) wraps it with a
`text/html` content type, and `NewJSONResponse(data)` sets the
`application/json` content type with indent.

## Errors

Errors returned from a handler become responses. A [`ValidationError`](https://pkg.go.dev/gosalusa.com/request#ValidationError) (a
`map[string][]string` of field errors) is turned into a 422 response via
[`NewHTTPError`](https://pkg.go.dev/gosalusa.com/request#NewHTTPError). The [`StatusError`](https://pkg.go.dev/gosalusa.com/request#StatusError) constants provide HTTP statuses as errors, for
example [`request.ErrStatusNotFound`](https://pkg.go.dev/gosalusa.com/request#ErrStatusNotFound) or [`request.ErrStatusUnauthorized`](https://pkg.go.dev/gosalusa.com/request#ErrStatusUnauthorized).

[`HTTPError`](https://pkg.go.dev/gosalusa.com/request#HTTPError) wraps any error with a status; [`ErrorHandler`](https://pkg.go.dev/gosalusa.com/request#ErrorHandler) dispatches an error to
a `Responder` if it implements one, and falls back to a `500` otherwise. An
[`HTMLError`](https://pkg.go.dev/gosalusa.com/request#HTMLError) provides custom HTML for the error page.

## Middleware

[`HandleErrors`](https://pkg.go.dev/gosalusa.com/request#HandleErrors) recovers panics and collects errors so a failing handler
produces one response through `ErrorHandler`; custom error handlers can be
passed to pick the response:

```go
r.Use(request.HandleErrors(func(ctx context.Context, err error) http.Handler {
	if errors.Is(err, request.ErrStatusNotFound) {
		return view.View("404.html", nil)
	}
	return nil
}))
```

[`DIMiddleware`](https://pkg.go.dev/gosalusa.com/request#DIMiddleware) puts the current `*http.Request` and `http.ResponseWriter` in the
request context so they can be injected. The kernel adds it automatically, and
[`request.Register(ctx)`](https://pkg.go.dev/gosalusa.com/request#Register) registers both as dependencies during bootstrap.

## Validation

After the struct is populated it is validated, and failure returns a
[`ValidationError`](https://pkg.go.dev/gosalusa.com/request#ValidationError). Rules come from the `validate` tag separated by `|`, with
`:` for arguments. `required` is handled specially, and the common rules are:

| rule                      | applies to                              |
| ------------------------- | --------------------------------------- |
| `min`, `max`              | numbers, strings, and arrays            |
| `gt`, `gte`, `lt`, `lte`  | numbers and strings                     |
| `multiple_of`             | numbers                                 |
| `email`, `url`, `uuid`, `ip_address`, `regex` | strings               |
| `alpha`, `numeric`, `alpha_num`, `alpha_dash`  | strings               |
| `starts_with`, `ends_with`, `length`, `length_between`, `in`, `not_in` | strings |
| `accepted`, `declined`    | booleans                                |
| `after`, `after_or_equal`, `before`, `before_or_equal` | times             |

The [`validate`](https://pkg.go.dev/gosalusa.com/validate) package defines the [`validate.Validator`](https://pkg.go.dev/gosalusa.com/validate#Validator) interface and the
[`validate.Append`](https://pkg.go.dev/gosalusa.com/validate#Append) helper used by the kernel, router, and DI validator to
collect startup validation errors.

## OpenAPI

[`RequestHandler`](https://pkg.go.dev/gosalusa.com/request#RequestHandler) implements [`openapidoc.Operationer`](https://pkg.go.dev/gosalusa.com/openapidoc#Operationer). [`Operation`](https://pkg.go.dev/gosalusa.com/request#RequestHandler.Operation) derives query
and path parameters, the body schema, and the default response schema from the
request and response types, and a custom operation can be supplied with
[`Docs(*spec.OperationProps)`](https://pkg.go.dev/gosalusa.com/request#RequestHandler.Docs).

## Internal helpers

[`Run(req, requestStruct)`](https://pkg.go.dev/gosalusa.com/request#Run) is exported for embedding request handling in custom
handler types, as are [`Respond`](https://pkg.go.dev/gosalusa.com/request#Respond), [`RespondError`](https://pkg.go.dev/gosalusa.com/request#RespondError), and the [`File`](https://pkg.go.dev/gosalusa.com/request#File)/[`FileInfo`](https://pkg.go.dev/gosalusa.com/request#FileInfo)
types that expose an uploaded file through the `io/fs` interfaces.