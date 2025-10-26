import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import EquipmentDescriptionService from '../../../../src/clothing/services/equipmentDescriptionService.js';

describe('EquipmentDescriptionService', () => {
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

    mockEntityManager.getComponentData.mockImplementation(() => null);

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

  describe('generateEquipmentDescription', () => {
    it('should describe exposed torso and breasts when torso_upper slot is empty', async () => {
      // Arrange
      const entityId = 'character_1';
      const leftBreastPartId = 'character_1_left_breast';
      const rightBreastPartId = 'character_1_right_breast';

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {},
      });
      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_upper: {
                    coveredSockets: ['left_breast', 'right_breast'],
                  },
                },
              };
            }
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  root: 'torso_1',
                  parts: ['torso_1', leftBreastPartId, rightBreastPartId],
                },
              };
            }
          }

          if (
            componentId === 'anatomy:part' &&
            (requestedEntityId === leftBreastPartId ||
              requestedEntityId === rightBreastPartId)
          ) {
            return { subType: 'breast' };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe(
        'Wearing: Torso is fully exposed. The breasts are exposed.'
      );
    });

    it('should not describe breasts as exposed when the actor lacks breast anatomy', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {},
      });
      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_upper: {
                    coveredSockets: ['left_breast', 'right_breast'],
                  },
                },
              };
            }
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  root: 'torso_1',
                  parts: ['torso_1'],
                },
              };
            }
          }

          if (
            componentId === 'anatomy:part' &&
            requestedEntityId === 'torso_1'
          ) {
            return { subType: 'torso' };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: Torso is fully exposed.');
    });

    it('should describe exposed genitals when torso_lower slot is empty', async () => {
      // Arrange
      const entityId = 'character_1';
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
                  coveredSockets: ['vagina', 'pubic_hair'],
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
      expect(result).toBe('Wearing: Genitals are fully exposed.');
    });

    it('should append exposure notes after clothing descriptions', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          feet_clothing: {
            base: 'boots_1',
          },
        },
      });
      const mockBootsEntity = {
        id: 'boots_1',
        components: {
          'core:name': { text: 'boots' },
        },
      };
      mockEntityManager.getEntityInstance.mockResolvedValue(mockBootsEntity);
      const leftBreastPartId = 'character_1_left_breast';
      const rightBreastPartId = 'character_1_right_breast';
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
                    coveredSockets: ['vagina'],
                  },
                },
              };
            }
            if (componentId === 'anatomy:body') {
              return {
                body: {
                  root: 'torso_1',
                  parts: ['torso_1', leftBreastPartId, rightBreastPartId],
                },
              };
            }
          }

          if (
            componentId === 'anatomy:part' &&
            (requestedEntityId === leftBreastPartId ||
              requestedEntityId === rightBreastPartId)
          ) {
            return { subType: 'breast' };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe(
        'Wearing: boots. Torso is fully exposed. The breasts are exposed. Genitals are fully exposed.'
      );
    });

    it('should return empty string when no equipment is equipped', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {},
      });

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(
        mockClothingManagementService.getEquippedItems
      ).toHaveBeenCalledWith(entityId);
    });

    it('should return empty string when clothing service returns null', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: null,
      });

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
    });

    it('should generate description for single equipped item', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:material': { material: 'cotton' },
          'descriptors:color_basic': { color: 'blue' },
          'core:name': { text: 'shirt' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('cotton, blue');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: cotton, blue shirt.');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'shirt_1'
      );
      expect(mockDescriptorFormatter.formatDescriptors).toHaveBeenCalled();
    });

    it('should generate description for multiple equipped items', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
        feet_clothing: {
          base: 'boots_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:material': { material: 'cotton' },
          'descriptors:color_basic': { color: 'blue' },
          'core:name': { text: 'shirt' },
        },
      };

      const mockBootsEntity = {
        id: 'boots_1',
        components: {
          'core:material': { material: 'leather' },
          'descriptors:color_basic': { color: 'brown' },
          'core:name': { text: 'boots' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockShirtEntity)
        .mockResolvedValueOnce(mockBootsEntity);
      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('cotton, blue')
        .mockReturnValueOnce('leather, brown');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe(
        'Wearing: cotton, blue shirt and leather, brown boots.'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
      expect(mockDescriptorFormatter.formatDescriptors).toHaveBeenCalledTimes(
        2
      );
    });

    it('should handle items with no name gracefully', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:material': { material: 'cotton' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('cotton');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      // Check that the logger was called with the correct message
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No name found for equipment entity: shirt_1'
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const entityId = 'character_1';
      const error = new Error('Database connection failed');
      mockClothingManagementService.getEquippedItems.mockRejectedValue(error);

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get equipped items for entity character_1',
        error
      );
    });

    it('should log and recover when item description formatting throws', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          torso_clothing: {
            base: 'shirt_1',
          },
        },
      });

      const formattingError = new Error('formatting failure');
      mockEntityManager.getEntityInstance.mockResolvedValue({
        id: 'shirt_1',
        components: {
          'core:name': { text: 'shirt' },
        },
      });
      mockDescriptorFormatter.formatDescriptors.mockImplementation(() => {
        throw formattingError;
      });

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to format item description for entity shirt_1',
        formattingError
      );
    });

    it('should log an error when entity retrieval fails during generation', async () => {
      // Arrange
      const entityId = 'character_1';
      const retrievalError = new Error('entity lookup failed');
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          torso_clothing: {
            base: 'shirt_1',
          },
        },
      });

      mockEntityManager.getEntityInstance.mockRejectedValue(retrievalError);

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate equipment description for entity character_1',
        retrievalError
      );
    });

    it('should format three or more items correctly', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
        feet_clothing: {
          base: 'boots_1',
        },
        hands_clothing: {
          base: 'gloves_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:name': { text: 'shirt' },
        },
      };

      const mockBootsEntity = {
        id: 'boots_1',
        components: {
          'core:name': { text: 'boots' },
        },
      };

      const mockGlovesEntity = {
        id: 'gloves_1',
        components: {
          'core:name': { text: 'gloves' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockShirtEntity)
        .mockResolvedValueOnce(mockBootsEntity)
        .mockResolvedValueOnce(mockGlovesEntity);
      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('')
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: shirt | boots, and gloves.');
    });

    it('should group items by category correctly', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
        jacket_clothing: {
          base: 'jacket_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:name': { text: 'shirt' },
        },
      };

      const mockJacketEntity = {
        id: 'jacket_1',
        components: {
          'core:name': { text: 'jacket' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockJacketEntity) // Outerwear comes first
        .mockResolvedValueOnce(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: jacket and shirt.');
    });

    it('should handle core:name component for item name', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:material': { material: 'silk' },
          'core:name': { text: 'blouse' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('silk');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: silk blouse.');
    });

    it('should throw error for invalid entity ID', async () => {
      // Arrange & Act & Assert
      await expect(service.generateEquipmentDescription('')).rejects.toThrow(
        'Invalid Entity ID'
      );
    });

    it('should handle missing entity gracefully', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(null);

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not find entity for garment: shirt_1'
      );
    });
  });

  describe('descriptor extraction', () => {
    it('should extract descriptors in correct order', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'descriptors:style': { style: 'formal' },
          'core:material': { material: 'silk' },
          'descriptors:color_basic': { color: 'white' },
          'descriptors:texture': { texture: 'smooth' },
          'descriptors:embellishment': { embellishment: 'crystal' },
          'core:name': { text: 'shirt' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue(
        'silk, white, smooth, crystal, formal'
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe(
        'Wearing: silk, white, smooth, crystal, formal shirt.'
      );
      expect(mockDescriptorFormatter.formatDescriptors).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentId: 'core:material',
            value: 'silk',
          }),
          expect.objectContaining({
            componentId: 'descriptors:color_basic',
            value: 'white',
          }),
          expect.objectContaining({
            componentId: 'descriptors:texture',
            value: 'smooth',
          }),
          expect.objectContaining({
            componentId: 'descriptors:embellishment',
            value: 'crystal',
          }),
          expect.objectContaining({
            componentId: 'descriptors:style',
            value: 'formal',
          }),
        ]),
        { separator: ', ' }
      );
    });

    it('should fall back to string values when descriptor keys are missing', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'descriptors:color_basic': { unexpected: 'amber' },
          'core:name': { text: 'shirt' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('amber');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: amber shirt.');
      expect(mockDescriptorFormatter.formatDescriptors).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            componentId: 'descriptors:color_basic',
            value: 'amber',
          }),
        ]),
        { separator: ', ' }
      );
    });
  });

  describe('service failure handling', () => {
    it('should handle service failure gracefully', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: false,
        errors: ['Database connection failed'],
      });

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get equipped items for entity character_1: Database connection failed'
      );
    });

    it('should handle malformed service response', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: 'invalid-data-type',
      });

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
    });

    it('should handle service response with null equipped data', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: null,
      });

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
    });

    it('should handle service response with undefined equipped data', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: undefined,
      });

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('new entity format support', () => {
    it('should handle new entity format with getComponentData method', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'shirt' },
            'core:material': { material: 'cotton' },
            'descriptors:color_basic': { color: 'blue' },
          };
          return components[componentType];
        }),
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('cotton, blue');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: cotton, blue shirt.');
      expect(mockShirtEntity.getComponentData).toHaveBeenCalledWith(
        'core:name'
      );
      expect(mockShirtEntity.getComponentData).toHaveBeenCalledWith(
        'core:material'
      );
      expect(mockShirtEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:color_basic'
      );
    });

    it('should handle new entity format with missing name component', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:material': { material: 'cotton' },
            'descriptors:color_basic': { color: 'blue' },
          };
          return components[componentType];
        }),
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('cotton, blue');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No name found for equipment entity: shirt_1'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Available components: core:material, descriptors:color_basic'
      );
    });

    it('should handle new entity format with core:description fallback', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:description': { text: 'A simple shirt' },
            'core:material': { material: 'cotton' },
          };
          return components[componentType];
        }),
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('cotton');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: cotton A simple shirt.');
      expect(mockShirtEntity.getComponentData).toHaveBeenCalledWith(
        'core:name'
      );
      expect(mockShirtEntity.getComponentData).toHaveBeenCalledWith(
        'core:description'
      );
    });

    it('should handle entity without getComponentData method (legacy format)', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:name': { text: 'shirt' },
          'core:material': { material: 'cotton' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('cotton');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: cotton shirt.');
      // Should not call getComponentData since it doesn't exist
    });

    it('should handle entity with no components property and no getComponentData method', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        // No components property and no getComponentData method
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No components found for equipment entity: shirt_1'
      );
    });

    it('should omit exposure notes when torso slot is occupied', async () => {
      // Arrange
      const entityId = 'character_1';
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {
          torso_upper: {
            base: 'shirt_1',
          },
        },
      });

      mockEntityManager.getEntityInstance.mockResolvedValue({
        id: 'shirt_1',
        components: {
          'core:name': { text: 'shirt' },
        },
      });

      mockEntityManager.getComponentData.mockImplementation((requestedId, componentId) => {
        if (requestedId === entityId && componentId === 'clothing:slot_metadata') {
          return {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['left_breast', 'right_breast'],
              },
            },
          };
        }

        if (requestedId === entityId && componentId === 'anatomy:body') {
          return {
            body: {
              parts: ['torso', 'left_breast', 'right_breast'],
            },
          };
        }

        if (componentId === 'anatomy:part' && requestedId.includes('breast')) {
          return { subType: 'breast' };
        }

        return null;
      });

      mockDescriptorFormatter.formatDescriptors.mockReturnValue('');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: shirt.');
    });

    it('should calculate exposure when equipped data is unavailable', async () => {
      // Arrange
      const entityId = 'character_1';
      const leftBreastPartId = 'character_1_left_breast';
      const rightBreastPartId = 'character_1_right_breast';
      const retrievalError = new Error('service failure');

      mockClothingManagementService.getEquippedItems.mockRejectedValue(
        retrievalError
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
                },
              };
            }

            if (componentId === 'anatomy:body') {
              return {
                body: {
                  parts: {
                    left: leftBreastPartId,
                    placeholder: null,
                    right: rightBreastPartId,
                  },
                },
              };
            }
          }

          if (
            componentId === 'anatomy:part' &&
            (requestedEntityId === leftBreastPartId ||
              requestedEntityId === rightBreastPartId)
          ) {
            return { subType: 'breast' };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: Torso is fully exposed. The breasts are exposed.');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get equipped items for entity character_1',
        retrievalError
      );
    });

    it('should avoid breast exposure notes when anatomy body is missing', async () => {
      // Arrange
      const entityId = 'character_1';

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {},
      });

      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_upper: {
                    coveredSockets: ['left_breast', 'right_breast'],
                  },
                },
              };
            }

            if (componentId === 'anatomy:body') {
              return null;
            }
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: Torso is fully exposed.');
    });

    it('should ignore invalid anatomy part identifiers when checking for breasts', async () => {
      // Arrange
      const entityId = 'character_1';

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: {},
      });

      mockEntityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (requestedEntityId === entityId) {
            if (componentId === 'clothing:slot_metadata') {
              return {
                slotMappings: {
                  torso_upper: {
                    coveredSockets: ['left_breast', 'right_breast'],
                  },
                },
              };
            }

            if (componentId === 'anatomy:body') {
              return {
                body: {
                  parts: [null, 'torso_core'],
                },
              };
            }
          }

          if (
            componentId === 'anatomy:part' &&
            requestedEntityId === 'torso_core'
          ) {
            return { subType: 'torso' };
          }

          return null;
        }
      );

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: Torso is fully exposed.');
    });
  });

  describe('data transformation', () => {
    it('should handle multiple layers in the same slot', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: 'shirt_1',
          outer: 'jacket_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:name': { text: 'shirt' },
        },
      };

      const mockJacketEntity = {
        id: 'jacket_1',
        components: {
          'core:name': { text: 'jacket' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(mockJacketEntity) // Outer layer first due to sorting
        .mockResolvedValueOnce(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('')
        .mockReturnValueOnce('');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: jacket and shirt.');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
    });

    it('should handle empty slot data', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {},
        feet_clothing: {
          base: 'boots_1',
        },
      };

      const mockBootsEntity = {
        id: 'boots_1',
        components: {
          'core:name': { text: 'boots' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockBootsEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: boots.');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
    });

    it('should handle null garment IDs', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          base: null,
          outer: 'jacket_1',
        },
      };

      const mockJacketEntity = {
        id: 'jacket_1',
        components: {
          'core:name': { text: 'jacket' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockJacketEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: jacket.');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown layer names', async () => {
      // Arrange
      const entityId = 'character_1';
      const equippedData = {
        torso_clothing: {
          unknown_layer: 'shirt_1',
        },
      };

      const mockShirtEntity = {
        id: 'shirt_1',
        components: {
          'core:name': { text: 'shirt' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: shirt.');
      // Should assign default layer index (0) for unknown layers
    });
  });
});
