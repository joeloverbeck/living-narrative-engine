# NONDETACTSYS-016: Create ModifierCollectorService

## Summary

Create the `ModifierCollectorService` that collects and aggregates applicable modifiers from entity buffs, equipment, and environment. This service is used by the `ChanceCalculationService` to apply situational modifiers to probability calculations.

**Note**: This is a Phase 5 enhancement ticket. The core system works without modifiers (Phase 1-4). This adds the infrastructure for future modifier-based gameplay.

## Files to Create

| File | Purpose |
|------|---------|
| `src/combat/services/ModifierCollectorService.js` | Service implementation |
| `tests/unit/combat/services/modifierCollectorService.test.js` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/combat/index.js` | Export ModifierCollectorService |
| `src/dependencyInjection/tokens/tokens-core.js` | Add ModifierCollectorService token |
| `src/dependencyInjection/registrations/combatRegistrations.js` | Register ModifierCollectorService |

## Implementation Details

### ModifierCollectorService.js

```javascript
// src/combat/services/ModifierCollectorService.js

/**
 * @file Collects and aggregates modifiers for probability calculations
 * @description Gathers applicable modifiers from buffs, equipment, and environment
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {Object} Modifier
 * @property {string} id - Unique modifier identifier
 * @property {string} source - Where modifier comes from (buff, equipment, environment)
 * @property {number} value - Modifier value (positive or negative)
 * @property {'flat' | 'percentage'} type - How modifier is applied
 * @property {string} description - Human-readable description
 * @property {string} [stackId] - Optional stacking group (same stackId = only highest)
 */

/**
 * @typedef {Object} ModifierCollection
 * @property {Modifier[]} modifiers - All collected modifiers
 * @property {number} totalFlat - Sum of flat modifiers
 * @property {number} totalPercentage - Total percentage modifier (multiplicative)
 */

class ModifierCollectorService {
  #entityManager;
  #logger;

  /**
   * @param {Object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Collects all applicable modifiers for a chance calculation
   * @param {Object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.targetId] - Target entity ID (for opposed checks)
   * @param {string} [params.locationId] - Location ID (for environmental modifiers)
   * @param {Object} [params.actionConfig] - Action's chanceBased configuration
   * @returns {ModifierCollection}
   */
  collectModifiers({ actorId, targetId, locationId, actionConfig }) {
    this.#logger.debug(
      `ModifierCollectorService: Collecting modifiers for actor=${actorId}, target=${targetId}`
    );

    /** @type {Modifier[]} */
    const allModifiers = [];

    // Phase 5 stub: Collect from action definition's static modifiers
    if (actionConfig?.modifiers) {
      const actionModifiers = this.#collectActionModifiers(
        actorId,
        targetId,
        actionConfig.modifiers
      );
      allModifiers.push(...actionModifiers);
    }

    // Future: Collect from buff components
    // Future: Collect from equipment components
    // Future: Collect from environment

    // Apply stacking rules
    const stackedModifiers = this.#applyStackingRules(allModifiers);

    // Calculate totals
    const totals = this.#calculateTotals(stackedModifiers);

    this.#logger.debug(
      `ModifierCollectorService: Found ${stackedModifiers.length} modifiers, ` +
        `flat=${totals.totalFlat}, percentage=${totals.totalPercentage}`
    );

    return {
      modifiers: stackedModifiers,
      totalFlat: totals.totalFlat,
      totalPercentage: totals.totalPercentage,
    };
  }

  /**
   * Collects modifiers defined in action configuration
   * @private
   */
  #collectActionModifiers(actorId, targetId, modifierConfigs) {
    // In Phase 5, this evaluates JSON Logic conditions on each modifier
    // For now, return empty array as conditions are not evaluated yet
    return [];
  }

  /**
   * Applies stacking rules - same stackId uses highest value only
   * @private
   * @param {Modifier[]} modifiers
   * @returns {Modifier[]}
   */
  #applyStackingRules(modifiers) {
    const stackGroups = new Map();
    const unstackedModifiers = [];

    for (const mod of modifiers) {
      if (mod.stackId) {
        const existing = stackGroups.get(mod.stackId);
        if (!existing || Math.abs(mod.value) > Math.abs(existing.value)) {
          stackGroups.set(mod.stackId, mod);
        }
      } else {
        unstackedModifiers.push(mod);
      }
    }

    return [...unstackedModifiers, ...stackGroups.values()];
  }

  /**
   * Calculates total flat and percentage modifiers
   * @private
   * @param {Modifier[]} modifiers
   * @returns {{ totalFlat: number, totalPercentage: number }}
   */
  #calculateTotals(modifiers) {
    let totalFlat = 0;
    let totalPercentage = 0;

    for (const mod of modifiers) {
      if (mod.type === 'flat') {
        totalFlat += mod.value;
      } else if (mod.type === 'percentage') {
        // Percentage modifiers stack additively
        totalPercentage += mod.value;
      }
    }

    return { totalFlat, totalPercentage };
  }
}

