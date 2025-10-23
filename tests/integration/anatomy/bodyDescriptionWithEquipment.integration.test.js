import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';
import { PartDescriptionGenerator } from '../../../src/anatomy/PartDescriptionGenerator.js';
import EquipmentDescriptionService from '../../../src/clothing/services/equipmentDescriptionService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Body Description with Equipment Integration', () => {
  let bodyDescriptionComposer;
  let equipmentDescriptionService;
  let mockEntityManager;
  let mockLogger;
  let mockAnatomyFormattingService;
  let slotMetadataForActor;
  let equippedItemsResponse;
  let anatomyBodyForActor;
  let anatomyPartComponents;
  let clothingEquipmentForActor;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    // Setup mock entity manager
    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
    };

    slotMetadataForActor = null;
    anatomyBodyForActor = null;
    anatomyPartComponents = {};
    clothingEquipmentForActor = null;
    mockEntityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        if (entityId === 'character_1') {
          if (componentId === 'clothing:slot_metadata') {
            return slotMetadataForActor;
          }
          if (componentId === 'clothing:equipment') {
            return clothingEquipmentForActor;
          }
          if (componentId === ANATOMY_BODY_COMPONENT_ID) {
            return anatomyBodyForActor;
          }
        }

        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return anatomyPartComponents[entityId] || null;
        }

        return null;
      }
    );

    // Create consistent anatomy formatting service mock
    mockAnatomyFormattingService = {
      getFormattingConfiguration: () => ({ separator: ', ' }),
      getDescriptorOrder: () => [
        'descriptors:color_basic',
        'descriptors:texture',
        'core:material',
      ],
      getDescriptorValueKeys: () => [
        'value',
        'color',
        'size',
        'texture',
        'material',
      ],
      getEquipmentIntegrationConfig: () => ({
        enabled: true,
        prefix: 'Wearing: ',
        suffix: '.',
        separator: ', ',
        itemSeparator: ', ',
        placement: 'after_anatomy',
      }),
    };

    equippedItemsResponse = {
      success: true,
      equipped: {
        torso_clothing: {
          0: 'bodysuit_1',
        },
        feet_clothing: {
          0: 'boots_1',
        },
      },
    };

    // Setup services
    const descriptorFormatter = new DescriptorFormatter({
      anatomyFormattingService: mockAnatomyFormattingService,
    });
    const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
      anatomyFormattingService: mockAnatomyFormattingService,
    });
    const bodyGraphService = {
      getAllParts: jest.fn().mockImplementation((bodyComponent) => {
        if (bodyComponent && bodyComponent.parts) {
          return bodyComponent.parts;
        }
        return [];
      }),
    };
    const anatomyFormattingService = new AnatomyFormattingService({
      dataRegistry: {
        getDataByPath: jest.fn().mockReturnValue({
          separator: ', ',
          descriptionOrder: ['build', 'hair', 'torso', 'equipment'],
        }),
        getAll: jest.fn().mockImplementation((category) => {
          if (category === 'anatomyFormatting') {
            return [
              {
                id: 'default',
                _modId: 'anatomy',
                descriptionOrder: ['build', 'hair', 'torso', 'equipment'],
                pairedParts: ['eye', 'ear', 'arm', 'leg', 'hand', 'foot'],
                irregularPlurals: { foot: 'feet', tooth: 'teeth' },
                descriptorOrder: [
                  'descriptors:color_basic',
                  'descriptors:texture',
                  'core:material',
                ],
                descriptorValueKeys: [
                  'value',
                  'color',
                  'size',
                  'texture',
                  'material',
                ],
              },
            ];
          }
          return [];
        }),
        get: jest.fn().mockImplementation((category, key) => {
          if (category === 'meta' && key === 'final_mod_order') {
            return ['core', 'anatomy'];
          }
          return {
            separator: ', ',
            descriptionOrder: ['build', 'hair', 'torso', 'equipment'],
          };
        }),
      },
      logger: mockLogger,
      safeEventDispatcher: { dispatch: jest.fn() },
    });

    // Initialize the anatomy formatting service
    anatomyFormattingService.initialize();

    const partDescriptionGenerator = new PartDescriptionGenerator({
      logger: mockLogger,
      bodyPartDescriptionBuilder,
      entityManager: mockEntityManager,
    });

    equipmentDescriptionService = new EquipmentDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      descriptorFormatter,
      clothingManagementService: {
        getEquippedItems: jest.fn().mockImplementation(async (entityId) => {
          // Return mock equipped items data for the test
          if (entityId === 'character_1') {
            return equippedItemsResponse;
          }
          return { success: true, equipped: {} };
        }),
        getItemCategory: jest.fn().mockReturnValue('clothing'),
      },
      anatomyFormattingService: mockAnatomyFormattingService,
    });

    bodyDescriptionComposer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder,
      bodyGraphService,
      entityFinder: mockEntityManager,
      anatomyFormattingService,
      partDescriptionGenerator,
      equipmentDescriptionService,
    });
  });

  it('should generate complete body description with equipment', async () => {
    // Setup body entity
    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso_1',
              parts: ['torso_1', 'hair_1'],
            },
          };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      }),
    };

    // Setup body parts
    const torsoEntity = {
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return { subType: 'torso' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'lean, toned torso' };
        }
        return null;
      }),
    };

    const hairEntity = {
      id: 'hair_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return { subType: 'hair' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'long, black hair' };
        }
        return null;
      }),
    };

    // Setup clothing equipment
    const clothingComponent = {
      slots: {
        torso_clothing: {
          layers: {
            0: 'bodysuit_1',
          },
        },
        feet_clothing: {
          layers: {
            0: 'boots_1',
          },
        },
      },
    };

    const bodysuitEntity = {
      id: 'bodysuit_1',
      components: {
        'core:material': { material: 'stretch-silk' },
        'descriptors:color_basic': { color: 'black' },
        'descriptors:texture': { texture: 'silky' },
        'core:description': { text: 'bodysuit' },
      },
    };

    const bootsEntity = {
      id: 'boots_1',
      components: {
        'core:material': { material: 'leather' },
        'descriptors:color_basic': { color: 'brown' },
        'descriptors:style': { style: 'sturdy' },
        'core:description': { text: 'boots' },
      },
    };

    // Mock entity manager responses
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
      switch (entityId) {
        case 'torso_1':
          return torsoEntity;
        case 'hair_1':
          return hairEntity;
        case 'bodysuit_1':
          return bodysuitEntity;
        case 'boots_1':
          return bootsEntity;
        default:
          return null;
      }
    });

    clothingEquipmentForActor = clothingComponent;

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain('Build: athletic');
    expect(result).toContain('Hair: long, black hair');
    expect(result).toContain('Torso: lean, toned torso');
    expect(result).toContain(
      'Wearing: black, silky, stretch-silk bodysuit and brown, leather, sturdy boots.'
    );
  });

  it('should generate body description without equipment when no equipment is present', async () => {
    // Setup body entity with no equipment
    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso_1',
              parts: ['torso_1'],
            },
          };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      }),
    };

    const torsoEntity = {
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return { subType: 'torso' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'lean, toned torso' };
        }
        return null;
      }),
    };

    // Mock entity manager responses
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
      if (entityId === 'torso_1') {
        return torsoEntity;
      }
      return null;
    });

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain('Build: athletic');
    expect(result).toContain('Torso: lean, toned torso');
    expect(result).not.toContain('Wearing:');
  });

  it('should include exposure notes when torso slots have no clothing', async () => {
    slotMetadataForActor = {
      slotMappings: {
        torso_upper: {
          coveredSockets: ['left_breast', 'right_breast'],
        },
        torso_lower: {
          coveredSockets: ['vagina'],
        },
      },
    };
    equippedItemsResponse = { success: true, equipped: {} };

    const leftBreastPartId = 'character_1_left_breast';
    const rightBreastPartId = 'character_1_right_breast';
    anatomyBodyForActor = {
      body: {
        root: 'torso_1',
        parts: ['torso_1', leftBreastPartId, rightBreastPartId],
      },
    };
    anatomyPartComponents[leftBreastPartId] = { subType: 'breast' };
    anatomyPartComponents[rightBreastPartId] = { subType: 'breast' };

    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return anatomyBodyForActor;
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      }),
    };

    const torsoEntity = {
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return { subType: 'torso' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'lean, toned torso' };
        }
        return null;
      }),
    };

    bodyDescriptionComposer.entityFinder.getEntityInstance.mockReturnValue(
      torsoEntity
    );

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain(
      'Wearing: Torso is fully exposed. The breasts are exposed. Genitals are fully exposed.'
    );
  });

  it('should include breast exposure notes when anatomy part uses plural subtype', async () => {
    slotMetadataForActor = {
      slotMappings: {
        torso_upper: {
          coveredSockets: ['left_breast', 'right_breast'],
        },
      },
    };
    equippedItemsResponse = { success: true, equipped: {} };

    const breastsPartId = 'character_1_breasts';
    anatomyBodyForActor = {
      body: {
        root: 'torso_1',
        parts: ['torso_1', breastsPartId],
      },
    };
    anatomyPartComponents[breastsPartId] = { subType: 'breasts' };

    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return anatomyBodyForActor;
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      }),
    };

    const torsoEntity = {
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return { subType: 'torso' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'lean, toned torso' };
        }
        return null;
      }),
    };

    bodyDescriptionComposer.entityFinder.getEntityInstance.mockReturnValue(
      torsoEntity
    );

    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    expect(result).toContain('The breasts are exposed.');
  });

  it('should handle equipment description errors gracefully', async () => {
    // Setup body entity
    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso_1',
              parts: ['torso_1'],
            },
          };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      }),
    };

    const torsoEntity = {
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return { subType: 'torso' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'lean, toned torso' };
        }
        return null;
      }),
    };

    // Mock entity manager responses
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
      if (entityId === 'torso_1') {
        return torsoEntity;
      }
      return null;
    });

    // Create a failing equipment service for this test
    const testDescriptorFormatter = new DescriptorFormatter({
      anatomyFormattingService: mockAnatomyFormattingService,
    });
    const failingEquipmentService = new EquipmentDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      descriptorFormatter: testDescriptorFormatter,
      clothingManagementService: {
        getEquippedItems: jest.fn().mockImplementation(async () => {
          throw new Error('Database connection failed');
        }),
      },
      anatomyFormattingService: mockAnatomyFormattingService,
    });

    // Override the equipment service to one that fails
    bodyDescriptionComposer.equipmentDescriptionService =
      failingEquipmentService;

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain('Build: athletic');
    expect(result).toContain('Torso: lean, toned torso');
    expect(result).not.toContain('Wearing:');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to get equipped items for entity character_1',
      expect.any(Error)
    );
  });

  it('should order equipment by category correctly', async () => {
    // Setup body entity
    const bodyEntity = {
      id: 'character_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_BODY_COMPONENT_ID) {
          return {
            body: {
              root: 'torso_1',
              parts: ['torso_1'],
            },
          };
        }
        if (componentId === 'descriptors:build') {
          return { build: 'athletic' };
        }
        return null;
      }),
    };

    const torsoEntity = {
      id: 'torso_1',
      hasComponent: jest.fn().mockReturnValue(true),
      getComponentData: jest.fn().mockImplementation((componentId) => {
        if (componentId === ANATOMY_PART_COMPONENT_ID) {
          return { subType: 'torso' };
        }
        if (componentId === DESCRIPTION_COMPONENT_ID) {
          return { text: 'lean, toned torso' };
        }
        return null;
      }),
    };

    // Setup clothing with different categories
    const clothingComponent = {
      slots: {
        // Outerwear (should come first)
        jacket_clothing: {
          layers: {
            0: 'jacket_1',
          },
        },
        // Tops (should come second)
        torso_clothing: {
          layers: {
            0: 'shirt_1',
          },
        },
        // Footwear (should come last)
        feet_clothing: {
          layers: {
            0: 'shoes_1',
          },
        },
      },
    };

    const jacketEntity = {
      id: 'jacket_1',
      components: {
        'core:description': { text: 'jacket' },
      },
    };

    const shirtEntity = {
      id: 'shirt_1',
      components: {
        'core:description': { text: 'shirt' },
      },
    };

    const shoesEntity = {
      id: 'shoes_1',
      components: {
        'core:description': { text: 'shoes' },
      },
    };

    // Mock entity manager responses
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
      switch (entityId) {
        case 'torso_1':
          return torsoEntity;
        case 'jacket_1':
          return jacketEntity;
        case 'shirt_1':
          return shirtEntity;
        case 'shoes_1':
          return shoesEntity;
        default:
          return null;
      }
    });

    // Create a custom equipment service for this test
    const testDescriptorFormatter = new DescriptorFormatter({
      anatomyFormattingService: mockAnatomyFormattingService,
    });
    const customEquipmentService = new EquipmentDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      descriptorFormatter: testDescriptorFormatter,
      clothingManagementService: {
        getEquippedItems: jest.fn().mockImplementation(async (entityId) => {
          // Return mock equipped items data for the test
          if (entityId === 'character_1') {
            return {
              success: true,
              equipped: {
                jacket_clothing: {
                  0: 'jacket_1',
                },
                torso_clothing: {
                  0: 'shirt_1',
                },
                feet_clothing: {
                  0: 'shoes_1',
                },
              },
            };
          }
          return { success: true, equipped: {} };
        }),
      },
      anatomyFormattingService: mockAnatomyFormattingService,
    });

    // Override the equipment service to one with custom items
    bodyDescriptionComposer.equipmentDescriptionService =
      customEquipmentService;

    // Act
    const result = await bodyDescriptionComposer.composeDescription(bodyEntity);

    // Assert
    expect(result).toContain('Wearing: jacket, shirt, and shoes.');
    // Verify the order (jacket first as outerwear, then shirt, then shoes)
    const wearingIndex = result.indexOf('Wearing:');
    const jacketIndex = result.indexOf('jacket', wearingIndex);
    const shirtIndex = result.indexOf('shirt', wearingIndex);
    const shoesIndex = result.indexOf('shoes', wearingIndex);

    expect(jacketIndex).toBeLessThan(shirtIndex);
    expect(shirtIndex).toBeLessThan(shoesIndex);
  });
});
