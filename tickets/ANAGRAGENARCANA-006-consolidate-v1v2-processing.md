# ANAGRAGENARCANA-006: Consolidate V1/V2 Processing Logic

## Metadata
- **ID**: ANAGRAGENARCANA-006
- **Priority**: MEDIUM
- **Severity**: P6
- **Effort**: High
- **Source**: `reports/anatomy-graph-generation-architecture-analysis.md` - R5
- **Related Issue**: MEDIUM-03 (V1/V2 Detection Duplication)

---

## Problem Statement

Version detection and processing logic is duplicated across two files, creating maintenance burden and potential for divergence:

### Current State

**File 1: `blueprintLoader.js:49`**
```javascript
if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
  return processV2Blueprint(blueprint, dependencies);
}
```

**File 2: `BlueprintProcessorService.js`**
```javascript
detectVersion(blueprint) {
  if (blueprint.schemaVersion === '2.0') return 2;
  return 1;
}
```

### Issues
1. **Dual implementations**: Both files have V1/V2 detection logic
2. **Processing flag inconsistency**: `_generatedSockets` array used to detect V2 processing state
3. **Pattern resolver integration**: V2 pattern handling split between `RecipeProcessor` and `RecipePatternResolver`
4. **No automatic migration path**: V1 recipes cannot be easily upgraded to V2

---

## Affected Files

| File | Change Type |
|------|-------------|
| `src/anatomy/bodyBlueprintFactory/blueprintLoader.js` | Refactor - delegate to service |
| `src/anatomy/services/blueprintProcessorService.js` | Enhance - add V2 processing |
| `src/anatomy/recipeProcessor.js` | Review - clarify V1 role |
| `src/anatomy/recipePatternResolver/patternResolver.js` | Review - clarify V2 role |

---

## Implementation Steps

### Step 1: Audit Current V1/V2 Logic Distribution

Document all locations where version detection or processing occurs:

```bash
# Search for version-related code
grep -rn "schemaVersion" src/anatomy/
grep -rn "V1\|V2" src/anatomy/
grep -rn "_generatedSockets\|_generatedSlots" src/anatomy/
```

### Step 2: Design Consolidated Architecture

**Single Source of Truth**: `BlueprintProcessorService`

```javascript
/**
 * @file BlueprintProcessorService.js
 * @description Centralized blueprint version detection and processing.
 */
export class BlueprintProcessorService {
  /**
   * Detects blueprint schema version.
   * @param {Object} blueprint - Raw blueprint object
   * @returns {1 | 2} Version number
   */
  detectVersion(blueprint) {
    if (blueprint.schemaVersion === '2.0') {
      return 2;
    }
    return 1;
  }

  /**
   * Determines if a blueprint requires V2 processing.
   * V2 processing is needed when structureTemplate is present.
   * @param {Object} blueprint - Raw blueprint object
   * @returns {boolean}
   */
  requiresV2Processing(blueprint) {
    return this.detectVersion(blueprint) === 2 &&
           blueprint.structureTemplate != null;
  }

  /**
   * Processes a blueprint according to its version.
   * @param {Object} blueprint - Raw blueprint object
   * @param {Object} dependencies - Required dependencies for processing
   * @returns {Promise<Object>} Processed blueprint with slots and sockets
   */
  async process(blueprint, dependencies) {
    if (this.requiresV2Processing(blueprint)) {
      return this.#processV2Blueprint(blueprint, dependencies);
    }
    return this.#processV1Blueprint(blueprint);
  }

  /**
   * V1 processing: minimal transformation, direct slot pass-through.
   */
  #processV1Blueprint(blueprint) {
    return {
      ...blueprint,
      _processingVersion: 1,
      _wasProcessed: true
    };
  }

  /**
   * V2 processing: template expansion, socket/slot generation.
   */
  async #processV2Blueprint(blueprint, dependencies) {
    const { socketGenerator, slotGenerator, dataRegistry } = dependencies;

    // Load and expand structure template
    const template = await dataRegistry.get('structureTemplates', blueprint.structureTemplate);

    // Generate sockets from template
    const generatedSockets = socketGenerator.generateSockets(template, blueprint);

    // Generate slots from template
    const generatedSlots = slotGenerator.generateBlueprintSlots(template, blueprint);

    // Merge with additionalSlots (additionalSlots override generated)
    const mergedSlots = {
      ...generatedSlots,
      ...(blueprint.additionalSlots || {})
    };

    return {
      ...blueprint,
      slots: mergedSlots,
      sockets: this.#mergeSockets(blueprint.sockets, generatedSockets),
      _generatedSlots: generatedSlots,
      _generatedSockets: generatedSockets,
      _processingVersion: 2,
      _wasProcessed: true
    };
  }

  /**
   * Merges entity-defined sockets with template-generated sockets.
   * Generated sockets override entity sockets with same ID.
   */
  #mergeSockets(entitySockets, generatedSockets) {
    const socketMap = new Map();

    for (const socket of entitySockets || []) {
      socketMap.set(socket.id, socket);
    }

    for (const socket of generatedSockets || []) {
      socketMap.set(socket.id, socket);
    }

    return Array.from(socketMap.values());
  }
}
```

### Step 3: Refactor blueprintLoader to Delegate

Update `blueprintLoader.js` to use the service:

```javascript
// Before
if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
  return processV2Blueprint(blueprint, dependencies);
}
return blueprint;

// After
const blueprintProcessor = dependencies.blueprintProcessorService;
return blueprintProcessor.process(blueprint, dependencies);
```

