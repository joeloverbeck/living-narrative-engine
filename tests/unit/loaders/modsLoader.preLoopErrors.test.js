// tests/unit/loaders/modsLoader.preLoopErrors.test.js

import { beforeEach, describe, expect, it } from '@jest/globals';

// --- The new Test Setup Factory ---
import { createTestEnvironment } from '../../common/loaders/modsLoader.test-setup.js';
import { setupManifests } from '../../common/loaders/modsLoader.test-utils.js';

// --- SUT Dependencies & Errors ---
import ModDependencyError from '../../../src/errors/modDependencyError.js';
import ModsLoaderError from '../../../src/errors/modsLoaderError.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';

// --- Type‑only JSDoc imports for Mocks ---
/** @typedef {import('../../common/loaders/modsLoader.test-setup.js').TestEnvironment} TestEnvironment */
/** @typedef {import('../../../src/interfaces/manifestItems.js').ModManifest} ModManifest */

describe('ModsLoader Integration Test Suite - Pre-Loop Error Handling (Refactored)', () => {
  /** @type {TestEnvironment} */
  let env;

  // --- Mock Data ---
  /** @type {ModManifest} */
  let coreManifest;
  /** @type {ModManifest} */
  let modAManifest;
  /** @type {ModManifest} */
  let modBManifest;
  const modAId = 'modA';
  const modBId = 'modB';
  const worldName = 'testWorldPreLoopError';

  beforeEach(() => {
    // 1. Get the standard environment from the factory
    env = createTestEnvironment();

    // 2. Define Base Mock Data
    coreManifest = {
      id: CORE_MOD_ID,
      version: '1.0.0',
      name: 'Core',
      gameVersion: '1.0.0',
      content: {},
    };
    modAManifest = {
      id: modAId,
      version: '1.0.0',
      name: 'Mod A',
      gameVersion: '1.0.0',
      content: {},
    };
    modBManifest = {
      id: modBId,
      version: '1.0.0',
      name: 'Mod B',
      gameVersion: '1.0.0',
      content: {},
    };

    // 3. Configure a default success path that tests can override
    const defaultMap = new Map([[CORE_MOD_ID.toLowerCase(), coreManifest]]);
    setupManifests(env, defaultMap, [CORE_MOD_ID]);
    env.mockedResolveOrder.mockImplementation((ids) => ids); // Default to pass-through
  });

  it('should throw ModsLoaderError if a mod manifest fails schema validation (simulated)', async () => {
    // Arrange: Configure the manifest loader to reject
    const simulatedError = new Error(
      'Simulated manifest schema validation failure'
    );
    env.mockModManifestLoader.loadRequestedManifests.mockRejectedValue(
      simulatedError
    );
    env.mockGameConfigLoader.loadConfig.mockResolvedValue([modAId]);

    // *** FIX IS HERE ***
    // The test was calling loadWorld twice. It should only be called once inside a try/catch.
    let caughtError;
    try {
      await env.modsLoader.loadWorld(worldName);
    } catch (e) {
      caughtError = e;
    }

    // Assert
    expect(caughtError).toBeInstanceOf(ModsLoaderError);
    expect(caughtError.message).toContain('ModsLoader: CRITICAL load failure due to an unexpected error.');
    expect(caughtError.message).toContain(simulatedError.message);
    expect(caughtError.code).toBe('unknown_loader_error');
    expect(caughtError.cause).toBe(simulatedError);

    // Verify side effects
    expect(env.mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch
    expect(env.mockLogger.error).toHaveBeenCalledTimes(1); // Only ModsLoader logs this specific error path

    // Log from ModsLoader's final 'else' catch block for unexpected errors
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      `ModsLoader: CRITICAL load failure due to an unexpected error. Original error: ${simulatedError.message}`,
      simulatedError // The original error object is passed as the second arg to the logger
    );
  });

  it('should throw ModDependencyError if a dependency cycle is detected', async () => {
    // Arrange: Setup manifests with a dependency cycle
    modAManifest.dependencies = { [modBId]: '^1.0.0' };
    modBManifest.dependencies = { [modAId]: '^1.0.0' };

    const requestedIds = [modAId, modBId];
    const cycleManifestMap = new Map([
      [modAId.toLowerCase(), modAManifest],
      [modBId.toLowerCase(), modBManifest],
    ]);

    // Correctly mock gameConfigLoader to return the expected object structure
    env.mockGameConfigLoader.loadConfig.mockResolvedValue({ mods: requestedIds, world: worldName });
    env.mockModManifestLoader.loadRequestedManifests.mockResolvedValue(
      cycleManifestMap
    );

    // Arrange: Configure the load order resolver to throw the cycle error
    const cycleErrorMessage = `DEPENDENCY_CYCLE: Cyclic dependency detected among mods: ${modAId}, ${modBId}`;
    const expectedError = new ModDependencyError(cycleErrorMessage);
    env.mockedResolveOrder.mockImplementation(() => {
      throw expectedError;
    });

    // *** FIX IS HERE ***
    // The test was calling loadWorld twice. It should only be called once inside a try/catch.
    let caughtError;
    try {
      await env.modsLoader.loadWorld(worldName);
    } catch (e) {
      caughtError = e;
    }

    // Assert
    expect(caughtError).toBeInstanceOf(ModDependencyError);
    expect(caughtError.message).toContain('Cyclic dependency detected');

    // Verify side effects
    expect(env.mockRegistry.clear).toHaveBeenCalledTimes(2); // Start + Catch
    expect(env.mockLogger.error).toHaveBeenCalledTimes(1); // ModsLoader logs once for this specific error path

    // Log from ModsLoader's catch block for ModDependencyError
    // Assert that the logger was called with the correct message and a metadata object
    // containing the full error instance.
    expect(env.mockLogger.error).toHaveBeenCalledWith(
      `ModsLoader: CRITICAL load failure due to mod dependencies. Error: ${caughtError.message}`,
      { error: caughtError }
    );

    expect(env.mockedResolveOrder).toHaveBeenCalledWith(
      requestedIds,
      cycleManifestMap
    );
  });
});