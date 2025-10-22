# Sex Mod Modularization & Visual Identity Specification

## Overview

The current `sex` mod bundles a broad range of sexual interactions—manual, oral, grinding, vaginal, and light anal play—into a single manifest. This specification decomposes that manifest into cohesive thematic packs that align with the rest of the mod ecosystem (affection, caressing, clothing, movement, positioning, violence, etc.). Each new pack receives a distinct, WCAG-compliant visual identity so that sexual experiences can be enabled or disabled independently without losing accessibility parity.

## Goals

1. **Functional modularization**
   - Extract related actions into focused mods with clear scopes and dependencies.
   - Preserve reusable state components and conditions inside an anatomy-neutral `sex-core` foundation.
2. **Visual clarity**
   - Reassign the existing `Mystic Purple` color scheme from the legacy `sex` mod to the new `sex-core` module.
   - Introduce six new WCAG 2.1 AA/AAA compliant color palettes—documented in `wcag-compliant-color-combinations.spec.md`—and bind them to the new thematic modules.
3. **Future expansion**
   - Establish module-level conventions (naming, dependencies, color coordination) that simplify future additions such as anal penetration flows, aftercare, or oral deep-throat variants.

## Module Breakdown

### sex-core
- **Purpose**: Hosts shared scaffolding (state, rules, scopes) required across all sexual experiences.
- **Content**:
  - Components: `being_fucked_vaginally`, `fucking_vaginally`.
  - Shared scopes: `actors_with_penis_facing_each_other`, `actor_kneeling_before_target_with_penis`, and any additional neutral posture or distance helpers currently in the sex manifest.
  - Conditions: Anatomy or clothing checks referenced by multiple modules.
- **Dependencies**: Continues to depend on anatomy, clothing, and positioning mods.
- **Color Scheme**: `Mystic Purple` (Section 5.1). Documented as **USED BY** `sex-core` in `wcag-compliant-color-combinations.spec.md`.

### sex-breastplay
- **Scope**: Breast-focused stimulation, clothed or unclothed.
- **Actions**: `fondle_breasts`, `fondle_breasts_over_clothes`, `press_against_back` plus their rules, conditions, and breast-specific scopes.
- **Color Scheme**: `Blush Amethyst` (Section 12.1). Warm, intimate purples signifying close chest contact.

### sex-penile-manual
- **Scope**: Hand-centric penis stimulation variants.
- **Actions**: `fondle_penis`, `pump_penis`, `pump_penis_from_up_close`, `rub_penis_over_clothes`; migrate supporting scopes (e.g., standing face-to-face, kneeling) unless they belong in `sex-core`.
- **Color Scheme**: `Ember Touch` (Section 12.2). Copper-orange glow aligned with tactile, warming contact.

### sex-penile-oral
- **Scope**: Mouth-based penis and testicle play, including teasing setups.
- **Actions**: `breathe_teasingly_on_penis`, `breathe_teasingly_on_penis_sitting_close`, `lick_glans`, `lick_testicles_sensually`, `suckle_testicle`, `nuzzle_penis_through_clothing`.
- **Color Scheme**: `Midnight Orchid` (Section 12.3). Deep indigo base evoking low-light intimacy and oral focus.

### sex-dry-intimacy
- **Scope**: Grinding and frottage with or without clothing barriers.
- **Actions**: `grind_ass_against_penis`, `press_penis_against_ass_through_clothes`, `rub_pussy_against_penis_through_clothes`, `rub_vagina_over_clothes`, `rub_penis_between_ass_cheeks`, `rub_penis_against_penis`.
- **Color Scheme**: `Velvet Smoke` (Section 12.4). Dusky plum palette mirroring slow, close-bodied movement.

### sex-vaginal-penetration
- **Scope**: Vaginal entry, straddling loops, and associated lead-in teasing that leverages shared vaginal state.
- **Actions**: `insert_penis_into_vagina`, `insert_primary_penis_into_your_vagina`, `slide_penis_along_labia`, `straddling_penis_milking`, `ride_penis_greedily`.
- **Color Scheme**: `Crimson Embrace` (Section 12.5). Deep crimson for passionate, sustained connection.

### sex-anal-penetration
- **Scope**: Anal teasing and future anal-focused penetration mechanics.
- **Actions**: `tease_asshole_with_glans`, expanding as additional anal experiences ship.
- **Color Scheme**: `Obsidian Teal` (Section 12.6). Cool teal signaling deliberate, exploratory intensity.

## Implementation Steps

1. **Manifest Extraction**
   - Duplicate existing action JSON files into their new module directories, adjusting `id` namespaces (e.g., `sex-breastplay:fondle_breasts`).
   - Update manifests to reference their local actions, rules, and scopes.
   - Remove migrated entries from the original `sex` manifest once parity is confirmed.
2. **Core Asset Consolidation**
   - Move shared scopes/conditions/components into `sex-core` and expose them for downstream modules.
   - Validate references from child modules to ensure they import from `sex-core` rather than the legacy manifest path.
3. **Visual Assignment**
   - Apply the designated color scheme JSON blocks to each action file in its destination module.
   - Record color usage in `wcag-compliant-color-combinations.spec.md` (see Section 12 updates) so future authors avoid duplication.
4. **Dependency Wiring & Validation**
   - Ensure each new manifest declares dependencies on `sex-core` (and any other necessary mods).
   - Run `npm run validate:ecosystem` after restructuring to confirm there are no orphaned references.
5. **Documentation & Migration Notes**
   - Update mod catalog documentation (if any) to reflect new module names and distribution.
   - Provide migration guidance for save files or analytics dashboards referencing the old `sex` identifiers.

## Acceptance Criteria

- All original sexual actions exist in exactly one of the new modules, with equivalent behavior and correctly scoped conditions.
- `sex-core` retains every shared component, rule, or scope required by the specialized modules.
- Every module action carries the color scheme listed above, and the `wcag-compliant-color-combinations.spec.md` file records the palettes as **USED BY** their respective mods.
- The monolithic `sex` manifest is deprecated (or slimmed to a compatibility wrapper) without duplicating actions across modules.
- Automated validation passes (`npm run validate:ecosystem`) after restructuring, confirming module integrity.

