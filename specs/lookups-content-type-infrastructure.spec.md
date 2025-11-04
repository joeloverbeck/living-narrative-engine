# Lookups Content Type Infrastructure Specification

## Implementation Status

**Status**: PROPOSED – New Feature
**Date**: 2025-11-04
**Version**: 1.0.0
**Author**: Architecture Team

## 1. Overview

### 1.1 Executive Summary

This specification introduces a new "lookups" content type to the mod system, enabling modders to define static reference/lookup tables (e.g., mood descriptors, damage type metadata, material properties) in a semantically clear and validated manner. Unlike components (which attach to entities) or macros (which define operation sequences), lookups represent pure data mappings that can be queried at runtime without entity context.

### 1.2 Motivation

Current workarounds for lookup data include:
- **Component abuse**: Using components as namespaces for static data, which is semantically incorrect since components are designed for entity-attached state
- **Hardcoded constants**: Embedding lookup tables in source code, preventing modding
- **Action/rule workarounds**: Storing reference data in inappropriate structures

A dedicated lookups content type provides:
- **Semantic clarity**: Obvious intent and purpose
- **Mod-friendly**: Easy for modders to extend or override
- **Validated**: Schema-backed validation like all other content types
- **Future-proof**: Establishes pattern for damage types, material properties, status effects, etc.

### 1.3 Use Cases

**Primary Use Case** (driving this spec):
- Music performance mood descriptors mapping moods to adjectives/nouns

**Future Use Cases**:
- Damage type descriptions and resistances
- Material property tables (hardness, conductivity, etc.)
- Status effect metadata (icons, descriptions, stacking rules)
- Skill level descriptions (novice, expert, master)
- Weather effect descriptors
- Relationship level labels

## 2. Architecture Design

### 2.1 File Structure Convention

Lookup files follow the standard mod content pattern:

```
data/mods/{mod-id}/
└── lookups/
    ├── mood_descriptors.lookup.json
    ├── damage_types.lookup.json
    └── material_properties.lookup.json
```

**Naming Convention**:
- Folder: `lookups` (plural, lowercase)
- File pattern: `{lookup_name}.lookup.json`
- Lookup names: `snake_case`

### 2.2 JSON Schema Definition

Create `data/schemas/lookup.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/lookup.schema.json",
  "title": "Lookup Definition",
  "description": "Defines a static reference/lookup table that maps keys to structured data values.",
  "type": "object",
  "properties": {
    "$schema": {
      "$ref": "./common.schema.json#/definitions/BaseDefinition/properties/$schema"
    },
    "id": {
      "$ref": "./common.schema.json#/definitions/BaseDefinition/properties/id"
    },
    "description": {
      "$ref": "./common.schema.json#/definitions/BaseDefinition/properties/description"
    },
    "dataSchema": {
      "type": "object",
      "description": "JSON Schema defining the structure of each value in the lookup table. All entries must conform to this schema.",
      "additionalProperties": true
    },
    "entries": {
      "type": "object",
      "description": "Map of lookup keys to their corresponding data values. Each value is validated against dataSchema.",
      "minProperties": 1,
      "additionalProperties": true
    },
    "comment": {
      "type": "string",
      "description": "Optional note for modders. Ignored at runtime."
    }
  },
  "required": ["id", "description", "dataSchema", "entries"],
  "additionalProperties": false
}
```

### 2.3 Example Lookup File

**File**: `data/mods/music-performance/lookups/mood_descriptors.lookup.json`

