# TORPERANAREC-013: Create Tortoise Person Recipe

## Objective
Create the complete recipe definition that ties together the blueprint, entity definitions, and body descriptors.

## Dependencies
- **REQUIRES**: TORPERANAREC-001 (structure template)
- **REQUIRES**: TORPERANAREC-002 (blueprint)
- **REQUIRES**: TORPERANAREC-003 through TORPERANAREC-011 (all entity definitions)

## Files to Touch
- **CREATE**: `data/mods/anatomy/recipes/tortoise_person.recipe.json`

## Out of Scope
- Do NOT modify existing recipe files
- Do NOT create entity definitions (already completed)
- Do NOT create blueprint (already completed)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_person.recipe.json`

Create recipe with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json"`
2. **Recipe ID**: `"anatomy:tortoise_person"`
3. **Blueprint ID**: `"anatomy:tortoise_person"`

4. **Body Descriptors** (using exact enumerated values from Body Descriptor Registry):
   - height: "short"
   - build: "stocky"
   - composition: "average"
   - hairDensity: "hairless"
   - skinColor: "olive-green" (free-form)
   - smell: "earthy" (free-form)

5. **Slots** (5 unique parts):
   - **shell_upper**: shell_carapace with texture, pattern, color
   - **shell_lower**: shell_plastron with texture, color
   - **head**: tortoise_head with texture
   - **beak_mount**: tortoise_beak
   - **tail**: tortoise_tail

6. **Patterns** (5 pattern entries using matchesGroup and matches):
   - **Arms**: matchesGroup "limbSet:arm" → tortoise_arm with texture
   - **Legs**: matchesGroup "limbSet:leg" → tortoise_leg with texture, build
   - **Hands**: matches ["left_hand", "right_hand"] → tortoise_hand with digit_count, projection
   - **Feet**: matches ["left_foot", "right_foot"] → tortoise_foot with digit_count, projection
   - **Eyes**: matches ["left_eye", "right_eye"] → tortoise_eye with color

7. **Constraints** (3 requirements):
   - Shell requirement: ["shell_carapace", "shell_plastron"]
   - Beak requirement: ["tortoise_beak"]
   - Eyes requirement: ["tortoise_eye"]

## Critical Implementation Notes

### Pattern Matching Strategy
- **Use matchesGroup for bilateral limbs**: Arms and legs use structure template groups
- **Use matches for specific socket lists**: Eyes, hands, feet use explicit socket IDs
- **Do NOT use matchesPattern**: Not recommended per specification

### Property Overrides in Patterns
Each pattern can specify properties that override entity defaults:
- Properties must match component schemas exactly
- Use dot notation for component properties: `"descriptors:texture": { "texture": "scaled" }`

### Enumerated Values - MUST BE EXACT
Per Body Descriptor Registry (validate against specification):
- height: "short" (not "Short" or "SHORT")
- build: "stocky" (not "Stocky")
- hairDensity: "hairless" (not "bald" or "bare")

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. Recipe validates against `anatomy.recipe.schema.json`
3. `npm run validate:recipe` - Recipe-specific validation (pattern dry run, part availability)
4. All referenced entity definitions exist
5. Blueprint reference resolves
6. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing recipes are modified
2. All bodyDescriptors use valid enumerated values per Body Descriptor Registry
3. All pattern matchesGroup references valid limbSets: "limbSet:arm", "limbSet:leg"
4. All pattern matches arrays reference actual socket IDs from blueprint/template
5. All partType values match entity subTypes exactly
6. All preferId values reference existing entity definition IDs
7. Pattern properties use correct component ID format: "namespace:component"
8. Constraint partTypes match actual entity subTypes
9. Shell slots reference additionalSlots from blueprint
10. Recipe references correct blueprint ID

## Validation Commands
```bash
npm run validate
npm run validate:recipe
```

## Definition of Done
- [ ] File created with correct schema reference
- [ ] Recipe ID and blueprint ID match
- [ ] All body descriptors use valid values
- [ ] All 5 slots properly defined
- [ ] All 5 patterns correctly configured
- [ ] All 3 constraints specified
- [ ] Pattern matching uses correct strategies
- [ ] Validation passes without errors
- [ ] Recipe validation passes (dry run succeeds)
- [ ] File committed with descriptive message
