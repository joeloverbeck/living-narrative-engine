# Mod Testing Guide

## Overview

This guide is the canonical reference for writing and maintaining **mod action tests** in the Living Narrative Engine. It unifies the fixture, scenario, discovery, and matcher guidance so authors have a single source of truth when building or modernizing suites. Every contemporary mod test relies on the following building blocks:

- [`ModTestFixture`](../../tests/common/mods/ModTestFixture.js) for fast action execution harnesses.
- Scenario builders from [`ModEntityScenarios`](../../tests/common/mods/ModEntityBuilder.js) for seated, inventory, and bespoke entity graphs.
- The validation proxy (`createActionValidationProxy`) for catching schema drift before the engine executes.
- Discovery tooling (`fixture.enableDiagnostics()`, `fixture.discoverWithDiagnostics()`, and the Action Discovery Bed helpers) for resolver introspection.
- Domain matchers from [`tests/common/mods/domainMatchers.js`](../../tests/common/mods/domainMatchers.js) and [`tests/common/actionMatchers.js`](../../tests/common/actionMatchers.js) for readable assertions.

The companion [Action Discovery Testing Toolkit](./action-discovery-testing-toolkit.md) now focuses on migration checklists and upgrade strategy while pointing back to the API summaries captured here.

## Quick Start

```javascript
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import '../../common/mods/domainMatchers.js';
import '../../common/actionMatchers.js';

describe('positioning:sit_down', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('makes the actor sit on the target furniture', async () => {
    const scenario = fixture.createSittingPair({ furnitureId: 'couch1' });

    await fixture.executeAction(
      scenario.seatedActors[0].id,
      scenario.furniture.id
    );

    const actor = fixture.entityManager.getEntityInstance(scenario.seatedActors[0].id);
    expect(actor).toHaveComponent('positioning:sitting_on');
    expect(fixture.events).toHaveActionSuccess();
  });
});
```

## Core Infrastructure

### Fixture API Essentials

The modern fixture factories replace the deprecated `ModTestFixture.createFixture()` and `ModTestHandlerFactory.createHandler()` helpers. Always await the static constructors and let the fixture manage entity creation.

```javascript
// ✅ Preferred pattern
const fixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:sit_down'
);
const scenario = fixture.createStandardActorTarget(['Actor Name', 'Target Name']);
await fixture.executeAction(scenario.actor.id, scenario.target.id);

// ❌ Deprecated and unsupported
ModTestFixture.createFixture({ type: 'action' });
ModTestHandlerFactory.createHandler({ actionId: 'sit_down' });
new ModEntityBuilder(); // Missing ID and validation
```

| Method | Description | Key parameters | Returns |
| --- | --- | --- | --- |
| `forActionAutoLoad(modId, fullActionId, options?)` | Loads rule and condition JSON automatically. | `modId`, fully-qualified action ID, optional config overrides. | `ModActionTestFixture` |
| `forAction(modId, fullActionId, ruleFile?, conditionFile?)` | Creates an action fixture with explicit overrides. | `modId`, action ID, optional rule/condition JSON. | `ModActionTestFixture` |
| `forRule(modId, fullActionId, ruleFile?, conditionFile?)` | Targets resolver rules without executing the whole action. | `modId`, action ID, optional rule/condition JSON. | `ModActionTestFixture` |
| `forCategory(modId, options?)` | Builds a category-level harness for discovery-style assertions. | `modId`, optional configuration. | `ModCategoryTestFixture` |

#### Core instance helpers

| Method | Purpose | Highlights |
| --- | --- | --- |
| `createStandardActorTarget([actorName, targetName])` | Creates reciprocal actor/target entities with validated components. | Use the returned IDs rather than hard-coded strings. |
| `createSittingPair(options)` and other scenario builders | Provision seating, inventory, and bespoke setups. | Prefer these helpers before writing custom entity graphs. |
| `executeAction(actorId, targetId, options?)` | Runs the action and captures emitted events. | Options include `additionalPayload`, `originalInput`, `skipDiscovery`, `skipValidation`, and multi-target IDs such as `secondaryTargetId`. |
| `assertActionSuccess(message)` / legacy assertions | Provides backward-compatible assertions. | Prefer Jest matchers from `domainMatchers` for clearer failures. |
| `assertPerceptibleEvent(eventData)` | Validates perceptible event payloads. | Pair with event matchers when migrating legacy suites. |
| `clearEvents()` / `cleanup()` | Reset captured events and teardown resources. | Call `cleanup()` in `afterEach` to avoid shared state. |

