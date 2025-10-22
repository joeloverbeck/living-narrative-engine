# MODTESTROB-010: Update Existing Tests with New Patterns

**Epic**: Mod Testing Robustness Enhancement  
**Priority**: P2 (Documentation & Migration)  
**Estimated Effort**: 8-10 hours (Batch 1 focus)  
**Dependencies**: MODTESTROB-005, MODTESTROB-006, MODTESTROB-007, MODTESTROB-009

---

## Overview

### Problem Statement

A large portion of the mod integration suites still use the legacy "hand-built entity" style with `ModEntityBuilder` and bespoke helper functions. Running `rg -l "ModEntityBuilder" tests/integration/mods | wc -l` shows **127 integration suites** still depend on the old setup helpers.【43b1cc†L1-L1】 These files reimplement entity graphs, duplicate assertion logic via `ModAssertionHelpers`, and avoid the new domain matchers described in the [Mod Testing Guide](../docs/testing/mod-testing-guide.md). The result is:

- High maintenance overhead when rules or components change
- Verbose setup blocks that hide test intent
- Inconsistent assertions across positioning and inventory flows

### Target Outcome

Align the highest-impact integration suites with the modern fixture APIs so that:

- Sitting and inventory scenarios are composed with `ModTestFixture` scenario helpers (`createKneelingBeforeSitting`, `createSittingPair`, `createInventoryTransfer`, `createDropItemScenario`, etc.)
- Assertions use `tests/common/mods/domainMatchers.js` rather than the deprecated `ModAssertionHelpers` helpers
- All migrated suites keep their existing expectations while reducing bespoke setup code by roughly 60–80%
- Batch 1 validates the patterns on four representative suites before the broader migration continues

### Benefits

1. **Improved Maintainability** – Scenario helpers keep entity graphs consistent across categories.  
2. **Readability** – Declarative helpers and domain matchers expose the business intent.  
3. **Reduced Duplication** – Shared helpers replace copy/paste ModEntityBuilder blocks.  
4. **Faster Iteration** – New suites can copy the migrated structure directly.  
5. **Confidence in Patterns** – Demonstrates that the guidance from `docs/testing/` works on real integration suites.

---

## Current Baseline & Metrics

| Check | Command | Notes |
| --- | --- | --- |
| Legacy builder usage | `rg -l "ModEntityBuilder" tests/integration/mods | wc -l` | 127 suites still using the manual builder helpers.【43b1cc†L1-L1】 |
| Legacy assertion helpers | `rg -l "ModAssertionHelpers" tests/integration/mods/positioning | head` | Surface representative positioning suites still importing `ModAssertionHelpers` (e.g. `stand_up_action.test.js`).【60fe96†L1-L6】 |
| Domain matcher adoption | `rg -l "domainMatchers.js" tests/integration/mods` | Currently zero suites import the shared domain matchers.【8bf759†L1-L1】 |

Use these quick checks after each batch to measure adoption.

---

## Prerequisites

1. **Read the core guides** in `docs/testing/`:
   - `mod-testing-guide.md`
   - `action-discovery-testing-toolkit.md`
   - `MODTESTROB-009-migration-guide.md`
2. **Verify helper coverage** before touching integration suites:
   ```bash
   npm run test:unit -- tests/unit/common/mods/domainMatchers.test.js
   npm run test:unit -- tests/unit/common/mods/sittingScenarios.test.js
   npm run test:unit -- tests/unit/common/mods/inventoryScenarios.test.js
   ```
   These unit suites cover the scenario builders and matchers used throughout Batch 1.
3. Ensure Node 20+/npm 10+ as described in `AGENTS.md`.

---

## Step 1 – Identify Migration Candidates

The goal is to migrate suites that still rely on manual builders but cover high-value positioning and inventory flows.

```bash
# Positioning suites still using manual builders
rg -l "ModEntityBuilder" tests/integration/mods/positioning | head

# Inventory suites using manual builders
rg -l "ModEntityBuilder" tests/integration/mods/items | head

# Suites still importing ModAssertionHelpers
rg -l "ModAssertionHelpers" tests/integration/mods | head
```

These commands surface the same filenames referenced in the existing docs (e.g. `stand_up_action.test.js`, `scoot_closer_action.test.js`, `giveItemRuleExecution.test.js`, `dropItemRuleExecution.test.js`).

---

## Step 2 – Batch 1 Selection

