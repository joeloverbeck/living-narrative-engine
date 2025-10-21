# Mod Testing Guide

## Overview

This guide is the canonical reference for writing and maintaining **mod action tests** in the Living Narrative Engine. It focuses on the Phase 1 and Phase 2 testing infrastructure that now powers every modern suite:

- [`ModTestFixture`](../../tests/common/mods/ModTestFixture.js) for fast action execution harnesses.
- Scenario builders from [`ModEntityScenarios`](../../tests/common/mods/ModEntityBuilder.js) for seated, inventory, and bespoke entity graphs.
- The validation proxy (`createActionValidationProxy`) for catching schema drift before the engine executes.
- Discovery diagnostics (`fixture.enableDiagnostics()`, `fixture.discoverWithDiagnostics()`) that surface resolver traces only when needed.
- Domain matchers from [`tests/common/mods/domainMatchers.js`](../../tests/common/mods/domainMatchers.js) for readable assertions.

Use this document alongside the [Action Discovery Testing Toolkit](./action-discovery-testing-toolkit.md) when a workflow crosses over into discovery-specific diagnostics or tracing.

## Quick Start

```javascript
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import '../../common/mods/domainMatchers.js';

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
  });
});
```

## Fixture API Essentials

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

### Static factory reference

| Method | Description | Key parameters | Returns |
| --- | --- | --- | --- |
| `forActionAutoLoad(modId, fullActionId, options?)` | Loads rule and condition JSON automatically. | `modId`, fully-qualified action ID, optional config overrides. | `ModActionTestFixture` |
| `forAction(modId, fullActionId, ruleFile?, conditionFile?)` | Creates an action fixture with explicit overrides. | `modId`, action ID, optional rule/condition JSON. | `ModActionTestFixture` |
| `forRule(modId, fullActionId, ruleFile?, conditionFile?)` | Targets resolver rules without executing the whole action. | `modId`, action ID, optional rule/condition JSON. | `ModActionTestFixture` |
| `forCategory(modId, options?)` | Builds a category-level harness for discovery-style assertions. | `modId`, optional configuration. | `ModCategoryTestFixture` |

### Core instance helpers

| Method | Purpose | Highlights |
| --- | --- | --- |
| `createStandardActorTarget([actorName, targetName])` | Creates reciprocal actor/target entities with validated components. | Use the returned IDs rather than hard-coded strings. |
| `createSittingPair(options)` and other scenario builders | Provision seating, inventory, and bespoke setups. | Prefer these helpers before writing custom entity graphs. |
| `executeAction(actorId, targetId, options?)` | Runs the action and captures emitted events. | Options support `additionalPayload`, `contextOverrides`, and validation toggles. |
| `assertActionSuccess(message)` / domain matchers | Provides backward-compatible assertions. | Prefer Jest matchers from `domainMatchers` for clearer failures. |
| `assertPerceptibleEvent(eventData)` | Validates perceptible event payloads. | Pair with event matchers when migrating legacy suites. |
| `clearEvents()` / `cleanup()` | Reset captured events and teardown resources. | Call `cleanup()` in `afterEach` to avoid shared state. |

**Usage notes**

- Always supply fully-qualified action IDs (e.g., `'intimacy:kiss_cheek'`).
- Scenario helpers eliminate the need for manual `ModEntityBuilder` usage; reach for them first.
- The fixture handles lifecycle resets—avoid reusing a fixture across tests unless you explicitly call `fixture.reset()`.
- Cleanup is mandatory: call `fixture.cleanup()` in `afterEach` blocks or shared helpers.

### Core Workflow

1. **Provision a fixture** with `ModTestFixture.forAction(modId, fullActionId, rule?, condition?, options?)`. The factory automatically loads JSON definitions when omitted.
2. **Create entities** via fixture helpers (`createSittingPair`, `createInventoryLoadout`, `createEntity`) or reset with custom graphs.
3. **Execute the action** using `await fixture.executeAction(actorId, targetId, { additionalPayload, contextOverrides })`.
4. **Assert outcomes** with domain matchers or direct entity inspection through `fixture.entityManager`.
5. **Clean up** using `fixture.cleanup()` to release mocks, events, and diagnostics state.

## Best Practices

### Fixture Lifecycle

- Await factory methods inside `beforeEach` blocks for isolation.
- Pair every fixture with `afterEach(() => fixture.cleanup())` or register cleanup in shared helpers.
- Prefer `forAction` over `forActionAutoLoad` when you need explicit control of rule/condition overrides or validation proxies.

### Scenario Composition

