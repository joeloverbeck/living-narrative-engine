import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import EquipmentDescriptionService from '../../../../src/clothing/services/equipmentDescriptionService.js';

describe('EquipmentDescriptionService - Name Component Resolution', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockDescriptorFormatter;
  let mockClothingManagementService;
  let mockAnatomyFormattingService;

  beforeEach(() => {
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

    service = new EquipmentDescriptionService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      descriptorFormatter: mockDescriptorFormatter,
      clothingManagementService: mockClothingManagementService,
      anatomyFormattingService: mockAnatomyFormattingService,
    });
  });

  describe('core:name component resolution', () => {
    it('should prioritize core:name component over core:description', async () => {
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
          'core:name': { text: 'silk blouse' },
          'core:description': { text: 'A fancy shirt' },
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
      expect(result).toBe('Wearing: silk blouse.');
    });

    it('should use core:name text property correctly', async () => {
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
          'core:name': { text: 'elegant dress shirt' },
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
      expect(result).toBe('Wearing: elegant dress shirt.');
    });

    it('should handle empty core:name text gracefully', async () => {
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
          'core:name': { text: '' },
          'core:description': { text: 'backup name' },
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
      expect(result).toBe('Wearing: backup name.');
    });

    it('should handle missing text property in core:name', async () => {
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
          'core:name': {
            /* missing text property */
          },
          'core:description': { text: 'fallback name' },
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
      expect(result).toBe('Wearing: fallback name.');
    });
  });

  describe('core:description component fallback', () => {
    it('should fallback to core:description when core:name is missing', async () => {
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
          'core:description': { text: 'basic shirt' },
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
      expect(result).toBe('Wearing: basic shirt.');
    });

    it('should use core:description text property correctly', async () => {
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
          'core:description': { text: 'comfortable cotton shirt' },
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
      expect(result).toBe('Wearing: comfortable cotton shirt.');
    });

    it('should handle empty core:description text', async () => {
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
          'core:description': { text: '' },
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
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No name found for equipment entity: shirt_1'
      );
    });

    it('should handle missing text property in core:description', async () => {
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
          'core:description': {
            /* missing text property */
          },
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
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No name found for equipment entity: shirt_1'
      );
    });
  });

  describe('error cases', () => {
    it('should warn when no name components are present', async () => {
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
          // No name or description components
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
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No name found for equipment entity: shirt_1'
      );
    });

    it('should warn when both name components are empty', async () => {
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
          'core:name': { text: '' },
          'core:description': { text: '' },
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
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No name found for equipment entity: shirt_1'
      );
    });

    it('should warn when both name components have missing text properties', async () => {
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
          'core:name': {
            /* missing text */
          },
          'core:description': {
            /* missing text */
          },
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
      expect(result).toBe('');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No name found for equipment entity: shirt_1'
      );
    });
  });

  describe('integration with descriptors', () => {
    it('should combine core:name with descriptors correctly', async () => {
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
          'core:name': { text: 'dress shirt' },
          'core:material': { material: 'silk' },
          'descriptors:color_basic': { color: 'white' },
        },
      };

      mockClothingManagementService.getEquippedItems.mockResolvedValue({
        success: true,
        equipped: equippedData,
      });
      mockEntityManager.getEntityInstance.mockResolvedValue(mockShirtEntity);
      mockDescriptorFormatter.formatDescriptors.mockReturnValue('silk, white');

      // Act
      const result = await service.generateEquipmentDescription(entityId);

      // Assert
      expect(result).toBe('Wearing: silk, white dress shirt.');
    });

    it('should handle core:name with empty descriptors', async () => {
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
          'core:name': { text: 'plain shirt' },
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
      expect(result).toBe('Wearing: plain shirt.');
    });
  });
});
