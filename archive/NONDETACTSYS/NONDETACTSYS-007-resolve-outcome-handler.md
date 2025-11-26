# NONDETACTSYS-007: Implement ResolveOutcomeHandler

**Status**: ✅ Completed

## Summary

Create the `ResolveOutcomeHandler` operation handler that executes the `RESOLVE_OUTCOME` operation during rule execution. This handler orchestrates the skill resolution, probability calculation, and outcome determination services.

## Files to Create

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/resolveOutcomeHandler.js` | Handler implementation |
| `tests/unit/logic/operationHandlers/resolveOutcomeHandler.test.js` | Unit tests |

## Files to Modify

None in this ticket (DI registration is in NONDETACTSYS-008).

## Implementation Details

**Note**: This handler follows the `SetVariableHandler` pattern (direct constructor, `execute(params, executionContext)` signature) rather than extending `BaseOperationHandler`, as that is the established pattern in this codebase.

### resolveOutcomeHandler.js

```javascript
/**
 * @file ResolveOutcomeHandler - Resolves non-deterministic action outcomes
 * @see specs/non-deterministic-actions-system.md
 * @see data/schemas/operations/resolveOutcome.schema.json
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

class ResolveOutcomeHandler {
  #skillResolverService;
  #probabilityCalculatorService;
  #outcomeDeterminerService;
  #logger;

  /**
   * Creates an instance of ResolveOutcomeHandler.
   *
   * @param {object} dependencies - Dependencies object.
   * @param {object} dependencies.skillResolverService - Service for resolving skill values.
   * @param {object} dependencies.probabilityCalculatorService - Service for calculating probability.
   * @param {object} dependencies.outcomeDeterminerService - Service for determining outcomes.
   * @param {ILogger} dependencies.logger - The logging service instance.
   * @throws {Error} If dependencies are missing or invalid.
   */
  constructor({
    skillResolverService,
    probabilityCalculatorService,
    outcomeDeterminerService,
    logger,
  }) {
    // Validate logger
    if (
      !logger ||
      typeof logger.debug !== 'function' ||
      typeof logger.warn !== 'function' ||
      typeof logger.error !== 'function'
    ) {
      throw new Error(
        'ResolveOutcomeHandler requires a valid ILogger instance with debug, warn, and error methods.'
      );
    }

    // Validate services
    if (!skillResolverService || typeof skillResolverService.getSkillValue !== 'function') {
      throw new Error(
        'ResolveOutcomeHandler requires a valid skillResolverService with getSkillValue method.'
      );
    }
    if (!probabilityCalculatorService || typeof probabilityCalculatorService.calculate !== 'function') {
      throw new Error(
        'ResolveOutcomeHandler requires a valid probabilityCalculatorService with calculate method.'
      );
    }
    if (!outcomeDeterminerService || typeof outcomeDeterminerService.determine !== 'function') {
      throw new Error(
        'ResolveOutcomeHandler requires a valid outcomeDeterminerService with determine method.'
      );
    }

    this.#skillResolverService = skillResolverService;
    this.#probabilityCalculatorService = probabilityCalculatorService;
    this.#outcomeDeterminerService = outcomeDeterminerService;
    this.#logger = logger;

    this.#logger.debug('ResolveOutcomeHandler initialized.');
  }

  /**
   * Execute RESOLVE_OUTCOME operation.
   * Stores the result in executionContext.evaluationContext.context[result_variable].
   *
   * @param {object} params - Operation parameters (from schema).
   * @param {object} executionContext - The operation execution context.
   * @returns {void}
   */
  execute(params, executionContext) {
    const {
      actor_skill_component,
      target_skill_component,
      actor_skill_default = 0,
      target_skill_default = 0,
      formula = 'ratio',
      difficulty_modifier = 0,
      result_variable,
    } = params || {};

    // Validate required params
    if (!actor_skill_component || !result_variable) {
      this.#logger.error(
        'RESOLVE_OUTCOME: Missing required parameters (actor_skill_component, result_variable).',
        { params }
      );
      return;
    }

    // Get actor/target IDs from event
    const event = executionContext?.evaluationContext?.event;
    const actorId = event?.payload?.actorId;
    const targetId = event?.payload?.secondaryId || event?.payload?.targetId;

    if (!actorId) {
      this.#logger.error(
        'RESOLVE_OUTCOME: Missing actorId in event payload.',
        { eventPayload: event?.payload }
      );
      return;
    }

    // 1. Resolve skill values
    const actorSkill = this.#skillResolverService.getSkillValue(
      actorId,
      actor_skill_component,
      actor_skill_default
    );

    const targetSkill = target_skill_component
      ? this.#skillResolverService.getSkillValue(
          targetId,
          target_skill_component,
          target_skill_default
        )
      : { baseValue: 0, hasComponent: false };

    // 2. Calculate probability
    const probability = this.#probabilityCalculatorService.calculate({
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkill.baseValue,
      formula,
      difficulty: difficulty_modifier,
    });

    // 3. Determine outcome
    const outcome = this.#outcomeDeterminerService.determine({
      finalChance: probability.finalChance,
    });

    // 4. Build result object
    const result = {
      outcome: outcome.outcome,
      roll: outcome.roll,
      threshold: probability.finalChance,
      margin: outcome.margin,
      isCritical: outcome.isCritical,
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkill.baseValue,
      breakdown: probability.breakdown,
    };

    // 5. Store in context variable
    if (!executionContext?.evaluationContext?.context) {
      this.#logger.error(
        'RESOLVE_OUTCOME: Missing evaluationContext.context for variable storage.'
      );
      return;
    }

    executionContext.evaluationContext.context[result_variable] = result;

    this.#logger.debug(
      `RESOLVE_OUTCOME: Stored result in "${result_variable}" - outcome: ${result.outcome}, roll: ${result.roll}, threshold: ${result.threshold}`
    );
  }
}

