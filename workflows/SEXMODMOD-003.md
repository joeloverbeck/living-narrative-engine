# SEXMODMOD-003: Migrate Breastplay Actions to `sex-breastplay`

## Summary
Carve out the breast-focused interactions from the legacy `sex` module into a dedicated `sex-breastplay` mod with its own manifest, asset folders, and `Blush Amethyst` color identity.

## Prerequisites
- `SEXMODMOD-001` inventory that tags breastplay assets.
- `sex-core` module scaffold completed in `SEXMODMOD-002` so shared dependencies can be referenced.

## Tasks
1. Create `data/mods/sex-breastplay/` with the standard subdirectories and a starter `mod-manifest.json` that depends on `sex-core`, anatomy, clothing, and any other required mods.
2. Copy the actions `fondle_breasts`, `fondle_breasts_over_clothes`, and `press_against_back` plus their supporting rules, scopes, and conditions into the new module, renaming IDs from `sex:` to `sex-breastplay:`.
3. For any scopes or conditions that are reused by other modules, point them at the `sex-core:` versions instead of duplicating logic.
4. Add the `Blush Amethyst` palette metadata (Section 12.1 of the WCAG spec) to each action JSON in the new module, ensuring contrast ratios remain compliant.
5. Update the module manifest to expose the correct actions, rules, scopes, and declare dependency on `sex-core`.
6. Remove the migrated files from `data/mods/sex/` after confirming references are updated, leaving stubs only if backward compatibility placeholders are required.

## Acceptance Criteria
- `sex-breastplay` module contains only the breast-focused assets with correctly namespaced IDs and color metadata.
- All migrated assets reference `sex-core` for shared components/scopes when necessary.
- The legacy `sex` module no longer contains duplicate copies of the breastplay files.
- `npm run validate:ecosystem` passes for the new module.

## Validation
- Provide validation logs showing the new manifest loads without orphaned references.
- Include before/after file path screenshots or diffs confirming the migration and color metadata insertion.
