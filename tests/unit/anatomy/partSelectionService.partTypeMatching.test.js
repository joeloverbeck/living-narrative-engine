/**
 * @file Unit tests for PartSelectionService partType/subType matching
 * Tests the validation logic that ensures entity subType matches recipe partType
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PartSelectionService } from '../../../src/anatomy/partSelectionService.js';
import {
  createMockEventDispatchService,
  createMockLogger,
} from '../../common/mockFactories/index.js';

/**
 * Creates a minimal mock data registry holding entity definitions.
 *
 * @param {object[]} definitions - Definitions to return from the registry
 * @returns {{get: jest.Mock, getAll: jest.Mock}} Mock registry
 */
const createMockDataRegistry = (definitions) => ({
  get: jest.fn((type, id) => definitions.find((d) => d.id === id)),
  getAll: jest.fn(() => definitions),
});

describe('PartSelectionService - partType/subType Matching', () => {
  let service;
  let mockRegistry;
  let mockLogger;
  let mockDispatchService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockDispatchService = createMockEventDispatchService();
  });

  describe('Exact Match Validation', () => {
    it('should accept entity when subType matches partType exactly', async () => {
      // Create entity definition with specific subType
      const defs = [
        {
          id: 'anatomy:spider_leg',
          components: {
            'anatomy:part': {
              subType: 'spider_leg', // Specific type
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      // Create requirements with matching partType
      const requirements = {
        partType: 'spider_leg', // Must match subType
        components: ['anatomy:part'],
      };

      const allowedTypes = ['spider_leg'];

      // Should find matching entity
      const result = await service.selectPart(requirements, allowedTypes, undefined, Math.random);

      expect(result).toBe('anatomy:spider_leg');
    });

    it('should reject entity when subType does not match partType', async () => {
      // Create entity definition with generic subType
      const defs = [
        {
          id: 'anatomy:spider_leg',
          components: {
            'anatomy:part': {
              subType: 'leg', // Generic type (WRONG)
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      // Create requirements with specific partType
      const requirements = {
        partType: 'spider_leg', // Expects specific type
        components: ['anatomy:part'],
      };

      const allowedTypes = ['leg', 'spider_leg'];

      // Should throw because subType "leg" !== partType "spider_leg"
      await expect(
        service.selectPart(requirements, allowedTypes, undefined, Math.random)
      ).rejects.toThrow('No entity definitions found matching anatomy requirements');
    });

    it('should accept entity when no partType is specified', async () => {
      // When no partType specified, only allowedTypes matters
      const defs = [
        {
          id: 'anatomy:generic_leg',
          components: {
            'anatomy:part': {
              subType: 'leg',
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      const requirements = {
        // No partType specified
        components: ['anatomy:part'],
      };

      const allowedTypes = ['leg'];

      const result = await service.selectPart(requirements, allowedTypes, undefined, Math.random);

      expect(result).toBe('anatomy:generic_leg');
    });
  });

  describe('Multiple Entity Selection', () => {
    it('should select correct entity when multiple entities have same generic subType', async () => {
      // Multiple entities with same generic subType but different IDs
      const defs = [
        {
          id: 'anatomy:human_leg',
          components: {
            'anatomy:part': {
              subType: 'leg', // Generic
            },
          },
        },
        {
          id: 'anatomy:spider_leg',
          components: {
            'anatomy:part': {
              subType: 'spider_leg', // Specific (correct)
            },
          },
        },
        {
          id: 'anatomy:dragon_leg',
          components: {
            'anatomy:part': {
              subType: 'dragon_leg', // Specific (different creature)
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      const requirements = {
        partType: 'spider_leg',
        components: ['anatomy:part'],
      };

      const allowedTypes = ['leg', 'spider_leg', 'dragon_leg'];

      const result = await service.selectPart(requirements, allowedTypes, undefined, Math.random);

      // Should select spider_leg, not human_leg or dragon_leg
      expect(result).toBe('anatomy:spider_leg');
    });

    it('should throw when no entities match both allowedTypes and partType', async () => {
      const defs = [
        {
          id: 'anatomy:human_leg',
          components: {
            'anatomy:part': {
              subType: 'leg', // Doesn't match partType
            },
          },
        },
        {
          id: 'anatomy:dragon_leg',
          components: {
            'anatomy:part': {
              subType: 'dragon_leg', // Doesn't match partType
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      const requirements = {
        partType: 'spider_leg', // No entity has this subType
        components: ['anatomy:part'],
      };

      const allowedTypes = ['leg', 'spider_leg', 'dragon_leg'];

      // Should throw because no entity matches spider_leg
      await expect(
        service.selectPart(requirements, allowedTypes, undefined, Math.random)
      ).rejects.toThrow('No entity definitions found matching anatomy requirements');
    });
  });

  describe('AllowedTypes and PartType Interaction', () => {
    it('should validate both allowedTypes and partType constraints', async () => {
      const defs = [
        {
          id: 'anatomy:spider_leg',
          components: {
            'anatomy:part': {
              subType: 'spider_leg',
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      const requirements = {
        partType: 'spider_leg',
        components: ['anatomy:part'],
      };

      // allowedTypes includes spider_leg
      const allowedTypes1 = ['spider_leg', 'leg'];
      const result1 = await service.selectPart(requirements, allowedTypes1, undefined, Math.random);
      expect(result1).toBe('anatomy:spider_leg'); // Should match

      // allowedTypes does NOT include spider_leg
      const allowedTypes2 = ['leg', 'arm'];
      await expect(
        service.selectPart(requirements, allowedTypes2, undefined, Math.random)
      ).rejects.toThrow('No entity definitions found matching anatomy requirements'); // Should throw (subType not in allowedTypes)
    });

    it('should accept wildcard in allowedTypes', async () => {
      const defs = [
        {
          id: 'anatomy:spider_leg',
          components: {
            'anatomy:part': {
              subType: 'spider_leg',
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      const requirements = {
        partType: 'spider_leg',
        components: ['anatomy:part'],
      };

      // Wildcard allows any type
      const allowedTypes = ['*'];

      const result = await service.selectPart(requirements, allowedTypes, undefined, Math.random);

      expect(result).toBe('anatomy:spider_leg');
    });
  });

  describe('Real-World Spider Scenario', () => {
    it('should reproduce the bug: spider_leg entity with subType="leg" rejected for partType="spider_leg"', async () => {
      // This reproduces the actual bug from the error logs
      const defs = [
        {
          id: 'anatomy:spider_leg',
          components: {
            'anatomy:part': {
              subType: 'leg', // BUG: Generic instead of specific
            },
            'core:name': {
              text: 'spider leg',
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      const requirements = {
        partType: 'spider_leg', // Recipe requires specific type
        components: ['anatomy:part'],
        tags: ['anatomy:part'],
      };

      const allowedTypes = ['leg']; // Socket allows generic type

      // Should throw because subType "leg" !== partType "spider_leg"
      await expect(
        service.selectPart(requirements, allowedTypes, undefined, Math.random)
      ).rejects.toThrow('No entity definitions found matching anatomy requirements'); // Bug reproduced: No match found
    });

    it('should work after fix: spider_leg entity with subType="spider_leg" accepted', async () => {
      // This shows the fix: entity subType matches recipe partType
      const defs = [
        {
          id: 'anatomy:spider_leg',
          components: {
            'anatomy:part': {
              subType: 'spider_leg', // FIXED: Specific type matches recipe
            },
            'core:name': {
              text: 'spider leg',
            },
          },
        },
      ];

      mockRegistry = createMockDataRegistry(defs);
      service = new PartSelectionService({
        dataRegistry: mockRegistry,
        logger: mockLogger,
        eventDispatchService: mockDispatchService,
      });

      const requirements = {
        partType: 'spider_leg',
        components: ['anatomy:part'],
        tags: ['anatomy:part'],
      };

      const allowedTypes = ['spider_leg']; // Socket allows specific type

      // Should succeed because subType "spider_leg" === partType "spider_leg"
      const result = await service.selectPart(requirements, allowedTypes, undefined, Math.random);

      expect(result).toBe('anatomy:spider_leg');
    });
  });
});
