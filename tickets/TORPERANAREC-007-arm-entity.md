# TORPERANAREC-007: Create Tortoise Arm Entity

## Objective
Create the arm entity with socket for hand attachment.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_arm.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create hand entity (handled in TORPERANAREC-008)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_arm.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_arm"`
3. **Description**: "Scaled reptilian arm with hand socket"

4. **Components**:

   - **anatomy:part**:
     - subType: "tortoise_arm"

   - **anatomy:sockets** (hand attachment point):
     - sockets array with 1 entry:
       - id: "hand"
       - allowedTypes: ["tortoise_hand"]
       - nameTpl: "hand"

   - **core:name**:
     - text: "arm"

   - **descriptors:texture**:
     - texture: "scaled"

   - **descriptors:color_extended**:
     - color: "olive-green"

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. Entity validates against `entity-definition.schema.json`
3. All component IDs exist in the system
4. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. Socket ID is exactly "hand" (generic, not left/right)
3. Socket allowedTypes exactly matches: ["tortoise_hand"]
4. Texture value "scaled" is valid per component schema
5. subType "tortoise_arm" matches structure template allowedTypes
6. Socket count is exactly 1 (one hand per arm)
7. nameTpl is "hand" (orientation added by parent)

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] File created with correct schema reference
- [ ] Entity ID follows naming convention
- [ ] All components properly structured
- [ ] Socket definition matches hand entity expectations
- [ ] Descriptors use valid values
- [ ] Validation passes without errors
- [ ] File committed with descriptive message
