---
title: Getting Started
type: docs
next: docs/database/
weight: 1
---

This guide creates a new Salusa project, runs its development server, and points
you at the parts you will care about.

## Prerequisites

You need the Go toolchain, installed with the instructions on
[go.dev/doc/install](https://go.dev/doc/install). If you plan on building a
frontend, install [node and npm](https://nodejs.org/en) as well.

## Installing the CLI

Salusa projects are created and managed with the `spice` command line tool.
Install it with go:

```sh
go install gosalusa.com/spice@latest
```

Make sure your `$GOPATH/bin` is on your `PATH` so `spice` is available.

## Creating a project

`spice init` creates a new project from the Salusa template. Pass it the go
package path you want to use:

```sh
spice init github.com/you/example-app
```

This copies the template into the current directory, runs `git init`, adds your
remote as `origin`, and initializes the go module. Once it has finished, move
into the new directory:

```sh
cd example-app
```

## Running the development server

`spice dev` builds and starts the server, then watches your files and restarts
it as you make changes:

```sh
spice dev
```

The server runs on port `2303` by default (configurable with the `PORT`
environment variable, or your app's `config/config.go`). Open
[http://localhost:2303](http://localhost:2303) to see your app.

## Project structure

A new project looks like this:

```
root
├── app
│   ├── events
│   ├── handlers
│   ├── jobs
│   ├── kernel.go
│   ├── models
│   └── providers
├── config
├── migrations
├── resources
│   └── dist
├── routes
├── main.go
└── spice.yml
```

- **app** contains your application logic. `kernel.go` boots the application
  and wires up providers, `handlers` holds your HTTP handlers, `models` your
  database models, and `events` and `jobs` anything you want to run in the
  background.
- **config** loads your configuration from environment variables.
- **migrations** are the schema changes that keep your database up to date.
- **routes** maps URLs to handlers.
- **resources/dist** serves your frontend assets.

The `app` package is also where you add long-running services; see the
[kernel](/docs/application) page.

## Next steps

- The core of the framework is [dependency injection](/docs/dependency-injection),
  which is how data gets into your handlers.
- Models, queries, and schema are covered in the [database](/docs/database/)
  section.
- [Requests & Responses](/docs/requests) shows how to build typed HTTP handlers.
