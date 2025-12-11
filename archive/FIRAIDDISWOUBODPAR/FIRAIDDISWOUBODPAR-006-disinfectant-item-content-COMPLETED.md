# FIRAIDDISWOUBODPAR-006: Add disinfectant-tagged item for discoverability

## Current state check
- The disinfect action/scope/rule/component from `specs/first-aid-disinfect-wounded-body-part.md` are already implemented and tested (`items:disinfectant_liquids_in_inventory`, `first-aid:disinfected`, action/rule integration tests).
- Tests currently fabricate an `items:antiseptic_bottle` via builders; no real entity file exists in `data/mods/items/entities/definitions/`, and the Items manifest does not list a disinfectant container.
- `containers-core:liquid_container` already supports `tags`, so tagging is available; we just lack canonical content with a `disinfectant` tag and non-zero volume.

## Goal
Ship a real disinfectant liquid container (antiseptic bottle) so content packs include at least one `disinfectant`-tagged item discoverable via the existing scope/action.

## Deliverables
- New entity definition at `data/mods/items/entities/definitions/antiseptic_bottle.entity.json` (portable item with `containers-core:liquid_container.tags` containing `"disinfectant"` and `currentVolumeMilliliters > 0`).
- Update `data/mods/items/mod-manifest.json` (and instances listing if an instance is added) to load the new entity.
- Add/adjust tests or content validation ensuring the entity loads, is manifest-wired, and meets the disinfectant tag + volume requirements.

## Out of scope
- No changes to core inventory mechanics, scopes, or the disinfect action/rule logic.
- No unrelated item stat tweaks or loot table changes.

## Acceptance criteria
- Content test/validation confirms the antiseptic bottle is loadable, included in the Items manifest, and has `containers-core:liquid_container.tags` containing `"disinfectant"` with positive volume.
- Existing items remain unchanged except for the new addition; manifests stay consistent with mod loading expectations.

## Status
Completed.

## Outcome
- Added `data/mods/items/entities/definitions/antiseptic_bottle.entity.json` as a portable disinfectant liquid container with positive volume and `disinfectant` tag.
- Registered the new entity in `data/mods/items/mod-manifest.json` and expanded `tests/integration/mods/items/entityLoading.test.js` to verify manifest wiring and tagging.
- Verified disinfectant scope and entity loading via `npm run test:integration -- --runInBand tests/integration/mods/items/entityLoading.test.js tests/integration/mods/items/disinfectant_liquids_in_inventory_scope.integration.test.js`.
