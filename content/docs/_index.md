---
title: Docs
type: docs
next: docs/getting-started
weight: 1
---

This is the documentation for Salusa, an open source web framework for Go. The
pages are grouped roughly the way you meet them in a real project, so the usual
path through them is top to bottom — but every page stands on its own, and each
package can be imported on its own if you only need one piece of the framework.

If you have never used Salusa before, start with
[Getting Started](/docs/getting-started): it creates a project with the
`spice` CLI and walks through the directory layout.

## Start here

{{< cards >}}
{{< card link="/docs/getting-started" title="Getting Started" subtitle="Create a project, run the dev server, and learn the layout" icon="book-open" >}}
{{< card link="/docs/cli" title="Spice CLI" subtitle="Project scaffolding, the dev server, and code generation" icon="terminal" >}}
{{< /cards >}}

## The core

The pieces every application uses: the kernel that boots and runs services, the
container that fills in your dependencies, and the HTTP layer on top.

{{< cards >}}
{{< card link="/docs/application" title="Application & Kernel" subtitle="Boot the app, validate dependencies, and run long-lived services" icon="chip" >}}
{{< card link="/docs/dependency-injection" title="Dependency Injection" subtitle="Register providers and resolve them with `inject` tags" icon="beaker" >}}
{{< card link="/docs/environment" title="Configuration & Environment" subtitle="Read typed config out of environment variables" icon="cog" >}}
{{< card link="/docs/routing" title="Routing" subtitle="Middleware pipelines, named routes, and URL generation" icon="switch-horizontal" >}}
{{< card link="/docs/requests" title="Requests & Responses" subtitle="Bind requests to typed structs and serialize typed JSON" icon="switch-vertical" >}}
{{< card link="/docs/views" title="Views" subtitle="Server-side HTML templates with layouts and route helpers" icon="template" >}}
{{< /cards >}}

## Data

Models, queries, and the value types that move between your database, your
handlers, and your API.

{{< cards >}}
{{< card link="/docs/database/" title="Database" subtitle="Models, relationships, a query builder, and migrations" icon="database" >}}
{{< card link="/docs/nullable" title="Optional Values" subtitle="Absent and nullable values with `optional.Optional[T]`" icon="adjustments" >}}
{{< card link="/docs/collections" title="Maps & Sets" subtitle="Generic collections built on Go iterators" icon="collection" >}}
{{< card link="/docs/json-io" title="JSON I/O" subtitle="Expose Go values as `io.Reader` and `io.Writer`" icon="code" >}}
{{< card link="/docs/caching" title="Caching" subtitle="Key-value caches for transient data" icon="lightning-bolt" >}}
{{< /cards >}}

## Services

The things your app does beyond serving requests.

{{< cards >}}
{{< card link="/docs/authentication" title="Authentication" subtitle="JWT login, signup, password resets, and email verification" icon="lock-closed" >}}
{{< card link="/docs/files" title="Files & File Serving" subtitle="File storage abstractions and static assets with SPA fallback" icon="folder" >}}
{{< card link="/docs/events" title="Events" subtitle="Dispatch events to synchronous and asynchronous listeners" icon="bell" >}}
{{< card link="/docs/queueing" title="Queueing" subtitle="Message queues with in-memory and database-backed drivers" icon="inbox" >}}
{{< card link="/docs/email" title="Email" subtitle="Send HTML and plain-text mail over SMTP" icon="mail" >}}
{{< /cards >}}

## Day to day

{{< cards >}}
{{< card link="/docs/logging" title="Logging" subtitle="Structured logging with `clog` and `log/slog`" icon="document-report" >}}
{{< card link="/docs/errors" title="Errors & Stack Traces" subtitle="Create errors that keep the stack trace of their origin" icon="exclamation-circle" >}}
{{< card link="/docs/streams" title="Streams" subtitle="Lazy, chainable sequences over `iter.Seq[T]`" icon="arrows-expand" >}}
{{< card link="/docs/openapi" title="OpenAPI & ReDoc" subtitle="Generate a spec from your Go types and serve ReDoc" icon="clipboard" >}}
{{< card link="/docs/testing" title="Testing" subtitle="Test handlers, routes, and the kernel itself" icon="check-circle" >}}
{{< /cards >}}

## Changelog

User-facing changes in each release are collected on the
[release notes](/docs/release-notes/) page, newest first.
