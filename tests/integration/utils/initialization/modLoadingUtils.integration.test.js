/**
 * @file Integration tests for loadModsFromGameConfig utility.
 * @description Ensures the helper coordinates ModsLoader, the registry cache,
 * and runtime fetch semantics without resorting to mocked loader internals.
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import { loadModsFromGameConfig } from '../../../../src/utils/initialization/modLoadingUtils.js';
import ModsLoader from '../../../../src/loaders/modsLoader.js';
import LoaderPhase from '../../../../src/loaders/phases/LoaderPhase.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import { makeRegistryCache } from '../../../../src/loaders/registryCacheAdapter.js';
import { createMockLogger } from '../../../common/mockFactories.js';

class RegistryRecordingPhase extends LoaderPhase {
  constructor() {
    super('RegistryRecordingPhase');
  }

  /**
   * @param {import('../../../../src/loaders/LoadContext.js').LoadContext} ctx
   * @returns {Promise<import('../../../../src/loaders/LoadContext.js').LoadContext>}
   */
  async execute(ctx) {
    const processedOrder = ctx.requestedMods.map(
      (modId) => `${modId}@${ctx.worldName}`
    );

    ctx.requestedMods.forEach((modId) => {
      ctx.registry.store('mods', modId, {
        id: modId,
        modId,
        world: ctx.worldName,
      });
    });

    const totals = {
      ...ctx.totals,
      modsProcessed: (ctx.totals.modsProcessed ?? 0) + ctx.requestedMods.length,
    };

    return {
      ...ctx,
      finalModOrder: [...ctx.finalModOrder, ...processedOrder],
      totals,
      incompatibilities: ctx.incompatibilities ?? 0,
    };
  }
}

class RecordingSession {
  /**
   * @param {LoaderPhase[]} phases
   */
  constructor(phases) {
    this.phases = phases;
    this.runCalls = [];
  }

  /**
   * @param {import('../../../../src/loaders/LoadContext.js').LoadContext} ctx
   */
  async run(ctx) {
    this.runCalls.push(ctx);
    let current = ctx;
    for (const phase of this.phases) {
      current = await phase.execute(current);
    }
    return current;
  }
}

class ThrowingSession {
  constructor(error) {
    this.error = error;
    this.runCalls = [];
  }

  async run(ctx) {
    this.runCalls.push(ctx);
    throw this.error;
  }
}

describe('integration: loadModsFromGameConfig', () => {
  /** @type {ReturnType<typeof jest.spyOn>} */
  let fetchSpy;

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore();
      fetchSpy = undefined;
    }
  });

  /**
   *
   * @param session
   */
  function createHarness(session) {
    const logger = createMockLogger();
    const registry = new InMemoryDataRegistry({ logger });
    const modsLoader = new ModsLoader({
      logger,
      cache: makeRegistryCache(registry),
      session,
      registry,
    });
    return { logger, registry, modsLoader, session };
  }

  it('loads mods declared in the game config and surfaces the loader report', async () => {
    const session = new RecordingSession([new RegistryRecordingPhase()]);
    const { logger, registry, modsLoader } = createHarness(session);
    const ResponseCtor = global.Response;

    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      expect(input).toBe('./data/game.json');
      return new ResponseCtor(
        JSON.stringify({ mods: ['mod-alpha', 'mod-beta'] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });

    const report = await loadModsFromGameConfig(
      modsLoader,
      logger,
      'storyWorld'
    );

    expect(session.runCalls).toHaveLength(1);
    expect(session.runCalls[0]).toMatchObject({
      worldName: 'storyWorld',
      requestedMods: ['mod-alpha', 'mod-beta'],
    });

    expect(report).toEqual({
      finalModOrder: ['mod-alpha@storyWorld', 'mod-beta@storyWorld'],
      totals: { modsProcessed: 2 },
      incompatibilities: 0,
    });

    const infoMessages = logger.info.mock.calls.map(([message]) => message);
    expect(infoMessages).toEqual(
      expect.arrayContaining([
        "Loading 2 mods for world 'storyWorld': mod-alpha, mod-beta",
        "Successfully loaded 2 mods for world 'storyWorld'",
      ])
    );

    expect(logger.debug).toHaveBeenCalledWith('Mod load report:', report);
    expect(registry.getAll('mods')).toEqual([
      { id: 'mod-alpha', modId: 'mod-alpha', world: 'storyWorld' },
      { id: 'mod-beta', modId: 'mod-beta', world: 'storyWorld' },
    ]);
  });

  it('defaults to an empty mod list and rethrows loader failures with context logging', async () => {
    const loaderError = new Error('session failure');
    const session = new ThrowingSession(loaderError);
    const { logger, registry, modsLoader } = createHarness(session);
    const ResponseCtor = global.Response;

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new ResponseCtor(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(loadModsFromGameConfig(modsLoader, logger)).rejects.toBe(
      loaderError
    );

    expect(session.runCalls).toHaveLength(1);
    expect(session.runCalls[0]).toMatchObject({
      worldName: 'default',
      requestedMods: [],
    });

    const infoMessages = logger.info.mock.calls.map(([message]) => message);
    expect(infoMessages).toContain("Loading 0 mods for world 'default': ");
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to load mods for world 'default':",
      loaderError
    );
    expect(registry.getAll('mods')).toEqual([]);
  });

  it('throws a descriptive error when the game configuration cannot be fetched', async () => {
    const session = new RecordingSession([new RegistryRecordingPhase()]);
    const { logger, modsLoader } = createHarness(session);
    const ResponseCtor = global.Response;

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new ResponseCtor('Internal failure', {
        status: 500,
        statusText: 'Server Error',
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    await expect(
      loadModsFromGameConfig(modsLoader, logger, 'crashWorld')
    ).rejects.toThrow(
      'Failed to load game configuration: 500 Server Error'
    );

    expect(session.runCalls).toHaveLength(0);
    expect(logger.error.mock.calls[0][0]).toBe(
      "Failed to load mods for world 'crashWorld':"
    );
    expect(logger.error.mock.calls[0][1]).toBeInstanceOf(Error);
  });
});
