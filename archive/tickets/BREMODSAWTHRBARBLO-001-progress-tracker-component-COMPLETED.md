# BREMODSAWTHRBARBLO-001: Add core progress tracker component

Goal: add the generic progress tracker component used for multi-step actions.

Status: Completed

# Assumptions checked
- There is no existing `tests/unit/mods/breaching/components.test.js` in this repo.
- Core component tests live under `tests/unit/mods/core/components/`.

# File list it expects to touch
- data/mods/core/components/progress_tracker.component.json

# Out of scope
- Any changes to breaching, blockers, or skills mods.
- Documentation updates beyond this ticket.
- Any behavior changes outside adding this component definition and its schema validation tests.

# Acceptance criteria
## Specific tests that must pass
- npm run test:unit -- tests/unit/mods/core/components/progressTracker.component.test.js
- npm run validate:fast

## Invariants that must remain true
- Existing core component schemas remain unchanged.
- The new component schema only allows a non-negative integer value and rejects additional properties.
- No other core mod content is modified.

## Outcome
- Added `core:progress_tracker` component schema and unit coverage for validation rules; no breaching/blockers/skills changes were required.
