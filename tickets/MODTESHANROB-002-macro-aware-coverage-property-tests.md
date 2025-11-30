# MODTESHANROB-002 Macro-aware handler coverage property tests
## Goal
Add property-style scans that traverse `data/mods/**/{rules,actions}/*.json` (and macro expansions) to derive referenced operations and assert the ModTest handler profiles cover them, catching gaps like component mutation or perception logging before runtime.
## File list it expects to touch
- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js (extend with property checks)
- tests/common/mods/examples/ or new fixtures if needed for macro expansion coverage
- tests/common/mods/ModTestHandlerFactory.js (expose helper to retrieve resolved handler profiles for assertions)
## Out of scope
- Modifying production handler composition under src/logic/** beyond what is necessary to surface coverage info in tests.
- Editing real mod content under data/mods/** except for read-only scanning.
- Introducing new CLI commands or scripts outside the Jest test suite.
## Acceptance criteria
- Tests: new/updated property test runs under `npm run test:unit -- tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js` and fails when a referenced operation or macro-expanded operation lacks a handler.
- Invariants: scanning does not mutate mod data; macro expansion logic in tests mirrors the interpreter’s behavior without changing public schema or fixture APIs; handler selection remains deterministic for the same inputs.
