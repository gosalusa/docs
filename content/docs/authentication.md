---
title: Authentication
type: docs
prev: docs/views
next: docs/files
weight: 9
---

The [`auth`](https://pkg.go.dev/gosalusa.com/auth) package adds JWT-based authentication on top of a [`User`](https://pkg.go.dev/gosalusa.com/auth#User) model. It
ships with all the routes and handlers for user creation, login, password
resets, email verification, and token refresh.

## Setting it up

[`Register[T]`](https://pkg.go.dev/gosalusa.com/auth#Register) registers the DI providers that resolve the current [`*Claims`](https://pkg.go.dev/gosalusa.com/auth#Claims)
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

[`AttachUser`](https://pkg.go.dev/gosalusa.com/auth#AttachUser) parses the `Authorization` header and stores the claims in the
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

Two ready-made users are provided: [`UsernameUser`](https://pkg.go.dev/gosalusa.com/auth#UsernameUser) (a `username` column) and
[`EmailVerifiedUser`](https://pkg.go.dev/gosalusa.com/auth#EmailVerifiedUser) (an `email` column with a `validated` flag, a `lookup_token`
for email verification, and a [`GetEmail`](https://pkg.go.dev/gosalusa.com/auth#EmailVerified) interface). Both embed [`BaseModel`](https://pkg.go.dev/gosalusa.com/database/model#BaseModel),
use a `uuid.UUID` primary key, and salt the password hash with the user ID
before hashing with bcrypt.

## Auth routes

[`RegisterRoutes`](https://pkg.go.dev/gosalusa.com/auth#RegisterRoutes) adds the auth endpoints to a router group:

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
| `POST /login`     | [`Login`](https://pkg.go.dev/gosalusa.com/auth#BasicAuthController.Login) | verify credentials, return access and refresh tokens |
| `POST /user`      | [`UserCreate`](https://pkg.go.dev/gosalusa.com/auth#BasicAuthController.UserCreate) | create a user and optionally send a verification email |
| `GET /user/verify`| [`VerifyEmail`](https://pkg.go.dev/gosalusa.com/auth#BasicAuthController.VerifyEmail) | mark the user verified from a token        |
| `POST /user/password/forgot` | [`ForgotPassword`](https://pkg.go.dev/gosalusa.com/auth#BasicAuthController.ForgotPassword) | email a password reset token   |
| `POST /user/password/reset`  | [`ResetPassword`](https://pkg.go.dev/gosalusa.com/auth#BasicAuthController.ResetPassword) | set a new password with the token |
| `POST /login/refresh`        | [`Refresh`](https://pkg.go.dev/gosalusa.com/auth#BasicAuthController.Refresh) | mint a new access token from a refresh token |
| `POST /user/password/change` | [`ChangePassword`](https://pkg.go.dev/gosalusa.com/auth#BasicAuthController.ChangePassword) | change the password for the logged-in user (authed) |

The last route is protected: `RegisterRoutes` applies `AttachUser` and
`LoggedIn` to it.

## Middleware

[`LoggedIn()`](https://pkg.go.dev/gosalusa.com/auth#LoggedIn) rejects requests without claims with a 401 and can be scoped to a
route. It also acts as an [`openapidoc.OperationMiddleware`](https://pkg.go.dev/gosalusa.com/openapidoc#OperationMiddleware), tagging the
operation as requiring the default security definition. [`HasClaim(cb)`](https://pkg.go.dev/gosalusa.com/auth#HasClaim) rejects
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

If there is no logged-in user this injection returns [`Err401Unauthorized`](https://pkg.go.dev/gosalusa.com/auth#Err401Unauthorized).

## Claims and tokens

[`Claims`](https://pkg.go.dev/gosalusa.com/auth#Claims) embeds the JWT registered claims, carries a space-separated `scope`
list, and is built fluently:

```go
claims := auth.NewClaims().
	WithSubject(user.GetID()).
	WithLifetime(time.Hour).
	WithIssuer("example.com").
	WithScopes(auth.ScopeAccess)
```

[`GenerateToken(claims)`](https://pkg.go.dev/gosalusa.com/auth#GenerateToken) signs a token with HS512 using the app key, and
[`Parse`](https://pkg.go.dev/gosalusa.com/auth#Parse)/[`ParseOf[T]`](https://pkg.go.dev/gosalusa.com/auth#ParseOf) verify it. Set a stable key with [`SetAppKey`](https://pkg.go.dev/gosalusa.com/auth#SetAppKey) so tokens
survive restarts; without one a random key is generated and a warning logged.

[`ScopeAccess`](https://pkg.go.dev/gosalusa.com/auth#ScopeAccess) and [`ScopeRefresh`](https://pkg.go.dev/gosalusa.com/auth#ScopeRefresh) are the two standard scopes. Access tokens are
checked for `ScopeAccess` by `AttachUser` and refresh tokens must carry
`ScopeRefresh`.