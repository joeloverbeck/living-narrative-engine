/**
 * @file Tests for AnatomyBlueprintLoader composition features
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AnatomyBlueprintLoader from '../../../src/loaders/anatomyBlueprintLoader.js';
import {
  createMockConfiguration,
  createMockPathResolver,
  createMockDataFetcher,
  createMockSchemaValidator,
  createSimpleMockDataRegistry,
  createMockLogger,
} from '../../common/mockFactories/index.js';

jest.mock('../../../src/loaders/helpers/processAndStoreItem.js');
import { processAndStoreItem } from '../../../src/loaders/helpers/processAndStoreItem.js';

describe('AnatomyBlueprintLoader - Composition Features', () => {
  let loader;
  let logger;
  let dataRegistry;

  beforeEach(() => {
    const config = createMockConfiguration();
    const pathResolver = createMockPathResolver();
    const dataFetcher = createMockDataFetcher();
    const schemaValidator = createMockSchemaValidator();
    dataRegistry = createSimpleMockDataRegistry();
    logger = createMockLogger();

    loader = new AnatomyBlueprintLoader(
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );

    jest.clearAllMocks();

    processAndStoreItem.mockResolvedValue({
      qualifiedId: 'test:blueprint',
      didOverride: false,
    });
  });

  describe('Simple parts composition', () => {
    it('queues blueprint with parts for later processing', async () => {
      const data = {
        id: 'anatomy:human_male',
        root: 'anatomy:human_male_torso',
        parts: ['anatomy:humanoid_base'],
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'human_male.blueprint.json',
        '/tmp/human_male.blueprint.json',
        data,
        'anatomyBlueprints'
      );

      expect(loader._pendingBlueprints.size).toBe(1);
      expect(loader._pendingBlueprints.has('anatomy:human_male')).toBe(true);
      expect(processAndStoreItem).not.toHaveBeenCalled();
      expect(result).toEqual({
        qualifiedId: 'anatomy:human_male',
        didOverride: false,
      });
    });

    it('composes blueprint with parts during finalize', async () => {
      // Setup part in registry
      const part = {
        id: 'anatomy:humanoid_base',
        slots: {
          head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
          left_arm: {
            socket: 'left_shoulder',
            requirements: {
              partType: 'arm',
            },
          },
        },
        clothingSlotMappings: {
          head_gear: {
            blueprintSlots: ['head'],
            allowedLayers: ['base', 'outer'],
            defaultLayer: 'base',
          },
        },
      };
      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'anatomyBlueprintParts' &&
          id === 'anatomy:humanoid_base'
        ) {
          return part;
        }
        return null;
      });

      const blueprintData = {
        id: 'anatomy:human_male',
        root: 'anatomy:human_male_torso',
        parts: ['anatomy:humanoid_base'],
        slots: {
          penis: {
            socket: 'groin',
            requirements: {
              partType: 'penis',
            },
          },
        },
      };

      // Queue the blueprint
      loader._pendingBlueprints.set('anatomy:human_male', {
        data: blueprintData,
        modId: 'anatomy',
        filename: 'human_male.blueprint.json',
        registryKey: 'anatomyBlueprints',
      });

      // Process during finalize
      await loader.finalize();

      // Check that processAndStoreItem was called with composed data
      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'anatomy:human_male',
            root: 'anatomy:human_male_torso',
            slots: expect.objectContaining({
              head: part.slots.head,
              left_arm: part.slots.left_arm,
              penis: blueprintData.slots.penis,
            }),
            clothingSlotMappings: expect.objectContaining({
              head_gear: part.clothingSlotMappings.head_gear,
            }),
          }),
        })
      );

      // Verify composition fields were removed
      const storedData = processAndStoreItem.mock.calls[0][1].data;
      expect(storedData.parts).toBeUndefined();
      expect(storedData.compose).toBeUndefined();
    });
  });

  describe('Advanced compose instructions', () => {
    it('processes compose instructions with exclusions', async () => {
      const part = {
        id: 'anatomy:humanoid_core',
        slots: {
          head: { socket: 'neck', requirements: { partType: 'head' } },
          left_arm: {
            socket: 'left_shoulder',
            requirements: { partType: 'arm' },
          },
          right_arm: {
            socket: 'right_shoulder',
            requirements: { partType: 'arm' },
          },
        },
        clothingSlotMappings: {
          gloves: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
          shirt: {
            blueprintSlots: ['torso'],
            allowedLayers: ['base'],
            defaultLayer: 'base',
          },
        },
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'anatomyBlueprintParts' &&
          id === 'anatomy:humanoid_core'
        ) {
          return part;
        }
        return null;
      });

      const blueprintData = {
        id: 'anatomy:custom',
        root: 'anatomy:custom_torso',
        compose: [
          {
            part: 'anatomy:humanoid_core',
            include: ['slots', 'clothingSlotMappings'],
            excludeSlots: ['left_arm', 'right_arm'],
            excludeClothingSlots: ['gloves'],
          },
        ],
      };

      const composed = await loader._composeBlueprint(
        blueprintData,
        'test',
        'test.json'
      );

      // Should include head but not arms
      expect(composed.slots.head).toBeDefined();
      expect(composed.slots.left_arm).toBeUndefined();
      expect(composed.slots.right_arm).toBeUndefined();

      // Should include shirt but not gloves
      expect(composed.clothingSlotMappings.shirt).toBeDefined();
      expect(composed.clothingSlotMappings.gloves).toBeUndefined();
    });

    it('processes multiple compose instructions in order', async () => {
      const part1 = {
        id: 'anatomy:base',
        slots: {
          head: { socket: 'neck', requirements: { partType: 'head' } },
        },
      };

      const part2 = {
        id: 'anatomy:wings',
        slots: {
          left_wing: {
            socket: 'back_left',
            requirements: { partType: 'wing' },
          },
          right_wing: {
            socket: 'back_right',
            requirements: { partType: 'wing' },
          },
        },
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'anatomyBlueprintParts') {
          if (id === 'anatomy:base') return part1;
          if (id === 'anatomy:wings') return part2;
        }
        return null;
      });

      const blueprintData = {
        id: 'anatomy:winged',
        root: 'anatomy:winged_torso',
        compose: [
          { part: 'anatomy:base', include: ['slots'] },
          { part: 'anatomy:wings', include: ['slots'] },
        ],
      };

      const composed = await loader._composeBlueprint(
        blueprintData,
        'test',
        'test.json'
      );

      expect(composed.slots.head).toBeDefined();
      expect(composed.slots.left_wing).toBeDefined();
      expect(composed.slots.right_wing).toBeDefined();
    });
  });

  describe('$use reference resolution', () => {
    it('resolves $use references from slot library', async () => {
      const library = {
        id: 'anatomy:humanoid_slots',
        slotDefinitions: {
          standard_head: {
            socket: 'neck',
            requirements: {
              partType: 'head',
              components: ['anatomy:part'],
            },
          },
          standard_arm: {
            socket: 'shoulder',
            requirements: {
              partType: 'arm',
              components: ['anatomy:part'],
            },
          },
        },
        clothingDefinitions: {
          standard_gloves: {
            blueprintSlots: ['left_hand', 'right_hand'],
            allowedLayers: ['base', 'armor'],
            defaultLayer: 'base',
            tags: ['hands', 'pair'],
          },
        },
      };

      const part = {
        id: 'anatomy:humanoid_core',
        library: 'anatomy:humanoid_slots',
        slots: {
          head: { $use: 'standard_head' },
          left_arm: { $use: 'standard_arm', socket: 'left_shoulder' },
          right_arm: { $use: 'standard_arm', socket: 'right_shoulder' },
        },
        clothingSlotMappings: {
          gloves: { $use: 'standard_gloves', tags: ['magical'] },
        },
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'anatomyBlueprintParts' &&
          id === 'anatomy:humanoid_core'
        ) {
          return part;
        }
        if (
          category === 'anatomySlotLibraries' &&
          id === 'anatomy:humanoid_slots'
        ) {
          return library;
        }
        return null;
      });

      const blueprintData = {
        id: 'anatomy:test',
        root: 'anatomy:test_torso',
        parts: ['anatomy:humanoid_core'],
      };

      const composed = await loader._composeBlueprint(
        blueprintData,
        'test',
        'test.json'
      );

      // Check head uses library definition
      expect(composed.slots.head).toEqual(
        library.slotDefinitions.standard_head
      );

      // Check arms use library definition with overrides
      expect(composed.slots.left_arm.socket).toBe('left_shoulder');
      expect(composed.slots.left_arm.requirements).toEqual(
        library.slotDefinitions.standard_arm.requirements
      );

      expect(composed.slots.right_arm.socket).toBe('right_shoulder');
      expect(composed.slots.right_arm.requirements).toEqual(
        library.slotDefinitions.standard_arm.requirements
      );

      // Check clothing uses library definition with override
      expect(composed.clothingSlotMappings.gloves.blueprintSlots).toEqual([
        'left_hand',
        'right_hand',
      ]);
      expect(composed.clothingSlotMappings.gloves.tags).toEqual(['magical']); // Override
    });

    it('throws error when $use references non-existent library definition', async () => {
      const library = {
        id: 'anatomy:empty_library',
        slotDefinitions: {},
      };

      const part = {
        id: 'anatomy:bad_part',
        library: 'anatomy:empty_library',
        slots: {
          head: { $use: 'non_existent' },
        },
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (category === 'anatomyBlueprintParts' && id === 'anatomy:bad_part') {
          return part;
        }
        if (
          category === 'anatomySlotLibraries' &&
          id === 'anatomy:empty_library'
        ) {
          return library;
        }
        return null;
      });

      const blueprintData = {
        id: 'anatomy:test',
        root: 'anatomy:test_torso',
        parts: ['anatomy:bad_part'],
      };

      await expect(
        loader._composeBlueprint(blueprintData, 'test', 'test.json')
      ).rejects.toThrow(
        "Library does not contain definition 'non_existent' in section 'slotDefinitions'"
      );
    });

    it('throws error when $use is used without library', async () => {
      const part = {
        id: 'anatomy:no_library',
        // No library field
        slots: {
          head: { $use: 'standard_head' },
        },
      };

      dataRegistry.get.mockImplementation((category, id) => {
        if (
          category === 'anatomyBlueprintParts' &&
          id === 'anatomy:no_library'
        ) {
          return part;
        }
        return null;
      });

      const blueprintData = {
        id: 'anatomy:test',
        root: 'anatomy:test_torso',
        parts: ['anatomy:no_library'],
      };

      await expect(
        loader._composeBlueprint(blueprintData, 'test', 'test.json')
      ).rejects.toThrow(
        "Slot definition uses $use but no library or library section 'slotDefinitions' available"
      );
    });
  });

  describe('Error handling', () => {
    it('throws error when referencing unknown part', async () => {
      const blueprintData = {
        id: 'anatomy:test',
        root: 'anatomy:test_torso',
        parts: ['anatomy:non_existent'],
      };

      dataRegistry.get.mockReturnValue(null);

      await expect(
        loader._composeBlueprint(blueprintData, 'test', 'test.json')
      ).rejects.toThrow(
        "Blueprint 'anatomy:test' references unknown part 'anatomy:non_existent' in test.json"
      );
    });

    it('throws error with invalid compose instruction', async () => {
      const blueprintData = {
        id: 'anatomy:test',
        root: 'anatomy:test_torso',
        compose: [
          { part: 'anatomy:some_part' }, // Missing include
        ],
      };

      await expect(
        loader._composeBlueprint(blueprintData, 'test', 'test.json')
      ).rejects.toThrow(
        "Invalid compose instruction in blueprint 'anatomy:test' from test.json"
      );
    });

    it('logs error and rethrows during finalize when composition fails', async () => {
      dataRegistry.get.mockReturnValue(null);

      loader._pendingBlueprints.set('anatomy:failing', {
        data: {
          id: 'anatomy:failing',
          root: 'anatomy:root',
          parts: ['anatomy:non_existent'],
        },
        modId: 'test',
        filename: 'failing.json',
        registryKey: 'anatomyBlueprints',
      });

      await expect(loader.finalize()).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to compose blueprint 'anatomy:failing'")
      );
    });
  });

  describe('Backwards compatibility', () => {
    it('processes traditional blueprint without composition', async () => {
      const data = {
        id: 'anatomy:traditional',
        root: 'anatomy:torso',
        slots: {
          head: { socket: 'neck', requirements: { partType: 'head' } },
        },
        attachments: [{ parent: 'torso', socket: 'neck', child: 'head' }],
      };

      const result = await loader._processFetchedItem(
        'anatomy',
        'traditional.blueprint.json',
        '/tmp/traditional.blueprint.json',
        data,
        'anatomyBlueprints'
      );

      expect(processAndStoreItem).toHaveBeenCalledWith(
        loader,
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'anatomy:traditional',
            root: 'anatomy:torso',
            slots: data.slots,
            attachments: data.attachments,
          }),
        })
      );
      expect(loader._pendingBlueprints.size).toBe(0);
    });
  });
});
