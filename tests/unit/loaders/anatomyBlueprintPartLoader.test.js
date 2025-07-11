/**
 * @file Tests for AnatomyBlueprintPartLoader
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyBlueprintPartLoader from '../../../src/loaders/anatomyBlueprintPartLoader.js';
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
    qualifiedId: 'anatomy:humanoid_base',
    didOverride: false,
  }),
}));

import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';

describe('AnatomyBlueprintPartLoader', () => {
  let loader;
  let logger;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
    const dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomyBlueprintPartLoader(
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
    it('processes a valid blueprint part and stores it', async () => {
      const data = {
        id: 'anatomy:humanoid_base',
        description: 'Common humanoid anatomy structure',
        slots: {
          head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'humanoid_base.part.json',
        '/tmp/humanoid_base.part.json',
        data,
        'anatomyBlueprintParts'
      );

      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          data,
          idProp: 'id',
          category: 'anatomyBlueprintParts',
          modId: 'anatomy',
          filename: 'humanoid_base.part.json',
        })
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'AnatomyBlueprintPartLoader [anatomy]: Processing fetched item: humanoid_base.part.json (Type: anatomyBlueprintParts)'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'AnatomyBlueprintPartLoader [anatomy]: Successfully processed anatomy blueprint part from humanoid_base.part.json. Final registry key: anatomy:humanoid_base, Overwrite: false'
      );
      expect(result).toEqual({
        qualifiedId: 'anatomy:humanoid_base',
        didOverride: false,
      });
    });

    it('processes a blueprint part with library reference', async () => {
      const data = {
        id: 'anatomy:humanoid_core',
        library: 'anatomy:humanoid_slots',
        slots: {
          head: {
            $use: 'standard_head',
          },
        },
        clothingSlotMappings: {
          head_gear: {
            $use: 'standard_head_gear',
          },
        },
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'humanoid_core.part.json',
        '/tmp/humanoid_core.part.json',
        data,
        'anatomyBlueprintParts'
      );

      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          data,
          idProp: 'id',
          category: 'anatomyBlueprintParts',
          modId: 'anatomy',
          filename: 'humanoid_core.part.json',
        })
      );
      expect(result).toEqual({
        qualifiedId: 'anatomy:humanoid_base',
        didOverride: false,
      });
    });

    it('throws if id is missing', async () => {
      const data = {
        description: 'Missing ID',
        slots: {},
      };

      await expect(
        loader._processFetchedItem(
          'anatomy',
          'missing_id.part.json',
          '/tmp/missing_id.part.json',
          data,
          'anatomyBlueprintParts'
        )
      ).rejects.toThrow(
        "Invalid blueprint part in 'missing_id.part.json' from mod 'anatomy'. Missing required 'id' field."
      );
    });

    it('processes minimal blueprint part with only id', async () => {
      const data = {
        id: 'anatomy:minimal',
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'minimal.part.json',
        '/tmp/minimal.part.json',
        data,
        'anatomyBlueprintParts'
      );

      expect(processAndStoreItem).toHaveBeenCalled();
      expect(result.qualifiedId).toBe('anatomy:humanoid_base'); // Mock return value
    });
  });

  describe('loader type', () => {
    it('was created as AnatomyBlueprintPartLoader', () => {
      expect(loader.constructor.name).toBe('AnatomyBlueprintPartLoader');
    });
  });
});
