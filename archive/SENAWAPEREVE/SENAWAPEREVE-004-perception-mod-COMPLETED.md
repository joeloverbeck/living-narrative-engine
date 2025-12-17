# SENAWAPEREVE-004: Create Perception Mod and Sensory Capability Component

**Status**: ✅ COMPLETED
**Priority**: MEDIUM
**Effort**: Small
**Completed**: 2025-12-17

## Summary

Create the new `perception` mod with the `perception:sensory_capability` override component for manual sensory configuration on entities that don't have anatomy (e.g., magical constructs, spirits, or testing scenarios).

## File list it expects to touch

- **Create**: `data/mods/perception/mod-manifest.json`
- **Create**: `data/mods/perception/components/sensory_capability.component.json`
- **Modify**: `data/game.json` (add "perception" to mods list)

## Out of scope (must NOT change)

- Service implementations (handled in SENAWAPEREVE-003 and SENAWAPEREVE-005)
- Schema files other than the new component schema
- Any rules using this component
- Creating entity instances with this component
- Existing mod files
- Anatomy mod files

## Acceptance criteria

### Specific tests that must pass

- ✅ `npm run validate` passes with new mod (65 mods, 0 violations)
- ✅ `npm run test:unit -- --testPathPattern="schemas"` passes (no schema regressions)
- ✅ Game loads successfully with perception mod enabled

### Invariants that must remain true

- ✅ Mod has no dependencies (standalone mod for sensory override capability)
- ✅ Component is optional - entities don't need it for the system to work
- ✅ Existing game functionality unchanged
- ✅ All existing mods continue to load
- ✅ Component schema is valid against `component.schema.json`
- ✅ Mod manifest is valid against `mod-manifest.schema.json`

## Implementation details

### Mod manifest (`data/mods/perception/mod-manifest.json`)

> **Note (Corrected)**: The original ticket specified `"dependencies": ["core"]` as a simple string array and included `"loadOrder": 5`. Both are invalid per `mod-manifest.schema.json`:
> - Dependencies must be objects with `id` and `version` properties
> - `loadOrder` is not a valid manifest property (`additionalProperties: false`)
> - Since perception is a standalone mod that doesn't depend on core components, no dependencies are required

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "perception",
  "version": "1.0.0",
  "name": "Perception System",
  "description": "Sense-aware perception filtering for perceptible events",
  "author": "joeloverbeck",
  "gameVersion": ">=0.0.1",
  "content": {
    "components": ["sensory_capability.component.json"]
  }
}
```

> **Note (Corrected)**: Component paths in manifests are relative to the component type directory, not the mod root. So the path is `sensory_capability.component.json`, not `components/sensory_capability.component.json`.

### Component (`data/mods/perception/components/sensory_capability.component.json`)

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "perception:sensory_capability",
  "description": "Optional manual override for entity sensory capabilities. When present with overrideMode='manual', bypasses anatomy-based detection.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "canSee": {
        "type": "boolean",
        "default": true,
        "description": "Whether entity can see (has functioning visual sense)"
      },
      "canHear": {
        "type": "boolean",
        "default": true,
        "description": "Whether entity can hear (has functioning auditory sense)"
      },
      "canSmell": {
        "type": "boolean",
        "default": true,
        "description": "Whether entity can smell (has functioning olfactory sense)"
      },
      "canFeel": {
        "type": "boolean",
        "default": true,
        "description": "Whether entity can feel touch (tactile sense, typically always true)"
      },
      "overrideMode": {
        "type": "string",
        "enum": ["auto", "manual"],
        "default": "auto",
        "description": "When 'manual', these values override anatomy detection. When 'auto', anatomy is checked first."
      }
    },
    "additionalProperties": false
  }
}
```

### game.json modification

> **Note (Corrected)**: The original ticket suggested placing "perception" right after "anatomy", but the actual `game.json` has many mods between "core" and "anatomy". Since perception is a standalone system mod without dependencies, it should be placed after "observation" (a related perception concept) in the alphabetically-ordered mods list.

Add `"perception"` to the mods array, positioning it alphabetically near related mods:

```json
{
  "mods": [
    // ... earlier mods
    "observation",
    "perception",     // NEW - inserted alphabetically after observation
    // ... later mods
  ]
}
```

## Dependencies

- SENAWAPEREVE-001 (schema available for validation - conceptual)

## Dependent tickets

- SENAWAPEREVE-003 (SensoryCapabilityService reads this component)

---

## Outcome

### What was actually changed vs. originally planned

#### Planned Changes
1. Create `data/mods/perception/mod-manifest.json` with dependencies on `core`
2. Create `data/mods/perception/components/sensory_capability.component.json`
3. Modify `data/game.json` to add `"perception"` after `"anatomy"`

#### Actual Changes
1. Created `data/mods/perception/mod-manifest.json` **without** dependencies (standalone mod)
2. Created `data/mods/perception/components/sensory_capability.component.json` ✅ (as planned)
3. Modified `data/game.json` to add `"perception"` after `"observation"` (not after anatomy)

#### Ticket Corrections Made
The ticket contained several schema violations that were corrected before implementation:

1. **Invalid `loadOrder` property**: Ticket specified `"loadOrder": 5` but this property doesn't exist in `mod-manifest.schema.json` (`additionalProperties: false`). Removed.

2. **Invalid dependency format**: Ticket specified `"dependencies": ["core"]` but the schema requires objects: `{ "id": "core", "version": ">=1.0.0" }`. Since perception is standalone, removed dependencies entirely.

3. **Component path format**: Ticket specified `"components": ["components/sensory_capability.component.json"]` but manifest paths are relative to the component type directory, so the correct path is `"sensory_capability.component.json"`.

4. **Mod placement**: Original placement after "anatomy" didn't match actual `game.json` structure. Placed after "observation" instead.

### New/Modified Tests

| Test File | Change | Rationale |
|-----------|--------|-----------|
| `tests/unit/schemas/component.definition.schema.test.js` | Added `sensory_capability.component.json` to test.each array | Validates component conforms to component.schema.json |
| `tests/unit/schemas/modManifest.schema.test.js` | Added test for perception mod manifest | Validates manifest conforms to mod-manifest.schema.json |

### Verification Results

- `npm run validate`: PASS (65 mods, 0 violations)
- Schema unit tests: PASS (65 suites, 1352 tests)
- Schema integration tests: PASS (8 suites, 75 tests)
- Mod manifest tests: PASS (2 suites, 31 tests)
- Component definition tests: PASS (included in mod manifest tests)
