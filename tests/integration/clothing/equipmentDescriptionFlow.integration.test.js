import { beforeEach, describe, expect, it } from '@jest/globals';
import EquipmentDescriptionService from '../../../src/clothing/services/equipmentDescriptionService.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('Equipment Description Flow Integration', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockDescriptorFormatter;
  let mockClothingManagementService;
  let mockAnatomyFormattingService;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn(),
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

    service = new EquipmentDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      descriptorFormatter: mockDescriptorFormatter,
      clothingManagementService: mockClothingManagementService,
      anatomyFormattingService: mockAnatomyFormattingService,
    });

    mockEntityManager.getComponentData.mockReturnValue({
      slotMappings: {
        torso_upper: {
          coveredSockets: ['upper_torso', 'breast_left', 'breast_right'],
        },
        torso_lower: {
          coveredSockets: ['genitals'],
        },
      },
    });
  });

  describe('end-to-end equipment description generation', () => {
    it('should generate complete equipment description for character with new entity format', async () => {
      // Arrange
      const characterId = 'test-character';
      const equippedData = {
        torso_upper: {
          outer: 'blazer-id',
        },
        legs: {
          base: 'trousers-id',
        },
        torso_lower: {
          accessories: 'belt-id',
        },
        feet: {
          base: 'pumps-id',
        },
      };

      // Mock blazer entity (new format)
      const blazerEntity = {
        id: 'blazer-id',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'structured blazer' },
            'core:material': { material: 'linen' },
            'descriptors:color_basic': { color: 'white' },
            'descriptors:texture': { texture: 'smooth' },
          };
          return components[componentType];
        }),
      };

      // Mock trousers entity (new format)
      const trousersEntity = {
        id: 'trousers-id',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'wide leg trousers' },
            'core:material': { material: 'wool' },
            'descriptors:color_basic': { color: 'graphite' },
          };
          return components[componentType];
        }),
      };

      // Mock belt entity (new format)
      const beltEntity = {
        id: 'belt-id',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'belt' },
            'core:material': { material: 'calfskin' },
            'descriptors:color_basic': { color: 'black' },
          };
          return components[componentType];
        }),
      };

      // Mock pumps entity (new format)
      const pumpsEntity = {
        id: 'pumps-id',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'stiletto pumps' },
            'core:material': { material: 'leather' },
            'descriptors:color_basic': { color: 'black' },
          };
          return components[componentType];
        }),
      };

      // Setup mocks
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(blazerEntity)
        .mockResolvedValueOnce(trousersEntity)
        .mockResolvedValueOnce(beltEntity)
        .mockResolvedValueOnce(pumpsEntity);

      // Mock descriptor formatter to return realistic descriptions
      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('white linen')
        .mockReturnValueOnce('graphite wool')
        .mockReturnValueOnce('black calfskin')
        .mockReturnValueOnce('black leather');

      // Act
      const result = await service.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe(
        'Wearing: white linen structured blazer | graphite wool wide leg trousers | black calfskin belt | black leather stiletto pumps.'
      );

      // Verify that all entities were retrieved
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(4);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        characterId,
        'clothing:slot_metadata'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'blazer-id'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'trousers-id'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'belt-id'
      );
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'pumps-id'
      );

      // Verify component data was accessed properly
      expect(blazerEntity.getComponentData).toHaveBeenCalledWith('core:name');
      expect(blazerEntity.getComponentData).toHaveBeenCalledWith(
        'core:material'
      );
      expect(blazerEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:color_basic'
      );
      expect(blazerEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:texture'
      );

      // Verify descriptor formatting was called
      expect(mockDescriptorFormatter.formatDescriptors).toHaveBeenCalledTimes(
        4
      );

      // Verify no errors were logged
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle mixed entity formats (legacy and new)', async () => {
      // Arrange
      const characterId = 'test-character';
      const equippedData = {
        torso_upper: {
          base: 'shirt-id',
        },
        feet: {
          base: 'shoes-id',
        },
      };

      // Mock shirt entity (legacy format)
      const shirtEntity = {
        id: 'shirt-id',
        components: {
          'core:name': { text: 'shirt' },
          'core:material': { material: 'cotton' },
          'descriptors:color_basic': { color: 'blue' },
        },
      };

      // Mock shoes entity (new format)
      const shoesEntity = {
        id: 'shoes-id',
        getComponentData: jest.fn((componentType) => {
          const components = {
            'core:name': { text: 'sneakers' },
            'core:material': { material: 'canvas' },
            'descriptors:color_basic': { color: 'white' },
          };
          return components[componentType];
        }),
      };

      // Setup mocks
      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });

      mockEntityManager.getEntityInstance
        .mockResolvedValueOnce(shirtEntity)
        .mockResolvedValueOnce(shoesEntity);

      mockDescriptorFormatter.formatDescriptors
        .mockReturnValueOnce('blue cotton')
        .mockReturnValueOnce('white canvas');

      // Act
      const result = await service.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe(
        'Wearing: blue cotton shirt | white canvas sneakers. Genitals are fully exposed.'
      );

      // Verify that both entity formats were handled
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2);
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        characterId,
        'clothing:slot_metadata'
      );

      // Verify new entity format was accessed properly
      expect(shoesEntity.getComponentData).toHaveBeenCalledWith('core:name');
      expect(shoesEntity.getComponentData).toHaveBeenCalledWith(
        'core:material'
      );
      expect(shoesEntity.getComponentData).toHaveBeenCalledWith(
        'descriptors:color_basic'
      );

      // Verify no errors were logged
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