export default ModifierCollectorService;
```

### DI Token Addition

```javascript
// In tokens-core.js, add:
ModifierCollectorService: 'ModifierCollectorService',
```

### Combat Registrations Update

```javascript
// In combatRegistrations.js, add:
import ModifierCollectorService from '../../combat/services/ModifierCollectorService.js';

// In registerCombatServices function, add:
container.register(tokens.ModifierCollectorService, (c) => {
  return new ModifierCollectorService({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  });
});
```

### index.js Export

```javascript
// In src/combat/index.js, add:
export { default as ModifierCollectorService } from './services/ModifierCollectorService.js';
```

## Modifier Stacking Rules

The service implements the following stacking rules from the spec:

| Rule | Behavior |
|------|----------|
| Flat modifiers | Sum all applicable values |
| Percentage modifiers | Add percentages together (applied after flat) |
| Same stackId | Only highest absolute value modifier applies |

## Out of Scope

- **DO NOT** implement buff component collection (future enhancement)
- **DO NOT** implement equipment modifier collection (future enhancement)
- **DO NOT** implement environmental modifiers (future enhancement)
- **DO NOT** implement JSON Logic condition evaluation (requires integration work)
- **DO NOT** modify action definitions
- **DO NOT** create integration tests (unit tests sufficient for Phase 5 stub)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for service
npm run test:unit -- --testPathPattern="modifierCollectorService"

# Type checking
npm run typecheck

# Lint
npx eslint src/combat/services/ModifierCollectorService.js

# Full test suite (no regressions)
npm run test:ci
```

### Unit Test Requirements

**Test File**: `tests/unit/combat/services/modifierCollectorService.test.js`

Required test cases:

1. **Empty modifiers**
   - No modifiers configured
   - Returns empty collection with zero totals

2. **Flat modifier totals**
   - Multiple flat modifiers
   - Correctly sums values

3. **Percentage modifier totals**
   - Multiple percentage modifiers
   - Correctly sums percentages

4. **Stacking rules**
   - Multiple modifiers with same stackId
   - Only highest absolute value kept

5. **Mixed modifier types**
   - Both flat and percentage modifiers
   - Correctly separates totals

6. **Negative modifiers**
   - Negative values for penalties
   - Correctly handled in totals

### Invariants That Must Remain True

- [ ] Service has no side effects on entity state
- [ ] Empty input returns valid ModifierCollection
- [ ] Stacking rules follow spec (highest absolute value wins)
- [ ] All dependencies properly validated
- [ ] Logging includes useful debug information
- [ ] No circular dependencies introduced

## Dependencies

- **Depends on**:
  - NONDETACTSYS-008 (combatRegistrations.js exists)
- **Blocked by**: NONDETACTSYS-008
- **Blocks**: NONDETACTSYS-017 (ChanceCalculationService needs this)

## Reference Files

| File | Purpose |
|------|---------|
| `src/combat/services/SkillResolverService.js` | Service pattern reference |
| `src/combat/services/ProbabilityCalculatorService.js` | Service pattern reference |
| `tests/unit/combat/services/skillResolverService.test.js` | Test pattern reference |
