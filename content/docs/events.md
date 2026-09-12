---
title: Events
type: docs
prev: docs/authentication
next: docs/queueing
weight: 9
---

The `event` package lets applications emit events and process them asynchronously
through listeners. Events are dispatched to a pubsub topic, where an `EventService`
dequeues them and runs each listener registered for the event's type.

## Defining an event

An `Event` just needs a stable `Type` string and fields that gob can encode:

```go
type LogEvent struct {
	Message string
}

func (e *LogEvent) Type() event.EventType {
	return "template:log"
}
```

The event type prefix is sent with the payload so the service can decode the
right struct. Types must be registered on the listening side; an unknown type
produces `ErrEventTypeNotFound`.

## Emitting events

`Dispatch` is a function that enqueues an event on a pubsub topic. The
`event.Register(ctx)` bootstrap step registers a `Dispatch` whose topic is
taken from the inject tag name (`with.Topic(tag)`), so a handler injects the
dispatch function and emits events by calling it:

```go
type UserCreatedHandler struct {
	Dispatch event.Dispatch `inject:"users"`
}

func (h *UserCreatedHandler) Handle(ctx context.Context, e *UserCreated) error {
	return h.Dispatch(ctx, &UserCreated{
		Message: "a new user signed up",
	})
}
```

Around an event service, the dispatch used is the pubsub topic the service
listens to, so dispatched events are picked up by the listeners.

## Listening

A listener is a struct with a `Handle(ctx, event)` method and optional `inject`
fields. `NewListener[H, E]` binds a handler type to its event type:

```go
type LogJob struct {
	Logger *slog.Logger `inject:""`
}

func (l *LogJob) Handle(ctx context.Context, e *LogEvent) error {
	l.Logger.Info(e.Message)
	return nil
}

event.NewListener[*LogJob, *LogEvent]()
```

The kernel runs an `EventService` built with `Service(listeners...)`:

```go
kernel.Services(
	event.Service(
		event.NewListener[*jobs.LogJob](),
	),
)
```

The service dequeues messages from its pubsub topic in a loop and runs every
matching handler in its own goroutine, filling each handler's inject fields
from the dependency provider. After a handler finishes the message is
acknowledged. Handlers that error are logged and the message is still acked, so
the event is not redelivered.

## Duplicating events

Since several applications can listen on the same topic, each event gets a
copy for every listener; a listener that is shared across apps runs on every
consumer.

## Scheduling with cron

The `event/cron` package provides an `Event` that carries its fire time and a
`CronService` that dispatches events on a schedule:

```go
kernel.Services(
	cron.Service().
		Schedule("* * * * *", &events.LogEvent{Message: "cron event"}),
)
```

`Schedule(cronSpec, event)` registers an event for a cron expression. When the
schedule fires, the service sets the event's time with `SetTime` and dispatches
it. A cron event embeds `cron.CronEvent` (or implements `SetTime` itself) so
the handler can read when it fired:

```go
type LogEvent struct {
	cron.CronEvent
	Message string
}

type LogJob struct{}

func (l *LogJob) Handle(ctx context.Context, e *LogEvent) error {
	e.Time // when the event fired
	return nil
}
```