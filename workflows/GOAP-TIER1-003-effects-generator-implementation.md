# GOAP-TIER1-003: Effects Generator Implementation

**Phase:** 1 (Effects Auto-Generation)
**Timeline:** Weeks 3-4 (parallel with GOAP-TIER1-002)
**Status:** Not Started
**Dependencies:** GOAP-TIER1-001 (Schema Design and DI Setup)

## Overview

Implement the EffectsGenerator class that orchestrates the generation of planning effects for all actions in mods. This class uses EffectsAnalyzer to analyze rules and produces planning effects that can be injected into action definitions.

## Objectives

1. Implement EffectsGenerator class
2. Implement mod-level effects generation
3. Implement action-level effects generation
4. Implement effects validation
5. Implement effects injection into action definitions
6. Integrate with action loader

## Technical Details

### 1. EffectsGenerator Class

**File:** `src/goap/generation/effectsGenerator.js`

```javascript
/**
 * @file Effects generator for GOAP planning
 * Generates planning effects for actions by analyzing their rules
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Generates planning effects for actions
 */
class EffectsGenerator {
  #logger;
  #effectsAnalyzer;
  #ruleLoader;
  #actionLoader;
  #schemaValidator;

  /**
   * @param {Object} params - Dependencies
   * @param {Object} params.logger - Logger instance
   * @param {Object} params.effectsAnalyzer - Effects analyzer service
   * @param {Object} params.ruleLoader - Rule loader service
   * @param {Object} params.actionLoader - Action loader service
   * @param {Object} params.schemaValidator - Schema validator service
   */
  constructor({
    logger,
    effectsAnalyzer,
    ruleLoader,
    actionLoader,
    schemaValidator
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(effectsAnalyzer, 'IEffectsAnalyzer', logger, {
      requiredMethods: ['analyzeRule', 'isWorldStateChanging']
    });
    validateDependency(ruleLoader, 'IRuleLoader', logger, {
      requiredMethods: ['getRule', 'getRules']
    });
    validateDependency(actionLoader, 'IActionLoader', logger, {
      requiredMethods: ['getAction', 'getActions']
    });
    validateDependency(schemaValidator, 'IAjvSchemaValidator', logger, {
      requiredMethods: ['validate']
    });

    this.#logger = logger;
    this.#effectsAnalyzer = effectsAnalyzer;
    this.#ruleLoader = ruleLoader;
    this.#actionLoader = actionLoader;
    this.#schemaValidator = schemaValidator;
  }

  /**
   * Generates planning effects for all actions in a mod
   * @param {string} modId - Mod identifier
   * @returns {Promise<Map<string, Object>>} Map of actionId -> effects
   */
  async generateForMod(modId) {
    string.assertNonBlank(modId, 'modId', 'generateForMod', this.#logger);

    this.#logger.info(`Generating effects for mod: ${modId}`);

    try {
      const actions = await this.#actionLoader.getActions(modId);
      const effectsMap = new Map();
      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      for (const action of actions) {
        try {
          const effects = await this.generateForAction(action.id);

          if (effects && effects.effects.length > 0) {
            effectsMap.set(action.id, effects);
            successCount++;
            this.#logger.debug(`✓ ${action.id} - ${effects.effects.length} effects`);
          } else {
            skippedCount++;
            this.#logger.debug(`⊘ ${action.id} - No state-changing effects`);
          }
        } catch (error) {
          failureCount++;
          this.#logger.error(`✗ ${action.id} - Failed to generate effects`, error);
        }
      }

      this.#logger.info(
        `Effects generation complete for ${modId}: ` +
        `${successCount} success, ${skippedCount} skipped, ${failureCount} failed`
      );

      return effectsMap;
    } catch (error) {
      this.#logger.error(`Failed to generate effects for mod ${modId}`, error);
      throw error;
    }
  }

  /**
   * Generates planning effects for a specific action
   * @param {string} actionId - Full action ID (mod:action)
   * @returns {Promise<Object>} Planning effects
   */
  async generateForAction(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'generateForAction', this.#logger);

    this.#logger.debug(`Generating effects for action: ${actionId}`);

    try {
      // Step 1: Get action definition
      const action = await this.#actionLoader.getAction(actionId);
      if (!action) {
        throw new Error(`Action not found: ${actionId}`);
      }

      // Step 2: Find corresponding rule(s)
      const rules = await this.#findRulesForAction(actionId);
      if (rules.length === 0) {
        this.#logger.warn(`No rules found for action: ${actionId}`);
        return null;
      }

      // Step 3: Analyze each rule
      const allEffects = [];
      const allPreconditions = {};

      for (const rule of rules) {
        try {
          const analyzed = this.#effectsAnalyzer.analyzeRule(rule);

          // Merge effects
          allEffects.push(...analyzed.effects);

          // Merge abstract preconditions
          if (analyzed.abstractPreconditions) {
            Object.assign(allPreconditions, analyzed.abstractPreconditions);
          }
        } catch (error) {
          this.#logger.error(`Failed to analyze rule ${rule.id}`, error);
          throw error;
        }
      }

      // Step 4: Build planning effects object
      const planningEffects = {
        effects: allEffects,
        cost: 1.0
      };

      if (Object.keys(allPreconditions).length > 0) {
        planningEffects.abstractPreconditions = allPreconditions;
      }

      // Step 5: Validate against schema
      const validation = this.validateEffects(actionId, planningEffects);
      if (!validation.valid) {
        this.#logger.error(
          `Generated effects for ${actionId} failed schema validation`,
          validation.errors
        );
        throw new Error(`Invalid planning effects for ${actionId}`);
      }

      return planningEffects;
    } catch (error) {
      this.#logger.error(`Failed to generate effects for action ${actionId}`, error);
      throw error;
    }
  }

  /**
   * Validates generated effects against action
   * @param {string} actionId - Full action ID
   * @param {Object} effects - Generated effects
   * @returns {Object} Validation result with warnings/errors
   */
  validateEffects(actionId, effects) {
    string.assertNonBlank(actionId, 'actionId', 'validateEffects', this.#logger);
    assertPresent(effects, 'Effects are required');

    const result = {
      valid: true,
      warnings: [],
      errors: []
    };

    try {
      // Validate against schema
      const schemaValidation = this.#schemaValidator.validate(
        effects,
        'schema://living-narrative-engine/planning-effects.schema.json'
      );

      if (!schemaValidation.valid) {
        result.valid = false;
        result.errors.push({
          type: 'schema',
          message: 'Effects do not match schema',
          details: schemaValidation.errors
        });
      }

      // Validate effect count
      if (effects.effects.length === 0) {
        result.warnings.push({
          type: 'empty',
          message: 'No effects generated'
        });
      }

      // Validate component references
      for (const effect of effects.effects) {
        if (effect.component) {
          const [modId, componentId] = effect.component.split(':');
          if (!modId || !componentId) {
            result.errors.push({
              type: 'invalid_component',
              message: `Invalid component reference: ${effect.component}`,
              effect
            });
            result.valid = false;
          }
        }
      }

      // Validate abstract preconditions
      if (effects.abstractPreconditions) {
        for (const [name, precondition] of Object.entries(effects.abstractPreconditions)) {
          if (!precondition.description || !precondition.parameters || !precondition.simulationFunction) {
            result.errors.push({
              type: 'invalid_precondition',
              message: `Invalid abstract precondition: ${name}`,
              precondition
            });
            result.valid = false;
          }
        }
      }

      return result;
    } catch (error) {
      this.#logger.error(`Failed to validate effects for ${actionId}`, error);
      return {
        valid: false,
        warnings: [],
        errors: [{ type: 'exception', message: error.message }]
      };
    }
  }

  /**
   * Injects planning effects into action definitions
   * @param {Map<string, Object>} effectsMap - Map of actionId -> effects
   * @returns {Promise<number>} Number of actions updated
   */
  async injectEffects(effectsMap) {
    assertPresent(effectsMap, 'Effects map is required');

    this.#logger.info(`Injecting effects into ${effectsMap.size} actions`);

    let updateCount = 0;

    for (const [actionId, effects] of effectsMap.entries()) {
      try {
        const action = await this.#actionLoader.getAction(actionId);
        if (!action) {
          this.#logger.warn(`Action not found for injection: ${actionId}`);
          continue;
        }

        // Add planningEffects to action
        action.planningEffects = effects;

        // Note: In a real implementation, this would write back to file
        // For now, we'll just update the in-memory representation
        this.#logger.debug(`Injected effects into ${actionId}`);
        updateCount++;
      } catch (error) {
        this.#logger.error(`Failed to inject effects for ${actionId}`, error);
      }
    }

    this.#logger.info(`Injected effects into ${updateCount} actions`);
    return updateCount;
  }

  // Private helper methods

  /**
   * Finds rules associated with an action
   * @param {string} actionId - Full action ID
   * @returns {Promise<Array<Object>>} List of rules
   * @private
   */
  async #findRulesForAction(actionId) {
    // Rules are typically named: handle_<action_name>
    // Example: positioning:sit_down -> positioning:handle_sit_down

    const [modId, actionName] = actionId.split(':');
    const ruleId = `${modId}:handle_${actionName}`;

    try {
      const rule = await this.#ruleLoader.getRule(ruleId);
      return rule ? [rule] : [];
    } catch (error) {
      // Rule not found with standard naming, try alternative patterns
      this.#logger.debug(`Rule not found with standard naming: ${ruleId}`);

      // Try finding rules that reference this action in their event conditions
      const allRules = await this.#ruleLoader.getRules(modId);
      const matchingRules = allRules.filter(rule =>
        this.#ruleReferencesAction(rule, actionId)
      );

      return matchingRules;
    }
  }

  /**
   * Checks if a rule references an action
   * @param {Object} rule - Rule definition
   * @param {string} actionId - Action ID to check
   * @returns {boolean} True if rule references action
   * @private
   */
  #ruleReferencesAction(rule, actionId) {
    // Check event conditions for action reference
    if (rule.event && rule.event.type === 'ACTION_DECIDED') {
      const actionCondition = rule.conditions?.find(
        cond => cond.type === 'event-is-action' && cond.actionId === actionId
      );
      return !!actionCondition;
    }

    return false;
  }
}

export default EffectsGenerator;
```

