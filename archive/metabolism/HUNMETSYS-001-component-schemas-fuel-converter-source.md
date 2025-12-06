# HUNMETSYS-001: Component Schemas - Fuel Converter & Fuel Source

**Status:** Completed
**Priority:** High
**Estimated Effort:** 4 hours
**Actual Effort:** ~2 hours
**Phase:** 1 - Foundation
**Dependencies:** None

## Objective

Create component schemas for `metabolism:fuel_converter` and `metabolism:fuel_source` that define the core digestive system and consumable items.

## Files to Touch

### New Files (2)

- `data/mods/metabolism/components/fuel_converter.component.json`
- `data/mods/metabolism/components/fuel_source.component.json`

### Modified Files (0)

None - first components of new mod

## Out of Scope

- ❌ Operation handlers (covered in HUNMETSYS-003, 004, 005)
- ❌ Action definitions (covered in HUNMETSYS-008)
- ❌ Sample entities using these components (covered in HUNMETSYS-010)
- ❌ Mod manifest creation (covered in HUNMETSYS-006)
- ❌ Test creation (will be covered in later tickets after handlers exist)
- ❌ Cross-property validation (e.g., buffer_storage ≤ capacity) - must be enforced by operation handlers, not JSON Schema

## Implementation Details

### Fuel Converter Component

**Purpose:** Represents digestive organ (stomach, fuel tank, etc.) that converts consumed items into usable energy over time.

**Key Properties:**

- `capacity`: Maximum buffer storage (0-100 scale default)
- `buffer_storage`: Current content waiting to be digested
- `conversion_rate`: Points converted per turn
- `efficiency`: Conversion efficiency (0.0-1.0)
- `accepted_fuel_tags`: Array of compatible fuel types
- `activity_multiplier`: Current activity's effect on conversion rate

**Schema Requirements:**

- Extend from `schema://living-narrative-engine/component.schema.json`
- Set id as `metabolism:fuel_converter`
- Include validation rules for:
  - Efficiency range (0.0 to 1.0)
  - Non-negative values
  - Document buffer overflow constraint in description (enforced at runtime by operation handlers)
- Provide common fuel tag suggestions: `["organic", "blood", "electricity", "coal", "battery", "combustible"]`

### Fuel Source Component

**Purpose:** Defines consumable items with energy and volume properties.

**Key Properties:**

- `energy_density`: Total calories/energy provided
- `bulk`: Volume occupied in converter buffer (0-100)
- `fuel_tags`: Array indicating compatible converters
- `digestion_speed`: Enum ["instant", "fast", "medium", "slow"]
- `spoilage_rate`: Turns until spoilage (0 = never)

**Schema Requirements:**

- Extend from `schema://living-narrative-engine/component.schema.json`
- Set id as `metabolism:fuel_source`
- Include validation rules for:
  - Bulk range (0-100)
  - At least one fuel tag required
- Provide common fuel tag suggestions
- Provide digestion speed enum suggestions

## Acceptance Criteria

### Schema Validation

- [x] Both component schemas validate against `component.schema.json`
- [x] All required properties are properly defined
- [x] All validation rules are correctly specified
- [x] Default values are provided for optional properties

### Data Integrity

- [x] Fuel converter's buffer overflow constraint is documented in schema (enforced by operation handlers at runtime)
- [x] Efficiency must be between 0.0 and 1.0 (schema-enforced)
- [x] All numeric values must be non-negative (schema-enforced)
- [x] Fuel source's `bulk` must be between 0 and 100 (schema-enforced)
- [x] At least one fuel tag must be specified for fuel sources (schema-enforced)

### Validation Commands

```bash
# Run after creating schemas
npm run validate           # Basic validation
npm run validate:strict    # Strict validation
```

## Invariants

### Must Remain True

- Component schemas must be valid JSON
- Component IDs must follow format `metabolism:component_name`
- All properties must have clear descriptions
- No breaking changes to schema structure after initial commit

