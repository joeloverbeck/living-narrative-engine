# TORPERANAREC-011: Create Tortoise Tail Entity

## Objective
Create the tail entity with reptilian characteristics.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_tail.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_tail.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_tail"`
3. **Description**: "Short, thick reptilian tail"

4. **Components**:

   - **anatomy:part**:
     - subType: "tortoise_tail"

   - **core:name**:
     - text: "tail"

   - **descriptors:texture**:
     - texture: "scaled"

   - **descriptors:length_category**:
     - length: "short"

   - **descriptors:shape_general**:
     - shape: "conical"

   - **descriptors:color_extended**:
     - color: "olive-green"

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. Entity validates against `entity-definition.schema.json`
3. All component IDs exist in the system
4. Component property schemas validate correctly
5. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. subType "tortoise_tail" matches structure template allowedTypes
3. Texture value "scaled" is valid per component schema
4. length_category.length property exists and is "short"
5. Shape value "conical" is valid per `descriptors:shape_general` schema
6. No sockets defined (tail is terminal appendage)
7. Uses length_category component (not generic length)

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] File created with correct schema reference
- [ ] Entity ID follows naming convention
- [ ] All components properly structured
- [ ] Length and shape descriptors correctly specified
- [ ] No sockets defined (terminal part)
- [ ] Validation passes without errors
- [ ] File committed with descriptive message
