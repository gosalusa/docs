---
title: Testing
type: docs
prev: docs/openapi
next: docs/cli
weight: 21
---

The `testing` packages provide facilities for exercising HTTP handlers, whole
applications, and JSON responses.

## handlertest

[`handlertest.New(ctx, t, handler)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#New) wraps any `http.Handler` in a fluent request
builder. Requests run against `httptest` with a fresh DI context, so injected
dependencies can be set up before each call and shared state is isolated per
test:

```go
handlertest.New(ctx, t, handler).
	Get("/users").
	AssertStatusOK()
```

The builder supports [`Get`](https://pkg.go.dev/gosalusa.com/testing/handlertest#RequestBuilder.Get), [`Post`](https://pkg.go.dev/gosalusa.com/testing/handlertest#RequestBuilder.Post), [`Put`](https://pkg.go.dev/gosalusa.com/testing/handlertest#RequestBuilder.Put), [`Patch`](https://pkg.go.dev/gosalusa.com/testing/handlertest#RequestBuilder.Patch), and [`Delete`](https://pkg.go.dev/gosalusa.com/testing/handlertest#RequestBuilder.Delete), each with a
`JSON` variant that sets `Accept`/`Content-Type` headers and encodes the body
from a Go value. [`WithHeader(key, value)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#RequestBuilder.WithHeader) adds arbitrary headers.

[`HttpResult`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult) is the fluent assertion result. Status helpers cover exact matches
and ranges; body helpers compare decoded JSON, including dotted-path lookups:

| result method              | effect                        |
| -------------------------- | ----------------------------- |
| [`AssertStatus(status)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertStatus)     | exact status code             |
| [`AssertStatusOK()`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertStatusOK)         | any 2xx-3xx status            |
| [`AssertStatus2XX()/3XX/4XX/5XX`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertStatus2XX) | status within the range |
| [`AssertStatusRange(min, max)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertStatusRange) | status within bounds      |
| [`AssertJSON(expected)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertJSON)     | whole body equals decoded value     |
| [`AssertJSONString(s)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertJSONString)      | whole body equals a JSON string     |
| [`AssertJSONContains(path, v)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertJSONContains) | a nested value matches `a.b.c` |
| [`Body()`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.Body)                   | raw response bytes            |

```go
handlertest.New(ctx, t, h).
	PostJSON("/users", createUserRequest{Name: "Ada"}).
	AssertStatus(http.StatusCreated).
	AssertJSONContains("user.email", "ada@example.com")
```

## kerneltest

[`kerneltest.TestKernel[T]`](https://pkg.go.dev/gosalusa.com/testing/kerneltest#TestKernel) boots a real [`kernel.Kernel`](https://pkg.go.dev/gosalusa.com/kernel#Kernel) with a [`salusaconfig`
config](https://pkg.go.dev/gosalusa.com/salusaconfig#Config) and routes requests through `k.RootHandler()`. Build it once with
[`NewTestKernelFactory(kernel, config)`](https://pkg.go.dev/gosalusa.com/testing/kerneltest#NewTestKernelFactory) and reuse per test; each call gets a
fresh DI context and a bootstrapped kernel:

```go
var newKernel = kerneltest.NewTestKernelFactory(buildKernel(), &config.Config{})

func TestUserGet(t *testing.T) {
	newKernel(t).
		GetJSON("/api/users/1").
		AssertStatus(http.StatusOK).
		AssertJSONContains("name", "Ada")
}
```

The same fluent verbs as the builder are forwarded: `Get`, `GetJSON`, `Post`,
`PostJSON`, `Put`, `PutJSON`, `Patch`, `PatchJSON`, `Delete`, `DeleteJSON`.
Because each call bootstraps the kernel with [`Bootstrap(ctx)`](https://pkg.go.dev/gosalusa.com/kernel#Kernel.Bootstrap), providers and
services register fresh for every test.

## matches

The [`matches`](https://pkg.go.dev/gosalusa.com/testing/matches) package defines [`Matcher`](https://pkg.go.dev/gosalusa.com/testing/matches#Matcher) and a small set of value matchers such
as [`EqualTo`](https://pkg.go.dev/gosalusa.com/testing/matches#EqualTo) for deferred assertions. It is used where a matcher object is
passed rather than a direct comparison; keep in mind the current
implementations are early stubs intended to model the pattern.