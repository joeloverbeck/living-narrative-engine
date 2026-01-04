# ACTDISDIAFAIFAS-002 – Enhanced ScopeResolutionError Context

## Problem

`ScopeResolutionError` currently accepts context properties via its constructor and stores them in `this.context.*`, but lacks dedicated getter properties for diagnostic-specific fields like `modSource`, `parentContext`, `suggestions`, `resolutionChain`, and `conditionId`. This makes it harder for downstream code (filterResolver, validators) to access these properties ergonomically.

## Proposed Scope

Add convenience getter properties to `ScopeResolutionError` that delegate to the underlying context object. The class already extends `BaseError` which provides `toJSON()` serialization - no changes needed there.

## Assumptions Verified

1. ✅ `ScopeResolutionError` extends `BaseError` (confirmed: line 17)
2. ✅ `BaseError.toJSON()` already serializes all context properties (confirmed: line 154-166)
3. ✅ Context is stored via constructor's second parameter (confirmed: line 33)
4. ✅ Existing callers use `new ScopeResolutionError(message)` - this remains compatible

## File List

- `src/scopeDsl/errors/scopeResolutionError.js`
- `tests/unit/scopeDsl/errors/scopeResolutionError.test.js` (NEW or extend existing)

## Out of Scope

- Populating these fields (handled in ACTDISDIAFAIFAS-002b, 003, 004)
- Changing filterResolver behavior
- Modifying condition resolution logic
- Adding new error types
- Changing error message format for existing callers

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/scopeDsl/errors/scopeResolutionError.test.js`

Required test cases:
- **Constructor accepts new optional context properties**: `new ScopeResolutionError(msg, { modSource: 'positioning' })`
- **`modSource` property accessible**: Returns the mod that referenced the problematic element
- **`suggestions` array property accessible**: Returns array of similar IDs
- **`resolutionChain` array property accessible**: Returns path like `['scope:filter', 'condition_ref:core:missing']`
- **`parentContext` property accessible**: Returns scope/action ID that triggered resolution
- **`conditionId` property accessible**: Returns the specific condition that failed
- **Backward compatible with existing callers**: `new ScopeResolutionError('message')` still works
- **Serialization to JSON includes new properties**: `JSON.stringify(error)` includes all context
- **Properties are optional**: Missing properties return `undefined`, not errors

### Invariants

- Existing constructor signature `new ScopeResolutionError(message)` still works
- Error message format unchanged for existing callers
- All new properties are optional (undefined if not provided)
- Error still extends appropriate base class
- Stack trace preserved correctly

### API Contract

```javascript
class ScopeResolutionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {Object} [context]
   * @param {string} [context.conditionId] - The condition that failed
   * @param {string} [context.modSource] - Mod that referenced the condition
   * @param {string} [context.parentContext] - Scope/action that triggered resolution
   * @param {string[]} [context.suggestions] - Similar condition IDs
   * @param {string[]} [context.resolutionChain] - Path of resolution attempts
   */
  constructor(message, context = {}) {}

  get conditionId() {}
  get modSource() {}
  get parentContext() {}
  get suggestions() {}
  get resolutionChain() {}

  // toJSON() inherited from BaseError - already serializes all context
}
```

## Implementation Notes

The getters simply delegate to `this.context.*` and return `undefined` if the property was not provided - no special logic needed.

---

## ✅ Status: COMPLETED

**Completed:** 2026-01-04

### Changes Made

1. **`src/scopeDsl/errors/scopeResolutionError.js`**
   - Added 5 getter properties: `conditionId`, `modSource`, `parentContext`, `suggestions`, `resolutionChain`
   - Each getter delegates to `this.context.*` (lines 69-114)
   - No changes to constructor or toJSON (already handled by BaseError)

2. **`tests/unit/scopeDsl/errors/scopeResolutionError.test.js`**
   - Added 17 new test cases in "Diagnostic context getters (ACTDISDIAFAIFAS-002)" section
   - Tests cover: each getter with/without values, constructor accepting all properties, backward compatibility, JSON serialization, optional property access

### Tests Added
- `conditionId getter` (2 tests)
- `modSource getter` (2 tests)
- `parentContext getter` (2 tests)
- `suggestions getter` (3 tests)
- `resolutionChain getter` (2 tests)
- `constructor accepts all new context properties` (1 test)
- `backward compatibility` (2 tests)
- `JSON serialization includes new properties` (2 tests)
- `properties are optional and return undefined` (1 test)

### Test Results
All 59 tests pass (42 original + 17 new).

---

## Outcome

### Originally Planned vs Actually Changed

**Originally Planned:**
- Add 5 getter properties to `ScopeResolutionError`
- Potentially modify `toJSON()` for serialization
- Add comprehensive test coverage

**Actually Changed:**
- Added 5 getter properties (exactly as planned)
- **No `toJSON()` changes needed** - `BaseError` already provides complete serialization
- Added 17 new tests (exceeds minimum requirements)

### Deviations from Original Plan

1. **Ticket assumptions were accurate** - no corrections needed to the ticket itself
2. **Minimal code changes** - only 46 lines added (5 getters with JSDoc)
3. **Zero breaking changes** - all existing APIs preserved

### Verification

- All 59 unit tests pass
- ESLint passes with no new warnings
- Backward compatibility confirmed via explicit tests
