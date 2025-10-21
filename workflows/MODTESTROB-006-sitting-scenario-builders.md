# MODTESTROB-006: High-Level Scenario Builders - Sitting Arrangements

**Status:** Ready for Implementation
**Priority:** P1 (High)
**Estimated Time:** 3-4 hours
**Risk Level:** Low
**Phase:** 2 - Developer Experience

---

## Overview

Create high-level scenario builder functions that set up common sitting arrangement patterns with a single function call, eliminating repetitive setup code in positioning action tests.

### Problem Statement

Current sitting arrangement setup is verbose and repetitive:

```javascript
// Current approach - 20-30 lines for a simple two-person sitting setup
const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

const furniture = new ModEntityBuilder('couch1')
  .withName('Comfy Couch')
  .atLocation('room1')
  .withComponent('positioning:allows_sitting', {
    spots: ['actor1', 'actor2'],
  })
  .build();

const actor1 = new ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .asActor()
  .withComponent('positioning:sitting_on', {
    furniture_id: 'couch1',
    spot_index: 0,
  })
  .build();

const actor2 = new ModEntityBuilder('actor2')
  .withName('Bob')
  .atLocation('room1')
  .asActor()
  .withComponent('positioning:sitting_on', {
    furniture_id: 'couch1',
    spot_index: 1,
  })
  .build();

testFixture.reset([room, furniture, actor1, actor2]);
```

### Target State

High-level scenario functions with clear semantics:

```javascript
// New approach - intent-revealing helper on the fixture itself
const scenario = testFixture.createSittingPair({
  locationId: 'living_room',
  furnitureId: 'couch1',
});

const actor = testFixture.entityManager.getEntityInstance(scenario.seatedActors[0].id);
expect(actor.components['positioning:sitting_on'].furniture_id).toBe('couch1');
```

### Benefits

- **90% reduction** in setup code for common scenarios
- **Self-documenting** tests - scenario name explains the setup
- **Consistency** - same scenarios used across all tests
- **Reusability** - complex setups available everywhere
- **Maintainability** - change scenario logic in one place

---

## Prerequisites

**Required Understanding:**
- ModTestFixture helper methods and reset workflow
- Sitting/standing component system
- Furniture and seating slot mechanics
- Position and facing components

**Required Files:**
- `tests/common/mods/ModTestFixture.js`
- Existing `given` helper methods
- Domain matchers (from MODTESTROB-005)

**Development Environment:**
- Jest testing framework
- Node.js 20+ with ES modules

---

## Detailed Steps

### Step 1: Create Sitting Scenario Builder

Enhance `tests/common/mods/ModEntityBuilder.js` by extending the `ModEntityScenarios` helper with dedicated sitting utilities that build on the existing `ModEntityBuilder` fluent API.

1. **Add a general-purpose factory.** Introduce `ModEntityScenarios.createSittingArrangement(options = {})` that assembles:
   - An optional room entity (respecting an `includeRoom` flag similar to other helpers).
   - A furniture entity with the `positioning:allows_sitting` component whose `spots` array is computed from the requested seating slots.
   - One `ModEntityBuilder` instance per seated actor. Each actor should receive `positioning:sitting_on` with `{ furniture_id, spot_index }`, inherit sensible defaults for names and IDs, and opt into `closeToEntity` relationships when the scenario declares that the actors are sitting close together.
   - Optional extras for standing, kneeling, or additional observers. For example:
     - `standingActors`: create actors with `positioning:standing` and optionally `positioning:standing_behind` when `behindTargetId` is provided.
     - `kneelingActors`: add `positioning:kneeling_before` and reuse `closeToEntity` to keep proximity metadata consistent.

   Return a structured object `{ room, furniture, seatedActors, standingActors, kneelingActors, entities }` where `entities` is the ordered list you can feed directly to `testFixture.reset(...)`.

2. **Layer convenience wrappers on top of the core factory.** Provide methods such as:
   - `createSittingPair(options = {})` → two actors sharing a couch with defaults (`actor1`, `actor2`, `couch1`, `room1`).
   - `createSoloSitting(options = {})` → single actor occupying a chair.
   - `createStandingNearSitting(options = {})` → one seated actor plus a standing partner that remains close via `closeToEntity`.
   - `createSeparateFurnitureArrangement(options = {})` → two actors on different furniture entities in the same room.
   - `createKneelingBeforeSitting(options = {})` → seated actor plus kneeling actor configured with `positioning:kneeling_before`.
   Each helper should delegate to `createSittingArrangement` so that tests can opt into additional metadata (custom names, explicit spot indexes, whether to include the shared room entity, etc.).

3. **Use existing builder primitives instead of inventing new ones.** When a helper needs extra components that do not yet have dedicated builder methods (e.g., `positioning:standing_behind`), call `.withComponent(...)` directly on the builder. This keeps the instructions compatible with the current utilities and avoids adding phantom APIs like `testEnv.given.*`.

4. **Document defaults inline.** Mirror the documentation style already present in `ModEntityBuilder.js`—JSDoc with `@param` and `@returns`—so callers know which IDs, names, or locations are generated automatically.

### Step 2: Integrate with ModTestFixture

Augment `tests/common/mods/ModTestFixture.js` so test fixtures can load the new sitting scenarios with a single method call:

