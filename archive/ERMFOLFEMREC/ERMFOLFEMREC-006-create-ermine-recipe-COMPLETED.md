# ERMFOLFEMREC-006: Create ermine-folk female recipe

Add recipe wiring the ermine-folk female blueprint with specific part preferences and body descriptors per spec. Prereqs (mustelid_core part, ermine ear/tail/torso entities, and blueprint) already exist in the mod; only the recipe and its registration remain.

## Status
Completed

## File list
- data/mods/dredgers/recipes/ermine_folk_female.recipe.json (new recipe filling blueprint slots with ermine ear/tail and human baseline parts)
- data/mods/dredgers/mod-manifest.json (register the new recipe so it is loaded)

## Out of scope
- Creating parts, entities, or blueprints
- Altering existing manifest content beyond adding the recipe entry

## Acceptance criteria
- Tests: `npm run validate:recipe data/mods/dredgers/recipes/ermine_folk_female.recipe.json` passes
- Invariants: recipe id `dredgers:ermine_folk_female_standard`; blueprintId `dredgers:ermine_folk_female`; bodyDescriptors and slot preferences match spec; manifest lists the recipe filename; no other recipe files changed

## Outcome
- Added the ermine-folk female recipe per spec and registered it in the dredgers manifest (original scope omitted the manifest entry).
- Validation: `npm run validate:recipe data/mods/dredgers/recipes/ermine_folk_female.recipe.json` (pass, warnings only).
