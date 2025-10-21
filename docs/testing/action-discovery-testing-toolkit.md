# Action Discovery Testing Toolkit

Comprehensive reference for the action discovery integration test bed, diagnostics helpers, and domain-specific Jest matchers. Use this document as the single entry point for modernizing discovery suites and writing expressive assertions.

## Overview

- **Test bed lifecycle** – `createActionDiscoveryBed()` and `describeActionDiscoverySuite()` wrap setup/teardown with validated entity builders.
- **Scenario helpers** – One-line creation of actors, targets, and relationships (including closeness) with automatic validation.
- **Diagnostics on demand** – Structured traces, scope summaries, and formatted logs for deep dives when assertions fail.
- **Domain matchers** – Action, event, and entity matchers registered via `tests/common/actionMatchers.js` with rich error output.
- **Migration guidance** – Decision matrix and workflow to transition legacy suites without repeating boilerplate instructions across multiple docs.

## Quick Start

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js'; // Registers domain matchers once per suite

describe('my action suite', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('discovers the action for nearby actors', async () => {
    const { actor } = testBed.createActorTargetScenario();

    const result = await testBed.discoverActionsWithDiagnostics(actor);

    expect(result).toHaveAction('affection:place_hands_on_shoulders');
  });
});
```

## Modernization Checklist

| Priority | Indicators | First steps |
| --- | --- | --- |
| **High** | Manual `SimpleEntityManager` wiring, hand-built closeness components, bespoke logging. | Replace setup with `createActionDiscoveryBed()` and import matchers. Migrate one representative test end-to-end. |
| **Medium** | Stable suites still crafting entities by hand. | Adopt `createActorTargetScenario()` for setup, then phase in custom matchers. |
| **Low** | Experimental suites or factories that conflict with the bed. | Defer migration or wrap legacy helpers inside the bed incrementally. |

### Why migrate?

- Validation catches component drift immediately through `ModEntityBuilder.validate()`.
- Matchers eliminate repetitive `.some()` assertions and surface detailed diagnostics.
- Diagnostics are opt-in—enable tracing only when a test misbehaves.

## Core Utilities

All helpers live in `tests/common/actions/actionDiscoveryServiceTestBed.js` unless noted.

### Lifecycle

- **`createActionDiscoveryBed()`** – Returns a fully configured bed with mocks, logging capture, and validation enabled.
- **`describeActionDiscoverySuite(title, suiteFn, overrides?)`** – Wraps `describe()` to provision and clean up the bed automatically.
- **`testBed.cleanup()`** – Reset logs and mocks when managing the lifecycle manually.

### Scenario Builders

- **`createActorWithValidation(actorId, options)`** – Validates components and registers the actor.
- **`createActorTargetScenario(options)`** – Produces an actor/target pair sharing a location with optional `closeProximity` wiring.
- **`establishClosenessWithValidation(actor, target)`** – Adds reciprocal `positioning:closeness` components safely.
- Mix bespoke factories by creating core entities with the bed and then applying legacy helpers.

### Discovery & Diagnostics

- **`discoverActionsWithDiagnostics(actorOrId, options?)`** – Async discovery that optionally returns `{ actions, diagnostics }`.
  - `includeDiagnostics: true` captures logs, operator evaluations, and scope evaluations.
  - `traceScopeResolution: true` wraps the resolver to record per-scope behavior.
- **`formatDiagnosticSummary(diagnostics)`** – Formats captured diagnostics for logging or snapshots.

### Service Factories & Logs

- **`createDiscoveryServiceWithTracing(options?)`** – Instantiate `ActionDiscoveryService` with tracing toggles.
- **`createStandardDiscoveryService()`** – Baseline service without tracing.
- **`getDebugLogs()` / `getInfoLogs()` / `getWarningLogs()` / `getErrorLogs()`** – Retrieve captured log messages.
- **`getCreatedTraceType()`** – Assert whether a structured or action-aware trace factory executed.

### Scope Tracing Helpers (`tests/common/scopeDsl/scopeTracingHelpers.js`)

- **`createTracedScopeResolver(scopeResolver, traceContext)`** – Wrap resolvers to capture decisions inside a provided trace.
- **`formatScopeEvaluationSummary(traceContext)`** – Human-readable summary of scope evaluations.
- **`traceScopeEvaluation({ scopeId, actor, scopeResolver, context })`** – Single-run trace helper for custom resolvers.

## Migration Workflow

1. **Update imports** – Replace manual entity manager wiring with `createActionDiscoveryBed()` and register the matchers module.
2. **Instantiate the bed** – Use `beforeEach` or `describeActionDiscoverySuite()` to avoid shared state.
3. **Rebuild entities** – Call `createActorTargetScenario()` and `createActorWithValidation()` for validated setup.
4. **Establish relationships** – Use `establishClosenessWithValidation()` instead of mutating component maps.
5. **Run discovery** – Always `await testBed.discoverActionsWithDiagnostics()`; pass diagnostics flags only when needed.
6. **Assert with matchers** – Swap `.some()` loops for the domain matchers listed below.
7. **Log selectively** – Guard `formatDiagnosticSummary()` output with length checks so passing runs stay quiet.
8. **Blend legacy helpers** – If a bespoke factory is required, call it after the bed has seeded core entities.

### Example transformation

```javascript
// Before
const entityManager = new SimpleEntityManager();
const service = new ActionDiscoveryService({ entityManager, /* mocks */ });
// ...manual entity creation and assertions...

