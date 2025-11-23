# TORPERANAREC-004: Create Shell Entity Definitions

## Objective
Create both shell part entities (carapace and plastron) that mount to the torso.

## Dependencies
- None (entity definitions can be created independently)

## Files to Touch
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_carapace.entity.json`
- **CREATE**: `data/mods/anatomy/entities/definitions/tortoise_plastron.entity.json`

## Out of Scope
- Do NOT modify existing entity definitions
- Do NOT create other tortoise entity files (handled in separate tickets)
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014)
- Do NOT create torso entity (handled in TORPERANAREC-003)

## Implementation Details

### File 1: `tortoise_carapace.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_carapace"`
3. **Description**: "Domed upper shell (carapace) with growth rings"

4. **Components**:
   - **anatomy:part**: subType "shell_carapace"
   - **core:name**: text "carapace"
   - **descriptors:texture**: texture "scaled"
   - **descriptors:pattern**: pattern "hexagonal-scutes"
   - **descriptors:color_extended**: color "dark-amber-brown"
   - **descriptors:shape_general**: shape "domed"

### File 2: `tortoise_plastron.entity.json`

Create entity definition with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/entity-definition.schema.json"`
2. **ID**: `"anatomy:tortoise_plastron"`
3. **Description**: "Flat lower shell (plastron) protecting underside"

4. **Components**:
   - **anatomy:part**: subType "shell_plastron"
   - **core:name**: text "plastron"
   - **descriptors:texture**: texture "smooth"
   - **descriptors:color_extended**: color "pale-yellow"
   - **descriptors:shape_general**: shape "flat"

## Acceptance Criteria

### Tests that must pass:
1. `npm run validate` - Schema validation passes for both files
2. Both entities validate against `entity-definition.schema.json`
3. All component IDs exist in the system
4. JSON is well-formed and parseable

### Invariants that must remain true:
1. No existing entity definitions are modified
2. subType values match torso socket allowedTypes: "shell_carapace", "shell_plastron"
3. Texture values are valid per component schema: "scaled", "smooth"
4. Shape values are valid: "domed", "flat"
5. Pattern value "hexagonal-scutes" is descriptive and follows conventions
6. Color values are free-form strings (no validation needed)
7. Both files follow identical structure pattern

## Validation Commands
```bash
npm run validate
```

## Definition of Done
- [ ] Both files created with correct schema references
- [ ] Entity IDs follow naming convention
- [ ] All components properly structured
- [ ] subTypes match socket requirements
- [ ] Descriptors use valid values
- [ ] Validation passes without errors
- [ ] Files committed with descriptive message