**Usage notes**

- Always supply fully-qualified action IDs (e.g., `'intimacy:kiss_cheek'`).
- Scenario helpers eliminate the need for manual `ModEntityBuilder` usage; reach for them first.
- The fixture handles lifecycle resets—avoid reusing a fixture across tests unless you explicitly call `fixture.reset()`.
- Cleanup is mandatory: call `fixture.cleanup()` in `afterEach` blocks or shared helpers.

### Action Discovery Harness

The Action Discovery Bed complements the mod fixture when suites need to inspect resolver behavior or migrate legacy discovery suites.

```javascript
import { createActionDiscoveryBed } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import '../../common/actionMatchers.js';

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

| Helper | Purpose | Notes |
| --- | --- | --- |
| `createActionDiscoveryBed()` | Provision a validated bed with mocks, logging capture, and diagnostics toggles. | Pair with manual lifecycle management when suites need custom setup. |
| `describeActionDiscoverySuite(title, suiteFn, overrides?)` | Wrap `describe` to automate bed setup/teardown. | Ideal when modernizing multiple suites. |
| `createActorWithValidation(actorId, options)` | Build validated actors through `ModEntityBuilder`. | Use to mix custom entities with bed-managed fixtures. |
| `createActorTargetScenario(options)` | Produce an actor/target pair sharing a location with optional `closeProximity`. | Mirrors fixture scenario helpers. |
| `establishClosenessWithValidation(actor, target)` | Adds reciprocal `positioning:closeness` components safely. | Avoid manual component wiring. |
| `discoverActionsWithDiagnostics(actorOrId, options?)` | Run discovery and optionally capture `{ actions, diagnostics }`. | Set `includeDiagnostics` or `traceScopeResolution` only when needed. |
| `formatDiagnosticSummary(diagnostics)` | Present captured diagnostics for logging or snapshots. | Use when assertions fail to surface detailed traces. |
| `createDiscoveryServiceWithTracing(options?)` | Instantiate `ActionDiscoveryService` with tracing toggles. | Helpful for targeted debugging. |
| `getDebugLogs()`/`getInfoLogs()`/`getWarningLogs()`/`getErrorLogs()` | Retrieve captured log messages. | Enables log-based assertions without touching console output. |
| `createTracedScopeResolver(scopeResolver, traceContext)` | Wrap resolvers to capture per-scope decisions. | Use with `formatScopeEvaluationSummary(traceContext)`. |

#### Modernizing discovery suites

1. **Update imports** – Replace manual `SimpleEntityManager` wiring with `createActionDiscoveryBed()` and register the matchers module.
2. **Instantiate the bed** – Use `beforeEach` or `describeActionDiscoverySuite()` to avoid shared state.
3. **Rebuild entities** – Call `createActorTargetScenario()` and `createActorWithValidation()` for validated setup; mix legacy helpers after the bed seeds core entities.
4. **Establish relationships** – Use `establishClosenessWithValidation()` rather than mutating component maps.
5. **Run discovery** – `await testBed.discoverActionsWithDiagnostics(actor)`; enable diagnostics only while debugging.
6. **Assert with matchers** – Swap `.some()` loops for domain matchers such as `toHaveAction` and `toDiscoverActionCount`.
7. **Log selectively** – Format diagnostics with `formatDiagnosticSummary()` and guard logging so passing runs remain quiet.

### Diagnostics & Logging

- Call `fixture.enableDiagnostics()` only while investigating failures. Clean up with `fixture.disableDiagnostics()` or `fixture.cleanup()`.
- `fixture.discoverWithDiagnostics(actorId, expectedActionId?)` funnels discovery through the fixture and returns trace summaries.
- The Action Discovery Bed exposes the same diagnostics payload through `discoverActionsWithDiagnostics()`; format traces with `formatDiagnosticSummary()` or `formatScopeEvaluationSummary()`.
- Guard diagnostic logging with environment checks (e.g., `if (process.env.DEBUG_DISCOVERY)`) to keep standard runs silent.
- Use the captured log accessors (`getDebugLogs()`, `getInfoLogs()`, etc.) instead of reading from `console` output.

### Domain Matchers

Import the relevant matcher modules once per suite to unlock expressive assertions.

| Matcher | Module | Best used for |
| --- | --- | --- |
| `toHaveActionSuccess(message?)` | `../../common/mods/domainMatchers.js` | Confirm successful action execution events. |
| `toHaveActionFailure()` | `../../common/mods/domainMatchers.js` | Assert the absence of success events. |
| `toHaveComponent(componentType)` / `toNotHaveComponent(componentType)` | `../../common/mods/domainMatchers.js` | Verify component presence on entities. |
| `toHaveComponentData(componentType, expectedData)` | `../../common/mods/domainMatchers.js` | Deep-match component payloads. |
| `toDispatchEvent(eventType)` | `../../common/mods/domainMatchers.js` | Validate emitted event types. |
| `toHaveAction(actionId)` | `../../common/actionMatchers.js` | Check that discovery included a specific action. |
| `toDiscoverActionCount(expectedCount)` | `../../common/actionMatchers.js` | Assert exact discovery counts. |
| `toHaveActionSuccess(message)` (discovery event form) | `../../common/actionMatchers.js` | Match action success events captured via the bed. |
| `toHaveComponent(componentType)` (entity matcher variant) | `../../common/actionMatchers.js` | Assert entity components when using the discovery bed. |
| `toBeAt(locationId)` | `../../common/actionMatchers.js` | Assert entity location relationships. |

Mix matcher usage with targeted entity inspections; for example, call `fixture.entityManager.getEntityInstance(actorId)` to inspect component payloads directly.

## Best Practices

### Fixture Lifecycle

- Await factory methods inside `beforeEach` blocks for isolation.
- Pair every fixture with `afterEach(() => fixture.cleanup())` or register cleanup in shared helpers.
- Prefer `forAction` over `forActionAutoLoad` when you need explicit control of rule/condition overrides or validation proxies.

### Scenario Composition

- Reach for the scenario helpers documented in the [Scenario Helper Catalog](#scenario-helper-catalog) before crafting entities manually. They guarantee component completeness and naming consistency.
- Use `createSittingPair`, `createSittingArrangement`, and related helpers to cover seating variations; extend `additionalFurniture` or `seatedActors` overrides to exercise edge cases without rewriting the graph.
- Inventory flows should lean on `createInventoryLoadout`, `createPutInContainerScenario`, and related helpers. They expose entity IDs, containers, and held items so assertions stay declarative.
- When custom entities are inevitable, build them with `fixture.createEntity(config)` and reload the environment via `fixture.reset([...scenario.entities, customEntity])` to avoid partial state.

### Executing Actions Safely

- Always call `await fixture.executeAction(actorId, targetId, options?)`. The optional `options` object supports `additionalPayload`, `originalInput`, `skipDiscovery`, `skipValidation`, and extra identifiers such as `secondaryTargetId` or `tertiaryTargetId`; restrict `{ skipValidation: true }` to regression investigations.
- Validate `actorId` and `targetId` using scenario return values instead of hard-coded IDs—helper outputs are the single source of truth.
- Chain validation when preparing rules: wrap JSON definitions with `createActionValidationProxy(ruleJson, 'intimacy:kiss_cheek')` before handing them to the fixture. The proxy highlights typos (`required_components` vs `requiredComponents`) and missing namespace prefixes up front.

### Assertions & Anti-patterns

- Favor matcher-based assertions over manual array parsing or `.some()` checks.
- Avoid creating fixtures with deprecated factories (`ModTestFixture.createFixture`, `ModTestHandlerFactory.createHandler`).
- Do not build entities manually without fixture scenario helpers; missing components lead to resolver failures.
- Never hard-code action IDs without namespaces—always use the `modId:action_id` format for validation proxy compatibility.
- Do not reuse fixtures across tests without an explicit `fixture.reset()`.

## Tool Selection Guide

```text
┌────────────────────────────────────────────┐
│ Do you need to run an action end-to-end?   │
└───────────────┬────────────────────────────┘
                │ Yes
                ▼
