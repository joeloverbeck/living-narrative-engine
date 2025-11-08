# TESDATREG-003: Auto-Load Dependency Conditions from Scope Files

**Priority**: Medium
**Category**: Testing Infrastructure
**Timeline**: Mid-term (Next Sprint)
**Effort**: Medium (2-3 days)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## Overview

Enhance `ModTestFixture` to automatically detect and load dependency conditions referenced in custom scope files. When a test loads a custom scope, the system should parse the scope definition, identify all `condition_ref` usage, and automatically load those conditions without requiring developers to manually specify them.

### Important Implementation Notes

**Scope File Format**: Scope files use a custom DSL syntax (e.g., `modId:scopeName := expression`), not JSON. The `parseScopeDefinitions(content, filePath)` function from `src/scopeDsl/scopeDefinitionParser.js` returns a `Map<scopeName, { expr: string, ast: object }>` where:
- `expr`: The raw DSL expression string
- `ast`: The parsed Abstract Syntax Tree (AST) object

**AST Structure**: The AST nodes have a `type` property (e.g., `Filter`, `FieldAccess`, `ArrayIteration`) and may contain `logic` or `filter` properties where `condition_ref` entries appear in JSON Logic format.

**Example Scope File**:
```
sex-anal-penetration:actors_with_exposed_asshole := actor.components.positioning:closeness.partners[][{
  "and": [
    {"condition_ref": "positioning:actor-in-entity-facing-away"},
    {"hasPartOfType": [".", "asshole"]}
  ]
}]
```

**Example Parsed Result**:
```javascript
Map {
  'sex-anal-penetration:actors_with_exposed_asshole' => {
    expr: 'actor.components.positioning:closeness.partners[][{...}]',
    ast: {
      type: 'ArrayIteration',
      filter: {
        and: [
          { condition_ref: 'positioning:actor-in-entity-facing-away' },
          { hasPartOfType: ['.', 'asshole'] }
        ]
      }
    }
  }
}
```

## Problem Statement

Even with the `loadDependencyConditions()` method from TESDATREG-002, developers still need to:

1. Open the scope file
2. Manually identify all `condition_ref` entries
3. Extract the condition IDs
4. Pass them to `loadDependencyConditions()`

This is error-prone and creates maintenance burden. When a scope file is updated to reference new conditions, all related tests must be updated. This violates DRY principles and makes refactoring difficult.

### Current State (with TESDATREG-002)

```javascript
// Developer must manually identify dependencies
await testFixture.loadDependencyConditions([
  'positioning:actor-in-entity-facing-away',  // Found by reading scope file
  'positioning:entity-not-in-facing-away'     // Found by reading scope file
]);

// Then register the scope
const scopeDef = await parseScopeDefinitions(scopePath);
ScopeResolverHelpers._registerResolvers(/* ... */);
```

### Desired State (with this ticket)

```javascript
// System automatically discovers and loads conditions
await testFixture.registerCustomScope(
  'sex-anal-penetration',
  'actors_with_exposed_asshole_accessible_from_behind'
);
// Dependencies automatically loaded behind the scenes
```

## Success Criteria

- [ ] System can parse scope files to extract `condition_ref` references
- [ ] System recursively discovers transitive condition dependencies
- [ ] System loads all discovered conditions automatically
- [ ] System caches parsed scope files to avoid redundant parsing
- [ ] System provides clear error when referenced condition doesn't exist
- [ ] System handles circular condition references gracefully
- [ ] Performance: Parsing 10 scopes with 5 conditions each takes < 200ms
- [ ] Unit tests verify parsing logic with edge cases (95%+ coverage)
- [ ] Integration tests use real mod scope files
- [ ] Documentation updated with automatic loading behavior

## Proposed API

### Enhanced Method for Custom Scope Registration

Extend the custom scope registration method (from TESDATREG-004) to include automatic condition loading:

```javascript
/**
 * Registers a custom scope from the specified mod and automatically loads
 * all dependency conditions referenced in the scope definition.
 *
 * @param {string} modId - The mod containing the scope
 * @param {string} scopeName - The scope name (without .scope extension)
 * @param {object} options - Optional configuration
 * @param {boolean} options.loadConditions - Whether to auto-load conditions (default: true)
 * @param {number} options.maxDepth - Max recursion depth for transitive deps (default: 5)
 * @returns {Promise<void>}
 *
 * @example
 * // Auto-loads positioning:actor-in-entity-facing-away and other deps
 * await testFixture.registerCustomScope(
 *   'sex-anal-penetration',
 *   'actors_with_exposed_asshole_accessible_from_behind'
 * );
 *
 * @example
 * // Disable auto-loading if needed
 * await testFixture.registerCustomScope(
 *   'my-mod',
 *   'my-scope',
 *   { loadConditions: false }
 * );
 */
async registerCustomScope(modId, scopeName, options = {})
```

### Internal Helper for Condition Discovery

Create a new utility class for scope analysis:

```javascript
/**
 * Analyzes scope definitions to discover condition dependencies.
 */
class ScopeConditionAnalyzer {
  /**
   * Extracts all condition_ref references from a scope definition.
   *
   * @param {object} scopeDef - Parsed scope definition
   * @returns {Set<string>} Set of condition IDs (e.g., "positioning:actor-facing")
   */
  static extractConditionRefs(scopeDef)

  /**
   * Recursively discovers all transitive condition dependencies.
   *
   * @param {string[]} conditionIds - Initial condition IDs
   * @param {object} dataLoader - Function to load condition definitions
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {Promise<Set<string>>} All condition IDs including transitive deps
   */
  static async discoverTransitiveDependencies(conditionIds, dataLoader, maxDepth)

  /**
   * Validates that all referenced conditions exist.
   *
   * @param {Set<string>} conditionIds - Condition IDs to validate
   * @param {string} scopePath - Path to scope file (for error messages)
   * @returns {Promise<{valid: string[], missing: string[]}>}
   */
  static async validateConditions(conditionIds, scopePath)
}
```

## Implementation Details

### Files to Create/Modify

1. **Create**: `tests/common/engine/scopeConditionAnalyzer.js`
   - New utility class for scope analysis
   - Pure functions for condition extraction

2. **Modify**: `tests/common/mods/ModTestFixture.js`
   - Add `registerCustomScope()` method (or enhance from TESDATREG-004)
   - Integrate automatic condition loading

3. **Create**: `tests/unit/common/engine/scopeConditionAnalyzer.test.js`
   - Unit tests for extraction logic
   - Edge case coverage

4. **Create**: `tests/integration/common/ModTestFixture.autoLoadConditions.integration.test.js`
   - Integration tests with real scope files

### Implementation Approach

#### Step 1: Implement ScopeConditionAnalyzer