### Step 4: Update Dependency Injection

Ensure `BlueprintProcessorService` is properly registered and injected:

```javascript
// In registrations file
container.register(tokens.IBlueprintProcessorService, BlueprintProcessorService);

// In blueprintLoader factory
const blueprintLoader = ({ blueprintProcessorService, dataRegistry }) => {
  return {
    load: async (blueprintId) => {
      const rawBlueprint = await dataRegistry.get('blueprints', blueprintId);
      return blueprintProcessorService.process(rawBlueprint, { /* deps */ });
    }
  };
};
```

### Step 5: Remove Duplicate Logic

1. Remove `processV2Blueprint()` function from `blueprintLoader.js`
2. Remove inline version detection from `blueprintLoader.js`
3. Keep only centralized logic in `BlueprintProcessorService`

### Step 6: Document Version Processing

Add clear documentation about the processing pipeline:

```javascript
/**
 * Blueprint Processing Pipeline
 *
 * V1 (Legacy):
 *   - No schemaVersion or schemaVersion: "1.0"
 *   - Slots defined directly in blueprint.slots
 *   - Minimal processing, direct pass-through
 *
 * V2 (Template-Based):
 *   - schemaVersion: "2.0"
 *   - structureTemplate references a template definition
 *   - Sockets generated from template
 *   - Slots generated from template + additionalSlots
 *   - Pattern resolution via RecipePatternResolver
 *
 * Processing Markers:
 *   - _processingVersion: 1 or 2
 *   - _wasProcessed: true when processing complete
 *   - _generatedSlots: slots from template (V2 only)
 *   - _generatedSockets: sockets from template (V2 only)
 */
```

---

## Testing Requirements

### Unit Tests

Create/update tests in `tests/unit/anatomy/services/BlueprintProcessorService.test.js`:

1. **Test: Should detect V1 blueprints correctly**
```javascript
describe('detectVersion', () => {
  it('should return 1 for blueprints without schemaVersion', () => {
    expect(service.detectVersion({})).toBe(1);
    expect(service.detectVersion({ slots: {} })).toBe(1);
  });

  it('should return 1 for explicit V1 blueprints', () => {
    expect(service.detectVersion({ schemaVersion: '1.0' })).toBe(1);
  });

  it('should return 2 for V2 blueprints', () => {
    expect(service.detectVersion({ schemaVersion: '2.0' })).toBe(2);
  });
});
```

2. **Test: Should determine V2 processing requirement**
```javascript
describe('requiresV2Processing', () => {
  it('should return false for V2 without structureTemplate', () => {
    expect(service.requiresV2Processing({
      schemaVersion: '2.0'
      // No structureTemplate
    })).toBe(false);
  });

  it('should return true for V2 with structureTemplate', () => {
    expect(service.requiresV2Processing({
      schemaVersion: '2.0',
      structureTemplate: 'templates:biped'
    })).toBe(true);
  });
});
```

3. **Test: Should process V1 blueprints with minimal transformation**
```javascript
it('should add processing markers to V1 blueprints', async () => {
  const v1Blueprint = { slots: { head: {} } };
  const result = await service.process(v1Blueprint, {});

  expect(result._processingVersion).toBe(1);
  expect(result._wasProcessed).toBe(true);
  expect(result.slots).toEqual({ head: {} });
});
```

4. **Test: Should process V2 blueprints with template expansion**
```javascript
it('should expand V2 blueprints from template', async () => {
  const v2Blueprint = {
    schemaVersion: '2.0',
    structureTemplate: 'templates:biped'
  };

  const mockDeps = {
    socketGenerator: { generateSockets: jest.fn().mockReturnValue([]) },
    slotGenerator: { generateBlueprintSlots: jest.fn().mockReturnValue({ torso: {} }) },
    dataRegistry: { get: jest.fn().mockResolvedValue({ /* template */ }) }
  };

  const result = await service.process(v2Blueprint, mockDeps);

  expect(result._processingVersion).toBe(2);
  expect(result._generatedSlots).toBeDefined();
  expect(mockDeps.slotGenerator.generateBlueprintSlots).toHaveBeenCalled();
});
```

### Integration Tests

1. **Test: V1 blueprint flows through consolidated pipeline**
2. **Test: V2 blueprint flows through consolidated pipeline**
3. **Test: blueprintLoader correctly delegates to service**

---

## Acceptance Criteria

- [ ] All version detection logic consolidated in `BlueprintProcessorService`
- [ ] `blueprintLoader` delegates to service (no inline V2 processing)
- [ ] Processing markers (`_processingVersion`, `_wasProcessed`) added
- [ ] Socket merging logic centralized
- [ ] Clear documentation of V1 vs V2 processing pipeline
- [ ] Dependency injection properly configured
- [ ] Unit tests cover all version detection scenarios
- [ ] Integration tests verify end-to-end behavior
- [ ] All existing tests pass
- [ ] No regression in blueprint processing

---

## Dependencies

- None (architectural refactor, can be done independently)

---

## Notes

- This is a larger refactoring effort that reduces technical debt
- Should be done carefully to avoid breaking existing blueprints
- Consider feature flag for gradual rollout if concerned about regression
- May want to add V1 → V2 migration utility in future (out of scope for this ticket)
- Coordinate with any other ongoing anatomy system work
