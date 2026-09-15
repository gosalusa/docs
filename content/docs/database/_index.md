---
title: Database
type: docs
prev: docs/getting-started
next: docs/database/models
sidebar:
  open: true
weight: 2
---

The database layer provides a type-safe ORM-style toolkit for working with SQL
databases in Go. It covers the full lifecycle: defining models, expressing
relationships between them, querying and mutating data with a fluent builder,
and managing schema changes with versioned migrations.

{{< cards >}}
{{< card link="/docs/database/models" title="Models" subtitle="Define Go structs that map to database tables" icon="table" >}}
{{< card link="/docs/database/relationships" title="Relationships" subtitle="Declare has-one, has-many, and belongs-to associations" icon="link" >}}
{{< card link="/docs/database/builder" title="Builder" subtitle="Fluent query builder for SELECT, UPDATE, and DELETE" icon="search" >}}
{{< card link="/docs/database/migrations" title="Migrations" subtitle="Versioned schema changes applied on startup" icon="database" >}}
{{< /cards >}}
