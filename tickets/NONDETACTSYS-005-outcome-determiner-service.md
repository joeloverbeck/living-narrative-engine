# NONDETACTSYS-005: Implement OutcomeDeterminerService

## Summary

Create the `OutcomeDeterminerService` that resolves final outcomes with degrees of success/failure (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) based on calculated probability and dice roll.

## Files to Create

| File | Purpose |
|------|---------|
| `src/combat/services/OutcomeDeterminerService.js` | Service implementation |
| `tests/unit/combat/services/OutcomeDeterminerService.test.js` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-core.js` | Add `OutcomeDeterminerService` token |
| `src/combat/index.js` | Export the service |

## Implementation Details

### OutcomeDeterminerService.js

```javascript
/**
 * @file OutcomeDeterminerService - Resolves outcomes with degrees of success/failure
 * @see specs/non-deterministic-actions-system.md
 */

/**
 * @typedef {'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE'} OutcomeType
 */

class OutcomeDeterminerService {
  #logger;

  constructor({ logger }) {
    // Dependency validation
  }

  /**
   * Determines outcome based on calculated probability
   * @param {Object} params
   * @param {number} params.finalChance - Calculated probability (0-100)
   * @param {Object} [params.thresholds] - { criticalSuccess: 5, criticalFailure: 95 }
   * @returns {{
   *   outcome: OutcomeType,
   *   roll: number,
   *   margin: number,
   *   isCritical: boolean
   * }}
   */
  determine(params) {
    // Implementation
  }

  /**
   * Internal roll function (injectable for testing)
   * @returns {number} 1-100
   */
  #rollD100() {
    return Math.floor(Math.random() * 100) + 1;
  }
}

export default OutcomeDeterminerService;
```

### Outcome Resolution Logic

```
Roll 1-100:

CRITICAL_SUCCESS: roll <= criticalSuccessThreshold AND roll <= finalChance
SUCCESS:          roll <= finalChance (and not critical success)
FAILURE:          roll > finalChance (and not fumble)
FUMBLE:           roll >= criticalFailureThreshold AND roll > finalChance
```

### Default Thresholds

| Threshold | Default | Description |
|-----------|---------|-------------|
| `criticalSuccessThreshold` | 5 | Roll <= 5 on success = critical |
| `criticalFailureThreshold` | 95 | Roll >= 95 on failure = fumble |

### API Contract

```javascript
/**
 * @param {Object} params
 * @param {number} params.finalChance - Probability of success (0-100)
 * @param {Object} [params.thresholds]
 * @param {number} [params.thresholds.criticalSuccess=5]
 * @param {number} [params.thresholds.criticalFailure=95]
 * @param {number} [params.forcedRoll] - For testing determinism
 * @returns {{
 *   outcome: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE',
 *   roll: number,      // The actual d100 roll (1-100)
 *   margin: number,    // roll - finalChance (negative = success margin)
 *   isCritical: boolean
 * }}
 */
determine(params)
```

### DI Token

Add to `tokens-core.js`:
```javascript
OutcomeDeterminerService: 'OutcomeDeterminerService',
```

## Out of Scope

- **DO NOT** create DI registration file (separate ticket NONDETACTSYS-008)
- **DO NOT** implement probability calculation (separate service)
- **DO NOT** implement modifier collection (separate service)
- **DO NOT** create integration tests (unit tests only)
- **DO NOT** modify any existing services

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for the service
npm run test:unit -- --testPathPattern="OutcomeDeterminerService"

# Type checking
npm run typecheck

# Lint
npx eslint src/combat/services/OutcomeDeterminerService.js
```

### Required Test Cases

#### Basic Outcome Tests (using forcedRoll)
1. `determine({ finalChance: 50, forcedRoll: 30 })` → SUCCESS
2. `determine({ finalChance: 50, forcedRoll: 70 })` → FAILURE
3. `determine({ finalChance: 50, forcedRoll: 3 })` → CRITICAL_SUCCESS
4. `determine({ finalChance: 50, forcedRoll: 97 })` → FUMBLE

#### Margin Calculation Tests
1. Roll 30 vs chance 50 → margin = -20 (20 under)
2. Roll 70 vs chance 50 → margin = +20 (20 over)
3. Roll 50 vs chance 50 → margin = 0 (exact match = success)

#### Custom Threshold Tests
1. `thresholds: { criticalSuccess: 10 }` → critical on roll <= 10
2. `thresholds: { criticalFailure: 90 }` → fumble on roll >= 90
3. Both custom thresholds work together

#### Edge Cases
1. `finalChance: 5` → can still critical success on roll 1-5
2. `finalChance: 95` → can still fumble on roll 95-100
3. `finalChance: 0` → always failure (but can fumble)
4. `finalChance: 100` → always success (but can critical)

#### Critical Logic Tests
1. Roll 3 on chance 2 → FAILURE (not critical success, because 3 > 2)
2. Roll 96 on chance 97 → SUCCESS (not fumble, because 96 <= 97)
3. Fumble requires BOTH high roll AND failure
4. Critical success requires BOTH low roll AND success

### Invariants That Must Remain True

- [ ] Service follows existing DI patterns
- [ ] All methods have JSDoc comments
- [ ] Outcome logic matches specification exactly
- [ ] Roll is always 1-100 (inclusive)
- [ ] forcedRoll parameter allows deterministic testing
- [ ] Unit test coverage >= 90%
- [ ] No modifications to existing files except tokens-core.js and combat/index.js

## Dependencies

- **Depends on**: Nothing (pure outcome determination)
- **Blocked by**: Nothing
- **Blocks**: NONDETACTSYS-007 (ResolveOutcomeHandler uses this service)

## Reference Files

| File | Purpose |
|------|---------|
| `src/clothing/services/clothingAccessibilityService.js` | Service pattern reference |
| `specs/non-deterministic-actions-system.md` | Outcome threshold specification |
