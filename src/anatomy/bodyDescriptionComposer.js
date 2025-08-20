import { ANATOMY_BODY_COMPONENT_ID } from '../constants/componentIds.js';
import { DescriptionConfiguration } from './configuration/descriptionConfiguration.js';
import { DescriptionTemplate } from './templates/descriptionTemplate.js';
import { TextFormatter } from './templates/textFormatter.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
// Validation utilities are imported but not actively used yet
// They will be used in future phases of the migration

/**
 * Service for composing full body descriptions from all body parts
 */
export class BodyDescriptionComposer {
  #logger;

  constructor({
    bodyPartDescriptionBuilder,
    bodyGraphService,
    entityFinder,
    anatomyFormattingService,
    partDescriptionGenerator,
    equipmentDescriptionService = null,
    logger = null,
  } = {}) {
    this.bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.bodyGraphService = bodyGraphService;
    this.entityFinder = entityFinder;
    this.anatomyFormattingService = anatomyFormattingService;
    this.partDescriptionGenerator = partDescriptionGenerator;
    this.equipmentDescriptionService = equipmentDescriptionService;
    this.#logger = ensureValidLogger(logger, 'BodyDescriptionComposer');

    // Initialize configuration and template services
    this.config = new DescriptionConfiguration(anatomyFormattingService);
    this.descriptionTemplate = new DescriptionTemplate({
      config: this.config,
      textFormatter: new TextFormatter(),
      partDescriptionGenerator: this.partDescriptionGenerator,
    });
  }

  /**
   * Compose a full body description from all body parts
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {Promise<string>} The composed description
   */
  async composeDescription(bodyEntity) {
    if (!bodyEntity || !bodyEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      return '';
    }

    const bodyComponent = bodyEntity.getComponentData(
      ANATOMY_BODY_COMPONENT_ID
    );
    if (!bodyComponent || !bodyComponent.body || !bodyComponent.body.root) {
      return '';
    }

    // Get all body parts
    const allParts = this.bodyGraphService.getAllParts(bodyComponent.body);
    if (!allParts || allParts.length === 0) {
      return '';
    }

    // Group parts by subtype
    const partsByType = this.groupPartsByType(allParts);

    // Build structured description following configured order
    const lines = [];
    const descriptionOrder = this.config.getDescriptionOrder();
    const processedTypes = new Set();

    // FIRST: Add body-level descriptors using configured order
    const bodyLevelDescriptors = this.extractBodyLevelDescriptors(bodyEntity);
    const bodyDescriptorOrder = this.getBodyDescriptorOrder(descriptionOrder);
    const processedDescriptors = new Set();

    for (const descriptorType of bodyDescriptorOrder) {
      if (
        bodyLevelDescriptors[descriptorType] &&
        !processedDescriptors.has(descriptorType)
      ) {
        lines.push(bodyLevelDescriptors[descriptorType]);
        processedDescriptors.add(descriptorType);
      }
    }

    // THEN: Process parts in configured order (existing logic continues)
    for (const partType of descriptionOrder) {
      if (processedTypes.has(partType)) {
        continue;
      }

      // Skip body descriptor types as they're already handled above
      if (
        ['build', 'body_composition', 'body_hair', 'skin_color'].includes(
          partType
        )
      ) {
        processedTypes.add(partType);
        continue;
      }

      // Handle equipment descriptions
      if (partType === 'equipment' && this.equipmentDescriptionService) {
        const equipmentDescription =
          await this.equipmentDescriptionService.generateEquipmentDescription(
            bodyEntity.id
          );
        if (equipmentDescription) {
          lines.push(equipmentDescription);
        }
        processedTypes.add(partType);
        continue;
      }

      // Process body parts
      if (partsByType.has(partType)) {
        const parts = partsByType.get(partType);
        const structuredLine = this.descriptionTemplate.createStructuredLine(
          partType,
          parts
        );
        if (structuredLine) {
          lines.push(structuredLine);
        }
        processedTypes.add(partType);
      }
    }

    // Join all lines with newlines
    return lines.join('\n');
  }

  /**
   * Group body parts by their subtype
   *
   * @param {Array<string>} partIds - Array of part entity IDs
   * @returns {Map<string, Array<object>>} Map of part type to entity arrays
   */
  groupPartsByType(partIds) {
    const partsByType = new Map();

    for (const partId of partIds) {
      const entity = this.entityFinder.getEntityInstance(partId);
      if (!entity) {
        continue;
      }

      // Check if entity has the required methods
      if (!entity || typeof entity.hasComponent !== 'function') {
        continue;
      }

      if (!entity.hasComponent('anatomy:part')) {
        continue;
      }

      if (typeof entity.getComponentData !== 'function') {
        continue;
      }

      const anatomyPart = entity.getComponentData('anatomy:part');
      if (!anatomyPart || !anatomyPart.subType) {
        continue;
      }

      const subType = anatomyPart.subType;

      if (!partsByType.has(subType)) {
        partsByType.set(subType, []);
      }
      partsByType.get(subType).push(entity);
    }

    return partsByType;
  }

  /**
   * Safely gets the anatomy:body component from an entity
   *
   * @param {object} bodyEntity - The entity
   * @returns {object|null} The body component data or null
   * @private
   */
  #getBodyComponent(bodyEntity) {
    if (!bodyEntity || typeof bodyEntity.getComponentData !== 'function') {
      return null;
    }