- Reach for the scenario helpers documented in the [Scenario Helper Catalog](#scenario-helper-catalog) before crafting entities manually. They guarantee component completeness and naming consistency.
- Use the `createSittingPair`, `createSittingArrangement`, and related helpers to cover seating variations; extend `additionalFurniture` or `seatedActors` overrides to exercise edge cases without rewriting the graph.
- Inventory flows should lean on `createInventoryLoadout`, `createPutInContainerScenario`, and friends. They expose entity IDs, containers, and held items so assertions stay declarative.
- When custom entities are inevitable, build them with `fixture.createEntity(config)` and reload the environment via `fixture.reset([...scenario.entities, customEntity])` to avoid partial state.

### Executing Actions Safely

- Always call `await fixture.executeAction(actorId, targetId, options?)`. The optional `options` object supports `additionalPayload`, `invocationOverrides`, and validation toggles; passing `{ skipValidation: true }` should be restricted to regression investigations.
- Validate `actorId` and `targetId` using scenario return values instead of hard-coded IDs—helper outputs are the single source of truth.
- Chain validation when preparing rules: wrap JSON definitions with `createActionValidationProxy(ruleJson, 'intimacy:kiss_cheek')` before handing them to the fixture. The proxy highlights typos (`required_components` vs `requiredComponents`) and missing namespace prefixes up front.

### Assertions & Matchers

- Import `../../common/mods/domainMatchers.js` once per suite. Expect to call `expect(fixture.events).toHaveActionSuccess(...)`, `expect(entity).toHaveComponent(...)`, and `expect(entity).toHaveComponentData(...)` during most flows.
- Mix matcher usage with targeted entity inspections; for example, read `fixture.entityManager.getEntityInstance(actorId)` to confirm component payloads after calling `executeAction`.
- Use `fixture.assertActionSuccess(message)` for legacy suites only when migrating gradually—new suites should standardize on the Jest matchers for clearer failure output.

### Diagnostics on Demand

- Toggle discovery tracing only while diagnosing failures:
  - `fixture.enableDiagnostics()` wraps the unified scope resolver.
  - `fixture.discoverWithDiagnostics(actorId, expectedActionId?)` streams summaries to stdout and returns the discovered actions.
  - Pair the output with the [Action Discovery Testing Toolkit](./action-discovery-testing-toolkit.md#working-with-diagnostics) when deeper scope tracing is required.
- Disable diagnostics in `afterEach` (or rely on `cleanup`) so subsequent tests remain silent.

### Anti-patterns to Avoid

- ❌ Creating fixtures with deprecated factories (`ModTestFixture.createFixture`, `ModTestHandlerFactory.createHandler`).
- ❌ Building entities manually without fixture scenario helpers, which leads to missing components and resolver failures.
- ❌ Hard-coding action IDs without namespaces—always use the `modId:action_id` format for validation proxy compatibility.
- ❌ Reusing fixtures across tests. Shared state hides ordering bugs; lean on fresh fixtures and scenario helpers instead.
- ❌ Asserting against raw event arrays without matchers. Prefer `toHaveActionSuccess`/`toHaveActionFailure` to reduce copy-pasted parsing code.

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

## Performance & Collaboration Tips

- Cache fixtures only within a test when execution is expensive. For repeated assertions, perform setup in `beforeEach` and reuse the same fixture instance across `it` blocks only when the suite resets via `fixture.reset()` explicitly.
- Use the validation proxy in pre-commit hooks or data-review scripts to catch schema drift before running the full suite.
- Organize suites with [`tests/common/mods/examples`](../../tests/common/mods/examples) as references—each example demonstrates a recommended combination of fixture, scenario helper, and matcher usage.

## Troubleshooting Appendix

### Validation Failures

- **Proxy errors** – When `createActionValidationProxy` reports invalid properties, follow the suggested replacement (e.g., rename `actionId` to `id`). Do not disable validation unless debugging third-party mods.
- **Namespace issues** – Errors referencing missing `:` separators indicate the action ID lacks a namespace. Update JSON definitions and fixture calls to include the prefix (e.g., `positioning:sit_down`).

### Discovery & Execution Failures

- **Action missing from discovery** – Enable diagnostics: `const diagnostics = fixture.enableDiagnostics(); diagnostics.discoverWithDiagnostics(actorId, 'mod:action');`. Review scope summaries printed to stdout and consult the [diagnostics section](./action-discovery-testing-toolkit.md#working-with-diagnostics) for interpretation tips.
- **Empty target scopes** – Scenario helpers guarantee valid scopes. If diagnostics show empty scopes, confirm overrides did not remove required components or that `scenario.furniture` IDs match the executed target.
- **Execution throws for unknown entity** – Ensure the entity exists by using scenario return IDs or calling `fixture.reset([entity])` before `executeAction`.

### Matcher Failures

- **`toHaveActionSuccess` undefined** – Import `../../common/mods/domainMatchers.js` at the suite top or in `jest.setup.js`.
- **Component mismatch output is noisy** – Pair matchers with targeted logging: `console.log(fixture.entityManager.getEntityInstance(actorId).components)` during debugging, then remove the log after resolution.

### Diagnostics Hygiene

- After enabling diagnostics, call `fixture.disableDiagnostics()` or rely on `fixture.cleanup()` to restore the resolver. Lingering wrappers can cause duplicate logging in unrelated tests.
- When capturing stdout snapshots, wrap diagnostics in conditionals to avoid brittle tests: `if (process.env.DEBUG_DISCOVERY) { fixture.discoverWithDiagnostics(actorId); }`.

## Action Test Checklist

Use this checklist before submitting a mod test update:

- [ ] Fixture created via `await ModTestFixture.forAction(modId, fullActionId)` (or another explicit factory) inside `beforeEach`.
- [ ] Entities provisioned with fixture scenario helpers or `createEntity`—no raw object literals sprinkled throughout the test.
- [ ] Action executed with `await fixture.executeAction(actorId, targetId, options?)` using scenario-provided IDs.
- [ ] Assertions leverage `domainMatchers` (`toHaveActionSuccess`, `toHaveComponent`, `toHaveComponentData`) or clearly document deviations.
- [ ] Validation proxy exercised for new or modified rule JSON before running the suite.
- [ ] Diagnostics enabled only in targeted tests and cleaned up after use.
- [ ] Checklist items documented in the test description or comments when deviations are intentional.

By consolidating these practices in a single guide, contributors can author reliable mod tests without rediscovering patterns across individual suites.
