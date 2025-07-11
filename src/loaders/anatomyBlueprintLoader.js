// src/loaders/anatomyBlueprintLoader.js

import { SimpleItemLoader } from './simpleItemLoader.js';
import { processAndStoreItem } from './helpers/processAndStoreItem.js';
import { parseAndValidateId } from '../utils/idUtils.js';

/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Loads anatomy blueprint definitions from mods.
 * Blueprints define the structural graph of how body parts connect via sockets.
 * Supports composition from blueprint parts and slot libraries.
 *
 * @augments BaseManifestItemLoader
 */
class AnatomyBlueprintLoader extends SimpleItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'anatomyBlueprints',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    /** @type {Map<string, any>} Pending blueprints that need composition */
    this._pendingBlueprints = new Map();
  }

  /**
   * Processes a single fetched anatomy blueprint file's data.
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
      `AnatomyBlueprintLoader [${modId}]: Processing fetched item: ${filename} (Type: ${registryKey})`
    );

    // Validate required fields
    if (!data.id) {
      throw new Error(
        `Invalid blueprint in '${filename}' from mod '${modId}'. Missing required 'id' field.`
      );
    }
    if (!data.root) {
      throw new Error(
        `Invalid blueprint in '${filename}' from mod '${modId}'. Missing required 'root' field.`
      );
    }

    // Validate attachment references if present (legacy support)
    if (data.attachments && Array.isArray(data.attachments)) {
      this._validateAttachments(data.attachments, modId, filename);
    }

    // Check if blueprint needs composition
    if (data.parts || data.compose) {
      // Store for later processing
      this._pendingBlueprints.set(data.id, {
        data,
        modId,
        filename,
        registryKey,
      });

      this._logger.debug(
        `AnatomyBlueprintLoader [${modId}]: Blueprint '${data.id}' requires composition, queued for processing`
      );

      // Return temporary success - will be processed in finalize
      return { qualifiedId: data.id, didOverride: false };
    }

    // Store the blueprint in the registry (no composition needed)
    const { qualifiedId, didOverride } = await processAndStoreItem(this, {
      data,
      idProp: 'id',
      category: 'anatomyBlueprints',
      modId,
      filename,
    });

    this._logger.debug(
      `AnatomyBlueprintLoader [${modId}]: Successfully processed anatomy blueprint from ${filename}. Final registry key: ${qualifiedId}, Overwrite: ${didOverride}`
    );

    return { qualifiedId, didOverride };
  }

  /**
   * Validates attachment array for proper structure
   *
   * @param attachments
   * @param modId
   * @param filename
   * @private
   */
  _validateAttachments(attachments, modId, filename) {
    const seenPairs = new Set();

    for (const attachment of attachments) {
      if (!attachment.parent || !attachment.socket || !attachment.child) {
        throw new Error(
          `Invalid attachment in blueprint '${filename}' from mod '${modId}'. Each attachment must have parent, socket, and child fields.`
        );
      }

      // Check for duplicate parent-socket pairs
      const pairKey = `${attachment.parent}:${attachment.socket}`;
      if (seenPairs.has(pairKey)) {
        this._logger.warn(
          `AnatomyBlueprintLoader [${modId}]: Duplicate parent-socket pair '${pairKey}' in blueprint '${filename}'. Only the last definition will be used.`
        );
      }
      seenPairs.add(pairKey);
    }
  }

  /**
   * Finalize loading by processing all pending blueprints that need composition
   *
   * @override
   */
  async finalize() {
    this._logger.debug(
      `AnatomyBlueprintLoader: Processing ${this._pendingBlueprints.size} pending blueprints`
    );

    for (const [blueprintId, pending] of this._pendingBlueprints) {
      try {
        const composedData = await this._composeBlueprint(
          pending.data,
          pending.modId,
          pending.filename
        );

        // Store the composed blueprint
        await processAndStoreItem(this, {
          data: composedData,
          idProp: 'id',
          category: 'anatomyBlueprints',
          modId: pending.modId,
          filename: pending.filename,
        });

        this._logger.debug(
          `AnatomyBlueprintLoader: Successfully composed blueprint '${blueprintId}'`
        );
      } catch (error) {
        this._logger.error(
          `AnatomyBlueprintLoader: Failed to compose blueprint '${blueprintId}': ${error.message}`
        );
        throw error;
      }
    }

    // Clear pending blueprints
    this._pendingBlueprints.clear();
  }

  /**
   * Composes a blueprint by processing parts and compose instructions
   *
   * @private
   * @param {any} blueprintData - The blueprint data
   * @param {string} modId - The mod ID
   * @param {string} filename - The filename
   * @returns {Promise<any>} The composed blueprint data
   */
  async _composeBlueprint(blueprintData, modId, filename) {
    // Create a deep copy to avoid modifying the original
    const composed = JSON.parse(JSON.stringify(blueprintData));

    // Initialize slots and clothingSlotMappings if not present
    if (!composed.slots) composed.slots = {};
    if (!composed.clothingSlotMappings) composed.clothingSlotMappings = {};

    // Process simple parts inclusion
    if (composed.parts && Array.isArray(composed.parts)) {
      for (const partId of composed.parts) {
        await this._includePart(
          composed,
          partId,
          ['slots', 'clothingSlotMappings'],
          modId,
          filename
        );
      }
    }

    // Process advanced composition
    if (composed.compose && Array.isArray(composed.compose)) {
      for (const instruction of composed.compose) {
        await this._processComposeInstruction(
          composed,
          instruction,
          modId,
          filename
        );
      }
    }

    // Remove composition fields from final data
    delete composed.parts;
    delete composed.compose;

    return composed;
  }

  /**
   * Includes a blueprint part into the composed blueprint
   *
   * @param composed
   * @param partId
   * @param sections
   * @param modId
   * @param filename
   * @private
   */
  async _includePart(composed, partId, sections, modId, filename) {
    const part = this._dataRegistry.get('anatomyBlueprintParts', partId);
    if (!part) {
      throw new Error(
        `Blueprint '${composed.id}' references unknown part '${partId}' in ${filename}`
      );
    }

    // Process each section
    for (const section of sections) {
      if (part[section]) {
        await this._mergeSection(composed, part, section, modId, filename);
      }
    }
  }

  /**
   * Processes a single compose instruction
   *
   * @param composed
   * @param instruction
   * @param modId
   * @param filename
   * @private
   */
  async _processComposeInstruction(composed, instruction, modId, filename) {
    if (!instruction.part || !instruction.include) {
      throw new Error(
        `Invalid compose instruction in blueprint '${composed.id}' from ${filename}`
      );
    }

    const part = this._dataRegistry.get(
      'anatomyBlueprintParts',
      instruction.part
    );
    if (!part) {
      throw new Error(
        `Blueprint '${composed.id}' references unknown part '${instruction.part}' in ${filename}`
      );
    }

    // Process included sections
    for (const section of instruction.include) {
      if (part[section]) {
        await this._mergeSection(
          composed,
          part,
          section,
          modId,
          filename,
          instruction.excludeSlots,
          instruction.excludeClothingSlots
        );
      }
    }
  }

  /**
   * Merges a section from a part into the composed blueprint
   *
   * @param composed
   * @param part
   * @param section
   * @param modId
   * @param filename
   * @param excludeSlots
   * @param excludeClothingSlots
   * @private
   */
  async _mergeSection(
    composed,
    part,
    section,
    modId,
    filename,
    excludeSlots,
    excludeClothingSlots
  ) {
    const sectionData = part[section];
    const targetSection = composed[section];

    // Get the library if the part references one
    let library = null;
    if (part.library) {
      library = this._dataRegistry.get('anatomySlotLibraries', part.library);
      if (!library) {
        this._logger.warn(
          `Part '${part.id}' references unknown library '${part.library}'`
        );
      }
    }

    if (section === 'slots') {
      for (const [slotKey, slotDef] of Object.entries(sectionData)) {
        // Skip excluded slots
        if (excludeSlots && excludeSlots.includes(slotKey)) continue;

        // Resolve the slot definition
        const resolved = await this._resolveSlotDefinition(
          slotDef,
          library,
          'slotDefinitions'
        );
        targetSection[slotKey] = resolved;
      }
    } else if (section === 'clothingSlotMappings') {
      for (const [mappingKey, mappingDef] of Object.entries(sectionData)) {
        // Skip excluded mappings
        if (excludeClothingSlots && excludeClothingSlots.includes(mappingKey))
          continue;

        // Resolve the mapping definition
        const resolved = await this._resolveSlotDefinition(
          mappingDef,
          library,
          'clothingDefinitions'
        );
        targetSection[mappingKey] = resolved;
      }
    }
  }

  /**
   * Resolves a slot definition that may use $use references
   *
   * @param definition
   * @param library
   * @param librarySection
   * @private
   */
  async _resolveSlotDefinition(definition, library, librarySection) {
    // If no $use, return as-is
    if (!definition.$use) {
      return definition;
    }

    // Must have a library to use $use
    if (!library || !library[librarySection]) {
      throw new Error(
        `Slot definition uses $use but no library or library section '${librarySection}' available`
      );
    }

    const libraryDef = library[librarySection][definition.$use];
    if (!libraryDef) {
      throw new Error(
        `Library does not contain definition '${definition.$use}' in section '${librarySection}'`
      );
    }

    // Create merged definition (library definition + overrides)
    const resolved = JSON.parse(JSON.stringify(libraryDef));

    // Apply overrides
    for (const [key, value] of Object.entries(definition)) {
      if (key !== '$use') {
        resolved[key] = value;
      }
    }

    return resolved;
  }
}

export default AnatomyBlueprintLoader;
