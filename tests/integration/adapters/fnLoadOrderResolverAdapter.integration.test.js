import { describe, it, expect, jest } from '@jest/globals';
import FnLoadOrderResolverAdapter from '../../../src/adapters/fnLoadOrderResolverAdapter.js';
import ModManifestProcessor from '../../../src/loaders/ModManifestProcessor.js';

/**
 * Creates a lightweight logger that captures debug and info output while
 * providing no-op warn/error handlers. The ModManifestProcessor expects a
 * logger with these methods and uses them as part of its diagnostic output.
 */
function createLogger() {
  const messages = {
    debug: [],
    info: [],
    warn: [],
    error: [],
  };

  const logger = {
    debug: (msg, ...rest) => messages.debug.push([msg, ...rest]),
    info: (msg, ...rest) => messages.info.push([msg, ...rest]),
    warn: (msg, ...rest) => messages.warn.push([msg, ...rest]),
    error: (msg, ...rest) => messages.error.push([msg, ...rest]),
  };

  return { logger, messages };
}

/**
 * Creates a minimal registry that records every value stored by the manifest
 * processor. This lets the integration test assert that the adapter-provided
 * load order is propagated through the registry the same way it would be in
 * the production system.
 */
function createRegistry() {
  const records = [];
  return {
    store(namespace, key, value) {
      records.push({ namespace, key, value });
    },
    getRecords() {
      return records;
    },
  };
}

describe('FnLoadOrderResolverAdapter integration', () => {
  it('adapts a load order function for ModManifestProcessor', async () => {
    const manifestData = {
      'core-mod': {
        id: 'core-mod',
        name: 'Core Module',
        dependencies: [],
      },
      'expansion-mod': {
        id: 'expansion-mod',
        name: 'Expansion Module',
        dependencies: [{ id: 'core-mod' }],
      },
    };

    const loadRequestedManifests = jest.fn(async (ids) => {
      const map = new Map();
      for (const id of ids) {
        const lower = id.toLowerCase();
        const manifest = manifestData[lower];
        if (!manifest) {
          throw new Error(`Unknown manifest requested for ${id}`);
        }
        map.set(lower, manifest);
      }
      return map;
    });

    const modManifestLoader = {
      loadRequestedManifests,
      async getLoadedManifests() {
        return null;
      },
    };

    const { logger, messages } = createLogger();
    const registry = createRegistry();

    const dependencyValidator = {
      validate: jest.fn(),
    };

    const versionValidator = jest.fn();
    const validatedEventDispatcher = { dispatch: jest.fn() };

    const loadOrderFn = jest.fn((requestedIds, manifestsMap) => {
      // Ensure the function receives the raw inputs from the processor.
      expect(requestedIds).toEqual(['expansion-mod']);
      expect(Array.from(manifestsMap.keys())).toEqual([
        'expansion-mod',
        'core-mod',
      ]);

      // Return a custom order that prioritises the dependency first.
      return ['core-mod', 'expansion-mod'];
    });

    const adapter = new FnLoadOrderResolverAdapter(loadOrderFn);

    const processor = new ModManifestProcessor({
      modManifestLoader,
      logger,
      registry,
      validatedEventDispatcher,
      modDependencyValidator: dependencyValidator,
      modVersionValidator: versionValidator,
      modLoadOrderResolver: adapter,
    });

    const result = await processor.processManifests(
      ['expansion-mod'],
      'demo-world'
    );

    expect(result.finalModOrder).toEqual(['core-mod', 'expansion-mod']);
    expect(result.incompatibilityCount).toBe(0);
    expect(loadOrderFn).toHaveBeenCalledTimes(1);

    const manifestsMap = loadOrderFn.mock.calls[0][1];
    expect(manifestsMap.get('core-mod')).toEqual(manifestData['core-mod']);
    expect(manifestsMap.get('expansion-mod')).toEqual(
      manifestData['expansion-mod']
    );

    // Dependency validation should see both manifests.
    expect(dependencyValidator.validate).toHaveBeenCalledWith(
      manifestsMap,
      logger
    );

    // Version validator is invoked with the same data.
    expect(versionValidator).toHaveBeenCalledWith(
      manifestsMap,
      logger,
      validatedEventDispatcher
    );

    // The registry should capture each stored manifest and the final order.
    const stored = registry.getRecords();
    expect(stored).toEqual(
      expect.arrayContaining([
        {
          namespace: 'mod_manifests',
          key: 'core-mod',
          value: manifestData['core-mod'],
        },
        {
          namespace: 'mod_manifests',
          key: 'expansion-mod',
          value: manifestData['expansion-mod'],
        },
        {
          namespace: 'meta',
          key: 'final_mod_order',
          value: ['core-mod', 'expansion-mod'],
        },
      ])
    );

    // Ensure diagnostic logging captured the pipeline flow without errors.
    expect(messages.error).toHaveLength(0);
    expect(
      messages.debug.some(([msg]) => msg.includes('Final mod order'))
    ).toBe(true);
  });

  it('throws when constructed without a function', () => {
    expect(() => new FnLoadOrderResolverAdapter(null)).toThrow(
      'FnLoadOrderResolverAdapter requires a function.'
    );
    expect(() => new FnLoadOrderResolverAdapter(42)).toThrow(
      'FnLoadOrderResolverAdapter requires a function.'
    );
  });
});
