/**
 * @file Service for generating equipment (clothing) descriptions
 * @see src/anatomy/bodyDescriptionComposer.js
 * @see src/anatomy/descriptorFormatter.js
 */

import {
  validateDependency,
  ensureValidLogger,
  assertNonBlankString,
} from '../../utils/index.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../anatomy/descriptorFormatter.js').DescriptorFormatter} DescriptorFormatter */
/** @typedef {import('./clothingManagementService.js').ClothingManagementService} ClothingManagementService */
/** @typedef {import('../../services/anatomyFormattingService.js').AnatomyFormattingService} AnatomyFormattingService */

/**
 * Service for generating equipment descriptions for worn clothing items
 */
class EquipmentDescriptionService {
  // Component types that can be present on clothing items
  static COMPONENT_TYPES = [
    'core:name',
    'core:description',
    'clothing:wearable',
    'core:material',
    'descriptors:color_basic',
    'descriptors:color_extended',
    'descriptors:texture',
    'descriptors:style',
    'descriptors:fit',
    'descriptors:condition',
  ];

  #logger;
  #entityManager;
  #descriptorFormatter;
  #clothingManagementService;
  #anatomyFormattingService;

  constructor({
    logger,
    entityManager,
    descriptorFormatter,
    clothingManagementService,
    anatomyFormattingService,
  }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);

    validateDependency(entityManager, 'IEntityManager');
    validateDependency(descriptorFormatter, 'DescriptorFormatter');
    validateDependency(clothingManagementService, 'ClothingManagementService');
    validateDependency(anatomyFormattingService, 'AnatomyFormattingService');

