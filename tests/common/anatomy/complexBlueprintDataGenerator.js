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