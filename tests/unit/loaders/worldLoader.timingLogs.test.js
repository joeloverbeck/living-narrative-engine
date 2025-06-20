// Filename: src/tests/loaders/worldLoader.timingLogs.test.js
// Sub-Ticket 9: Test - Verify Performance Timing Logs

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- The new Test Setup Factory ---
import { createTestEnvironment } from '../../common/loaders/worldLoader.test-setup.js';

// --- SUT Dependencies ---
import { CORE_MOD_ID } from '../../../src/constants/core';

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../common/loaders/worldLoader.test-setup.js').TestEnvironment} TestEnvironment */
/** @typedef {import('../../../src/interfaces/manifestItems.js').ModManifest} ModManifest */

describe('WorldLoader Integration Test Suite - Performance Timing Logs (Refactored)', () => {
  /** @type {TestEnvironment} */
  let env;

  // --- Mock Data ---
  /** @type {ModManifest} */
  let mockCoreManifest;
  /** @type {ModManifest} */
  let mockFooManifest;
  const fooModId = 'foo';
  const worldName = 'timingTestWorld';

  beforeEach(() => {
    // 1. Get the standard environment from the factory
    env = createTestEnvironment();

    // 2. Define Mock Data
    mockCoreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '^1.0.0',
      content: { components: ['core_comp.json'] },
    };
    mockFooManifest = {
      id: fooModId,
      version: '1.0.0',
      name: 'Foo Mod',
      gameVersion: '^1.0.0',
      content: { entityDefinitions: ['items/foo_item.json'] },
    };
    const mockManifestMap = new Map([
      [CORE_MOD_ID.toLowerCase(), mockCoreManifest],
      [fooModId.toLowerCase(), mockFooManifest],
    ]);
    const finalOrder = [CORE_MOD_ID, fooModId];

    // 3. Configure Mocks
    env.mockGameConfigLoader.loadConfig.mockResolvedValue(finalOrder);
    env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(mockManifestMap);
    env.mockedResolveOrder.mockReturnValue(finalOrder);

    // The factory sets up loaders to return a default success result, which is sufficient here.
    // Configure registry.get to return the correct manifest during the load loop.
    env.mockRegistry.get.mockImplementation((type, id) => {
      if (type === 'mod_manifests') {
        const lcId = id.toLowerCase();
        if (lcId === CORE_MOD_ID) return mockCoreManifest;
        if (lcId === fooModId) return mockFooManifest;
      }
      return undefined;
    });
  });

  it('should log per-mod performance timing information at DEBUG level', async () => {
    // --- Action ---
    await expect(env.worldLoader.loadWorld(worldName)).resolves.not.toThrow();

    // --- Assertions ---
    const debugCalls = env.mockLogger.debug.mock.calls;
    const finalOrder = [CORE_MOD_ID, fooModId];

    // Verify a timing log was created for each mod
    for (const modId of finalOrder) {
      const expectedLogRegex = new RegExp(`^Mod '${modId}' loaded in (\\d+\\.\\d{2})ms`);
      const timingLogCall = debugCalls.find((call) => expectedLogRegex.test(call[0]));

      expect(timingLogCall).toBeDefined(); // Ensure the log exists

      // Extract and validate the duration from the log message
      if (timingLogCall) {
        const match = timingLogCall[0].match(expectedLogRegex);
        const durationMs = parseFloat(match[1]);
        expect(durationMs).toBeGreaterThanOrEqual(0);
      }
    }

    // Sanity check that the main summary log still appears
    const summaryLogExists = env.mockLogger.info.mock.calls.some((call) =>
      call[0].includes(`WorldLoader Load Summary (World: '${worldName}')`)
    );
    expect(summaryLogExists).toBe(true);
  });
});