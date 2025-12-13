/**
 * @file Strategy for resolving clothing slot mappings to anatomy attachment points
 * @see src/interfaces/ISlotResolutionStrategy.js
 * @see src/anatomy/integration/strategies/BlueprintSlotStrategy.js
 * @see src/anatomy/integration/strategies/DirectSocketStrategy.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';
import {
  ClothingSlotNotFoundError,
  InvalidClothingSlotMappingError,
} from '../../../errors/clothingSlotErrors.js';

/** @typedef {import('../../../interfaces/ISlotResolutionStrategy.js')} ISlotResolutionStrategy */
/** @typedef {import('../../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */

/**
 * Strategy for resolving clothing slot mappings from blueprint definitions
 * Handles mappings that specify clothingSlotId and resolves them using
 * the blueprint's clothingSlotMappings section
 */
class ClothingSlotMappingStrategy {
  #logger;
  #entityManager;
  #anatomyBlueprintRepository;
  #blueprintSlotStrategy;
  #directSocketStrategy;

  constructor({
    logger,
    entityManager,
    anatomyBlueprintRepository,
    blueprintSlotStrategy,
    directSocketStrategy,
  }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);

    validateDependency(entityManager, 'IEntityManager', null, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });
    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      null,
      {
        requiredMethods: ['getBlueprintByRecipeId'],
      }
    );
    validateDependency(blueprintSlotStrategy, 'ISlotResolutionStrategy', null, {
      requiredMethods: ['canResolve', 'resolve'],
    });
    validateDependency(directSocketStrategy, 'ISlotResolutionStrategy', null, {
      requiredMethods: ['canResolve', 'resolve'],
    });

    this.#entityManager = entityManager;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#blueprintSlotStrategy = blueprintSlotStrategy;
    this.#directSocketStrategy = directSocketStrategy;
  }

  /**
   * Determines if this strategy can handle the given mapping
   *
   * @param {object} mapping - The clothing slot mapping
   * @returns {boolean} True if mapping contains clothingSlotId
   */
  canResolve(mapping) {
    const hasMapping = !!mapping;
    const hasClothingSlotId =
      hasMapping && typeof mapping.clothingSlotId === 'string';
    const isNonEmpty = hasClothingSlotId && mapping.clothingSlotId.length > 0;
    const result = hasMapping && hasClothingSlotId && isNonEmpty;

    this.#logger.debug(
      `ClothingSlotMappingStrategy.canResolve: hasMapping=${hasMapping}, hasClothingSlotId=${hasClothingSlotId}, isNonEmpty=${isNonEmpty}, result=${result}. Mapping: ${JSON.stringify(mapping)}`
    );

    return result;
  }

  /**
   * Resolves clothing slot mapping to attachment points
   *
   * @param {string} entityId - Entity to resolve for
   * @param {object} mapping - The clothing slot mapping
   * @param {Map<string, string>} [slotEntityMappings] - Optional slot-to-entity mappings for this character
   * @returns {Promise<ResolvedAttachmentPoint[]>} Resolved attachment points
   * @throws {ClothingSlotNotFoundError} If clothing slot not found in blueprint
   * @throws {InvalidClothingSlotMappingError} If mapping structure is invalid
   */
  async resolve(entityId, mapping, slotEntityMappings) {
    if (!this.canResolve(mapping)) {
      return [];
    }

    const blueprint = await this.#getEntityBlueprint(entityId);
    if (!blueprint) {
      throw new Error(`No blueprint found for entity ${entityId}`);
    }

    const slotId = mapping.clothingSlotId;
    const clothingSlotMapping = blueprint.clothingSlotMappings?.[slotId];

    if (!clothingSlotMapping) {
      const availableSlots = Object.keys(blueprint.clothingSlotMappings || {});
      throw new ClothingSlotNotFoundError(
        `Clothing slot '${slotId}' not found in blueprint '${blueprint.id}' clothing slot mappings. Available slots: ${availableSlots.join(', ')}`,
        slotId,
        blueprint.id
      );
    }

    // Validate mapping structure
    const hasBlueprintSlots = clothingSlotMapping.blueprintSlots?.length > 0;
    const hasAnatomySockets = clothingSlotMapping.anatomySockets?.length > 0;

    if (!hasBlueprintSlots && !hasAnatomySockets) {
      throw new InvalidClothingSlotMappingError(
        `Clothing slot '${slotId}' mapping is invalid: must have either blueprintSlots or anatomySockets. Expected: { blueprintSlots: [...] } or { anatomySockets: [...] }`,
        slotId,
        clothingSlotMapping
      );
    }

    // Resolve based on mapping type
    let attachmentPoints = [];

    if (hasBlueprintSlots) {
      try {
        const blueprintPoints = await this.#resolveBlueprintSlots(
          entityId,
          clothingSlotMapping.blueprintSlots,
          slotEntityMappings
        );
        attachmentPoints.push(...blueprintPoints);
      } catch (err) {
        this.#logger.error(
          `Failed to resolve blueprint slots for clothing slot '${slotId}'`,
          err
        );
        throw new Error(
          `Blueprint slot '${err.message}' not found in clothing slot '${slotId}' mapping`
        );
      }
    }

    if (hasAnatomySockets) {
      try {
        const socketPoints = await this.#resolveAnatomySockets(
          entityId,
          clothingSlotMapping.anatomySockets
        );
        attachmentPoints.push(...socketPoints);
      } catch (err) {
        this.#logger.error(
          `Failed to resolve anatomy sockets for clothing slot '${slotId}'`,
          err
        );
        throw new Error(
          `Anatomy socket '${err.message}' not found in clothing slot '${slotId}' mapping`
        );
      }
    }

    this.#logger.debug(
      `Resolved clothing slot '${slotId}' to ${attachmentPoints.length} attachment points`
    );

    return attachmentPoints;
  }

  /**
   * Gets entity's anatomy blueprint
   *
   * @param {string} entityId - Entity ID to get blueprint for
   * @returns {Promise<object|null>} Blueprint or null if not found
   * @private
   */
  async #getEntityBlueprint(entityId) {
    const bodyComponent = await this.#entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );
    if (!bodyComponent?.recipeId) {
      return null;
    }

    return await this.#anatomyBlueprintRepository.getBlueprintByRecipeId(
      bodyComponent.recipeId
    );
  }

  /**
   * Resolves blueprint slots using the existing BlueprintSlotStrategy
   *
   * @param {string} entityId - Entity to resolve for
   * @param {string[]} blueprintSlots - Array of blueprint slot IDs
   * @param {Map<string, string>} [slotEntityMappings] - Optional slot-to-entity mappings for this character
   * @returns {Promise<ResolvedAttachmentPoint[]>} Resolved attachment points
   * @private
   */
  async #resolveBlueprintSlots(entityId, blueprintSlots, slotEntityMappings) {
    const mapping = { blueprintSlots };
    return await this.#blueprintSlotStrategy.resolve(
      entityId,
      mapping,
      slotEntityMappings
    );
  }

  /**
   * Resolves anatomy sockets using the existing DirectSocketStrategy
   *
   * @param {string} entityId - Entity to resolve for
   * @param {string[]} anatomySockets - Array of anatomy socket IDs
   * @returns {Promise<ResolvedAttachmentPoint[]>} Resolved attachment points
   * @private
   */
  async #resolveAnatomySockets(entityId, anatomySockets) {
    const mapping = { anatomySockets };
    return await this.#directSocketStrategy.resolve(entityId, mapping);
  }
}

export default ClothingSlotMappingStrategy;