- Add instance methods (next to the existing `createStandardActorTarget`, `createAnatomyScenario`, etc.) that delegate to the new `ModEntityScenarios` helpers. Each method should:
  1. Call the corresponding `ModEntityScenarios.create…` function.
  2. Use the returned `entities` array with `this.reset(entities)` to hydrate the underlying rule environment.
  3. Return the scenario object so tests can reference entity IDs in assertions.

  ```javascript
  /**
   * Creates a multi-actor seating arrangement and loads it into the fixture.
   * @param {object} [options] - Scenario overrides (see ModEntityScenarios.createSittingArrangement)
   * @returns {object} Scenario details (furniture, seated actors, etc.)
   */
  createSittingArrangement(options = {}) {
    const scenario = ModEntityScenarios.createSittingArrangement(options);
    this.reset(scenario.entities);
    return scenario;
  }

  createSittingPair(options = {}) {
    const scenario = ModEntityScenarios.createSittingPair(options);
    this.reset(scenario.entities);
    return scenario;
  }

  // Repeat for createSoloSitting, createStandingNearSitting, createSeparateFurnitureArrangement, createKneelingBeforeSitting
  ```

- Keep method naming consistent with existing helpers (`createAnatomyScenario`, `createMultiActorScenario`, etc.) so downstream tests can discover them easily. Avoid introducing a `testEnv.scenarios` object—fixture instances already expose convenience methods directly.

- Update inline documentation to reflect the real component IDs (`positioning:allows_sitting`, `positioning:sitting_on`, `positioning:standing`, etc.).

### Step 3: Update Shared Exports & Guides

- Re-export the new helpers from `tests/common/mods/index.js` (e.g., `export function createSittingPair(...) { ... }`). This keeps the one-stop import surface used by many specs in sync with the new functionality.
- Extend any existing developer-facing docs that summarize `ModEntityScenarios` (for example `docs/testing/domain-matchers-guide.md` or other mod-testing guides) with a short “Sitting arrangements” subsection that references the new API:

  ```javascript
  const { ModTestFixture } = require('../common/mods');
  const fixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down', rule, condition);
  const scenario = fixture.createSittingPair();

  const actor = fixture.entityManager.getEntityInstance(scenario.seatedActors[0].id);
  expect(actor.components['positioning:sitting_on'].furniture_id).toBe(scenario.furniture.id);
  ```

### Step 4: Create Unit Tests

Add `tests/unit/common/mods/sittingScenarios.test.js` (or extend `ModEntityBuilder.test.js` if you prefer consolidated coverage) to exercise the new scenario builders:

- Import `{ ModEntityScenarios }` directly.
- Verify that each helper populates the correct components and relationships using the real component IDs:
  ```javascript
  const scenario = ModEntityScenarios.createSittingPair();
  const [room, furniture, actor1, actor2] = scenario.entities;

  expect(furniture.components['positioning:allows_sitting'].spots).toEqual(['actor1', 'actor2']);
  expect(actor1.components['positioning:sitting_on']).toMatchObject({ furniture_id: 'couch1', spot_index: 0 });
  ```
- Include edge cases (e.g., empty `seatedActors` array throws, `createSeparateFurnitureArrangement` produces distinct furniture IDs, kneeling scenarios attach `positioning:kneeling_before` with the expected target).
- Reuse the domain matchers by calling `registerDomainMatchers()` when convenient, but remember they expect entities from `entityManager.getEntityInstance(...)`—no phantom `testEnv.getEntity` helpers exist.

### Step 5: Create Integration Tests

Add `tests/integration/common/mods/sittingScenarios.integration.test.js` to validate the helpers against real positioning actions:

1. `import { ModTestFixture }` and the relevant rule/condition JSON files, for example `handle_scoot_closer.rule.json` and `event-is-action-scoot-closer.condition.json` via `assert { type: 'json' }`.
2. In `beforeEach`, call `await ModTestFixture.forAction('positioning', 'positioning:scoot_closer', handleScootCloserRule, eventIsActionScootCloser)`.
3. Use the new helpers to load scenarios, then drive the action with `await testFixture.executeAction('actor1', 'furniture1', { additionalPayload: { secondaryId: 'actor2' } });`.
4. Assert results through `testFixture.entityManager.getComponentData(...)` or domain matchers—e.g., confirm that `positioning:sitting_on.spot_index` updates after `scoot_closer` or that `positioning:standing_behind` appears when requested.

Cover at least:
- A happy path for two actors sharing furniture (`createSittingPair`).
- Separate furniture (`createSeparateFurnitureArrangement`) feeding the `scoot_closer` action (to prove no collisions).
- A kneeling scenario demonstrating that the helper works with other positioning actions (e.g., `positioning:kneel_before`).

### Step 6: Provide Usage Examples

Create or update a short guide (e.g., `docs/testing/sitting-scenarios-guide.md`) that illustrates how to load these scenarios using the real fixture API. Focus on patterns that actually exist in the codebase:

```markdown
const fixture = await ModTestFixture.forAction('positioning', 'positioning:get_up_from_lying', rule, condition);
const scenario = fixture.createSoloSitting({ furnitureId: 'armchair1', locationId: 'reading_nook' });

await fixture.executeAction(scenario.seatedActors[0].id, scenario.furniture.id);

const actor = fixture.entityManager.getEntityInstance(scenario.seatedActors[0].id);
expect(actor.components['positioning:standing']).toBeDefined();
```

Reference the actual helper names (`createSittingPair`, `createStandingNearSitting`, etc.) and component IDs so that future contributors do not reintroduce the deprecated `testEnv.given.*` or `core:*` assumptions.
