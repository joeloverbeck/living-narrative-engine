# MODTESTROB-009: Migration Guide for Old → New Patterns

**Status:** Ready for Implementation  
**Priority:** P2 (Medium)  
**Estimated Time:** 2-3 hours  
**Risk Level:** Low  
**Phase:** 3 - Documentation & Enablement

---

## Purpose

Provide a practical migration playbook for converting legacy mod action tests that still rely on manual `ModEntityBuilder`
scaffolding and generic Jest assertions into the modern fixtures, helpers, and matchers that ship with the repository. The
goal is to lean on the canonical documentation inside `docs/testing/` while giving maintainers a concrete checklist for updating
existing suites.

## Audience & Prerequisites

This workflow targets contributors who are:

- Cleaning up integration suites under `tests/integration/mods/` that pre-date the Phase 2 tooling refresh.
- Comfortable running Jest locally and navigating the helper utilities in `tests/common/mods/`.
- Familiar with the guidance in `docs/testing/mod-testing-guide.md` and the discovery appendix in
  `docs/testing/action-discovery-testing-toolkit.md`.

Before starting, skim the implementation of the helpers you will depend on:

- `tests/common/mods/ModTestFixture.js`
- `tests/common/mods/domainMatchers.js`
- `tests/common/mods/scopeResolverHelpers.js`
- `tests/common/mods/actionValidationProxy.js`

---

## Primary References

Keep migrations anchored to the existing documentation instead of inventing parallel guides:

- `docs/testing/mod-testing-guide.md` – fixtures, scenario helpers, diagnostics, validation proxies, and matchers.
- `docs/testing/action-discovery-testing-toolkit.md` – discovery diagnostics, tracing, and helper catalogues.
- `tests/common/mods/ModTestFixture.js` – scenario helper entry points such as `createSittingPair`,
  `createInventoryTransfer`, and `createOpenContainerScenario`.
- `tests/common/mods/domainMatchers.js` – domain-specific Jest matchers (e.g., `toHaveActionSuccess`,
  `toHaveComponent`, `toHaveComponentData`).
- `tests/common/mods/scopeResolverHelpers.js` – shared scope registration helpers for positioning, discovery, and inventory
  flows.

---

## Migration Quick Reference

| Legacy Pattern | Replace With | Notes |
| --- | --- | --- |
| Manual `ModEntityBuilder` graphs constructed inline | Fixture scenario helpers such as `fixture.createSittingPair(options)`, `fixture.createInventoryTransfer(options)`, or `fixture.createOpenContainerScenario(options)` | Scenario helpers automatically register the same component graphs the builders created by hand. They are backed by `ModEntityScenarios` inside `tests/common/mods/ModTestFixture.js`. |
| `testFixture.reset([...entities])` calls before every assertion | Scenario helper return values combined with the fixture lifecycle methods (`beforeEach`, `afterEach`, `fixture.cleanup()`) | The helpers provision entities and register them with the fixture for you. Use the returned ids through `fixture.entityManager`. |
| `expect(...).toBe(true)` or raw array inspection on `testFixture.events` | `expect(testFixture.events).toHaveActionSuccess(...)`, `expect(entity).toHaveComponent(...)`, `expect(entity).toHaveComponentData(...)` | Import `../../common/mods/domainMatchers.js` at the top of each suite once. |
| Inline `testFixture.registerScopeResolver(...)` implementations | `ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv)` (or the relevant helper) | Centralising scope logic prevents drift and keeps diagnostics consistent. |
| Passing JSON definitions directly to `ModTestFixture.forAction(...)` | `createActionValidationProxy(json, 'label')` prior to invocation | Validation proxies surface schema drift immediately and are already described in the testing guide. |

---

## Migration Workflow

### 1. Audit Legacy Suites

Identify candidates that still construct entities manually or omit the shared helpers:

```bash
# Locate suites instantiating ModEntityBuilder manually
rg "new ModEntityBuilder" tests/integration/mods -n

# Find suites that never import the domain matchers (missing modern assertions)
rg "domainMatchers" tests/integration/mods -l --invert-match -g"*.test.js"

# Detect inline scope resolver registration
rg "registerScopeResolver" tests/integration/mods -n
```

Record the output and group suites into logical batches (e.g., positioning, inventory, discovery) so you can migrate in
manageable chunks.

### 2. Confirm Documentation Coverage

Re-read `docs/testing/mod-testing-guide.md` before touching code. If the existing guide already explains the helper you plan to
use, link to that section in code review notes instead of authoring new material. Only extend the guide when you encounter a
real gap (for example, adding a short appendix mapping manual builders to helper functions). When documentation updates are
required, edit the existing file rather than creating a new Markdown document.

### 3. Replace Manual Builders with Scenario Helpers

For each suite:

1. Import the helpers once at the top:
   ```javascript
   import '../../common/mods/domainMatchers.js';
   import { ScopeResolverHelpers } from '../../common/mods/scopeResolverHelpers.js';
   ```
2. Swap manual entity graphs for the corresponding fixture helper. For example, the `scoot_closer` integration test should use
   `fixture.createSittingPair({...})`, mirroring the pattern already demonstrated in
   `tests/integration/common/mods/sittingScenarios.integration.test.js`.
3. Use the returned ids when executing the action:
   ```javascript
   const scenario = fixture.createSittingPair({ furnitureId: 'sofa1' });
   await fixture.executeAction(scenario.primaryActor.id, scenario.furniture.id, {
     additionalPayload: { secondaryId: scenario.secondaryActor.id },
   });
   ```
4. Retrieve entities through `fixture.entityManager.getEntityInstance(id)` instead of storing manual references.

### 4. Adopt Domain Matchers for Assertions

