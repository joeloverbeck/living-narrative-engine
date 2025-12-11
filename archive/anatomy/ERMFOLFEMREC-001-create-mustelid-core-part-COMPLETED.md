# ERMFOLFEMREC-001: Create mustelid core blueprint part

Status: Completed

Define the reusable mustelid core blueprint part for the dredgers mod, mirroring the anatomy:feline_core structure but adapted for mustelid anatomy.

## Current state check
- The dredgers mod currently only ships `entities/definitions` content and depends solely on `core` in `mod-manifest.json`; no `parts/` directory exists yet.
- `npm run validate:quick` fails today on pre-existing missing dependencies (`fantasy`, `anatomy`) unrelated to this part. Use targeted validation for this ticket (see Acceptance criteria).
- Creating the part file does not wire it into the manifest; dependency updates to include `anatomy`/`descriptors` stay out of scope here and should be handled in the follow-up wiring tickets.

## File list
- data/mods/dredgers/parts/mustelid_core.part.json (new, schema-compliant mustelid core using humanoid slot library and clothingSlotMappings)

## Out of scope
- Changes to existing anatomy parts or slot libraries
- Blueprint, recipe, or manifest wiring
- Any anatomy stats beyond the specified mustelid core slots and clothing mappings

## Acceptance criteria
- Tests: `node scripts/validateMods.js --no-dependencies --no-cross-references --mod dredgers --quiet` passes (schema check without repo-wide dependency noise)
- Invariants: no modifications to other parts/blueprints/manifests; new part id remains `dredgers:mustelid_core` with slot and clothing mappings matching the spec

## Outcome
- Added `data/mods/dredgers/parts/mustelid_core.part.json` mirroring `anatomy:feline_core`.
- Validated the dredgers mod schema-only via `node scripts/validateMods.js --no-dependencies --no-cross-references --mod dredgers --quiet` because repo-wide `validate:quick` currently fails on pre-existing dependencies.