export default ResolveOutcomeHandler;
```

### Result Object Structure

```javascript
{
  outcome: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE',
  roll: number,           // d100 roll (1-100)
  threshold: number,      // Success threshold (0-100)
  margin: number,         // roll - threshold
  isCritical: boolean,    // Was this a critical result?
  actorSkill: number,     // Actor's resolved skill value
  targetSkill: number,    // Target's resolved skill value
  breakdown: {            // From ProbabilityCalculatorService
    formula: string,
    rawCalculation: number,
    afterModifiers: number,
    bounds: { min: number, max: number }
  }
}
```

## Out of Scope

- **DO NOT** register in DI system (NONDETACTSYS-008)
- **DO NOT** add token to tokens-core.js (NONDETACTSYS-008)
- **Note**: `RESOLVE_OUTCOME` is already in preValidationUtils.js KNOWN_OPERATION_TYPES (added previously)
- **DO NOT** modify any existing handlers
- **DO NOT** create integration tests (unit tests only)
- **DO NOT** implement modifier collection (Phase 5)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for the handler
npm run test:unit -- --testPathPattern="resolveOutcomeHandler"

# Type checking
npm run typecheck

# Lint
npx eslint src/logic/operationHandlers/resolveOutcomeHandler.js
```

### Required Test Cases

#### Happy Path Tests
1. Opposed skill check with both skills present
2. Opposed skill check with missing target skill (uses default)
3. Fixed difficulty check (no target_skill_component)
4. All formula types (ratio, logistic, linear)

#### Result Object Tests
1. Result contains all expected properties
2. Result is stored in correct context variable
3. Breakdown information is included

#### Outcome Distribution Tests (using mocked services)
1. SUCCESS outcome is returned correctly
2. FAILURE outcome is returned correctly
3. CRITICAL_SUCCESS outcome is returned correctly
4. FUMBLE outcome is returned correctly

#### Edge Cases
1. Missing actor from event payload → logs error
2. Missing target for opposed check → uses default
3. Invalid formula parameter → falls back to ratio
4. Zero skill values handled correctly

#### Dependency Validation
1. Missing skillResolverService throws
2. Missing probabilityCalculatorService throws
3. Missing outcomeDeterminerService throws

### Invariants That Must Remain True

- [x] Handler follows SetVariableHandler pattern (direct constructor, no BaseOperationHandler inheritance)
- [x] Constructor validates all 4 dependencies (logger, skillResolverService, probabilityCalculatorService, outcomeDeterminerService)
- [x] execute(params, executionContext) stores result in evaluationContext.context[result_variable]
- [x] Handler does not modify event payload
- [x] All methods have JSDoc comments
- [x] Unit test coverage >= 90%
- [x] No modifications to existing files

## Dependencies

- **Depends on**:
  - NONDETACTSYS-003 (SkillResolverService)
  - NONDETACTSYS-004 (ProbabilityCalculatorService)
  - NONDETACTSYS-005 (OutcomeDeterminerService)
  - NONDETACTSYS-006 (schema for validation)
- **Blocked by**: NONDETACTSYS-003, 004, 005
- **Blocks**: NONDETACTSYS-008 (DI registration needs handler)

## Reference Files

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/ifHandler.js` | Complex handler pattern |
| `src/logic/operationHandlers/setVariableHandler.js` | Context modification pattern |
| `tests/unit/logic/operationHandlers/ifHandler.test.js` | Handler test pattern |

## Outcome

### What Changed vs Originally Planned

| Aspect | Original Ticket | Actual Implementation |
|--------|----------------|----------------------|
| Handler Pattern | Mentioned BaseOperationHandler | Correctly followed SetVariableHandler pattern |
| Method Signature | `execute(context)` | `execute(params, executionContext)` |
| Context Storage | Return modified context | In-place modification via `executionContext.evaluationContext.context[result_variable]` |
| API Parameter | `difficultyModifier` | `difficulty` (matches ProbabilityCalculatorService API) |

### Files Created

| File | Description |
|------|-------------|
| `src/logic/operationHandlers/resolveOutcomeHandler.js` | Handler implementation (243 lines) |
| `tests/unit/logic/operationHandlers/resolveOutcomeHandler.test.js` | Unit tests (36 tests, all passing) |

### Test Summary

**36 tests across 9 test suites:**

1. **Constructor** (9 tests) - Dependency validation
2. **Parameter Validation** (6 tests) - Required parameter checks
3. **Event Payload Validation** (2 tests) - ActorId and context checks
4. **Happy Path - Opposed Skill Check** (3 tests) - Core functionality
5. **Formula Types** (4 tests) - All formula variations
6. **Result Object Structure** (3 tests) - Output format verification
7. **Outcome Distribution** (4 tests) - All outcome types
8. **Edge Cases** (5 tests) - Boundary conditions
9. **Logging** (1 test) - Debug output verification

### Validation Results

```
✅ Unit tests: 36 passed
✅ ESLint: No errors (module type warning only)
✅ TypeScript: No new errors (pre-existing CLI errors unrelated)
```

### Notes

- The ticket initially had incorrect assumptions about the handler pattern (BaseOperationHandler inheritance vs direct constructor). This was corrected in the ticket first before implementation.
- `RESOLVE_OUTCOME` was already in `preValidationUtils.js` KNOWN_OPERATION_TYPES from a previous ticket.
- DI registration is handled by NONDETACTSYS-008 (not part of this ticket).
