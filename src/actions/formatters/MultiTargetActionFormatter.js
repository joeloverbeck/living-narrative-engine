/**
 * @file Enhanced multi-target action formatter
 * Extends existing formatter to support multi-placeholder templates
 */

// Type imports
/** @typedef {import('../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter */
/** @typedef {import('../../interfaces/IActionCommandFormatter.js').ResolvedTarget} ResolvedTarget */
/** @typedef {import('../../interfaces/IActionCommandFormatter.js').FormattingOptions} FormattingOptions */
/** @typedef {import('../../../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./formatActionTypedefs.js').FormatActionCommandResult} FormatActionCommandResult */

import { IActionCommandFormatter } from '../../interfaces/IActionCommandFormatter.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Multi-target action formatter that extends the existing IActionCommandFormatter
 * Supports both legacy single-target formatting and new multi-target formatting
 */
export class MultiTargetActionFormatter extends IActionCommandFormatter {
  #baseFormatter;
  #logger;

  /**
   * Creates a MultiTargetActionFormatter instance
   *
   * @param {IActionCommandFormatter} baseFormatter - Base formatter for legacy compatibility
   * @param {object} logger - Logger instance
   */
  constructor(baseFormatter, logger) {
    super();
    validateDependency(baseFormatter, 'IActionCommandFormatter');
    validateDependency(logger, 'ILogger');

    this.#baseFormatter = baseFormatter;
    this.#logger = logger;
  }

  /**
   * Legacy format method for backward compatibility
   *
   * @inheritdoc
   */
  format(actionDef, targetContext, entityManager, options, deps) {
    return this.#baseFormatter.format(actionDef, targetContext, entityManager, options, deps);
  }

  /**
   * Format action with multiple targets and placeholders
   *
   * @inheritdoc
   */
  formatMultiTarget(actionDef, resolvedTargets, entityManager, options, deps) {
    try {
      const { targetDefinitions } = deps || {};
      let template = actionDef.template || actionDef.name;
      
      // Handle combination generation if enabled
      if (actionDef.generateCombinations) {
        return this.#formatCombinations(actionDef, resolvedTargets, targetDefinitions, options);
      }
      
      // Format single action with first target from each definition
      return this.#formatSingleMultiTarget(template, resolvedTargets, targetDefinitions, options);
    } catch (error) {
      this.#logger.error('Error in multi-target formatting:', error);
      return { ok: false, error: `Multi-target formatting failed: ${error.message}` };
    }
  }
  
  /**
   * Format multiple combinations of targets
   *
   * @param {ActionDefinition} actionDef - Action definition
   * @param {Object<string, ResolvedTarget[]>} resolvedTargets - Resolved targets by definition name
   * @param {object} targetDefinitions - Target definitions
   * @param {FormattingOptions} _options - Formatting options (unused)
   * @returns {object} Format result with array of formatted commands
   * @private
   */
  #formatCombinations(actionDef, resolvedTargets, targetDefinitions, _options) {
    const combinations = this.#generateCombinations(resolvedTargets);
    const formattedCommands = [];
    
    for (const combination of combinations) {
      const result = this.#formatSingleMultiTarget(
        actionDef.template,
        combination,
        targetDefinitions,
        _options
      );
      
      if (result.ok) {
        formattedCommands.push(result.value);
      }
    }
    
    return { ok: true, value: formattedCommands };
  }
  
  /**
   * Format single multi-target action
   *
   * @param {string} template - Action template string
   * @param {Object<string, ResolvedTarget[]>} resolvedTargets - Resolved targets by definition name
   * @param {object} targetDefinitions - Target definitions
   * @param {FormattingOptions} _options - Formatting options (unused)
   * @returns {object} Format result with formatted command
   * @private
   */
  #formatSingleMultiTarget(template, resolvedTargets, targetDefinitions, _options) {
    let formattedTemplate = template;
    
    // Extract placeholders from template
    const placeholdersInTemplate = this.#extractPlaceholders(template);
    
    // Replace each placeholder
    for (const [targetKey, targets] of Object.entries(resolvedTargets)) {
      if (targets.length === 0) continue;
      
      const targetDef = targetDefinitions?.[targetKey];
      let placeholder = targetDef?.placeholder;
      
      // If no placeholder defined, try to match against available placeholders in template
      if (!placeholder) {
        // For primary targets, try common item placeholders first
        if (targetKey === 'primary') {
          placeholder = placeholdersInTemplate.find(p => ['item', 'object', 'thing'].includes(p)) || 
                      placeholdersInTemplate[0] || 'target';
        } else {
          // For secondary/other targets, use remaining placeholders or default to 'target'
          placeholder = placeholdersInTemplate.find(p => ['target', 'destination', 'recipient'].includes(p)) || 
                      placeholdersInTemplate[1] || 'target';
        }
      }
      
      const target = targets[0]; // Use first target
      
      const placeholderRegex = new RegExp(`\\{${placeholder}\\}`, 'g');
      formattedTemplate = formattedTemplate.replace(
        placeholderRegex,
        target.displayName || target.id
      );
    }
    
    return { ok: true, value: formattedTemplate };
  }

  /**
   * Extract placeholder names from template
   *
   * @param {string} template - Template string
   * @returns {string[]} Array of placeholder names
   * @private
   */
  #extractPlaceholders(template) {
    const placeholderRegex = /\{([^}]+)\}/g;
    const placeholders = [];
    let match;
    
    while ((match = placeholderRegex.exec(template)) !== null) {
      placeholders.push(match[1]);
    }
    
    return placeholders;
  }
  
  /**
   * Generate combinations of targets (simplified version)
   *
   * @param {Object<string, ResolvedTarget[]>} resolvedTargets - Resolved targets by definition name
   * @returns {Array<object>} Array of target combinations
   * @private
   */
  #generateCombinations(resolvedTargets) {
    const targetKeys = Object.keys(resolvedTargets);
    const maxCombinations = 50; // Reasonable limit
    
    if (targetKeys.length === 0) return [];
    if (targetKeys.length === 1) {
      const key = targetKeys[0];
      return resolvedTargets[key].slice(0, maxCombinations).map(target => ({ [key]: [target] }));
    }
    
    // For multiple target types, create cartesian product (limited)
    const combinations = [];
    const [firstKey, ...restKeys] = targetKeys;
    const firstTargets = resolvedTargets[firstKey].slice(0, 10); // Limit first dimension
    
    for (const firstTarget of firstTargets) {
      if (combinations.length >= maxCombinations) break;
      
      const combination = { [firstKey]: [firstTarget] };
      
      // Add first target from each remaining type
      for (const key of restKeys) {
        if (resolvedTargets[key].length > 0) {
          combination[key] = [resolvedTargets[key][0]];
        }
      }
      
      combinations.push(combination);
    }
    
    return combinations;
  }
}

export default MultiTargetActionFormatter;