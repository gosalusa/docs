---
title: Testing
type: docs
prev: docs/openapi
next: docs/cli
weight: 22
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
| [`AssertJSON(expected)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertJSON)     | whole body equals decoded value; `expected` is generic, so `T` is inferred from the argument |
| [`AssertJSONString(s)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertJSONString)      | whole body equals a JSON string     |
| [`AssertJSONContains(path, matcher)`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertJSONContains) | value at `a.b.c` satisfies a [`match`](https://pkg.go.dev/gosalusa.com/testing/match) matcher |
| [`Body()`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.Body)                   | raw response bytes            |

```go
handlertest.New(ctx, t, h).
	PostJSON("/users", createUserRequest{Name: "Ada"}).
	AssertStatus(http.StatusCreated).
	AssertJSONContains("user.email", match.Equal("ada@example.com"))
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
		AssertJSONContains("name", match.Equal("Ada"))
}
```

The same fluent verbs as the builder are forwarded: `Get`, `GetJSON`, `Post`,
`PostJSON`, `Put`, `PutJSON`, `Patch`, `PatchJSON`, `Delete`, `DeleteJSON`.
Because each call bootstraps the kernel with [`Bootstrap(ctx)`](https://pkg.go.dev/gosalusa.com/kernel#Kernel.Bootstrap), providers and
services register fresh for every test.

## match

The [`match`](https://pkg.go.dev/gosalusa.com/testing/match) package defines the [`Matcher`](https://pkg.go.dev/gosalusa.com/testing/match#Matcher) interface used for deferred
assertions. A matcher reports whether a value matches and, on failure, a
description of the mismatch, as a [`Result`](https://pkg.go.dev/gosalusa.com/testing/match#Result):

```go
type Matcher interface {
	Matches(actual any) Result
}

type Result struct {
	Matches     bool
	Description string
}
```

Matchers compose freely:

| matcher                                | effect                                   |
| -------------------------------------- | ---------------------------------------- |
| [`Equal(expected)`](https://pkg.go.dev/gosalusa.com/testing/match#Equal)       | value is deeply equal to `expected`      |
| [`Same(expected)`](https://pkg.go.dev/gosalusa.com/testing/match#Same)         | value is the same pointer as `expected`  |
| [`Len(length)`](https://pkg.go.dev/gosalusa.com/testing/match#Len)             | value has the given length               |
| [`Greater(value)`](https://pkg.go.dev/gosalusa.com/testing/match#Greater)      | value is greater than `value`            |
| [`GreaterOrEqual(value)`](https://pkg.go.dev/gosalusa.com/testing/match#GreaterOrEqual) | value is greater than or equal to `value` |
| [`Less(value)`](https://pkg.go.dev/gosalusa.com/testing/match#Less)            | value is less than `value`               |
| [`LessOrEqual(value)`](https://pkg.go.dev/gosalusa.com/testing/match#LessOrEqual) | value is less than or equal to `value`  |
| [`All(matchers...)`](https://pkg.go.dev/gosalusa.com/testing/match#All)         | satisfies every matcher                  |

The comparison matchers are generic over any [`cmp.Ordered`](https://pkg.go.dev/cmp#Ordered) type —
the numeric types and `string` — so the expected value's type is inferred from
the argument and the actual value is type-asserted to the same type. That makes
them a natural fit for fields that are easier to bound than to pin exactly:

```go
handlertest.New(ctx, t, h).
	Get("/users").
	AssertStatusOK().
	AssertJSONContains("count", match.Greater(float64(0))).
	AssertJSONContains("user.created_at", match.Less(float64(time.Now().Unix())))
```

`cmp.Ordered` covers only the basic ordered types, so a `time.Time` value has
to be reduced to one of them — `.Unix()`, `.UnixMilli()`, or a string from
`Format` — before it can be compared. A value that fails the type assertion
simply does not match, so the expected value's type has to match the decoded
value's exactly. JSON bodies are decoded without `json.UseNumber`, which means
every JSON number surfaces as `float64`: comparing a JSON field against an
`int` or `int64` literal fails the assertion even when the numbers compare
correctly.

To write a matcher that isn't in the table, implement the `Matcher` interface or
convert a plain function with [`MatcherFunc`](https://pkg.go.dev/gosalusa.com/testing/match#MatcherFunc), and return a
`Result` describing the mismatch when it does not hold:

```go
func HasPrefix(prefix string) match.Matcher {
	return match.MatcherFunc(func(actual any) match.Result {
		s, ok := actual.(string)
		if !ok || !strings.HasPrefix(s, prefix) {
			return match.Result{
				Matches:     false,
				Description: fmt.Sprintf("%v is not prefixed with %q", actual, prefix),
			}
		}
		return match.Result{Matches: true}
	})
}
```

Assertion helpers such as [`AssertJSONContains`](https://pkg.go.dev/gosalusa.com/testing/handlertest#HttpResult.AssertJSONContains)
take a `Matcher` instead of a raw value:

```go
handlertest.New(ctx, t, h).
	Get("/users").
	AssertStatusOK().
	AssertJSONContains("users", match.Len(2)).
	AssertJSONContains("user.name", match.All(match.Len(3), match.Equal("Ada")))
```