Select one sitting action that removes a kneeling component, one positioning action that manipulates seating, and two inventory transfers. This validates the full range of scenario helpers we expect to use everywhere else.

| File | Category | Rationale |
| --- | --- | --- |
| `tests/integration/mods/positioning/stand_up_action.test.js` | Sitting → Standing | Heavy manual setup, imports `ModAssertionHelpers`, exercises kneeling removal. |
| `tests/integration/mods/positioning/scoot_closer_action.test.js` | Seating adjustments | Builds furniture/actors manually and inspects array slots. |
| `tests/integration/mods/items/giveItemRuleExecution.test.js` | Inventory transfer | Reinforces `createInventoryTransfer` and domain matchers. |
| `tests/integration/mods/items/dropItemRuleExecution.test.js` | Drop flow | Validates `createDropItemScenario` for ground item assertions. |

Confirm each file exists before proceeding:

```bash
for file in \
  tests/integration/mods/positioning/stand_up_action.test.js \
  tests/integration/mods/positioning/scoot_closer_action.test.js \
  tests/integration/mods/items/giveItemRuleExecution.test.js \
  tests/integration/mods/items/dropItemRuleExecution.test.js; do
  echo "Checking $file" && test -f "$file"
done
```

---

## Step 3 – Migration Guidelines

### 3.1 Shared Refactor Checklist

For every migrated suite:

1. Replace bespoke imports with the shared helpers (from a suite in `tests/integration/mods/*` the relative path is `../../../common/mods/domainMatchers.js`):
   ```javascript
   import '../../../common/mods/domainMatchers.js';
   // Remove ModAssertionHelpers unless absolutely required for gap coverage.
   ```
2. Use fixture scenario helpers instead of hand-building entities:
   - Sitting helpers: `fixture.createKneelingBeforeSitting`, `fixture.createSittingPair`, `fixture.createStandingNearSitting`.
   - Inventory helpers: `fixture.createInventoryTransfer`, `fixture.createDropItemScenario`, `fixture.createInventoryLoadout`.
3. Reset the fixture with the helper’s `entities` array: `fixture.reset(scenario.entities);`
4. Call `fixture.executeAction` with IDs returned by the helper rather than hard-coded strings.
5. Assert outcomes with domain matchers: `expect(fixture.events).toHaveActionSuccess(...)`, `expect(actor).toHaveComponent(...)`, `expect(actor).not.toHaveComponent(...)`.
6. Remove redundant manual cleanup; `fixture.cleanup()` already clears diagnostics and entity state.

### 3.2 Positioning Example – `stand_up_action.test.js`

Current setup manually creates rooms, furniture, kneeling actors, and checks for component removal via `ModAssertionHelpers`. Migrate to the kneeling scenario helper:

```javascript
import '../../../common/mods/domainMatchers.js';

beforeEach(async () => {
  fixture = await ModTestFixture.forAction('positioning', 'positioning:stand_up');
});

afterEach(() => {
  fixture.cleanup();
});

it('removes kneeling component and reports success', async () => {
  const scenario = fixture.createKneelingBeforeSitting({
    seatedActors: [{ id: 'kneeling_actor', name: 'Alex' }],
    kneelingActors: [{ id: 'kneeler', name: 'Sam', targetId: 'kneeling_actor' }],
  });

  fixture.reset(scenario.entities);

  await fixture.executeAction('kneeler', 'none');

  const actor = fixture.entityManager.getEntityInstance('kneeler');
  expect(actor).not.toHaveComponent('positioning:kneeling_before');
  expect(fixture.events).toHaveActionSuccess('Sam stands up from their kneeling position.');
});
```

This pattern eliminates the helper functions at the top of the file, keeps custom expectations, and leverages the shared matchers.

### 3.3 Positioning Example – `scoot_closer_action.test.js`

Leverage the seating helpers to populate furniture and spot indices:

```javascript
const scenario = fixture.createSittingPair({
  furnitureId: 'bench',
  furnitureAllowsSitting: { spots: ['occupant1', null, null] },
  seatedActors: [
    { id: 'occupant1', name: 'Bob', spotIndex: 0 },
    { id: 'actor1', name: 'Alice', spotIndex: 2 },
  ],
});

fixture.reset(scenario.entities);
await fixture.executeAction('actor1', scenario.furniture.id, {
  additionalPayload: { secondaryId: 'occupant1' },
});

const actor = fixture.entityManager.getEntityInstance('actor1');
expect(actor.components['positioning:sitting_on'].spot_index).toBe(1);
expect(fixture.events).toHaveActionSuccess('Alice scoots closer to Bob.');
```

