# LIGSYSDES-001: Create Locations Mod Structure and Manifest

## Status: ✅ COMPLETED

## Summary

Create the foundational `data/mods/locations/` mod directory structure and `mod-manifest.json` file that will contain all lighting-related components for the lighting system.

## Rationale

The lighting system requires a dedicated mod to keep `core` clean and allow optional inclusion. Following the project's "modding-first" philosophy, all lighting-related components and mechanics should live in this new mod.

## Files to Create

| File | Purpose |
|------|---------|
| `data/mods/locations/mod-manifest.json` | Mod manifest declaring the mod ID, version, dependencies, and content listings |

## Files to Modify

None.

## Out of Scope - DO NOT CHANGE

- Any existing mod manifests (e.g., `data/mods/core/mod-manifest.json`)
- Any existing location files in `data/mods/dredgers/`
- Any source code files in `src/`
- The game configuration file (`game.json`)
- Any schema files in `data/schemas/`

## Implementation Details

### Mod Manifest Structure

Create `data/mods/locations/mod-manifest.json` with the following structure:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "locations",
  "version": "1.0.0",
  "name": "Locations",
  "description": "Location-specific mechanics including lighting states and environmental conditions.",
  "author": "joeloverbeck",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "components": [],
    "conditions": [],
    "entities": {
      "definitions": [],
      "instances": []
    },
    "events": [],
    "rules": [],
    "scopes": [],
    "actions": []
  }
}
```

**Notes:**
- The `components` array will be populated in LIGSYSDES-002
- The `dependencies` array uses the correct schema format (array of objects with `id` and `version` properties)
- Follow the exact pattern used by other mods (see `data/mods/positioning/mod-manifest.json` for a reference with dependencies)

### Assumption Corrections (from original ticket)

**Original Assumption (INCORRECT)**:
```json
"dependencies": ["core"]
```

**Corrected** (per `mod-manifest.schema.json`):
```json
"dependencies": [
  {
    "id": "core",
    "version": "^1.0.0"
  }
]
```

The schema defines `dependencies` as an array of objects with required `id` and `version` properties, not simple strings.

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation**: The manifest must pass JSON schema validation
   ```bash
   npm run validate
   ```

2. **Manifest structure test**: Create a minimal test to verify manifest loads correctly
   - File: `tests/integration/mods/locations/modManifestValidation.test.js`
   - Test: Verify manifest can be loaded and parsed
   - Test: Verify `id` equals `"locations"`
   - Test: Verify `dependencies` includes `"core"`

### Invariants That Must Remain True

1. **No duplicate mod IDs**: The mod ID `"locations"` must not conflict with any existing mod
2. **Schema compliance**: Manifest must conform to `schema://living-narrative-engine/mod-manifest.schema.json`
3. **Dependency resolution**: The declared dependency on `core` must be valid

### Manual Verification

1. Run `npm run validate` - should complete without errors mentioning the new mod
2. The directory `data/mods/locations/` should exist with the manifest file

## Dependencies

- None (this is the first ticket in the sequence)

## Blocked By

- None

## Blocks

- LIGSYSDES-002 (component schemas require the mod structure to exist)

## Estimated Diff Size

- 1 new file
- ~25 lines total
