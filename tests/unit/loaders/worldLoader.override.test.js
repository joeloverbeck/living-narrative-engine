import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- The new Test Setup Factory ---
import { createTestEnvironment } from '../../common/loaders/worldLoader.test-setup.js';

// --- SUT Dependencies ---
import { CORE_MOD_ID } from '../../../src/constants/core';

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../common/loaders/worldLoader.test-setup.js').TestEnvironment} TestEnvironment */
/** @typedef {import('../../../src/interfaces/manifestItems.js').ModManifest} ModManifest */

describe('WorldLoader Integration Test Suite - Overrides (Refactored)', () => {
  /** @type {TestEnvironment} */
  let env;

  // --- Mock Data ---
  /** @type {ModManifest} */
  let mockCoreManifest;
  /** @type {ModManifest} */
  let mockOverrideManifest;
  const overrideModId = 'overrideMod';
  const worldName = 'testWorldWithOverrides';

  beforeEach(() => {
    // 1. Get the standard environment from the factory
    env = createTestEnvironment();

    // 2. Define Mock Data for this suite
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core Systems',
      gameVersion: '^1.0.0',
      content: {
        actions: ['core/action1.json'],
      },
    };
    mockOverrideManifest = {
      id: overrideModId,
      version: '1.0.0',
      name: 'Override Mod',
      gameVersion: '^1.0.0',
      dependencies: { [CORE_MOD_ID]: '^1.0.0' },
      content: {
        actions: ['core/action1.json', 'override/action2.json'],
        components: ['override/component1.json'],
      },
    };
    const mockManifestMap = new Map([
      [CORE_MOD_ID.toLowerCase(), mockCoreManifest],
      [overrideModId.toLowerCase(), mockOverrideManifest],
    ]);
    const finalOrder = [CORE_MOD_ID, overrideModId];

    // 3. Configure Mocks for this specific test's behavior
    env.mockGameConfigLoader.loadConfig.mockResolvedValue(finalOrder);
    env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
    env.mockedResolveOrder.mockReturnValue(finalOrder);

    // The factory provides a stateful registry, so we just need to set up the .get for manifests
    env.mockRegistry.get.mockImplementation((type, id) => {
      const lcId = id.toLowerCase();
      if (type === 'mod_manifests') {
        if (lcId === CORE_MOD_ID) return mockCoreManifest;
        if (lcId === overrideModId) return mockOverrideManifest;
      }
      // Fallback to the stateful registry's internal getter for other data types
      return env.mockRegistry._internalStore[type]?.[id];
    });

    // Configure ActionLoader to simulate storing/overriding
    env.mockActionLoader.loadItemsForMod.mockImplementation(async (modIdArg) => {
      let count = 0;
      let overrides = 0;
      if (modIdArg === CORE_MOD_ID) {
        env.mockRegistry.store('actions', `${CORE_MOD_ID}:action1`, { value: 'core_value' });
        count = 1;
      } else if (modIdArg === overrideModId) {
        // This simulates overriding the core action
        if (env.mockRegistry.get('actions', `${CORE_MOD_ID}:action1`)) {
          overrides = 1;
        }
        env.mockRegistry.store('actions', `${CORE_MOD_ID}:action1`, { value: 'override_value' });
        // This simulates adding a new action
        env.mockRegistry.store('actions', `${overrideModId}:action2`, { value: 'new_value' });
        count = 2; // two files processed
      }
      return { count, overrides, errors: 0 };
    });

    // Configure ComponentLoader
    env.mockComponentLoader.loadItemsForMod.mockImplementation(async (modIdArg) => {
      if (modIdArg === overrideModId) {
        env.mockRegistry.store('components', `${overrideModId}:component1`, { value: 'comp_value' });
        return { count: 1, overrides: 0, errors: 0 };
      }
      return { count: 0, overrides: 0, errors: 0 };
    });
  });

  it('should load core and override mod, applying overrides correctly', async () => {
    // --- Action ---
    await expect(env.worldLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assert Loader Calls ---
    expect(env.mockActionLoader.loadItemsForMod).toHaveBeenCalledTimes(2);
    expect(env.mockComponentLoader.loadItemsForMod).toHaveBeenCalledTimes(1); // Only for overrideMod
    expect(env.mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(env.mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();

    // --- Assert Registry State ---
    const overriddenAction = env.mockRegistry.get('actions', 'core:action1');
    expect(overriddenAction).toEqual({ value: 'override_value' });

    const newAction = env.mockRegistry.get('actions', 'overrideMod:action2');
    expect(newAction).toEqual({ value: 'new_value' });

    const newComponent = env.mockRegistry.get('components', 'overrideMod:component1');
    expect(newComponent).toEqual({ value: 'comp_value' });

    // --- Assert Summary Logging ---
    const summaryText = env.mockLogger.info.mock.calls.map((c) => c[0]).join('\n');
    expect(summaryText).toMatch(/actions\s+: C:3, O:1, E:0/);    // 1 from core + 2 from override = 3 created/processed
    expect(summaryText).toMatch(/components\s+: C:1, O:0, E:0/); // 1 from override
    expect(summaryText).toMatch(/TOTAL\s+: C:4, O:1, E:0/);      // 3+1=4 total created/processed
  });
});
