# TORPERANAREC-006: Create Facial Feature Entities (Beak and Eye)

## Objective
Create the beak and eye entity definitions that mount to the head.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_beak.entity.json`
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_eye.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create head entity (handled in TORPERANAREC-005)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File 1: `tortoise_beak.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_beak"`
3. **Description**: "Horny beak structure for herbivorous diet"

4. **Components**:
   - **anatomy:part**: subType "tortoise_beak"
   - **core:name**: text "beak"
   - **descriptors:texture**: texture "ridged"
   - **descriptors:color_extended**: color "charcoal-grey"
   - **descriptors:shape_general**: shape "hooked"

### File 2: `tortoise_eye.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_eye"`
3. **Description**: "Reptilian eye with protective nictitating membrane"

4. **Components**:
   - **anatomy:part**: subType "tortoise_eye"
   - **core:name**: text "eye"
   - **descriptors:color_extended**: color "amber"
   - **descriptors:shape_eye**: shape "round"

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes for both files
2. Both entities validate against `entity-definition.schema.json`
3. All component IDs exist in the system
4. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. subType values match head socket allowedTypes: "tortoise_beak", "tortoise_eye"
3. Texture values are valid: "ridged" (beak)
4. Shape values are valid: "hooked" (beak), "round" (eye)
5. Eye uses `descriptors:shape_eye` (not `descriptors:shape_general`)
6. Color values are free-form strings
7. Both files follow entity definition patterns

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] Both files created with correct schema references
- [ ] Entity IDs follow naming convention
- [ ] All components properly structured
- [ ] subTypes match socket requirements
- [ ] Descriptors use correct component types
- [ ] Validation passes without errors
- [ ] Files committed with descriptive message
