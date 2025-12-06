/**
 * @file Validates that slot keys are unique within a blueprint
 * @description Detects accidental overwrites when additionalSlots duplicates
 *              a slot key that was generated from a structure template.
 * @see ./BaseValidator.js - Base class for validation infrastructure
 */

import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates slot key uniqueness in V2 blueprints.
 *
 * Detection scenarios:
 * 1. Unintentional duplicate: additionalSlots uses same key as generated slot with same parent
 * 2. Intentional override: additionalSlots overrides with different parent (warning only)
 * 3. Duplicate parent:socket: Multiple slots attach to same socket (physical impossibility)
 *
 * @augments BaseValidator
 */
export class SlotKeyUniquenessValidator extends BaseValidator {
  #anatomyBlueprintRepository;
  #slotGenerator;
  #dataRegistry;
  #logger;

  /**
   * @param {object} options
   * @param {object} options.logger - Logger instance
   * @param {object} options.anatomyBlueprintRepository - Repository for blueprint lookups
   * @param {object} options.slotGenerator - Generator for blueprint slots from templates
   * @param {object} options.dataRegistry - Data registry for template lookups
   */
  constructor({
    logger,
    anatomyBlueprintRepository,
    slotGenerator,
    dataRegistry,
  }) {
    super({
      name: 'slot-key-uniqueness',
      priority: 15, // After BlueprintExistenceValidator (10), before socket validators (22-23)
      failFast: false, // Collect all issues, don't stop early
      logger,
    });

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint'],
      }
    );
    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: ['generateBlueprintSlots'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });

    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#slotGenerator = slotGenerator;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Validates slot key uniqueness for V2 blueprints.
   *
   * @param {object} recipe - The anatomy recipe being validated
   * @param {object} _options - Validation options (unused)
   * @param {object} builder - ValidationResultBuilder for collecting results
   * @returns {Promise<void>}
   */
  async performValidation(recipe, _options, builder) {
    const blueprintId = recipe.blueprintId;
    if (!blueprintId) {
      return; // No blueprint to validate
    }

    const blueprint =
      this.#anatomyBlueprintRepository.getBlueprint(blueprintId);
    if (!blueprint) {
      return; // Blueprint doesn't exist (handled by BlueprintExistenceValidator)
    }

    // Only validate V2 blueprints with structure templates
    if (blueprint.schemaVersion !== '2.0' || !blueprint.structureTemplate) {
      builder.addPassed(
        'V1 blueprint or no structure template - slot key uniqueness not applicable',
        { check: 'SLOT_KEY_UNIQUENESS_SKIP' }
      );
      return;
    }

    // Generate slots from template
    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );
    if (!template) {
      this.#logger.debug(
        `SlotKeyUniquenessValidator: Template '${blueprint.structureTemplate}' not found`
      );
      return;
    }

    const generatedSlots =
      this.#slotGenerator.generateBlueprintSlots(template) || {};
    const additionalSlots = blueprint.additionalSlots || {};

    // Find conflicting keys
    const generatedSlotKeys = new Set(Object.keys(generatedSlots));
    const collisions = Object.keys(additionalSlots).filter((key) =>
      generatedSlotKeys.has(key)
    );

    if (collisions.length === 0) {
      builder.addPassed('No slot key collisions detected', {
        check: 'SLOT_KEY_UNIQUENESS_PASS',
        generatedCount: generatedSlotKeys.size,
        additionalCount: Object.keys(additionalSlots).length,
      });
      // Still check for duplicate parent:socket combinations even without key collisions
      this.#checkForDuplicateParentReferences(
        generatedSlots,
        additionalSlots,
        builder
      );
      return;
    }

    // Categorize collisions
    for (const key of collisions) {
      const generatedSlot = generatedSlots[key];
      const additionalSlot = additionalSlots[key];

      const isIntentional = this.#isIntentionalOverride(
        generatedSlot,
        additionalSlot
      );

      if (isIntentional) {
        builder.addWarning(
          'INTENTIONAL_SLOT_OVERRIDE',
          `Slot '${key}' from additionalSlots overrides generated slot with different parent. ` +
            `This appears intentional.`,
          {
            slotKey: key,
            generatedParent: generatedSlot?.parent,
            overrideParent: additionalSlot?.parent,
          }
        );
      } else {
        builder.addError(
          'UNINTENTIONAL_SLOT_DUPLICATE',
          `Slot key '${key}' appears in both generated slots and additionalSlots with same parent. ` +
            `The additionalSlots version will overwrite the generated one. ` +
            `If intentional, specify a different parent to clarify intent.`,
          {
            slotKey: key,
            parent: generatedSlot?.parent || additionalSlot?.parent,
          }
        );
      }
    }

    // Check for duplicate parent:socket combinations
    this.#checkForDuplicateParentReferences(
      generatedSlots,
      additionalSlots,
      builder
    );
  }

  /**
   * Determines if an override appears intentional based on parent difference.
   *
   * @param {object|undefined} generatedSlot - The generated slot definition
   * @param {object|undefined} additionalSlot - The additional slot definition
   * @returns {boolean} True if the override appears intentional
   */
  #isIntentionalOverride(generatedSlot, additionalSlot) {
    // Different parent = intentional restructuring
    if (generatedSlot?.parent !== additionalSlot?.parent) {
      return true;
    }
    return false;
  }

  /**
   * Checks for slots that attach to the same parent:socket combination.
   *
   * @param {object} generatedSlots - Generated slot definitions
   * @param {object} additionalSlots - Additional slot definitions
   * @param {object} builder - ValidationResultBuilder
   */
  #checkForDuplicateParentReferences(generatedSlots, additionalSlots, builder) {
    const allSlots = { ...generatedSlots, ...additionalSlots };
    const parentSocketCombos = new Map();

    for (const [key, slot] of Object.entries(allSlots)) {
      if (!slot?.parent || !slot?.socket) continue;

      const combo = `${slot.parent}:${slot.socket}`;

      if (parentSocketCombos.has(combo)) {
        builder.addWarning(
          'DUPLICATE_PARENT_SOCKET',
          `Slots '${parentSocketCombos.get(combo)}' and '${key}' both attach to ` +
            `parent '${slot.parent}' via socket '${slot.socket}'. ` +
            `Only one child can occupy each socket.`,
          {
            slotKeys: [parentSocketCombos.get(combo), key],
            parent: slot.parent,
            socket: slot.socket,
          }
        );
      } else {
        parentSocketCombos.set(combo, key);
      }
    }
  }
}

export default SlotKeyUniquenessValidator;
