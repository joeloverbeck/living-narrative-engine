# ERMFOLFEMREC-002: Create ermine ear entity definition (COMPLETED)

## Outcome
- Added `data/mods/dredgers/entities/definitions/ermine_ear.entity.json` implementing the ermine ear per `specs/ermine-folk-female-recipe.md` (id `dredgers:ermine_ear`, hp 6, weight 0.008, shape `round`, texture `fuzzy`, hit weight 0.4).
- Left manifest/dependency wiring unchanged (ticket scoped out manifest edits and broader anatomy wiring).

## Notes on variance vs original plan
- Ticket assumptions updated to reflect current repo reality: dredgers manifest lacks descriptors dependency and only lists a missing `lady_thalia` file; per scope, manifest changes remain out of scope so the new ear is unregistered until a follow-up manifest sync.

## Test results
- `npm run validate:quick -- --mod dredgers`