### System Invariants

- Existing component schemas must continue to validate
- No changes to core component schema structure
- Component registry must successfully load these schemas

## Testing Notes

**Note:** Unit tests will be created in HUNMETSYS-003 after operation handlers exist. This ticket focuses solely on schema definition and validation.

Validation testing should cover:

- Valid component data validates successfully
- Invalid data (negative values, missing required fields) is rejected
- Boundary conditions (efficiency = 1.0, bulk = 100) validate correctly

## Example Component Data

### Human Stomach (Fuel Converter)

```json
{
  "metabolism:fuel_converter": {
    "capacity": 100,
    "buffer_storage": 0,
    "conversion_rate": 5,
    "efficiency": 0.75,
    "accepted_fuel_tags": ["organic", "cooked", "raw"],
    "activity_multiplier": 1.0
  }
}
```

### Bread (Fuel Source)

```json
{
  "metabolism:fuel_source": {
    "energy_density": 200,
    "bulk": 30,
    "fuel_tags": ["organic", "cooked"],
    "digestion_speed": "medium",
    "spoilage_rate": 20
  }
}
```

## References

- Spec: Lines 100-264 (Component Definitions)
- Spec: Lines 1800-1936 (Data Schemas)
- Related: HUNMETSYS-002 (other component schemas)
- Related: HUNMETSYS-003, 004, 005 (operation handlers that use these)

## Definition of Done

- [x] Both component schema files created with complete definitions
- [x] Schemas validate with `npm run validate:strict`
- [x] All properties documented with clear descriptions
- [x] Validation rules implemented and tested
- [x] Code follows project naming conventions (camelCase for properties)
- [x] Committed with message: "feat(metabolism): add fuel_converter and fuel_source component schemas"

## Outcome

### What Was Actually Changed

1. **Ticket Corrections:**
   - Clarified that cross-property validation (buffer_storage ≤ capacity) cannot be enforced at the JSON Schema level
   - Updated acceptance criteria to reflect schema-enforced vs. runtime-enforced validations
   - Added cross-property validation to "Out of Scope" section

2. **Component Schemas Created:**
   - `data/mods/metabolism/components/fuel_converter.component.json`
     - All properties use camelCase naming (bufferStorage, conversionRate, acceptedFuelTags, activityMultiplier)
     - Efficiency constrained to 0.0-1.0 range via schema
     - All numeric fields constrained to non-negative values
     - Buffer overflow constraint documented in description
     - Includes validationRules for better error messages

   - `data/mods/metabolism/components/fuel_source.component.json`
     - All properties use camelCase naming (energyDensity, fuelTags, digestionSpeed, spoilageRate)
     - Bulk constrained to 0-100 range via schema
     - Digestion speed enum with 4 values: instant, fast, medium, slow
     - Minimum 1 fuel tag required via schema
     - Includes validationRules for better error messages

3. **Additional Files Created (Not Originally Planned):**
   - `data/mods/metabolism/mod-manifest.json` - Minimal manifest to enable validation (will be expanded in HUNMETSYS-006)

4. **Validation Results:**
   - Both schemas pass `npm run validate:strict` with 0 violations
   - Schemas successfully loaded by schema loader (95 total schemas)
   - Mod ecosystem validation shows metabolism mod with 0 cross-reference violations

### Differences from Original Plan

- **Added:** Minimal mod manifest (not originally planned but required for validation to recognize the mod)
- **Clarified:** Cross-property validation expectations moved from schema to runtime enforcement
- **Preserved:** All public APIs and schema structures follow existing component patterns
- **No breaking changes:** Schema infrastructure remains unchanged

### Next Steps

- HUNMETSYS-002: Create remaining component schemas (metabolic_hunger, energy_reserve)
- HUNMETSYS-003, 004, 005: Implement operation handlers that will enforce runtime constraints
- HUNMETSYS-006: Expand mod manifest with complete content definitions