## Files to Create

- [ ] `src/goap/generation/effectsGenerator.js`

## Testing Requirements

### Unit Tests

**File:** `tests/unit/goap/generation/effectsGenerator.test.js`

Test Coverage:
- Generate effects for single action
- Generate effects for entire mod
- Handle actions with no rules
- Handle actions with multiple rules
- Effect validation (valid effects)
- Effect validation (invalid effects)
- Effect injection into actions
- Error handling for missing actions
- Error handling for invalid rules

**File:** `tests/unit/goap/generation/effectsGenerator.validation.test.js`

Validation Tests:
- Schema validation success
- Schema validation failure
- Component reference validation
- Abstract precondition validation
- Empty effects warning
- Multiple validation errors

**Coverage Target:** 90% branches, 95% functions/lines

### Integration Tests

**File:** `tests/integration/goap/effectsGeneration.integration.test.js`

- Generate effects for positioning mod
- Generate effects for items mod
- Generate effects for core mod
- Validate all generated effects
- Test effects match rule operations
- Test with real action/rule data

## Documentation Requirements

- [ ] JSDoc comments for all public methods
- [ ] JSDoc comments for all private methods
- [ ] Code examples in comments
- [ ] Create `docs/goap/effects-generator-usage.md` with:
  - How to generate effects for a mod
  - How to generate effects for an action
  - How to validate generated effects
  - How to inject effects into actions
  - Troubleshooting guide

