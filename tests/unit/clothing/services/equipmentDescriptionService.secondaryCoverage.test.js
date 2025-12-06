import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import EquipmentDescriptionService from '../../../../src/clothing/services/equipmentDescriptionService.js';

/**
 * Tests for secondary coverage via clothing:coverage_mapping component
 *
 * This test suite reproduces and validates the fix for the issue where
 * clothing items like trousers that have secondary coverage (via
 * clothing:coverage_mapping component) were not preventing exposure
 * messages like "Genitals are fully exposed" even though they cover
 * the relevant area.
 */
describe('EquipmentDescriptionService - Secondary Coverage', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockDescriptorFormatter;
  let mockClothingManagementService;
  let mockAnatomyFormattingService;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    };

    mockDescriptorFormatter = {
      formatDescriptors: jest.fn(),
    };

    mockClothingManagementService = {
      getEquippedItems: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getEquipmentIntegrationConfig: jest.fn().mockReturnValue({
        enabled: true,
        prefix: 'Wearing: ',
        suffix: '.',
        separator: ', ',
        itemSeparator: ' | ',
        placement: 'after_anatomy',
      }),
    };

    // Create service instance
    service = new EquipmentDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      descriptorFormatter: mockDescriptorFormatter,
      clothingManagementService: mockClothingManagementService,
      anatomyFormattingService: mockAnatomyFormattingService,
    });
  });

  describe('torso_lower secondary coverage via clothing:coverage_mapping', () => {
    it('should NOT report exposed genitals when trousers cover torso_lower via coverage_mapping', async () => {
      // Arrange
      const entityId = 'character_1';
      const trousersId = 'clothing:fitted_black_leather_trousers';

      // Character is wearing trousers on legs slot (not torso_lower slot)
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          legs: {
            base: trousersId,
          },
        },
      });

      // Mock trousers entity with coverage_mapping
      const trousersEntity = {
        id: trousersId,
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'fitted black leather trousers' },
            'core:material': { material: 'leather' },
            'descriptors:color_basic': { color: 'black' },
            'descriptors:texture': { texture: 'smooth' },
          };
          return components[componentType];
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(trousersEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue(
        'black, smooth, leather'
      );

      // Set up component data mocks
      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_lower: {
                    coveredSockets: ['penis', 'vagina', 'pubic_hair'],
                  },
                },
              };
            }
          }

          // Return coverage_mapping for the trousers
          if (
            requestedEntityId === trousersId &&
            componentId === 'clothing:coverage_mapping'
          ) {
            return {
              covers: ['torso_lower'],
              coveragePriority: 'base',
            };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      // The result should NOT contain "Genitals are fully exposed"
      // because the trousers provide secondary coverage for torso_lower
      expect(result).not.toContain('Genitals are fully exposed');
      expect(result).toContain('fitted black leather trousers');
    });

    it('should report exposed genitals when torso_lower is empty and no secondary coverage exists', async () => {
      // Arrange
      const entityId = 'character_1';

      // Character has no clothing
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {},
      });

      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (componentId === 'clothing:slot_metadata') {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['penis', 'vagina', 'pubic_hair'],
                },
              },
            };
          }
          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toContain('Genitals are fully exposed');
    });

    it('should handle multiple items with coverage_mapping correctly', async () => {
      // Arrange
      const entityId = 'character_1';
      const trousersId = 'clothing:fitted_black_leather_trousers';
      const bodiceId = 'clothing:structured_bodice_deep_crimson_steel_boning';

      // Character is wearing both trousers (covers torso_lower) and bodice (covers torso_upper)
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          legs: {
            base: trousersId,
          },
          torso_upper: {
            base: bodiceId,
          },
        },
      });

      // Mock trousers entity
      const trousersEntity = {
        id: trousersId,
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'fitted black leather trousers' },
            'core:material': { material: 'leather' },
            'descriptors:color_basic': { color: 'black' },
          };
          return components[componentType];
        }),
      };

      // Mock bodice entity
      const bodiceEntity = {
        id: bodiceId,
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'structured crimson bodice' },
            'core:material': { material: 'fabric' },
            'descriptors:color_basic': { color: 'deep-crimson' },
          };
          return components[componentType];
        }),
      };

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(bodiceEntity)
        .mockResolvedValueOnce(trousersEntity);

      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('deep-crimson, fabric')
        .mockReturnValueOnce('black, leather');

      // Set up component data mocks
      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_upper: {
                    coveredSockets: ['left_breast', 'right_breast'],
                  },
                  torso_lower: {
                    coveredSockets: ['penis', 'vagina', 'pubic_hair'],
                  },
                },
              };
            }
          }

          // Return coverage_mapping for the trousers
          if (
            requestedEntityId === trousersId &&
            componentId === 'clothing:coverage_mapping'
          ) {
            return {
              covers: ['torso_lower'],
              coveragePriority: 'base',
            };
          }

          // Return coverage_mapping for the bodice (may not exist, that's ok)
          if (
            requestedEntityId === bodiceId &&
            componentId === 'clothing:coverage_mapping'
          ) {
            return null; // bodice doesn't have secondary coverage
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      // Should not report exposed genitals (covered by trousers)
      expect(result).not.toContain('Genitals are fully exposed');
      // Should not report exposed torso (covered by bodice directly)
      expect(result).not.toContain('Torso is fully exposed');
      expect(result).toContain('structured crimson bodice');
      expect(result).toContain('fitted black leather trousers');
    });

    it('should report exposed torso_upper when not directly covered and no secondary coverage', async () => {
      // Arrange
      const entityId = 'character_1';
      const trousersId = 'clothing:fitted_black_leather_trousers';

      // Character wearing only trousers (no torso_upper coverage)
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          legs: {
            base: trousersId,
          },
        },
      });

      const trousersEntity = {
        id: trousersId,
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'fitted black leather trousers' },
            'core:material': { material: 'leather' },
            'descriptors:color_basic': { color: 'black' },
          };
          return components[componentType];
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(trousersEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue(
        'black, leather'
      );

      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_upper: {
                    coveredSockets: ['left_breast', 'right_breast'],
                  },
                  torso_lower: {
                    coveredSockets: ['penis', 'vagina', 'pubic_hair'],
                  },
                },
              };
            }
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  root: 'torso_1',
                  parts: ['torso_1', 'left_breast', 'right_breast'],
                },
              };
            }
          }

          // Return coverage_mapping for trousers (covers only torso_lower)
          if (
            requestedEntityId === trousersId &&
            componentId === 'clothing:coverage_mapping'
          ) {
            return {
              covers: ['torso_lower'],
              coveragePriority: 'base',
            };
          }

          if (
            componentId === 'anatomy:part' &&
            (requestedEntityId === 'left_breast' ||
              requestedEntityId === 'right_breast')
          ) {
            return { subType: 'breast' };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      // Should report exposed torso and breasts (not covered)
      expect(result).toContain('Torso is fully exposed');
      expect(result).toContain('The breasts are exposed');
      // Should NOT report exposed genitals (covered by trousers via coverage_mapping)
      expect(result).not.toContain('Genitals are fully exposed');
    });
  });

  describe('edge cases for coverage_mapping', () => {
    it('should handle missing coverage_mapping component gracefully', async () => {
      // Arrange
      const entityId = 'character_1';
      const shirtId = 'clothing:basic_shirt';

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          torso_clothing: {
            base: shirtId,
          },
        },
      });

      const shirtEntity = {
        id: shirtId,
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'basic shirt' },
          };
          return components[componentType];
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(shirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('');

      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_lower: {
                    coveredSockets: ['genitals'],
                  },
                },
              };
            }
          }
          // No coverage_mapping for this item
          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      // Should report exposed genitals since shirt doesn't provide secondary coverage
      expect(result).toContain('Genitals are fully exposed');
      expect(result).not.toContain('error');
    });

    it('should handle coverage_mapping with empty covers array', async () => {
      // Arrange
      const entityId = 'character_1';
      const accessoryId = 'clothing:belt';

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          torso_lower: {
            accessories: accessoryId,
          },
        },
      });

      const beltEntity = {
        id: accessoryId,
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'belt' },
          };
          return components[componentType];
        }),
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(beltEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('');

      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_lower: {
                    coveredSockets: ['genitals'],
                  },
                },
              };
            }
          }

          // Belt has coverage_mapping but with empty covers array
          if (
            requestedEntityId === accessoryId &&
            componentId === 'clothing:coverage_mapping'
          ) {
            return {
              covers: [],
              coveragePriority: 'accessories',
            };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      // Belt provides no secondary coverage, so torso_lower is not covered by secondary coverage
      // However, belt is IN the torso_lower slot, so slot is occupied
      expect(result).not.toContain('Genitals are fully exposed');
    });
  });

  describe('edge cases for coverage mapping inspection', () => {
    it('should skip invalid slot shapes, ignore non-string layer values, and log coverage mapping errors', async () => {
      const entityId = 'character_edge_case';
      const coveringItemId = 'clothing:edge_case_trousers';

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          unexpected_slot: 'just-a-string',
          torso_lower: {
            base: null,
          },
          legs: {
            base: null,
            outer: coveringItemId,
          },
        },
      });

      const coveringItemEntity = {
        id: coveringItemId,
        components: {
          'core:name': { text: 'edge case trousers' },
        },
      };

      mockEntityManager.getEntityInstance.mockResolvedValue(coveringItemEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('');

      const coverageError = new Error('coverage unavailable');
      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (
            requestedEntityId === entityId &&
            componentId === 'clothing:slot_metadata'
          ) {
            return {
              slotMappings: {
                torso_lower: {
                  coveredSockets: ['genitals'],
                },
              },
            };
          }

          if (
            requestedEntityId === coveringItemId &&
            componentId === 'clothing:coverage_mapping'
          ) {
            throw coverageError;
          }

          return null;
        }
      );

      const result = await service.generateEquipmentDescription(entityId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `Could not check coverage_mapping for item ${coveringItemId}`
        ),
        coverageError
      );
      expect(result).toContain('Genitals are fully exposed.');
    });
  });
});
