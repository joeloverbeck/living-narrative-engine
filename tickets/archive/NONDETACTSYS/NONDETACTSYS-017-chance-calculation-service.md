# NONDETACTSYS-017: Create ChanceCalculationService Orchestrator

## Summary

Create the `ChanceCalculationService` that orchestrates all combat services for complete chance calculation. This service provides a unified API used by both action discovery (for displaying probability percentages) and rule execution (for resolving outcomes).

**Note**: This completes the Phase 5 service layer and provides the integration point for the entire non-deterministic actions system.

## Files to Create

| File | Purpose |
|------|---------|
| `src/combat/services/ChanceCalculationService.js` | Service implementation |
| `tests/unit/combat/services/chanceCalculationService.test.js` | Unit tests |
| `tests/integration/combat/chanceCalculationWorkflow.test.js` | Integration test |

## Files to Modify

| File | Change |
|------|--------|
| `src/combat/index.js` | Export ChanceCalculationService |
| `src/dependencyInjection/tokens/tokens-core.js` | Add ChanceCalculationService token |
| `src/dependencyInjection/registrations/combatRegistrations.js` | Register ChanceCalculationService |
| `src/actions/pipeline/stages/ActionFormattingStage.js` | Refactor: Replace inline `#calculateChance()` with ChanceCalculationService |
| `src/logic/operationHandlers/resolveOutcomeHandler.js` | Refactor: Replace inline orchestration with ChanceCalculationService |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Update ResolveOutcomeHandler DI to use ChanceCalculationService |
| `tests/unit/actions/pipeline/stages/ActionFormattingStage.test.js` | Update mocks for new service dependency |
| `tests/unit/logic/operationHandlers/resolveOutcomeHandler.test.js` | Update mocks for new service dependency |

## Codebase Assessment (Updated)

**Note**: Prior to this implementation, both consumers already had inline orchestration logic:

- **ActionFormattingStage** (lines 316-351): Had `#calculateChance()` method calling `SkillResolverService` + `ProbabilityCalculatorService` directly
- **ResolveOutcomeHandler** (lines 187-224): Orchestrated `SkillResolverService` + `ProbabilityCalculatorService` + `OutcomeDeterminerService` inline

Neither used `ModifierCollectorService`. This ticket consolidates that logic into `ChanceCalculationService` and refactors both consumers to use the new unified API.

## Implementation Details

### ChanceCalculationService.js

