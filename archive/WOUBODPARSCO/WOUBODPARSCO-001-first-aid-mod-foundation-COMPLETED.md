# WOUBODPARSCO-001: First-Aid Mod Foundation

Status: Completed

## Summary
Create the `first-aid` mod skeleton with manifest, folder layout, and color scheme alignment so medical scopes/actions can be added without blocking validation.

## Reality check (updated)
- No `data/mods/first-aid/` directory exists; there is no manifest, content folders, or scope placeholders.
- `docs/mods/mod-color-schemes.md` already lists First-Aid as Active on the Forest Green (4.1) palette even though the mod does not yet exist.
- The wounded body part scopes described in `specs/wounded-body-part-scoping.md` have no home mod yet.

## Scope
- Add `data/mods/first-aid/` with standard subfolders (`actions/`, `conditions/`, `rules/`, `scopes/`) and a minimal `mod-manifest.json` wired to core/anatomy dependencies relevant for anatomy/scopes.
- Keep `docs/mods/mod-color-schemes.md` aligned: confirm Forest Green (4.1) remains assigned to First-Aid and adjust counts/entries only if they are stale.
- Include a short README or notes file in the mod folder that states intent and references the wounded body part scoping spec.

## Acceptance criteria
- `mod-manifest.json` validates against `mod-manifest.schema.json` and lists core/anatomy dependencies needed for scope resolution without introducing unused content references.
- `docs/mods/mod-color-schemes.md` lists Forest Green (4.1) as **IN USE** by the first-aid mod with counts accurate and no other mod assignments altered.
- Scoped mod validation for first-aid (e.g., `node scripts/validateModReferences.js --mod=first-aid`) passes with the new mod present and empty content folders allowed.

## Invariants that must remain true
- Existing mod color assignments and counts remain accurate aside from the new first-aid entry.
- No schema or validation rule changes outside the new manifest; global validation behavior stays the same.
- Repository layout and naming conventions for mods stay consistent with existing mods.

## Outcome
- Added the `data/mods/first-aid/` skeleton (manifest plus empty actions/conditions/rules/scopes) with dependencies on `core` and `anatomy`.
- Documented intent and references in `data/mods/first-aid/README.md`; left `docs/mods/mod-color-schemes.md` unchanged because it already correctly reserves Forest Green (4.1) for First-Aid.
- Scoped validation `node scripts/validateModReferences.js --mod=first-aid` passes; full-ecosystem validation still reports pre-existing issues in other mods (warding cross-references, unregistered files).
