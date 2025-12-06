# MODTESHANROB-002 Macro-aware handler coverage property tests

Status: Completed

## Current state check

- `ModTestHandlerFactory` already auto-detects operations from `data/mods/<category>/rules` (with macro expansion) to decide when to pull the superset handler profile, items, or mouth engagement. Unknown categories already fall back to the superset profile.
- The completeness test (`tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`) only asserts curated handler lists; there is no data-driven/property scan over real mod content.
- Operation discovery currently ignores `data/mods/**/actions/*.json`, so a category that references item or mouth operations via actions/macros would not flip the detection flags and would miss those handlers even though the base superset is used.
- The factory does not expose the discovered operation profile for assertions; tests would need a helper that mirrors the internal scan instead of reimplementing it.

## Updated goal

Add a property-style test that scans `data/mods/**/{rules,actions}/*.json` (including macro expansions) to derive referenced operations and assert the handler profile returned by `ModTestHandlerFactory.getHandlerFactoryForCategory` covers them. Close the detection gap by teaching the factory’s scan to include actions and make the discovered profile observable to tests.

## File list to touch

- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js (add the property-based coverage assertions)
- tests/common/mods/ModTestHandlerFactory.js (extend operation discovery to actions and expose the discovered profile for tests)

## Out of scope

- Modifying production handler composition under src/logic/\*\* beyond what is necessary to surface coverage info in tests.
- Editing real mod content under data/mods/\*\* except for read-only scanning.
- Introducing new CLI commands or scripts outside the Jest test suite.

## Acceptance criteria

- Tests: updated completeness test runs under `npm run test:unit -- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js` and fails when a referenced operation (including macro-expanded ones) lacks a registered handler for its category.
- Invariants: scanning does not mutate mod data; macro expansion logic in tests mirrors the interpreter’s behavior without changing public schema or fixture APIs; handler selection remains deterministic for the same inputs.

## Outcome

- Added an action-aware, macro-expanding operation scan exposed via `ModTestHandlerFactory.getOperationProfileForCategory` so tests can assert detected coverage without duplicating logic.
- Expanded the superset handler profile to register follow, speech/thought, metabolism, closeness removal, outcome resolution, and query helpers discovered by the scan, closing gaps for mods like companionship, core, metabolism, positioning, and weapons.
- Extended the completeness test with a property-based sweep over `data/mods/**/{rules,actions}` to fail on missing handlers; verified with `npm run test:unit -- --runInBand tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`.
