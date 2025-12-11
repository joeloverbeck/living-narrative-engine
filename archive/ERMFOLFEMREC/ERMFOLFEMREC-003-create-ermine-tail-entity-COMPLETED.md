# ERMFOLFEMREC-003: Create ermine tail entity definition (COMPLETED)

## Outcome
- Added `data/mods/dredgers/entities/definitions/ermine_tail.entity.json` per spec (id `dredgers:ermine_tail`, hp 8, weight 0.08, hit weight 2, length `medium`, texture `fuzzy`, flexibility `highly-flexible`).
- Updated `data/mods/dredgers/mod-manifest.json` to register `eira_quenreach.character.json`, `ermine_ear.entity.json`, `ermine_tail.entity.json`, and `mustelid_core.part.json`; added missing `descriptors` dependency and removed stale `lady_thalia` reference.
- Ticket assumptions corrected to reflect manifest state and dependency requirements; acceptance criteria clarified for mod-scoped validation.

## Notes on variance vs original plan
- Original ticket assumed only adding a tail entity and leaving manifest untouched. Current repository required manifest corrections (filename rename, missing dependency, unregistered parts) to make the new content valid; scope adjusted accordingly in the ticket before implementation.

## Test results
- `npm run validate:quick -- --mod dredgers`
