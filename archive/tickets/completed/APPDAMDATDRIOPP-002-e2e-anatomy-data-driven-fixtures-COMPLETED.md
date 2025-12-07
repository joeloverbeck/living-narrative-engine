# APPDAMDATDRIOPP-002: Refactor anatomy e2e fixtures to consume authored data

Status: Completed

Update e2e anatomy/damage propagation suites to build expectations from authored anatomy data and the `anatomy:vital_organ` component metadata instead of hardcoded structures.

## Reality check (today)
- APPDAMDATDRIOPP-001 shipped `killOnDestroy` on `anatomy:vital_organ` and removed the hardcoded lethal organ list in code; there is no separate “registry” beyond the component data itself.
- Vital organ entities exist in data (`anatomy:human_heart`, `anatomy:human_brain`, `anatomy:human_spine`) and rely on the component default for `killOnDestroy`; the enum still lists brain/heart/spine.
- Propagation rules are already authored in anatomy entities (e.g., torso → heart/spine, head → brain). There is no real artery/recursive propagation chain in data—the current tests invented that structure.

## File list (expected touches)
- tests/e2e/actions/damagePropagationFlow.e2e.test.js
- tests/e2e/actions/deathMechanics.e2e.test.js
- Any shared test fixtures/helpers under tests/e2e that supply anatomy parts (if reused)

## Tasks
- Replace inline torso/heart/brain fixtures with entities instantiated from authored anatomy definitions (torso/head variants + heart/brain/spine) while wiring joints for the test graph. Avoid invented arteries/propagation rules that are not present in data.
- Derive vital-organ assumptions from the `anatomy:vital_organ` component data (including the `killOnDestroy` default) present on the authored entities, not from fixed arrays or a separate registry.
- Keep test intent the same (propagation correctness, vital organ fatality) while making expectations resilient to added organs/mod content.

## Out of scope
- Changing core damage propagation logic or death conditions themselves.
- Altering event payload shapes or adding new assertions unrelated to data sourcing.
- Modifying test runner configuration or adding new suites beyond the listed files.

## Acceptance criteria
- Tests: `npm run test:e2e -- tests/e2e/actions/damagePropagationFlow.e2e.test.js --runInBand` and `npm run test:e2e -- tests/e2e/actions/deathMechanics.e2e.test.js --runInBand` pass.
- Invariants: Existing propagation expectations remain logically equivalent; vital organ fatality rules reference the same lethal set as runtime data; no reliance on hardcoded organ IDs remains in the updated suites.

## Outcome
- Updated the propagation and death mechanics e2e fixtures to instantiate parts from authored anatomy definitions (torso/head/heart/spine/brain), wiring joints to match data rather than inventing artery recursion.
- Vital organ expectations now derive from the `anatomy:vital_organ` component data and defaults instead of fixed arrays, with dying thresholds driven by health sourced from the authored components.