```json
{
  "$schema": "schema://living-narrative-engine/lookup.schema.json",
  "id": "music_performance:mood_descriptors",
  "description": "Maps musical mood names to descriptive adjectives and nouns for performance narrative generation",
  "dataSchema": {
    "type": "object",
    "properties": {
      "adj": {
        "type": "string",
        "description": "Primary adjective describing the mood"
      },
      "adjectives": {
        "type": "string",
        "description": "Comma-separated list of adjectives for variety"
      },
      "noun": {
        "type": "string",
        "description": "Noun form of the mood descriptor"
      }
    },
    "required": ["adj", "adjectives", "noun"],
    "additionalProperties": false
  },
  "entries": {
    "cheerful": {
      "adj": "bright",
      "adjectives": "bright, skipping",
      "noun": "bouncy"
    },
    "solemn": {
      "adj": "grave",
      "adjectives": "measured, weighty",
      "noun": "grave"
    },
    "mournful": {
      "adj": "aching",
      "adjectives": "low, aching",
      "noun": "woeful"
    },
    "eerie": {
      "adj": "unsettling",
      "adjectives": "thin, uneasy",
      "noun": "hollow"
    },
    "tense": {
      "adj": "tight",
      "adjectives": "insistent, tight",
      "noun": "tight"
    },
    "triumphant": {
      "adj": "bold",
      "adjectives": "ringing, bold",
      "noun": "bold"
    },
    "tender": {
      "adj": "soft",
      "adjectives": "soft, warm",
      "noun": "delicate"
    },
    "playful": {
      "adj": "teasing",
      "adjectives": "quick, teasing",
      "noun": "skipping"
    },
    "aggressive": {
      "adj": "hard-edged",
      "adjectives": "driving, sharp",
      "noun": "hard-driving"
    },
    "meditative": {
      "adj": "calm",
      "adjectives": "slow, even",
      "noun": "steady"
    }
  }
}
```

## 3. Implementation Components

### 3.1 LookupLoader

**File**: `src/loaders/lookupLoader.js`

```javascript
/**
 * @file Loader for lookup table definitions.
 */

import { SimpleItemLoader } from './simpleItemLoader.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Loader responsible for lookup table definition files. Lookups provide
 * static reference/mapping data that can be queried at runtime.
 *
 * @class LookupLoader
 * @augments SimpleItemLoader
 */
class LookupLoader extends SimpleItemLoader {
  /**
   * Creates an instance of LookupLoader.
   *
   * @param {IConfiguration} config - Engine configuration service.
   * @param {IPathResolver} pathResolver - Resolves mod file paths.
   * @param {IDataFetcher} dataFetcher - Fetches raw lookup files.
   * @param {ISchemaValidator} schemaValidator - Validates lookups against schema.
   * @param {IDataRegistry} dataRegistry - Registry for storing loaded lookups.
   * @param {ILogger} logger - Logger for diagnostic messages.
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'lookups',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Optional: Add custom validation to ensure each entry conforms to dataSchema.
   * Can override _processFetchedItem if needed, but SimpleItemLoader's default
   * implementation should suffice for basic use cases.
   */
}

export default LookupLoader;
```

**Key Characteristics**:
- Extends `SimpleItemLoader` for standard processing
- Minimal implementation (15-20 lines)
- Schema validation handled by parent class
- Optional: Can add custom validation for `entries` conformance to `dataSchema`

### 3.2 Loader Metadata

**File**: `src/loaders/loaderMeta.js`

Add entry to the `meta` export:

```javascript
export const meta = {
  // ... existing entries ...

  lookups: {
    contentKey: 'lookups',
    diskFolder: 'lookups',
    phase: 'definitions',
    registryKey: 'lookups',
  },

  // ... rest of entries ...
};
```

**Lines Changed**: +6 lines

### 3.3 Default Loader Configuration

**File**: `src/loaders/defaultLoaderConfig.js`

Update JSDoc and function signature:

```javascript
/**
 * @param {BaseManifestItemLoaderInterface} deps.lookupLoader - Lookup loader.
 * ... other params ...
 */
export function createDefaultContentLoadersConfig({
  componentLoader,
  eventLoader,
  conditionLoader,
  macroLoader,
  actionLoader,
  ruleLoader,
  goalLoader,
  scopeLoader,
  entityDefinitionLoader,
  entityInstanceLoader,
  anatomySlotLibraryLoader,
  anatomyBlueprintPartLoader,
  anatomyBlueprintLoader,
  anatomyRecipeLoader,
  anatomyFormattingLoader,
  anatomyStructureTemplateLoader,
  lookupLoader, // ADD THIS
}) {
  return createContentLoadersConfig({
    components: componentLoader,
    events: eventLoader,
    conditions: conditionLoader,
    macros: macroLoader,
    actions: actionLoader,
    rules: ruleLoader,
    goals: goalLoader,
    scopes: scopeLoader,
    entityDefinitions: entityDefinitionLoader,
    entityInstances: entityInstanceLoader,
    anatomySlotLibraries: anatomySlotLibraryLoader,
    anatomyBlueprintParts: anatomyBlueprintPartLoader,
    anatomyBlueprints: anatomyBlueprintLoader,
    anatomyRecipes: anatomyRecipeLoader,
    anatomyFormatting: anatomyFormattingLoader,
    anatomyStructureTemplates: anatomyStructureTemplateLoader,
    lookups: lookupLoader, // ADD THIS
  });
}
```

