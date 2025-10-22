# SEXMODMOD-004: Build `sex-penile-manual` Module

## Summary
Extract all hand-based penis stimulation flows into the `sex-penile-manual` module with the `Ember Touch` color palette and ensure shared posture helpers are sourced from `sex-core`.

## Prerequisites
- `SEXMODMOD-001` inventory specifying manual penile actions and dependencies.
- `sex-core` module assets finalized from `SEXMODMOD-002`.

## Tasks
1. Create `data/mods/sex-penile-manual/` with standard directories and a manifest referencing `sex-core`, anatomy, clothing, and positioning mods.
2. Migrate the actions `fondle_penis`, `pump_penis`, `pump_penis_from_up_close`, and `rub_penis_over_clothes` with their corresponding rules, scopes, and conditions; rename IDs to `sex-penile-manual:`.
3. Re-point any reused scopes (e.g., standing face-to-face, kneeling) to `sex-core` equivalents; if the inventory indicates a scope is unique, keep it within the module.
4. Embed the `Ember Touch` palette metadata (Section 12.2) into each action file, verifying the structure matches existing color blocks.
5. Update or create localized documentation/readme summarizing the module scope and how it complements `sex-core`.
6. Remove the migrated assets from `data/mods/sex/`, leaving compatibility shims only if mandated by stakeholders.

## Acceptance Criteria
- `sex-penile-manual` actions, rules, scopes, and conditions exist only under the new module with correctly namespaced IDs.
- Color metadata for `Ember Touch` is present and validated on every action.
- No duplicate assets remain in the legacy `sex` module.
- Ecosystem validation passes without unresolved references.

## Validation
- Provide `npm run validate:ecosystem -- --mods sex-penile-manual` output showing success.
- Share a diff excerpt highlighting the namespace updates and color block insertion for at least one action.
