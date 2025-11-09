/**
 * @file Validates that all components referenced in recipes exist in the data registry
 * @see ../validationRule.js - Base class
 * @see ../loadTimeValidationContext.js - Validation context
 */

import { ValidationRule } from '../validationRule.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';
import { createError } from '../../errors/index.js';

/** @typedef {import('../loadTimeValidationContext.js').LoadTimeValidationContext} LoadTimeValidationContext */
/** @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */

/**
 * Validates that all components referenced in anatomy recipes exist in the component registry
 */
export class ComponentExistenceValidationRule extends ValidationRule {
  #logger;
  #dataRegistry;

  /**
   * Creates a new component existence validation rule
   *
   * @param {object} params - Constructor parameters
   * @param {ILogger} params.logger - Logger instance
   * @param {IDataRegistry} params.dataRegistry - Data registry instance
   */
  constructor({ logger, dataRegistry }) {
    super();

    // Validate dependencies using project pattern
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Gets the unique identifier for this rule
   *
   * @returns {string} Unique identifier for this rule
   */
  get ruleId() {
    return 'component-existence';
  }

  /**
   * Gets the human-readable name for this rule
   *
   * @returns {string} Human-readable name for this rule
   */
  get ruleName() {
    return 'Component Existence Validation';
  }

  /**
   * Determines if this rule should apply to the given validation context.
   *
   * @param {LoadTimeValidationContext} context - Context with blueprints and recipes
   * @returns {boolean} True if context has recipes
   */
  shouldApply(context) {
    return context.hasRecipes();
  }

  /**
   * Validates that all component references in recipes exist in the registry.
   *
   * @param {LoadTimeValidationContext} context - Validation context with blueprints and recipes
   * @returns {Promise<Array>} Array of validation issues
   */
  async validate(context) {
    const issues = [];
    const recipes = context.getRecipes();

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      // Get recipePath from options if available (added during validation, not in recipe JSON)
      const recipePath = recipe.recipePath || null;
      const recipeIssues = this.#validateRecipeComponents(recipe, recipeId, recipePath);

      // Add recipe context to each issue
      for (const issue of recipeIssues) {
        issues.push({
          ...issue,
          context: {
            ...issue.context,
            recipeId,
          },
        });
      }
    }

    // Log summary with detailed component information
    if (issues.length > 0) {
      const errors = issues.filter((i) => i.severity === 'error');
      this.#logger.warn(
        `Component existence validation found ${errors.length} missing component(s)`
      );

      // Log detailed information about missing components
      const missingComponents = new Set(
        errors.map((e) => e.context.componentId)
      );
      this.#logger.warn(
        `Missing components: ${Array.from(missingComponents).join(', ')}`
      );