**Lines Changed**: +2 lines (JSDoc param, function param in destructure, registry entry)

### 3.4 Dependency Injection Token

**File**: `src/dependencyInjection/tokens/tokens-core.js`

Add token to the `coreTokens` object:

```javascript
export const coreTokens = freeze({
  // ... existing tokens ...
  MacroLoader: 'MacroLoader',
  LookupLoader: 'LookupLoader', // ADD THIS
  EntityLoader: 'EntityLoader',
  // ... rest of tokens ...
});
```

**Lines Changed**: +1 line

### 3.5 Loader Registration

**File**: `src/dependencyInjection/registrations/loadersRegistrations.js`

**Step 1**: Add import

```javascript
// At top with other loader imports (around line 71)
import LookupLoader from '../../loaders/lookupLoader.js';
```

**Step 2**: Add JSDoc typedef

```javascript
/** @typedef {import('../../loaders/lookupLoader.js').default} LookupLoader */
```

**Step 3**: Register loader (around line 236)

```javascript
registerLoader(tokens.MacroLoader, MacroLoader);
registerLoader(tokens.LookupLoader, LookupLoader); // ADD THIS
```

**Step 4**: Include in ContentLoadManager factory (around line 347)

```javascript
new ContentLoadManager(
  c.resolve(tokens.ILogger),
  c.resolve(tokens.ModManifestProcessor),
  c.resolve(tokens.LoadResultAggregator),
  c.resolve(tokens.WorldLoadSummaryLogger),
  {
    // ... existing loaders ...
    macroLoader: c.resolve(tokens.MacroLoader),
    lookupLoader: c.resolve(tokens.LookupLoader), // ADD THIS
    entityDefinitionLoader: c.resolve(tokens.EntityLoader),
    // ... rest of loaders ...
  }
)
```

**Lines Changed**: +4 lines (import, typedef, registration, factory inclusion)

### 3.6 Data Registry Key

**File**: `src/constants/dataRegistryKeys.js`

Add constant for lookup registry key:

```javascript
export const LOOKUPS_KEY = 'lookups';
```

**Lines Changed**: +1 line

## 4. Runtime Usage

### 4.1 Accessing Lookup Data

Lookups are stored in the data registry and can be accessed like other content:

```javascript
// In a service or handler
const lookupId = 'music_performance:mood_descriptors';
const lookup = this.#dataRegistry.getById(lookupId, 'lookups');

// Access specific entry
const triumphantDescriptors = lookup.entries.triumphant;
// { adj: "bold", adjectives: "ringing, bold", noun: "bold" }

// Use in rule logic
const adjective = lookup.entries[mood]?.adj || 'neutral';
```

### 4.2 JSON Logic Integration (Optional Future Enhancement)

Could add custom JSON Logic operator for lookup access:

```json
{
  "lookup": ["music_performance:mood_descriptors", "triumphant", "adj"]
}
// Returns: "bold"
```

**Note**: Not required for initial implementation but reserves design space.

## 5. Testing Strategy

### 5.1 Unit Tests

