# OXYDROSYS-008: Create feline lung entities and integrate

## Description

Create feline-specific lung entities and integrate them with cat_girl blueprints.

## Files to Create

- `data/mods/breathing/entities/definitions/feline_lung_left.entity.json`
- `data/mods/breathing/entities/definitions/feline_lung_right.entity.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add entities
- `data/mods/anatomy-creatures/` (or appropriate location for cat_girl blueprints/recipes)

## Out of Scope

- Other creature types
- Feline-specific breathing behaviors (future enhancement)

## Acceptance Criteria

1. **Entities valid**: Feline lung entities pass schema validation
2. **Slightly different stats**: May have different oxygen capacity if desired (e.g., 8 instead of 10)
3. **Blueprints updated**: cat_girl_* blueprints include lung slots
4. **Recipes updated**: cat_girl recipes specify feline lung entities

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Cat girl entity has respiratory organs

## Invariants

- All cat_girl variants get identical lung configuration
- No changes to non-feline creatures