## Acceptance Criteria

- [ ] EffectsGenerator class implemented with all methods
- [ ] Generates effects for single action
- [ ] Generates effects for entire mod
- [ ] Validates effects against schema
- [ ] Handles missing rules gracefully
- [ ] Handles multiple rules per action
- [ ] Injects effects into action definitions
- [ ] Provides detailed validation feedback
- [ ] All unit tests pass with 90%+ coverage
- [ ] All integration tests pass
- [ ] ESLint passes
- [ ] TypeScript type checking passes
- [ ] Documentation complete

## Success Metrics

- ✅ Successfully generates effects for 100+ actions
- ✅ Validation catches invalid effects
- ✅ Handles edge cases gracefully
- ✅ Clear error messages for debugging
- ✅ Integration with action loader works

## Notes

- **Rule Discovery:** May need to refine rule-finding heuristics
- **Multiple Rules:** Some actions may have multiple rules (success/failure paths)
- **Effect Merging:** When multiple rules exist, merge their effects intelligently
- **Validation:** Should provide actionable feedback for fixing issues

## Related Tickets

- Depends on: GOAP-TIER1-001 (Schema Design and DI Setup)
- Works with: GOAP-TIER1-002 (Effects Analyzer Implementation)
- Blocks: GOAP-TIER1-004 (Content Generation and Validation Tools)
