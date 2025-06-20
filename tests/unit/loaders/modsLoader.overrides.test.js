import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- The new Test Setup Factory ---
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';

// --- SUT Dependencies ---
import { CORE_MOD_ID } from '../../../src/constants/core.js';

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../common/loaders/modsLoader.test-setup.js').TestEnvironment} TestEnvironment */
/** @typedef {import('../../../src/interfaces/manifestItems.js').ModManifest} ModManifest */

describe('ModsLoader Integration Test Suite - Mod Overrides and Load Order (Refactored)', () => {
  /** @type {TestEnvironment} */
  let env;

  // --- Mock Data ---
  /** @type {ModManifest} */
  let mockCoreManifest;
  /** @type {ModManifest} */
  let mockFooManifest;
  /** @type {ModManifest} */
  let mockBarManifest;
  const fooModId = 'foo';
  const barModId = 'bar';
  const worldName = 'overrideTestWorld';
  const baseItemId = 'potion'; // The base ID used in the JSON files

  beforeEach(() => {
    // 1. Get the standard environment from the factory
    env = createTestEnvironment();

    // 2. Define Mock Data
    const itemFilename = 'items/potion.json';
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '^1.0.0',
      content: { entityDefinitions: [itemFilename] },
    };
    mockFooManifest = {
      id: fooModId,
      version: '1.0.0',
      name: 'Foo Mod',
      gameVersion: '^1.0.0',
      content: { entityDefinitions: [itemFilename] },
    };
    mockBarManifest = {
      id: barModId,
      version: '1.0.0',
      name: 'Bar Mod',
      gameVersion: '^1.0.0',
      content: { entityDefinitions: [itemFilename] },
    };
    const mockManifestMap = new Map([
      [CORE_MOD_ID.toLowerCase(), mockCoreManifest],
      [fooModId.toLowerCase(), mockFooManifest],
      [barModId.toLowerCase(), mockBarManifest],
    ]);
    const finalOrder = [CORE_MOD_ID, fooModId, barModId];

    // 3. Configure Mocks
    env.mockGameConfigLoader.loadConfig.mockResolvedValue(finalOrder);
    env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
    env.mockedResolveOrder.mockReturnValue(finalOrder);

    // Configure registry to return manifests and fallback to stateful store for other data
    env.mockRegistry.get.mockImplementation((type, id) => {
      const lcId = id.toLowerCase();
      if (type === 'mod_manifests') {
        if (lcId === CORE_MOD_ID) return mockCoreManifest;
        if (lcId === fooModId) return mockFooManifest;
        if (lcId === barModId) return mockBarManifest;
      }
      return env.mockRegistry._internalStore[type]?.[id];
    });

    // Configure EntityLoader to simulate storing items from each mod
    env.mockEntityLoader.loadItemsForMod.mockImplementation(
      async (modIdArg, manifestArg, contentKeyArg, contentTypeDirArg, typeNameArg) => {
        if (typeNameArg !== 'entityDefinitions') {
          return { count: 0, overrides: 0, errors: 0 };
        }

        const data = {
          [CORE_MOD_ID]: { value: 10, description: 'Core potion' },
          [fooModId]: { value: 20, description: 'Foo potion' },
          [barModId]: { value: 30, description: 'Bar potion' },
        };
        const itemData = data[modIdArg];

        if (itemData) {
          const finalId = `${modIdArg}:${baseItemId}`;
          env.mockRegistry.store('entity_definitions', finalId, { id: finalId, ...itemData });
          return { count: 1, overrides: 0, errors: 0 };
        }
        return { count: 0, overrides: 0, errors: 0 };
      }
    );
  });

  it('should load content respecting finalOrder and store all mod versions correctly', async () => {
    // --- Action ---
    await expect(env.modsLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---

    // 1. Verify loader was called sequentially for each mod in the correct order
    expect(env.mockEntityLoader.loadItemsForMod).toHaveBeenCalledTimes(3);
    expect(env.mockEntityLoader.loadItemsForMod).toHaveBeenNthCalledWith(1, CORE_MOD_ID, expect.anything(), 'entityDefinitions', 'entities/definitions', 'entityDefinitions');
    expect(env.mockEntityLoader.loadItemsForMod).toHaveBeenNthCalledWith(2, fooModId, expect.anything(), 'entityDefinitions', 'entities/definitions', 'entityDefinitions');
    expect(env.mockEntityLoader.loadItemsForMod).toHaveBeenNthCalledWith(3, barModId, expect.anything(), 'entityDefinitions', 'entities/definitions', 'entityDefinitions');

    // 2. Verify Final Registry State for each mod's version of the item
    const corePotion = env.mockRegistry.get('entity_definitions', `${CORE_MOD_ID}:${baseItemId}`);
    expect(corePotion).toEqual({ id: `${CORE_MOD_ID}:${baseItemId}`, value: 10, description: 'Core potion' });

    const fooPotion = env.mockRegistry.get('entity_definitions', `${fooModId}:${baseItemId}`);
    expect(fooPotion).toEqual({ id: `${fooModId}:${baseItemId}`, value: 20, description: 'Foo potion' });

    const barPotion = env.mockRegistry.get('entity_definitions', `${barModId}:${baseItemId}`);
    expect(barPotion).toEqual({ id: `${barModId}:${baseItemId}`, value: 30, description: 'Bar potion' });

    // 3. Verify Summary Log
    const summaryText = env.mockLogger.info.mock.calls.map((c) => c[0]).join('\n');
    expect(summaryText).toMatch(/entityDefinitions\s+: C:3, O:0, E:0/);
    expect(summaryText).toMatch(/TOTAL\s+: C:3, O:0, E:0/);
  });
});
