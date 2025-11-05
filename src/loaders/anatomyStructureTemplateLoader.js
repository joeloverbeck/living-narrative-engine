// src/loaders/anatomyStructureTemplateLoader.js

import { SimpleItemLoader } from './simpleItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { ValidationError } from '../errors/validationError.js';
import { validateAgainstSchema } from '../utils/schemaValidationUtils.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads anatomy structure template definitions from mods.
 * Structure templates define parameterized body structures with declarative limb sets and appendages.
 *
 * @augments SimpleItemLoader
 */
class AnatomyStructureTemplateLoader extends SimpleItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyStructureTemplates',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Processes a single fetched anatomy structure template file's data.
   * Adds custom validation for template-specific requirements.
   *
   * @override
   * @protected
   * @param {string} modId - The mod ID providing the template
   * @param {string} filename - Source filename for error reporting
   * @param {string} resolvedPath - Resolved file path (unused)
   * @param {object} data - Parsed template data
   * @param {string} registryKey - Registry category key
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} Processing result with qualified ID and override status
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    this._logger.debug(
      `AnatomyStructureTemplateLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // First validate against JSON schema
    try {
      validateAgainstSchema(
        this._schemaValidator,
        'schema://living-narrative-engine/anatomy.structure-template.schema.json',
        data,
        this._logger,
        {
          validationDebugMessage: `Validating structure template from ${filename}`,
          failureMessage: `Structure template '${filename}' from mod '${modId}' failed schema validation`,
          failureThrowMessage: `Invalid structure template in '${filename}' from mod '${modId}'`,
          filePath: resolvedPath,
        }
      );
    } catch (validationError) {
      // Schema validation throws on failure, re-throw as ValidationError
      throw new ValidationError(
        `Structure template schema validation failed: ${validationError.message}`,
        data.id,
        validationError
      );
    }

    // Validate required fields (kept for backward compatibility and additional checks)
    if (!data.id) {
      throw new ValidationError(
        `Invalid structure template in '${filename}' from mod '${modId}'. Missing required 'id' field.`
      );
    }
    if (!data.topology) {
      throw new ValidationError(
        `Invalid structure template in '${filename}' from mod '${modId}'. Missing required 'topology' field.`
      );
    }
    if (!data.topology.rootType) {
      throw new ValidationError(
        `Invalid structure template in '${filename}' from mod '${modId}'. Missing required 'topology.rootType' field.`
      );
    }

    // Validate limb sets if present
    if (data.topology.limbSets && Array.isArray(data.topology.limbSets)) {
      this._validateLimbSets(data.topology.limbSets, modId, filename);
    }

    // Validate appendages if present
    if (data.topology.appendages && Array.isArray(data.topology.appendages)) {
      this._validateAppendages(data.topology.appendages, modId, filename);
    }

    // Store the template in the registry
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'anatomyStructureTemplates',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomyStructureTemplateLoader [${modId}]: Successfully processed anatomy structure template from ${filename}. Final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );

    return { qualifiedId, didOverride };
  }

  /**
   * Validates limb set definitions for proper structure and constraints
   *
   * @param {Array} limbSets - Array of limb set definitions
   * @param {string} modId - Mod ID for error messages
   * @param {string} filename - Filename for error messages
   * @throws {ValidationError} If limb sets are invalid
   * @private
   */
  _validateLimbSets(limbSets, modId, filename) {
    for (let i = 0; i < limbSets.length; i++) {
      const limbSet = limbSets[i];

      // Validate count constraints (1-100)
      if (
        typeof limbSet.count !== 'number' ||
        limbSet.count < 1 ||
        limbSet.count > 100
      ) {
        throw new ValidationError(
          `Invalid limb set count in template '${filename}' from mod '${modId}'. Limb set ${i + 1} count must be between 1 and 100, got: ${limbSet.count}`
        );
      }

      // Validate socket pattern
      if (limbSet.socketPattern) {
        this._validateSocketPattern(
          limbSet.socketPattern,
          `limb set ${i + 1}`,
          modId,
          filename
        );
      }

      // Validate arrangement if present
      if (limbSet.arrangement) {
        const validArrangements = [
          'bilateral',
          'radial',
          'quadrupedal',
          'linear',
          'custom',
        ];
        if (!validArrangements.includes(limbSet.arrangement)) {
          throw new ValidationError(
            `Invalid arrangement '${limbSet.arrangement}' in limb set ${i + 1} of template '${filename}' from mod '${modId}'. Must be one of: ${validArrangements.join(', ')}`
          );
        }
      }
    }
  }

  /**
   * Validates appendage definitions for proper structure and constraints
   *
   * @param {Array} appendages - Array of appendage definitions
   * @param {string} modId - Mod ID for error messages
   * @param {string} filename - Filename for error messages
   * @throws {ValidationError} If appendages are invalid
   * @private
   */
  _validateAppendages(appendages, modId, filename) {
    for (let i = 0; i < appendages.length; i++) {
      const appendage = appendages[i];

      // Validate count constraints (1-10)
      if (
        typeof appendage.count !== 'number' ||
        appendage.count < 1 ||
        appendage.count > 10
      ) {
        throw new ValidationError(
          `Invalid appendage count in template '${filename}' from mod '${modId}'. Appendage ${i + 1} count must be between 1 and 10, got: ${appendage.count}`
        );
      }

      // Validate socket pattern
      if (appendage.socketPattern) {
        this._validateSocketPattern(
          appendage.socketPattern,
          `appendage ${i + 1}`,
          modId,
          filename
        );
      }

      // Validate attachment if present
      if (appendage.attachment) {
        const validAttachments = [
          'anterior',
          'posterior',
          'dorsal',
          'ventral',
          'lateral',
          'custom',
        ];
        if (!validAttachments.includes(appendage.attachment)) {
          throw new ValidationError(
            `Invalid attachment '${appendage.attachment}' in appendage ${i + 1} of template '${filename}' from mod '${modId}'. Must be one of: ${validAttachments.join(', ')}`
          );
        }
      }
    }
  }

  /**
   * Validates socket pattern definitions for proper structure
   *
   * @param {object} socketPattern - Socket pattern to validate
   * @param {string} context - Context description for error messages
   * @param {string} modId - Mod ID for error messages
   * @param {string} filename - Filename for error messages
   * @throws {ValidationError} If socket pattern is invalid
   * @private
   */
  _validateSocketPattern(socketPattern, context, modId, filename) {
    // Validate idTemplate contains template variables
    if (!socketPattern.idTemplate) {
      throw new ValidationError(
        `Missing idTemplate in socket pattern for ${context} of template '${filename}' from mod '${modId}'.`
      );
    }

    // Check if idTemplate contains variables ({{...}}) unless it's a static template
    const hasVariables = /\{\{[a-z_]+\}\}/.test(socketPattern.idTemplate);
    const isStaticTemplate =
      /^[a-z_]+$/.test(socketPattern.idTemplate) &&
      !socketPattern.idTemplate.includes('{{');

    if (!hasVariables && !isStaticTemplate) {
      throw new ValidationError(
        `Invalid idTemplate '${socketPattern.idTemplate}' in socket pattern for ${context} of template '${filename}' from mod '${modId}'. Must contain template variables like {{index}}, {{orientation}}, or {{position}}, or be a valid static identifier.`
      );
    }

    // Validate orientation scheme if present
    if (socketPattern.orientationScheme) {
      const validSchemes = ['bilateral', 'radial', 'indexed', 'custom'];
      if (!validSchemes.includes(socketPattern.orientationScheme)) {
        throw new ValidationError(
          `Invalid orientationScheme '${socketPattern.orientationScheme}' in socket pattern for ${context} of template '${filename}' from mod '${modId}'. Must be one of: ${validSchemes.join(', ')}`
        );
      }
    }

    // Validate allowedTypes is present and non-empty
    if (
      !socketPattern.allowedTypes ||
      !Array.isArray(socketPattern.allowedTypes) ||
      socketPattern.allowedTypes.length === 0
    ) {
      throw new ValidationError(
        `Missing or empty allowedTypes in socket pattern for ${context} of template '${filename}' from mod '${modId}'. At least one allowed type is required.`
      );
    }
  }
}

export default AnatomyStructureTemplateLoader;
