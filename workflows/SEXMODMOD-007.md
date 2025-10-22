# SEXMODMOD-007: Build `sex-vaginal-penetration` Module

## Summary
Create the `sex-vaginal-penetration` module to host vaginal entry, straddling, and milking loops while applying the `Crimson Embrace` color scheme and preserving shared state references from `sex-core`.

## Prerequisites
- Inventory from `SEXMODMOD-001` detailing vaginal penetration assets and dependencies.
- `sex-core` components available for shared vaginal state.

## Tasks
1. Set up `data/mods/sex-vaginal-penetration/` with standard asset folders and a manifest that depends on `sex-core`, anatomy, clothing, and positioning as needed.
2. Migrate actions `insert_penis_into_vagina`, `insert_primary_penis_into_your_vagina`, `slide_penis_along_labia`, `straddling_penis_milking`, and `ride_penis_greedily` plus their rules, scopes, and conditions, renaming IDs to the `sex-vaginal-penetration:` namespace.
3. Confirm shared components like `being_fucked_vaginally` reference the `sex-core` versions and update rule references accordingly.
4. Apply the `Crimson Embrace` palette (Section 12.5) to every action JSON.
5. Ensure the manifest exposes all required assets and declares dependencies for any prerequisites such as arousal state or clothing checks.
6. Remove corresponding files from the legacy `sex` module once parity is validated.

## Acceptance Criteria
- All vaginal penetration and straddling actions exist only within the new module and use the correct namespace.
- Actions include `Crimson Embrace` color metadata and validate against WCAG requirements.
- Shared components/scopes come from `sex-core` with no duplicated logic.
- Ecosystem validation passes with the new module enabled.

## Validation
- Attach `npm run validate:ecosystem -- --mods sex-vaginal-penetration` logs demonstrating success.
- Provide diff excerpts showing updated component references and color assignments.
