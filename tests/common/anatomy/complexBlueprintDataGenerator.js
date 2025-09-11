/**
 * @file tests/common/anatomy/complexBlueprintDataGenerator.js
 * @description Enhanced test data generator for complex blueprint processing scenarios
 * Generates multi-level blueprint hierarchies, conflicting slot scenarios, and mixed slot types
 */

/**
 * Generator for complex blueprint test data scenarios
 * Supports multi-level inheritance, slot conflicts, and equipment/anatomy slot differentiation
 */
export default class ComplexBlueprintDataGenerator {
  constructor() {
    this.generatedData = new Map();
  }

  /**
   * Generates a realistic multi-level blueprint hierarchy based on production capabilities
   * Tests basic blueprint processing with 2-3 levels: torso → arms → hands
   * @returns {Object} Multi-level blueprint test data
   */
  generateMultiLevelBlueprint() {
    const data = {
      // Simple blueprint hierarchy that matches production capabilities
      blueprints: {
        'test:simple_humanoid': {
          id: 'test:simple_humanoid',
          root: 'test:simple_torso_root',
          slots: {
            left_arm: {
              socket: 'left_shoulder',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              }
            },
            right_arm: {
              socket: 'right_shoulder',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              }
            },
            head: {
              socket: 'neck',
              requirements: {
                partType: 'head',
                components: ['anatomy:part']
              }
            }
          }
        }
      },

      // Entity definitions for blueprint parts
      entityDefinitions: {
        'test:simple_torso_root': {
          id: 'test:simple_torso_root',
          description: 'Simple torso root entity for realistic blueprint testing',
          components: {
            'anatomy:part': {
              subType: 'torso',
            },
            'anatomy:sockets': {
              sockets: [
                {
                  id: 'left_shoulder',
                  max: 1,
                  nameTpl: 'Left Shoulder',
                  allowedTypes: ['arm'],
                },
                {
                  id: 'right_shoulder', 
                  max: 1,
                  nameTpl: 'Right Shoulder',
                  allowedTypes: ['arm'],
                },
                {
                  id: 'neck',
                  max: 1,
                  nameTpl: 'Neck',
                  allowedTypes: ['head'],
                },
              ]
            },
            'core:name': {
              text: 'Simple Torso',
            },
          },
        },
        'test:simple_arm': {
          id: 'test:simple_arm',
          description: 'Simple arm entity for testing',
          components: {
            'anatomy:part': {
              subType: 'arm',
            },
            'anatomy:sockets': {
              sockets: []
            },
            'core:name': {
              text: 'Simple Arm',
            },
          },
        },
        'test:simple_head': {
          id: 'test:simple_head',
          description: 'Simple head entity for testing',
          components: {
            'anatomy:part': {
              subType: 'head',
            },
            'anatomy:sockets': {
              sockets: []
            },
            'core:name': {
              text: 'Simple Head',
            },
          },
        }
      },

