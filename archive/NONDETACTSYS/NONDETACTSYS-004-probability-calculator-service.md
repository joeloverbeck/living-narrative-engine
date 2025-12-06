# NONDETACTSYS-004: Implement ProbabilityCalculatorService

**Status: ✅ COMPLETED**

## Summary

Create the `ProbabilityCalculatorService` that calculates success probability using configurable formulas (ratio, logistic, linear). This service is a core building block for the non-deterministic action system.

## Files to Create

| File                                                              | Purpose                |
| ----------------------------------------------------------------- | ---------------------- |
| `src/combat/services/ProbabilityCalculatorService.js`             | Service implementation |
| `tests/unit/combat/services/ProbabilityCalculatorService.test.js` | Unit tests             |

## Files to Modify

| File                                            | Change                                   |
| ----------------------------------------------- | ---------------------------------------- |
| `src/dependencyInjection/tokens/tokens-core.js` | Add `ProbabilityCalculatorService` token |
| `src/combat/index.js`                           | Export the service                       |

## Implementation Details

### ProbabilityCalculatorService.js

```javascript
/**
 * @file ProbabilityCalculatorService - Calculates success probability using formulas
 * @see specs/non-deterministic-actions-system.md
 */

class ProbabilityCalculatorService {
  #logger;

  constructor({ logger }) {
    // Dependency validation
  }

  /**
   * @param {Object} params
   * @param {number} params.actorSkill - Actor's skill value
   * @param {number} [params.targetSkill] - For opposed checks
   * @param {number} [params.difficulty] - For fixed difficulty checks
   * @param {string} [params.formula='ratio'] - 'ratio' | 'logistic' | 'linear'
   * @param {Object} [params.modifiers] - From ModifierCollectorService
   * @param {Object} [params.bounds] - { min: 5, max: 95 }
   * @returns {{ baseChance: number, finalChance: number, breakdown: Object }}
   */
  calculate(params) {
    // Implementation
  }
}

export default ProbabilityCalculatorService;
```

### Supported Formulas

| Formula           | Calculation                      | Best For                |
| ----------------- | -------------------------------- | ----------------------- |
| `ratio` (default) | `actor / (actor + target) * 100` | Opposed skill checks    |
| `logistic`        | `100 / (1 + e^(-0.1 * diff))`    | Bell-curve distribution |
| `linear`          | `50 + (actor - difficulty)`      | Fixed difficulty checks |

### API Contract

```javascript
/**
 * @param {Object} params
 * @param {number} params.actorSkill - Actor's skill value (required)
 * @param {number} [params.targetSkill=0] - Target's skill value (for opposed checks)
 * @param {number} [params.difficulty=0] - Static difficulty (for fixed checks)
 * @param {string} [params.formula='ratio'] - Calculation formula
 * @param {Object} [params.modifiers] - { totalFlat: 0, totalPercentage: 1 }
 * @param {Object} [params.bounds] - { min: 5, max: 95 }
 * @returns {{
 *   baseChance: number,      // Before modifiers/bounds
 *   finalChance: number,     // After modifiers and bounds applied
 *   breakdown: {
 *     formula: string,
 *     rawCalculation: number,
 *     afterModifiers: number,
 *     bounds: { min: number, max: number }
 *   }
 * }}
 */
calculate(params);
```

### DI Token

Add to `tokens-core.js`:

```javascript
ProbabilityCalculatorService: 'ProbabilityCalculatorService',
```

## Out of Scope

- **DO NOT** create DI registration file (separate ticket NONDETACTSYS-008)
- **DO NOT** implement modifier collection (separate service)
- **DO NOT** implement outcome determination (separate service)
- **DO NOT** create integration tests (unit tests only)
- **DO NOT** modify any existing services

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for the service
npm run test:unit -- --testPathPattern="ProbabilityCalculatorService"

# Type checking
npm run typecheck

