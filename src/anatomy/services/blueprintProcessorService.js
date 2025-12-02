/**
 * @file BlueprintProcessorService - Centralizes V1/V2 blueprint processing logic
 * This service eliminates code duplication between production blueprint loading
 * and validation logic by providing a single source of truth for blueprint processing.
 * Key responsibilities:
 * - Detect blueprint schema versions (V1 vs V2)
 * - Process V2 blueprints by loading structure templates and generating slots/sockets
 * - Handle V1 blueprints as pass-through (no processing needed)
 * - Merge additionalSlots with generated slots (additionalSlots take precedence)
 * @see src/anatomy/bodyBlueprintFactory/blueprintLoader.js - Production processing
 * @see src/anatomy/validation/RecipeValidationRunner.js - Validation processing
 */

import { BaseService } from '../../utils/serviceBase.js';
import { ValidationError } from '../../errors/validationError.js';

/**
 * Service for processing anatomy blueprints (V1 and V2 formats).
 * V1 Blueprints (schemaVersion 1.0 or omitted):
 * - Have explicit `slots` defined
 * - No processing needed, returned unchanged
 * V2 Blueprints (schemaVersion "2.0"):
 * - Use `structureTemplate` to generate slots/sockets dynamically
 * - Processing involves loading template, generating sockets/slots, merging additionalSlots
 *
 * @augments BaseService
 */
class BlueprintProcessorService extends BaseService {
  /**
   * Creates a new BlueprintProcessorService instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.logger - Logger instance for diagnostics
   * @param {object} dependencies.dataRegistry - Registry for loading structure templates
   * @param {object} dependencies.socketGenerator - Generator for creating socket definitions
   * @param {object} dependencies.slotGenerator - Generator for creating slot definitions
   */
  constructor({ logger, dataRegistry, socketGenerator, slotGenerator }) {
    super();

    this._logger = this._init('BlueprintProcessorService', logger, {
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['get'],
      },
      socketGenerator: {
        value: socketGenerator,
        requiredMethods: ['generateSockets'],
      },
      slotGenerator: {
        value: slotGenerator,
        requiredMethods: ['generateBlueprintSlots'],
      },
    });