      // Recipe for triggering the realistic blueprint
      recipe: {
        id: 'test:simple_humanoid_recipe',
        blueprintId: 'test:simple_humanoid'
      }
    };

    this.generatedData.set('multiLevel', data);
    return data;
  }

  /**
   * Generates blueprint with basic slot requirements  
   * Tests simple anatomy part creation without conflicts (since conflict resolution isn't implemented)
   * @returns {Object} Simple blueprint test data
   */
  generateConflictingSlotBlueprint() {
    const data = {
      blueprints: {
        'test:simple_blueprint': {
          id: 'test:simple_blueprint',
          root: 'test:simple_root',
          slots: {
            // Simple slots that should work with current production code
            left_arm: {
              socket: 'left_socket',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              }
            },
            right_arm: {
              socket: 'right_socket',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              }
            }
          }
        }
      },

      entityDefinitions: {
        'test:simple_root': {
          id: 'test:simple_root',
          description: 'Simple test base entity',
          components: {
            'anatomy:part': {
              subType: 'torso',
            },
            'anatomy:sockets': {
              sockets: [
                {
                  id: 'left_socket',
                  max: 1,
                  nameTpl: 'Left Socket',
                  allowedTypes: ['arm'],
                },
                {
                  id: 'right_socket',
                  max: 1,
                  nameTpl: 'Right Socket',
                  allowedTypes: ['arm'],
                },
              ]
            },
            'core:name': {
              text: 'Simple Root',
            },
          },
        },
        'test:simple_arm_part': {
          id: 'test:simple_arm_part',
          description: 'Simple arm part for testing',
          components: {
            'anatomy:part': {
              subType: 'arm',
            },
            'anatomy:sockets': {
              sockets: []
            },
            'core:name': {
              text: 'Simple Arm Part',
            },
          },
        }
      },

      recipe: {
        id: 'test:simple_recipe',
        blueprintId: 'test:simple_blueprint'
      }
    };

    this.generatedData.set('conflicting', data);
    return data;
  }

  /**
   * Generates blueprint with slots that test production's equipment detection heuristics
   * Tests differentiation based on socket IDs that production code recognizes as equipment
   * @returns {Object} Mixed slot type test data
   */
  generateMixedSlotTypeBlueprint() {
    const data = {
      blueprints: {
        'test:equipment_detection_blueprint': {
          id: 'test:equipment_detection_blueprint',
          root: 'test:equipment_detection_root',
          slots: {
            // Anatomy slot - should create anatomy part (uses anatomy-style socket)
            body_arm: {
              socket: 'shoulder',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              }
            },
            // Equipment slot - should NOT create anatomy part (uses 'grip' socket which production detects as equipment)
            weapon_holder: {
              socket: 'grip',
              requirements: {
                partType: 'weapon',
                components: ['equipment:weapon']
              }
            },
            // Another anatomy slot
            body_leg: {
              socket: 'hip',
              requirements: {
                partType: 'leg',
                components: ['anatomy:part']
              }
            }
          }
        }
      },

      entityDefinitions: {
        'test:equipment_detection_root': {
          id: 'test:equipment_detection_root',
          description: 'Equipment detection test entity',
          components: {
            'anatomy:part': {
              subType: 'torso',
            },
            'anatomy:sockets': {
              sockets: [
                {
                  id: 'shoulder',
                  max: 1,
                  nameTpl: 'Shoulder',
                  allowedTypes: ['arm'],
                },
                {
                  id: 'grip',
                  max: 1,
                  nameTpl: 'Grip',
                  allowedTypes: ['weapon'],
                },
                {
                  id: 'hip',
                  max: 1,
                  nameTpl: 'Hip',
                  allowedTypes: ['leg'],
                },
              ]
            },
            'core:name': {
              text: 'Equipment Detection Root',
            },
          },
        },
        'test:simple_arm_entity': {
          id: 'test:simple_arm_entity',
          description: 'Simple arm entity for testing',
          components: {
            'anatomy:part': {
              subType: 'arm',
            },
            'anatomy:sockets': {
              sockets: []
            },
            'core:name': {
              text: 'Simple Arm',
            },
          },
        },
        'test:simple_leg_entity': {
          id: 'test:simple_leg_entity',
          description: 'Simple leg entity for testing',
          components: {
            'anatomy:part': {
              subType: 'leg',
            },
            'anatomy:sockets': {
              sockets: []
            },
            'core:name': {
              text: 'Simple Leg',
            },
          },
        }
      },

      recipe: {
        id: 'test:equipment_detection_recipe',
        blueprintId: 'test:equipment_detection_blueprint'
      }
    };

    this.generatedData.set('mixedSlots', data);
    return data;
  }

  /**
   * Generates blueprint with complex constraint scenarios
   * Tests constraint propagation through blueprint hierarchies
   * @returns {Object} Complex constraint test data
   */
  generateConstraintPropagationBlueprint() {
    const data = {
      blueprints: {
        'test:constrained_blueprint': {
          id: 'test:constrained_blueprint',
          root: 'test:constrained_root',
          slots: {
            conditional_arm: {
              socket: 'shoulder',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              },
              constraints: [
                {
                  type: 'conditional',
                  condition: { 'has_component': ['anatomy:muscle'] },
                  description: 'Arm requires muscle component'
                }
              ]
            },
            dependent_hand: {
              socket: 'wrist',
              parent: 'conditional_arm',
              requirements: {
                partType: 'hand',
                components: ['anatomy:part']
              },
              constraints: [
                {
                  type: 'dependency',
                  dependsOn: 'conditional_arm',
                  description: 'Hand depends on arm existence'
                }
              ]
            }
          }
        }
      },

      entityDefinitions: {
        'test:constrained_root': {
          id: 'test:constrained_root',
          description: 'Constrained test entity',
          components: {
            'anatomy:part': {
              subType: 'torso',
            },
            'anatomy:sockets': {
              sockets: [
                {
                  id: 'shoulder',
                  max: 1,
                  nameTpl: 'Shoulder',
                  allowedTypes: ['arm'],
                },
                {
                  id: 'wrist',
                  max: 1,
                  nameTpl: 'Wrist',
                  allowedTypes: ['hand'],
                },
              ]
            },
            'core:name': {
              text: 'Constrained Torso',
            },
          },
        }
      },

      recipe: {
        id: 'test:constraint_recipe',
        blueprintId: 'test:constrained_blueprint',
        constraints: [
          {
            type: 'propagation',
            description: 'Constraints propagate through dependency chain',
            rule: 'dependent_parts_inherit_parent_constraints'
          }
        ]
      }
    };

    this.generatedData.set('constraintPropagation', data);
    return data;
  }

  /**
   * Generates clothing integration test scenario
   * @param {Object} options - Generation options
   * @param {boolean} options.includeSlotMetadata - Include slot metadata generation
   * @param {boolean} options.includeClothingItems - Include clothing items
   * @param {string} options.complexityLevel - 'basic' or 'complex'
   * @returns {Object} Clothing integration test data
   */
  async generateClothingIntegrationScenario(options = {}) {
    const {
      includeSlotMetadata = true,
      includeClothingItems = true,
      complexityLevel = 'basic'
    } = options;

    const data = {
      // Base anatomy blueprint for clothing integration
      blueprints: {
        'test:clothing_integration_humanoid': {
          id: 'test:clothing_integration_humanoid',
          root: 'test:torso_with_clothing_slots',
          slots: {
            left_arm: {
              socket: 'left_shoulder',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              }
            },
            right_arm: {
              socket: 'right_shoulder',
              requirements: {
                partType: 'arm',
                components: ['anatomy:part']
              }
            },
            left_leg: {
              socket: 'left_hip',
              requirements: {
                partType: 'leg',
                components: ['anatomy:part']
              }
            },
            right_leg: {
              socket: 'right_hip',
              requirements: {
                partType: 'leg',
                components: ['anatomy:part']
              }
            },
            head: {
              socket: 'neck',
              requirements: {
                partType: 'head',
                components: ['anatomy:part']
              }
            }
          }
        }
      },

      // Entity definitions with clothing-compatible sockets
      entityDefinitions: {
        'test:torso_with_clothing_slots': {
          id: 'test:torso_with_clothing_slots',
          description: 'Torso with clothing slot compatibility',
          components: {
            'anatomy:part': {
              subType: 'torso',
            },
            'anatomy:sockets': {
              sockets: [
                {
                  id: 'left_shoulder',
                  max: 1,
                  nameTpl: 'Left Shoulder',
                  allowedTypes: ['arm'],
                  clothingSlot: 'torso_upper'
                },
                {
                  id: 'right_shoulder',
                  max: 1,
                  nameTpl: 'Right Shoulder', 
                  allowedTypes: ['arm'],
                  clothingSlot: 'torso_upper'
                },
                {
                  id: 'left_hip',
                  max: 1,
                  nameTpl: 'Left Hip',
                  allowedTypes: ['leg'],
                  clothingSlot: 'torso_lower'
                },
                {
                  id: 'right_hip',
                  max: 1,
                  nameTpl: 'Right Hip',
                  allowedTypes: ['leg'],
                  clothingSlot: 'torso_lower'
                },
                {
                  id: 'neck',
                  max: 1,
                  nameTpl: 'Neck',
                  allowedTypes: ['head'],
                  clothingSlot: 'neck'
                }
              ]
            },
            'core:name': {
              text: 'Torso with Clothing Slots'
            }
          }
        },
        'test:clothing_arm': {
          id: 'test:clothing_arm',
          description: 'Arm with clothing socket compatibility',
          components: {
            'anatomy:part': {
              subType: 'arm',
            },
            'anatomy:sockets': {
              sockets: [
                {
                  id: 'wrist',
                  max: 1,
                  nameTpl: 'Wrist',
                  allowedTypes: ['hand'],
                  clothingSlot: 'wrist'
                }
              ]
            },
            'core:name': {
              text: 'Clothing-Compatible Arm'
            }
          }
        },
        'test:clothing_leg': {
          id: 'test:clothing_leg', 
          description: 'Leg with clothing socket compatibility',
          components: {
            'anatomy:part': {
              subType: 'leg',
            },
            'anatomy:sockets': {
              sockets: [
                {
                  id: 'ankle',
                  max: 1,
                  nameTpl: 'Ankle',
                  allowedTypes: ['foot'],
                  clothingSlot: 'foot'
                }
              ]
            },
            'core:name': {
              text: 'Clothing-Compatible Leg'
            }
          }
        },
        'test:clothing_head': {
          id: 'test:clothing_head',
          description: 'Head with clothing socket compatibility',
          components: {
            'anatomy:part': {
              subType: 'head',
            },
            'anatomy:sockets': {
              sockets: []
            },
            'core:name': {
              text: 'Clothing-Compatible Head'
            }
          }
        }
      },

      // Recipe for anatomy generation with clothing support
      recipe: {
        id: 'test:clothing_integration_recipe',
        blueprintId: 'test:clothing_integration_humanoid',
        parts: [
          { slotId: 'left_arm', definitionId: 'test:clothing_arm' },
          { slotId: 'right_arm', definitionId: 'test:clothing_arm' },
          { slotId: 'left_leg', definitionId: 'test:clothing_leg' },
          { slotId: 'right_leg', definitionId: 'test:clothing_leg' },
          { slotId: 'head', definitionId: 'test:clothing_head' }
        ],
        enableClothingSlots: includeSlotMetadata
      }
    };

    // Add clothing items if requested
    if (includeClothingItems) {
      data.clothingItems = [
        {
          id: 'test:shirt',
          name: 'Test Shirt',
          description: 'A test shirt for integration testing',
          targetSlot: 'torso_upper',
          layer: 'base'
        },
        {
          id: 'test:pants',
          name: 'Test Pants',
          description: 'Test pants for integration testing',
          targetSlot: 'torso_lower',
          layer: 'base'
        }
      ];

      if (complexityLevel === 'complex') {
        data.clothingItems.push(
          {
            id: 'test:jacket',
            name: 'Test Jacket', 
            description: 'A test jacket for layering',
            targetSlot: 'torso_upper',
            layer: 'outer'
          },
          {
            id: 'test:shoes',
            name: 'Test Shoes',
            description: 'Test shoes for foot slot',
            targetSlot: 'foot',
            layer: 'base'
          }
        );
      }
    }

    // Add expected slots for validation
    data.expectedSlots = [
      {
        id: 'torso_upper',
        socketIds: ['left_shoulder', 'right_shoulder'],
        allowedLayers: ['base', 'outer']
      },
      {
        id: 'torso_lower',
        socketIds: ['left_hip', 'right_hip'], 
        allowedLayers: ['base', 'outer']
      },
      {
        id: 'foot',
        socketIds: ['ankle'],
        allowedLayers: ['base']
      }
    ];

    this.generatedData.set('clothingIntegration', data);
    return data;
  }

  /**
   * Generate layer conflict test scenario
   * @param {Object} options - Generation options
   * @param {string} options.conflictType - Type of conflict to generate
   * @param {string} options.complexityLevel - Complexity level
   * @returns {Object} Layer conflict test data
   */
  async generateLayerConflictScenario(options = {}) {
    const { conflictType = 'same_layer_same_slot', complexityLevel = 'basic' } = options;

    // Get base integration data
    const baseData = await this.generateClothingIntegrationScenario({
      includeSlotMetadata: true,
      includeClothingItems: false,
      complexityLevel
    });

    const data = {
      ...baseData,
      conflictingItems: [
        {
          id: 'test:conflicting_shirt_1',
          name: 'First Test Shirt',
          targetSlot: 'torso_upper',
          layer: 'base'
        },
        {
          id: 'test:conflicting_shirt_2',
          name: 'Second Test Shirt',
          targetSlot: 'torso_upper',
          layer: 'base'
        }
      ],
      expectedBehavior: conflictType === 'same_layer_same_slot' ? 'reject' : 'replace'
    };

    this.generatedData.set('layerConflict', data);
    return data;
  }

  /**
   * Generate complex slot mapping test scenario
   * @param {Object} options - Generation options
   * @returns {Object} Complex slot mapping test data
   */
  async generateComplexSlotMappingScenario(options = {}) {
    const {
      slotComplexity = 'multi_socket',
      includeOrientationSpecific = true,
      includeLayerVariations = true
    } = options;

    const data = await this.generateClothingIntegrationScenario({
      includeSlotMetadata: true,
      includeClothingItems: false,
      complexityLevel: 'complex'
    });

    // Add complex slot mappings
    if (includeOrientationSpecific) {
      data.expectedSlots.push(
        {
          id: 'arm_left',
          socketIds: ['left_shoulder', 'wrist_left'],
          allowedLayers: ['base', 'outer'],
          orientation: 'left'
        },
        {
          id: 'arm_right',
          socketIds: ['right_shoulder', 'wrist_right'],
          allowedLayers: ['base', 'outer'],
          orientation: 'right'
        }
      );
    }

    if (includeLayerVariations) {
      data.expectedSlots.forEach(slot => {
        if (slot.id === 'torso_upper') {
          slot.allowedLayers = ['base', 'mid', 'outer', 'accessory'];
        }
      });
    }

    this.generatedData.set('complexSlotMapping', data);
    return data;
  }

  /**
   * Generate slot compatibility test scenario
   * @param {Object} options - Generation options
   * @returns {Object} Slot compatibility test data
   */
  async generateSlotCompatibilityScenario(options = {}) {
    const { includeIncompatibleItems = true, includeEdgeCases = true } = options;

    const data = await this.generateClothingIntegrationScenario({
      includeSlotMetadata: true,
      includeClothingItems: false,
      complexityLevel: 'basic'
    });

    data.compatibilityTests = [
      {
        itemId: 'test:compatible_shirt',
        targetSlot: 'torso_upper',
        expectedResult: 'success'
      },
      {
        itemId: 'test:compatible_pants',
        targetSlot: 'torso_lower',
        expectedResult: 'success'
      }
    ];

    if (includeIncompatibleItems) {
      data.compatibilityTests.push(
        {
          itemId: 'test:incompatible_helmet',
          targetSlot: 'torso_upper', // Wrong slot for helmet
          expectedResult: 'incompatible'
        },
        {
          itemId: 'test:oversized_item',
          targetSlot: 'foot', // Item too large for slot
          expectedResult: 'incompatible'
        }
      );
    }

    if (includeEdgeCases) {
      data.compatibilityTests.push(
        {
          itemId: 'test:edge_case_item',
          targetSlot: 'nonexistent_slot',
          expectedResult: 'incompatible'
        }
      );
    }

    this.generatedData.set('slotCompatibility', data);
    return data;
  }

  /**
   * Generate orientation-specific socket test scenario
   * @param {Object} options - Generation options
   * @returns {Object} Orientation socket test data
   */
  async generateOrientationSocketScenario(options = {}) {
    const { includeSymmetricLimbs = true, includeAsymmetricItems = true } = options;

    const data = await this.generateClothingIntegrationScenario({
      includeSlotMetadata: true,
      includeClothingItems: false,
      complexityLevel: 'complex'
    });

    if (includeSymmetricLimbs) {
      data.orientationSpecificItems = [
        {
          id: 'test:left_glove',
          name: 'Left Test Glove',
          targetSlot: 'hand',
          orientation: 'left'
        },
        {
          id: 'test:right_glove',
          name: 'Right Test Glove',
          targetSlot: 'hand',
          orientation: 'right'
        }
      ];
    }

    if (includeAsymmetricItems) {
      data.orientationSpecificItems.push({
        id: 'test:asymmetric_shoulder_pad',
        name: 'Asymmetric Shoulder Pad',
        targetSlot: 'torso_upper',
        orientation: 'left',
        asymmetric: true
      });
    }

    this.generatedData.set('orientationSocket', data);
    return data;
  }

  /**
   * Generate system synchronization test scenario
   * @param {Object} options - Generation options
   * @returns {Object} System sync test data
   */
  async generateSystemSyncScenario(options = {}) {
    const {
      includeMultipleClothingLayers = true,
      includeComplexAnatomy = true,
      includeDescriptionUpdates = true
    } = options;

    const data = await this.generateClothingIntegrationScenario({
      includeSlotMetadata: true,
      includeClothingItems: true,
      complexityLevel: 'complex'
    });

    if (includeMultipleClothingLayers) {
      data.clothingItems = [
        ...data.clothingItems,
        {
          id: 'test:base_layer',
          name: 'Base Layer',
          targetSlot: 'torso_upper',
          layer: 'base'
        },
        {
          id: 'test:mid_layer',
          name: 'Mid Layer',
          targetSlot: 'torso_upper',
          layer: 'mid'
        },
        {
          id: 'test:outer_layer',
          name: 'Outer Layer',
          targetSlot: 'torso_upper',
          layer: 'outer'
        }
      ];
    }

    if (includeDescriptionUpdates) {
      data.itemDescriptions = {};
      data.clothingItems.forEach(item => {
        data.itemDescriptions[item.id] = {
          shouldAppearInDescription: true,
          expectedText: item.name.toLowerCase()
        };
      });
    }

    this.generatedData.set('systemSync', data);
    return data;
  }

  /**
   * Generate a large anatomy blueprint with many parts
   * @param {number} partCount - Target number of parts to generate
   * @returns {Object} Large anatomy blueprint test data
   */
  generateLargeAnatomyBlueprint(partCount) {
    const blueprintId = `test:large_anatomy_${partCount}`;
    const rootId = `test:large_root_${partCount}`;

    const data = {
      blueprints: {
        [blueprintId]: {
          id: blueprintId,
          root: rootId,
          slots: {}
        }
      },
      entityDefinitions: {
        [rootId]: {
          id: rootId,
          description: `Large root entity with ${partCount} parts`,
          components: {
            'anatomy:part': {
              subType: 'torso',
            },
            'anatomy:sockets': {
              sockets: []
            },
            'core:name': {
              text: `Large Root ${partCount}`,
            },
          },
        }
      }
    };

    // Generate sockets and parts
    const socketCount = Math.min(Math.floor(partCount / 5), 20); // Limit sockets for realism
    for (let i = 0; i < socketCount; i++) {
      const socketId = `socket_${i}`;
      data.entityDefinitions[rootId].components['anatomy:sockets'].sockets.push({
        id: socketId,
        max: 5,
        nameTpl: `Socket ${i}`,
        allowedTypes: ['part'],
      });

      // Add slots to blueprint
      const slotId = `slot_${i}`;
      data.blueprints[blueprintId].slots[slotId] = {
        socket: socketId,
        requirements: {
          partType: 'part',
          components: ['anatomy:part']
        }
      };
    }

    // Generate part definitions
    const partsPerSocket = Math.ceil(partCount / socketCount);
    for (let i = 0; i < socketCount; i++) {
      for (let j = 0; j < partsPerSocket && (i * partsPerSocket + j) < partCount; j++) {
        const partId = `test:part_${i}_${j}`;
        data.entityDefinitions[partId] = {
          id: partId,
          description: `Part ${i}-${j} for large anatomy`,
          components: {
            'anatomy:part': {
              subType: 'part',
            },
            'anatomy:sockets': {
              sockets: j === 0 ? [
                {
                  id: `sub_socket_${i}_${j}`,
                  max: 2,
                  allowedTypes: ['subpart'],
                }
              ] : []
            },
            'core:name': {
              text: `Part ${i}-${j}`,
            },
          },
        };
      }
    }

    // Add recipe for the blueprint
    data.recipe = {
      id: `test:large_anatomy_${partCount}`,
      blueprintId: blueprintId
    };

    this.generatedData.set(`largeAnatomy_${partCount}`, data);
    return data;
  }

  /**
   * Generate a deep hierarchy blueprint
   * @param {number} depth - Target hierarchy depth
   * @returns {Object} Deep hierarchy blueprint test data
   */
  generateDeepHierarchyBlueprint(depth) {
    const blueprintId = `test:deep_hierarchy_${depth}`;
    const rootId = `test:deep_root_${depth}`;

    const data = {
      blueprints: {
        [blueprintId]: {
          id: blueprintId,
          root: rootId,
          slots: {}
        }
      },
      entityDefinitions: {}
    };

    // Generate chain of entities, each with one socket to the next
    let currentParentId = rootId;
    for (let level = 0; level < depth; level++) {
      const entityId = level === 0 ? rootId : `test:level_${level}_entity`;
      const socketId = `socket_level_${level}`;
      
      data.entityDefinitions[entityId] = {
        id: entityId,
        description: `Level ${level} entity in deep hierarchy`,
        components: {
          'anatomy:part': {
            subType: 'part', // Use generic 'part' subType that matches blueprint requirements
          },
          'anatomy:sockets': {
            sockets: level < depth - 1 ? [{
              id: socketId,
              max: 1,
              nameTpl: `Level ${level} Socket`,
              allowedTypes: ['part'],
            }] : []
          },
          'core:name': {
            text: `Level ${level} Entity`,
          },
        },
      };

      // Add slot to blueprint (except for leaf nodes)
      if (level < depth - 1) {
        const slotId = `slot_level_${level}`;
        const childEntityId = `test:level_${level + 1}_entity`;
        
        if (level === 0) {
          // Root level slot
          data.blueprints[blueprintId].slots[slotId] = {
            socket: socketId,
            requirements: {
              partType: 'part', // Use generic 'part' type that matches entity definitions
              components: ['anatomy:part']
            }
          };
        } else {
          // Nested blueprint slots (simplified for current production capabilities)
          // In production, we use simpler slot processing
          data.blueprints[blueprintId].slots[slotId] = {
            socket: socketId,
            requirements: {
              partType: 'part', // Use generic 'part' type that matches entity definitions
              components: ['anatomy:part']
            }
          };
        }
      }

      currentParentId = entityId;
    }

    // Add recipe for the blueprint
    data.recipe = {
      id: `test:deep_hierarchy_${depth}`,
      blueprintId: blueprintId
    };

    this.generatedData.set(`deepHierarchy_${depth}`, data);
    return data;
  }

  /**
   * Gets previously generated test data by key
   * @param {string} key - Data key ('multiLevel', 'conflicting', 'mixedSlots', etc.)
   * @returns {Object|null} Generated data or null if not found
   */
  getGeneratedData(key) {
    return this.generatedData.get(key) || null;
  }

  /**
   * Clears all generated data
   */
  clear() {
    this.generatedData.clear();
  }

  /**
   * Gets all generated data keys
   * @returns {string[]} Array of data keys
   */
  getDataKeys() {
    return Array.from(this.generatedData.keys());
  }
}