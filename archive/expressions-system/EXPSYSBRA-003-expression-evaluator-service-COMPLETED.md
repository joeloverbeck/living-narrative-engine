# EXPSYSBRA-003: Expression Evaluator Service

## Summary

Create the `ExpressionEvaluatorService` that evaluates expression prerequisites using JSON Logic and selects the highest priority matching expression.

## Background

The evaluator service is the core logic of the expression system:
1. Takes an evaluation context (from `ExpressionContextBuilder`)
2. Evaluates each expression's prerequisites using JSON Logic
3. Resolves condition references using the shared `conditionRefResolver` (via `gameDataRepository.getConditionDefinition`)
4. Selects the highest priority expression from all matches
5. Returns the winning expression (or null if none match)

## File List (Expected to Touch)

### New Files
- `src/expressions/expressionEvaluatorService.js` - Evaluator service

### Files to Read (NOT modify)
- `src/actions/validation/prerequisiteEvaluationService.js` - Pattern reference
- `src/logic/jsonLogicEvaluationService.js` - JSON Logic evaluation
- `src/utils/conditionRefResolver.js` - Condition reference resolution
- `src/expressions/expressionRegistry.js` - From EXPSYSBRA-001
- `src/expressions/expressionContextBuilder.js` - From EXPSYSBRA-002
- `src/data/gameDataRepository.js` - Source of condition definitions (`getConditionDefinition`)

## Out of Scope (MUST NOT Change)

- `src/logic/jsonLogicEvaluationService.js` - Use as-is
- `src/utils/conditionRefResolver.js` - Use as-is
- `src/actions/validation/prerequisiteEvaluationService.js` - Reference only
- Any JSON Logic custom operators
- DI registration (separate ticket EXPSYSBRA-006)
- `data/schemas/expression.schema.json` - Schema already complete

## Implementation Details

### Class: `ExpressionEvaluatorService`

```javascript
/**
 * @file Expression Evaluator Service - Evaluates expression prerequisites
 */

import { validateDependency } from '../utils/dependencyUtils.js';

class ExpressionEvaluatorService {
  #expressionRegistry;
  #jsonLogicEvaluationService;
  #gameDataRepository;
  #logger;

  constructor({
    expressionRegistry,
    jsonLogicEvaluationService,
    gameDataRepository,
    logger
  }) {
    validateDependency(expressionRegistry, 'ExpressionRegistry', logger, {
      requiredMethods: ['getExpressionsByPriority'],
    });
    validateDependency(jsonLogicEvaluationService, 'IJsonLogicEvaluationService', logger);
    validateDependency(gameDataRepository, 'IGameDataRepository', logger, {
      requiredMethods: ['getConditionDefinition'],
    });
    // ...
  }

  /**
   * Evaluate all expressions and return the highest priority match
   * @param {ExpressionEvaluationContext} context - From ExpressionContextBuilder
   * @returns {Expression|null} - Highest priority matching expression or null
   */
  evaluate(context) {
    const expressions = this.#expressionRegistry.getExpressionsByPriority();
    const matchingExpressions = [];

    for (const expression of expressions) {
      const passes = this.#evaluatePrerequisites(expression, context);
      if (passes) {
        matchingExpressions.push(expression);
      }
    }

    // Return highest priority (first in sorted list)
    return matchingExpressions.length > 0 ? matchingExpressions[0] : null;
  }

  /**
   * Evaluate all expressions and return all matches (for debugging)
   * @param {ExpressionEvaluationContext} context
   * @returns {Expression[]} - All matching expressions sorted by priority
   */
  evaluateAll(context) {
    const expressions = this.#expressionRegistry.getExpressionsByPriority();
    const matchingExpressions = [];

    for (const expression of expressions) {
      const passes = this.#evaluatePrerequisites(expression, context);
      if (passes) {
        matchingExpressions.push(expression);
      }
    }

    return matchingExpressions;
  }

  /**
   * Evaluate a single expression's prerequisites
   * @private
   * @param {Expression} expression
   * @param {ExpressionEvaluationContext} context
   * @returns {boolean}
   */
  #evaluatePrerequisites(expression, context) {
    const prerequisites = expression.prerequisites || [];

    // All prerequisites must pass (AND logic)
    for (const prerequisite of prerequisites) {
      if (!prerequisite.logic) {
        this.#logger.warn(
          `Expression ${expression.id} has prerequisite without logic, skipping`
        );
        continue;
      }

      try {
        // Resolve condition references in the logic
        const resolvedLogic = this.#resolveConditionRefs(prerequisite.logic);

        // Evaluate with JSON Logic
        const result = this.#jsonLogicEvaluationService.evaluate(resolvedLogic, context);

        if (!result) {
          this.#logger.debug(
            `Expression ${expression.id} prerequisite failed`,
            { logic: prerequisite.logic }
          );
          return false;
        }
      } catch (err) {
        this.#logger.error(
          `Error evaluating expression ${expression.id} prerequisite`,
          err
        );
        return false; // Fail-safe: don't match on errors
      }
    }

    return true;
  }

  /**
   * Resolve condition_ref objects in logic
   * @private
   */
  #resolveConditionRefs(logic) {
    // Reuse existing conditionRefResolver utility (handles recursion + circular refs)
    return resolveConditionRefs(logic, this.#gameDataRepository, this.#logger);
  }
}
```

