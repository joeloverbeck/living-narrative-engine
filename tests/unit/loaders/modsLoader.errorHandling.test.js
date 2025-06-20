// Filename: tests/unit/loaders/modsLoader.errorHandling.test.js
// NOTE: This file is now corrected.

import { beforeEach, describe, expect, it } from '@jest/globals';

// --- SUT & Dependencies ---
import { CORE_MOD_ID } from '../../../src/constants/core.js';
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';

// --- Type‑only JSDoc imports ---
/** @typedef {import('../../../src/loaders/modsLoader.js').default} ModsLoader */
/** @typedef {import('../../../interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../common/loaders/modsLoader.test-setup.js').createTestEnvironment} TestEnvironment */

describe('ModsLoader Integration Test Suite - Error Handling (TEST-LOADER-7.4)', () => {
  /** @type {TestEnvironment} */
  let env;

  // --- Test-specific data ---
  const badModId = 'badMod';
  const worldName = 'testWorldContentError';
  const simulatedErrorMessage = 'Simulated validation/parsing failure';
  /** @type {ModManifest} */
  let mockCoreManifest;
  /** @type {ModManifest} */
  let mockBadModManifest;

  beforeEach(() => {
    // 1. Define test-specific data (manifests, etc.)
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '^1.0.0',
      content: { actions: ['core_action.json'] },
    };
    mockBadModManifest = {
      id: badModId,
      version: '1.0.0',
      name: 'Bad Mod',
      gameVersion: '^1.0.0',
      content: { components: ['bad_comp.json'], rules: ['good_rule.json'] },
    };
    const mockManifestMap = new Map([
      [CORE_MOD_ID.toLowerCase(), mockCoreManifest],
      [badModId.toLowerCase(), mockBadModManifest],
    ]);

    // 2. Get the standard environment from the factory
    env = createTestEnvironment();

    // 3. Layer test-specific mock implementations ON TOP of the defaults
    env.mockGameConfigLoader.loadConfig.mockResolvedValue([
      CORE_MOD_ID,
      badModId,
    ]);
    env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      mockManifestMap
    );
    env.mockedResolveOrder.mockReturnValue([CORE_MOD_ID, badModId]);

    // *** THE FIX IS HERE ***
    // This mock now correctly handles case-sensitivity.
    env.mockRegistry.get.mockImplementation((type, id) => {
      // Manifest lookups are case-insensitive (lowercase)
      if (type === 'mod_manifests') {
        const lcId = id.toLowerCase();
        if (lcId === CORE_MOD_ID) return mockCoreManifest;
        if (lcId === badModId.toLowerCase()) return mockBadModManifest;
      }
      // All other lookups should use the original, case-sensitive ID.
      return env.mockRegistry._internalStore[type]?.[id];
    });

    // --- Configure Content Loader Mocks for this test's specific behaviors ---
    env.mockActionLoader.loadItemsForMod.mockImplementation(
      async (modIdArg) => {
        if (modIdArg === CORE_MOD_ID) {
          const itemId = `${CORE_MOD_ID}:action1`;
          env.mockRegistry.store('actions', itemId, {
            id: itemId,
            value: 'core_action_data',
          });
          return { count: 1, overrides: 0, errors: 0 };
        }
        return { count: 0, overrides: 0, errors: 0 };
      }
    );

    env.mockComponentLoader.loadItemsForMod.mockImplementation(
      async (modIdArg) => {
        if (modIdArg === badModId) {
          throw new Error(simulatedErrorMessage);
        }
        return { count: 0, overrides: 0, errors: 0 };
      }
    );

    env.mockRuleLoader.loadItemsForMod.mockImplementation(async (modIdArg) => {
      if (modIdArg === badModId) {
        const itemId = `${badModId}:rule1`;
        env.mockRegistry.store('rules', itemId, {
          id: itemId,
          value: 'badMod_rule_data',
        });
        return { count: 1, overrides: 0, errors: 0 };
      }
      return { count: 0, overrides: 0, errors: 0 };
    });
  });

  it('should log an error and continue loading other content when a content loader fails', async () => {
    // --- Action ---
    await expect(env.modsLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---
    // The assertions in the test case are now correct and do not need to change.
    expect(env.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`Error loading content type 'components'`),
      expect.objectContaining({ modId: badModId, typeName: 'components' }),
      expect.any(Error)
    );

    expect(env.mockValidatedEventDispatcher.dispatch).toHaveBeenCalledWith(
      'initialization:world_loader:content_load_failed',
      expect.objectContaining({
        modId: badModId,
        typeName: 'components',
        error: simulatedErrorMessage,
      }),
      expect.any(Object)
    );

    expect(env.mockActionLoader.loadItemsForMod).toHaveBeenCalledWith(
      CORE_MOD_ID,
      mockCoreManifest,
      'actions',
      'actions',
      'actions'
    );
    expect(env.mockRuleLoader.loadItemsForMod).toHaveBeenCalledWith(
      badModId,
      mockBadModManifest,
      'rules',
      'rules',
      'rules'
    );

    // These assertions will now pass
    expect(
      env.mockRegistry.get('actions', `${CORE_MOD_ID}:action1`)
    ).toBeDefined();
    expect(env.mockRegistry.get('rules', `${badModId}:rule1`)).toBeDefined();
    expect(env.mockRegistry.getAll('components')).toHaveLength(0);

    const summaryText = env.mockLogger.info.mock.calls
      .map((c) => c[0])
      .join('\n');
    expect(summaryText).toMatch(/actions\s+: C:1, O:0, E:0/);
    expect(summaryText).toMatch(/components\s+: C:0, O:0, E:1/);
    expect(summaryText).toMatch(/rules\s+: C:1, O:0, E:0/);
    expect(summaryText).toMatch(/TOTAL\s+: C:2, O:0, E:1/);

    expect(env.mockRegistry.clear).toHaveBeenCalledTimes(1);
  });
});
