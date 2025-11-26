# NONDETACTSYS-007: Implement ResolveOutcomeHandler

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

### resolveOutcomeHandler.js

```javascript
/**
 * @file ResolveOutcomeHandler - Resolves non-deterministic action outcomes
 * @see specs/non-deterministic-actions-system.md
 * @see data/schemas/operations/resolveOutcome.schema.json
 */

import BaseOperationHandler from './baseOperationHandler.js';

class ResolveOutcomeHandler extends BaseOperationHandler {
  #skillResolverService;
  #probabilityCalculatorService;
  #outcomeDeterminerService;

  constructor({
    logger,
    skillResolverService,
    probabilityCalculatorService,
    outcomeDeterminerService,
  }) {
    super({ logger });
    // Validate dependencies
    this.#skillResolverService = skillResolverService;
    this.#probabilityCalculatorService = probabilityCalculatorService;
    this.#outcomeDeterminerService = outcomeDeterminerService;
  }

  /**
   * Execute RESOLVE_OUTCOME operation
   * @param {Object} context - Rule execution context
   * @returns {Promise<Object>} Updated context with result_variable set
   */
  async execute(context) {
    const { operation, event } = context;
    const {
      actor_skill_component,
      target_skill_component,
      actor_skill_default = 0,
      target_skill_default = 0,
      formula = 'ratio',
      difficulty_modifier = 0,
      result_variable,
    } = operation.parameters;

    // 1. Get actor ID from event
    const actorId = event.payload.actorId;
    const targetId = event.payload.secondaryId || event.payload.targetId;

    // 2. Resolve skill values
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

    // 3. Calculate probability
    const probability = this.#probabilityCalculatorService.calculate({
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkill.baseValue,
      formula,
      difficultyModifier: difficulty_modifier,
    });

    // 4. Determine outcome
    const outcome = this.#outcomeDeterminerService.determine({
      finalChance: probability.finalChance,
    });

    // 5. Build result object
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

    // 6. Store in context
    return {
      ...context,
      [result_variable]: result,
    };
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
- **DO NOT** add to preValidationUtils.js (NONDETACTSYS-008)
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

- [ ] Handler extends BaseOperationHandler
- [ ] All dependencies are validated in constructor
- [ ] execute() returns updated context with result_variable
- [ ] Handler does not modify event payload
- [ ] All methods have JSDoc comments
- [ ] Unit test coverage >= 90%
- [ ] No modifications to existing files

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
