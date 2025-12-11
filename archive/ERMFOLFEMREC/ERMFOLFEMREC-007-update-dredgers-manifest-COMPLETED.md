# ERMFOLFEMREC-007: Update dredgers mod manifest for ermine-folk female content

## Status
Completed

## Findings vs original assumptions
- `data/mods/dredgers/mod-manifest.json` already lists every ermine-folk female asset from `archive/specs/ermine-folk-female-recipe.md` (entities, blueprint, recipe, part); no missing registrations.
- Existing dependencies (`core`, `anatomy`, `descriptors`) are correct; no schema or version adjustments needed.

## Updated scope
- Verify the manifest matches the spec without unintended reorderings or omissions.
- Run `npm run validate:quick` to confirm the ecosystem loads with the ermine-folk assets registered.

## Work performed
- Reviewed `data/mods/dredgers/mod-manifest.json` against the spec; confirmed all ermine-folk female files are present and unrelated entries untouched.
- Executed `npm run validate:quick` (pass, warnings only).

## Acceptance criteria
- Tests: `npm run validate:quick` passes.
- Invariants: Manifest dependencies unchanged; ermine ear/tail/torso entities, ermine_folk_female blueprint/recipe, and mustelid_core part remain listed without altering unrelated entries.

## Outcome
- Scope reduced to verification because the manifest already contained the required registrations; no code changes were necessary. Archived the spec to `archive/specs/ermine-folk-female-recipe.md` for future reference.