      // Log registry state for debugging
      const allComponents = this.#dataRegistry.getAll('components');
      this.#logger.debug(
        `Component registry contains ${Object.keys(allComponents).length} components`
      );
      this.#logger.debug(
        `First 10 registered components: ${Object.keys(allComponents).slice(0, 10).join(', ')}`
      );

      // Log sample of validation errors for debugging
      const sampleSize = Math.min(5, errors.length);
      this.#logger.warn(
        `Sample validation errors (first ${sampleSize} of ${errors.length}):`
      );
      for (let i = 0; i < sampleSize; i++) {
        const error = errors[i];
        this.#logger.warn(
          `  - ${error.message} (in ${error.context.recipeId}, ${error.context.location.type}:${error.context.location.name})`
        );
      }
    } else {
      this.#logger.debug('Component existence validation passed');
    }

    return issues;
  }

  /**
   * Validates components referenced in a single recipe.
   *
   * @private
   * @param {object} recipe - Recipe definition
   * @param {string} recipeId - Recipe ID
   * @param {string} [recipePath] - Optional recipe file path
   * @returns {Array} Array of issues found
   */
  #validateRecipeComponents(recipe, recipeId, recipePath = null) {
    const issues = [];
    const componentExists = (componentId) =>
      this.#dataRegistry.get('components', componentId) !== undefined;

    // Check slot component requirements
    for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
      // Check tags
      for (const componentId of slot.tags || []) {
        if (!componentExists(componentId)) {
          issues.push(
            this.#createMissingComponentError(
              componentId,
              'slot',
              slotName,
              'tags',
              undefined,
              recipeId,
              recipePath
            )
          );
        }
      }

      // Check notTags
      for (const componentId of slot.notTags || []) {
        if (!componentExists(componentId)) {
          issues.push(
            this.#createMissingComponentError(
              componentId,
              'slot',
              slotName,
              'notTags',
              undefined,
              recipeId,
              recipePath
            )
          );
        }
      }

      // Check slot property components (keys are component IDs)
      for (const componentId of Object.keys(slot.properties || {})) {
        if (!componentExists(componentId)) {
          issues.push(
            this.#createMissingComponentError(
              componentId,
              'slot',
              slotName,
              'properties',
              undefined,
              recipeId,
              recipePath
            )
          );
        }
      }
    }

    // Check pattern component requirements
    for (const [index, pattern] of (recipe.patterns || []).entries()) {
      // Determine pattern identifier (supports v1 and v2 patterns)
      const patternId =
        pattern.matchesPattern ||
        pattern.matchesGroup ||
        (pattern.matches ? pattern.matches.join(',') : null) ||
        (pattern.matchesAll ? 'matchesAll' : `pattern-${index}`);

      // Check tags
      for (const componentId of pattern.tags || []) {
        if (!componentExists(componentId)) {
          issues.push(
            this.#createMissingComponentError(
              componentId,
              'pattern',
              patternId,
              'tags',
              index,
              recipeId,
              recipePath
            )
          );
        }
      }

      // Check notTags
      for (const componentId of pattern.notTags || []) {
        if (!componentExists(componentId)) {
          issues.push(
            this.#createMissingComponentError(
              componentId,
              'pattern',
              patternId,
              'notTags',
              index,
              recipeId,
              recipePath
            )
          );
        }
      }

      // Check pattern property components (keys are component IDs)
      for (const componentId of Object.keys(pattern.properties || {})) {
        if (!componentExists(componentId)) {
          issues.push(
            this.#createMissingComponentError(
              componentId,
              'pattern',
              patternId,
              'properties',
              index,
              recipeId,
              recipePath
            )
          );
        }
      }
    }

    // Check constraint component requirements
    if (recipe.constraints) {
      // Check requires constraints
      for (const [index, requireGroup] of (
        recipe.constraints.requires || []
      ).entries()) {
        for (const componentId of requireGroup.components || []) {
          if (!componentExists(componentId)) {
            issues.push(
              this.#createMissingComponentError(
                componentId,
                'constraint',
                'requires',
                'components',
                index,
                recipeId,
                recipePath
              )
            );
          }
        }
      }

      // Check excludes constraints
      for (const [index, excludeGroup] of (
        recipe.constraints.excludes || []
      ).entries()) {
        for (const componentId of excludeGroup.components || []) {
          if (!componentExists(componentId)) {
            issues.push(
              this.#createMissingComponentError(
                componentId,
                'constraint',
                'excludes',
                'components',
                index,
                recipeId,
                recipePath
              )
            );
          }
        }
      }
    }

    return issues;
  }

  /**
   * Creates a structured error object for a missing component.
   *
   * @private
   * @param {string} componentId - The missing component ID
   * @param {string} locationType - Type of location (slot/pattern/constraint)
   * @param {string} locationName - Name/identifier of the location
   * @param {string} field - Field name where component was referenced
   * @param {number} [index] - Optional index for arrays
   * @param {string} [recipeId] - Recipe ID (added in validate method)
   * @param {string} [recipePath] - Recipe file path (if available)
   * @returns {object} Validation issue object with enhanced error
   */
  #createMissingComponentError(
    componentId,
    locationType,
    locationName,
    field,
    index,
    recipeId = null,
    recipePath = null
  ) {
    const componentName = componentId.split(':')[1] || componentId;
    const modNamespace = componentId.includes(':')
      ? componentId.split(':')[0]
      : '*';

    // Create enhanced error for detailed error reporting
    const enhancedError = recipeId
      ? createError('COMPONENT_NOT_FOUND', {
          recipeId,
          location: {
            type: locationType,
            name: locationName,
          },
          componentId,
          recipePath,
        })
      : null;

    return {
      severity: 'error',
      type: 'COMPONENT_NOT_FOUND',
      message: `Component '${componentId}' does not exist`,
      suggestion: `Create component at: data/mods/${modNamespace}/components/${componentName}.component.json`,
      ruleId: this.ruleId,
      context: {
        componentId,
        location: {
          type: locationType,
          name: locationName,
          field,
          ...(index !== undefined && { index }),
        },
      },
      // Attach enhanced error for better error reporting
      enhancedError,
    };
  }
}
