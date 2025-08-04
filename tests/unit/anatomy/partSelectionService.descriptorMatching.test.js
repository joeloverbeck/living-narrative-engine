import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';

describe('PartSelectionService - Descriptor Matching', () => {
  let partSelectionService;
  let mockDataRegistry;
  let mockLogger;
  let mockEventDispatchService;

  beforeEach(() => {
    mockDataRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventDispatchService = {
      safeDispatchEvent: jest.fn().mockResolvedValue(undefined),
    };

    partSelectionService = new PartSelectionService({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      eventDispatchService: mockEventDispatchService,
    });
  });

  describe('Property-based matching for torso parts', () => {
    it('should select torso entity based on descriptor properties', async () => {
      // Mock entity definitions that should be available
      const entities = [
        {
          id: 'anatomy:human_male_torso',
          components: {
            'anatomy:part': { subType: 'torso' },
            'core:name': { text: 'torso' },
          },
        },
        {
          id: 'anatomy:human_male_torso_thick_hairy',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thick' },
            'descriptors:body_hair': { density: 'hairy' },
            'core:name': { text: 'torso' },
          },
        },
        {
          id: 'anatomy:human_male_torso_thin_smooth',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thin' },
            'descriptors:body_hair': { density: 'smooth' },
            'core:name': { text: 'torso' },
          },
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(entities);

      // Define requirements and recipe slot
      const requirements = {
        partType: 'torso',
        components: ['anatomy:part'],
      };

      const allowedTypes = ['torso'];

      const recipeSlot = {
        partType: 'torso',
        properties: {
          'descriptors:build': { build: 'thick' },
          'descriptors:body_hair': { density: 'hairy' },
        },
      };

      // Mock RNG for predictable results
      const mockRng = jest.fn().mockReturnValue(0); // Always select first candidate

      // Call selectPart
      const result = await partSelectionService.selectPart(
        requirements,
        allowedTypes,
        recipeSlot,
        mockRng
      );

      // Should select the thick hairy torso that matches the properties
      expect(result).toBe('anatomy:human_male_torso_thick_hairy');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Selected 'anatomy:human_male_torso_thick_hairy'"
        )
      );
    });

    it('should handle multiple matching candidates with randomization', async () => {
      const entities = [
        {
          id: 'anatomy:human_male_torso_muscular_v1',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'muscular' },
            'core:name': { text: 'torso' },
          },
        },
        {
          id: 'anatomy:human_male_torso_muscular_v2',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'muscular' },
            'core:name': { text: 'torso' },
          },
        },
        {
          id: 'anatomy:human_male_torso_thin',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thin' },
            'core:name': { text: 'torso' },
          },
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(entities);

      const requirements = { partType: 'torso' };
      const allowedTypes = ['torso'];
      const recipeSlot = {
        partType: 'torso',
        properties: {
          'descriptors:build': { build: 'muscular' },
        },
      };

      // Test multiple selections to verify randomization
      const results = [];
      for (let i = 0; i < 10; i++) {
        // Alternate between first and second candidate
        const mockRng = jest.fn().mockReturnValue(i % 2 === 0 ? 0 : 0.9);

        const result = await partSelectionService.selectPart(
          requirements,
          allowedTypes,
          recipeSlot,
          mockRng
        );

        results.push(result);
      }

      // Should only select muscular variants, not the thin one
      results.forEach((result) => {
        expect([
          'anatomy:human_male_torso_muscular_v1',
          'anatomy:human_male_torso_muscular_v2',
        ]).toContain(result);
      });

      // Should use both variants due to randomization
      const uniqueResults = [...new Set(results)];
      expect(uniqueResults.length).toBe(2);
    });

    it('should reject entities that do not match descriptor properties', async () => {
      const entities = [
        {
          id: 'anatomy:human_male_torso_default',
          components: {
            'anatomy:part': { subType: 'torso' },
            'core:name': { text: 'torso' },
          },
        },
        {
          id: 'anatomy:human_male_torso_thin',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thin' },
            'core:name': { text: 'torso' },
          },
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(entities);

      const requirements = { partType: 'torso' };
      const allowedTypes = ['torso'];
      const recipeSlot = {
        partType: 'torso',
        properties: {
          'descriptors:build': { build: 'thick' }, // Neither entity matches this
        },
      };

      const mockRng = jest.fn();

      // Should throw ValidationError because no candidates match
      await expect(
        partSelectionService.selectPart(
          requirements,
          allowedTypes,
          recipeSlot,
          mockRng
        )
      ).rejects.toThrow(
        'No entity definitions found matching anatomy requirements'
      );

      // Should have dispatched error event
      expect(mockEventDispatchService.safeDispatchEvent).toHaveBeenCalled();
    });

    it('should prefer preferId over property matching when both are specified and preferId meets requirements', async () => {
      const entities = [
        {
          id: 'anatomy:preferred_torso',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thick' }, // Same as properties - should pass validation
            'core:name': { text: 'torso' },
          },
        },
        {
          id: 'anatomy:property_match_torso',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thick' }, // Matches properties
            'core:name': { text: 'torso' },
          },
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(entities);
      // Mock the get method to return the preferred entity when looking up by ID
      mockDataRegistry.get.mockImplementation((registry, id) => {
        if (
          registry === 'entityDefinitions' &&
          id === 'anatomy:preferred_torso'
        ) {
          return entities.find((e) => e.id === id);
        }
        return undefined;
      });

      const requirements = { partType: 'torso' };
      const allowedTypes = ['torso'];
      const recipeSlot = {
        partType: 'torso',
        preferId: 'anatomy:preferred_torso', // This should be preferred
        properties: {
          'descriptors:build': { build: 'thick' }, // This matches both entities
        },
      };

      const mockRng = jest.fn();

      const result = await partSelectionService.selectPart(
        requirements,
        allowedTypes,
        recipeSlot,
        mockRng
      );

      // Should prefer the preferId over property matching
      expect(result).toBe('anatomy:preferred_torso');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Using preferred part 'anatomy:preferred_torso'"
        )
      );
    });

    it('should handle complex multi-property matching', async () => {
      const entities = [
        {
          id: 'anatomy:partial_match',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thick' }, // Matches
            'descriptors:body_hair': { density: 'smooth' }, // Does not match
          },
        },
        {
          id: 'anatomy:full_match',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thick' }, // Matches
            'descriptors:body_hair': { density: 'hairy' }, // Matches
            'descriptors:skin_tone': { tone: 'fair' }, // Matches
          },
        },
        {
          id: 'anatomy:no_match',
          components: {
            'anatomy:part': { subType: 'torso' },
            'descriptors:build': { build: 'thin' }, // Does not match
          },
        },
      ];

      mockDataRegistry.getAll.mockReturnValue(entities);

      const requirements = { partType: 'torso' };
      const allowedTypes = ['torso'];
      const recipeSlot = {
        partType: 'torso',
        properties: {
          'descriptors:build': { build: 'thick' },
          'descriptors:body_hair': { density: 'hairy' },
          'descriptors:skin_tone': { tone: 'fair' },
        },
      };

      const mockRng = jest.fn().mockReturnValue(0);

      const result = await partSelectionService.selectPart(
        requirements,
        allowedTypes,
        recipeSlot,
        mockRng
      );

      // Should only select the entity that matches ALL properties
      expect(result).toBe('anatomy:full_match');
    });
  });
});
