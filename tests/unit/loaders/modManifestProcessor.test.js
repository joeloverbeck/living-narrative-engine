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
    modLoadOrderResolver = { resolveOrder: jest.fn(() => ['modA', 'modB']) };
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
    expect(modLoadOrderResolver.resolveOrder).toHaveBeenCalledWith(
      ['modA', 'modB'],
      expect.any(Map),
      logger
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
    expect(result.finalOrder).toEqual(['modA', 'modB']);
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

    await expect(processor.processManifests(['modA', 'modB'], worldName)).rejects.toBe(
      error
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Encountered 1 engine version incompatibilities'),
      error
    );
    expect(modLoadOrderResolver.resolveOrder).not.toHaveBeenCalled();
    expect(registry.store).not.toHaveBeenCalledWith(
      'meta',
      'final_mod_order',
      expect.anything()
    );
  });
});