// After
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

const testBed = createActionDiscoveryBed();
const { actor } = testBed.createActorTargetScenario();
const result = await testBed.discoverActionsWithDiagnostics(actor);

expect(result).toHaveAction('affection:place_hands_on_shoulders');
```

## Working with Diagnostics

Enable diagnostics when a matcher fails or behavior diverges from expectations:

```javascript
const result = await testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
  traceScopeResolution: true,
});

if (result.diagnostics?.operatorEvaluations?.length) {
  console.log(testBed.formatDiagnosticSummary(result.diagnostics));
}
```

- **Logs** – Ordered trace statements captured during discovery.
- **Operator evaluations** – Success state for each prerequisite/operator check.
- **Scope evaluations** – Candidate vs. resolved counts, filtered totals, and errors.
- Pair with `formatScopeEvaluationSummary()` for verbose per-scope output during deep investigations.

## Domain Matchers

Register `tests/common/actionMatchers.js` once per suite (e.g., in `jest.setup.js` or at the top of the test file). The module augments Jest with matchers that understand Living Narrative Engine structures.

### Action discovery matchers

- **`toHaveAction(actionId)`** – Asserts that a discovery result includes a specific action. Failure output lists discovered actions and common pipeline issues.
- **`toDiscoverActionCount(expectedCount)`** – Checks the exact number of discovered actions with guidance for over/under counts.

### Event matchers

- **`toHaveActionSuccess(message)`** – Confirms that an action success event fired with the expected message.
- **`toHaveActionFailure()`** – Ensures no success event fired, useful for negative scenarios.
- **`toDispatchEvent(eventType)`** – Validates that a particular event type was dispatched.

### Entity matchers

- **`toHaveComponent(componentType)`** – Confirms an entity gained the specified component.
- **`toNotHaveComponent(componentType)`** – Asserts that a component is absent.
- **`toHaveComponentData(componentType, expectedData)`** – Partial/deep matches for component payloads.
- **`toBeAt(locationId)`** – Asserts the entity's location component references the expected room/location.

## Common Patterns

```javascript
// Basic discovery assertion
const { actor } = testBed.createActorTargetScenario();
const result = await testBed.discoverActionsWithDiagnostics(actor);
expect(result).toHaveAction('movement:go');
expect(result).toDiscoverActionCount(3);
```

```javascript
// Proximity-gated action
const { actor, target } = testBed.createActorTargetScenario({ closeProximity: false });
let result = await testBed.discoverActionsWithDiagnostics(actor);
expect(result).not.toHaveAction('affection:embrace');

testBed.establishClosenessWithValidation(actor, target);
result = await testBed.discoverActionsWithDiagnostics(actor);
expect(result).toHaveAction('affection:embrace');
```

```javascript
// Mixing legacy helpers
const { actor } = testBed.createActorTargetScenario();
const legacyTarget = legacyFactory.buildTarget(testBed.entityManager);
testBed.establishClosenessWithValidation(actor, legacyTarget);
const result = await testBed.discoverActionsWithDiagnostics(actor, { includeDiagnostics: true });
expect(result.actions).toEqual(expect.any(Array));
```

## Troubleshooting

| Symptom | What it means | Fix |
| --- | --- | --- |
| `toHaveAction` is undefined | Matchers module not imported | Import `tests/common/actionMatchers.js` at suite setup. |
| `Cannot establish closeness` error | Entity missing from the manager | Build both entities via bed helpers before linking. |
| Action unexpectedly missing | Pipeline filtered the action or prerequisites failed | Enable diagnostics and inspect operator/scope evaluations. |
| Empty diagnostics payload | Tracing not enabled | Pass `includeDiagnostics: true` (and optionally `traceScopeResolution`). |
| Excess actions discovered | Scenario includes extra targets or relationships | Review closeness setup and adjust builder input. |

## Related Resources

- [Mod Testing Guide](./mod-testing-guide.md) – Broader module-builder architecture for mod suites.
- [Test utilities directory](../../tests/common/actions/actionDiscoveryServiceTestBed.js) – Source of the helpers referenced here.
- [Scope tracing helpers](../../tests/common/scopeDsl/scopeTracingHelpers.js) – Low-level tracing utilities used by the bed.
