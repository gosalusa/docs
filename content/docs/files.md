---
title: Files & File Serving
type: docs
prev: docs/authentication
next: docs/events
weight: 10
---

The [`filesystem`](https://pkg.go.dev/gosalusa.com/filesystem) and [`fileserver`](https://pkg.go.dev/gosalusa.com/fileserver) packages provide an injectable filesystem and
an HTTP handler for serving files with an SPA-style fallback.

## Registering a filesystem

[`filesystem.Register(ctx, cfg)`](https://pkg.go.dev/gosalusa.com/filesystem#Register) registers a lazy singleton `fs.FS` built from a
[`Config`](https://pkg.go.dev/gosalusa.com/filesystem#Config) — a type with `FS() fs.FS`. [`NewLocalFS(root)`](https://pkg.go.dev/gosalusa.com/filesystem#NewLocalFS) builds a config from a
directory path. The generated template uses it for user-uploaded files:

```go
kernel.Register(func(ctx context.Context, c *config.Config) {
	filesystem.Register(ctx, c.FileSystem)
})
```

The `Config.FileSystem` field is wired in `config.go`:

```go
FileSystem: filesystem.NewLocalFS("./files"),
```

Inside a handler, inject `fs.FS` and use it like any Go filesystem:

```go
type UploadHandler struct {
	FS fs.FS `inject:""`
}

func (h *UploadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	data, err := fs.ReadFile(h.FS, r.PathValue("path"))
	// ...
}
```

## Serving static files with SPA fallback

[`fileserver.WithFallback(root, basePath, fallbackPath, data)`](https://pkg.go.dev/gosalusa.com/fileserver#WithFallback) returns an
`http.Handler` that serves files from an `fs.FS` with a catch-all route. When
the requested path matches a real file, its content is served with the correct
MIME type; otherwise the fallback template is rendered with the provided data.

This is the standard pattern for serving a compiled frontend:

```go
r.Handle("/assets", fileserver.WithFallback(resources.Content, "dist", "index.html", nil))
```

`basePath` is prepended to every URL path before looking up the file, so
embedding files under `dist/` and mapping `/assets` to the handler serves
`dist/style.css` at `/assets/style.css`. Directories and missing paths both
fall through to `fallbackPath`, which receives the `data` value as template
data.

## Build-tag split

The generated project uses `//go:build !dev` and `//go:build dev` tags in
`resources/` to swap between a production `embed.FS` and a development
`os.DirFS`. When running `spice dev` the `dev` tag is set, so file changes are
picked up without rebuilding the binary.