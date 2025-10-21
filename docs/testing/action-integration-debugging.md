# Action Integration Testing Debugging Guide

Comprehensive guide to the action discovery integration testing utilities introduced across the INTTESDEB series.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Migration Decision Guide](#migration-decision-guide)
4. [Migration Workflow](#migration-workflow)
5. [Enhanced Test Bed Methods](#enhanced-test-bed-methods)
6. [Scope Tracing Utilities](#scope-tracing-utilities)
7. [Diagnostic Discovery](#diagnostic-discovery)
8. [Common Patterns](#common-patterns)
9. [Migration Pitfalls](#migration-pitfalls)
10. [Troubleshooting](#troubleshooting)
11. [API Reference](#api-reference)

## Overview

### What This Guide Covers

This guide documents the integration test debugging improvements implemented to reduce debugging time from 2–4 hours to 15–30 minutes through:

- **Enhanced validation** (INTTESDEB-001): Catch entity structure bugs during setup with builder validation.
- **Custom matchers** (INTTESDEB-002): Detailed error messages for assertion failures.
- **Test bed helpers** (INTTESDEB-003): One-line scenario setup with closeness handling.
- **Scope tracing** (INTTESDEB-004/005): Deep visibility into scope resolution decisions.
- **Diagnostic discovery** (INTTESDEB-006): Structured traces and summaries for each run.

### Benefits

- ✅ Entity structure bugs caught immediately with `ModEntityBuilder.validate()`.
- ✅ Clear, actionable error messages from custom Jest matchers.
- ✅ 50–70% less setup code per test when using `createActorTargetScenario()`.
- ✅ Complete visibility into scope and operator evaluation pipelines.
- ✅ Faster iteration via summarized diagnostics and targeted troubleshooting recipes.

## Quick Start

### Minimum Setup

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js'; // Auto-extends Jest

describe('My Action Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('should discover action for target', async () => {
    const { actor } = testBed.createActorTargetScenario();

    const result = await testBed.discoverActionsWithDiagnostics(actor);

    expect(result).toHaveAction('my:action');
  });
});
```

### Recommended Pattern

1. **Create the bed in `beforeEach`** using `createActionDiscoveryBed()` to isolate state between tests.
2. **Use scenario helpers** like `createActorTargetScenario()` to build validated entities with shared locations.
3. **Opt-in to diagnostics** by setting `{ includeDiagnostics: true, traceScopeResolution: true }` during discovery when investigating a failure.
4. **Summarize trace output** through `testBed.formatDiagnosticSummary(result.diagnostics)` or `formatScopeEvaluationSummary(trace)` for quick inspection.
5. **Clean up automatically** – the helper resets mocks between runs via the bed's lifecycle hooks, but call `testBed.cleanup()` explicitly when creating beds outside of Jest lifecycle utilities.
6. **Reuse domain matchers** from the [Domain Matchers Guide](./domain-matchers-guide.md#action-discovery-matchers) for readable assertions instead of repeating matcher documentation here.

## Migration Decision Guide

Modernize suites when the new helpers materially reduce setup cost or unlock validation currently performed by hand. Use the
matrix below to prioritize migration work across large files.

### Prioritization Matrix

| Priority | Indicators | Recommended first steps |
| --- | --- | --- |
| **High** | Repeated manual `SimpleEntityManager` wiring, duplicated closeness setup, flaky proximity assertions, or hand-written diagnostic logging. | Replace imports with `createActionDiscoveryBed` and register `../../common/actionMatchers.js`. Migrate one representative test end-to-end to validate the new flow. |
| **Medium** | Stable tests that still manually seed entities or call `ActionDiscoveryService` directly. | Adopt `createActorTargetScenario()` for actors/targets while keeping existing assertions. Introduce matchers once helpers feel comfortable. |
| **Low** | Experimental suites, pending refactors, or bespoke entity factories that conflict with the bed. | Defer until surrounding code stabilizes or wrap legacy setup inside the bed through partial migration (see [Common Patterns](#common-patterns)). |

### Why Migrate

- **Validation without boilerplate** – `createActorWithValidation()` and `createActorTargetScenario()` enforce component
  structure and location wiring automatically.
- **Expressive assertions** – Matchers from [Domain Matchers Guide](./domain-matchers-guide.md#action-discovery-matchers)
  collapse several `.some()` checks into a single expectation with rich diagnostics.
- **Diagnostics on demand** – `discoverActionsWithDiagnostics()` exposes `{ actions, diagnostics }` so you can capture traces
  only when needed.
- **Shared terminology** – Suites using the bed align with the documentation and debugging recipes in this guide.

### Backward Compatibility

Legacy helper factories (for example, `tests/common/mockFactories/entities.js`) continue to work beside the bed. Gradually wrap
bespoke builders by passing their outputs into `testBed.entityManager` or by seeding additional components after the scenario
helpers run.

### Gradual Adoption Strategy

1. Update imports and instantiate the bed while leaving original assertions untouched.
2. Swap manual entity creation for `createActorTargetScenario()` or `createActorWithValidation()` to gain validation coverage.
3. Replace bespoke assertions with custom matchers once discovery calls return the same results.
4. Introduce diagnostics (`includeDiagnostics`, `traceScopeResolution`) only on problematic tests so fast paths stay lightweight.
5. Remove leftover mocks or factories when the bed covers the configuration they provided.

## Migration Workflow

Follow these steps when transforming a legacy integration test. All helpers referenced here live in
`tests/common/actions/actionDiscoveryServiceTestBed.js`.

1. **Update imports** – Remove direct `SimpleEntityManager`, manual mock factories, and bespoke logger wiring. Import
   `createActionDiscoveryBed` plus the shared matchers from `tests/common/actionMatchers.js`.
2. **Instantiate the bed** – Create the bed in `beforeEach` (or use `describeActionDiscoverySuite`) to reset mocks and state for
   every spec.
3. **Rebuild entities with validation** – Replace manual calls to `entityManager.createEntity()` with `createActorTargetScenario()`
   or `createActorWithValidation()` so that IDs, locations, and components are validated automatically.
4. **Establish relationships** – Use `establishClosenessWithValidation()` for reciprocal proximity requirements instead of
   editing `positioning:closeness` components manually.
5. **Discover actions asynchronously** – Call `await testBed.discoverActionsWithDiagnostics(actor, options)`; it always returns
   `{ actions, diagnostics? }`. Pass `{ includeDiagnostics: true }` when you need structured traces and add
   `traceScopeResolution: true` for flaky scope bugs.
6. **Assert with custom matchers** – Replace `.some()` checks with matchers such as `toHaveAction` or `toDiscoverActionCount`.
   Refer to the [Domain Matchers Guide](./domain-matchers-guide.md#action-discovery-matchers) for matcher details rather than
   re-documenting them locally.
7. **Log diagnostics safely** – Guard `formatDiagnosticSummary()` behind a length check so quiet runs stay silent:

   ```javascript
   if (result.diagnostics?.operatorEvaluations?.length) {
     logger.info(testBed.formatDiagnosticSummary(result.diagnostics));
   }
   ```

8. **Mix legacy helpers when needed** – Inject bespoke component factories after calling the scenario helper to ease partial
   migrations.

### Example Transformation

The snippet below demonstrates a complete migration from manual wiring to the shared bed utilities. It reflects the real helper
names and async behavior used throughout the action discovery suites.

```javascript
// BEFORE: manual SimpleEntityManager wiring
import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import {
  createMockActionIndex,
  createMockLogger,
  createMockTargetResolutionService,
} from '../../common/mockFactories/index.js';

describe('Place Hands on Shoulders Action', () => {
  let entityManager;
  let service;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();
    service = new ActionDiscoveryService({
      entityManager,
      logger: createMockLogger(),
      actionPipelineOrchestrator: {
        discoverActions: jest.fn().mockResolvedValue({ actions: [] }),
      },
      actionIndex: createMockActionIndex(),
      targetResolutionService: createMockTargetResolutionService(),
    });
  });

  it('discovers the action when actors are close', async () => {
    const actor = entityManager.createEntity('actor1');
    entityManager.addComponent('actor1', 'core:name', { text: 'Alice' });
    entityManager.addComponent('actor1', 'core:position', { locationId: 'tavern' });
    entityManager.addComponent('actor1', 'positioning:standing', {});

    const target = entityManager.createEntity('target1');
    entityManager.addComponent('target1', 'core:name', { text: 'Bob' });
    entityManager.addComponent('target1', 'core:position', { locationId: 'tavern' });

    entityManager.addComponent('actor1', 'positioning:closeness', { partners: ['target1'] });
    entityManager.addComponent('target1', 'positioning:closeness', { partners: ['actor1'] });

    const result = await service.getValidActions(actor, {});
    const hasAction = result.actions.some(
      (action) =>
        action.id === 'affection:place_hands_on_shoulders' &&
        action.targetId === 'target1'
    );

    expect(hasAction).toBe(true);
  });
});
```

```javascript
// AFTER: ActionDiscoveryServiceTestBed helpers
import { describe, it, beforeEach, expect } from '@jest/globals';
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

describe('Place Hands on Shoulders Action', () => {
  let testBed;

  beforeEach(() => {
    testBed = createActionDiscoveryBed();
  });

  it('discovers the action when actors are close', async () => {
    const { actor } = testBed.createActorTargetScenario({
      location: 'tavern',
      actorComponents: {
        'core:name': { text: 'Alice' },
        'positioning:standing': {},
      },
      targetComponents: {
        'core:name': { text: 'Bob' },
      },
    });

    const result = await testBed.discoverActionsWithDiagnostics(actor, {
      includeDiagnostics: true,
    });

    expect(result).toHaveAction('affection:place_hands_on_shoulders');
  });
});
```

**Measured improvements**

- **Lines of setup** drop from 32 to 16 (~50% reduction) while preserving actor/target intent.
- **Validation coverage** increases because entity components run through `ModEntityBuilder.validate()` automatically.
- **Diagnostics opt-in** delivers actionable traces without hand-written logging when `includeDiagnostics` is enabled.

### Partial Migration Checklist

- Keep bespoke factories by calling them after `createActorTargetScenario()` and mutating the returned entities.
- Wrap lingering `ActionDiscoveryService` calls with `testBed.createDiscoveryServiceWithTracing()` so you can consolidate trace
  handling.
- Move repeated setup into helper functions once two or more tests share the same migration pattern.

## Enhanced Test Bed Methods

All helpers live in `tests/common/actions/actionDiscoveryServiceTestBed.js` and are exposed through `createActionDiscoveryBed()` and `describeActionDiscoverySuite()`.

### Lifecycle Helpers

- **`createActionDiscoveryBed()`** – Instantiates `ActionDiscoveryServiceTestBed` with default mocks, logging capture, and validation enabled. Use this in unit/integration suites.
- **`describeActionDiscoverySuite(title, suiteFn, overrides?)`** – Wraps `describe()` with automatic bed creation/cleanup. The suite callback receives a configured bed instance.
- **`testBed.cleanup()`** – Resets captured logs, mocks, and trace state. Call when constructing the bed manually (e.g., in `beforeAll` scenarios) to avoid cross-test contamination.

### Entity and Relationship Builders

- **`createActorWithValidation(actorId, options)`**
  - Validates components via `ModEntityBuilder.validate()` before inserting into the in-memory `SimpleEntityManager`.
  - `options.components` accepts a component map (e.g., `{ 'core:stats': { strength: 3 } }`).
  - `options.location` defaults to `'test-location'`; omit or override to match your scenario.
- **`createActorTargetScenario(options)`**
  - Produces an actor/target pair sharing a location with optional `closeProximity` setup.
  - Accepts separate `actorComponents` and `targetComponents` overrides.
  - Returns re-fetched entities so closeness mutations are visible immediately.
- **`establishClosenessWithValidation(actor, target)`**
  - Adds reciprocal `positioning:closeness` components after asserting both entities exist in the manager.
  - Accepts either entity IDs or entity objects.

### Discovery and Diagnostics

- **`discoverActionsWithDiagnostics(actor, options)`**
  - Resolves the actor entity and executes `ActionDiscoveryService.getValidActions()`.
  - `options.includeDiagnostics` (default `false`) enables `TraceContext` capture for logs, operator evaluations, and scope evaluations.
  - `options.traceScopeResolution` wraps the active scope resolver with `createTracedScopeResolver()` to collect per-scope detail.
  - Returns `{ actions, diagnostics? }` where `actions` is always an array.
- **`formatDiagnosticSummary(diagnostics)`**
  - Converts logs, operator evaluations, and scope evaluations into a readable multi-section string for quick logging.

### Service Factory Utilities

- **`createDiscoveryServiceWithTracing(options)`**
  - Generates an `ActionDiscoveryService` instance configured for tracing scenarios (custom trace factories, action-aware tracing, captured logs).
  - Options toggle trace verbosity, which traced actions to include, and simulate factory failures for negative tests.
- **`createStandardDiscoveryService()`**
  - Returns a baseline `ActionDiscoveryService` using default mocks—useful when bypassing the bed helpers.
- **`getDebugLogs()`, `getInfoLogs()`, `getWarningLogs()`, `getErrorLogs()`**
  - Expose logs captured by the mocked logger after running `createDiscoveryServiceWithTracing()`.
- **`getCreatedTraceType()`**
  - Reports the last trace type generated (structured vs. action-aware) to assert tracing configuration.
- **`createMockActor(actorId)` / `createMockContext()`**
  - Lightweight factory helpers for targeted unit tests that do not require full entity setup.

## Scope Tracing Utilities

Located in `tests/common/scopeDsl/scopeTracingHelpers.js` and intended for deep dives into scope evaluation behavior.

### `createTracedScopeResolver(scopeResolver, traceContext)`

Wraps an existing scope resolver to:

- Log each resolution attempt and result within the provided `TraceContext`.
- Capture `candidateEntities`, `resolvedEntities`, and error information for each scope.
- Surface success/failure summaries through the shared trace.

### `formatScopeEvaluationSummary(traceContext)`

- Produces a human-readable breakdown of all captured scope evaluations.
- Highlights counts of candidates, resolved entities, and filtered entities per scope.
- Returns `'No scope evaluations captured'` when no tracing is enabled, so you can guard log statements.

### `traceScopeEvaluation({ scopeId, actor, scopeResolver, context })`

- Single-shot helper that instantiates a fresh `TraceContext`, wraps the resolver, executes `resolve()`, and returns `{ success, resolvedEntities?, error?, trace, summary }`.
- Ideal for unit testing custom scope resolvers without the full action pipeline.

## Diagnostic Discovery

### Capturing Diagnostics

Enable diagnostics when a matcher fails or behavior is unexpected:

```javascript
const result = await testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
  traceScopeResolution: true,
});

console.log(testBed.formatDiagnosticSummary(result.diagnostics));
```

- **Logs**: Ordered trace statements (info/debug/warn/error) captured during discovery.
- **Operator Evaluations**: Each prerequisite/operator check with success flags.
- **Scope Evaluations**: Candidate vs. resolved entity counts, filtered totals, and failures.

### Interpreting Summaries

- Start with **Errors** to see thrown exceptions or missing components.
- Review **Operator Evaluations** to confirm prerequisite success.
- Use **Scope Evaluations** to understand why targets disappeared (filtered vs. resolved counts).
- Combine with `formatScopeEvaluationSummary(trace)` from scope helpers for verbose per-scope context.

### Persisting or Asserting on Diagnostics

- Snapshot `testBed.formatDiagnosticSummary()` output for regression coverage when debugging tricky pipelines.
- Assert on `result.diagnostics.operatorEvaluations` length to ensure certain prerequisite branches executed.
- Feed `result.diagnostics.scopeEvaluations` into custom visualization tools when analyzing bulk scenarios.

## Common Patterns

### Basic Discovery Assertion

```javascript
const { actor } = testBed.createActorTargetScenario();
const result = await testBed.discoverActionsWithDiagnostics(actor);

expect(result).toHaveAction('movement:go');
expect(result).toDiscoverActionCount(3);
```

### Testing Proximity-Gated Actions

```javascript
const { actor, target } = testBed.createActorTargetScenario({ closeProximity: false });

let result = await testBed.discoverActionsWithDiagnostics(actor);
expect(result).not.toHaveAction('affection:embrace');

testBed.establishClosenessWithValidation(actor, target);
result = await testBed.discoverActionsWithDiagnostics(actor);
expect(result).toHaveAction('affection:embrace');
```

### Validating Component-Driven Restrictions

```javascript
const { actor } = testBed.createActorTargetScenario({
  actorComponents: {
    'core:stats': { strength: 1 },
  },
});

const result = await testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
});

