# Utility Files Consolidation Analysis Report

## Executive Summary

This report presents a comprehensive analysis of the `src/utils/` directory in the Living Narrative Engine project, identifying significant code duplication and proposing consolidation strategies. The analysis covered **91 utility files** and found substantial opportunities to reduce code duplication and improve maintainability.

### Key Findings

- **30-40% of utility code contains some form of duplication**
- **7 major categories** of duplicated functionality identified
- **Potential reduction of 20-25 files** through consolidation
- Most critical duplications are in logger validation, error dispatching, and string validation

### Impact of Consolidation

- **Reduced cognitive load** - Developers won't need to remember which of several similar utilities to use
- **Improved maintainability** - Fixes and improvements need to be made in fewer places
- **Better discoverability** - Clear, consolidated utilities are easier to find and understand
- **Consistent patterns** - Standardized approaches across the codebase

## Detailed Analysis by Category

### 1. Error Handling Utilities (8 files)

#### Current State

```
errorDetails.js          → Creates error detail objects
errorReportingUtils.js   → Reports missing actor IDs
errorTypes.js           → Type definitions
errorUtils.js           → Wrapper for StartupErrorHandler
engineErrorUtils.js     → Engine-specific errors
persistenceErrorUtils.js → Persistence-specific errors
safeDispatchErrorUtils.js → Dispatches SYSTEM_ERROR_OCCURRED
systemErrorDispatchUtils.js → Also dispatches SYSTEM_ERROR_OCCURRED
```

#### Major Duplication Found

**System Error Dispatching** (CRITICAL):

- `safeDispatchErrorUtils.js` and `systemErrorDispatchUtils.js` both dispatch the same `SYSTEM_ERROR_OCCURRED_ID` event
- Only difference is sync vs async dispatching
- Different dispatcher interfaces used (`ISafeEventDispatcher` vs `IValidatedEventDispatcher`)

#### Consolidation Recommendation

1. **Merge into `systemErrorDispatcher.js`**:

```javascript
// Unified system error dispatcher supporting both sync and async
export class SystemErrorDispatcher {
  dispatchSync(dispatcher, error, context, logger) {
    /* ... */
  }
  async dispatchAsync(dispatcher, error, context, logger) {
    /* ... */
  }
}
```

2. **Keep domain-specific files separate** (engineErrorUtils, persistenceErrorUtils, errorReportingUtils)
3. **Merge `errorUtils.js` into `startupErrorHandler.js`**

### 2. Entity-Related Utilities (8 files)

#### Current State

```
entityAssertionsUtils.js    → Assert entity validity
entityComponentUtils.js     → Build components from entity
entityFetchHelpers.js      → Fetch entities with validation
entityNameFallbackUtils.js → Resolve entity name placeholders
entityRefUtils.js          → Resolve entity references
entityUtils.js             → General entity utilities
entityValidationUtils.js   → Validate Entity objects
entitiesValidationHelpers.js → Validation result formatting
```

#### Major Duplication Found

**Entity Validation** (3 different approaches):

```javascript
// entityAssertionsUtils.js
assertValidEntity(entity); // Checks non-null + non-blank ID

// entityValidationUtils.js
isValidEntity(entity); // Checks getComponentData method

// entityUtils.js
// Uses isValidEntity() but also does ID checking
```

**Name Resolution** (2 implementations):

- `entityNameFallbackUtils.js` - Resolves name placeholders
- `entityUtils.js` - Gets display names
- Both access the same `NAME_COMPONENT_ID`

#### Consolidation Recommendation

1. **Create `entityValidation.js`**:
   - Merge all validation logic
   - Support validation levels: basic, structural, complete

2. **Create `entityNameResolver.js`**:
   - Merge name resolution from entityUtils and entityNameFallbackUtils
   - Single API for all name operations

3. **Create `entityComponentAccess.js`**:
   - Consolidate safe component access patterns
   - Include adapter pattern from entityNameFallbackUtils

