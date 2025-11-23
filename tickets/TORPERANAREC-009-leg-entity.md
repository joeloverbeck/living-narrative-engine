# TORPERANAREC-009: Create Tortoise Leg Entity

## Objective
Create the leg entity with socket for foot attachment and stocky build descriptor.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_leg.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create foot entity (handled in TORPERANAREC-010)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_leg.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_leg"`
3. **Description**: "Sturdy reptilian leg with foot socket"

4. **Components**:

   - **anatomy:part**:
     - subType: "tortoise_leg"

   - **anatomy:sockets** (foot attachment point):
     - sockets array with 1 entry:
       - id: "foot"
       - allowedTypes: ["tortoise_foot"]
       - nameTpl: "foot"

   - **core:name**:
     - text: "leg"

   - **descriptors:texture**:
     - texture: "scaled"

   - **descriptors:build**:
     - build: "stocky"

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
2. Socket ID is exactly "foot" (generic, not left/right)
3. Socket allowedTypes exactly matches: ["tortoise_foot"]
4. Texture value "scaled" is valid per component schema
5. Build value "stocky" is valid enumerated value per Body Descriptor Registry
6. subType "tortoise_leg" matches structure template allowedTypes
7. Socket count is exactly 1 (one foot per leg)

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] File created with correct schema reference
- [ ] Entity ID follows naming convention
- [ ] All components properly structured
- [ ] Socket definition matches foot entity expectations
- [ ] Build descriptor uses valid enumerated value
- [ ] Validation passes without errors
- [ ] File committed with descriptive message
