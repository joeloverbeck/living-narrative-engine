/**
 * @file Validator for body descriptor system consistency
 *
 * Ensures descriptors are properly configured across schema, code, and config.
 * This validator checks:
 * 1. Recipe body descriptors against the centralized registry
 * 2. Formatting configuration completeness
 * 3. Overall system consistency across all components
 * @see ../registries/bodyDescriptorRegistry.js
 */

import {
  BODY_DESCRIPTOR_REGISTRY,
  validateDescriptorValue,
  getAllDescriptorNames,
} from '../registries/bodyDescriptorRegistry.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Validator for body descriptor system consistency
 * Ensures descriptors are properly configured across schema, code, and config
 */
export class BodyDescriptorValidator {
  /**
   * Create a BodyDescriptorValidator instance
   *
   * @param {object} [options] - Configuration options (reserved for future use)
   * @param {object} [options.logger] - Logger instance (currently unused but reserved for future logging)
   */
  constructor({ logger = null } = {}) {
    // Logger parameter accepted for future use but not currently utilized
    // Validator follows pattern of returning structured results instead of logging
    if (logger) {
      ensureValidLogger(logger, 'BodyDescriptorValidator');
    }
  }

  /**
   * Validate recipe body descriptors against registry
   *
   * @param {object} bodyDescriptors - Body descriptors from recipe
   * @returns {{valid: boolean, errors: string[], warnings: string[]}} Validation result with errors and warnings
   */
  validateRecipeDescriptors(bodyDescriptors) {
    const errors = [];
    const warnings = [];

    if (!bodyDescriptors) {
      return { valid: true, errors: [], warnings: [] };
    }

    // Check for unknown descriptors
    const registeredNames = getAllDescriptorNames();
    for (const key of Object.keys(bodyDescriptors)) {
      if (!registeredNames.includes(key)) {
        warnings.push(`Unknown body descriptor '${key}' (not in registry)`);
      }
    }

    // Validate values for known descriptors
    for (const [key, value] of Object.entries(bodyDescriptors)) {
      const result = validateDescriptorValue(key, value);
      if (!result.valid) {
        errors.push(result.error);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate formatting config against registry
   *
   * Ensures descriptionOrder includes all registered descriptors
   *
   * @param {object} formattingConfig - Formatting configuration
   * @returns {{valid: boolean, errors: string[], warnings: string[]}} Validation result with errors and warnings
   */
  validateFormattingConfig(formattingConfig) {
    const errors = [];
    const warnings = [];

    if (!formattingConfig?.descriptionOrder) {
      errors.push('Formatting config missing descriptionOrder');
      return { valid: false, errors, warnings };
    }

    const registeredDisplayKeys = Object.values(BODY_DESCRIPTOR_REGISTRY)
      .map(meta => meta.displayKey);

    const orderSet = new Set(formattingConfig.descriptionOrder);

    // Check for missing descriptors in formatting config
    for (const displayKey of registeredDisplayKeys) {
      if (!orderSet.has(displayKey)) {
        warnings.push(
          `Body descriptor '${displayKey}' defined in registry but missing from descriptionOrder. ` +
          `Descriptor will not appear in generated descriptions.`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Comprehensive validation: check schema, code, and config consistency
   *
   * @param {object} options - Configuration options
   * @param {object} options.dataRegistry - Data registry instance
   * @returns {Promise<{errors: string[], warnings: string[], info: string[]}>} Complete validation report
   */
  async validateSystemConsistency({ dataRegistry }) {
    const issues = {
      errors: [],
      warnings: [],
      info: [],
    };

    // 1. Validate formatting config
    const formattingConfig = dataRegistry.get('anatomyFormatting', 'default');
    if (formattingConfig) {
      const configResult = this.validateFormattingConfig(formattingConfig);
      issues.errors.push(...configResult.errors);
      issues.warnings.push(...configResult.warnings);
    } else {
      issues.errors.push('Formatting config not found: anatomy:default');
    }

    // 2. Load and validate sample recipes
    const sampleRecipes = ['anatomy:human_male', 'anatomy:human_female'];
    for (const recipeId of sampleRecipes) {
      const recipe = dataRegistry.get('anatomyRecipes', recipeId);
      if (recipe?.bodyDescriptors) {
        const recipeResult = this.validateRecipeDescriptors(recipe.bodyDescriptors);
        if (!recipeResult.valid) {
          issues.warnings.push(`Recipe ${recipeId}: ${recipeResult.errors.join(', ')}`);
        }
      }
    }

    // 3. Info: report registered descriptors
    issues.info.push(`Total registered descriptors: ${getAllDescriptorNames().length}`);
    issues.info.push(`Registered: ${getAllDescriptorNames().join(', ')}`);

    return issues;
  }
}
