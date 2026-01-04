# ACTDISDIAFAIFAS-002b – FilterResolver Suggestion Integration

**Status: COMPLETED**

## Problem

FilterResolver and condition resolution logic don't populate `suggestions`, `modSource`, or `resolutionChain` when `condition_ref` fails. Users see bare error messages without actionable guidance.

## Proposed Scope

Integrate the suggestion service (001) and enhanced error context (002) into the condition_ref error handling path. When a condition_ref fails to resolve:
1. Call suggestion service to get similar condition names
2. Populate enhanced ScopeResolutionError with suggestions
3. Maintain fail-fast behavior with richer context

### Architecture Clarification (Reassessed)

**Original assumption**: The ticket assumed integration should happen directly in `filterResolver.js`.

**Actual code flow**:
1. `filterResolver.js` receives `logicEval` (JsonLogicEvaluationService) as a dependency
2. When evaluating filters, it calls `logicEval.evaluate(node.logic, evalCtx)`
3. `JsonLogicEvaluationService.#resolveRule()` calls `resolveConditionRefs()` from `conditionRefResolver.js`
4. `conditionRefResolver.js` throws errors when conditions are not found
5. `JsonLogicEvaluationService.#resolveRule()` catches these and wraps them in `ScopeResolutionError` (lines 330-338)
6. `filterResolver.js` catches these errors (lines 294-324) and re-wraps them

**Corrected scope**: The integration happens in `JsonLogicEvaluationService.#resolveRule()` where:
- We have access to `gameDataRepository` (which provides condition definitions for suggestions)
- The error is first created with appropriate context
- The suggestions can be added at the source

## File List

- `src/logic/jsonLogicEvaluationService.js` - Primary: Add suggestion service integration
- `src/scopeDsl/nodes/filterResolver.js` - Secondary: Preserve suggestions in re-wrapped error
- `tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js` - Update tests
- `tests/unit/logic/jsonLogicEvaluationService.test.js` - Add suggestion tests

## Out of Scope

- Creating the suggestion service (completed in ACTDISDIAFAIFAS-001)
- Modifying ScopeResolutionError class (completed in ACTDISDIAFAIFAS-002)
- Action discovery pipeline changes
- Target component validation errors
- Modifying existing passing tests

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js tests/unit/logic/jsonLogicEvaluationService.test.js`

Required test cases:
- **Missing condition_ref throws with `suggestions` populated**: Error includes top 3 similar conditions
- **Error message includes suggestions in human-readable format**: `"Condition 'core:missing' not found. Did you mean: core:actor, core:target?"`
- **Empty suggestions when no similar conditions exist**: Graceful handling
- **Suggestions respect same-mod preference**: Conditions from same mod ranked higher
- **Fail-fast behavior preserved**: Still throws on missing condition

### Invariants

- Fail-fast behavior unchanged - still throws on missing condition
- Error type remains `ScopeResolutionError`
- Suggestions limited to top 3 matches
- Normal resolution path (condition found) has zero overhead
- Existing tests continue to pass

### Integration Points

```javascript
// In jsonLogicEvaluationService.js #resolveRule():
if (err.message.startsWith('Could not resolve condition_ref')) {
  const match = err.message.match(/condition_ref '([^']+)'/);
  const conditionRef = match ? match[1] : 'unknown';

  // Get available condition IDs from repository for suggestions
  const conditionIds = this.#gameDataRepository.getAllConditionIds?.() ?? [];
  const suggestions = getSuggestions(conditionRef, conditionIds);
  const suggestionText = suggestions.length
    ? ` Did you mean: ${suggestions.join(', ')}?`
    : '';

  throw new ScopeResolutionError(
    `Condition reference '${conditionRef}' not found.${suggestionText}`,
    {
      phase: 'condition_resolution',
      conditionId: conditionRef,
      parameters: { conditionRef },
      suggestions,
      hint: 'Check that the condition is defined in your mod and the ID is correct',
      originalError: err,
    }
  );
}
```

## Dependencies

- ACTDISDIAFAIFAS-001 (Condition Suggestion Service) - must be completed first
- ACTDISDIAFAIFAS-002 (Enhanced ScopeResolutionError) - must be completed first

## Outcome

**Completed successfully.**

### Changes Made

1. **`src/logic/jsonLogicEvaluationService.js`** (lines 330-358)
   - Added suggestion service integration in `#resolveRule()` error handling
   - Uses `getSuggestions()` with namespace prioritization when condition_ref fails
   - Error message now includes "Did you mean: ..." with up to 3 suggestions
   - Suggestions and conditionId preserved in error context

2. **`src/scopeDsl/nodes/filterResolver.js`** (lines 294-324)
   - Updated to preserve `suggestions`, `conditionId`, and `hint` from original error
   - Re-wrapped errors maintain all enhanced context from upstream

3. **Test Updates**
   - `tests/unit/scopeDsl/nodes/filterResolver.conditionRefErrors.test.js` - Added 4 new tests for suggestion preservation
   - `tests/unit/scopeDsl/nodes/filterResolver.failFast.test.js` - Updated error pattern expectation
   - `tests/integration/scopeDsl/filterResolver.integration.test.js` - Updated 2 tests for new message format
   - `tests/e2e/scopeDsl/ComplexFilterExpressions.e2e.test.js` - Updated error pattern
   - `tests/e2e/scopeDsl/MultiModScopeInteractions.e2e.test.js` - Updated error pattern

### Test Results

All test suites pass:
- Unit tests: 108 passed (filterResolver + jsonLogicEvaluationService + conditionSuggestionService)
- Integration tests: 28 passed
- E2E tests: 23 passed

### Error Message Format

Before:
```
Could not resolve condition_ref 'nonexistent:condition'. Definition or its logic property not found.
```

After:
```
[SCOPE_3000] Condition reference 'nonexistent:condition' not found. Did you mean: core:actor, core:target?
```

### Key Decisions

- Suggestions added at source (`jsonLogicEvaluationService.js`) where repository access exists
- filterResolver preserves suggestion context through error chain
- Maximum 3 suggestions with namespace prioritization (same-mod conditions ranked higher)
- Zero overhead on normal resolution path (suggestions only computed on error)
