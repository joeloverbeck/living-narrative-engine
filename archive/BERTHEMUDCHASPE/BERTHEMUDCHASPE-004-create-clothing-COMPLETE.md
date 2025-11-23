# BERTHEMUDCHASPE-004: Create Leather Work Apron

## Description
Create the leather work apron entity (Bertram's iconic professional garment). This is the ONLY new clothing item - all other clothing is reused from existing entities.

## Files Expected to Touch
- CREATE: `data/mods/clothing/entities/definitions/leather_work_apron.entity.json`
- MODIFY: `data/mods/clothing/mod-manifest.json` (add apron reference to definitions array)

## Explicit Out of Scope
- **NO creation** of instance file (clothing mod uses definitions only, no instances array)
- **NO creation** of other clothing items (reuse existing: briefs, pants, shirt, belt, socks, boots)
- **NO recipe creation** (completed in BERTHEMUDCHASPE-003)
- **NO character entity creation** (that's BERTHEMUDCHASPE-005)
- **NO anatomy part work** (completed in BERTHEMUDCHASPE-002)
- **NO modification** of existing clothing entities

## Acceptance Criteria

### Required Components (Definition File)

Based on actual clothing entity structure (e.g., `battle_scarred_leather_jacket.entity.json`):

1. **clothing:wearable**:
   - `layer`: "outer"
   - `equipmentSlots.primary`: "torso_upper"
   - `allowedLayers`: ["underwear", "base", "outer"]

2. **core:material**:
   - `material`: "leather"
   - `properties`: ["flexible"]

3. **core:name**:
   - `text`: "leather work apron"

4. **core:description**:
   - `text`: Detailed description capturing:
     - Thick leather material
     - Tan-brown color with darker tannery stains
     - Large front pocket with tools
     - Reinforced stress points
     - Leather tie straps with mending
     - Well-worn but meticulously maintained
     - Professional pride and respect for craft

5. **descriptors:color_basic**:
   - `color`: "brown"

6. **descriptors:texture**:
   - `texture`: "worn"

7. **clothing:coverage_mapping**:
   - `covers`: ["torso_upper"]
   - `coveragePriority`: "outer"

8. **items:item**: {} (empty, marks as item)

9. **items:portable**: {} (empty, marks as portable)

10. **items:weight**:
    - `weight`: 1.0 (thick leather apron)

### Entity Structure
- Entity ID: `clothing:leather_work_apron`
- Schema: `schema://living-narrative-engine/entity-definition.schema.json`

### Critical Features to Preserve
- **ICONIC GARMENT**: This apron is Bertram's visual trademark
- Professional uniform showing pride in craft
- Well-worn but meticulously maintained (not shabby)
- Front pocket with tools (ready to work at any moment)
- Tan-brown base with darker staining from years of use
- Careful mending visible (respect for tools and materials)

### Specific Tests That Must Pass
- Definition file validates against entity-definition schema
- Entity ID follows format `clothing:leather_work_apron`
- All component types are valid registered components
- Visual description captures character essence
- `mod-manifest.json` includes definition reference in correct array
- `npm run validate` passes for clothing mod

### Invariants That Must Remain True
- **NO modification** of existing clothing entities
- **NO creation** of instance file (clothing mod doesn't use instances)
- **NO creation** of other clothing items
- Layer value must be from enum: ["underwear", "base", "outer", "accessories"]
- Equipment slot must be valid anatomy slot
- Weight must be reasonable for leather apron (0.5-2.0 kg)

## Implementation Notes
- This apron is Bertram's defining visual element - description should be rich
- Apron should communicate professionalism and pride, not poverty or neglect
- Reference existing clothing entities for component structure (e.g., battle_scarred_leather_jacket)
- Use actual component names: `clothing:wearable`, not `clothing:garment`
- Use `core:name` and `core:description`, not `clothing:appearance`
- Visual properties should capture the "might go back to work at any moment" essence

## Reference Clothing Entities (DO NOT MODIFY - FOR REFERENCE ONLY)
- `clothing:graphite_wool_briefs` (underwear)
- `clothing:shale_gray_nylon_field_pants` (work trousers)
- `clothing:charcoal_wool_tshirt` (work shirt)
- `clothing:dark_brown_leather_belt` (self-made belt)
- `clothing:dark_gray_wool_boot_socks` (work socks)
- `clothing:black_leather_duty_boots` (good boots)

## Reference
See `specs/bertram-the-muddy-character-spec.md` Section 4 for detailed apron specifications.

## Status
✅ COMPLETED - 2025-01-23

## Outcome
Successfully created the leather work apron entity using the correct component structure from the actual codebase. Key changes from original plan:
- Used `clothing:wearable` instead of non-existent `clothing:garment`
- Used `core:name` and `core:description` instead of `clothing:appearance`
- Used `core:material` instead of non-existent `clothing:material`
- Added required components: `items:item`, `items:portable`, `items:weight`
- Added descriptor components: `descriptors:color_basic`, `descriptors:texture`
- Added `clothing:coverage_mapping` component
- NO instance file created (clothing mod doesn't use instances array)
- Successfully added to mod-manifest definitions array
- All validation passes
