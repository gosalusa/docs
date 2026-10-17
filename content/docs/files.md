---
title: Files & File Serving
type: docs
prev: docs/authentication
next: docs/events
weight: 10
---

The [`wfs`](https://pkg.go.dev/gosalusa.com/wfs) package provides an injectable
filesystem that can be read from and written to, and the
[`fileserver`](https://pkg.go.dev/gosalusa.com/fileserver) package serves files
over HTTP with an SPA-style fallback.

## Registering a filesystem

[`wfs.RegisterLocal(ctx, path)`](https://pkg.go.dev/gosalusa.com/wfs#RegisterLocal)
registers a lazy singleton `fs.FS` rooted at a directory path, and
[`wfs.NewLocalFS(root)`](https://pkg.go.dev/gosalusa.com/wfs#NewLocalFS) builds
the filesystem value directly. The generated template uses it for
user-uploaded files:

```go
kernel.Register(func(ctx context.Context, c *config.Config) {
	wfs.RegisterLocal(ctx, c.FileSystem)
})
```

The `Config.FileSystem` field is a plain path, wired in `config.go`:

```go
FileSystem: "./files",
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

## Reading and writing

`fs.FS` is read-only. `wfs` layers optional write operations on top of it
through small interfaces, and the package-level functions dispatch to whichever
one the filesystem implements:

| interface                                                        | method                                          |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| [`WriteFileFS`](https://pkg.go.dev/gosalusa.com/wfs#WriteFileFS) | `WriteFile(name string, b []byte) error`        |
| [`OpenFileFS`](https://pkg.go.dev/gosalusa.com/wfs#OpenFileFS)   | `OpenFile(name string, flag int) (File, error)` |
| [`MkdirFS`](https://pkg.go.dev/gosalusa.com/wfs#MkdirFS)         | `Mkdir(name string) error`                      |
| [`RemoveFS`](https://pkg.go.dev/gosalusa.com/wfs#RemoveFS)       | `Remove(name string) error`                     |
| [`RenameFS`](https://pkg.go.dev/gosalusa.com/wfs#RenameFS)       | `Rename(oldname, newname string) error`         |

Call the matching [`wfs.WriteFile`](https://pkg.go.dev/gosalusa.com/wfs#WriteFile),
[`wfs.OpenFile`](https://pkg.go.dev/gosalusa.com/wfs#OpenFile),
[`wfs.Mkdir`](https://pkg.go.dev/gosalusa.com/wfs#Mkdir),
[`wfs.Remove`](https://pkg.go.dev/gosalusa.com/wfs#Remove), or
[`wfs.Rename`](https://pkg.go.dev/gosalusa.com/wfs#Rename) function rather than
asserting the interface yourself. A filesystem that does not support the
operation returns an error wrapping
[`wfs.ErrNotImplemented`](https://pkg.go.dev/gosalusa.com/wfs#ErrNotImplemented):

```go
fsys := wfs.NewLocalFS("./files")
err := wfs.WriteFile(fsys, "report.txt", []byte("done"))
```

[`wfs.NewLocalFS`](https://pkg.go.dev/gosalusa.com/wfs#NewLocalFS) returns a
[`*LocalFS`](https://pkg.go.dev/gosalusa.com/wfs#LocalFS) that implements every
interface above, plus the standard `Open`, `Stat`, `ReadFile`, `ReadDir`, and
`ReadLink` reads. [`OpenFile`](https://pkg.go.dev/gosalusa.com/wfs#OpenFile)
takes the same `os` flags through the [`wfs.O_*`](https://pkg.go.dev/gosalusa.com/wfs#O_RDONLY)
constants — `O_RDONLY`, `O_WRONLY`, `O_RDWR`, `O_APPEND`, `O_CREATE`, `O_EXCL`,
`O_SYNC`, and `O_TRUNC` — and returns a
[`wfs.File`](https://pkg.go.dev/gosalusa.com/wfs#File), an `fs.File` that is
also an `io.Writer`.

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