```javascript
// tests/common/engine/scopeConditionAnalyzer.js

/**
 * Utility for analyzing scope definitions and extracting condition dependencies.
 */
class ScopeConditionAnalyzer {
  /**
   * Extracts all condition_ref references from a scope definition.
   *
   * @param {object} scopeAst - Parsed scope AST from parseScopeDefinitions (has .ast property)
   * @returns {Set<string>} Set of condition IDs referenced in the scope
   */
  static extractConditionRefs(scopeAst) {
    const conditionRefs = new Set();

    // Recursive function to walk the AST
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;

      // Check if this node is a condition_ref in the logic/filter
      if (node.condition_ref) {
        conditionRefs.add(node.condition_ref);
        return;
      }

      // Recursively walk all properties
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          value.forEach(walk);
        } else if (typeof value === 'object') {
          walk(value);
        }
      }
    };

    // Start walking from the AST structure
    // The scopeAst has { expr: string, ast: object } from parseScopeDefinitions
    if (scopeAst.ast) {
      walk(scopeAst.ast);
    } else if (scopeAst.logic || scopeAst.filter) {
      // Also handle if passed logic/filter directly
      walk(scopeAst.logic || scopeAst.filter);
    } else {
      // If passed raw AST node
      walk(scopeAst);
    }

    return conditionRefs;
  }

  /**
   * Recursively discovers all transitive condition dependencies.
   */
  static async discoverTransitiveDependencies(conditionIds, dataLoader, maxDepth = 5) {
    const discovered = new Set(conditionIds);
    const toProcess = [...conditionIds];
    let depth = 0;

    while (toProcess.length > 0 && depth < maxDepth) {
      const currentId = toProcess.shift();

      try {
        // Load the condition definition
        const conditionDef = await dataLoader(currentId);

        // Extract nested condition_refs from this condition
        const nested = this.extractConditionRefs(conditionDef);

        // Add new discoveries to processing queue
        for (const nestedId of nested) {
          if (!discovered.has(nestedId)) {
            discovered.add(nestedId);
            toProcess.push(nestedId);
          }
        }
      } catch (err) {
        // Condition doesn't exist or can't be loaded
        // Will be caught by validation later
        continue;
      }

      depth++;
    }

    if (depth >= maxDepth) {
      console.warn(
        `Reached max recursion depth (${maxDepth}) while discovering condition dependencies. ` +
        `This may indicate circular references.`
      );
    }

    return discovered;
  }

  /**
   * Validates that all referenced conditions exist.
   */
  static async validateConditions(conditionIds, scopePath) {
    const results = { valid: [], missing: [] };

    for (const id of conditionIds) {
      const [modId, conditionName] = id.split(':');
      const conditionPath = `../../../../data/mods/${modId}/conditions/${conditionName}.condition.json`;

      try {
        await import(conditionPath, { assert: { type: 'json' } });
        results.valid.push(id);
      } catch (err) {
        results.missing.push(id);
      }
    }

    return results;
  }

  /**
   * Loads a condition definition from file system.
   */
  static async loadConditionDefinition(conditionId) {
    const [modId, conditionName] = conditionId.split(':');
    const conditionPath = `../../../../data/mods/${modId}/conditions/${conditionName}.condition.json`;

    const module = await import(conditionPath, { assert: { type: 'json' } });
    return module.default;
  }
}

export default ScopeConditionAnalyzer;
```

#### Step 2: Integrate into ModTestFixture

```javascript
// In ModTestFixture.js

import ScopeConditionAnalyzer from '../engine/scopeConditionAnalyzer.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import fs from 'fs';
import path from 'path';

class ModTestFixture {
  /**
   * Registers a custom scope and auto-loads dependency conditions.
   */
  async registerCustomScope(modId, scopeName, options = {}) {
    const {
      loadConditions = true,
      maxDepth = 5
    } = options;

    // Construct scope file path
    const scopePath = path.join(
      __dirname,
      `../../../data/mods/${modId}/scopes/${scopeName}.scope`
    );

    // Read and parse scope definition
    const scopeContent = fs.readFileSync(scopePath, 'utf-8');
    const parsedScopes = parseScopeDefinitions(scopeContent, scopePath);

    // parseScopeDefinitions returns a Map<scopeName, { expr, ast }>
    const fullScopeName = `${modId}:${scopeName}`;
    const scopeData = parsedScopes.get(fullScopeName);

    if (!scopeData) {
      throw new Error(
        `Scope "${fullScopeName}" not found in file ${scopePath}. ` +
        `Available scopes: ${Array.from(parsedScopes.keys()).join(', ')}`
      );
    }

    if (loadConditions) {
      // Extract condition references from the parsed AST
      const conditionRefs = ScopeConditionAnalyzer.extractConditionRefs(scopeData);

      if (conditionRefs.size > 0) {
        // Discover transitive dependencies
        const allConditions = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
          Array.from(conditionRefs),
          ScopeConditionAnalyzer.loadConditionDefinition.bind(ScopeConditionAnalyzer),
          maxDepth
        );

        // Validate conditions exist
        const validation = await ScopeConditionAnalyzer.validateConditions(
          allConditions,
          scopePath
        );

        if (validation.missing.length > 0) {
          throw new Error(
            `Scope "${fullScopeName}" references missing conditions:\n` +
            validation.missing.map(id => `  - ${id}`).join('\n') +
            `\n\nReferenced in: ${scopePath}`
          );
        }

        // Load all discovered conditions
        await this.loadDependencyConditions(Array.from(allConditions));
      }
    }

    // Register the scope resolver
    // Create resolver using ScopeEngine to evaluate the AST
    const scopeEngine = new (require('../../../src/scopeDsl/engine.js').default)();
    const resolver = (context) => {
      // Build runtime context
      const runtimeCtx = {
        entityManager: this.testEnv.entityManager,
        jsonLogicEval: this.testEnv.jsonLogic,
        logger: this.testEnv.logger,
      };

      // Resolve using the AST
      const result = scopeEngine.resolve(scopeData.ast, context, runtimeCtx);

      return { success: true, value: result };
    };

    ScopeResolverHelpers._registerResolvers(
      this.testEnv,
      this.testEnv.entityManager,
      { [fullScopeName]: resolver }
    );
  }
}
```

