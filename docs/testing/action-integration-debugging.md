# Action Integration Testing Debugging Guide

Comprehensive guide to the action discovery integration testing utilities introduced across the INTTESDEB series.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Enhanced Test Bed Methods](#enhanced-test-bed-methods)
4. [Custom Jest Matchers](#custom-jest-matchers)
5. [Scope Tracing Utilities](#scope-tracing-utilities)
6. [Diagnostic Discovery](#diagnostic-discovery)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)

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

### Migration Tips

- Replace legacy manual entity creation with `createActorWithValidation()` to enforce component structure.
- Import `tests/common/actionMatchers.js` once per file to register matchers globally; avoid duplicate `expect.extend` calls.
- When migrating existing tests, start by swapping in the new bed while keeping assertions unchanged, then layer diagnostics to address flaky cases.

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

## Custom Jest Matchers

Import `tests/common/actionMatchers.js` once per file to auto-register the matchers with Jest.

### `toHaveAction`

- **Purpose**: Assert that a discovered action array (or `{ actions }` object) includes a specific action ID.
- **Failure Output**: Lists discovered actions, enumerates common pipeline failure points, and provides immediate debugging tips.
- **Usage**:

  ```javascript
  const result = await testBed.discoverActionsWithDiagnostics(actor);
  expect(result).toHaveAction('affection:place_hands_on_shoulders');
  ```

### `toDiscoverActionCount`

- **Purpose**: Assert the exact number of actions discovered.
- **Failure Output**: Differentiates between too few and too many actions with targeted causes (missing components, unexpected closeness, etc.).
- **Usage**:

  ```javascript
  const result = await testBed.discoverActionsWithDiagnostics(actor);
  expect(result).toDiscoverActionCount(3);
  ```

Both matchers accept either the `{ actions }` response object or the actions array directly.

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

### Custom Matchers

| Matcher | Signature | Description |
| --- | --- | --- |
| `toHaveAction` | `(resultOrActions, actionId) => JestMatcherResult` | Asserts that a discovery result includes the specified action. |
| `toDiscoverActionCount` | `(resultOrActions, expectedCount) => JestMatcherResult` | Asserts the number of discovered actions matches the expectation. |

### Scope Tracing Helpers

| Helper | Signature | Description |
| --- | --- | --- |
| `createTracedScopeResolver` | `(scopeResolver, traceContext) => object` | Wraps a resolver to capture scope evaluations in a trace. |
| `formatScopeEvaluationSummary` | `(traceContext) => string` | Converts captured scope evaluations into a readable summary. |
| `traceScopeEvaluation` | `({ scopeId, actor, scopeResolver, context? }) => { success, resolvedEntities?, error?, trace, summary }` | Runs a single scope evaluation with tracing. |

### Related Resources

- [Mod Testing Guide](./mod-testing-guide.md) – Pattern for building broader mod scenarios. Use this action debugging guide alongside the module builders.
- [Domain Matchers Guide](./domain-matchers-guide.md) – Additional Jest matchers for domain-specific assertions.
