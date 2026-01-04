# ACTDISDIAFAIFAS-003 – TargetComponentValidator Detailed Returns

## Status: COMPLETED

## Problem

**Original assumption** (corrected): The ticket originally assumed `validateTargetComponents()` only returns `{valid: boolean, reason?: string}`.

**Actual state**: The implementation already returns `{valid, reason?, filteredTargets?, removedTargets?}` where `removedTargets` is `Array<{role, targetId, component}>` - partial entity breakdown exists.

**Real gap**: Only the **first** forbidden component per entity is tracked. When an entity has multiple forbidden components (e.g., `['positioning:kneeling', 'positioning:sitting']`), only one is reported. This ticket adds:
1. Tracking of ALL forbidden components per rejected entity
2. Opt-in `includeDetails` option for structured detailed output
3. Structured `details` object with `rejectedEntities[]` and `targetRole`

## Proposed Scope

Extend `TargetComponentValidator` to optionally return detailed rejection information including:
1. List of rejected entity IDs
2. Which forbidden components were present on each rejected entity
3. The target role that was being validated

## File List

- `src/actions/validation/TargetComponentValidator.js`
- `tests/unit/actions/validation/TargetComponentValidator.test.js`

## Out of Scope

- TargetComponentValidationStage changes (handled in ACTDISDIAFAIFAS-007)
- Required components validation (handled in ACTDISDIAFAIFAS-004)
- Action discovery service changes
- Modifying the pipeline orchestrator
- Performance optimization

## Acceptance Criteria

### Tests

Run: `npm run test:unit -- tests/unit/actions/validation/TargetComponentValidator.test.js`

Required test cases:
- **Returns `details.rejectedEntities[]` with entity IDs**: Each rejected entity identified
- **Each rejection includes `forbiddenComponentsPresent[]`**: Lists which forbidden components entity has
- **`targetRole` included in details**: Identifies which role (primary, secondary, tertiary) was validated
- **Backward compatible - existing callers still work**: `{valid, reason}` structure preserved
- **Details only populated when explicitly requested**: Performance protection
- **Empty rejectedEntities when validation passes**: Clean success case
- **Multiple entities rejected tracked separately**: Each entity in its own rejection record

### Invariants

- `{valid: boolean, reason?: string}` interface unchanged
- New properties are additive, not breaking
- Performance unchanged when details not requested
- Existing test assertions continue to pass
- No changes to validation logic itself

### API Contract

```javascript
/**
 * @typedef {Object} TargetComponentValidationResult
 * @property {boolean} valid
 * @property {string} [reason]
 * @property {Object} [details] - Only present when includeDetails: true
 * @property {Array<{entityId: string, forbiddenComponentsPresent: string[]}>} [details.rejectedEntities]
 * @property {string} [details.targetRole]
 */

/**
 * @param {Object} target - Target entity or entities
 * @param {Object} actionDef - Action definition with forbidden_components
 * @param {Object} [options]
 * @param {boolean} [options.includeDetails=false] - Include rejection details
 * @returns {TargetComponentValidationResult}
 */
validateTargetComponents(target, actionDef, options = {}) {}
```

### Example Output

```javascript
// With includeDetails: true
{
  valid: false,
  reason: 'Target has forbidden component positioning:kneeling',
  details: {
    targetRole: 'primary',
    rejectedEntities: [
      {
        entityId: 'entity_123',
        forbiddenComponentsPresent: ['positioning:kneeling', 'positioning:sitting']
      }
    ]
  }
}
```

## Dependencies

- ACTDISDIAFAIFAS-002 (Enhanced ScopeResolutionError) - for error context patterns

## Outcome

### What Was Originally Planned

The ticket assumed `validateTargetComponents()` only returned `{valid: boolean, reason?: string}` with no per-entity breakdown of rejections. The plan was to add entity IDs and forbidden component tracking from scratch.

### What Was Actually Found

The implementation already returned `{valid, reason?, filteredTargets?, removedTargets?}` where `removedTargets` is `Array<{role, targetId, component}>`. This means partial entity breakdown already existed.

### What Was Actually Changed

1. **Ticket Corrected First**: Updated assumptions to reflect actual code state before modifying code
2. **`validateEntityComponents()`**: Added `options.includeAllForbidden` parameter to collect ALL forbidden components instead of stopping at first match
3. **`validateTargetComponents()`**: Added `options.includeDetails` parameter for opt-in detailed output
4. **`#validateLegacyFormat()`**: Updated to build `details` object when `includeDetails: true`
5. **`#validateMultiTargetFormat()`**: Updated to track all rejected entities with full forbidden component lists

### Tests Added (13 new tests)

| Test | Rationale |
|------|-----------|
| `returns all forbidden components when includeAllForbidden is true` | Validates new multi-component tracking |
| `returns first forbidden component for backward compatibility` | Ensures backward compat preserved |
| `returns valid when no forbidden components present (includeAllForbidden)` | Success case with new option |
| `returns details.rejectedEntities with entity IDs` | Core requirement from ticket |
| `includes forbiddenComponentsPresent array in rejectedEntities` | Validates component list tracking |
| `includes targetRole in details` | Validates role identification |
| `returns empty rejectedEntities when validation passes` | Clean success case |
| `is backward compatible without includeDetails option` | Critical backward compat verification |
| `does not include details when includeDetails is false` | Performance protection |
| `tracks multiple rejected entities separately` | Multi-entity rejection tracking |
| `multi-target format returns details with all forbidden components` | Multi-target with full component lists |
| `handles validation pass in multi-target format with includeDetails` | Multi-target success case |
| `legacy format returns details with correct targetRole` | Legacy format compatibility |

### Difference from Plan

- **Smaller scope**: Did not need to add entity ID tracking (already existed in `removedTargets`)
- **Focused change**: Only needed to add ALL forbidden components collection and structured `details` output
- **Minimal code**: ~30 lines added to implementation, preserving all existing logic
