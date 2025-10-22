# MODTESTROB-009: Migration Guide for Old → New Patterns

**Status:** Ready for Implementation  
**Priority:** P2 (Medium)  
**Estimated Time:** 2-3 hours  
**Risk Level:** Low  
**Phase:** 3 - Documentation & Enablement

---

## Overview

Provide a practical migration playbook for converting legacy mod action tests that still use manual `ModEntityBuilder` setups and generic Jest assertions into the modern fixtures and matchers that now ship with the repository. The workflow should consolidate around the canonical references that already live in `docs/testing/` rather than creating redundant material.

### Problem Statement

Many integration suites under `tests/integration/mods/` pre-date the Phase 2 tooling refresh. Those files typically:

- Instantiate raw `ModEntityBuilder` graphs by hand and push them through `testFixture.reset(...)`.
- Assert on `testFixture.events` using `expect(...).toBe(true)` style checks rather than the domain matchers from `tests/common/mods/domainMatchers.js`.
- Re-implement scope resolvers inline instead of calling the shared helpers in `tests/common/mods/scopeResolverHelpers.js`.
- Skip validation proxy coverage when wiring JSON fixtures.

The newer documentation in `docs/testing/mod-testing-guide.md` already explains the preferred APIs, but there is no concise migration plan tying the old patterns to the new ones. As a result the remaining legacy suites linger because the work feels open-ended.

### Target State

- Every migration task references the existing `docs/testing/mod-testing-guide.md` (and the companion action discovery guide) as the source of truth instead of spawning new standalone guides.
- Legacy suites adopt `ModTestFixture` scenario helpers such as `createSittingPair`, `createInventoryTransfer`, and `createOpenContainerScenario` instead of bespoke entity builders.
- Assertions leverage `expect(testFixture.events).toHaveActionSuccess(...)`, `expect(entity).toHaveComponent(...)`, and `expect(entity).toHaveComponentData(...)` from `domainMatchers.js`.
- Scope resolution logic is centralized through `ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv)` (or the equivalent helper) when discovery diagnostics require additional scopes.
- Action definitions and rules loaded inside tests are validated with `createActionValidationProxy` so migrations surface schema drift early.

---

## Key References

- `docs/testing/mod-testing-guide.md` – canonical guidance for fixtures, scenarios, validation proxies, diagnostics, and matchers.
- `docs/testing/action-discovery-testing-toolkit.md` – deeper dives into diagnostics, tracing, and discovery helpers when migrations touch discovery suites.
- `tests/common/mods/ModTestFixture.js` – fixture implementation exposing scenario helpers like `createSittingPair`, `createInventoryTransfer`, and `createOpenContainerScenario`.
- `tests/common/mods/domainMatchers.js` – domain-specific Jest matchers (e.g., `toHaveActionSuccess`, `toHaveComponent`, `toHaveComponentData`).
- `tests/common/mods/scopeResolverHelpers.js` – reusable resolver registrations.

These files already hold the authoritative explanations; this ticket links them together and calls out concrete migration steps.

---

## Detailed Steps

### Step 1: Audit Legacy Suites

Use the following commands to inventory candidates that still rely on manual builders or generic assertions:

```bash
# Identify tests creating ModEntityBuilder instances directly
rg "new ModEntityBuilder" tests/integration/mods -n

# Find suites that never import the domain matchers
rg "domainMatchers" tests/integration/mods -l --invert-match -g"*.test.js"

# Locate inline scope resolver registration
rg "registerScopeResolver" tests/integration/mods -n
```

Capture the list of files and triage them into logical batches (e.g., sitting, inventory, discovery) so the migrations can land incrementally.

### Step 2: Plan Documentation Touch Points

Review `docs/testing/mod-testing-guide.md` and decide whether any sections need a short migration-focused addendum (for example, an appendix that maps "legacy pattern → modern helper"). Only add material that is missing—avoid duplicating content that already exists. When updates are required, extend the existing guide instead of creating new Markdown files.

Suggested additions:

- A compact table that maps manual `ModEntityBuilder` snippets to the corresponding `ModTestFixture` helpers (`createSittingPair`, `createSeparateFurnitureArrangement`, `createInventoryTransfer`, etc.).
- A reminder that domain matchers live in `tests/common/mods/domainMatchers.js` and that suites must import `../../common/mods/domainMatchers.js` once per file.
- A checklist for verifying migrations (run focused Jest command, confirm diagnostics opt-in still works, validate coverage parity).

### Step 3: Convert a Representative Test

For each candidate suite:

1. Replace manual builders with scenario helpers.
2. Swap generic assertions with domain matchers and `entityManager` helpers.
3. Register shared scope resolvers when the suite previously hard-coded them.
4. Wrap JSON definitions with `createActionValidationProxy` if they were previously passed through raw.

#### Before → After Example (Sitting Action)

**Before (legacy pattern)**

