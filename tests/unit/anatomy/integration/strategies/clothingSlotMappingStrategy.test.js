/**
 * @file Unit tests for ClothingSlotMappingStrategy class
 * @see src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ClothingSlotMappingStrategy from '../../../../../src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js';
import {
  ClothingSlotNotFoundError,
  InvalidClothingSlotMappingError,
} from '../../../../../src/errors/clothingSlotErrors.js';

describe('ClothingSlotMappingStrategy', () => {
  let strategy;
  let mockLogger;
  let mockEntityManager;
  let mockAnatomyBlueprintRepository;
  let mockBlueprintSlotStrategy;
  let mockDirectSocketStrategy;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockAnatomyBlueprintRepository = {
      getBlueprintByRecipeId: jest.fn(),
    };

    mockBlueprintSlotStrategy = {
      canResolve: jest.fn(),
      resolve: jest.fn(),
    };

    mockDirectSocketStrategy = {
      canResolve: jest.fn(),
      resolve: jest.fn(),
    };

    strategy = new ClothingSlotMappingStrategy({
      logger: mockLogger,
      entityManager: mockEntityManager,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      blueprintSlotStrategy: mockBlueprintSlotStrategy,
      directSocketStrategy: mockDirectSocketStrategy,
    });
  });

  describe('constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(strategy).toBeDefined();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should validate required dependencies - missing entityManager', () => {
      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          // Missing entityManager
          anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
          blueprintSlotStrategy: mockBlueprintSlotStrategy,
          directSocketStrategy: mockDirectSocketStrategy,
        });
      }).toThrow();
    });

    it('should validate required dependencies - missing anatomyBlueprintRepository', () => {
      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          entityManager: mockEntityManager,
          // Missing anatomyBlueprintRepository
          blueprintSlotStrategy: mockBlueprintSlotStrategy,
          directSocketStrategy: mockDirectSocketStrategy,
        });
      }).toThrow();
    });

    it('should validate required dependencies - missing blueprintSlotStrategy', () => {
      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
          // Missing blueprintSlotStrategy
          directSocketStrategy: mockDirectSocketStrategy,
        });
      }).toThrow();
    });

    it('should validate required dependencies - missing directSocketStrategy', () => {
      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
          blueprintSlotStrategy: mockBlueprintSlotStrategy,
          // Missing directSocketStrategy
        });
      }).toThrow();
    });

    it('should validate entityManager has required methods', () => {
      const invalidEntityManager = {
        getComponentData: jest.fn(),
        // Missing hasComponent method
      };

      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          entityManager: invalidEntityManager,
          anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
          blueprintSlotStrategy: mockBlueprintSlotStrategy,
          directSocketStrategy: mockDirectSocketStrategy,
        });
      }).toThrow();
    });

    it('should validate anatomyBlueprintRepository has required methods', () => {
      const invalidRepository = {
        // Missing getBlueprintByRecipeId method
      };

      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyBlueprintRepository: invalidRepository,
          blueprintSlotStrategy: mockBlueprintSlotStrategy,
          directSocketStrategy: mockDirectSocketStrategy,
        });
      }).toThrow();
    });

    it('should validate blueprintSlotStrategy has required methods', () => {
      const invalidStrategy = {
        canResolve: jest.fn(),
        // Missing resolve method
      };

      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
          blueprintSlotStrategy: invalidStrategy,
          directSocketStrategy: mockDirectSocketStrategy,
        });
      }).toThrow();
    });

    it('should validate directSocketStrategy has required methods', () => {
      const invalidStrategy = {
        canResolve: jest.fn(),
        // Missing resolve method
      };

      expect(() => {
        new ClothingSlotMappingStrategy({
          logger: mockLogger,
          entityManager: mockEntityManager,
          anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
          blueprintSlotStrategy: mockBlueprintSlotStrategy,
          directSocketStrategy: invalidStrategy,
        });
      }).toThrow();
    });
  });

  describe('canResolve', () => {
    it('should return true for valid clothing slot mapping', () => {
      const mapping = { clothingSlotId: 'bra' };
      expect(strategy.canResolve(mapping)).toBe(true);
    });

    it('should return false for blueprint slot mapping', () => {
      const mapping = { blueprintSlots: ['left_breast'] };
      expect(strategy.canResolve(mapping)).toBe(false);
    });

    it('should return false for direct socket mapping', () => {
      const mapping = { socket: 'chest' };
      expect(strategy.canResolve(mapping)).toBe(false);
    });

    it('should return false for anatomy sockets mapping', () => {
      const mapping = { anatomySockets: ['vagina'] };
      expect(strategy.canResolve(mapping)).toBe(false);
    });

    it('should return false for null mapping', () => {
      expect(strategy.canResolve(null)).toBe(false);
    });

    it('should return false for undefined mapping', () => {
      expect(strategy.canResolve(undefined)).toBe(false);
    });

    it('should return false for empty clothingSlotId', () => {
      const mapping = { clothingSlotId: '' };
      expect(strategy.canResolve(mapping)).toBe(false);
    });

    it('should return false for non-string clothingSlotId', () => {
      const mapping = { clothingSlotId: 123 };
      expect(strategy.canResolve(mapping)).toBe(false);
    });
  });

  describe('resolve', () => {
    const mockBlueprint = {
      id: 'human_base',
      clothingSlotMappings: {
        bra: {
          blueprintSlots: ['left_breast', 'right_breast'],
          allowedLayers: ['underwear'],
        },
        panties: {
          anatomySockets: ['vagina', 'pubic_hair'],
          allowedLayers: ['underwear'],
        },
        shirt: {
          blueprintSlots: ['torso'],
          anatomySockets: ['chest'],
          allowedLayers: ['clothing'],
        },
      },
    };

    beforeEach(() => {
      // Mock entity manager to return body component
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      // Mock blueprint repository
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );
    });

    describe('successful resolution', () => {
      it('should resolve clothing slot with blueprintSlots', async () => {
        const mapping = { clothingSlotId: 'bra' };
        const expectedPoints = [
          {
            entityId: 'torso1',
            socketId: 'left_breast',
            slotPath: 'left_breast',
            orientation: 'left',
          },
          {
            entityId: 'torso1',
            socketId: 'right_breast',
            slotPath: 'right_breast',
            orientation: 'right',
          },
        ];

        mockBlueprintSlotStrategy.resolve.mockResolvedValue(expectedPoints);

        const result = await strategy.resolve('actor123', mapping);

        expect(result).toEqual(expectedPoints);
        expect(mockBlueprintSlotStrategy.resolve).toHaveBeenCalledWith(
          'actor123',
          {
            blueprintSlots: ['left_breast', 'right_breast'],
          },
          undefined
        );
        expect(mockDirectSocketStrategy.resolve).not.toHaveBeenCalled();
      });

      it('should resolve clothing slot with anatomySockets', async () => {
        const mapping = { clothingSlotId: 'panties' };
        const expectedPoints = [
          {
            entityId: 'pelvis1',
            socketId: 'vagina',
            slotPath: 'direct',
            orientation: 'neutral',
          },
          {
            entityId: 'pelvis1',
            socketId: 'pubic_hair',
            slotPath: 'direct',
            orientation: 'neutral',
          },
        ];

        mockDirectSocketStrategy.resolve.mockResolvedValue(expectedPoints);

        const result = await strategy.resolve('actor123', mapping);

        expect(result).toEqual(expectedPoints);
        expect(mockDirectSocketStrategy.resolve).toHaveBeenCalledWith(
          'actor123',
          {
            anatomySockets: ['vagina', 'pubic_hair'],
          }
        );
        expect(mockBlueprintSlotStrategy.resolve).not.toHaveBeenCalled();
      });

      it('should resolve clothing slot with both blueprintSlots and anatomySockets', async () => {
        const mapping = { clothingSlotId: 'shirt' };
        const blueprintPoints = [
          {
            entityId: 'torso1',
            socketId: 'torso',
            slotPath: 'torso',
            orientation: 'neutral',
          },
        ];
        const socketPoints = [
          {
            entityId: 'torso1',
            socketId: 'chest',
            slotPath: 'direct',
            orientation: 'neutral',
          },
        ];

        mockBlueprintSlotStrategy.resolve.mockResolvedValue(blueprintPoints);
        mockDirectSocketStrategy.resolve.mockResolvedValue(socketPoints);

        const result = await strategy.resolve('actor123', mapping);

        expect(result).toEqual([...blueprintPoints, ...socketPoints]);
        expect(mockBlueprintSlotStrategy.resolve).toHaveBeenCalledWith(
          'actor123',
          {
            blueprintSlots: ['torso'],
          },
          undefined
        );
        expect(mockDirectSocketStrategy.resolve).toHaveBeenCalledWith(
          'actor123',
          {
            anatomySockets: ['chest'],
          }
        );
      });
    });

    describe('error scenarios', () => {
      it('should throw ClothingSlotNotFoundError for missing clothing slot', async () => {
        const mapping = { clothingSlotId: 'nonexistent' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          ClothingSlotNotFoundError
        );
        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          `Clothing slot 'nonexistent' not found in blueprint 'human_base' clothing slot mappings. Available slots: bra, panties, shirt`
        );
      });

      it('should throw InvalidClothingSlotMappingError for mapping without blueprintSlots or anatomySockets', async () => {
        const invalidBlueprint = {
          id: 'human_base',
          clothingSlotMappings: {
            invalid: {
              allowedLayers: ['underwear'],
              // Missing blueprintSlots and anatomySockets
            },
          },
        };

        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          invalidBlueprint
        );

        const mapping = { clothingSlotId: 'invalid' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          InvalidClothingSlotMappingError
        );
        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          `Clothing slot 'invalid' mapping is invalid: must have either blueprintSlots or anatomySockets`
        );
      });

      it('should throw InvalidClothingSlotMappingError for mapping with empty arrays', async () => {
        const invalidBlueprint = {
          id: 'human_base',
          clothingSlotMappings: {
            empty: {
              blueprintSlots: [],
              anatomySockets: [],
              allowedLayers: ['underwear'],
            },
          },
        };

        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          invalidBlueprint
        );

        const mapping = { clothingSlotId: 'empty' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          InvalidClothingSlotMappingError
        );
      });

      it('should throw error when no blueprint found for entity', async () => {
        mockEntityManager.getComponentData.mockResolvedValue(null);

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          'No blueprint found for entity actor123'
        );
      });

      it('should throw error when blueprint has no clothingSlotMappings', async () => {
        const blueprintWithoutMappings = {
          id: 'human_base',
          slots: {
            torso: { socket: 'chest' },
          },
          // No clothingSlotMappings
        };

        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          blueprintWithoutMappings
        );

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          ClothingSlotNotFoundError
        );
        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          `Clothing slot 'bra' not found in blueprint 'human_base' clothing slot mappings. Available slots: `
        );
      });

      it('should handle blueprint slot strategy errors', async () => {
        const mapping = { clothingSlotId: 'bra' };
        const blueprintError = new Error('Blueprint slot not found');

        mockBlueprintSlotStrategy.resolve.mockRejectedValue(blueprintError);

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          `Blueprint slot 'Blueprint slot not found' not found in clothing slot 'bra' mapping`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to resolve blueprint slots for clothing slot 'bra'`,
          blueprintError
        );
      });

      it('should handle direct socket strategy errors', async () => {
        const mapping = { clothingSlotId: 'panties' };
        const socketError = new Error('Socket not found');

        mockDirectSocketStrategy.resolve.mockRejectedValue(socketError);

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          `Anatomy socket 'Socket not found' not found in clothing slot 'panties' mapping`
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to resolve anatomy sockets for clothing slot 'panties'`,
          socketError
        );
      });
    });

    describe('edge cases', () => {
      it('should return empty array for invalid mapping', async () => {
        const mapping = { blueprintSlots: ['invalid'] };
        const result = await strategy.resolve('actor123', mapping);
        expect(result).toEqual([]);
      });

      it('should handle blueprint repository errors', async () => {
        const dbError = new Error('Database connection failed');
        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockRejectedValue(
          dbError
        );

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          dbError
        );
      });

      it('should handle entity manager errors', async () => {
        const entityError = new Error('Entity not found');
        mockEntityManager.getComponentData.mockRejectedValue(entityError);

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          entityError
        );
      });
    });

    describe('logging', () => {
      it('should log successful resolution', async () => {
        const mapping = { clothingSlotId: 'bra' };
        const expectedPoints = [
          {
            entityId: 'torso1',
            socketId: 'left_breast',
            slotPath: 'left_breast',
            orientation: 'left',
          },
        ];

        mockBlueprintSlotStrategy.resolve.mockResolvedValue(expectedPoints);

        await strategy.resolve('actor123', mapping);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          `Resolved clothing slot 'bra' to 1 attachment points`
        );
      });

      it('should log blueprint slot resolution errors', async () => {
        const mapping = { clothingSlotId: 'bra' };
        const error = new Error('Blueprint error');

        mockBlueprintSlotStrategy.resolve.mockRejectedValue(error);

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to resolve blueprint slots for clothing slot 'bra'`,
          error
        );
      });

      it('should log anatomy socket resolution errors', async () => {
        const mapping = { clothingSlotId: 'panties' };
        const error = new Error('Socket error');

        mockDirectSocketStrategy.resolve.mockRejectedValue(error);

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          `Failed to resolve anatomy sockets for clothing slot 'panties'`,
          error
        );
      });
    });
  });

  describe('private methods', () => {
    describe('#getEntityBlueprint', () => {
      it('should throw error when entity has no body component', async () => {
        mockEntityManager.getComponentData.mockResolvedValue(null);

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          'No blueprint found for entity actor123'
        );
      });

      it('should throw error when body component has no recipeId', async () => {
        mockEntityManager.getComponentData.mockResolvedValue({});

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          'No blueprint found for entity actor123'
        );
      });

      it('should throw error when body component has empty recipeId', async () => {
        mockEntityManager.getComponentData.mockResolvedValue({
          recipeId: '',
        });

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          'No blueprint found for entity actor123'
        );
      });

      it('should return blueprint when entity has valid body component', async () => {
        const mockBodyComponent = { recipeId: 'human_base' };
        const mockBlueprint = { id: 'human_base', clothingSlotMappings: {} };

        mockEntityManager.getComponentData.mockResolvedValue(mockBodyComponent);
        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          mockBlueprint
        );

        const mapping = { clothingSlotId: 'bra' };

        // This will throw because no mapping found, but we're testing the blueprint retrieval
        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow();

        expect(
          mockAnatomyBlueprintRepository.getBlueprintByRecipeId
        ).toHaveBeenCalledWith('human_base');
      });
    });

    describe('#resolveBlueprintSlots', () => {
      it('should call blueprintSlotStrategy.resolve with correct mapping', async () => {
        const mockBlueprint = {
          id: 'human_base',
          clothingSlotMappings: {
            bra: {
              blueprintSlots: ['left_breast', 'right_breast'],
            },
          },
        };

        mockEntityManager.getComponentData.mockResolvedValue({
          recipeId: 'human_base',
        });
        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          mockBlueprint
        );

        const expectedPoints = [
          { entityId: 'torso1', socketId: 'left_breast' },
        ];
        mockBlueprintSlotStrategy.resolve.mockResolvedValue(expectedPoints);

        const mapping = { clothingSlotId: 'bra' };
        const result = await strategy.resolve('actor123', mapping);

        expect(mockBlueprintSlotStrategy.resolve).toHaveBeenCalledWith(
          'actor123',
          { blueprintSlots: ['left_breast', 'right_breast'] },
          undefined
        );
        expect(result).toEqual(expectedPoints);
      });

      it('should handle blueprintSlotStrategy errors', async () => {
        const mockBlueprint = {
          id: 'human_base',
          clothingSlotMappings: {
            bra: {
              blueprintSlots: ['left_breast'],
            },
          },
        };

        mockEntityManager.getComponentData.mockResolvedValue({
          recipeId: 'human_base',
        });
        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          mockBlueprint
        );

        const error = new Error('Blueprint slot not found');
        mockBlueprintSlotStrategy.resolve.mockRejectedValue(error);

        const mapping = { clothingSlotId: 'bra' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          `Blueprint slot 'Blueprint slot not found' not found in clothing slot 'bra' mapping`
        );
      });
    });

    describe('#resolveAnatomySockets', () => {
      it('should call directSocketStrategy.resolve with correct mapping', async () => {
        const mockBlueprint = {
          id: 'human_base',
          clothingSlotMappings: {
            panties: {
              anatomySockets: ['vagina', 'pubic_hair'],
            },
          },
        };

        mockEntityManager.getComponentData.mockResolvedValue({
          recipeId: 'human_base',
        });
        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          mockBlueprint
        );

        const expectedPoints = [{ entityId: 'pelvis1', socketId: 'vagina' }];
        mockDirectSocketStrategy.resolve.mockResolvedValue(expectedPoints);

        const mapping = { clothingSlotId: 'panties' };
        const result = await strategy.resolve('actor123', mapping);

        expect(mockDirectSocketStrategy.resolve).toHaveBeenCalledWith(
          'actor123',
          { anatomySockets: ['vagina', 'pubic_hair'] }
        );
        expect(result).toEqual(expectedPoints);
      });

      it('should handle directSocketStrategy errors', async () => {
        const mockBlueprint = {
          id: 'human_base',
          clothingSlotMappings: {
            panties: {
              anatomySockets: ['vagina'],
            },
          },
        };

        mockEntityManager.getComponentData.mockResolvedValue({
          recipeId: 'human_base',
        });
        mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
          mockBlueprint
        );

        const error = new Error('Socket not found');
        mockDirectSocketStrategy.resolve.mockRejectedValue(error);

        const mapping = { clothingSlotId: 'panties' };

        await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
          `Anatomy socket 'Socket not found' not found in clothing slot 'panties' mapping`
        );
      });
    });
  });

  describe('additional edge cases', () => {
    it('should handle null blueprint response', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        null
      );

      const mapping = { clothingSlotId: 'bra' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        'No blueprint found for entity actor123'
      );
    });

    it('should handle undefined blueprint response', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        undefined
      );

      const mapping = { clothingSlotId: 'bra' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        'No blueprint found for entity actor123'
      );
    });

    it('should handle async errors from getComponentData', async () => {
      const error = new Error('Database error');
      mockEntityManager.getComponentData.mockRejectedValue(error);

      const mapping = { clothingSlotId: 'bra' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        error
      );
    });

    it('should handle async errors from getBlueprintByRecipeId', async () => {
      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });

      const error = new Error('Blueprint repository error');
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockRejectedValue(
        error
      );

      const mapping = { clothingSlotId: 'bra' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        error
      );
    });

    it('should handle blueprint with undefined clothingSlotMappings', async () => {
      const mockBlueprint = {
        id: 'human_base',
        // clothingSlotMappings is undefined
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );

      const mapping = { clothingSlotId: 'bra' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        ClothingSlotNotFoundError
      );
    });

    it('should handle blueprint with null clothingSlotMappings', async () => {
      const mockBlueprint = {
        id: 'human_base',
        clothingSlotMappings: null,
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );

      const mapping = { clothingSlotId: 'bra' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        ClothingSlotNotFoundError
      );
    });

    it('should handle partial blueprint slots failure with anatomy sockets success', async () => {
      const mockBlueprint = {
        id: 'human_base',
        clothingSlotMappings: {
          shirt: {
            blueprintSlots: ['torso'],
            anatomySockets: ['chest'],
          },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );

      const blueprintError = new Error('Blueprint slot failed');
      mockBlueprintSlotStrategy.resolve.mockRejectedValue(blueprintError);

      const mapping = { clothingSlotId: 'shirt' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        `Blueprint slot 'Blueprint slot failed' not found in clothing slot 'shirt' mapping`
      );
    });

    it('should handle partial anatomy sockets failure with blueprint slots success', async () => {
      const mockBlueprint = {
        id: 'human_base',
        clothingSlotMappings: {
          shirt: {
            blueprintSlots: ['torso'],
            anatomySockets: ['chest'],
          },
        },
      };

      mockEntityManager.getComponentData.mockResolvedValue({
        recipeId: 'human_base',
      });
      mockAnatomyBlueprintRepository.getBlueprintByRecipeId.mockResolvedValue(
        mockBlueprint
      );

      const blueprintPoints = [{ entityId: 'torso1', socketId: 'torso' }];
      mockBlueprintSlotStrategy.resolve.mockResolvedValue(blueprintPoints);

      const socketError = new Error('Anatomy socket failed');
      mockDirectSocketStrategy.resolve.mockRejectedValue(socketError);

      const mapping = { clothingSlotId: 'shirt' };

      await expect(strategy.resolve('actor123', mapping)).rejects.toThrow(
        `Anatomy socket 'Anatomy socket failed' not found in clothing slot 'shirt' mapping`
      );
    });
  });
});