expect(result).not.toHaveAction('combat:power_attack');
console.log(testBed.formatDiagnosticSummary(result.diagnostics));
```

### Deep Scope Debugging

```javascript
const traceResult = traceScopeEvaluation({
  scopeId: 'actor.location.exits[]',
  actor,
  scopeResolver: testBed.mocks.scopeResolver,
  context: { candidates: ['hallway', 'courtyard'] },
});

expect(traceResult.success).toBe(true);
expect(traceResult.resolvedEntities).toContain('hallway');
```

### Combining Service Factory Helpers

```javascript
const tracingService = testBed.createDiscoveryServiceWithTracing({
  actionTracingEnabled: true,
  tracedActions: ['*'],
});

await tracingService.getValidActions(actor, {});
expect(testBed.getDebugLogs()).toContainEqual(
  expect.stringContaining('Resolved 2 entities')
);
```

### Migrating Multi-Target Scenarios

```javascript
const { actor, target } = testBed.createActorTargetScenario({
  location: 'bazaar',
  closeProximity: false,
});

const rival = testBed.createActorWithValidation('rival', {
  location: 'bazaar',
  components: {
    'core:name': { text: 'Rival' },
    'positioning:standing': {},
  },
});

testBed.establishClosenessWithValidation(actor, target);
testBed.establishClosenessWithValidation(actor, rival);

