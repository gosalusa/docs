---
title: Salusa
toc: false
---

Salusa is a free, open source web framework for Go. It's built to speed up
full-stack development by wiring together the HTTP layer, services, config, and
dependency graph into a single cohesive framework. Its packages can also be
used individually in existing projects when you only need one piece.

## Explore

{{< cards >}}
{{< card link="docs/getting-started" title="Docs" icon="book-open" >}}
{{< card link="about" title="About" icon="user" >}}
{{< /cards >}}

## Key modules

Some of the most important parts of the framework:

{{< cards >}}
{{< card link="docs/application" title="Application & Kernel" subtitle="Wires the HTTP handler, services, config, and dependency graph together" icon="chip" >}}
{{< card link="docs/database" title="Database" subtitle="Models, migrations, and a query builder for your data layer" icon="database" >}}
{{< card link="docs/routing" title="Routing" subtitle="A gorilla/mux wrapper with middleware, named routes, and URL generation" icon="switch-horizontal" >}}
{{< card link="docs/requests" title="Requests & Responses" subtitle="Turn HTTP requests into typed structs and back into JSON responses" icon="switch-vertical" >}}
{{< card link="docs/authentication" title="Authentication" subtitle="Drop-in JWT auth with login, signup, password resets, and email verification" icon="lock-closed" >}}
{{< card link="docs/dependency-injection" title="Dependency Injection" subtitle="The core container that resolves dependencies via inject tags" icon="beaker" >}}
{{< /cards >}}

