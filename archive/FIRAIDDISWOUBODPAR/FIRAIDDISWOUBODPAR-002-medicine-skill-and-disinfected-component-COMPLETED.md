# FIRAIDDISWOUBODPAR-002: Add medicine skill and disinfected status components

## Status
Completed.

## Goal
Introduce `skills:medicine_skill` (0-100 integer) and `first-aid:disinfected` status for body parts with required metadata (appliedById, sourceItemId).

## Reality check
- `first-aid` currently has no `components/` directory and its `mod-manifest.json` lists no components, so registration plus the new folder are required.
- `skills` manifest lists other skill components but not `medicine_skill`; it must be added there to load in tests/runtime.
- There are no existing unit suites for `skills` or `first-aid` components, so add new test files/directories under `tests/unit/mods/skills/components/` and `tests/unit/mods/first-aid/components/`.

## File list
- `data/mods/skills/components/medicine_skill.component.json` (new)
- `data/mods/first-aid/components/disinfected.component.json` (new)
- Register components in `data/mods/skills/mod-manifest.json` and `data/mods/first-aid/mod-manifest.json`.
- Unit tests validating both components’ schemas/defaults (create under `tests/unit/mods/skills/components/` and `tests/unit/mods/first-aid/components/`).

## Outcome
- Added `skills:medicine_skill` component (0-100 integer, default 0) and registered it in the skills manifest for loading.
- Added `first-aid:disinfected` component capturing applier and source item, with additionalProperties blocked, plus manifest registration.
- Created unit schema tests for both components in the new `tests/unit/mods/skills/components/` and `tests/unit/mods/first-aid/components/` directories and validated via targeted unit test run.

## Out of scope
- Do not add these components to any entities or actions yet.
- No rule/action wiring or manifest updates beyond registering the component definitions themselves.
- No gameplay tuning of medicine values or durations.

## Acceptance criteria
- Tests: component schema/unit tests for `medicine_skill` and `disinfected` pass via `npm run test:unit -- <path-to-component-tests>`.
- Invariants: existing component definitions remain unchanged; new components enforce `additionalProperties: false` and default values where applicable.
