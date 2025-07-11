/**
 * @file Tests for AnatomySlotLibraryLoader
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomySlotLibraryLoader from '../../../src/loaders/anatomySlotLibraryLoader.js';
import {
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories/index.js';

jest.mock('../../../src/loaders/helpers/processAndStoreItem.js', () => ({
  processAndStoreItem: jest.fn().mockResolvedValue({
    qualifiedId: 'anatomy:humanoid_slots',
    didOverride: false,
  }),
}));

import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';

describe('AnatomySlotLibraryLoader', () => {
  let loader;
  let logger;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
    const dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomySlotLibraryLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    jest.clearAllMocks();
  });

  describe('_processFetchedItem', () => {
    it('processes a valid slot library and stores it', async () => {
      const data = {
        id: 'anatomy:humanoid_slots',
        description: 'Standard humanoid anatomy slot definitions',
        slotDefinitions: {
          standard_head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
        },
        clothingDefinitions: {
          standard_head_gear: {
            blueprintSlots: ['head'],
            allowedLayers: ['base', 'outer', 'armor'],
            defaultLayer: 'base',
          },
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'humanoid.slot-library.json',
        '/tmp/humanoid.slot-library.json',
        data,
        'anatomySlotLibraries'
      );

      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          data,
          idProp: 'id',
          category: 'anatomySlotLibraries',
          modId: 'anatomy',
          filename: 'humanoid.slot-library.json',
        })
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'AnatomySlotLibraryLoader [anatomy]: Processing fetched item: humanoid.slot-library.json (Type: anatomySlotLibraries)'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'AnatomySlotLibraryLoader [anatomy]: Successfully processed anatomy slot library from humanoid.slot-library.json. Final registry key: anatomy:humanoid_slots, Overwrite: false'
      );
      expect(result).toEqual({
        qualifiedId: 'anatomy:humanoid_slots',
        didOverride: false,
      });
    });

    it('processes library with only slot definitions', async () => {
      const data = {
        id: 'anatomy:slots_only',
        slotDefinitions: {
          slot1: {
            socket: 'mount1',
            requirements: { partType: 'type1' },
          },
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'slots_only.slot-library.json',
        '/tmp/slots_only.slot-library.json',
        data,
        'anatomySlotLibraries'
      );

      expect(processAndStoreItem).toHaveBeenCalled();
      expect(result.qualifiedId).toBe('anatomy:humanoid_slots'); // Mock return value
    });

    it('processes library with only clothing definitions', async () => {
      const data = {
        id: 'anatomy:clothing_only',
        clothingDefinitions: {
          gear1: {
            blueprintSlots: ['slot1'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'clothing_only.slot-library.json',
        '/tmp/clothing_only.slot-library.json',
        data,
        'anatomySlotLibraries'
      );

      expect(processAndStoreItem).toHaveBeenCalled();
      expect(result.qualifiedId).toBe('anatomy:humanoid_slots'); // Mock return value
    });

    it('throws if id is missing', async () => {
      const data = {
        description: 'Missing ID',
        slotDefinitions: {},
      };

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'missing_id.slot-library.json',
          '/tmp/missing_id.slot-library.json',
          data,
          'anatomySlotLibraries'
        )
      ).rejects.toThrow(
        "Invalid slot library in 'missing_id.slot-library.json' from mod 'anatomy'. Missing required 'id' field."
      );
    });

    it('processes minimal slot library with only id', async () => {
      const data = {
        id: 'anatomy:minimal',
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'minimal.slot-library.json',
        '/tmp/minimal.slot-library.json',
        data,
        'anatomySlotLibraries'
      );

      expect(processAndStoreItem).toHaveBeenCalled();
      expect(result.qualifiedId).toBe('anatomy:humanoid_slots'); // Mock return value
    });
  });

  describe('loader type', () => {
    it('was created as AnatomySlotLibraryLoader', () => {
      expect(loader.constructor.name).toBe('AnatomySlotLibraryLoader');
    });
  });
});
