/**
 * @file Test data factory for clothing system tests
 * @description Provides standardized test data for clothing tests, including
 * the Layla Agirre scenario and other complex equipment configurations
 */

import { ClothingIntegrationTestBed } from './clothingIntegrationTestBed.js';

/**
 * Factory class for creating standardized test data for clothing tests
 */
export class ClothingTestDataFactory {
  /**
   * Creates the Layla Agirre equipment configuration
   * This reproduces the exact scenario from the bug report
   *
   * @returns {object} Equipment configuration with trousers blocking boxer brief
   */
  static createLaylaAgirreEquipment() {
    return {
      equipped: {
        torso_lower: {
          base: 'clothing:dark_olive_high_rise_double_pleat_trousers',
          underwear: 'clothing:power_mesh_boxer_brief',
        },
      },
    };
  }

  /**
   * Creates a multi-layer equipment configuration for torso
   *
   * @returns {object} Equipment with outer, base, and underwear layers
   */
  static createMultiLayerTorsoEquipment() {
    return {
      equipped: {
        torso_upper: {
          outer: 'clothing:winter_coat',
          base: 'clothing:sweater',
          underwear: 'clothing:undershirt',
        },
      },
    };
  }

  /**
   * Creates equipment across multiple body areas
   *
   * @returns {object} Equipment covering head, torso, and feet
   */
  static createCrossAreaEquipment() {
    return {
      equipped: {
        head: {
          base: 'clothing:hat',
        },
        torso_upper: {
          outer: 'clothing:jacket',
          base: 'clothing:shirt',
        },
        torso_lower: {
          base: 'clothing:pants',
          underwear: 'clothing:underwear',
        },
        feet: {
          outer: 'clothing:boots',
          base: 'clothing:socks',
        },
      },
    };
  }

  /**
   * Creates a large wardrobe with many items
   *
   * @param {number} itemCount - Number of items to generate (default: 50)
   * @returns {object} Large equipment configuration
   */
  static createLargeWardrobeEquipment(itemCount = 50) {
    const equipment = { equipped: {} };
    const slots = [
      'head',
      'torso_upper',
      'torso_lower',
      'arms',
      'legs',
      'feet',
      'hands',
    ];
    const layers = ['outer', 'base', 'underwear', 'accessories'];

    let itemsCreated = 0;
    let slotIndex = 0;

    while (itemsCreated < itemCount) {
      const slot = slots[slotIndex % slots.length];

      if (!equipment.equipped[slot]) {
        equipment.equipped[slot] = {};
      }

      // Add items to different layers
      layers.forEach((layer) => {
        if (itemsCreated >= itemCount) return;

        if (layer === 'accessories') {
          // Accessories can be arrays
          if (!equipment.equipped[slot][layer]) {
            equipment.equipped[slot][layer] = [];
          }
          equipment.equipped[slot][layer].push(`clothing:item_${itemsCreated}`);
        } else {
          equipment.equipped[slot][layer] = `clothing:item_${itemsCreated}`;
        }

        itemsCreated++;
      });

      slotIndex++;
    }

    return equipment;
  }

  /**
   * Creates equipment with partial configuration (some slots empty)
   *
   * @returns {object} Partial equipment configuration
   */
  static createPartialEquipment() {
    return {
      equipped: {
        torso_upper: {
          base: 'clothing:shirt',
        },
        // torso_lower is intentionally empty
        feet: {
          outer: 'clothing:shoes',
          // No socks (base layer missing)
        },
      },
    };
  }

  /**
   * Creates equipment with malformed data for error testing
   *
   * @returns {object} Malformed equipment configuration
   */
  static createMalformedEquipment() {
    return {
      equipped: {
        invalid_slot: 'not-an-object', // String instead of object
        torso_upper: {
          base: 'clothing:shirt',
          invalid_layer: { nested: 'object' }, // Object instead of string
        },
        hands: {
          accessories: ['clothing:ring', null, 123, undefined], // Mixed types
        },
      },
    };
  }

  /**
   * Creates coverage mapping data for test items
   *
   * @param {string} itemId - The item ID
   * @param {string} slot - The body slot
   * @param {string} layer - The layer (outer, base, underwear)
   * @returns {object} Coverage mapping data
   */
  static createCoverageMapping(itemId, slot, layer) {
    const priorityMap = {
      outer: 'outer',
      base: 'base',
      underwear: 'underwear',
      accessories: 'direct',
    };

    return {
      covers: [slot],
      coveragePriority: priorityMap[layer] || 'base',
    };
  }

  /**
   * Creates a complete test entity with equipment
   *
   * @param {string} entityId - The entity ID
   * @param {object} equipment - Equipment configuration
   * @returns {object} Complete entity configuration
   */
  static createTestEntity(entityId, equipment) {
    return {
      id: entityId,
      components: {
        'core:actor': {
          name: entityId,
        },
        'clothing:equipment': equipment,
      },
    };
  }

  /**
   * Creates mock entity manager responses for testing
   *
   * @param {object} equipment - Equipment configuration
   * @returns {function} Mock implementation for getComponentData
   */
  static createMockEntityManagerImplementation(equipment) {
    return (entityId, component) => {
      if (component === 'clothing:equipment') {
        return equipment;
      }
      if (component === 'clothing:coverage_mapping') {
        // Return mock coverage data
        return {
          covers: ['body_area'],
          coveragePriority: 'base',
        };
      }
      return null;
    };
  }

  /**
   * Creates mock entities gateway responses for coverage mapping
   *
   * @param {object} coverageMappings - Map of itemId to coverage data
   * @returns {function} Mock implementation for getComponentData
   */
  static createMockEntitiesGatewayImplementation(coverageMappings = {}) {
    return (entityId, component) => {
      if (component === 'clothing:coverage_mapping') {
        return (
          coverageMappings[entityId] || {
            covers: ['body_area'],
            coveragePriority: 'base',
          }
        );
      }
      return null;
    };
  }

  /**
   * Creates the specific Layla Agirre coverage mappings
   *
   * @returns {object} Coverage mappings for Layla Agirre scenario
   */
  static createLaylaAgirreCoverageMappings() {
    return {
      'clothing:dark_olive_high_rise_double_pleat_trousers': {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      },
      'clothing:power_mesh_boxer_brief': {
        covers: ['torso_lower'],
        coveragePriority: 'underwear',
      },
    };
  }

  /**
   * Creates coverage mappings for multi-layer scenario
   *
   * @returns {object} Coverage mappings for multi-layer equipment
   */
  static createMultiLayerCoverageMappings() {
    return {
      'clothing:winter_coat': {
        covers: ['torso_upper'],
        coveragePriority: 'outer',
      },
      'clothing:sweater': {
        covers: ['torso_upper'],
        coveragePriority: 'base',
      },
      'clothing:undershirt': {
        covers: ['torso_upper'],
        coveragePriority: 'underwear',
      },
      'clothing:jacket': {
        covers: ['torso_upper'],
        coveragePriority: 'outer',
      },
      'clothing:shirt': {
        covers: ['torso_upper'],
        coveragePriority: 'base',
      },
      'clothing:pants': {
        covers: ['torso_lower'],
        coveragePriority: 'base',
      },
      'clothing:underwear': {
        covers: ['torso_lower'],
        coveragePriority: 'underwear',
      },
      'clothing:boots': {
        covers: ['feet'],
        coveragePriority: 'outer',
      },
      'clothing:socks': {
        covers: ['feet'],
        coveragePriority: 'base',
      },
      'clothing:hat': {
        covers: ['head'],
        coveragePriority: 'base',
      },
    };
  }
}

export default ClothingTestDataFactory;
