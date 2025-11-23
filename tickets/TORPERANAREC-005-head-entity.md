# TORPERANAREC-005: Create Tortoise Head Entity

## Objective
Create the head entity with sockets for eyes and beak mounting.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_head.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create eye or beak entities (handled in TORPERANAREC-006)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_head.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_head"`
3. **Description**: "Reptilian head with beak mount and eye sockets"

4. **Components**:

   - **anatomy:part**:
     - subType: "tortoise_head"

   - **anatomy:sockets** (facial feature mounting points):
     - sockets array with 3 entries:
       1. id: "left_eye"
          - allowedTypes: ["tortoise_eye"]
          - nameTpl: "left eye"
       2. id: "right_eye"
          - allowedTypes: ["tortoise_eye"]
          - nameTpl: "right eye"
       3. id: "beak_mount"
          - allowedTypes: ["tortoise_beak"]
          - nameTpl: "beak"

   - **core:name**:
     - text: "tortoise head"

   - **descriptors:texture**:
     - texture: "scaled"

   - **descriptors:shape_general**:
     - shape: "blunt"

   - **descriptors:color_extended**:
     - color: "grey-green"

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. Entity validates against `entity-definition.schema.json`
3. All component IDs exist in the system
4. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. Socket IDs exactly match recipe pattern expectations: "left_eye", "right_eye", "beak_mount"
3. Socket allowedTypes match entity types: ["tortoise_eye"], ["tortoise_beak"]
4. Texture value "scaled" is valid per component schema
5. Shape value "blunt" is valid per component schema
6. subType "tortoise_head" is unique
7. Socket count is exactly 3 (2 eyes + 1 beak)

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] File created with correct schema reference
- [ ] Entity ID follows naming convention
- [ ] All components properly structured
- [ ] Socket definitions complete and correct
- [ ] Descriptors use valid values
- [ ] Validation passes without errors
- [ ] File committed with descriptive message
