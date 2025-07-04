// tests/unit/loaders/modManifestProcessor.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import ModManifestProcessor from '../../../src/loaders/ModManifestProcessor.js';
import ModDependencyError from '../../../src/errors/modDependencyError.js';

class DummyManifestLoader {
  constructor(map) {
    this.map = map;
    this.loadRequestedManifests = jest.fn(async () => this.map);
  }
}

describe('ModManifestProcessor.processManifests', () => {
  /** @type {DummyManifestLoader} */
  let manifestLoader;
  /** @type {jest.Mocked<any>} */
  let logger;
  /** @type {jest.Mocked<any>} */
  let registry;
  /** @type {jest.Mocked<any>} */
  let dispatcher;
  /** @type {jest.Mocked<any>} */
  let modDependencyValidator;
  /** @type {jest.Mock} */
  let modVersionValidator;
  /** @type {jest.Mocked<any>} */
  let modLoadOrderResolver;
  /** @type {ModManifestProcessor} */
  let processor;
  /** @type {Map<string, any>} */
  let manifestMap;
  const worldName = 'test-world'; // Define a world name for the tests

  beforeEach(() => {
    manifestMap = new Map([
      ['modA', { id: 'modA', version: '1.0.0' }],
      ['modB', { id: 'modB', version: '1.0.0' }],
    ]);
    manifestLoader = new DummyManifestLoader(manifestMap);
    logger = { debug: jest.fn(), warn: jest.fn() };
    registry = { store: jest.fn() };
    dispatcher = { dispatch: jest.fn() };
    modDependencyValidator = { validate: jest.fn() };
    modVersionValidator = jest.fn();
    modLoadOrderResolver = { resolve: jest.fn(() => ['modA', 'modB']) };
    processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger,
      registry,
      validatedEventDispatcher: dispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
    });
  });

  it('processes manifests successfully', async () => {
    const requestedIds = ['modA', 'modB'];
    const result = await processor.processManifests(requestedIds, worldName);

    expect(manifestLoader.loadRequestedManifests).toHaveBeenCalledWith(
      requestedIds,
      worldName
    );
    expect(modDependencyValidator.validate).toHaveBeenCalledWith(
      expect.any(Map),
      logger
    );
    expect(modVersionValidator).toHaveBeenCalledWith(
      expect.any(Map),
      logger,
      dispatcher
    );
    expect(modLoadOrderResolver.resolve).toHaveBeenCalledWith(
      ['modA', 'modB'],
      expect.any(Map)
    );
    expect(registry.store).toHaveBeenCalledWith(
      'mod_manifests',
      'moda',
      manifestMap.get('modA')
    );
    expect(registry.store).toHaveBeenCalledWith(
      'mod_manifests',
      'modb',
      manifestMap.get('modB')
    );
    expect(registry.store).toHaveBeenCalledWith('meta', 'final_mod_order', [
      'modA',
      'modB',
    ]);
    expect(result.finalModOrder).toEqual(['modA', 'modB']);
    expect(result.loadedManifestsMap.size).toBe(2);
    expect(result.incompatibilityCount).toBe(0);
  });

  it('throws and logs when version validation fails', async () => {
    const error = new ModDependencyError(
      'modA incompatible\nmodB incompatible'
    );
    modVersionValidator.mockImplementation(() => {
      throw error;
    });

    await expect(
      processor.processManifests(['modA', 'modB'], worldName)
    ).rejects.toBe(error);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Encountered 1 engine version incompatibilities'),
      error
    );
    // In the new implementation, version validation happens before order resolution
    expect(modLoadOrderResolver.resolve).not.toHaveBeenCalled();
    expect(registry.store).not.toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      expect.anything()
    );
  });

  it('works with static-only validator class (regression for DI bug)', async () => {
    // Create a static-only validator class
    class StaticValidator {
      static validate(manifests, loggerArg) {
        loggerArg.debug('StaticValidator.validate called');
      }
    }
    processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger,
      registry,
      validatedEventDispatcher: dispatcher,
      modDependencyValidator: StaticValidator, // Pass the class itself
      modVersionValidator,
      modLoadOrderResolver,
    });
    const requestedIds = ['modA', 'modB'];
    const result = await processor.processManifests(requestedIds, worldName);
    expect(result.finalModOrder).toEqual(['modA', 'modB']);
    expect(logger.debug).toHaveBeenCalledWith(
      'StaticValidator.validate called'
    );
  });

  it('propagates generic errors from version validator without warnings', async () => {
    const error = new Error('boom');
    modVersionValidator.mockImplementation(() => {
      throw error;
    });

    await expect(processor.processManifests(['modA'], worldName)).rejects.toBe(
      error
    );

    expect(logger.warn).not.toHaveBeenCalled();
    expect(registry.store).not.toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      expect.anything()
    );
  });

  it('loads dependency manifests recursively', async () => {
    // Set up modA with a dependency on modC
    manifestMap = new Map([
      [
        'moda',
        {
          id: 'modA',
          version: '1.0.0',
          dependencies: [{ id: 'modC', version: '^1.0.0' }],
        },
      ],
    ]);
    const secondMap = new Map([['modc', { id: 'modC', version: '1.0.0' }]]);

    manifestLoader = new DummyManifestLoader(manifestMap);
    modLoadOrderResolver.resolve.mockReturnValue(['modC', 'modA']);

    processor = new ModManifestProcessor({
      modManifestLoader: manifestLoader,
      logger,
      registry,
      validatedEventDispatcher: dispatcher,
      modDependencyValidator,
      modVersionValidator,
      modLoadOrderResolver,
    });

    // First call returns modA, second call returns modC
    manifestLoader.loadRequestedManifests
      .mockImplementationOnce(async () => manifestMap)
      .mockImplementationOnce(async () => secondMap);

    const result = await processor.processManifests(['modA'], worldName);

    // Should load modA first, then discover and load its dependency modC
    expect(manifestLoader.loadRequestedManifests).toHaveBeenCalledTimes(2);
    expect(manifestLoader.loadRequestedManifests).toHaveBeenNthCalledWith(
      1,
      ['modA'],
      worldName
    );
    expect(manifestLoader.loadRequestedManifests).toHaveBeenNthCalledWith(
      2,
      ['modC'],
      worldName
    );

    expect(registry.store).toHaveBeenCalledWith('mod_manifests', 'modc', {
      id: 'modC',
      version: '1.0.0',
    });
    expect(result.finalModOrder).toEqual(['modC', 'modA']);
    expect(result.loadedManifestsMap.size).toBe(2);
  });
});
