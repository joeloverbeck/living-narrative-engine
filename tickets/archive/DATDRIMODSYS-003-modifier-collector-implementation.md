# DATDRIMODSYS-003: Implement ModifierCollectorService JSON Logic Evaluation

## Summary

Implement the `#collectActionModifiers()` method in `ModifierCollectorService.js` to evaluate JSON Logic conditions on each modifier and return active modifiers with their tags. This replaces the current stub that returns an empty array.

## File List

Files to modify:

- `src/combat/services/ModifierCollectorService.js` (implement `#collectActionModifiers`)
- `src/dependencyInjection/registrations/combatRegistrations.js` (add ModifierContextBuilder dependency)
- `src/combat/services/ChanceCalculationService.js` (update call site to use new parameter names)

## Out of Scope

- **DO NOT** modify `ModifierContextBuilder.js` (that's DATDRIMODSYS-002)
- **DO NOT** modify any schema files (that's DATDRIMODSYS-001)
- **DO NOT** modify `MultiTargetActionFormatter.js` (that's DATDRIMODSYS-005)
- **DO NOT** add integration tests (that's DATDRIMODSYS-007)
- **DO NOT** modify any action JSON files

## Assumptions Validated Against Codebase

1. **ModifierContextBuilder exists** ✅ - Created in DATDRIMODSYS-002
2. **ModifierContextBuilder NOT injected into ModifierCollectorService** ✅ - Needs to be added
3. **Schema already updated** ✅ - `chanceModifier` has `tag`, `type`, `value`, `targetRole`, `stackId`
4. **Current public API uses `targetId`** - Will be replaced with `primaryTargetId` (breaking change acceptable per user)

## Detailed Implementation

### 1. Update `ModifierCollectorService.js`

#### Add Import

```javascript
// At top of file, add import for JSON Logic (same pattern as contextAssembler.js)
import jsonLogic from 'json-logic-js';
```

#### Add Private Field

```javascript
#modifierContextBuilder;
```

#### Update Constructor

```javascript
/**
 * @param {object} deps
 * @param {IEntityManager} deps.entityManager
 * @param {import('./ModifierContextBuilder.js').default} deps.modifierContextBuilder
 * @param {ILogger} deps.logger
 */
constructor({ entityManager, modifierContextBuilder, logger }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'warn', 'error', 'info'],
  });
  validateDependency(entityManager, 'IEntityManager', logger, {
    requiredMethods: ['getComponentData', 'hasComponent'],
  });
  validateDependency(modifierContextBuilder, 'ModifierContextBuilder', logger, {
    requiredMethods: ['buildContext'],
  });

  this.#entityManager = entityManager;
  this.#modifierContextBuilder = modifierContextBuilder;
  this.#logger = logger;

  this.#logger.debug('ModifierCollectorService: Initialized');
}
```

#### Update `collectModifiers` to Pass Target IDs

The public method signature needs to accept secondary/tertiary targets:

```javascript
/**
 * Collects all applicable modifiers for a chance calculation
 *
 * @param {object} params
 * @param {string} params.actorId - Actor entity ID
 * @param {string} [params.primaryTargetId] - Primary target entity ID
 * @param {string} [params.secondaryTargetId] - Secondary target entity ID
 * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
 * @param {object} [params.actionConfig] - Action's chanceBased configuration
 * @returns {ModifierCollection}
 */
collectModifiers({ actorId, primaryTargetId, secondaryTargetId, tertiaryTargetId, actionConfig }) {
  this.#logger.debug(
    `ModifierCollectorService: Collecting modifiers for actor=${actorId}, primary=${primaryTargetId}`
  );

  /** @type {Modifier[]} */
  const allModifiers = [];

  // Collect from action definition's static modifiers
  if (actionConfig?.modifiers) {
    const actionModifiers = this.#collectActionModifiers({
      actorId,
      primaryTargetId,
      secondaryTargetId,
      tertiaryTargetId,
      modifierConfigs: actionConfig.modifiers,
    });
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
```

#### Implement `#collectActionModifiers`

Replace the stub with actual implementation:

```javascript
/**
 * Collects modifiers defined in action configuration by evaluating JSON Logic conditions
 *
 * @private
 * @param {object} params
 * @param {string} params.actorId - Actor entity ID
 * @param {string} [params.primaryTargetId] - Primary target entity ID
 * @param {string} [params.secondaryTargetId] - Secondary target entity ID
 * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
 * @param {Array<object>} params.modifierConfigs - Modifier configurations from action
 * @returns {Modifier[]}
 */
#collectActionModifiers({ actorId, primaryTargetId, secondaryTargetId, tertiaryTargetId, modifierConfigs }) {
  if (!modifierConfigs || modifierConfigs.length === 0) {
    return [];
  }

  // Build context for JSON Logic evaluation
  const context = this.#modifierContextBuilder.buildContext({
    actorId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
  });

  /** @type {Modifier[]} */
  const activeModifiers = [];

  for (const config of modifierConfigs) {
    try {
      // Evaluate the JSON Logic condition
      const conditionResult = this.#evaluateCondition(config.condition, context);

      if (conditionResult) {
        // Modifier is active - build the Modifier object
        const modifier = this.#buildModifierFromConfig(config);
        activeModifiers.push(modifier);

        this.#logger.debug(
          `ModifierCollectorService: Modifier active - tag="${modifier.tag}", ` +
            `type=${modifier.type}, value=${modifier.value}`
        );
      }
    } catch (error) {
      this.#logger.warn(
        `ModifierCollectorService: Error evaluating modifier condition`,
        { description: config.description, error: error.message }
      );
      // Continue processing other modifiers
    }
  }

  return activeModifiers;
}

/**
 * Evaluates a JSON Logic condition against the context
 *
 * @private
 * @param {object} condition - The condition object (may be a condition_ref or inline logic)
 * @param {object} context - The evaluation context from ModifierContextBuilder
 * @returns {boolean}
 */
#evaluateCondition(condition, context) {
  if (!condition) {
    // No condition means always active
    return true;
  }

  // Handle condition_ref (reference to external condition file)
  // Note: In the future, this should resolve condition_ref to actual logic
  // For now, we only support inline JSON Logic
  if (condition.condition_ref) {
    this.#logger.debug(
      `ModifierCollectorService: condition_ref not yet supported, skipping: ${condition.condition_ref}`
    );
    return false;
  }

  // Handle inline JSON Logic
  if (condition.logic) {
    return jsonLogic.apply(condition.logic, context);
  }

  // Direct JSON Logic object
  return jsonLogic.apply(condition, context);
}

/**
 * Builds a Modifier object from configuration
 *
 * @private
 * @param {object} config - Modifier configuration from action
 * @returns {Modifier}
 */
#buildModifierFromConfig(config) {
  // Support both new format (value + type) and legacy format (modifier)
  let type = config.type || 'flat';
  let value;

  if (config.value !== undefined) {
    value = config.value;
  } else if (config.modifier !== undefined) {
    // Legacy format - modifier is always flat
    value = config.modifier;
    type = 'flat';
  } else {
    value = 0;
  }

  return {
    type,
    value,
    tag: config.tag || null,
    description: config.description || null,
    stackId: config.stackId || null,
    targetRole: config.targetRole || null,
  };
}
```

### 2. Update `combatRegistrations.js`

Update the ModifierCollectorService registration to inject ModifierContextBuilder:

```javascript
// Update existing registration
registrar.singletonFactory(
  tokens.ModifierCollectorService,
  (c) =>
    new ModifierCollectorService({
      entityManager: c.resolve(tokens.IEntityManager),
      modifierContextBuilder: c.resolve(tokens.ModifierContextBuilder),
      logger: c.resolve(tokens.ILogger),
    })
);
```

### 3. Update `ChanceCalculationService.js` (call site only)

Update the `collectModifiers` call to use the new parameter name:

```javascript
// In calculateForDisplay method, change:
const modifierCollection = this.#modifierCollectorService.collectModifiers({
  actorId,
  targetId, // OLD
  actionConfig: chanceBased,
});

// To:
const modifierCollection = this.#modifierCollectorService.collectModifiers({
  actorId,
  primaryTargetId: targetId, // NEW - map targetId to primaryTargetId
  actionConfig: chanceBased,
});
```

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (create in this ticket):
   - File: `tests/unit/combat/services/ModifierCollectorService.test.js`
   - Update/add test cases:
     - `should initialize with valid dependencies including modifierContextBuilder`
     - `should return empty array when no modifiers configured`
     - `should evaluate inline JSON Logic conditions`
     - `should return active modifiers when conditions are true`
     - `should skip modifiers when conditions are false`
     - `should handle legacy modifier format (integer)`
     - `should handle new value+type format`
     - `should log warning on condition evaluation error and continue`
     - `should build modifier with correct type defaults`
     - `should pass all target IDs to context builder`

2. **Existing Tests**:
   - `npm run test:unit -- --testPathPattern="combat" --silent` must pass
   - `npm run typecheck` must pass

### Invariants That Must Remain True

1. **Backward Compatibility**:
   - Legacy `modifier` field (integer) must continue to work
   - Empty modifiers array must return empty collection
   - Stacking rules must continue to apply correctly

2. **Graceful Degradation**:
   - Invalid conditions must not crash - log warning and skip
   - Missing condition means always active (returns true)
   - condition_ref not yet supported - log and skip

3. **No Side Effects**:
   - Condition evaluation must NOT modify entity data
   - Condition evaluation must NOT dispatch events

4. **Type Safety**:
   - All Modifier objects must have valid `type` ('flat' or 'percentage')
   - All Modifier objects must have numeric `value`

## Verification Commands

```bash
# Run unit tests for combat services
npm run test:unit -- --testPathPattern="combat/services" --silent

# Check types
npm run typecheck

# Lint modified files
npx eslint src/combat/services/ModifierCollectorService.js src/dependencyInjection/registrations/combatRegistrations.js
```

## Dependencies

- **Depends on**: DATDRIMODSYS-002 (ModifierContextBuilder must exist)
- **Blocks**: DATDRIMODSYS-004 (ChanceCalculationService needs this to work)

## Notes

- The `condition_ref` pattern is acknowledged but deferred - only inline JSON Logic is supported initially
- The `#evaluateCondition` method handles both `condition.logic` wrapper and direct JSON Logic objects
- Future tickets may need to add condition_ref resolution via ConditionLoader
- The `totalPercentage` calculation starts at 1 (identity) and percentage modifiers are additive

---

## Outcome

**Status**: ✅ COMPLETED (2025-12-05)

### Changes Made

1. **`src/combat/services/ModifierCollectorService.js`**:
   - Added `jsonLogic` import from `json-logic-js`
   - Added `#modifierContextBuilder` private field
   - Updated constructor to accept and validate `modifierContextBuilder` dependency
   - Changed public API from `targetId` to `primaryTargetId`, `secondaryTargetId`, `tertiaryTargetId`
   - Implemented `#collectActionModifiers()` with full JSON Logic condition evaluation
   - Implemented `#evaluateCondition()` supporting inline JSON Logic and `condition.logic` wrapper
   - Implemented `#buildModifierFromConfig()` supporting both new `value`+`type` format and legacy `modifier` format

2. **`src/dependencyInjection/registrations/combatRegistrations.js`**:
   - Added `modifierContextBuilder` injection to `ModifierCollectorService` factory

3. **`src/combat/services/ChanceCalculationService.js`**:
   - Updated call site to use `primaryTargetId: targetId` parameter mapping

4. **`tests/unit/combat/services/ModifierCollectorService.test.js`**:
   - Comprehensive rewrite with 40 test cases covering:
     - Constructor validation (10 tests)
     - Empty modifiers handling (4 tests)
     - Logging behavior (3 tests)
     - JSON Logic condition evaluation (6 tests)
     - Modifier format handling (5 tests)
     - Error handling (1 test)
     - Context builder integration (1 test)
     - Stacking rules (2 tests)
     - Calculate totals (4 tests)
     - Optional parameters (1 test)
     - Invariants (3 tests)

5. **`tests/unit/combat/services/ChanceCalculationService.test.js`**:
   - Updated test expectations from `targetId` to `primaryTargetId`

### Test Results

- All 239 combat service tests pass
- ModifierCollectorService: 40 tests passing
- ChanceCalculationService: 45 tests passing
- No ESLint errors in modified files

### Breaking Changes

- **API Change**: `collectModifiers({ targetId })` → `collectModifiers({ primaryTargetId })`
- User confirmed this is acceptable as modifier functionality was never used (stub returned empty array)
