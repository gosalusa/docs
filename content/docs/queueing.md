---
title: Queueing
type: docs
prev: docs/events
next: docs/streams
weight: 10
---

The [`pubsub`](https://pkg.go.dev/gosalusa.com/pubsub) package defines the interfaces for message queues, and
[`channelpubsub`](https://pkg.go.dev/gosalusa.com/pubsub/channelpubsub) and [`dbpubsub`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub) provide two implementations: an in-memory
channel backend and a durable database-backed queue.

## The interfaces

```go
type PubSub interface {
	Topic(name string) Topic
}

type Topic interface {
	Enqueue(ctx context.Context, data []byte) error
	Dequeue(ctx context.Context) (Message, error)
	Close() error
}

type Message interface {
	ID() string
	Data() []byte
	Ack(ctx context.Context) error
	Nack(ctx context.Context) error
}
```

A [`PubSub`](https://pkg.go.dev/gosalusa.com/pubsub#PubSub) hands out named [`Topic`](https://pkg.go.dev/gosalusa.com/pubsub#Topic)s. `Dequeue` blocks until a message is
available or the context is canceled. `Message.Ack` marks a message as
processed (it can be deleted or marked finished); `Message.Nack` signals
failure and re-queues it.

[`RegisterTopic(ctx)`](https://pkg.go.dev/gosalusa.com/pubsub#RegisterTopic) registers a [`pubsub.Topic`](https://pkg.go.dev/gosalusa.com/pubsub#Topic) dependency whose name comes
from the inject tag, backed by whatever [`pubsub.PubSub`](https://pkg.go.dev/gosalusa.com/pubsub#PubSub) is registered:

```go
type Handler struct {
	Queue pubsub.Topic `inject:"orders"`
}
```

## channelpubsub: in-memory

[`channelpubsub.New()`](https://pkg.go.dev/gosalusa.com/pubsub/channelpubsub#New) returns a `PubSub` backed by Go channels per topic. It is
the default in the generated template:

```go
channelpubsub.Register(ctx)
```

Messages are held in an unbuffered-per-topic channel with a capacity of 10;
`Nack` puts the message back on the same channel. Because everything lives in
process, enqueued messages are lost if the server restarts and only apps in the
same process can share a topic.

## dbpubsub: database-backed

[`dbpubsub.New(update)`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub#New) persists messages to a table. [`Register`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub#Register) is the
bootstrap consumer:

```go
di.RegisterLazySingletonWith(ctx, func(u database.Update) (pubsub.PubSub, error) {
	return New(u), nil
})
```

Each message is an [`Event`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub#Event) row with a `topic`, `run_at`, `status`, `data`, and
`retries` count. [`Enqueue`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub#Topic.Enqueue) inserts a row with status `pending`; [`Dequeue`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub#Topic.Dequeue)
claims the oldest pending row for the topic with `FOR UPDATE SKIP LOCKED`,
flipping it to `processing`, and polls once a second until one is ready.
[`Ack`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub#Message.Ack) marks the row `finished`, and [`Nack`](https://pkg.go.dev/gosalusa.com/pubsub/dbpubsub#Message.Nack) returns it to `pending` and schedules
it for a retry using an exponential falloff delay.

Because the queue lives in the database, messages survive restarts and topics
are shared by every process connected to the same database — including
multiple application servers. The `events` table is created by the migrations
in this package.

## Injecting topics

Whichever backend is registered, [`pubsub.RegisterTopic`](https://pkg.go.dev/gosalusa.com/pubsub#RegisterTopic) wires up a named
`Topic` for injection. The `event` package builds on this: [`event.Register`](https://pkg.go.dev/gosalusa.com/event#Register)
registers a `Dispatch` over the injected topic, and [`event.Service`](https://pkg.go.dev/gosalusa.com/event#Service) consumes a
topic, so events and jobs can be routed through the channel or database queue
by changing a single bootstrap call.