### 3. Event Dispatching Utilities (6 files)

#### Current State

```
eventDispatchHelper.js  → Dispatch with error handling
eventDispatchService.js → Service class (duplicates 3 others!)
eventDispatchUtils.js   → Dispatch with logging
safeDispatchEvent.js    → Safe dispatch with null checks
eventHelpers.js         → Simple safe dispatch
dispatcherUtils.js      → Factory for dispatchers
```

#### Major Duplication Found

**EventDispatchService duplicates code from**:

- `eventDispatchHelper.js` - dispatchWithErrorHandling()
- `eventDispatchUtils.js` - dispatchWithLogging()
- `safeDispatchEvent.js` - safeDispatchEvent()

**Three "safe dispatch" implementations**:

1. `safeDispatch()` - Basic try-catch
2. `dispatchWithLogging()` - Promise-based
3. `safeDispatchEvent()` - Includes validation

#### Consolidation Recommendation

1. **Refactor EventDispatchService** to use utility functions instead of duplicating
2. **Create single `eventDispatchCore.js`** with all dispatch patterns
3. **Standardize parameter ordering** across all functions

### 4. Validation Utilities (8+ files)

#### Current State

```
argValidation.js          → Map and Logger validation
entityValidationUtils.js  → Entity interface validation
idValidation.js          → ID validation (wrapper)
operationValidationUtils.js → Operation parameter validation
schemaValidationUtils.js → Schema validation
stringValidation.js      → String validation (wrapper)
turnStateValidationUtils.js → Turn state validation
dependencyUtils.js       → Core validation functions
```

#### Major Duplication Found

**String Validation** (4+ implementations):

```javascript
// Different files, same logic
isNonBlankString(); // textUtils.js
assertNonBlankString(); // dependencyUtils.js
validateNonEmptyString(); // stringValidation.js
validateComponentType(); // operationValidationUtils.js
```

**Logger Validation** (3+ implementations):

- `assertIsLogger()` - argValidation.js
- `ensureValidLogger()` - loggerUtils.js
- Multiple files check same methods

**Method Validation** (4+ implementations):

- Various forms of checking if object has required methods

#### Consolidation Recommendation

1. **Create `validationCore.js`**:

```javascript
export const string = {
  isNonBlank(str) {
    /* single implementation */
  },
  assertNonBlank(str, name, context) {
    /* with error */
  },
};

export const type = {
  assertIsMap(value, name) {
    /* ... */
  },
  assertHasMethods(obj, methods, name) {
    /* ... */
  },
};

export const logger = {
  isValid(logger) {
    /* ... */
  },
  ensure(logger, fallback) {
    /* ... */
  },
};
```

2. **Remove thin wrappers** (idValidation.js, stringValidation.js)
3. **Standardize error handling** across all validators

### 5. Placeholder Utilities (6 files)

#### Current State

```
placeholderParsing.js     → Just re-exports (unnecessary!)
placeholderPatterns.js    → Regex patterns
placeholderPathResolver.js → Path resolution
placeholderSources.js     → Build resolution sources
placeholderResolverUtils.js → Main resolver class
executionPlaceholderResolver.js → Wrapper class
```

#### Major Duplication Found

- `placeholderParsing.js` only re-exports - can be removed
- Path resolution logic duplicated between files
- Multiple classes with overlapping responsibilities

#### Consolidation Recommendation

1. **Remove `placeholderParsing.js`** entirely
2. **Merge `ExecutionPlaceholderResolver` into `PlaceholderResolver`**
3. **Unify path resolution** logic in one place

### 6. Save/Persistence Utilities (6 files)

#### Current State

```
saveFileReadUtils.js     → Read and deserialize saves
saveMetadataUtils.js     → Validate metadata
savePathUtils.js         → Path management
saveStateUtils.js        → Clone and validate state
persistenceResultUtils.js → Result objects
persistenceErrorUtils.js → Error wrapping
```

#### Major Duplication Found