```javascript
// src/combat/services/ChanceCalculationService.js

/**
 * @file Orchestrates all combat services for chance calculations
 * @description Unified API for action discovery display and rule execution
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {Object} DisplayResult
 * @property {number} chance - Calculated probability (0-100)
 * @property {string} displayText - Formatted for template (e.g., "55%")
 * @property {Object} breakdown - Detailed calculation breakdown
 */

/**
 * @typedef {Object} OutcomeResult
 * @property {'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE'} outcome
 * @property {number} roll - The d100 roll
 * @property {number} threshold - Success threshold (finalChance)
 * @property {number} margin - Roll - threshold (negative = success)
 * @property {Object} modifiers - Applied modifiers
 * @property {boolean} isCritical - Whether outcome was critical
 */

class ChanceCalculationService {
  #skillResolverService;
  #modifierCollectorService;
  #probabilityCalculatorService;
  #outcomeDeterminerService;
  #entityManager;
  #logger;

  /**
   * @param {Object} deps
   * @param {Object} deps.skillResolverService
   * @param {Object} deps.modifierCollectorService
   * @param {Object} deps.probabilityCalculatorService
   * @param {Object} deps.outcomeDeterminerService
   * @param {Object} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({
    skillResolverService,
    modifierCollectorService,
    probabilityCalculatorService,
    outcomeDeterminerService,
    entityManager,
    logger,
  }) {
    validateDependency(skillResolverService, 'SkillResolverService', logger, {
      requiredMethods: ['getSkillValue'],
    });
    validateDependency(modifierCollectorService, 'ModifierCollectorService', logger, {
      requiredMethods: ['collectModifiers'],
    });
    validateDependency(probabilityCalculatorService, 'ProbabilityCalculatorService', logger, {
      requiredMethods: ['calculate'],
    });
    validateDependency(outcomeDeterminerService, 'OutcomeDeterminerService', logger, {
      requiredMethods: ['determine'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData'],
    });

    this.#skillResolverService = skillResolverService;
    this.#modifierCollectorService = modifierCollectorService;
    this.#probabilityCalculatorService = probabilityCalculatorService;
    this.#outcomeDeterminerService = outcomeDeterminerService;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Calculate chance for action discovery display
   * @param {Object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.targetId] - Target entity ID (for opposed checks)
   * @param {Object} params.actionDef - Action definition with chanceBased config
   * @returns {DisplayResult}
   */
  calculateForDisplay({ actorId, targetId, actionDef }) {
    this.#logger.debug(
      `ChanceCalculationService: Calculating display chance for ${actionDef.id}`
    );

    const chanceBased = actionDef.chanceBased;
    if (!chanceBased?.enabled) {
      return {
        chance: 100,
        displayText: '',
        breakdown: { reason: 'Action is not chance-based' },
      };
    }

    // 1. Resolve skills
    const actorSkill = this.#skillResolverService.getSkillValue(
      actorId,
      chanceBased.actorSkill.component,
      chanceBased.actorSkill.default || 0
    );

    let targetSkillValue = 0;
    if (chanceBased.contestType === 'opposed' && chanceBased.targetSkill && targetId) {
      const targetSkill = this.#skillResolverService.getSkillValue(
        targetId,
        chanceBased.targetSkill.component,
        chanceBased.targetSkill.default || 0
      );
      targetSkillValue = targetSkill.baseValue;
    }

    // 2. Collect modifiers
    const modifierCollection = this.#modifierCollectorService.collectModifiers({
      actorId,
      targetId,
      actionConfig: chanceBased,
    });

    // 3. Calculate probability
    const calculation = this.#probabilityCalculatorService.calculate({
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkillValue,
      difficulty: chanceBased.fixedDifficulty,
      formula: chanceBased.formula || 'ratio',
      modifiers: modifierCollection,
      bounds: chanceBased.bounds || { min: 5, max: 95 },
    });

    const roundedChance = Math.round(calculation.finalChance);

    return {
      chance: roundedChance,
      displayText: `${roundedChance}%`,
      breakdown: {
        actorSkill: actorSkill.baseValue,
        targetSkill: targetSkillValue,
        baseChance: calculation.baseChance,
        finalChance: calculation.finalChance,
        modifiers: modifierCollection.modifiers,
        formula: chanceBased.formula || 'ratio',
      },
    };
  }

  /**
   * Resolve outcome for rule execution
   * @param {Object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.targetId] - Target entity ID (for opposed checks)
   * @param {Object} params.actionDef - Action definition with chanceBased config
   * @returns {OutcomeResult}
   */
  resolveOutcome({ actorId, targetId, actionDef }) {
    this.#logger.debug(
      `ChanceCalculationService: Resolving outcome for ${actionDef.id}`
    );

    const chanceBased = actionDef.chanceBased;
    if (!chanceBased?.enabled) {
      // Non-chance actions always succeed
      return {
        outcome: 'SUCCESS',
        roll: 0,
        threshold: 100,
        margin: -100,
        modifiers: { modifiers: [], totalFlat: 0, totalPercentage: 0 },
        isCritical: false,
      };
    }

    // Calculate chance (reuse display calculation logic)
    const displayResult = this.calculateForDisplay({ actorId, targetId, actionDef });

    // Determine outcome
    const thresholds = chanceBased.outcomes || {
      criticalSuccessThreshold: 5,
      criticalFailureThreshold: 95,
    };

    const outcome = this.#outcomeDeterminerService.determine({
      finalChance: displayResult.chance,
      thresholds,
    });

    return {
      outcome: outcome.outcome,
      roll: outcome.roll,
      threshold: displayResult.chance,
      margin: outcome.margin,
      modifiers: displayResult.breakdown.modifiers || [],
      isCritical: outcome.isCritical,
    };
  }
}

export default ChanceCalculationService;
```

### DI Token Addition

```javascript
// In tokens-core.js, add:
ChanceCalculationService: 'ChanceCalculationService',
```

### Combat Registrations Update

```javascript
// In combatRegistrations.js, add:
import ChanceCalculationService from '../../combat/services/ChanceCalculationService.js';

// In registerCombatServices function, add:
container.register(tokens.ChanceCalculationService, (c) => {
  return new ChanceCalculationService({
    skillResolverService: c.resolve(tokens.SkillResolverService),
    modifierCollectorService: c.resolve(tokens.ModifierCollectorService),
    probabilityCalculatorService: c.resolve(tokens.ProbabilityCalculatorService),
    outcomeDeterminerService: c.resolve(tokens.OutcomeDeterminerService),
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  });
});
```

### index.js Export

```javascript
// In src/combat/index.js, add:
export { default as ChanceCalculationService } from './services/ChanceCalculationService.js';
```

## Service Orchestration Flow

### For Action Discovery (calculateForDisplay)

```
1. Check if action has chanceBased.enabled
2. SkillResolverService → Get actor skill value
3. SkillResolverService → Get target skill value (if opposed)
4. ModifierCollectorService → Collect all applicable modifiers
5. ProbabilityCalculatorService → Calculate final probability
6. Return { chance, displayText, breakdown }
```

