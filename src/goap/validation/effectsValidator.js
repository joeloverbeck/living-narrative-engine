/**
 * @file Effects validator for GOAP planning
 * Validates consistency between effects and rules
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

class EffectsValidator {
  #logger;
  #effectsAnalyzer;
  #dataRegistry;

  constructor({ logger, effectsAnalyzer, dataRegistry }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });
    validateDependency(effectsAnalyzer, 'IEffectsAnalyzer', logger, {
      requiredMethods: ['analyzeRule']
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll']
    });

    this.#logger = logger;
    this.#effectsAnalyzer = effectsAnalyzer;
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Validates all actions across all mods
   *
   * @returns {Promise<object>} Validation results
   */
  async validateAllMods() {
    const results = {
      actions: [],
      summary: {
        total: 0,
        valid: 0,
        warnings: 0,
        errors: 0
      }
    };

    const actions = this.#dataRegistry.getAll('actions');

    for (const action of actions) {
      const result = await this.validateAction(action.id);
      results.actions.push(result);

      results.summary.total++;
      if (result.valid) results.summary.valid++;
      results.summary.warnings += result.warnings.length;
      results.summary.errors += result.errors.length;
    }

    return results;
  }

  /**
   * Validates all actions in a specific mod
   *
   * @param {string} modId - Mod identifier
   * @returns {Promise<object>} Validation results
   */
  async validateMod(modId) {
    string.assertNonBlank(modId, 'modId', 'validateMod', this.#logger);

    const results = {
      actions: [],
      summary: {
        total: 0,
        valid: 0,
        warnings: 0,
        errors: 0
      }
    };

    const allActions = this.#dataRegistry.getAll('actions');
    const actions = allActions.filter(action => action.id?.startsWith(`${modId}:`));

    for (const action of actions) {
      const result = await this.validateAction(action.id);
      results.actions.push(result);

      results.summary.total++;
      if (result.valid) results.summary.valid++;
      results.summary.warnings += result.warnings.length;
      results.summary.errors += result.errors.length;
    }

    return results;
  }

  /**
   * Validates effects for a single action
   *
   * @param {string} actionId - Full action ID
   * @returns {Promise<object>} Validation result
   */
  async validateAction(actionId) {
    string.assertNonBlank(actionId, 'actionId', 'validateAction', this.#logger);

    const result = {
      actionId,
      valid: true,
      warnings: [],
      errors: []
    };

    try {
      // Get action from registry
      const action = this.#dataRegistry.get('actions', actionId);
      if (!action) {
        result.valid = false;
        result.errors.push({ message: 'Action not found' });
        return result;
      }

      // Check if action has planning effects
      if (!action.planningEffects) {
        result.warnings.push({ message: 'No planning effects defined' });
        return result;
      }

      // Get rule(s)
      const rules = this.#findRulesForAction(actionId);
      if (rules.length === 0) {
        result.warnings.push({ message: 'No rules found for action' });
        return result;
      }

      // Analyze rules to generate expected effects
      const expectedEffects = [];
      for (const rule of rules) {
        const analyzed = this.#effectsAnalyzer.analyzeRule(rule);
        expectedEffects.push(...analyzed.effects);
      }

      // Compare actual vs expected effects
      const comparison = this.#compareEffects(
        action.planningEffects.effects,
        expectedEffects
      );

      result.warnings.push(...comparison.warnings);
      result.errors.push(...comparison.errors);
      result.valid = comparison.errors.length === 0;

      return result;
    } catch (error) {
      this.#logger.error(`Failed to validate action ${actionId}`, error);
      result.valid = false;
      result.errors.push({ message: error.message });
      return result;
    }
  }

  // Private helper methods

  #findRulesForAction(actionId) {
    const [modId, actionName] = actionId.split(':');
    const ruleId = `${modId}:handle_${actionName}`;

    try {
      const rule = this.#dataRegistry.get('rules', ruleId);
      return rule ? [rule] : [];
    } catch {
      return [];
    }
  }

  #compareEffects(actual, expected) {
    const warnings = [];
    const errors = [];

    // Check for missing effects
    for (const expectedEffect of expected) {
      const found = actual.some(actualEffect =>
        this.#effectsMatch(actualEffect, expectedEffect)
      );

      if (!found) {
        errors.push({
          message: `Missing effect: ${JSON.stringify(expectedEffect)}`
        });
      }
    }

    // Check for unexpected effects
    for (const actualEffect of actual) {
      const found = expected.some(expectedEffect =>
        this.#effectsMatch(actualEffect, expectedEffect)
      );

      if (!found) {
        warnings.push({
          message: `Unexpected effect: ${JSON.stringify(actualEffect)}`
        });
      }
    }

    return { warnings, errors };
  }

  #effectsMatch(effect1, effect2) {
    // Deep comparison of effects
    if (effect1.operation !== effect2.operation) return false;
    if (effect1.entity !== effect2.entity) return false;
    if (effect1.component !== effect2.component) return false;

    // For now, simplified comparison
    // Could be more sophisticated based on operation type
    return true;
  }
}

export default EffectsValidator;
