# LIGSYSDES-002: Create Lighting Component Schemas

## Status: ✅ COMPLETED (2025-12-16)

## Summary

Create three component JSON schema files for the lighting system: `naturally_dark` (marker), `light_sources` (reference array), and `description_in_darkness` (optional text override).

## Rationale

These components form the data layer of the lighting system:
- `naturally_dark`: Marks locations that have no natural light (caves, underground, etc.)
- `light_sources`: Tracks which light-emitting entities are currently illuminating a location
- `description_in_darkness`: Provides sensory-focused descriptions for when a location is dark

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/locations/components/naturally_dark.component.json` | Marker component for locations without natural light |
| `data/mods/locations/components/light_sources.component.json` | Array of entity IDs providing light |
| `data/mods/locations/components/description_in_darkness.component.json` | Alternative description for dark conditions |

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/locations/mod-manifest.json` | Add three component filenames to the `content.components` array |

## Out of Scope - DO NOT CHANGE

- Any component schemas in other mods (e.g., `data/mods/core/components/`)
- Any entity definition or instance files
- Any source code files in `src/`
- The component.schema.json base schema in `data/schemas/`
- Any existing dredgers mod files

## Implementation Details

### 1. `naturally_dark.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "locations:naturally_dark",
  "description": "Marks a location as having no natural light source. Requires active light sources to see.",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

**Usage**: Pure marker component. Presence = naturally dark, absence = ambient light available.

### 2. `light_sources.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "locations:light_sources",
  "description": "Array of active light source entity IDs providing illumination at this location.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "sources": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Entity IDs of active light sources"
      }
    },
    "required": ["sources"],
    "additionalProperties": false
  }
}
```

**Usage**: Empty array or missing component = no light. Non-empty = location is lit.

### 3. `description_in_darkness.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "locations:description_in_darkness",
  "description": "Alternative description shown when location is in darkness. Should focus on non-visual senses.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "Description emphasizing sounds, smells, textures, and atmosphere in darkness"
      }
    },
    "required": ["text"],
    "additionalProperties": false
  }
}
```

**Usage**: Optional. If present, replaces normal description in darkness. If absent, use generic fallback message.

### 4. Update `mod-manifest.json`

Update the `content.components` array:

```json
"components": [
  "naturally_dark.component.json",
  "light_sources.component.json",
  "description_in_darkness.component.json"
]
```

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation**: All three component files must pass JSON schema validation
   ```bash
   npm run validate
   ```

2. **Component schema tests**: Create unit tests for each component schema
   - File: `tests/unit/mods/locations/components/lightingComponents.test.js`
   - Test: `naturally_dark` schema accepts empty object `{}`
   - Test: `naturally_dark` schema rejects objects with extra properties
   - Test: `light_sources` schema requires `sources` array
   - Test: `light_sources` schema accepts valid entity ID strings in array
   - Test: `light_sources` schema rejects non-string items in sources
   - Test: `description_in_darkness` schema requires `text` property
   - Test: `description_in_darkness` schema accepts valid text string

3. **Manifest completeness test**: Verify manifest correctly lists all components
   - Extend test from LIGSYSDES-001 to verify `content.components` has 3 entries

### Invariants That Must Remain True

1. **Component ID format**: All component IDs must follow `namespace:identifier` pattern (`locations:*`)
2. **Schema compliance**: All components must conform to `schema://living-narrative-engine/component.schema.json`
3. **No ID conflicts**: Component IDs must not conflict with any existing component in any mod
4. **Manifest sync**: The `mod-manifest.json` must list exactly the components that exist in the `components/` folder

### Manual Verification

1. Run `npm run validate` - should complete without schema errors
2. Directory `data/mods/locations/components/` should contain exactly 3 `.component.json` files

## Dependencies

- LIGSYSDES-001 (mod structure must exist)

## Blocked By

- LIGSYSDES-001

## Blocks

- LIGSYSDES-003 (service needs components to query)
- LIGSYSDES-007 (content updates need components to exist)

## Estimated Diff Size

- 3 new files (component schemas)
- 1 modified file (mod-manifest.json, ~5 lines changed)
- 1 new test file (~50-80 lines)
- Total: ~150 lines

---

## Outcome

### What was actually changed vs originally planned

**Fully Implemented as Planned:**
- ✅ Created all 3 component schema files exactly as specified
- ✅ Updated `mod-manifest.json` with the 3 component entries
- ✅ Created unit test file `tests/unit/mods/locations/components/lightingComponents.test.js`

**Tests Created (17 total):**
- `locations:naturally_dark` - 4 tests (accept empty, reject extra props, reject non-object, reject null)
- `locations:light_sources` - 7 tests (valid array, empty array, require sources, reject non-strings, reject non-array, reject extra props, single source)
- `locations:description_in_darkness` - 6 tests (valid text, require text, empty string, reject non-string, reject extra props, multi-line)

**Integration Test Updated:**
- Modified `tests/integration/mods/locations/modManifestValidation.test.js` to verify:
  - `content.components` has exactly 3 entries
  - All 3 component filenames are present

**Validation Results:**
- `npm run validate` passes with 0 cross-reference violations across 64 mods
- All 17 unit tests pass
- All 12 integration tests pass

**No discrepancies from original ticket:** The implementation matched the specification exactly.