## Testing Requirements

### Unit Tests

Create `tests/unit/common/engine/scopeConditionAnalyzer.test.js`:

```javascript
describe('ScopeConditionAnalyzer', () => {
  describe('extractConditionRefs', () => {
    it('should extract single condition_ref from AST', () => {
      // Simulating parsed AST structure from parseScopeDefinitions
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            condition_ref: 'positioning:actor-facing'
          }
        }
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set(['positioning:actor-facing']));
    });

    it('should extract multiple condition_refs from AST', () => {
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            and: [
              { condition_ref: 'positioning:actor-facing' },
              { condition_ref: 'anatomy:has-exposed-part' }
            ]
          }
        }
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set([
        'positioning:actor-facing',
        'anatomy:has-exposed-part'
      ]));
    });

    it('should extract nested condition_refs from AST', () => {
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            or: [
              {
                and: [
                  { condition_ref: 'positioning:actor-facing' },
                  { condition_ref: 'anatomy:has-part' }
                ]
              },
              { condition_ref: 'positioning:close-actors' }
            ]
          }
        }
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set([
        'positioning:actor-facing',
        'anatomy:has-part',
        'positioning:close-actors'
      ]));
    });

    it('should handle scope AST with no condition_refs', () => {
      const scopeAst = {
        ast: {
          type: 'FieldAccess',
          path: 'actor.items[]'
        }
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set());
    });

    it('should deduplicate duplicate condition_refs', () => {
      const scopeAst = {
        ast: {
          type: 'Filter',
          logic: {
            and: [
              { condition_ref: 'positioning:actor-facing' },
              { condition_ref: 'positioning:actor-facing' }
            ]
          }
        }
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toEqual(new Set(['positioning:actor-facing']));
    });

    it('should handle complex real-world scope AST', () => {
      // Actual AST structure from sex-anal-penetration mod after parsing
      const scopeAst = {
        expr: 'actor.components.positioning:closeness.partners[][{...}]',
        ast: {
          type: 'ArrayIteration',
          parent: {
            type: 'FieldAccess',
            path: 'actor.components.positioning:closeness.partners'
          },
          filter: {
            and: [
              {
                or: [
                  { condition_ref: 'positioning:actor-in-entity-facing-away' },
                  { '!!': { var: 'entity.components.positioning:lying_down' } }
                ]
              },
              {
                and: [
                  { hasPartOfType: ['.', 'asshole'] },
                  { not: { isSocketCovered: ['.', 'asshole'] } }
                ]
              }
            ]
          }
        }
      };

      const refs = ScopeConditionAnalyzer.extractConditionRefs(scopeAst);

      expect(refs).toContain('positioning:actor-in-entity-facing-away');
    });
  });

  describe('discoverTransitiveDependencies', () => {
    it('should discover single-level dependencies', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:condition-a') {
          return { condition_ref: 'mod:condition-b' };
        }
        return {};
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:condition-a'],
        mockLoader
      );

      expect(deps).toEqual(new Set(['mod:condition-a', 'mod:condition-b']));
    });

    it('should discover multi-level dependencies', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:a') return { condition_ref: 'mod:b' };
        if (id === 'mod:b') return { condition_ref: 'mod:c' };
        return {};
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:a'],
        mockLoader
      );

      expect(deps).toEqual(new Set(['mod:a', 'mod:b', 'mod:c']));
    });

    it('should handle circular dependencies', async () => {
      const mockLoader = jest.fn(async (id) => {
        if (id === 'mod:a') return { condition_ref: 'mod:b' };
        if (id === 'mod:b') return { condition_ref: 'mod:a' };
        return {};
      });

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:a'],
        mockLoader,
        5
      );

      expect(deps).toEqual(new Set(['mod:a', 'mod:b']));
    });

    it('should respect maxDepth limit', async () => {
      const mockLoader = jest.fn(async (id) => ({
        condition_ref: `${id}-child`
      }));

      const deps = await ScopeConditionAnalyzer.discoverTransitiveDependencies(
        ['mod:root'],
        mockLoader,
        2
      );

      // Should stop at depth 2
      expect(mockLoader).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateConditions', () => {
    it('should identify valid and missing conditions', async () => {
      const validation = await ScopeConditionAnalyzer.validateConditions(
        new Set([
          'positioning:actor-in-entity-facing-away',  // exists
          'positioning:nonexistent-condition'          // doesn't exist
        ]),
        'test/scope/path.scope'
      );

      expect(validation.valid).toContain('positioning:actor-in-entity-facing-away');
      expect(validation.missing).toContain('positioning:nonexistent-condition');
    });
  });
});
```

