# EXPSYSBRA-001: Expression Registry Service

## Summary

Create the `ExpressionRegistry` service that provides efficient storage and retrieval of loaded expression definitions from the data registry.

## Background

The Expression System needs a registry service to:
1. Retrieve all loaded expressions from the data registry
2. Provide indexed access for efficient evaluation
3. Support tag-based filtering for performance optimization

## File List (Expected to Touch)

### New Files
- `src/expressions/expressionRegistry.js` - Main registry service implementation

### Files to Read (NOT modify)
- `src/loaders/expressionLoader.js` - Reference for how expressions are loaded
- `src/anatomy/services/statusEffectRegistry.js` - Reference pattern for registry implementations (BaseService + lazy cache)
- `src/dependencyInjection/tokens/tokens-core.js` - No `IExpressionRegistry` token currently exists; DI registration is out of scope

## Out of Scope (MUST NOT Change)

- `src/loaders/expressionLoader.js` - Loader already complete
- `src/loaders/loaderMeta.js` - Already configured
- `data/schemas/expression.schema.json` - Schema already complete
- `scripts/updateManifest.js` - Already handles expressions
- Any existing registry implementations (do not modify patterns)
- DI registration (separate ticket EXPSYSBRA-006)

## Implementation Details

### Class: `ExpressionRegistry`

```javascript
/**
 * @file Expression Registry - Storage and retrieval for expression definitions
 */

class ExpressionRegistry {
  #dataRegistry;
  #logger;
  #expressionCache;      // Map<string, Expression>
  #tagIndex;             // Map<string, Set<string>> - tag -> expressionIds

  constructor({ dataRegistry, logger }) {
    // Validate dependencies
    // Initialize caches
  }

  /**
   * Get all loaded expressions
   * @returns {Expression[]}
   */
  getAllExpressions() { }

  /**
   * Get expression by ID
   * @param {string} expressionId - Format: modId:expressionId
   * @returns {Expression|null}
   */
  getExpression(expressionId) { }

  /**
   * Get expressions by tag for pre-filtering
   * @param {string} tag - Tag to filter by
   * @returns {Expression[]}
   */
  getExpressionsByTag(tag) { }

  /**
   * Get expressions sorted by priority (descending)
   * @returns {Expression[]}
   */
  getExpressionsByPriority() { }

  /**
   * Build/rebuild tag index for efficient filtering
   */
  #buildTagIndex() { }
}
```

### Dependencies

- `IDataRegistry` - Access loaded expression data
- `ILogger` - Logging

### Registry Data Access Pattern

```javascript
// Expressions are loaded by ExpressionLoader into data registry
const expressions = this.#dataRegistry.getAll('expressions');
// Returns ExpressionDefinition[] (array)
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Test: `tests/unit/expressions/expressionRegistry.test.js`**
   - `should retrieve all expressions from data registry`
   - `should return null for non-existent expression ID`
   - `should return expression by valid ID`
   - `should return expressions filtered by tag`
   - `should return expressions sorted by priority descending`
   - `should handle empty registry gracefully`
   - `should build tag index correctly`
   - `should validate dependencies in constructor`

### Invariants That Must Remain True

1. **No modifications to data registry** - Read-only access
2. **Thread-safe caching** - Cache populated lazily on first access
3. **Consistent priority ordering** - Same expressions always in same order
4. **Null-safe returns** - Never throw on missing data
5. **Dependency validation** - Constructor validates all required dependencies

## Estimated Size

- ~100-150 lines of code
- Single file addition
- No external dependencies beyond existing core services

## Dependencies

- None (first ticket in chain)

## Notes

- Follow existing registry patterns in `src/anatomy/services/statusEffectRegistry.js` (BaseService + lazy cache)
- Dependency validation should align with BaseService/`initializeServiceLogger` behavior
- Cache expressions on first access, not in constructor
- Tag index enables performance optimization in evaluator

## Status

Completed.

## Outcome

Implemented `ExpressionRegistry` with BaseService-style dependency validation, lazy caching, tag indexing, and deterministic priority sorting; added unit coverage for registry access patterns and constructor validation. The original plan referenced a non-existent registry folder and a Map-returning data registry; implementation uses the existing `statusEffectRegistry` pattern and array-based data registry access instead.