    this.#dataRegistry = dataRegistry;
    this.#socketGenerator = socketGenerator;
    this.#slotGenerator = slotGenerator;
  }

  #dataRegistry;
  #socketGenerator;
  #slotGenerator;

  /**
   * Processes a blueprint based on its schema version.
   * V1 blueprints are returned unchanged (pass-through).
   * V2 blueprints are processed: template loaded, sockets/slots generated, additionalSlots merged.
   *
   * @param {object} blueprint - The blueprint to process
   * @param {string} blueprint.id - Blueprint identifier
   * @param {string} [blueprint.schemaVersion] - Schema version (1.0 or "2.0")
   * @param {string} [blueprint.structureTemplate] - V2 only: Structure template ID
   * @param {object} [blueprint.additionalSlots] - V2 only: Slots to merge with generated slots
   * @returns {object} Processed blueprint (enriched for V2, unchanged for V1)
   * @throws {ValidationError} If V2 blueprint references non-existent structure template
   */
  processBlueprint(blueprint) {
    // Optimization: Skip processing if already processed
    if (this.isProcessed(blueprint)) {
      this._logger.debug(
        `Blueprint ${blueprint.id} already processed, skipping reprocessing`
      );
      return blueprint;
    }

    const version = this.detectVersion(blueprint);
    this._logger.debug(
      `Processing blueprint ${blueprint.id} (detected version: V${version})`
    );

    if (version === 1) {
      return this.#processV1Blueprint(blueprint);
    } else {
      return this.#processV2Blueprint(blueprint);
    }
  }

  /**
   * Checks if a blueprint has already been processed.
   * A blueprint is considered processed if it has the `_generatedSockets` property.
   * Accepts both array format (production) and boolean format (legacy validation) for compatibility.
   *
   * @param {object} blueprint - The blueprint to check
   * @returns {boolean} True if blueprint has been processed
   */
  isProcessed(blueprint) {
    return blueprint._generatedSockets !== undefined;
  }

  /**
   * Detects the schema version of a blueprint.
   *
   * @param {object} blueprint - The blueprint to check
   * @param {string} [blueprint.schemaVersion] - Explicit schema version field
   * @returns {number} 1 for V1, 2 for V2
   */
  detectVersion(blueprint) {
    // V2 blueprints have schemaVersion "2.0"
    // V1 blueprints have schemaVersion 1.0 or omitted (default to 1)
    const schemaVersion = blueprint.schemaVersion;

    if (schemaVersion === '2.0') {
      return 2;
    }

    return 1;
  }

  /**
   * Processes a V1 blueprint (pass-through, no processing needed).
   *
   * @param {object} blueprint - V1 blueprint with explicit slots
   * @returns {object} Unchanged blueprint
   * @private
   */
  #processV1Blueprint(blueprint) {
    this._logger.debug(
      `V1 blueprint ${blueprint.id} requires no processing (pass-through)`
    );
    return blueprint;
  }

  /**
   * Processes a V2 blueprint by generating slots/sockets from structure template.
   * Processing steps:
   * 1. Load structure template from DataRegistry
   * 2. Generate sockets using socketGenerator
   * 3. Generate slots using slotGenerator
   * 4. Merge additionalSlots (additionalSlots take precedence)
   * 5. Return enriched blueprint with _generatedSockets array
   *
   * @param {object} blueprint - V2 blueprint with structureTemplate reference
   * @param {string} blueprint.structureTemplate - Structure template ID
   * @param {object} [blueprint.additionalSlots] - Additional slots to merge
   * @returns {object} Enriched blueprint with generated slots and _generatedSockets array
   * @throws {ValidationError} If structure template not found
   * @private
   */
  #processV2Blueprint(blueprint) {
    const { id, structureTemplate, additionalSlots = {} } = blueprint;

    this._logger.debug(
      `Processing V2 blueprint ${id} with structure template: ${structureTemplate}`
    );

    // Step 1: Load structure template
    const template = this.#loadStructureTemplate(structureTemplate);

    // Step 2: Generate sockets from template
    const generatedSockets = this.#socketGenerator.generateSockets(template);
    this._logger.debug(
      `Generated ${generatedSockets.length} sockets for blueprint ${id}`
    );

    // Step 3: Generate slots from template
    const generatedSlots = this.#slotGenerator.generateBlueprintSlots(template);
    const generatedSlotCount = Object.keys(generatedSlots).length;
    this._logger.debug(
      `Generated ${generatedSlotCount} slots for blueprint ${id}`
    );

    // Step 4: Merge additionalSlots with generated slots
    const mergedSlots = this.#mergeSlots(generatedSlots, additionalSlots);
    const finalSlotCount = Object.keys(mergedSlots).length;

    if (finalSlotCount !== generatedSlotCount) {
      const additionalCount = Object.keys(additionalSlots).length;
      this._logger.debug(
        `Merged ${additionalCount} additional slots into blueprint ${id} (final: ${finalSlotCount} slots)`
      );
    }

    // Step 5: Return enriched blueprint
    // CRITICAL: _generatedSockets MUST be array format (matches production)
    // _generatedSlots preserves original generated slots for downstream consumers
    const enrichedBlueprint = {
      ...blueprint,
      slots: mergedSlots,
      _generatedSockets: generatedSockets, // Array of socket objects
      _generatedSlots: generatedSlots, // Original generated slots before merge
    };

    this._logger.info(
      `V2 blueprint ${id} processed successfully (${generatedSockets.length} sockets, ${finalSlotCount} slots)`
    );

    return enrichedBlueprint;
  }

  /**
   * Loads a structure template from the DataRegistry.
   *
   * @param {string} templateId - Structure template identifier
   * @returns {object} Structure template data
   * @throws {ValidationError} If template not found in registry
   * @private
   */
  #loadStructureTemplate(templateId) {
    this._logger.debug(`Loading structure template: ${templateId}`);

    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      templateId
    );

    if (!template) {
      const errorMsg = `Structure template not found: ${templateId}`;
      this._logger.error(errorMsg);
      throw new ValidationError(errorMsg);
    }

    return template;
  }

  /**
   * Merges generated slots with additional slots.
   * Merge precedence: additionalSlots ALWAYS override generated slots.
   * This allows blueprint authors to customize generated slots.
   *
   * @param {object} generatedSlots - Slots generated from structure template
   * @param {object} additionalSlots - Additional slots defined in blueprint
   * @returns {object} Merged slots object
   * @private
   */
  #mergeSlots(generatedSlots, additionalSlots) {
    // additionalSlots take precedence (spread order matters)
    const mergedSlots = {
      ...generatedSlots,
      ...additionalSlots,
    };

    // Log warning if additionalSlots override generated slots unintentionally
    const generatedKeys = Object.keys(generatedSlots);
    const additionalKeys = Object.keys(additionalSlots);
    const overriddenKeys = additionalKeys.filter((key) =>
      generatedKeys.includes(key)
    );

    if (overriddenKeys.length > 0) {
      this._logger.warn(
        `Additional slots override generated slots: ${overriddenKeys.join(', ')} ` +
          `(this may be intentional for customization)`
      );
    }

    return mergedSlots;
  }
}

export default BlueprintProcessorService;
