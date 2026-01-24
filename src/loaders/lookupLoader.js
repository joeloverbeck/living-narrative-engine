/**
 * @file Loader for lookup table definitions with inline schema validation.
 */

import { BaseInlineSchemaLoader } from './baseInlineSchemaLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import GateConstraint from '../expressionDiagnostics/models/GateConstraint.js';

/**
 * @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver
 * @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher
 * @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * Loader responsible for lookup table definition files. Lookups provide
 * static reference/mapping data that can be queried at runtime.
 *
 * This loader validates lookup entries against their inline dataSchema
 * when present, enabling runtime schema enforcement.
 *
 * @class LookupLoader
 * @augments BaseInlineSchemaLoader
 */
class LookupLoader extends BaseInlineSchemaLoader {
  /**
   * Creates an instance of LookupLoader.
   *
   * @param {IConfiguration} config - Engine configuration service.
   * @param {IPathResolver} pathResolver - Resolves mod file paths.
   * @param {IDataFetcher} dataFetcher - Fetches raw lookup files.
   * @param {ISchemaValidator} schemaValidator - Validates lookups against schema.
   * @param {IDataRegistry} dataRegistry - Registry for storing loaded lookups.
   * @param {ILogger} logger - Logger for diagnostic messages.
   */
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'lookups',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }

  /**
   * Validates gate threshold values in prototype entries.
   * Emits warnings for invalid gate values that would always fail or produce
   * unexpected results due to being outside the valid range for their axis type.
   *
   * @param {string} lookupId - The lookup ID (e.g., 'core:emotion_prototypes').
   * @param {object} entries - The entries object from the lookup.
   * @private
   */
  #validatePrototypeGates(lookupId, entries) {
    if (!entries || typeof entries !== 'object') {
      return;
    }

    for (const [entryName, entryData] of Object.entries(entries)) {
      if (!entryData || !Array.isArray(entryData.gates)) {
        continue;
      }

      for (const gateString of entryData.gates) {
        if (typeof gateString !== 'string') {
          continue;
        }

        try {
          const { validation } = GateConstraint.parseAndValidate(gateString);
          if (!validation.valid) {
            this._logger.warn(
              `Invalid gate threshold in ${lookupId} entry "${entryName}": ` +
                `Gate "${gateString}" - ${validation.issue}`
            );
          }
        } catch (parseError) {
          // Malformed gate syntax - schema validation should catch this,
          // but log a warning just in case
          this._logger.warn(
            `Malformed gate in ${lookupId} entry "${entryName}": ` +
              `"${gateString}" - ${parseError.message}`
          );
        }
      }
    }
  }

  /**
   * Determines if a lookup is a prototype lookup that should have gates validated.
   *
   * @param {string} lookupId - The lookup ID.
   * @returns {boolean} True if gates should be validated.
   * @private
   */
  #isPrototypeLookup(lookupId) {
    return (
      lookupId.endsWith('emotion_prototypes') ||
      lookupId.endsWith('sexual_prototypes')
    );
  }

  /**
   * Validates lookup entries against the inline dataSchema.
   *
   * @param {string} lookupId - The lookup ID for error messages.
   * @param {string} schemaId - The registered schema ID.
   * @param {object} entries - The entries object from the lookup.
   * @throws {Error} If any entry fails schema validation.
   * @private
   */
  #validateEntriesAgainstSchema(lookupId, schemaId, entries) {
    if (!entries || typeof entries !== 'object') {
      return;
    }

    for (const [entryKey, entryValue] of Object.entries(entries)) {
      const validation = this._schemaValidator.validate(schemaId, entryValue);
      if (!validation.isValid) {
        const errorMessages = validation.errors
          ? validation.errors.join(', ')
          : 'Unknown validation error';
        this._logger.error(
          `Lookup '${lookupId}' entry '${entryKey}' failed schema validation: ${errorMessages}`
        );
        throw new Error(
          `Invalid lookup entry: ${lookupId}/${entryKey} - ${errorMessages}`
        );
      }
    }
  }

  /**
   * Processes a fetched lookup item, storing it in the registry and
   * validating entries against inline schemas and gates for prototype lookups.
   *
   * @param {string} modId - The mod ID.
   * @param {string} filename - The filename of the lookup.
   * @param {string} resolvedPath - The resolved file path.
   * @param {object} data - The parsed lookup data.
   * @param {string} registryKey - The registry category key.
   * @returns {Promise<{qualifiedId: string, didOverride: boolean}>} Processing result.
   */
  async _processFetchedItem(modId, filename, resolvedPath, data, registryKey) {
    // Extract base ID for schema registration
    const baseId = data?.id
      ? data.id.includes(':')
        ? data.id.split(':')[1]
        : data.id
      : filename.replace(/\.lookup\.json$/, '');

    // Register inline dataSchema if present and validate entries
    if (data?.dataSchema && typeof data.dataSchema === 'object') {
      const schemaId = `${modId}:${baseId}:entry`;

      await this._registerItemSchema(data, 'dataSchema', schemaId, {
        successDebugMessage: `LookupLoader [${modId}]: Registered dataSchema for '${baseId}'`,
      });

      // Validate each entry against the registered schema
      if (data.entries && typeof data.entries === 'object') {
        this.#validateEntriesAgainstSchema(
          data.id || `${modId}:${baseId}`,
          schemaId,
          data.entries
        );
      }
    }

    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: registryKey,
      modId,
      filename,
    });

    // Validate gates in prototype lookups after successful loading
    if (this.#isPrototypeLookup(qualifiedId) && data.entries) {
      this.#validatePrototypeGates(qualifiedId, data.entries);
    }

    return { qualifiedId, didOverride };
  }
}

export default LookupLoader;