### For Rule Execution (resolveOutcome)

```
1. Calculate display chance (reuse above flow)
2. OutcomeDeterminerService → Roll dice and determine outcome
3. Return { outcome, roll, threshold, margin, modifiers, isCritical }
```

## API Summary

| Method | Purpose | Used By |
|--------|---------|---------|
| `calculateForDisplay()` | Calculate chance for UI | ActionFormattingStage |
| `resolveOutcome()` | Resolve outcome for rules | ResolveOutcomeHandler |

## Out of Scope

- **DO NOT** modify SkillResolverService
- **DO NOT** modify ModifierCollectorService
- **DO NOT** modify ProbabilityCalculatorService
- **DO NOT** modify OutcomeDeterminerService
- **DO NOT** implement caching (future optimization)
- **DO NOT** implement modifier condition evaluation (Phase 5 stub)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for service
npm run test:unit -- --testPathPattern="chanceCalculationService"

# Integration test for full workflow
npm run test:integration -- --testPathPattern="chanceCalculationWorkflow"

# Type checking
npm run typecheck

# Lint
npx eslint src/combat/services/ChanceCalculationService.js

# Full test suite (no regressions)
npm run test:ci
```

### Unit Test Requirements

**Test File**: `tests/unit/combat/services/chanceCalculationService.test.js`

Required test cases:

1. **Non-chance action display**
   - Action without chanceBased or enabled: false
   - Returns 100% chance, empty displayText

2. **Basic chance calculation**
   - Actor with skill vs no target
   - Returns calculated percentage

3. **Opposed skill check**
   - Actor skill vs target skill
   - Correctly applies formula

4. **Modifier application**
   - Modifiers collected and applied
   - Affects final probability

5. **Outcome resolution - SUCCESS**
   - Roll under threshold
   - Returns SUCCESS outcome

6. **Outcome resolution - FAILURE**
   - Roll over threshold
   - Returns FAILURE outcome

7. **Outcome resolution - CRITICAL_SUCCESS**
   - Roll <= criticalSuccessThreshold AND success
   - Returns CRITICAL_SUCCESS, isCritical: true

8. **Outcome resolution - FUMBLE**
   - Roll >= criticalFailureThreshold AND failure
   - Returns FUMBLE, isCritical: true

### Integration Test Requirements

**Test File**: `tests/integration/combat/chanceCalculationWorkflow.test.js`

Required test cases:

1. **Full workflow with real services**
   - Create entities with skill components
   - Calculate display chance
   - Verify percentage in expected range

2. **Opposed check end-to-end**
   - Two entities with different skills
   - Verify calculation uses both skills

3. **Outcome resolution end-to-end**
   - Mock random for deterministic testing
   - Verify correct outcome types returned

### Invariants That Must Remain True

- [ ] Service orchestrates, does not duplicate service logic
- [ ] Non-chance actions return SUCCESS without rolling
- [ ] All sub-services called in correct order
- [ ] Breakdown includes all calculation details
- [ ] No side effects on entity state
- [ ] Dependencies properly validated
- [ ] Logging provides useful debug information

## Dependencies

- **Depends on**:
  - NONDETACTSYS-003 (SkillResolverService)
  - NONDETACTSYS-004 (ProbabilityCalculatorService)
  - NONDETACTSYS-005 (OutcomeDeterminerService)
  - NONDETACTSYS-016 (ModifierCollectorService)
- **Blocked by**: All of Phase 1 and NONDETACTSYS-016
- **Blocks**: Nothing (this is the final Phase 5 ticket)

## Reference Files

| File | Purpose |
|------|---------|
| `src/combat/services/SkillResolverService.js` | Sub-service reference |
| `src/combat/services/ModifierCollectorService.js` | Sub-service reference |
| `src/combat/services/ProbabilityCalculatorService.js` | Sub-service reference |
| `src/combat/services/OutcomeDeterminerService.js` | Sub-service reference |
| `src/actions/pipeline/stages/ActionFormattingStage.js` | Consumer reference |
| `src/logic/operationHandlers/resolveOutcomeHandler.js` | Consumer reference |

## Future Enhancements

After Phase 5 completion, the following can be added:

1. **Modifier Conditions**: Evaluate JSON Logic conditions in action modifiers
2. **Buff Integration**: Collect modifiers from `combat:buff` components
3. **Equipment Modifiers**: Collect from equipped items
4. **Environmental Modifiers**: Location-based chance modifiers
5. **Caching**: Cache calculations for repeated queries
6. **Detailed Logging**: Trace full calculation breakdown