```javascript
const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
const furniture = new ModEntityBuilder('furniture1')
  .withComponent('positioning:allows_sitting', { spots: ['occupant1', null, 'actor1'] })
  .build();
const actor = new ModEntityBuilder('actor1')
  .asActor()
  .withComponent('positioning:sitting_on', { furniture_id: 'furniture1', spot_index: 2 })
  .build();

testFixture.reset([room, furniture, actor]);
await testFixture.executeAction('actor1', 'furniture1', {
  additionalPayload: { secondaryId: 'occupant1' },
});

const actorState = testFixture.entityManager.getComponentData('actor1', 'positioning:sitting_on');
expect(actorState.spot_index).toBe(1);
```

**After (modern pattern)**

```javascript
import '../../common/mods/domainMatchers.js';

const scenario = testFixture.createSittingPair({
  furnitureId: 'sofa1',
  seatedActors: [
    { id: 'actor1', name: 'Mover', spotIndex: 2 },
    { id: 'actor2', name: 'Partner', spotIndex: 0 },
  ],
});

await testFixture.executeAction('actor1', scenario.furniture.id, {
  additionalPayload: { secondaryId: 'actor2' },
});

expect(testFixture.events).toHaveActionSuccess('Mover scoots closer to Partner');
const actor = testFixture.entityManager.getEntityInstance('actor1');
expect(actor).toHaveComponentData('positioning:sitting_on', {
  furniture_id: scenario.furniture.id,
  spot_index: 1,
});
```

This pattern mirrors the examples already baked into `docs/testing/mod-testing-guide.md` and keeps the migration guidance consistent with our living documentation.

### Step 4: Standardize Scope Helpers

When old suites call `testFixture.registerScopeResolver(...)`, swap those blocks for the centralized helpers:

```javascript
import { ScopeResolverHelpers } from '../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction(...);
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
```

The helper operates on `testFixture.testEnv`, which is available on the fixture instance. If the suite needs a custom resolver that does not yet exist, add it to `scopeResolverHelpers.js` so future migrations can share it.

### Step 5: Retain Validation Coverage

When suites import rule or condition JSON files, pass them through `createActionValidationProxy` before handing them to the fixture:

```javascript
import { createActionValidationProxy } from '../../common/mods/actionValidationProxy.js';
import ruleJson from '../../../data/mods/positioning/rules/handle_scoot_closer.rule.json' assert { type: 'json' };

const validatedRule = createActionValidationProxy(ruleJson, 'positioning:scoot_closer rule');

testFixture = await ModTestFixture.forAction(
  'positioning',
  'positioning:scoot_closer',
  validatedRule,
  conditionJson,
);
```

This keeps migrations aligned with the guidance in the mod testing guide.

### Step 6: Verify Incrementally

Run focused Jest commands while migrating each suite:

```bash
# Single-file verification (replace with actual path)
NODE_ENV=test npx jest tests/integration/mods/positioning/scoot_closer_action.test.js --runInBand

# Batch verification for a mod category
NODE_ENV=test npx jest tests/integration/mods/positioning --runInBand
```

Once a batch lands, execute `npm run test:integration` from the repo root to ensure broader coverage stays green.

### Step 7: Update Documentation (If Needed)

If Step 2 identified documentation gaps, extend `docs/testing/mod-testing-guide.md` in a focused way. Example additions:

- `## Migration Playbook` subsection summarizing the key commands above.
- A short checklist reminding authors to import domain matchers, rely on `ModTestFixture` helpers, and register shared scopes.

Keep the language concise and defer to existing sections for deeper explanations.

### Step 8: Commit and Track Progress

- Commit test migrations in small batches (per suite or per mod category).
- If documentation changes were required, bundle them with the relevant test migrations so reviewers can see the rationale in context.
- Use repository scripts (see `scripts/validate-*.js`) as inspiration if you need to automate tracking, but only introduce a new helper if it solves a concrete gap discovered during the audit.

---

## Risk Assessment & Rollback

- **Low risk** when replacing manual entity builders with one of the existing scenario helpers and keeping assertions equivalent.
- **Moderate risk** when migrating suites that rely on bespoke entity graphs; confirm that scenario helpers provide the same components or supplement them with `entityManager.getEntityInstance(...).components` adjustments.
- **High risk** when rewriting discovery suites; involve diagnostics from the action discovery toolkit and run the entire directory to catch regressions.

Rollback is straightforward: re-run the affected tests against the pre-migration commit, or revert the changes via `git checkout -- <file>` if issues surface.

---

## Success Criteria

- Legacy suites use `ModTestFixture` helpers instead of manual `ModEntityBuilder` scaffolding wherever feasible.
- Domain matchers from `tests/common/mods/domainMatchers.js` replace generic assertions.
- Shared scope helpers are registered through `ScopeResolverHelpers` when needed.
- Validation proxies guard action and rule JSON loaded by the tests.
- `docs/testing/mod-testing-guide.md` contains any additional migration notes that were missing before this ticket started.

Meeting these criteria ensures the workflow aligns with the actual codebase and leverages the existing documentation without duplicating it.
