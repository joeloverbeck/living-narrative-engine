# FIRAIDDISWOUBODPAR-001: Add disinfectant tags to liquid containers

## Status
Completed.

## Current state
- `data/mods/items/components/liquid_container.component.json` has only volume/serving/refillable/flavor fields and `additionalProperties: false`, so any `tags` field is currently rejected.
- There are no unit tests exercising the `items:liquid_container` schema; the closest coverage in `tests/unit/mods/items/components/dataComponents.test.js` only validates other item components.
- There is no dedicated docs/mods entry for `items:liquid_container`; the component JSON itself is the source of truth to update.

## Goal
Allow `items:liquid_container` to expose optional string `tags` (e.g., `"disinfectant"`) without changing existing required fields or their validation.

## File list
- `data/mods/items/components/liquid_container.component.json` (add optional `tags` array)
- Any referenced schema/typing files for `items:liquid_container` (ensure tags are validated and documented if present)
- Unit test file validating `liquid_container` schema behaviour (add under `tests/unit/mods/items/components/`)

## Out of scope
- No changes to action, rule, or scope files.
- No inventory logic changes beyond schema/component additions.
- Do not alter volume math or consumption mechanics.

## Acceptance criteria
- Tests: new unit tests covering `liquid_container` validation (including optional/empty `tags`) pass via `npm run test:unit -- tests/unit/mods/items/components/`.
- Invariants: existing required `liquid_container` fields (volume, capacity, etc.) remain required and their validation behaviour is unchanged aside from allowing `tags`.

## Outcome
- Added optional `tags` array (non-empty strings, unique, optional/empty allowed) to `data/mods/items/components/liquid_container.component.json` without altering existing required fields.
- Added schema validation coverage for `items:liquid_container` (with/without/empty tags, invalid tag values, and required-field enforcement) in `tests/unit/mods/items/components/dataComponents.test.js`.