┌────────────────────────────────────────────┐
│ Can ModEntityScenarios build the entities? │
└───────────────┬────────────────────────────┘
                │ Yes                            No
                ▼                                 ▼
┌─────────────────────────────┐         ┌──────────────────────────────┐
│ Use ModTestFixture scenario │         │ Build custom entities with   │
│ helpers (e.g., createSitting│         │ fixture.createEntity + reset │
│ Pair, createInventoryLoadout│         │ then reuse executeAction     │
└─────────────────────────────┘         └──────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────┐
│ Did the action fail validation or resolve? │
└───────────────┬────────────────────────────┘
                │ Validation issue            Resolver issue
                ▼                             ▼
┌────────────────────────────┐       ┌─────────────────────────────────┐
│ Wrap JSON with              │      │ Enable diagnostics +            │
│ createActionValidationProxy │      │ discoverWithDiagnostics(actorId)│
└────────────────────────────┘       └─────────────────────────────────┘
```

## Scenario Helper Catalog

Scenario helpers pair fixtures with curated entity graphs. Each helper is available both on the fixture instance (`fixture.createSittingPair`) and as a static method on `ModEntityScenarios`. Prefer the fixture instance methods when already operating inside a test harness.

### Seating Scenarios

| Helper | Best for |
| --- | --- |
| `createSittingArrangement(options)` | Full control over seated, standing, and kneeling actors plus additional furniture. |
| `createSittingPair(options)` | Reciprocal seating relationships and closeness metadata for two actors sharing furniture. |
| `createSoloSitting(options)` | Sit/stand transitions where only one actor occupies a seat. |
| `createStandingNearSitting(options)` | Mixed posture scenarios with standing companions (including `standing_behind`). |
| `createSeparateFurnitureArrangement(options)` | Multiple furniture entities populated in a single call for comparison tests. |
| `createKneelingBeforeSitting(options)` | Seated actor plus kneeling observers linked by `positioning:kneeling_before`. |

```javascript
const scenario = fixture.createSittingPair({
  furnitureId: 'couch1',
  seatedActors: [
    { id: 'alice', name: 'Alice', spotIndex: 0 },
    { id: 'bob', name: 'Bob', spotIndex: 1 },
  ],
});

await fixture.executeAction(
  scenario.seatedActors[0].id,
  scenario.furniture.id
);

const actor = fixture.entityManager.getEntityInstance('alice');
expect(actor).toHaveComponentData('positioning:sitting_on', {
  furniture_id: scenario.furniture.id,
  spot_index: 0,
});
expect(actor.components['positioning:closeness'].partners).toContain('bob');
```

Usage tips:

- Override `seatedActors`, `standingActors`, or `kneelingActors` to control IDs, display names, and seat indices.
- Set `closeSeatedActors: false` when actors should sit apart without automatic closeness metadata.
- Provide `additionalFurniture` to preload extra seating surfaces for comparative assertions.
- Call `ModEntityScenarios.createSittingPair()` directly when building entities for cross-fixture reuse.

### Inventory Scenarios

| Helper | Purpose |
| --- | --- |
| `createInventoryLoadout(options)` | Actor with populated inventory and default capacity for ownership tests. |
| `createItemsOnGround(options)` | Loose items positioned in a room with optional observing actor. |
| `createContainerWithContents(options)` | Containers pre-filled with contents and optional key metadata. |
| `createInventoryTransfer(options)` | Two actors configured for `items:give_item` style transfers. |
| `createDropItemScenario(options)` | Actor ready to drop an owned item. |
| `createPickupScenario(options)` | Actor and ground item setup for `items:pick_up_item`. |
| `createOpenContainerScenario(options)` | Actor, container, and optional key for `items:open_container`. |
| `createPutInContainerScenario(options)` | Actor holding an item plus container prepared for storage actions. |

```javascript
const scenario = fixture.createPutInContainerScenario({
  actor: { id: 'actor_putter' },
  container: { id: 'supply_crate' },
  item: { id: 'supply', weight: 0.5 },
});

await fixture.executeAction('actor_putter', 'supply_crate', {
  additionalPayload: { secondaryId: scenario.heldItem.id },
});
```

Customization reference:

- **Capacity overrides** – Supply `capacity: { maxWeight, maxItems }` to loadout helpers; container helpers accept the same shape via `capacity` or `container.capacity`.
- **Locked containers** – Provide `requiresKey: true` (or `locked: true`) and include a `keyItem` to ensure the actor starts with the unlocking item.
- **Full inventories/containers** – Set `fullInventory: true` or `containerFull: true` to exercise capacity failure branches.
- **Item metadata** – Populate `itemData`, `portableData`, `weightData`, and `components` for precise assertions.

## Troubleshooting & Diagnostics Hygiene

### Validation Failures

- **Proxy errors** – When `createActionValidationProxy` reports invalid properties, follow the suggested replacement (e.g., rename `actionId` to `id`). Do not disable validation unless debugging third-party mods.
- **Namespace issues** – Errors referencing missing `:` separators indicate the action ID lacks a namespace. Update JSON definitions and fixture calls to include the prefix (e.g., `positioning:sit_down`).

### Discovery & Execution Failures

- **Action missing from discovery** – Enable diagnostics through the fixture or discovery bed, then review scope summaries. Empty operator/scope traces usually indicate missing components or closeness relationships.
- **Empty target scopes** – Scenario helpers guarantee valid scopes. If diagnostics show empty scopes, confirm overrides did not remove required components and that target IDs match the executed entity.
- **Execution throws for unknown entity** – Ensure the entity exists by using scenario return IDs or calling `fixture.reset([entity])` before `executeAction`.

### Matcher Failures

- **Matchers undefined** – Import `../../common/mods/domainMatchers.js` and/or `../../common/actionMatchers.js` at the suite top or in `jest.setup.js`.
- **Noisy component mismatch output** – Pair matchers with targeted logging during debugging (`console.log(fixture.entityManager.getEntityInstance(actorId).components)`), then remove the log after resolution.

### Diagnostics Hygiene

- Disable diagnostics after use (`fixture.disableDiagnostics()` or `fixture.cleanup()`). Lingering wrappers cause duplicate logging in unrelated tests.
- When capturing stdout snapshots, wrap diagnostics in conditionals to avoid brittle tests: `if (process.env.DEBUG_DISCOVERY) { fixture.discoverWithDiagnostics(actorId); }`.

## Performance & Collaboration Tips

- Cache fixtures only within a test when execution is expensive. For repeated assertions, perform setup in `beforeEach` and reuse the same fixture instance across `it` blocks only when the suite resets via `fixture.reset()` explicitly.
- Use the validation proxy in pre-commit hooks or data-review scripts to catch schema drift before running the full suite.
- Organize suites with [`tests/common/mods/examples`](../../tests/common/mods/examples) as references—each example demonstrates a recommended combination of fixture, scenario helper, and matcher usage.

## Action Test Checklist

Use this checklist before submitting a mod test update:

- [ ] Fixture created via `await ModTestFixture.forAction(modId, fullActionId)` (or another explicit factory) inside `beforeEach`.
- [ ] Entities provisioned with fixture scenario helpers or `createEntity`—no raw object literals sprinkled throughout the test.
- [ ] Action executed with `await fixture.executeAction(actorId, targetId, options?)` using scenario-provided IDs.
- [ ] Assertions leverage domain/discovery matchers (`toHaveActionSuccess`, `toHaveComponent`, `toHaveAction`, etc.) or clearly document deviations.
- [ ] Validation proxy exercised for new or modified rule JSON before running the suite.
- [ ] Diagnostics enabled only in targeted tests and cleaned up after use.
- [ ] Checklist items documented in the test description or comments when deviations are intentional.

By consolidating these practices in a single guide, contributors can author reliable mod tests without rediscovering patterns across individual suites.
