# SEXMODMOD-002: Stand Up `sex-core` Foundation Module

## Summary
Create the shared `sex-core` module that will host reusable components, scopes, and conditions, and adopt the legacy Mystic Purple visual identity so dependent modules can consume common assets.

## Prerequisites
- Completed inventory from `SEXMODMOD-001` highlighting which assets migrate into `sex-core`.
- Access to `data/mods/sex/` source files and `specs/sex-mod-modularization-and-color-assignments.spec.md`.

## Tasks
1. Create `data/mods/sex-core/` with `actions/`, `components/`, `conditions/`, `rules/`, `scopes/`, and `mod-manifest.json` directories/files mirroring the existing structure in `data/mods/sex/`.
2. Move or duplicate the shared assets identified in the inventory (e.g., `components/being_fucked_vaginally.component.json`, `components/fucking_vaginally.component.json`, posture scopes such as `actors_with_penis_facing_each_other.scope.json`, and reusable conditions) into the new module, updating `id` prefixes from `sex:` to `sex-core:`.
3. Update the new `mod-manifest.json` to declare dependencies on anatomy, clothing, and positioning mods, and expose the exported assets for consumption by other sexual modules.
4. Apply the `Mystic Purple` color scheme metadata to every action JSON retained in `sex-core`, ensuring the palette values match Section 5.1 of the WCAG spec.
5. Replace references in dependent files (initially within the legacy `sex` module) so they consume `sex-core:` IDs rather than `sex:`; note any external modules that will require updates in later tickets.
6. Add a `README.md` or inline documentation block inside `data/mods/sex-core/` summarizing the module's purpose and the expectation that all future shared sexual assets live here.

## Acceptance Criteria
- `data/mods/sex-core/` exists with a valid `mod-manifest.json` and contains all shared components, scopes, and conditions previously identified.
- All migrated files use the `sex-core:` namespace and include `Mystic Purple` color metadata.
- Dependencies in `mod-manifest.json` match the spec and lint/validation checks on the manifest succeed.
- References from the old `sex` assets point to the new `sex-core` namespace, with remaining external follow-ups documented.

## Validation
- Run `npm run validate:ecosystem -- --mods sex-core` (or the scoped validator command) and attach the passing output.
- Provide before/after diffs showing namespace updates for at least one component, scope, and condition.
