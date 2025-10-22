# SEXMODMOD-006: Build `sex-dry-intimacy` Module

## Summary
Isolate grinding and frottage experiences into a `sex-dry-intimacy` module with the `Velvet Smoke` palette, ensuring clothing-aware variants keep their behavior and prerequisites intact.

## Prerequisites
- Completed inventories from `SEXMODMOD-001`.
- Availability of shared distance/posture helpers from `sex-core`.

## Tasks
1. Initialize `data/mods/sex-dry-intimacy/` with standard directories plus a manifest that depends on `sex-core`, clothing, and positioning mods.
2. Transfer the actions `grind_ass_against_penis`, `press_penis_against_ass_through_clothes`, `rub_pussy_against_penis_through_clothes`, `rub_vagina_over_clothes`, `rub_penis_between_ass_cheeks`, and `rub_penis_against_penis` with their respective rules, scopes, and conditions; rename IDs to the `sex-dry-intimacy:` namespace.
3. Ensure any shared helper scopes (e.g., close contact distance checks) reference `sex-core` implementations.
4. Inject `Velvet Smoke` color metadata (Section 12.4) into each action file, maintaining WCAG contrast compliance.
5. Confirm clothing-aware conditions continue to enforce garment requirements after namespacing and that dependencies are declared in the manifest.
6. Delete or archive the migrated files from `data/mods/sex/`, leaving compatibility wrappers only if required later.

## Acceptance Criteria
- The `sex-dry-intimacy` module holds all grinding/frottage actions with correct namespaces and color metadata.
- Manifest dependencies include `sex-core` and any other required mods, and validation passes.
- No duplicated grinding actions remain in the legacy `sex` module.
- Manual QA steps confirm clothing conditions still function after migration.

## Validation
- Attach `npm run validate:ecosystem -- --mods sex-dry-intimacy` output demonstrating success.
- Provide screenshots or diffs showing at least one clothing-aware action with the new namespace and color block.
