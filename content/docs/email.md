---
title: Email
type: docs
prev: docs/logging
next: docs/files
weight: 13
---

The `email` package sends HTML emails over SMTP and registers a `Mailer` as an
injectable dependency.

## The Mailer interface

```go
type Mailer interface {
	Mail(*Message) error
}

type Message struct {
	From     string
	Subject  string
	To       []string
	HTMLBody string
}
```

`SMTPMailer` is the built-in implementation. `NewSMTPMailer(host, port,
username, password, from)` dials the SMTP server with a one-minute timeout, and
`Mail` sends a `Message` (falling back to the mailer's `from` when the message
has none).

## Registering

`Register(ctx, config)` registers a lazy singleton `Mailer` built from a
`Config` — a type with a `Mailer() Mailer` method. `SMTPConfig` implements it
from the usual fields:

```go
kernel.Register(func(ctx context.Context, c *config.Config) {
	email.Register(ctx, c.Mail)
})
```

The generated `config.Config.Mail` is an `*email.SMTPConfig` populated from
environment variables:

```go
Mail: &email.SMTPConfig{
	From:     env.String("MAIL_FROM", "salusa@example.com"),
	Host:     env.String("MAIL_HOST", "sandbox.smtp.mailtrap.io"),
	Port:     env.Int("MAIL_PORT", 2525),
	Username: env.String("MAIL_USERNAME", "user"),
	Password: env.String("MAIL_PASSWORD", "pass"),
},
```

## Sending mail

Inject `email.Mailer` and call `Mail`. Combining it with the `view` package is
the common pattern — render a template to bytes and send it:

```go
type EmailHandler struct {
	Mailer email.Mailer `inject:""`
}

func (h *EmailHandler) Send(ctx context.Context, to, name string) error {
	body, err := view.View("welcome.html", map[string]string{"Name": name}).Bytes(ctx)
	if err != nil {
		return err
	}
	return h.Mailer.Mail(&email.Message{
		To:       []string{to},
		Subject:  "Welcome",
		HTMLBody: string(body),
	})
}
```

The auth package uses this to send verification and password-reset emails.

## Testing

The `email/emailtest` subpackage provides a `TestMailer` that records sent
messages in memory instead of dialing SMTP. `NewTestMailerConfig` plugs it into
`email.Register` so tests can assert on `EmailsSent()`:

```go
mailer := emailtest.NewTestMailer()
email.Register(ctx, emailtest.NewTestMailerConfig())
// ...
assert.Len(t, mailer.EmailsSent(), 1)
```