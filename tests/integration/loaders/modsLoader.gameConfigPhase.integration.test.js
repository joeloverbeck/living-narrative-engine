const ModsLoader = require('../../../src/loaders/modsLoader.js').default;
const GameConfigPhase = require('../../../src/loaders/phases/GameConfigPhase.js').default;
const ManifestPhase = require('../../../src/loaders/phases/ManifestPhase.js').default;
const { ModsLoaderPhaseError, ModsLoaderErrorCode } = require('../../../src/errors/modsLoaderPhaseError.js');
const { createLoadContext } = require('../../../src/loaders/LoadContext.js');
const { makeRegistryCache } = require('../../../src/loaders/registryCacheAdapter.js');

// Minimal fake logger
const fakeLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Minimal in-memory registry
class FakeRegistry {
  constructor() { this._store = new Map(); this.data = this._store; }
  store(ns, key, value) {
    if (!this._store.has(ns)) this._store.set(ns, new Map());
    this._store.get(ns).set(key, value);
  }
  get(ns, key) {
    return this._store.get(ns)?.get(key);
  }
  clear() { this._store.clear(); }
}

describe('ModsLoader + GameConfigPhase integration', () => {
  let registry;
  let context;
  let phases;
  let modsLoader;
  let fakeGameConfigLoader;
  let manifestPhase;

  beforeEach(() => {
    registry = new FakeRegistry();
    context = createLoadContext({ worldName: 'test', registry });
    fakeLogger.info.mockClear();
    fakeLogger.debug.mockClear();
    fakeLogger.warn.mockClear();
    fakeLogger.error.mockClear();
  });

  /**
   *
   * @param config
   */
  function makeGameConfigPhaseWithConfig(config) {
    fakeGameConfigLoader = { loadConfig: jest.fn().mockResolvedValue(config) };
    return new GameConfigPhase({ gameConfigLoader: fakeGameConfigLoader, logger: fakeLogger });
  }

  /**
   *
   * @param error
   */
  function makeGameConfigPhaseWithError(error) {
    fakeGameConfigLoader = { loadConfig: jest.fn().mockRejectedValue(error) };
    return new GameConfigPhase({ gameConfigLoader: fakeGameConfigLoader, logger: fakeLogger });
  }

  // Minimal manifest phase that just records the requestedMods
  class TestManifestPhase {
    async execute(ctx) {
      ctx._manifestPhaseRequestedMods = ctx.requestedMods;
    }
  }

  /**
   *
   * @param phases
   */
  function makeSession(phases) {
    return {
      async run(ctx) {
        for (const phase of phases) {
          await phase.execute(ctx);
        }
        return ctx;
      },
    };
  }

  it('loads mods from game.json and sets them in context', async () => {
    const mods = ['core', 'modA', 'modB'];
    const gameConfigPhase = makeGameConfigPhaseWithConfig(mods);
    manifestPhase = new TestManifestPhase();
    phases = [gameConfigPhase, manifestPhase];
    modsLoader = new ModsLoader({ logger: fakeLogger, cache: makeRegistryCache(registry), session: makeSession(phases), registry });
    const result = await modsLoader.loadMods('test');
    // After loadMods, check the registry or other side effects as needed
    expect(fakeGameConfigLoader.loadConfig).toHaveBeenCalled();
    
    // Verify the returned LoadReport
    expect(result).toEqual({
      finalModOrder: [],
      totals: {},
      incompatibilities: 0,
    });
  });

  it('throws a ModsLoaderPhaseError if game.json is missing', async () => {
    const error = new Error('File not found');
    const gameConfigPhase = makeGameConfigPhaseWithError(error);
    manifestPhase = new TestManifestPhase();
    phases = [gameConfigPhase, manifestPhase];
    modsLoader = new ModsLoader({ logger: fakeLogger, cache: makeRegistryCache(registry), session: makeSession(phases), registry });
    await expect(modsLoader.loadMods('test')).rejects.toThrow(ModsLoaderPhaseError);
    await expect(modsLoader.loadMods('test')).rejects.toHaveProperty('code', ModsLoaderErrorCode.GAME_CONFIG);
  });

  it('throws a ModsLoaderPhaseError if game.json is malformed', async () => {
    const error = new Error('Unexpected token } in JSON');
    const gameConfigPhase = makeGameConfigPhaseWithError(error);
    manifestPhase = new TestManifestPhase();
    phases = [gameConfigPhase, manifestPhase];
    modsLoader = new ModsLoader({ logger: fakeLogger, cache: makeRegistryCache(registry), session: makeSession(phases), registry });
    await expect(modsLoader.loadMods('test')).rejects.toThrow(ModsLoaderPhaseError);
    await expect(modsLoader.loadMods('test')).rejects.toHaveProperty('code', ModsLoaderErrorCode.GAME_CONFIG);
  });

  it('makes loaded mods available in the registry after pipeline runs', async () => {
    // Simulate a manifest phase that stores mods in the registry
    const mods = ['core', 'modA'];
    const gameConfigPhase = makeGameConfigPhaseWithConfig(mods);
    class RegistryManifestPhase {
      async execute(ctx) {
        ctx.requestedMods.forEach((mod) => registry.store('mod_manifests', mod, { id: mod }));
      }
    }
    manifestPhase = new RegistryManifestPhase();
    phases = [gameConfigPhase, manifestPhase];
    modsLoader = new ModsLoader({ logger: fakeLogger, cache: makeRegistryCache(registry), session: makeSession(phases), registry });
    const result = await modsLoader.loadMods('test');
    expect(registry.get('mod_manifests', 'core')).toEqual({ id: 'core' });
    expect(registry.get('mod_manifests', 'modA')).toEqual({ id: 'modA' });
    
    // Verify the returned LoadReport
    expect(result).toEqual({
      finalModOrder: [],
      totals: {},
      incompatibilities: 0,
    });
  });
}); 