# Lint
npx eslint src/combat/services/ProbabilityCalculatorService.js
```

### Required Test Cases

#### Ratio Formula Tests

1. `calculate({ actorSkill: 50, targetSkill: 50 })` → 50%
2. `calculate({ actorSkill: 75, targetSkill: 25 })` → 75%
3. `calculate({ actorSkill: 25, targetSkill: 75 })` → 25%
4. `calculate({ actorSkill: 0, targetSkill: 100 })` → 5% (clamped to min)
5. `calculate({ actorSkill: 100, targetSkill: 0 })` → 95% (clamped to max)

#### Logistic Formula Tests

1. Equal skills → ~50%
2. Large positive difference → approaches 95%
3. Large negative difference → approaches 5%

#### Linear Formula Tests

1. `calculate({ actorSkill: 50, difficulty: 50, formula: 'linear' })` → 50%
2. `calculate({ actorSkill: 60, difficulty: 50, formula: 'linear' })` → 60%
3. `calculate({ actorSkill: 40, difficulty: 50, formula: 'linear' })` → 40%

#### Bounds Tests

1. Custom bounds `{ min: 10, max: 90 }` clamps correctly
2. Invalid bounds (min > max) throws error
3. Default bounds (5-95) applied when not specified

#### Modifier Tests

1. Flat modifiers apply to base chance
2. Percentage modifiers apply multiplicatively
3. Modifiers respect bounds

#### Edge Cases

1. Zero actor skill handled gracefully
2. Zero target skill handled gracefully
3. Negative values handled gracefully
4. Invalid formula throws meaningful error

### Invariants That Must Remain True

- [x] Service follows existing DI patterns
- [x] All methods have JSDoc comments
- [x] Formula calculations are mathematically correct
- [x] Bounds are always respected (no chance < min or > max)
- [x] Unit test coverage >= 90%
- [x] No modifications to existing files except tokens-core.js and combat/index.js

## Dependencies

- **Depends on**: Nothing (pure calculation service)
- **Blocked by**: Nothing
- **Blocks**: NONDETACTSYS-007 (ResolveOutcomeHandler uses this service)

## Reference Files

| File                                                    | Purpose                          |
| ------------------------------------------------------- | -------------------------------- |
| `src/clothing/services/clothingAccessibilityService.js` | Service pattern reference        |
| `src/logic/jsonLogicEvaluationService.js`               | Pure calculation service pattern |

---

## Outcome

**Completed: 2025-11-26**

### What Was Actually Changed vs Originally Planned

**All changes matched the plan exactly:**

1. **Created** `src/combat/services/ProbabilityCalculatorService.js` (~320 lines)
   - Pure calculation service with only logger dependency
   - Implements all three formulas: ratio, logistic, linear
   - Full modifier support (flat and percentage)
   - Configurable bounds with defaults (5-95)
   - Comprehensive input validation and error handling

2. **Created** `tests/unit/combat/services/ProbabilityCalculatorService.test.js` (~510 lines)
   - 48 unit tests covering all acceptance criteria
   - Constructor validation (6 tests)
   - Ratio formula (7 tests including both skills = 0 edge case)
   - Logistic formula (4 tests)
   - Linear formula (4 tests)
   - Bounds (7 tests)
   - Modifiers (7 tests including negative and percentage < 1)
   - Edge cases (9 tests)
   - Breakdown structure (2 tests)

3. **Modified** `src/dependencyInjection/tokens/tokens-core.js`
   - Added `ProbabilityCalculatorService: 'ProbabilityCalculatorService'` (line 382)

4. **Modified** `src/combat/index.js`
   - Added export for ProbabilityCalculatorService

### Test Results

```
PASS tests/unit/combat/services/ProbabilityCalculatorService.test.js
Test Suites: 1 passed, 1 total
Tests:       48 passed, 48 total
```

### Additional Test Cases Added Beyond Requirements

| Test Case                         | Rationale                                    |
| --------------------------------- | -------------------------------------------- |
| Both skills = 0 returns 50%       | Edge case for ratio formula division by zero |
| NaN actorSkill handling           | Defensive programming for invalid input      |
| Empty modifiers/bounds objects    | Graceful handling of empty objects           |
| Negative flat modifiers           | Support for debuffs                          |
| Percentage modifiers < 1          | Support for percentage penalties             |
| Very large skill values           | Numerical stability verification             |
| Logistic with difficulty fallback | targetSkill = 0 uses difficulty              |

### Notes

- Typecheck passes for new files (pre-existing CLI validation errors unrelated)
- ESLint passes with 0 errors/warnings after auto-fix
- Service follows established SkillResolverService patterns exactly
- No breaking changes to any existing APIs