- `readSaveFile()` manually handles errors that `executePersistenceOp()` could handle
- Similar result creation patterns across files

#### Consolidation Recommendation

1. **Refactor to use `executePersistenceOp()`** consistently
2. **Merge save operations** into `saveOperationsUtils.js`
3. **Merge persistence utilities** into single `persistenceUtils.js`

### 7. Other Common Patterns

#### Logger Utilities Duplication

- Multiple ways to create prefixed loggers
- `getModuleLogger()`, `getPrefixedLogger()`, `setupPrefixedLogger()`

#### Safe Function Wrappers

- Pattern repeated in multiple files:

```javascript
try {
  return { value: result, error: null };
} catch (error) {
  logger.error(...);
  return { value: null, error };
}
```

## Proposed New First-Class Abstractions

Based on the analysis, several new abstractions emerge:

### 1. **ValidationService**

A comprehensive validation service that unifies all validation logic:

```javascript
class ValidationService {
  validateString(value, options) {
    /* ... */
  }
  validateEntity(entity, level = 'basic') {
    /* ... */
  }
  validateLogger(logger) {
    /* ... */
  }
  validateDependencies(deps, requirements) {
    /* ... */
  }
}
```

### 2. **ErrorDispatcher**

A unified error handling and dispatching service:

```javascript
class ErrorDispatcher {
  dispatchSystemError(error, context, options) {
    /* ... */
  }
  handleOperationError(operation, error) {
    /* ... */
  }
  formatError(error, context) {
    /* ... */
  }
}
```

### 3. **SafeExecutor**

A generic safe execution wrapper:

```javascript
class SafeExecutor {
  execute(operation, errorHandler, logger) {
    /* ... */
  }
  executeAsync(operation, errorHandler, logger) {
    /* ... */
  }
}
```

## Implementation Priority

### High Priority (Immediate Impact)

1. **Merge system error dispatchers** - Eliminates most confusing duplication
2. **Consolidate string validation** - Used everywhere, high impact
3. **Fix EventDispatchService** - Stop duplicating code from other files
4. **Remove thin wrapper files** - Quick wins (placeholderParsing.js, etc.)

### Medium Priority (Significant Improvement)

1. **Unify entity validation** - Important for consistency
2. **Create ValidationService** - Long-term maintainability
3. **Consolidate logger utilities** - Reduce confusion
4. **Merge persistence utilities** - Cleaner architecture

### Low Priority (Nice to Have)

1. **Standardize parameter ordering** - Consistency improvement
2. **Extract safe wrapper pattern** - Code reuse
3. **Consolidate name resolution** - Minor duplication

## Expected Outcomes

### Quantitative Improvements

- **File count reduction**: From 91 to ~65-70 files (-25%)
- **Code line reduction**: Estimated 15-20% fewer lines
- **Test reduction**: Fewer utilities = fewer tests to maintain

### Qualitative Improvements

- **Clearer intent**: One obvious place for each type of utility
- **Easier onboarding**: New developers find utilities faster
- **Reduced bugs**: Single implementation = single place to fix
- **Better patterns**: Consistent approaches across codebase

## Migration Strategy

1. **Phase 1**: Create new consolidated utilities alongside existing ones
2. **Phase 2**: Update all usages to new utilities
3. **Phase 3**: Deprecate old utilities with clear migration messages
4. **Phase 4**: Remove deprecated utilities after grace period

## Conclusion

The `src/utils/` directory contains significant duplication that impacts maintainability and developer experience. The proposed consolidation would:

- Reduce the number of utility files by 25%
- Eliminate confusing duplicate implementations
- Create clearer, more discoverable abstractions
- Improve long-term maintainability

The highest priority items (system error dispatching, string validation, EventDispatchService) should be addressed first as they have the most widespread impact and confusion potential.

---

_Report generated: [Date of Analysis]_
_Total files analyzed: 91_
_Estimated implementation effort: 2-3 weeks for full consolidation_
