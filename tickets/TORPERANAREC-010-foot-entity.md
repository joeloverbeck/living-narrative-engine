# TORPERANAREC-010: Create Tortoise Foot Entity

## Objective
Create the foot entity with three clawed toes.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_foot.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create leg entity (handled in TORPERANAREC-009)
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)

## Implementation Details

### File: `tortoise_foot.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_foot"`
3. **Description**: "Broad foot with three clawed toes"

4. **Components**:

   - **anatomy:part**:
     - subType: "tortoise_foot"

   - **core:name**:
     - text: "foot"

   - **descriptors:texture**:
     - texture: "leathery"

   - **descriptors:digit_count**:
     - count: 3

   - **descriptors:projection**:
     - projection: "clawed"

   - **descriptors:color_extended**:
     - color: "grey-green"

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes
2. Entity validates against `entity-definition.schema.json`
3. All component IDs exist in the system
4. Component property schemas validate correctly
5. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. subType "tortoise_foot" matches leg socket allowedTypes
3. Texture value "leathery" is valid per component schema
4. digit_count.count is numeric value 3 (not string)
5. projection value "clawed" is valid per `descriptors:projection` schema
6. No sockets defined (foot is terminal limb part)
7. Component structure mirrors hand entity pattern

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] File created with correct schema reference
- [ ] Entity ID follows naming convention
- [ ] All components properly structured
- [ ] Digit count and projection correctly specified
- [ ] No sockets defined (terminal part)
- [ ] Validation passes without errors
- [ ] File committed with descriptive message