    this.#entityManager = entityManager;
    this.#descriptorFormatter = descriptorFormatter;
    this.#clothingManagementService = clothingManagementService;
    this.#anatomyFormattingService = anatomyFormattingService;
  }

  /**
   * Generate equipment description for an entity
   *
   * @param {string} entityId - Entity ID to generate equipment description for
   * @returns {Promise<string>} Formatted equipment description
   */
  async generateEquipmentDescription(entityId) {
    assertNonBlankString(
      entityId,
      'Entity ID',
      'EquipmentDescriptionService.generateEquipmentDescription',
      this.#logger
    );

    try {
      this.#logger.debug(
        `Generating equipment description for entity: ${entityId}`
      );

      const equippedItems = await this.#getEquippedItems(entityId);
      if (!equippedItems || equippedItems.length === 0) {
        this.#logger.debug(`No equipment found for entity: ${entityId}`);
        return '';
      }

      const groupedItems = this.#groupItemsByCategory(equippedItems);
      const itemDescriptions =
        await this.#generateItemDescriptions(groupedItems);

      return this.#formatEquipmentDescription(itemDescriptions);
    } catch (error) {
      this.#logger.error(
        `Failed to generate equipment description for entity ${entityId}`,
        error
      );
      return '';
    }
  }

  /**
   * Get equipped items using ClothingManagementService
   *
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array<{id: string, slotId: string, layerIndex: number, garmentId: string}>>}
   * @private
   */
  async #getEquippedItems(entityId) {
    try {
      const response =
        await this.#clothingManagementService.getEquippedItems(entityId);

      // Handle service response format {success: boolean, equipped?: object, errors?: string[]}
      if (!response.success) {
        this.#logger.warn(
          `Failed to get equipped items for entity ${entityId}: ${response.errors?.join(', ')}`
        );
        return [];
      }

      const equippedData = response.equipped;
      if (!equippedData || typeof equippedData !== 'object') {
        return [];
      }

      // Transform the equipped object structure to array format
      const formattedItems = [];

      for (const [slotId, slotData] of Object.entries(equippedData)) {
        if (slotData && typeof slotData === 'object') {
          // Handle nested layer structure like: {base: 'itemId', outer: 'itemId'}
          for (const [layerName, garmentId] of Object.entries(slotData)) {
            if (garmentId && typeof garmentId === 'string') {
              // Convert layer name to numeric index for sorting
              const layerIndex = this.#getLayerIndex(layerName);

              formattedItems.push({
                id: garmentId,
                slotId: slotId,
                layerIndex: layerIndex,
                garmentId: garmentId,
              });
            }
          }
        }
      }

      // Sort by layer index (outer to inner)
      return formattedItems.sort((a, b) => b.layerIndex - a.layerIndex);
    } catch (error) {
      this.#logger.error(
        `Failed to get equipped items for entity ${entityId}`,
        error
      );
      return [];
    }
  }

  /**
   * Convert layer name to numeric index for sorting
   *
   * @param {string} layerName - Layer name from equipment data
   * @returns {number} Numeric layer index
   * @private
   */
  #getLayerIndex(layerName) {
    const layerMapping = {
      base: 0,
      underwear: 1,
      inner: 2,
      middle: 3,
      outer: 4,
      accessories: 5,
      outerwear: 6,
    };

    return layerMapping[layerName] || 0;
  }

  /**
   * Group items by category for better organization
   *
   * @param {Array<{id: string, slotId: string, layerIndex: number}>} items
   * @returns {Object<string, Array>} Grouped items
   * @private
   */
  #groupItemsByCategory(items) {
    const groups = {
      outerwear: [],
      tops: [],
      bottoms: [],
      underwear: [],
      footwear: [],
      accessories: [],
      other: [],
    };

    const categoryMapping = {
      // Outerwear
      jacket_clothing: 'outerwear',
      coat_clothing: 'outerwear',

      // Tops
      torso_clothing: 'tops',
      shirt_clothing: 'tops',

      // Bottoms
      legs_clothing: 'bottoms',
      pants_clothing: 'bottoms',
      skirt_clothing: 'bottoms',

      // Underwear
      underwear_top: 'underwear',
      underwear_bottom: 'underwear',
      bra: 'underwear',
      panties: 'underwear',

      // Footwear
      feet_clothing: 'footwear',
      shoes_clothing: 'footwear',
      socks: 'footwear',

      // Accessories
      belt_clothing: 'accessories',
      head_clothing: 'accessories',
      hands_clothing: 'accessories',
      neck_clothing: 'accessories',
    };

    for (const item of items) {
      const category = categoryMapping[item.slotId] || 'other';
      groups[category].push(item);
    }

    // Remove empty categories
    return Object.fromEntries(
      Object.entries(groups).filter(([_, items]) => items.length > 0)
    );
  }

  /**
   * Generate descriptions for all items
   *
   * @param {Object<string, Array>} groupedItems
   * @returns {Promise<Array<{category: string, descriptions: string[]}>>}
   * @private
   */
  async #generateItemDescriptions(groupedItems) {
    const descriptions = [];

    for (const [category, items] of Object.entries(groupedItems)) {
      const categoryDescriptions = [];

      for (const item of items) {
        const entity = await this.#entityManager.getEntityInstance(
          item.garmentId
        );
        if (!entity) {
          this.#logger.warn(`Could not find entity for garment: ${item.id}`);
          continue;
        }

        const description = await this.#formatItemDescription(entity);
        if (description) {
          categoryDescriptions.push(description);
        }
      }

      if (categoryDescriptions.length > 0) {
        descriptions.push({ category, descriptions: categoryDescriptions });
      }
    }

    return descriptions;
  }

  /**
   * Format individual item description
   *
   * @param {object} entity - Item entity
   * @returns {Promise<string>} Formatted item description
   * @private
   */
  async #formatItemDescription(entity) {
    try {
      // Extract descriptors from entity components
      const descriptors = [];

      // Handle both direct components property and getComponentData method
      let components = entity.components;
      if (!components && entity.getComponentData) {
        components = this.#extractEntityComponents(entity);
      }

      if (!components) {
        this.#logger.warn(
          `No components found for equipment entity: ${entity.id}`
        );
        return '';
      }

      // Order of descriptor types to check
      const descriptorOrder = [
        'core:material',
        'descriptors:color_basic',
        'descriptors:color_extended',
        'descriptors:texture',
        'descriptors:style',
        'descriptors:fit',
        'descriptors:condition',
      ];

      for (const descriptorType of descriptorOrder) {
        if (components[descriptorType]) {
          const value = this.#extractDescriptorValue(
            components[descriptorType]
          );
          if (value) {
            descriptors.push({ componentId: descriptorType, value });
          }
        }
      }

      // Get the item name from core:name or core:description
      let itemName = '';
      if (components['core:name'] && components['core:name'].text) {
        itemName = components['core:name'].text;
      } else if (
        components['core:description'] &&
        components['core:description'].text
      ) {
        itemName = components['core:description'].text;
      }

      if (!itemName) {
        this.#logger.warn(`No name found for equipment entity: ${entity.id}`);
        this.#logger.debug(
          `Available components: ${Object.keys(components).join(', ')}`
        );
        return '';
      }

      // Format descriptors
      const formattedDescriptors = this.#descriptorFormatter.formatDescriptors(
        descriptors,
        { separator: ', ' }
      );

      // Combine descriptors with item name
      if (formattedDescriptors) {
        return `${formattedDescriptors} ${itemName}`;
      }
      return itemName;
    } catch (error) {
      this.#logger.error(
        `Failed to format item description for entity ${entity.id}`,
        error
      );
      return '';
    }
  }

  /**
   * Extract descriptor value from component data
   *
   * @param {object} componentData
   * @returns {string|null}
   * @private
   */
  #extractDescriptorValue(componentData) {
    // Common keys that might contain the value
    const valueKeys = [
      'value',
      'material',
      'color',
      'texture',
      'style',
      'fit',
      'condition',
    ];

    for (const key of valueKeys) {
      if (componentData[key]) {
        return componentData[key];
      }
    }

    // Fallback to first string value
    const values = Object.values(componentData);
    const stringValue = values.find((v) => typeof v === 'string');
    return stringValue || null;
  }

  /**
   * Extract entity components using getComponentData method
   *
   * @param {object} entity - Entity instance
   * @returns {object} Components object
   * @private
   */
  #extractEntityComponents(entity) {
    const components = {};

    for (const compType of EquipmentDescriptionService.COMPONENT_TYPES) {
      try {
        const data = entity.getComponentData(compType);
        if (data) {
          components[compType] = data;
        }
      } catch (e) {
        // Component doesn't exist on entity - this is expected
      }
    }

    return components;
  }

  /**
   * Format the complete equipment description
   *
   * @param {Array<{category: string, descriptions: string[]}>} itemDescriptions
   * @returns {string} Formatted equipment description
   * @private
   */
  #formatEquipmentDescription(itemDescriptions) {
    if (itemDescriptions.length === 0) {
      return '';
    }

    // Get equipment integration configuration
    const config =
      this.#anatomyFormattingService.getEquipmentIntegrationConfig();

    // Determine the order of categories to present
    const categoryOrder = [
      'outerwear',
      'tops',
      'bottoms',
      'underwear',
      'footwear',
      'accessories',
      'other',
    ];

    // Sort descriptions by category order
    itemDescriptions.sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a.category);
      const bIndex = categoryOrder.indexOf(b.category);
      return aIndex - bIndex;
    });

    // Flatten all descriptions in order
    const allDescriptions = [];
    for (const { descriptions } of itemDescriptions) {
      allDescriptions.push(...descriptions);
    }

    // Format using configuration
    const prefix = config.prefix || 'Wearing: ';
    const suffix = config.suffix || '.';
    const itemSeparator = config.itemSeparator || ' | ';

    // Format as a sentence with proper separators
    if (allDescriptions.length === 1) {
      return `${prefix}${allDescriptions[0]}${suffix}`;
    } else if (allDescriptions.length === 2) {
      return `${prefix}${allDescriptions[0]} and ${allDescriptions[1]}${suffix}`;
    } else {
      const lastItem = allDescriptions.pop();
      return `${prefix}${allDescriptions.join(itemSeparator)}, and ${lastItem}${suffix}`;
    }
  }
}

export default EquipmentDescriptionService;