**File**: `tests/unit/loaders/lookupLoader.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import LookupLoader from '../../../src/loaders/lookupLoader.js';

describe('LookupLoader', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should load valid lookup file', async () => {
    const mockData = {
      id: 'test_mod:test_lookup',
      description: 'Test lookup',
      dataSchema: { type: 'object' },
      entries: { key1: { value: 1 } },
    };

    const loader = testBed.createLoader(LookupLoader, 'lookups');
    const result = await loader._processFetchedItem(
      'test_mod',
      'test_lookup.lookup.json',
      '/path/to/file',
      mockData,
      'lookups'
    );

    expect(result.qualifiedId).toBe('test_mod:test_lookup');
  });

  it('should reject lookup with no entries', async () => {
    // Test schema validation failure
  });

  it('should validate entries against dataSchema', async () => {
    // Optional: Test entry conformance
  });
});
```

**Coverage Requirements**:
- Valid lookup loading
- Schema validation
- ID parsing and namespacing
- Error handling for malformed files

### 5.2 Integration Tests

**File**: `tests/integration/loaders/lookupLoader.integration.test.js`

```javascript
describe('LookupLoader Integration', () => {
  it('should load lookup from disk and store in registry', async () => {
    // Full mod loading workflow test
  });

  it('should respect mod load order for lookup overrides', async () => {
    // Test mod override behavior
  });

  it('should be accessible via data registry after loading', async () => {
    // Test runtime access pattern
  });
});
```

### 5.3 Schema Validation Tests

**File**: `tests/unit/schemas/lookup.schema.test.js`

```javascript
describe('Lookup Schema Validation', () => {
  it('should validate complete lookup with all required fields', () => {});
  it('should reject lookup missing entries', () => {});
  it('should reject lookup with invalid dataSchema', () => {});
  it('should allow optional comment field', () => {});
});
```

## 6. Migration Strategy

### 6.1 Backward Compatibility

**Zero Breaking Changes**:
- Existing mods continue to work unchanged
- No modifications to existing content types
- Purely additive feature

### 6.2 Migration Path for Existing Workarounds

For mods currently using components as lookup namespaces:

1. Create new lookup file with same data
2. Update code to reference lookup instead of component
3. Remove old component file
4. No runtime migration needed (content is static)

**Example Migration**:

Before (component workaround):
```json
// data/mods/my-mod/components/mood_descriptors.component.json
{
  "id": "my_mod:mood_descriptors",
  "dataSchema": {
    "properties": {
      "cheerful": { "type": "object", ... }
    }
  }
}
```

After (proper lookup):
```json
// data/mods/my-mod/lookups/mood_descriptors.lookup.json
{
  "id": "my_mod:mood_descriptors",
  "dataSchema": { "type": "object", ... },
  "entries": {
    "cheerful": { ... }
  }
}
```

## 7. Implementation Checklist

### 7.1 Core Infrastructure

- [ ] Create `data/schemas/lookup.schema.json`
- [ ] Create `src/loaders/lookupLoader.js`
- [ ] Update `src/loaders/loaderMeta.js`
- [ ] Update `src/loaders/defaultLoaderConfig.js`
- [ ] Update `src/dependencyInjection/tokens/tokens-core.js`
- [ ] Update `src/dependencyInjection/registrations/loadersRegistrations.js`
- [ ] Update `src/constants/dataRegistryKeys.js`

### 7.2 Testing

- [ ] Create `tests/unit/loaders/lookupLoader.test.js`
- [ ] Create `tests/integration/loaders/lookupLoader.integration.test.js`
- [ ] Create `tests/unit/schemas/lookup.schema.test.js`
- [ ] Verify 80%+ coverage on new code

### 7.3 Documentation

- [ ] Add lookups section to `CLAUDE.md` (if needed)
- [ ] Document lookup access patterns in relevant guides
- [ ] Add example lookup files to docs/examples (optional)

### 7.4 Validation

- [ ] Run `npm run validate` on example lookup files
- [ ] Verify schema validation catches malformed lookups
- [ ] Test mod override behavior
- [ ] Run full test suite: `npm run test:ci`
- [ ] Run linting: `npx eslint src/loaders/lookupLoader.js`
- [ ] Run type checking: `npm run typecheck`

## 8. Acceptance Criteria