Replace boolean checks on events with expressive matchers:

```javascript
expect(fixture.events).toHaveActionSuccess('Mover scoots closer to Partner');
const actor = fixture.entityManager.getEntityInstance(scenario.primaryActor.id);
expect(actor).toHaveComponentData('positioning:sitting_on', {
  furniture_id: scenario.furniture.id,
  spot_index: 1,
});
```

These helpers live in `tests/common/mods/domainMatchers.js` and are already exercised in
`tests/integration/common/mods/sittingScenarios.integration.test.js` for reference.

### 5. Standardise Scope Helpers

Legacy suites that register scope resolvers inline should call the shared helpers during setup:

```javascript
beforeEach(async () => {
  fixture = await ModTestFixture.forAction('positioning', 'positioning:scoot_closer');
  ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
});
```

If a suite relies on a resolver that does not exist yet, add it to `tests/common/mods/scopeResolverHelpers.js` so future
migrations can reuse the same helper.

### 6. Guard JSON Definitions with Validation Proxies

Whenever an action or rule JSON file is imported, wrap it with `createActionValidationProxy` before passing it to the fixture:

```javascript
import ruleJson from '../../../data/mods/positioning/rules/handle_scoot_closer.rule.json' assert { type: 'json' };
import { createActionValidationProxy } from '../../common/mods/actionValidationProxy.js';

const validatedRule = createActionValidationProxy(ruleJson, 'positioning:scoot_closer rule');
fixture = await ModTestFixture.forAction('positioning', 'positioning:scoot_closer', validatedRule, conditionJson);
```

This mirrors the approach documented in `docs/testing/mod-testing-guide.md` and ensures schema drift is caught immediately.

### 7. Verify Incrementally

Run focused Jest commands after each migration to keep feedback fast:

```bash
# Single file (replace with actual path)
NODE_ENV=test npx jest tests/integration/mods/positioning/scoot_closer_action.test.js --runInBand

# Entire mod category when ready
NODE_ENV=test npx jest tests/integration/mods/positioning --runInBand
```

Once a batch lands, execute `npm run test:integration` from the repo root to confirm nothing else regressed.

### 8. Update Documentation When Necessary

If Step 2 highlighted missing documentation, add concise updates to `docs/testing/mod-testing-guide.md`. Suggested additions:

- A small table mapping legacy manual builders to the helper responsible for the same scenario.
- A migration checklist reminding authors to import domain matchers, rely on fixture helpers, register scope resolvers, and wrap
  JSON via validation proxies.
- Links back to the relevant sections already present in the guide instead of duplicating examples.

Bundle documentation edits with the test migration that motivated them so reviewers can see the context.

### 9. Commit and Track Progress

- Commit per suite or per mod category to keep diffs reviewable.
- Reference the audit commands in commit messages or PR descriptions so reviewers know the remaining surface area.
- Use repository scripts (e.g., `scripts/validate-mod-fixtures.js`) only when they fill a concrete automation gap discovered
  during the migration.

---

## Before → After Example (Sitting Action)

**Legacy pattern:** manual builders, raw events, inline resolvers.

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
expect(testFixture.events.some((evt) => evt.type === 'action/success')).toBe(true);
```

**Modern pattern:** fixture helpers, domain matchers, shared scopes.

```javascript
import '../../common/mods/domainMatchers.js';
import { ScopeResolverHelpers } from '../../common/mods/scopeResolverHelpers.js';

let fixture;

beforeEach(async () => {
  fixture = await ModTestFixture.forAction('positioning', 'positioning:scoot_closer');
  ScopeResolverHelpers.registerPositioningScopes(fixture.testEnv);
});

afterEach(() => {
  fixture.cleanup();
});

it('moves the actor closer to their partner', async () => {
  const scenario = fixture.createSittingPair({
    furnitureId: 'sofa1',
    seatedActors: [
      { id: 'actor1', name: 'Mover', spotIndex: 2 },
      { id: 'actor2', name: 'Partner', spotIndex: 0 },
    ],
  });

  await fixture.executeAction('actor1', scenario.furniture.id, {
    additionalPayload: { secondaryId: 'actor2' },
  });

  expect(fixture.events).toHaveActionSuccess('Mover scoots closer to Partner');
  const actor = fixture.entityManager.getEntityInstance('actor1');
  expect(actor).toHaveComponentData('positioning:sitting_on', {
    furniture_id: scenario.furniture.id,
    spot_index: 1,
  });
});
```

This mirrors the examples already captured in the canonical testing guide and avoids duplicating logic between suites.

---

## Verification Checklist

- [ ] Scenario helpers replace manual `ModEntityBuilder` usage.
- [ ] Domain matchers power all assertions against entities or action events.
- [ ] Scope resolvers come from `ScopeResolverHelpers` (or newly added helpers in that file).
- [ ] JSON definitions pass through `createActionValidationProxy` before fixture execution.
- [ ] Focused Jest runs (`--runInBand`) pass for each migrated suite, followed by `npm run test:integration`.
- [ ] Documentation updates, if any, live in `docs/testing/mod-testing-guide.md`.

---

## Success Criteria

- Legacy suites rely on `ModTestFixture` scenario helpers instead of bespoke entity graphs wherever feasible.
- Domain matchers from `tests/common/mods/domainMatchers.js` replace generic assertions.
- Shared scope helpers are registered through `ScopeResolverHelpers` when needed.
- Validation proxies guard action and rule JSON loaded by tests.
- Any additional migration notes land inside `docs/testing/mod-testing-guide.md`, keeping all guidance in one place.

Meeting these criteria ensures the workflow aligns with the real codebase and leverages the existing documentation without
duplicating it.
