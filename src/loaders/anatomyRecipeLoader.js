// src/loaders/anatomyRecipeLoader.js

import { SimpleItemLoader } from './simpleItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../utils/idUtils.js';
import { ValidationError } from '../errors/validationError.js';
import { BodyDescriptorValidator } from '../anatomy/validators/bodyDescriptorValidator.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads anatomy recipe definitions from mods.
 * Recipes define what parts a creature should have (types, tags, counts, preferences, exclusions).
 *
 * @augments BaseManifestItemLoader
 */
class AnatomyRecipeLoader extends SimpleItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyRecipes',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy recipe file's data.
   *
   * @override
   * @protected
   * @param {string} modId
   * @param {string} filename
   * @param {string} resolvedPath
   * @param {any} data
   * @param {string} registryKey
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>}
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `AnatomyRecipeLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // Validate the recipeId field
    const { baseId } = parseAndValidateId(
      data,
      'recipeId',
      modId,
      filename,
      this._logger
    );

    // Process macro includes if present
    if (data.includes && Array.isArray(data.includes)) {
      this._logger.debug(
        `AnatomyRecipeLoader [${modId}]: Recipe '${baseId}' includes ${data.includes.length} macro(s)`
      );
      // Note: Macro resolution would be handled by a separate service at runtime
    }

    // Validate constraints if present
    if (data.constraints) {
      this._validateConstraints(data.constraints, modId, filename);
    }

    // Validate body descriptors if present
    if (data.bodyDescriptors) {
      this._validateBodyDescriptors(data.bodyDescriptors, baseId, filename);
    }

    // Store the recipe in the registry
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'recipeId',
      category: 'anatomyRecipes',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomyRecipeLoader [${modId}]: Successfully processed anatomy recipe from ${filename}. Final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );

    return { qualifiedId, didOverride };
  }

  /**
   * Validates constraint arrays for proper structure
   *
   * @param constraints
   * @param modId
   * @param filename
   * @private
   */
  _validateConstraints(constraints, modId, filename) {
    this._validateConstraintCollection(
      constraints.requires,
      'requires',
      modId,
      filename
    );
    this._validateConstraintCollection(
      constraints.excludes,
      'excludes',
      modId,
      filename
    );
  }

  /**
   * Validates an individual constraint collection (requires/excludes).
   *
   * @param {unknown} collection - The constraint collection to validate.
   * @param {'requires' | 'excludes'} constraintType - The constraint type for error context.
   * @param {string} modId - Mod identifier for error context.
   * @param {string} filename - Filename for error context.
   * @private
   */
  _validateConstraintCollection(collection, constraintType, modId, filename) {
    if (collection === undefined) {
      return;
    }

    if (!Array.isArray(collection)) {
      throw new ValidationError(
        `Invalid '${constraintType}' constraint in recipe '${filename}' from mod '${modId}'. Expected array.`
      );
    }

    collection.forEach((group, index) => {
      if (!group || typeof group !== 'object' || Array.isArray(group)) {
        throw new ValidationError(
          `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'. Each group must be an object with 'components' and/or 'partTypes' arrays.`
        );
      }

      const { components, partTypes, ...rest } = group;

      if (Object.keys(rest).length > 0) {
        throw new ValidationError(
          `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'. Unexpected properties: ${Object.keys(rest).join(', ')}.`
        );
      }

      if (!components && !partTypes) {
        throw new ValidationError(
          `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'. Specify at least one of 'components' or 'partTypes'.`
        );
      }

      this._validateConstraintArray(
        components,
        constraintType,
        'components',
        modId,
        filename,
        index
      );
      this._validateConstraintArray(
        partTypes,
        constraintType,
        'partTypes',
        modId,
        filename,
        index
      );
    });
  }

  /**
   * Validates that the provided constraint array (components/partTypes) is well formed.
   * Enhanced with business rule explanations and examples for better error messages.
   *
   * @param {unknown} value - The value to validate.
   * @param {'requires' | 'excludes'} constraintType - The constraint type for error messages.
   * @param {'components' | 'partTypes'} field - The field name being validated.
   * @param {string} modId - Mod identifier for error context.
   * @param {string} filename - Filename for error context.
   * @param {number} index - Index of the group within the collection.
   * @private
   */
  _validateConstraintArray(value, constraintType, field, modId, filename, index) {
    if (value === undefined) {
      return;
    }

    if (!Array.isArray(value)) {
      throw new ValidationError(
        `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'. '${field}' must be an array of strings.`
      );
    }

    // Validate minimum array length and provide enhanced error messages
    if (constraintType === 'requires') {
      // Requires constraints: minimum 2 items for co-presence semantics
      if (value.length < 2) {
        const businessRule =
          'Co-presence constraints ensure multiple part types or components exist together (e.g., wings require tail for balance)';
        const example =
          field === 'partTypes'
            ? `{ "partTypes": ["dragon_wing", "dragon_tail"] }`
            : `{ "components": ["anatomy:wing", "anatomy:arm_socket"] }`;

        throw new ValidationError(
          `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'.\n` +
            `  '${field}' must contain at least 2 items for co-presence.\n\n` +
            `  Business Rule: ${businessRule}\n` +
            `  Example: ${example}\n` +
            `  Current: ${JSON.stringify(value)}`
        );
      }
    } else if (constraintType === 'excludes') {
      // Excludes constraints: minimum 2 items for mutual exclusion semantics
      if (value.length < 2) {
        const businessRule =
          'Mutual exclusion constraints prevent incompatible parts from coexisting (e.g., gills vs lungs)';
        const example =
          field === 'partTypes'
            ? `{ "partTypes": ["gills", "lungs"] }`
            : `{ "components": ["anatomy:gills", "anatomy:lungs"] }`;

        throw new ValidationError(
          `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'.\n` +
            `  '${field}' must contain at least 2 items for mutual exclusion.\n\n` +
            `  Business Rule: ${businessRule}\n` +
            `  Example: ${example}\n` +
            `  Current: ${JSON.stringify(value)}`
        );
      }
    }

    if (!value.every((entry) => typeof entry === 'string')) {
      throw new ValidationError(
        `Invalid '${constraintType}' group at index ${index} in recipe '${filename}' from mod '${modId}'. '${field}' entries must all be strings.`
      );
    }
  }

  /**
   * Validates body descriptors for proper structure and values
   *
   * @param {object} bodyDescriptors - The body descriptors to validate
   * @param {string} recipeId - The recipe ID for error messages
   * @param {string} filename - The filename for error messages
   * @throws {ValidationError} If body descriptors are invalid (dev mode only)
   * @private
   */
  _validateBodyDescriptors(bodyDescriptors, recipeId, filename) {
    // Create validator instance with logger
    const validator = new BodyDescriptorValidator({ logger: this._logger });

    // Get structured validation results
    const result = validator.validateRecipeDescriptors(bodyDescriptors);

    // Build context for error messages
    const context = `Recipe: ${recipeId} (${filename})`;

    // Log all errors
    for (const error of result.errors) {
      this._logger.error(`[Recipe Validation] ${context} - ${error}`);
    }

    // Log all warnings (e.g., unknown descriptors)
    for (const warning of result.warnings) {
      this._logger.warn(`[Recipe Validation] ${context} - ${warning}`);
    }

    // In development mode, fail fast on validation errors
    if (process.env.NODE_ENV !== 'production' && !result.valid) {
      throw new ValidationError(
        `Body descriptor validation failed for ${context}:\n${result.errors.join('\n')}`
      );
    }

    // In production mode, log but continue (errors already logged above)
  }
}

export default AnatomyRecipeLoader;
