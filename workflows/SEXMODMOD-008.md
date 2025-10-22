# SEXMODMOD-008: Build `sex-anal-penetration` Module

## Summary
Establish the `sex-anal-penetration` module for current and future anal teasing/penetration flows, seeded with the `Obsidian Teal` palette and structured to allow future expansion.

## Prerequisites
- Inventory insights from `SEXMODMOD-001` highlighting anal-related assets.
- Access to `sex-core` for shared prerequisites.

## Tasks
1. Create `data/mods/sex-anal-penetration/` with standard directories and a manifest that depends on `sex-core`, anatomy, clothing, and positioning mods.
2. Move the existing `tease_asshole_with_glans` action (and any associated rules, scopes, or conditions) into the new module, renaming IDs to `sex-anal-penetration:`.
3. If the inventory uncovered placeholder files for future anal penetration, stub them within the new module with `TODO` markers and documentation pointing to follow-up specs.
4. Apply `Obsidian Teal` palette metadata (Section 12.6) to each action JSON and confirm the data structure matches other modules.
5. Update any rule or condition references so they leverage `sex-core` assets for shared anatomy/clothing checks.
6. Remove the anal-teasing files from `data/mods/sex/` after confirming the new module loads correctly.

## Acceptance Criteria
- `sex-anal-penetration` exists with appropriately namespaced assets and `Obsidian Teal` palette metadata.
- Manifest dependencies reflect requirements for anal interactions, and validation passes.
- Legacy `sex` module no longer houses anal-focused files.
- Documentation or inline comments describe how future anal expansions should hook into the module.

## Validation
- Run `npm run validate:ecosystem -- --mods sex-anal-penetration` and attach the passing output.
- Provide diffs or screenshots showing the migrated action and palette block.
