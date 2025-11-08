# Sex - Anal Penetration Module

This module contains the anal teasing and penetration preparation flows that were previously delivered by the monolithic `sex` mod. It is intentionally slim so future anal penetration beats can slot in without touching unrelated content packs.

## Integration Guidelines

- **Shared Foundations**: Always pull shared anatomy, clothing, and positional checks from `sex-core` to avoid duplicating logic. The `actors_with_exposed_asshole_accessible_from_behind` scope demonstrates the pattern of composing positioning helpers (facing_away OR lying_down) with anatomy and clothing validators.
- **Palette Consistency**: New actions must apply the `Obsidian Teal` palette (`#053b3f` / `#e0f7f9` / `#075055` / `#f1feff`) to preserve accessibility guarantees documented in Section 12.6 of the WCAG color specification.
- **Event Wiring**: Conditions should continue to key off `core:attempt_action` events using the `sex-anal-penetration:` namespace so downstream analytics can filter anal interactions cleanly.

## TODO

- Expand beyond teasing with penetrative follow-ups once `SEXMODMOD-010` lands. Capture requirements from `specs/sex-mod-modularization-and-color-assignments.spec.md` Section 4 before implementing.
- Add lubrication state transitions by integrating upcoming `sex-core` components (`lubricated_anus`, pending) when they become available.