### Integration Tests

Create `tests/integration/common/ModTestFixture.autoLoadConditions.integration.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('ModTestFixture - Auto-Load Conditions Integration', () => {
  let testFixture;

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should auto-load conditions when registering custom scope', async () => {
    testFixture = await ModTestFixture.forAction(
      'sex-anal-penetration',
      'sex-anal-penetration:insert_finger_into_asshole'
    );

    // This should automatically load positioning:actor-in-entity-facing-away
    // which is referenced in the scope's condition_ref
    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );

    // Verify condition was loaded by checking the mock was extended
    const condition = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );

    expect(condition).toBeDefined();
    expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
    expect(condition.logic).toBeDefined();
  });

  it('should throw clear error when referenced condition missing', async () => {
    testFixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');

    // Create a temporary scope file that references a non-existent condition
    // NOTE: In real implementation, this test would need proper test setup
    // with a mock scope file containing invalid condition_ref

    await expect(
      testFixture.registerCustomScope('positioning', 'nonexistent-scope')
    ).rejects.toThrow(/not found in file|references missing conditions/);
  });

  it('should allow disabling auto-load', async () => {
    testFixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');

    // With loadConditions: false, should not attempt to load dependency conditions
    // This test would need proper scope file setup to fully validate
    await expect(
      testFixture.registerCustomScope(
        'sex-anal-penetration',
        'actors_with_exposed_asshole_accessible_from_behind',
        { loadConditions: false }
      )
    ).resolves.not.toThrow();
  });

  it('should handle scope with multiple condition_refs', async () => {
    testFixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');

    // Register scope that references multiple conditions
    await testFixture.registerCustomScope(
      'sex-anal-penetration',
      'actors_with_exposed_asshole_accessible_from_behind'
    );

    // Verify all conditions were loaded
    const condition1 = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );

    expect(condition1).toBeDefined();
    // Additional conditions would be tested here if the scope references more
  });
});
```

**Note on Condition File Structure**: Condition files are JSON with the following structure:
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:actor-in-entity-facing-away",
  "description": "Checks if actor is in entity's facing_away_from array",
  "logic": {
    "in": [
      { "var": "actor.id" },
      { "var": "entity.components.positioning:facing_away.facing_away_from" }
    ]
  }
}
```

The `logic` property contains JSON Logic that may itself contain nested `condition_ref` entries, creating transitive dependencies.

## Performance Considerations

### Caching Strategy

Implement caching to avoid redundant file reads:

```javascript
class ScopeConditionAnalyzer {
  static #conditionCache = new Map();

  static async loadConditionDefinition(conditionId) {
    if (this.#conditionCache.has(conditionId)) {
      return this.#conditionCache.get(conditionId);
    }

    const [modId, conditionName] = conditionId.split(':');
    const conditionPath = `../../../../data/mods/${modId}/conditions/${conditionName}.condition.json`;

    const module = await import(conditionPath, { assert: { type: 'json' } });
    const definition = module.default;

    this.#conditionCache.set(conditionId, definition);
    return definition;
  }

