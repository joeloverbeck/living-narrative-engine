// Filename: tests/unit/loaders/modsLoader.entityMultiKey.test.js

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- The new Test Setup Factory ---
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';

// --- Type‑only JSDoc imports for Mocks and SUT ---
/** @typedef {import('../../../src/loaders/modsLoader.js').default} ModsLoader */
/** @typedef {import('../../../core/interfaces/manifestItems.js').ModManifest} ModManifest */
/** @typedef {import('../../common/loaders/modsLoader.test-setup.js').createTestEnvironment} TestEnvironment */

describe('ModsLoader Integration Test Suite - EntityDefinitionLoader Multi-Key Handling (Sub-Ticket 11)', () => {
  /** @type {TestEnvironment['modsLoader']} */
  let modsLoader;
  /** @type {TestEnvironment['mockLogger']} */
  let mockLogger;
  /** @type {TestEnvironment['mockEntityLoader']} */
  let mockEntityLoader;
  /** @type {TestEnvironment['mockComponentLoader']} */
  let mockComponentLoader;
  /** @type {TestEnvironment['mockActionLoader']} */
  let mockActionLoader;
  /** @type {TestEnvironment['mockRuleLoader']} */
  let mockRuleLoader;
  /** @type {TestEnvironment['mockEventLoader']} */
  let mockEventLoader;

  // --- Test-specific data ---
  const testModId = 'testMod';
  const worldName = 'entityTestWorld';
  /** @type {ModManifest} */
  let mockTestManifest;

  beforeEach(() => {
    // 1. Define test-specific data that mocks will use
    mockTestManifest = {
      id: testModId,
      version: '1.0.0',
      name: 'Entity Multi-Key Test Mod',
      gameVersion: '^1.0.0',
      content: {
        entityDefinitions: [
          'locations/start_area.json',
          'items/sword.json',
          'characters/guard.json',
        ],
      },
    };
    const mockManifestMap = new Map([
      [testModId.toLowerCase(), mockTestManifest],
    ]);
    const finalOrder = [testModId];

    // 2. Get the standard environment from the factory
    const env = createTestEnvironment();
    modsLoader = env.modsLoader;
    mockLogger = env.mockLogger;
    mockEntityLoader = env.mockEntityLoader;
    mockComponentLoader = env.mockComponentLoader;
    mockActionLoader = env.mockActionLoader;
    mockRuleLoader = env.mockRuleLoader;
    mockEventLoader = env.mockEventLoader;

    // 3. Layer test-specific mock implementations ON TOP of the defaults
    env.mockGameConfigLoader.loadConfig.mockResolvedValue([testModId]);
    env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      mockManifestMap
    );
    env.mockedResolveOrder.mockReturnValue(finalOrder);

    // This test specifically needs entityLoader to return a result with a count of 3
    env.mockEntityLoader.loadItemsForMod.mockResolvedValue({
      count: 3,
      overrides: 0,
      errors: 0,
    });

    // ModsLoader's internal loop needs to `get` the manifest by its ID after it has been stored.
    // We must provide an implementation for the registry's `get` method for this test.
    env.mockRegistry.get.mockImplementation((type, id) => {
      if (
        type === 'mod_manifests' &&
        id.toLowerCase() === testModId.toLowerCase()
      ) {
        return mockTestManifest;
      }
      return undefined;
    });
  });

  it('should invoke the correct loader for the "entityDefinitions" content type and aggregate its results', async () => {
    // --- Action ---
    await expect(modsLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---
    // The test logic itself does not need to change.

    // 1. Verify EntityDefinitionLoader was invoked correctly by the orchestrator.
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledTimes(1);
    expect(mockEntityLoader.loadItemsForMod).toHaveBeenCalledWith(
      testModId,
      mockTestManifest,
      'entityDefinitions', // The key from the manifest `content` object
      'entities/definitions', // The default directory for this content type
      'entityDefinitions' // The typeName for logging and aggregation
    );

    // 2. Verify other content loaders were NOT called.
    expect(mockComponentLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockActionLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockRuleLoader.loadItemsForMod).not.toHaveBeenCalled();
    expect(mockEventLoader.loadItemsForMod).not.toHaveBeenCalled();

    // 3. Verify the results from the loader were correctly aggregated and logged.
    const infoCalls = mockLogger.info.mock.calls;
    const summaryText = infoCalls.map((call) => call[0]).join('\n');

    expect(summaryText).toContain('Content Loading Summary (Totals):');
    expect(summaryText).toMatch(/entityDefinitions\s+: C:3, O:0, E:0/);
    expect(summaryText).toMatch(/TOTAL\s+: C:3, O:0, E:0/);
  });
});