1. ✅ Modders can create `{lookup_name}.lookup.json` files in `data/mods/{mod}/lookups/`
2. ✅ Lookup files validate against `lookup.schema.json`
3. ✅ Lookups load during mod loading phase and store in registry
4. ✅ Lookups accessible via `dataRegistry.getById(id, 'lookups')`
5. ✅ Entry data validates against lookup's `dataSchema`
6. ✅ Mod override behavior works (later mod overrides earlier)
7. ✅ All unit and integration tests pass
8. ✅ Code coverage meets 80% threshold
9. ✅ No breaking changes to existing content types
10. ✅ Example lookup file loads successfully in test environment

## 9. Code Impact Summary

### Files Created (3)
- `src/loaders/lookupLoader.js` (~60 lines)
- `data/schemas/lookup.schema.json` (~40 lines)
- `tests/unit/loaders/lookupLoader.test.js` (~100 lines)
- `tests/integration/loaders/lookupLoader.integration.test.js` (~80 lines)
- `tests/unit/schemas/lookup.schema.test.js` (~60 lines)

### Files Modified (5)
- `src/loaders/loaderMeta.js` (+6 lines)
- `src/loaders/defaultLoaderConfig.js` (+3 lines)
- `src/dependencyInjection/tokens/tokens-core.js` (+1 line)
- `src/dependencyInjection/registrations/loadersRegistrations.js` (+4 lines)
- `src/constants/dataRegistryKeys.js` (+1 line)

**Total Impact**: ~355 new lines, 15 modified lines across 8 files

## 10. Open Questions

### 10.1 Entry Validation Strictness

**Question**: Should we validate that each entry in `entries` conforms to `dataSchema` at load time?

**Options**:
1. **Strict**: Validate every entry, fail loading if any entry violates dataSchema
2. **Permissive**: Only validate presence of `entries`, let runtime handle bad data
3. **Hybrid**: Validate in development, skip in production

**Recommendation**: Start with **Strict** validation to catch modder errors early. Can relax later if performance becomes concern.

### 10.2 Nested Lookups

**Question**: Should lookups support referencing other lookups?

**Example**:
```json
{
  "id": "damage:resistances",
  "entries": {
    "fire": { "types": "@damage:type_table.fire" }
  }
}
```

**Recommendation**: Defer to future spec. Keep initial implementation simple.

### 10.3 Registry Helper Methods

**Question**: Should we add convenience methods to IDataRegistry?

**Example**:
```javascript
dataRegistry.getLookupEntry(lookupId, entryKey);
// vs
dataRegistry.getById(lookupId, 'lookups').entries[entryKey];
```

**Recommendation**: Defer to future enhancement after usage patterns emerge.

## 11. Future Enhancements

### 11.1 Lookup Inheritance

Allow lookups to extend/override other lookups:

```json
{
  "id": "my_mod:extended_moods",
  "extends": "base_mod:mood_descriptors",
  "entries": {
    "ecstatic": { "adj": "soaring", ... }
  }
}
```

### 11.2 Computed Entries

Support dynamic entry generation:

```json
{
  "entries": {
    "computed": {
      "@function": "generateRange",
      "start": 1,
      "end": 10
    }
  }
}
```

### 11.3 Localization Support

Integrate with future localization system:

```json
{
  "entries": {
    "cheerful": {
      "adj": { "@i18n": "mood.cheerful.adj" }
    }
  }
}
```

## 12. References

### Related Specifications
- `anatomy-v2-validation-alignment.spec.md` - Schema validation patterns
- `gymnastics-mod.spec.md` - Mod structure conventions

### Related Documentation
- `docs/testing/mod-testing-guide.md` - Testing patterns for mod content
- `CLAUDE.md` - Project architecture overview

### Related Code
- `src/loaders/macroLoader.js` - Similar simple loader implementation
- `src/loaders/componentLoader.js` - Component loading reference
- `data/schemas/macro.schema.json` - Schema structure reference
- `data/schemas/component.schema.json` - Schema structure reference

---

**End of Specification**

_This specification provides a complete implementation plan for adding lookups as a first-class content type to the Living Narrative Engine mod system. The design prioritizes simplicity, consistency with existing patterns, and future extensibility._