const result = await testBed.discoverActionsWithDiagnostics(actor);

expect(result).toHaveAction('affection:place_hands_on_shoulders');
expect(result.actions.filter((action) => action.targetId === rival.id)).toHaveLength(1);
```

- Use `createActorTargetScenario()` for the primary pair, then add additional entities with `createActorWithValidation()`.
- `establishClosenessWithValidation()` keeps reciprocal components synchronized so proximity-gated actions resolve for each target.
- Combine matcher assertions with targeted array filters to validate per-target outcomes without rebuilding manual loops.

### Handling Posture or Facing Requirements

```javascript
const { actor, target } = testBed.createActorTargetScenario({
  actorComponents: {
    'core:name': { text: 'Alice' },
    'positioning:kneeling': {},
  },
  targetComponents: {
    'core:name': { text: 'Bob' },
    'positioning:facing': { direction: 'north' },
  },
});

const result = await testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
});

if (result.diagnostics?.scopeEvaluations?.length) {
  console.log(testBed.formatDiagnosticSummary(result.diagnostics));
}

expect(result).not.toHaveAction('combat:shield_bash');
```

- Override posture or facing components directly through the helper options instead of mutating entities after creation.
- Validation catches mismatched entity IDs or missing posture components before discovery runs.
- Scoped diagnostics highlight when a posture requirement filters targets unexpectedly.

### Custom Components or Partial Migrations

```javascript
const { actor } = testBed.createActorTargetScenario({
  actorComponents: {
    'core:name': { text: 'Scout' },
  },
});