  static clearCache() {
    this.#conditionCache.clear();
  }
}
```

### Performance Targets

- Extracting conditions from a scope with 10 nested refs: < 10ms
- Loading 5 conditions with 2 levels of transitive deps: < 100ms
- Total overhead for typical scope registration: < 150ms

## Edge Cases to Handle

1. **Circular condition references**: Use depth limit and Set for tracking
2. **Missing condition files**: Clear error with file path
3. **Malformed scope definitions**: Graceful handling with informative errors
4. **Empty scopes**: No conditions to load
5. **Deeply nested conditions**: Respect maxDepth parameter
6. **Concurrent scope registrations**: Ensure cache is thread-safe

## Refactoring Impact

After implementing this ticket, update existing tests:

1. `tests/integration/mods/sex-anal-penetration/insert_finger_into_asshole_action_discovery.test.js`
2. `tests/integration/mods/sex-anal-penetration/insert_multiple_fingers_into_asshole_action_discovery.test.js`

Before:
```javascript
// Manual condition loading
await testFixture.loadDependencyConditions([
  'positioning:actor-in-entity-facing-away'
]);

// Manual scope registration
const scopeDef = await parseScopeDefinitions(scopePath);
ScopeResolverHelpers._registerResolvers(/* ... */);
```

After:
```javascript
// Everything automatic
await testFixture.registerCustomScope(
  'sex-anal-penetration',
  'actors_with_exposed_asshole_accessible_from_behind'
);
```

## Documentation Updates

Update `docs/testing/mod-testing-guide.md`:

1. Document automatic condition loading behavior
2. Show how to disable it when needed
3. Explain maxDepth parameter for circular reference protection
4. Add troubleshooting for missing conditions
5. Update examples to use `registerCustomScope()`

## Acceptance Tests

- [ ] Extracts single condition_ref correctly
- [ ] Extracts multiple condition_refs correctly
- [ ] Handles deeply nested condition_refs
- [ ] Discovers transitive dependencies (2+ levels)
- [ ] Handles circular dependencies without infinite loop
- [ ] Respects maxDepth parameter
- [ ] Validates conditions and reports missing ones
- [ ] Provides clear error messages for missing conditions
- [ ] Loads all discovered conditions via loadDependencyConditions()
- [ ] Caches condition definitions to avoid redundant loads
- [ ] Performance meets targets (< 150ms total overhead)
- [ ] Unit tests achieve 95%+ coverage
- [ ] Integration tests work with real mod data
- [ ] Existing tests successfully refactored
- [ ] Documentation is comprehensive and accurate

## Dependencies

- **TESDATREG-002**: Must be implemented first (provides `loadDependencyConditions()`)
- **TESDATREG-004**: May be implemented concurrently (provides `registerCustomScope()` shell)

## Blockers

None (can proceed after TESDATREG-002)

## Related Tickets

- **TESDATREG-002**: Provides the underlying condition loading mechanism
- **TESDATREG-004**: Provides the custom scope registration method to enhance
- **TESDATREG-006**: Long-term solution with full dependency graph

## Implementation Checklist

- [ ] Create `ScopeConditionAnalyzer` class
- [ ] Implement `extractConditionRefs()` method
- [ ] Implement `discoverTransitiveDependencies()` method
- [ ] Implement `validateConditions()` method
- [ ] Implement `loadConditionDefinition()` with caching
- [ ] Add caching with `clearCache()` method
- [ ] Integrate into `registerCustomScope()` method
- [ ] Create unit test file with 20+ test cases
- [ ] Create integration test file with real scope files
- [ ] Test circular dependency handling
- [ ] Test performance with large dependency trees
- [ ] Achieve 95%+ code coverage
- [ ] Refactor 2 existing test files
- [ ] Update documentation
- [ ] Add JSDoc comments to all methods
- [ ] Run full test suite
- [ ] Run `npm run typecheck`
- [ ] Run `npx eslint` on modified files
