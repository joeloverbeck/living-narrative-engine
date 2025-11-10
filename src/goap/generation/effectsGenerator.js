/**
 * @file Effects generator for GOAP planning
 * Generates planning effects for actions by analyzing their rules
 */

import { validateDependency, assertPresent } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Generates planning effects for actions.
 *
 * Orchestrates the generation of planning effects for all actions in mods by analyzing their rules.
 */
class EffectsGenerator {
  #logger;
  #effectsAnalyzer;
  #dataRegistry;
  #schemaValidator;

  /**
   * Creates a new EffectsGenerator instance.
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   * @param {object} params.effectsAnalyzer - Effects analyzer service
   * @param {object} params.dataRegistry - Data registry for accessing rules and actions
   * @param {object} params.schemaValidator - Schema validator service
   */
  constructor({
    logger,
    effectsAnalyzer,
    dataRegistry,
    schemaValidator
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(effectsAnalyzer, 'IEffectsAnalyzer', logger, {
      requiredMethods: ['analyzeRule', 'isWorldStateChanging']
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll']
    });
    validateDependency(schemaValidator, 'IAjvSchemaValidator', logger, {
      requiredMethods: ['validate']
    });

    this.#logger = logger;
    this.#effectsAnalyzer = effectsAnalyzer;
    this.#dataRegistry = dataRegistry;
    this.#schemaValidator = schemaValidator;
  }

  /**
   * Generates planning effects for all actions in a mod
   *
   * @param {string} modId - Mod identifier
   * @returns {Map<string, object>} Map of actionId -> effects
   */
  generateForMod(modId) {
    string.assertNonBlank(modId, 'modId', 'generateForMod', this.#logger);

    this.#logger.info(`Generating effects for mod: ${modId}`);

    try {
      // Get all actions and filter by modId
      const allActions = this.#dataRegistry.getAll('actions');
      const actions = allActions.filter(action => action.id?.startsWith(`${modId}:`));
      const effectsMap = new Map();
      let successCount = 0;
      let failureCount = 0;
      let skippedCount = 0;

      for (const action of actions) {
        try {
          const effects = this.generateForAction(action.id);

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
   *
   * @param {string} actionId - Full action ID (mod:action)
   * @returns {object | null} Planning effects
   */
  generateForAction(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'generateForAction', this.#logger);

    this.#logger.debug(`Generating effects for action: ${actionId}`);

    try {
      // Step 1: Get action definition
      const action = this.#dataRegistry.get('actions', actionId);
      if (!action) {
        throw new Error(`Action not found: ${actionId}`);
      }

      // Step 2: Find corresponding rule(s)
      const rules = this.#findRulesForAction(actionId);
      if (rules.length === 0) {
        this.#logger.warn(`No rules found for action: ${actionId}`);
        return null;
      }

      // Step 3: Analyze each rule
      const allEffects = [];
      const allPreconditions = {};
      let totalCost = 1.0;

      for (const rule of rules) {
        try {
          // Note: analyzeRule takes ruleId (string), not rule object
          const analyzed = this.#effectsAnalyzer.analyzeRule(rule.id);

          // Merge effects
          allEffects.push(...analyzed.effects);

          // Merge abstract preconditions
          if (analyzed.abstractPreconditions) {
            Object.assign(allPreconditions, analyzed.abstractPreconditions);
          }

          // Use the cost from the first rule (or could average/sum multiple rules)
          if (analyzed.cost !== undefined) {
            totalCost = analyzed.cost;
          }
        } catch (error) {
          this.#logger.error(`Failed to analyze rule ${rule.id}`, error);
          throw error;
        }
      }

      // Step 4: Build planning effects object
      const planningEffects = {
        effects: allEffects,
        cost: totalCost
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
   *
   * @param {string} actionId - Full action ID
   * @param {object} effects - Generated effects
   * @returns {object} Validation result with warnings/errors
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
      // Note: validate signature is validate(schemaId, data)
      const schemaValidation = this.#schemaValidator.validate(
        'schema://living-narrative-engine/planning-effects.schema.json',
        effects
      );

      // Note: schemaValidator returns { isValid, errors }
      if (!schemaValidation.isValid) {
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
   *
   * @param {Map<string, object>} effectsMap - Map of actionId -> effects
   * @returns {number} Number of actions updated
   */
  injectEffects(effectsMap) {
    assertPresent(effectsMap, 'Effects map is required');

    this.#logger.info(`Injecting effects into ${effectsMap.size} actions`);

    let updateCount = 0;

    for (const [actionId, effects] of effectsMap.entries()) {
      try {
        const action = this.#dataRegistry.get('actions', actionId);
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
   *
   * @param {string} actionId - Full action ID
   * @returns {Array<object>} List of rules
   * @private
   */
  #findRulesForAction(actionId) {
    // Rules are typically named: handle_<action_name>
    // Example: positioning:sit_down -> positioning:handle_sit_down

    const [modId, actionName] = actionId.split(':');
    const ruleId = `${modId}:handle_${actionName}`;

    // Try to get rule with standard naming convention
    const rule = this.#dataRegistry.get('rules', ruleId);
    if (rule) {
      return [rule];
    }

    // Rule not found with standard naming, try alternative patterns
    this.#logger.debug(`Rule not found with standard naming: ${ruleId}`);

    // Try finding rules that reference this action in their event conditions
    const allRules = this.#dataRegistry.getAll('rules');
    const matchingRules = allRules.filter(r =>
      r.id?.startsWith(`${modId}:`) && this.#ruleReferencesAction(r, actionId)
    );

    return matchingRules;
  }

  /**
   * Checks if a rule references an action
   *
   * @param {object} rule - Rule definition
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