Reuse `scenario.furniture` and `scenario.seatedActors` to assert on occupancy rather than reconstructing arrays manually.

### 3.4 Inventory Example – `giveItemRuleExecution.test.js`

Swap the bespoke scenario builder with the transfer helper, and lean on matchers for assertions:

```javascript
const scenario = fixture.createInventoryTransfer({
  giver: { id: 'giver', name: 'Alice' },
  receiver: { id: 'receiver', name: 'Bob' },
  item: { id: 'letter-1', name: 'Letter', weight: 0.05 },
});

fixture.reset(scenario.entities);
await fixture.executeAction('giver', 'receiver', {
  additionalPayload: { secondaryId: scenario.transferItem.id },
});

const giver = fixture.entityManager.getEntityInstance('giver');
const receiver = fixture.entityManager.getEntityInstance('receiver');

expect(giver.components['items:inventory'].items).not.toContain(scenario.transferItem.id);
expect(receiver.components['items:inventory'].items).toContain(scenario.transferItem.id);
expect(fixture.events).toHaveActionSuccess('Alice gives Letter to Bob.');
```

The helper also gives access to `scenario.giverItems` and `scenario.receiverItems` for extended assertions.

### 3.5 Inventory Example – `dropItemRuleExecution.test.js`

Use `fixture.createDropItemScenario` to guarantee consistent actor inventory setup:

```javascript
const scenario = fixture.createDropItemScenario({
  actor: { id: 'dropper', name: 'Alice' },
  item: { id: 'letter-1', name: 'Letter', weight: 0.05 },
});

fixture.reset(scenario.entities);
await fixture.executeAction('dropper', scenario.item.id);

const actor = fixture.entityManager.getEntityInstance('dropper');
expect(actor.components['items:inventory'].items).not.toContain(scenario.item.id);
expect(fixture.events).toHaveActionSuccess('Alice drops Letter.');
```

The helper’s `additionalInventoryItems` array is available for negative tests (e.g. verifying other items remain).

---

## Step 4 – Validation Checklist

1. **File-level tests** while iterating:
   ```bash
   npm run test:integration -- tests/integration/mods/positioning/stand_up_action.test.js
   npm run test:integration -- tests/integration/mods/positioning/scoot_closer_action.test.js
   npm run test:integration -- tests/integration/mods/items/giveItemRuleExecution.test.js
   npm run test:integration -- tests/integration/mods/items/dropItemRuleExecution.test.js
   ```
2. **Regression sweep** once the batch is migrated:
   ```bash
   npm run test:integration -- tests/integration/mods/positioning
   npm run test:integration -- tests/integration/mods/items
   ```
3. Ensure imports stay sorted and run the formatter:
   ```bash
   npm run format -- tests/integration/mods/positioning/stand_up_action.test.js \
                   tests/integration/mods/positioning/scoot_closer_action.test.js \
                   tests/integration/mods/items/giveItemRuleExecution.test.js \
                   tests/integration/mods/items/dropItemRuleExecution.test.js
   ```

---

## Step 5 – Tracking Progress

Until a dedicated tracker exists, rely on lightweight counts:

```bash
# Remaining suites that reference ModAssertionHelpers
rg -l "ModAssertionHelpers" tests/integration/mods | wc -l

# Suites already importing domain matchers
rg -l "domainMatchers.js" tests/integration/mods | wc -l
```

Capture the counts in `docs/testing/MODTESTROB-009-migration-guide.md` after each batch to keep the migration notes in one place.

---

## Next Steps

1. **Complete Batch 1** using the guidelines above and capture before/after line counts to quantify reduction.  
2. **Document learnings** (edge cases, helper gaps) back in the migration guide.  
3. **Queue Batch 2** focusing on additional positioning and container flows once Batch 1 demonstrates stability.  
4. **Automate reports** only after a few batches; for now the `rg` counts are sufficient and avoid maintaining extra scripts.

---

## Reference Materials

- `docs/testing/mod-testing-guide.md` – canonical fixture, scenario, and matcher documentation.  
- `docs/testing/MODTESTROB-009-migration-guide.md` – prior migration playbook that establishes acceptance criteria.  
- `tests/common/mods/domainMatchers.js` – source of the Jest matchers referenced above.  
- `tests/common/mods/ModEntityBuilder.js` – implementation of the scenario helpers used in Batch 1.
