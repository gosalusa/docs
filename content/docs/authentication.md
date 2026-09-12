---
title: Authentication
type: docs
prev: docs/views
next: docs/events
weight: 8
---

The `auth` package adds JWT-based authentication on top of a `User` model. It
ships with all the routes and handlers for user creation, login, password
resets, email verification, and token refresh.

## Setting it up

`Register[T]` registers the DI providers that resolve the current `*Claims`
and the logged-in `T` user from the request context. It is a bootstrap step in
the generated kernel:

```go
kernel.Register(func(ctx context.Context, c *config.Config) {
	auth.Register[*models.User](ctx)
})
```

The HTTP middleware is applied in `routes.go`:

```go
r.Use(auth.AttachUser())
```

`AttachUser` parses the `Authorization` header and stores the claims in the
request context. It is permissive — requests without a header pass through with
no claims.

## The User model

A `User` is a model with an ID, a password hash, and one or more username
columns, plus methods for salting passwords:

```go
type User interface {
	model.Model
	GetID() string
	GetPasswordHash() []byte
	SetPasswordHash([]byte)
	SaltedPassword(password string) []byte
	UsernameColumns() []string
}
```

Two ready-made users are provided: `UsernameUser` (a `username` column) and
`EmailVerifiedUser` (an `email` column with a `validated` flag, a `lookup_token`
for email verification, and a `GetEmail` interface). Both embed `BaseModel`,
use a `uuid.UUID` primary key, and salt the password hash with the user ID
before hashing with bcrypt.

## Auth routes

`RegisterRoutes` adds the auth endpoints to a router group:

```go
auth.RegisterRoutes(r, auth.NewBasicAuthController[*models.User](
	auth.CreateUser(func(r *auth.EmailVerifiedUserCreateRequest, c *auth.BasicAuthController[*models.User]) (*auth.UserCreateResponse[*models.User], error) {
		return c.RunUserCreate(&models.User{
			EmailVerifiedUser: auth.EmailVerifiedUser{
				ID:           uuid.New(),
				Email:        r.Email,
				PasswordHash: []byte{},
			},
		}, &r.UserCreateRequest)
	}),
	auth.ResetPasswordName("reset-password"),
))
```

This registers:

| route             | handler              | purpose                                    |
| ----------------- | -------------------- | ------------------------------------------ |
| `POST /login`     | `Login`              | verify credentials, return access and refresh tokens |
| `POST /user`      | `UserCreate`         | create a user and optionally send a verification email |
| `GET /user/verify`| `VerifyEmail`        | mark the user verified from a token        |
| `POST /user/password/forgot` | `ForgotPassword` | email a password reset token   |
| `POST /user/password/reset`  | `ResetPassword`  | set a new password with the token |
| `POST /login/refresh`        | `Refresh`        | mint a new access token from a refresh token |
| `POST /user/password/change` | `ChangePassword` | change the password for the logged-in user (authed) |

The last route is protected: `RegisterRoutes` applies `AttachUser` and
`LoggedIn` to it.

## Middleware

`LoggedIn()` rejects requests without claims with a 401 and can be scoped to a
route. It also acts as an `openapidoc.OperationMiddleware`, tagging the
operation as requiring the default security definition. `HasClaim(cb)` rejects
requests whose claims fail a predicate:

```go
r.Group("/admin", func(r *router.Router) {
	r.Use(auth.AttachUser())
	r.Use(auth.HasClaim(func(c *auth.Claims) bool {
		return slices.Contains(c.Scope, "admin")
	}))
	r.Get("/dashboard", handlers.Dashboard)
})
```

## Injecting the user

Inside a handler, the current user is filled from the DI container. `Register`
loads the user from the database by the subject of the claims:

```go
type Request struct {
	User *models.User `inject:""`
}

request.Handler(func(r *Request) (*UserResponse, error) {
	return &UserResponse{User: r.User}, nil
})
```

If there is no logged-in user this injection returns `Err401Unauthorized`.

## Claims and tokens

`Claims` embeds the JWT registered claims, carries a space-separated `scope`
list, and is built fluently:

```go
claims := auth.NewClaims().
	WithSubject(user.GetID()).
	WithLifetime(time.Hour).
	WithIssuer("example.com").
	WithScopes(auth.ScopeAccess)
```

`GenerateToken(claims)` signs a token with HS512 using the app key, and
`Parse`/`ParseOf[T]` verify it. Set a stable key with `SetAppKey` so tokens
survive restarts; without one a random key is generated and a warning logged.

`ScopeAccess` and `ScopeRefresh` are the two standard scopes. Access tokens are
checked for `ScopeAccess` by `AttachUser` and refresh tokens must carry
`ScopeRefresh`.