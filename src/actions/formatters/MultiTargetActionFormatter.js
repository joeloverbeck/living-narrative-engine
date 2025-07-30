/**
 * @file Enhanced multi-target action formatter
 * Extends existing formatter to support multi-placeholder templates
 */

// Type imports
/** @typedef {import('../../interfaces/IActionCommandFormatter.js').IActionCommandFormatter} IActionCommandFormatter */
/** @typedef {import('../../interfaces/IActionCommandFormatter.js').ResolvedTarget} ResolvedTarget */
/** @typedef {import('../../interfaces/IActionCommandFormatter.js').FormattingOptions} FormattingOptions */
/** @typedef {import('../../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
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
    return this.#baseFormatter.format(
      actionDef,
      targetContext,
      entityManager,
      options,
      deps
    );
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

      // Validate inputs
      if (!resolvedTargets || typeof resolvedTargets !== 'object') {
        return {
          ok: false,
          error:
            'Invalid or missing resolvedTargets - multi-target actions require resolved target data',
        };
      }

      // Debug logging
      this.#logger.debug('formatMultiTarget called:', {
        actionId: actionDef.id,
        template,
        resolvedTargets: JSON.stringify(resolvedTargets, null, 2),
        targetDefinitions,
      });

      // Handle combination generation if explicitly enabled
      if (actionDef.generateCombinations === true) {
        return this.#formatCombinations(
          actionDef,
          resolvedTargets,
          targetDefinitions,
          options
        );
      }

      // Check if we need to generate multiple actions for multi-entity targets
      const hasMultipleEntities = Object.values(resolvedTargets).some(
        (targets) => Array.isArray(targets) && targets.length > 1
      );

      // Check if any targets have contextFromId (dependent targets)
      // OR if any target definitions have contextFrom specified
      const hasDependentTargets =
        Object.values(resolvedTargets).some((targets) =>
          targets.some((t) => t.contextFromId)
        ) ||
        Object.values(targetDefinitions || {}).some((def) => def.contextFrom);

      // Only generate combinations if we have multiple entities AND no context dependencies
      // For context-dependent targets, we need to use the special handler
      if (hasDependentTargets) {
        // Generate context-aware combinations
        return this.#formatCombinations(
          actionDef,
          resolvedTargets,
          targetDefinitions,
          options
        );
      } else if (hasMultipleEntities) {
        // Generate regular combinations for multiple independent targets
        return this.#formatCombinations(
          actionDef,
          resolvedTargets,
          targetDefinitions,
          options
        );
      }

      // Format single action with first target from each definition (legacy behavior for single entities)
      return this.#formatSingleMultiTarget(
        template,
        resolvedTargets,
        targetDefinitions,
        options
      );
    } catch (error) {
      this.#logger.error('Error in multi-target formatting:', error);
      return {
        ok: false,
        error: `Multi-target formatting failed: ${error.message}`,
      };
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
        actionDef.template || actionDef.name,
        combination,
        targetDefinitions,
        _options
      );

      if (result.ok) {
        formattedCommands.push(result.value);
      }
    }

    // Always return an array, even if empty
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
  #formatSingleMultiTarget(
    template,
    resolvedTargets,
    targetDefinitions,
    _options
  ) {
    let formattedTemplate = template;

    this.#logger.debug('formatSingleMultiTarget:', {
      template,
      resolvedTargetsKeys: Object.keys(resolvedTargets),
      targetDefinitions,
    });

    // Extract placeholders from template
    const placeholdersInTemplate = this.#extractPlaceholders(template);

    // Replace each placeholder
    for (const [targetKey, targets] of Object.entries(resolvedTargets)) {
      if (!targets || targets.length === 0) {
        // Skip empty target arrays - the placeholder will remain
        this.#logger.debug(`Skipping empty target array for key: ${targetKey}`);
        continue;
      }

      const targetDef = targetDefinitions?.[targetKey];
      let placeholder = targetDef?.placeholder;

      // If no placeholder defined, try to match against available placeholders in template
      if (!placeholder) {
        // For primary targets, try common item placeholders first
        if (targetKey === 'primary') {
          placeholder =
            placeholdersInTemplate.find((p) =>
              ['item', 'object', 'thing'].includes(p)
            ) ||
            placeholdersInTemplate[0] ||
            'target';
        } else {
          // For secondary/other targets, use remaining placeholders or default to 'target'
          placeholder =
            placeholdersInTemplate.find((p) =>
              ['target', 'destination', 'recipient'].includes(p)
            ) ||
            placeholdersInTemplate[1] ||
            'target';
        }
      }

      const target = targets[0]; // Use first target

      if (!target) {
        // This shouldn't happen if targets.length > 0, but be defensive
        this.#logger.warn(
          `No target found in non-empty array for key: ${targetKey}`
        );
        continue;
      }

      this.#logger.debug(
        `Replacing placeholder {${placeholder}} for ${targetKey}:`,
        {
          targetKey,
          placeholder,
          targetId: target.id,
          targetDisplayName: target.displayName,
          currentTemplate: formattedTemplate,
        }
      );

      const placeholderRegex = new RegExp(`\\{${placeholder}\\}`, 'g');
      formattedTemplate = formattedTemplate.replace(
        placeholderRegex,
        target.displayName || target.id
      );
    }

    // Check for any remaining placeholders
    const remainingPlaceholders = this.#extractPlaceholders(formattedTemplate);
    if (remainingPlaceholders.length > 0) {
      this.#logger.warn(
        'Template still contains placeholders after formatting:',
        {
          template: formattedTemplate,
          remainingPlaceholders,
          resolvedTargets: Object.keys(resolvedTargets),
          targetDefinitions,
        }
      );

      // STRICT VALIDATION: Multi-target actions must have all placeholders resolved
      // Do not allow partially resolved actions as per user requirements
      return {
        ok: false,
        error: `Multi-target action template contains unresolved placeholders: ${remainingPlaceholders.join(', ')}. Action is not available.`,
      };
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
   * Generate combinations of targets (full cartesian product with limits)
   *
   * @param {Object<string, ResolvedTarget[]>} resolvedTargets - Resolved targets by definition name
   * @returns {Array<object>} Array of target combinations
   * @private
   */
  #generateCombinations(resolvedTargets) {
    const targetKeys = Object.keys(resolvedTargets);
    const maxCombinations = 50; // Reasonable limit

    if (targetKeys.length === 0) return [];

    // Check if any target arrays are empty
    const hasEmptyTargets = Object.values(resolvedTargets).some(
      (targets) => !targets || targets.length === 0
    );

    // Check if any targets have contextFromId (dependent targets)
    const hasDependentTargets = Object.values(resolvedTargets).some((targets) =>
      targets.some((t) => t.contextFromId)
    );

    // If we have dependent targets but some are empty, return empty combinations
    if (hasDependentTargets && hasEmptyTargets) {
      return [];
    }

    if (targetKeys.length === 1) {
      const key = targetKeys[0];
      return resolvedTargets[key]
        .slice(0, maxCombinations)
        .map((target) => ({ [key]: [target] }));
    }

    if (hasDependentTargets) {
      // Handle context-dependent combinations
      return this.#generateContextDependentCombinations(
        resolvedTargets,
        maxCombinations
      );
    }

    // For multiple target types without dependencies, create cartesian product (limited)
    const combinations = [];

    // Create arrays of valid targets for each key
    const targetArrays = targetKeys.map((key) =>
      resolvedTargets[key].filter((t) => t && t.length !== 0)
    );

    // If any target array is empty, return empty combinations
    if (targetArrays.some((arr) => arr.length === 0)) {
      return [];
    }

    // Generate cartesian product recursively
    const generateCartesian = (arrays, current = [], index = 0) => {
      if (index === arrays.length) {
        if (combinations.length < maxCombinations) {
          // Create combination object with target keys
          const combination = {};
          targetKeys.forEach((key, i) => {
            combination[key] = [current[i]];
          });
          combinations.push(combination);
        }
        return;
      }

      // Limit each dimension to prevent explosion
      const maxPerDimension = Math.min(arrays[index].length, 10);
      for (
        let i = 0;
        i < maxPerDimension && combinations.length < maxCombinations;
        i++
      ) {
        generateCartesian(arrays, [...current, arrays[index][i]], index + 1);
      }
    };

    generateCartesian(targetArrays);
    return combinations;
  }

  /**
   * Generate combinations respecting contextFromId dependencies
   *
   * @param {Object<string, ResolvedTarget[]>} resolvedTargets - Resolved targets by definition name
   * @param {number} maxCombinations - Maximum number of combinations to generate
   * @returns {Array<object>} Array of target combinations
   * @private
   */
  #generateContextDependentCombinations(resolvedTargets, maxCombinations) {
    const combinations = [];

    // Find primary targets (those without contextFromId)
    const primaryKey = Object.keys(resolvedTargets).find(
      (key) => !resolvedTargets[key].some((t) => t.contextFromId)
    );

    if (!primaryKey) {
      // No primary targets found, can't generate context-dependent combinations
      return [];
    }

    const primaryTargets = resolvedTargets[primaryKey];

    this.#logger.debug('generateContextDependentCombinations:', {
      primaryKey,
      primaryTargets: primaryTargets.map((t) => ({
        id: t.id,
        displayName: t.displayName,
      })),
      allKeys: Object.keys(resolvedTargets),
    });

    // For each primary target, create a combination with its dependent targets
    for (const primaryTarget of primaryTargets) {
      if (combinations.length >= maxCombinations) break;

      const combination = {
        [primaryKey]: [primaryTarget],
      };

      let hasAllRequiredTargets = true;

      // Find all dependent targets for this primary
      for (const [key, targets] of Object.entries(resolvedTargets)) {
        if (key === primaryKey) continue;

        // Check if this is a dependent target type (all targets have contextFromId)
        const isDependent =
          targets.length > 0 && targets.every((t) => t.contextFromId);

        if (isDependent) {
          // Find targets that depend on this primary
          const dependentTargets = targets.filter(
            (t) => t.contextFromId === primaryTarget.id
          );

          if (dependentTargets.length > 0) {
            combination[key] = dependentTargets;
          } else {
            // This is a required dependent target but none match this primary
            // Skip this entire combination
            hasAllRequiredTargets = false;
            break;
          }
        } else {
          // This is an independent target type, include all targets
          // This creates cartesian product with independent targets
          if (targets.length > 0) {
            combination[key] = targets;
          }
        }
      }

      // Only add combination if all required targets are present
      // For context-dependent actions, we need all target types to have values
      if (hasAllRequiredTargets) {
        // Check if we have values for all expected target types
        const expectedTargetKeys = Object.keys(resolvedTargets);
        const hasAllTargets = expectedTargetKeys.every(
          (key) => combination[key] && combination[key].length > 0
        );

        if (!hasAllTargets) {
          // Skip this combination if any target type is missing
          continue;
        }
        // If we have independent targets that aren't context-dependent,
        // we need to expand combinations
        const independentKeys = Object.keys(combination).filter(
          (key) =>
            key !== primaryKey &&
            !resolvedTargets[key].every((t) => t.contextFromId)
        );

        if (independentKeys.length > 0) {
          // Generate cartesian product for independent targets
          this.#expandCombinationsForIndependentTargets(
            combination,
            independentKeys,
            combinations,
            maxCombinations
          );
        } else {
          // No independent targets, just add the combination
          combinations.push(combination);
        }
      }
    }

    this.#logger.debug('Generated combinations:', {
      count: combinations.length,
      combinations: combinations.map((c) => {
        const result = {};
        for (const [key, targets] of Object.entries(c)) {
          result[key] = targets.map((t) => ({
            id: t.id,
            displayName: t.displayName,
          }));
        }
        return result;
      }),
    });

    return combinations;
  }

  /**
   * Expand combinations for independent targets
   *
   * @param baseCombination
   * @param independentKeys
   * @param combinations
   * @param maxCombinations
   * @private
   */
  #expandCombinationsForIndependentTargets(
    baseCombination,
    independentKeys,
    combinations,
    maxCombinations
  ) {
    // Extract independent target arrays
    const independentTargets = independentKeys.map((key) => ({
      key,
      targets: baseCombination[key],
    }));

    // Generate cartesian product
    const generateProduct = (index = 0, current = {}) => {
      if (combinations.length >= maxCombinations) return;

      if (index === independentTargets.length) {
        // Create final combination
        const finalCombination = { ...baseCombination };

        // Replace independent targets with current selection
        for (const key of independentKeys) {
          finalCombination[key] = [current[key]];
        }

        combinations.push(finalCombination);
        return;
      }

      const { key, targets } = independentTargets[index];
      for (const target of targets) {
        generateProduct(index + 1, { ...current, [key]: target });
      }
    };

    generateProduct();
  }
}

export default MultiTargetActionFormatter;
