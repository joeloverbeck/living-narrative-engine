# SEXMODMOD-005: Build `sex-penile-oral` Module

## Summary
Move all oral-focused penis/testicle interactions into `sex-penile-oral`, aligning metadata with the `Midnight Orchid` palette and ensuring teasing variants share common scaffolding from `sex-core`.

## Prerequisites
- Completed dependency inventory from `SEXMODMOD-001`.
- Availability of shared scaffolding within `sex-core`.

## Tasks
1. Scaffold `data/mods/sex-penile-oral/` with directories for actions, rules, scopes, and conditions plus a manifest that depends on `sex-core`.
2. Relocate the actions `breathe_teasingly_on_penis`, `breathe_teasingly_on_penis_sitting_close`, `lick_glans`, `lick_testicles_sensually`, `suckle_testicle`, and `nuzzle_penis_through_clothing` alongside their supporting files, renaming IDs to `sex-penile-oral:`.
3. Consolidate any reusable teasing scopes or proximity checks into `sex-core` if not already migrated, updating references accordingly.
4. Apply `Midnight Orchid` color metadata (Section 12.3) to every action JSON in the new module, using the same structure as other palette definitions.
5. Ensure audio/text descriptors or rule comments still align with the new namespaces, updating translation hooks if necessary.
6. Purge the migrated assets from the old `sex` module, retaining compatibility wrappers only if mandated in follow-up tickets.

## Acceptance Criteria
- All oral-focused actions and dependencies exist solely under `sex-penile-oral` with proper namespaces and palette metadata.
- Shared scopes/conditions reference `sex-core` rather than duplicating logic locally.
- Legacy module no longer contains these files, preventing duplicate behaviors.
- Validation passes for the new module manifest.

## Validation
- Capture `npm run validate:ecosystem -- --mods sex-penile-oral` output showing success.
- Provide representative diffs or logs demonstrating updated IDs and color blocks.