const legacyTarget = legacyFactory.buildTarget(testBed.entityManager); // existing helper

testBed.establishClosenessWithValidation(actor, legacyTarget);

const result = await testBed.discoverActionsWithDiagnostics(actor, {
  includeDiagnostics: true,
  traceScopeResolution: true,
});

if (result.diagnostics?.operatorEvaluations?.length) {
  console.log(testBed.formatDiagnosticSummary(result.diagnostics));
}

expect(result.actions).toEqual(expect.any(Array));
```

- Mix legacy factories with the bed by passing their entities into `testBed.entityManager` or relationship helpers.
- Guard diagnostic summaries with length checks to avoid noisy logs in passing runs.
- Use `{ traceScopeResolution: true }` temporarily to confirm hybrid setups still satisfy scope rules.

## Migration Pitfalls

- **Skipping matcher imports** – Forgetting to import `../../common/actionMatchers.js` means expectations silently fall back to
  vanilla Jest behavior. If `toHaveAction` is undefined, verify the import lives at the top of the file.
- **Missing awaits on discovery** – `discoverActionsWithDiagnostics` is async; omitting `await` yields unresolved promises and
  empty action arrays. Enable ESLint's `no-floating-promises` rule or search for `testBed.discoverActionsWithDiagnostics(` after
  migration.
- **Manual closeness without validation** – Directly mutating `positioning:closeness` skips reciprocal validation and commonly
  leaves orphaned partner IDs. Always use `establishClosenessWithValidation()` when actors share proximity.
- **Diagnostics everywhere** – Leaving `{ includeDiagnostics: true, traceScopeResolution: true }` on every test increases runtime
  and log noise. Restrict tracing to flaky specs and guard `formatDiagnosticSummary()` calls behind length checks.
- **Legacy factories missing IDs** – When mixing bespoke builders, ensure they respect the IDs passed into the bed helpers; run
  `testBed.createActorWithValidation()` first to generate IDs, then hydrate additional components.
- **Overlapping entity managers** – Instantiating `SimpleEntityManager` manually while also using the bed leads to entities being
  registered in different stores. Prefer the bed's `entityManager` or ensure both helpers write to the same instance.

### Debugging Checklist

1. Re-run the test with `{ includeDiagnostics: true }` and inspect `testBed.formatDiagnosticSummary()` for missing prerequisites.
2. Toggle `traceScopeResolution` to confirm scope filters match expectations; compare outputs with
   `formatScopeEvaluationSummary()` when necessary.
3. Validate custom entities via `createActorWithValidation()` before they participate in relationships.
4. Confirm action matchers target the correct actor/target by logging `result.actions.map((action) => action.targetId)` once per
   suite during migration and deleting the log after verification.
5. For performance issues, wrap expensive diagnostics in `if (process.env.DEBUG_ACTIONS)` blocks so CI remains quiet.

## Troubleshooting

| Symptom | What It Means | How to Resolve |
| --- | --- | --- |
| `Cannot establish closeness` error | Actor or target not registered with the entity manager | Ensure both entities were created via `createActorWithValidation()` before calling `establishClosenessWithValidation()` |
| `Cannot discover actions: Actor 'X' not found` | Discovery ran before the entity was added | Use the return value from helper methods or call `createActorWithValidation()` prior to discovery |
| `Action 'foo' not discovered` despite expectation | Pipeline filtered the action or prerequisites failed | Enable diagnostics, inspect operator/scope evaluations, verify required components and closeness relationships |
| Empty scope evaluations | Scope tracing not enabled | Pass `traceScopeResolution: true` to `discoverActionsWithDiagnostics()` or use `traceScopeEvaluation()` |
| Trace factory failure errors | Intentional negative test or misconfigured tracing options | Check `createDiscoveryServiceWithTracing()` options—set `traceContextFactoryFailure: false` for happy-path tests |
| Unexpected extra actions | Scenario includes more targets or relationships than anticipated | Review closeness setup and scope summaries, then adjust builder input or matcher expectations |

## API Reference

### Action Discovery Test Bed

| Method | Signature | Description |
| --- | --- | --- |
| `createActionDiscoveryBed` | `() => ActionDiscoveryServiceTestBed` | Factory that returns a fully configured test bed with default mocks. |
| `describeActionDiscoverySuite` | `(title, suiteFn, overrides?) => void` | Wraps `describe()` with automatic bed management. |
| `createActorWithValidation` | `(actorId, { components?, location? }?) => object` | Builds, validates, and registers an actor entity. |
| `createActorTargetScenario` | `({ actorId?, targetId?, location?, closeProximity?, actorComponents?, targetComponents? }?) => { actor, target }` | Generates a ready-to-test actor/target pair. |
| `establishClosenessWithValidation` | `(actorOrId, targetOrId) => void` | Adds reciprocal closeness components with validation. |
| `discoverActionsWithDiagnostics` | `(actorOrId, { includeDiagnostics?, traceScopeResolution? }?) => Promise<{ actions, diagnostics? }>` | Runs discovery and optionally returns diagnostics. |
| `formatDiagnosticSummary` | `(diagnostics) => string` | Produces a multi-section diagnostic summary. |
| `createDiscoveryServiceWithTracing` | `(options?) => ActionDiscoveryService` | Returns a service configured for tracing scenarios. |
| `createStandardDiscoveryService` | `() => ActionDiscoveryService` | Creates a baseline service with default mocks. |
| `getDebugLogs` / `getInfoLogs` / `getWarningLogs` / `getErrorLogs` | `() => string[]` | Access captured log messages after tracing runs. |
| `getCreatedTraceType` | `() => string` | Indicates whether a structured or action-aware trace factory was used. |
| `createMockActor` | `(actorId) => { id, components }` | Lightweight actor object for unit tests. |
| `createMockContext` | `() => object` | Minimal context object for orchestrator tests. |
| `cleanup` | `() => void` | Resets the bed to its initial state. |

### Scope Tracing Helpers

| Helper | Signature | Description |
| --- | --- | --- |
| `createTracedScopeResolver` | `(scopeResolver, traceContext) => object` | Wraps a resolver to capture scope evaluations in a trace. |
| `formatScopeEvaluationSummary` | `(traceContext) => string` | Converts captured scope evaluations into a readable summary. |
| `traceScopeEvaluation` | `({ scopeId, actor, scopeResolver, context? }) => { success, resolvedEntities?, error?, trace, summary }` | Runs a single scope evaluation with tracing. |

### Related Resources

- [Mod Testing Guide](./mod-testing-guide.md) – Pattern for building broader mod scenarios. Use this action debugging guide alongside the module builders.
- [Domain Matchers Guide](./domain-matchers-guide.md) – Additional Jest matchers for domain-specific assertions.
