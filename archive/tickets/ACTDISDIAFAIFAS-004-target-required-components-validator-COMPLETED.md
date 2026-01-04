# ACTDISDIAFAIFAS-004 – TargetRequiredComponentsValidator Detailed Returns

## Status: COMPLETED

## Problem

`validateTargetRequirements()` only returns `{valid: boolean, reason?: string}` - no per-role or per-entity breakdown. When required components are missing, users cannot determine which entities lacked which components.

## Proposed Scope

Extend `TargetRequiredComponentsValidator` to optionally return detailed rejection information including:
1. List of rejected entity IDs
2. Which required components were missing from each rejected entity
3. The target role that was being validated

## File List

- `src/actions/validation/TargetRequiredComponentsValidator.js`
- `tests/unit/actions/validation/TargetRequiredComponentsValidator.test.js`

## Out of Scope

- TargetComponentValidationStage changes (handled in ACTDISDIAFAIFAS-007)
- Forbidden components validation (handled in ACTDISDIAFAIFAS-003)
- Action discovery service changes
- Modifying the pipeline orchestrator
- Performance optimization

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/actions/validation/TargetRequiredComponentsValidator.test.js`

Required test cases:
- **Returns `details.rejectedEntities[]` with entity IDs**: Each rejected entity identified
- **Each rejection includes `requiredComponentsMissing[]`**: Lists which required components entity lacks
- **`targetRole` included in details**: Identifies which role (primary, secondary, tertiary) was validated
- **Backward compatible - existing callers still work**: `{valid, reason}` structure preserved
- **Details only populated when explicitly requested**: Performance protection
- **Empty rejectedEntities when validation passes**: Clean success case
- **Multiple missing components tracked per entity**: All missing components listed

### Invariants

- `{valid: boolean, reason?: string}` interface unchanged
- New properties are additive, not breaking
- Performance unchanged when details not requested
- Existing test assertions continue to pass
- No changes to validation logic itself

### API Contract

```javascript
/**
 * @typedef {Object} TargetRequiredValidationResult
 * @property {boolean} valid
 * @property {string} [reason]
 * @property {Object} [details] - Only present when includeDetails: true
 * @property {Array<{entityId: string, requiredComponentsMissing: string[]}>} [details.rejectedEntities]
 * @property {string} [details.targetRole]
 */

/**
 * @param {Object} target - Target entity or entities
 * @param {Object} actionDef - Action definition with required_components
 * @param {Object} [options]
 * @param {boolean} [options.includeDetails=false] - Include rejection details
 * @returns {TargetRequiredValidationResult}
 */
validateTargetRequirements(target, actionDef, options = {}) {}
```

### Example Output

```javascript
// With includeDetails: true
{
  valid: false,
  reason: 'Target missing required component core:actor',
  details: {
    targetRole: 'secondary',
    rejectedEntities: [
      {
        entityId: 'entity_456',
        requiredComponentsMissing: ['core:actor', 'positioning:standing']
      }
    ]
  }
}
```

## Dependencies

- ACTDISDIAFAIFAS-002 (Enhanced ScopeResolutionError) - for error context patterns

## Outcome

### What Was Planned

The ticket correctly identified that `validateTargetRequirements()` only returned `{valid: boolean, reason?: string}` with no per-entity breakdown. The plan was to add `options.includeDetails` parameter following the pattern established in ACTDISDIAFAIFAS-003 (`TargetComponentValidator`).

### Ticket Assumption Verification

| Assumption | Status | Notes |
|------------|--------|-------|
| Method only returns `{valid, reason?}` | ✅ CORRECT | No details tracking existed |
| No `options` parameter exists | ✅ CORRECT | Only `(actionDef, targetEntities)` |
| No entity ID tracking | ✅ CORRECT | Not in return value |
| Only first missing component tracked | ✅ CORRECT | Uses `find()` not `filter()` |
| Should follow 003 pattern | ✅ CORRECT | Pattern is established |

**No ticket corrections were needed** - all assumptions were accurate.

### What Was Changed

1. **`validateTargetRequirements()` signature**: Added `options = {}` parameter with `includeDetails` option
2. **Accumulator tracking**: Added `allRejectedEntities` array and `firstFailureResult` to aggregate across roles
3. **`#validateTargetRole()` method**:
   - Added `includeDetails` parameter
   - Uses `filter()` instead of `find()` when `includeDetails: true` to collect ALL missing components
   - Returns structured `details` object with `targetRole` and `rejectedEntities[]`
4. **Return structure**: When `includeDetails: true`, returns `details` with `rejectedEntities` array containing `{entityId, requiredComponentsMissing[]}`

### Tests Added (9 new tests)

| Test | Rationale |
|------|-----------|
| `returns details.rejectedEntities[] with entity IDs when includeDetails: true` | Core requirement |
| `includes requiredComponentsMissing[] in each rejection` | Validates all missing components tracked |
| `includes targetRole in details` | Role identification |
| `backward compatible without includeDetails option` | No breaking changes |
| `does not include details when includeDetails is false` | Performance protection |
| `returns empty rejectedEntities when validation passes with includeDetails` | Clean success case |
| `tracks multiple missing components per entity` | Tests filter vs find behavior |
| `includes details for legacy target format` | Legacy format compatibility |
| `returns empty rejectedEntities with details when no required_components defined` | Edge case handling |

### Test Results

All 40 tests pass (31 existing + 9 new):
```
PASS tests/unit/actions/validation/TargetRequiredComponentsValidator.test.js
Tests: 40 passed, 40 total
```

### API Conformance

Implementation matches the ticket's API contract exactly:
```javascript
validateTargetRequirements(actionDef, targetEntities, options = {})
// Returns: { valid, reason?, details?: { targetRole, rejectedEntities[] } }
```
