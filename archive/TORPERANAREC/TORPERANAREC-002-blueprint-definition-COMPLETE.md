# TORPERANAREC-002: Create Tortoise Person Blueprint V2 ✅ COMPLETED

## Objective

Create the V2 blueprint definition that references the structure template and defines shell mounting slots.

## Dependencies

- **REQUIRES**: TORPERANAREC-001 (structure template must exist) ✅

## Files to Touch

- **CREATE**: `data/mods/anatomy/blueprints/tortoise_person.blueprint.json` ✅

## Out of Scope

- Do NOT modify existing blueprint files ✅
- Do NOT create the structure template (handled in TORPERANAREC-001) ✅
- Do NOT create entity definitions yet (handled in TORPERANAREC-003-013) ✅
- Do NOT create the recipe (handled in TORPERANAREC-016) ✅
- Do NOT modify anatomy mod manifest (handled in TORPERANAREC-014) ✅

## Implementation Details

### File: `tortoise_person.blueprint.json`

Create blueprint with:

1. **Schema reference**: `"$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json"` ✅
2. **ID**: `"anatomy:tortoise_person"` ✅
3. **Schema version**: `"schemaVersion": "2.0"` ✅
4. **Root entity**: `"anatomy:tortoise_torso_with_shell"` (will be created in TORPERANAREC-003) ✅
5. **Structure template reference**: `"anatomy:structure_tortoise_biped"` ✅

6. **Additional Slots** (shell mounting points): ✅
   - **shell_upper**:
     - socket: "carapace_mount"
     - requirements:
       - partType: "shell_carapace"
       - components: ["anatomy:part"]

   - **shell_lower**:
     - socket: "plastron_mount"
     - requirements:
       - partType: "shell_plastron"
       - components: ["anatomy:part"]

7. **Clothing Slot Mappings**: ✅
   - **shell_armor**:
     - anatomySockets: ["carapace_mount"]
     - allowedLayers: ["armor", "accessory"]

## Acceptance Criteria

### Tests that must pass:

1. ✅ `npm run validate` - Schema validation passes
2. ✅ Blueprint validates against `anatomy.blueprint.schema.json`
3. ✅ Structure template reference resolves (after TORPERANAREC-001)
4. ✅ JSON is well-formed and parseable

### Invariants that must remain true:

1. ✅ No existing blueprints are modified
2. ✅ schemaVersion is exactly "2.0" (string, not number)
3. ✅ additionalSlots reference sockets that will exist in root torso entity
4. ✅ All socket IDs match exactly: "carapace_mount", "plastron_mount"
5. ✅ All part types match recipe expectations: "shell_carapace", "shell_plastron"
6. ✅ Root entity ID matches what will be created in TORPERANAREC-003

## Validation Commands

```bash
npm run validate
```

## Definition of Done

- [x] File created with correct schema reference
- [x] Structure template reference is correct
- [x] Additional slots properly defined
- [x] Clothing slot mappings configured
- [x] Validation passes without errors
- [x] File committed with descriptive message

---

## Outcome

**Status**: ✅ COMPLETED

**What was changed**:

- Created `data/mods/anatomy/blueprints/tortoise_person.blueprint.json` with V2 schema
- Blueprint references existing structure template `anatomy:structure_tortoise_biped`
- Defined two additional slots for shell mounting: `shell_upper` and `shell_lower`
- Added clothing slot mapping for shell armor/accessories
- All validation passes successfully

**Differences from original plan**: None - implementation matches specification exactly.

**Validation results**:

- Schema validation: ✅ PASS
- Structure template resolution: ✅ PASS (template exists and is valid)
- JSON well-formedness: ✅ PASS
- All invariants maintained: ✅ PASS

**Next steps**:

- Proceed to TORPERANAREC-003 (create root torso entity with shell sockets)