### Evaluation Flow

```
1. Get all expressions sorted by priority (descending)
2. For each expression:
   a. Get prerequisites array
   b. For each prerequisite:
   - Resolve condition_ref objects via `gameDataRepository.getConditionDefinition`
      - Evaluate logic with JSON Logic
      - If false → skip this expression
   c. If all pass → add to matches
3. Return first match (highest priority) or null
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Test: `tests/unit/expressions/expressionEvaluatorService.test.js`**
   - `should return null when no expressions exist`
   - `should return null when no expressions match`
   - `should return highest priority matching expression`
   - `should evaluate all prerequisites with AND logic`
   - `should fail expression if any prerequisite fails`
   - `should resolve condition_ref in prerequisites`
   - `should detect circular condition_ref and fail safely`
   - `should handle missing logic in prerequisite gracefully`
   - `should handle JSON Logic evaluation errors gracefully`
   - `should evaluate expressions in priority order`
   - `should return all matches with evaluateAll method`
   - `should validate dependencies in constructor`
   - `should treat empty prerequisites as a match`

### Invariants That Must Remain True

1. **Highest priority wins** - Always return highest priority match
2. **All prerequisites must pass** - AND logic for prerequisites
3. **Fail-safe on errors** - Return false/null, don't throw
4. **Circular reference detection** - Detect and handle gracefully
5. **No side effects** - Pure evaluation, no state changes
6. **Priority sort is stable** - Same order for same priority
7. **Empty prerequisites means always match** - [] prerequisites = true

## Estimated Size

- ~150-200 lines of code
- Single file addition
- Reuses existing JSON Logic infrastructure

## Dependencies

- Depends on: EXPSYSBRA-001 (ExpressionRegistry)
- Depends on: EXPSYSBRA-002 (ExpressionContextBuilder - for context type)
- Uses: `JsonLogicEvaluationService`, `gameDataRepository`
  - `JsonLogicEvaluationService` handles JSON Logic evaluation; condition resolution uses `gameDataRepository`

## Notes

- Follow pattern from `PrerequisiteEvaluationService` but simplified
- Condition reference resolution follows `conditionRefResolver.js` pattern
- Use existing `jsonLogicEvaluationService.evaluate()` method (after condition resolution)
- Empty prerequisites array means expression always matches
- Log debug info for failed prerequisites (debugging aid)
- Consider future optimization: tag-based pre-filtering

## Status

Completed.

## Outcome

Implemented `ExpressionEvaluatorService` with dependency validation, condition_ref resolution via `resolveConditionRefs`, and priority-ordered evaluation (`evaluate`/`evaluateAll`). Added unit tests covering priority order, AND prerequisite handling, condition_ref resolution (including circular refs), error handling, and empty-prerequisite matching; updated assumptions to use `gameDataRepository.getConditionDefinition` instead of a non-existent condition repository.