    try {
      return bodyEntity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
    } catch (error) {
      this.#logger.error('Failed to get anatomy:body component', error);
      return null;
    }
  }

  // Validation methods will be activated in future phases
  // Currently maintaining backward compatibility without strict validation

  /**
   * Extract height description from body entity
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Height description
   */
  extractHeightDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);

    // Check body.descriptors first
    if (bodyComponent?.body?.descriptors?.height) {
      return bodyComponent.body.descriptors.height;
    }

    // Fallback to entity-level component for backward compatibility
    if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
      const heightComponent = bodyEntity.getComponentData('descriptors:height');
      if (heightComponent?.height) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:height'. ` +
            'Please migrate to body.descriptors.height in anatomy:body component. ' +
            'Entity-level descriptors will be removed in a future version.'
        );
        return heightComponent.height;
      }
    }

    return '';
  }

  /**
   * Extract overall build description from body entity
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {string} Build descriptor value or empty string
   */
  extractBuildDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);

    // Check body.descriptors first
    if (bodyComponent?.body?.descriptors?.build) {
      return bodyComponent.body.descriptors.build;
    }

    // Fallback to entity-level component for backward compatibility
    if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
      const buildComponent = bodyEntity.getComponentData('descriptors:build');
      if (buildComponent?.build) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:build'. ` +
            'Please migrate to body.descriptors.build in anatomy:body component. ' +
            'Entity-level descriptors will be removed in a future version.'
        );
        return buildComponent.build;
      }
    }

    return '';
  }

  /**
   * Extract body composition description from body entity
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Body composition description
   */
  extractBodyCompositionDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);

    // Check body.descriptors first
    if (bodyComponent?.body?.descriptors?.composition) {
      return bodyComponent.body.descriptors.composition;
    }

    // Fallback to entity-level component for backward compatibility
    if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
      const compositionComponent = bodyEntity.getComponentData(
        'descriptors:body_composition'
      );
      if (compositionComponent?.composition) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:body_composition'. ` +
            'Please migrate to body.descriptors.composition in anatomy:body component. ' +
            'Entity-level descriptors will be removed in a future version.'
        );
        return compositionComponent.composition;
      }
    }

    return '';
  }

  /**
   * Extract body hair description from body entity
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Body hair description
   */
  extractBodyHairDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);

    // Check body.descriptors first (note: density maps to "Body hair")
    if (bodyComponent?.body?.descriptors?.density) {
      return bodyComponent.body.descriptors.density;
    }

    // Fallback to entity-level component for backward compatibility
    if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
      const bodyHairComponent = bodyEntity.getComponentData(
        'descriptors:body_hair'
      );
      if (bodyHairComponent?.density) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:body_hair'. ` +
            'Please migrate to body.descriptors.density in anatomy:body component. ' +
            'Entity-level descriptors will be removed in a future version.'
        );
        return bodyHairComponent.density;
      }
    }

    return '';
  }

  /**
   * Extract all body-level descriptors and return them as formatted strings
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {Object<string, string>} Map of descriptor type to formatted string
   */
  extractBodyLevelDescriptors(bodyEntity) {
    const descriptors = {};

    // Add height FIRST (before other descriptors)
    const heightDescription = this.extractHeightDescription(bodyEntity);
    if (heightDescription) {
      descriptors.height = `Height: ${heightDescription}`;
    }

    const skinColorDescription = this.extractSkinColorDescription(bodyEntity);
    if (skinColorDescription) {
      descriptors.skin_color = `Skin color: ${skinColorDescription}`;
    }

    const buildDescription = this.extractBuildDescription(bodyEntity);
    if (buildDescription) {
      descriptors.build = `Build: ${buildDescription}`;
    }

    const bodyHairDescription = this.extractBodyHairDescription(bodyEntity);
    if (bodyHairDescription) {
      descriptors.body_hair = `Body hair: ${bodyHairDescription}`;
    }

    const compositionDescription =
      this.extractBodyCompositionDescription(bodyEntity);
    if (compositionDescription) {
      descriptors.body_composition = `Body composition: ${compositionDescription}`;
    }

    return descriptors;
  }

  /**
   * Extract the body-level descriptor order from the overall description order
   *
   * @param {Array<string>} descriptionOrder - Full description order array
   * @returns {Array<string>} Ordered array of body descriptor types
   */
  getBodyDescriptorOrder(descriptionOrder) {
    const bodyDescriptorTypes = [
      'height', // Add height first in the list
      'skin_color',
      'build',
      'body_composition',
      'body_hair',
    ];
    return descriptionOrder.filter((type) =>
      bodyDescriptorTypes.includes(type)
    );
  }

  /**
   * Extract skin color description from body entity
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Skin color description
   */
  extractSkinColorDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);

    // Check body.descriptors first
    if (bodyComponent?.body?.descriptors?.skinColor) {
      return bodyComponent.body.descriptors.skinColor;
    }

    // Fallback to entity-level component for backward compatibility
    if (bodyEntity && typeof bodyEntity.getComponentData === 'function') {
      const skinColorComponent = bodyEntity.getComponentData(
        'descriptors:skin_color'
      );
      if (skinColorComponent?.skinColor) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:skin_color'. ` +
            'Please migrate to body.descriptors.skinColor in anatomy:body component. ' +
            'Entity-level descriptors will be removed in a future version.'
        );
        return skinColorComponent.skinColor;
      }
    }

    return '';
  }
}
