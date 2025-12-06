import { ANATOMY_BODY_COMPONENT_ID } from '../constants/componentIds.js';
import { DescriptionConfiguration } from './configuration/descriptionConfiguration.js';
import { DescriptionTemplate } from './templates/descriptionTemplate.js';
import { TextFormatter } from './templates/textFormatter.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import {
  BODY_DESCRIPTOR_REGISTRY,
  getDescriptorsByDisplayOrder,
} from './registries/bodyDescriptorRegistry.js';
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
    activityDescriptionService = null,
    injuryAggregationService = null,
    injuryNarrativeFormatterService = null,
    logger = null,
  } = {}) {
    this.bodyPartDescriptionBuilder = bodyPartDescriptionBuilder;
    this.bodyGraphService = bodyGraphService;
    this.entityFinder = entityFinder;
    this.anatomyFormattingService = anatomyFormattingService;
    this.partDescriptionGenerator = partDescriptionGenerator;
    this.equipmentDescriptionService = equipmentDescriptionService;
    this.activityDescriptionService = activityDescriptionService;
    this.injuryAggregationService = injuryAggregationService;
    this.injuryNarrativeFormatterService = injuryNarrativeFormatterService;
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
    // Defensive validation: ensure bodyEntity has the required interface
    if (!bodyEntity) {
      this.#logger.debug(
        'BodyDescriptionComposer.composeDescription: bodyEntity is null or undefined'
      );
      return '';
    }

    if (typeof bodyEntity.hasComponent !== 'function') {
      this.#logger.error(
        'BodyDescriptionComposer.composeDescription: bodyEntity does not have hasComponent method',
        {
          bodyEntityType: typeof bodyEntity,
          bodyEntityKeys: Object.keys(bodyEntity || {}),
          bodyEntityId: bodyEntity.id || 'unknown',
        }
      );
      return '';
    }

    if (typeof bodyEntity.getComponentData !== 'function') {
      this.#logger.error(
        'BodyDescriptionComposer.composeDescription: bodyEntity does not have getComponentData method',
        {
          bodyEntityType: typeof bodyEntity,
          bodyEntityKeys: Object.keys(bodyEntity || {}),
          bodyEntityId: bodyEntity.id || 'unknown',
        }
      );
      return '';
    }

    if (!bodyEntity.hasComponent(ANATOMY_BODY_COMPONENT_ID)) {
      this.#logger.debug(
        'BodyDescriptionComposer.composeDescription: bodyEntity does not have anatomy:body component',
        {
          bodyEntityId: bodyEntity.id || 'unknown',
        }
      );
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

    // Group parts by subtype (empty if no parts)
    const partsByType =
      allParts && allParts.length > 0
        ? this.groupPartsByType(allParts)
        : new Map();
    const visiblePartsByType = this.#filterVisibleParts(
      partsByType,
      bodyEntity
    );

    // Build structured description following configured order
    const lines = [];
    const descriptionOrder = this.config.getDescriptionOrder();
    const processedTypes = new Set();
    const healthLine = this.#composeHealthLine(bodyEntity);
    let healthLineInserted = false;

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
    this.#logger.debug('DIAGNOSTIC: Starting part processing loop', {
      descriptionOrderLength: descriptionOrder.length,
      descriptionOrder: descriptionOrder,
      hasActivityInOrder: descriptionOrder.includes('activity'),
    });

    for (const partType of descriptionOrder) {
      if (processedTypes.has(partType)) {
        continue;
      }

      // Skip body descriptor types as they're already handled above
      if (
        [
          'build',
          'body_composition',
          'body_hair',
          'skin_color',
          'smell',
        ].includes(partType)
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

      // Insert Health line after equipment and before inventory
      if (!healthLineInserted && partType === 'inventory' && healthLine) {
        lines.push(healthLine);
        healthLineInserted = true;
      }

      // DIAGNOSTIC: Check if we reach activity partType
      if (partType === 'activity') {
        this.#logger.debug('DIAGNOSTIC: Reached activity partType', {
          partType,
          hasActivityService: !!this.activityDescriptionService,
          activityServiceType: typeof this.activityDescriptionService,
        });
      }

      // Handle activity descriptions
      if (partType === 'activity' && this.activityDescriptionService) {
        this.#logger.debug(
          'Activity description: calling service with entity',
          {
            entityId: bodyEntity.id,
            componentTypeIds: bodyEntity.componentTypeIds || 'not available',
          }
        );

        const activityDescription =
          await this.activityDescriptionService.generateActivityDescription(
            bodyEntity.id
          );

        this.#logger.debug('Activity description: service returned', {
          entityId: bodyEntity.id,
          hasDescription: !!activityDescription,
          descriptionLength: activityDescription?.length || 0,
        });

        if (activityDescription) {
          lines.push(activityDescription);
        }
        processedTypes.add(partType);
        continue;
      }

      // Handle inventory descriptions
      if (partType === 'inventory') {
        const inventoryDescription =
          await this.#generateInventoryDescription(bodyEntity);
        if (inventoryDescription) {
          lines.push(inventoryDescription);
        }
        processedTypes.add(partType);
        continue;
      }

      // Process body parts
      if (visiblePartsByType.has(partType)) {
        const parts = visiblePartsByType.get(partType);
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

    if (!healthLineInserted && healthLine) {
      lines.push(healthLine);
    }

    // Join all lines with newlines
    return lines.join('\n');
  }

  /**
   * Filter out parts hidden by clothing visibility rules
   *
   * @param {Map<string, Array<object>>} partsByType
   * @param {object} bodyEntity
   * @returns {Map<string, Array<object>>}
   */
  #filterVisibleParts(partsByType, bodyEntity) {
    if (!partsByType || !(partsByType instanceof Map)) {
      return new Map();
    }

    const filtered = new Map();

    for (const [partType, parts] of partsByType.entries()) {
      const visibleParts = (parts || []).filter((part) =>
        this.#isPartVisible(part, bodyEntity)
      );

      if (visibleParts.length > 0) {
        filtered.set(partType, visibleParts);
      }
    }

    return filtered;
  }

  /**
   * Determine whether a part should be described based on clothing coverage
   *
   * @param {object} partEntity
   * @param {object} bodyEntity
   * @returns {boolean}
   */
  #isPartVisible(partEntity, bodyEntity) {
    if (!partEntity || typeof partEntity.getComponentData !== 'function') {
      return true;
    }

    const visibilityRules = this.#getComponentSafe(
      partEntity,
      'anatomy:visibility_rules'
    );

    if (!visibilityRules || !visibilityRules.nonBlockingLayers) {
      return true;
    }

    const joint = this.#getComponentSafe(partEntity, 'anatomy:joint');
    if (!joint || !joint.socketId) {
      return true;
    }

    const slotMetadata = this.#getComponentSafe(
      bodyEntity,
      'clothing:slot_metadata'
    );
    const coveringSlots = this.#getCoveringSlotsForSocket(
      slotMetadata,
      joint.socketId
    );

    if (!coveringSlots || coveringSlots.length === 0) {
      return true;
    }

    let targetSlots = coveringSlots;
    if (visibilityRules.clothingSlotId) {
      const narrowed = coveringSlots.filter(
        (slotId) => slotId === visibilityRules.clothingSlotId
      );
      if (narrowed.length > 0) {
        targetSlots = narrowed;
      }
    }

    const nonBlockingLayers = new Set(visibilityRules.nonBlockingLayers || []);
    const equipmentData = this.#getComponentSafe(
      bodyEntity,
      'clothing:equipment'
    );

    const hasDirectBlock = targetSlots.some((slotId) =>
      this.#slotHasBlockingLayer(equipmentData, slotId, nonBlockingLayers)
    );
    if (hasDirectBlock) {
      return false;
    }

    if (
      this.#isBlockedByCoverageMapping(
        equipmentData,
        targetSlots,
        nonBlockingLayers
      )
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get clothing slots that cover a given socket from slot metadata
   *
   * @param {object|null} slotMetadata
   * @param {string} socketId
   * @returns {Array<string>}
   */
  #getCoveringSlotsForSocket(slotMetadata, socketId) {
    if (
      !slotMetadata ||
      !slotMetadata.slotMappings ||
      typeof slotMetadata.slotMappings !== 'object'
    ) {
      return [];
    }

    const coveringSlots = [];

    for (const [slotId, mapping] of Object.entries(slotMetadata.slotMappings)) {
      if (
        mapping &&
        Array.isArray(mapping.coveredSockets) &&
        mapping.coveredSockets.includes(socketId)
      ) {
        coveringSlots.push(slotId);
      }
    }

    return coveringSlots;
  }

  /**
   * Check if a clothing slot has blocking items equipped
   *
   * @param {object|null} equipmentData
   * @param {string} slotId
   * @param {Set<string>} nonBlockingLayers
   * @returns {boolean}
   */
  #slotHasBlockingLayer(equipmentData, slotId, nonBlockingLayers) {
    if (!equipmentData || !equipmentData.equipped) {
      return false;
    }

    const slot = equipmentData.equipped[slotId];

    if (!slot || typeof slot !== 'object') {
      return false;
    }

    return Object.entries(slot).some(([layer, items]) => {
      if (nonBlockingLayers.has(layer)) {
        return false;
      }

      return this.#normalizeItems(items).length > 0;
    });
  }

  /**
   * Normalize equipped item values to a string array
   *
   * @param {string|Array|string[]|object|null|undefined} items
   * @returns {Array<string>}
   */
  #normalizeItems(items) {
    if (Array.isArray(items)) {
      return items.filter(
        (item) => typeof item === 'string' && item.trim() !== ''
      );
    }

    if (typeof items === 'string') {
      return items.trim() !== '' ? [items] : [];
    }

    if (items && typeof items === 'object') {
      return Object.values(items).filter(
        (item) => typeof item === 'string' && item.trim() !== ''
      );
    }

    return [];
  }

  /**
   * Determine if coverage mapping from other slots blocks the target slots
   *
   * @param {object|null} equipmentData
   * @param {Array<string>} targetSlots
   * @param {Set<string>} nonBlockingLayers
   * @returns {boolean}
   */
  #isBlockedByCoverageMapping(equipmentData, targetSlots, nonBlockingLayers) {
    if (
      !equipmentData ||
      !equipmentData.equipped ||
      typeof this.entityFinder?.getEntityInstance !== 'function'
    ) {
      return false;
    }

    for (const slotLayers of Object.values(equipmentData.equipped)) {
      if (!slotLayers || typeof slotLayers !== 'object') {
        continue;
      }

      for (const [layer, items] of Object.entries(slotLayers)) {
        const itemIds = this.#normalizeItems(items);
        if (itemIds.length === 0) {
          continue;
        }

        for (const itemId of itemIds) {
          const itemEntity = this.entityFinder.getEntityInstance(itemId);
          if (!itemEntity) {
            continue;
          }

          const coverageMapping = this.#getComponentSafe(
            itemEntity,
            'clothing:coverage_mapping'
          );

          if (
            !coverageMapping ||
            !Array.isArray(coverageMapping.covers) ||
            coverageMapping.covers.length === 0
          ) {
            continue;
          }

          const coverageLayer = coverageMapping.coveragePriority || layer;

          if (nonBlockingLayers.has(coverageLayer)) {
            continue;
          }

          if (
            coverageMapping.covers.some((coveredSlot) =>
              targetSlots.includes(coveredSlot)
            )
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Safely fetch a component from an entity without throwing
   *
   * @param {object|null} entity
   * @param {string} componentId
   * @returns {object|null}
   */
  #getComponentSafe(entity, componentId) {
    if (!entity || typeof entity.getComponentData !== 'function') {
      return null;
    }

    try {
      return entity.getComponentData(componentId);
    } catch (error) {
      this.#logger?.debug?.(
        `BodyDescriptionComposer: failed to read component '${componentId}'`,
        { error }
      );
      return null;
    }
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
        this.#logger.warn(
          'BodyDescriptionComposer.groupPartsByType: Part entity missing hasComponent method',
          {
            partId,
            entityType: typeof entity,
            entityKeys: entity ? Object.keys(entity) : [],
          }
        );
        continue;
      }

      if (!entity.hasComponent('anatomy:part')) {
        continue;
      }

      if (typeof entity.getComponentData !== 'function') {
        this.#logger.warn(
          'BodyDescriptionComposer.groupPartsByType: Part entity missing getComponentData method',
          {
            partId,
            entityType: typeof entity,
            entityKeys: entity ? Object.keys(entity) : [],
          }
        );
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
   * Kept for backward compatibility but delegates to registry
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Raw height value or empty string (not formatted)
   */
  extractHeightDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);
    const value = BODY_DESCRIPTOR_REGISTRY.height.extractor(bodyComponent);

    // Fallback to entity-level component for backward compatibility
    if (
      !value &&
      bodyEntity &&
      typeof bodyEntity.getComponentData === 'function'
    ) {
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

    return value || '';
  }

  /**
   * Extract overall build description from body entity
   * Kept for backward compatibility but delegates to registry
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {string} Build descriptor value or empty string (not formatted)
   */
  extractBuildDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);
    const value = BODY_DESCRIPTOR_REGISTRY.build.extractor(bodyComponent);

    // Fallback to entity-level component for backward compatibility
    if (
      !value &&
      bodyEntity &&
      typeof bodyEntity.getComponentData === 'function'
    ) {
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

    return value || '';
  }

  /**
   * Extract body composition description from body entity
   * Kept for backward compatibility but delegates to registry
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Body composition value or empty string (not formatted)
   */
  extractBodyCompositionDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);
    const value = BODY_DESCRIPTOR_REGISTRY.composition.extractor(bodyComponent);

    // Fallback to entity-level component for backward compatibility
    if (
      !value &&
      bodyEntity &&
      typeof bodyEntity.getComponentData === 'function'
    ) {
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

    return value || '';
  }

  /**
   * Extract body hair description from body entity
   * Kept for backward compatibility but delegates to registry
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Body hair value or empty string (not formatted)
   */
  extractBodyHairDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);
    const value = BODY_DESCRIPTOR_REGISTRY.hairDensity.extractor(bodyComponent);

    // Fallback to entity-level component for backward compatibility
    if (
      !value &&
      bodyEntity &&
      typeof bodyEntity.getComponentData === 'function'
    ) {
      const bodyHairComponent = bodyEntity.getComponentData(
        'descriptors:body_hair'
      );
      if (bodyHairComponent?.hairDensity || bodyHairComponent?.density) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:body_hair'. ` +
            'Please migrate to body.descriptors.hairDensity in anatomy:body component. ' +
            'Entity-level descriptors will be removed in a future version.'
        );
        return bodyHairComponent.hairDensity || bodyHairComponent.density;
      }
    }

    return value || '';
  }

  /**
   * Extract all body-level descriptors and return them as formatted strings
   * Uses centralized registry for extraction and formatting
   * Falls back to deprecated entity-level components for backward compatibility
   *
   * @param {object} bodyEntity - The entity with anatomy:body component
   * @returns {Object<string, string>} Map of descriptor type to formatted string
   */
  extractBodyLevelDescriptors(bodyEntity) {
    const descriptors = {};

    // Map registry descriptor names to their extraction methods
    // These methods include fallback logic for deprecated entity-level components
    const extractionMethodMap = {
      height: this.extractHeightDescription.bind(this),
      skinColor: this.extractSkinColorDescription.bind(this),
      build: this.extractBuildDescription.bind(this),
      composition: this.extractBodyCompositionDescription.bind(this),
      hairDensity: this.extractBodyHairDescription.bind(this),
      smell: this.extractSmellDescription.bind(this),
    };

    // Iterate through registry in display order
    for (const descriptorName of getDescriptorsByDisplayOrder()) {
      const metadata = BODY_DESCRIPTOR_REGISTRY[descriptorName];
      const extractMethod = extractionMethodMap[descriptorName];

      if (extractMethod) {
        // Use extraction method which includes fallback logic
        const value = extractMethod(bodyEntity);

        if (value) {
          // Use formatter from registry (formatters already include label)
          // e.g., formatter returns "Height: tall" not just "tall"
          descriptors[metadata.displayKey] = metadata.formatter(value);
        }
      }
    }

    return descriptors;
  }

  /**
   * Extract the body-level descriptor order from the overall description order
   * Derives from registry instead of hardcoded list
   *
   * @param {Array<string>} descriptionOrder - Full description order array
   * @returns {Array<string>} Ordered array of body descriptor types
   */
  getBodyDescriptorOrder(descriptionOrder) {
    // Get all display keys from registry
    const registryDisplayKeys = getDescriptorsByDisplayOrder().map(
      (name) => BODY_DESCRIPTOR_REGISTRY[name].displayKey
    );

    // Filter the config order to only include registry display keys
    // This maintains config-specified order while using registry as source of truth
    const filtered = descriptionOrder.filter((type) =>
      registryDisplayKeys.includes(type)
    );

    // Defensive: ensure height is first if present in registry but missing from config
    if (
      registryDisplayKeys.includes('height') &&
      !filtered.includes('height')
    ) {
      filtered.unshift('height');
    }

    return filtered;
  }

  /**
   * Extract skin color description from body entity
   * Kept for backward compatibility but delegates to registry
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Skin color value or empty string (not formatted)
   */
  extractSkinColorDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);
    const value = BODY_DESCRIPTOR_REGISTRY.skinColor.extractor(bodyComponent);

    // Fallback to entity-level component for backward compatibility
    if (
      !value &&
      bodyEntity &&
      typeof bodyEntity.getComponentData === 'function'
    ) {
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

    return value || '';
  }

  /**
   * Extract smell description from body entity
   * Kept for backward compatibility but delegates to registry
   *
   * @param {object} bodyEntity - The body entity
   * @returns {string} Smell value or empty string (not formatted)
   */
  extractSmellDescription(bodyEntity) {
    const bodyComponent = this.#getBodyComponent(bodyEntity);
    const value = BODY_DESCRIPTOR_REGISTRY.smell.extractor(bodyComponent);

    // Fallback to entity-level component for backward compatibility
    if (
      !value &&
      bodyEntity &&
      typeof bodyEntity.getComponentData === 'function'
    ) {
      const smellComponent = bodyEntity.getComponentData('descriptors:smell');
      if (smellComponent?.smell) {
        // eslint-disable-next-line no-console
        console.warn(
          `[DEPRECATION] Entity ${bodyEntity.id || 'unknown'} uses entity-level descriptor 'descriptors:smell'. ` +
            'Please migrate to body.descriptors.smell in anatomy:body component. ' +
            'Entity-level descriptors will be removed in a future version.'
        );
        return smellComponent.smell;
      }
    }

    return value || '';
  }

  /**
   * Generate description for conspicuous items in inventory
   *
   * @param {object} bodyEntity - The entity
   * @returns {Promise<string>} Formatted inventory description
   * @private
   */
  async #generateInventoryDescription(bodyEntity) {
    if (
      !bodyEntity ||
      typeof bodyEntity.getComponentData !== 'function' ||
      !bodyEntity.hasComponent('items:inventory')
    ) {
      return '';
    }

    try {
      const inventoryData = bodyEntity.getComponentData('items:inventory');
      if (
        !inventoryData ||
        !inventoryData.items ||
        !Array.isArray(inventoryData.items) ||
        inventoryData.items.length === 0
      ) {
        return '';
      }

      const conspicuousItemNames = [];

      for (const itemId of inventoryData.items) {
        const itemEntity = this.entityFinder.getEntityInstance(itemId);
        if (!itemEntity) {
          continue;
        }

        if (itemEntity.hasComponent('core:conspicuous')) {
          const nameData = itemEntity.getComponentData('core:name');
          if (nameData && nameData.text) {
            conspicuousItemNames.push(nameData.text);
          }
        }
      }

      if (conspicuousItemNames.length === 0) {
        return '';
      }

      return `Inventory: ${conspicuousItemNames.join(', ')}.`;
    } catch (error) {
      this.#logger.error(
        `Failed to generate inventory description for entity ${bodyEntity.id}`,
        error
      );
      return '';
    }
  }

  /**
   * Compose a third-person health line if formatter dependencies are available.
   *
   * @param {object} bodyEntity - The entity with anatomy:body
   * @returns {string} Health line prefixed with "Health:" or empty string when unavailable
   * @private
   */
  #composeHealthLine(bodyEntity) {
    if (
      !this.injuryAggregationService ||
      !this.injuryNarrativeFormatterService ||
      !bodyEntity?.id
    ) {
      return '';
    }

    try {
      const summary = this.injuryAggregationService.aggregateInjuries(
        bodyEntity.id
      );
      const narrative =
        this.injuryNarrativeFormatterService.formatThirdPersonVisible(summary);

      if (!narrative) {
        return '';
      }

      return `Health: ${narrative.trim()}`;
    } catch (error) {
      this.#logger.debug?.(
        'BodyDescriptionComposer: failed to compose health line',
        {
          error,
        }
      );
      return '';
    }
  }
}
