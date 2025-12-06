# AsyncUtilitiesToolkit

The `AsyncUtilitiesToolkit` centralizes debounce/throttle helpers plus timer lifecycle management for the BaseCharacterBuilderController refactor program (see `reports/base-character-builder-controller-refactoring.md`).

## Capabilities

- Debounce and throttle helpers with `leading`, `trailing`, and optional `maxWait` semantics.
- Namespaced handler registries so services can reuse debounced or throttled callbacks by key.
- Timer lifecycle management covering `setTimeout`, `setInterval`, and `requestAnimationFrame` with deterministic cleanup.
- Instrumented stats reporting so destruction hooks and observability dashboards can query outstanding async work.

## Configuration

The constructor accepts the following options:

| Option                           | Type      | Default | Description                                                                          |
| -------------------------------- | --------- | ------- | ------------------------------------------------------------------------------------ |
| `logger`                         | `ILogger` | —       | Required logger used for instrumentation and error reporting.                        |
| `defaultWait`                    | `number`  | `100`   | Default wait when helpers are invoked without an explicit delay.                     |
| `instrumentation.logTimerEvents` | `boolean` | `false` | When true, emits debug logs for every timer schedule/clear event to aid diagnostics. |

### Debounce/Throttle Options

Both `debounce()` and `throttle()` accept an `options` object:

- `leading` – Execute on the leading edge of the delay window.
- `trailing` – Execute on the trailing edge (defaults to `true` for debounce, `true` for throttle).
- `maxWait` – Debounce-only guard that forces execution when a call has been deferred for too long.

## Timer Stats Shape

`getTimerStats()` returns the structure below so lifecycle orchestrators can log pending work before destruction:

```ts
{
  timeouts: {
    count: number,
    entries: Array<{ id: number, delay: number, createdAt: number }>
  },
  intervals: {
    count: number,
    entries: Array<{ id: number, delay: number, createdAt: number }>
  },
  animationFrames: { count: number },
  handlers: {
    debounced: number,
    throttled: number,
  },
}
```

`clearAllTimers()` returns a summary object with the counts `{ timers, intervals, animationFrames, debouncedHandlers, throttledHandlers }` after canceling outstanding work.

## Sharing the Toolkit

Other services can reuse the controller's shared toolkit instance without importing controller internals by calling the helper exports:

```js
import {
  registerToolkitForOwner,
  getToolkitForOwner,
  unregisterToolkitForOwner,
} from 'src/characterBuilder/services/asyncUtilitiesToolkit.js';
```

- Controllers register themselves via `registerToolkitForOwner(this, toolkit)` and unregister during destruction.
- Downstream services (e.g., lifecycle hooks) can call `getToolkitForOwner(controllerInstance)` to access the shared timers for advanced cleanup or instrumentation.

## Usage Tips

- Always prefer `_getAsyncUtilitiesToolkit()` inside controllers when new helpers need access to async utilities.
- `EventListenerRegistry` automatically consumes the toolkit's `debounce`/`throttle` adapters, so no signature changes are required for existing registry APIs.
- Lifecycle cleanup should call `clearAllTimers()` before destroying services to keep instrumentation consistent across the refactor program.
