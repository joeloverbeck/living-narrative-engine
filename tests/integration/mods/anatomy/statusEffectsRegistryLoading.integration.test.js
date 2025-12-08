import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { registerInterpreters } from '../../../../src/dependencyInjection/registrations/interpreterRegistrations.js';
import { registerLoaders } from '../../../../src/dependencyInjection/registrations/loadersRegistrations.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

let originalFetch;
let currentGameConfig;

/**
 * Node-friendly fetch that serves the in-memory game config and reads other
 * JSON files from disk for the ModsLoader pipeline.
 *
 * @param {string} identifier
 * @returns {Promise<{ok: boolean, json: () => Promise<any>, text: () => Promise<string>, status: number, statusText: string}>}
 */
async function nodeFileFetch(identifier) {
  if (identifier.endsWith('game.json')) {
    const content =
      currentGameConfig ??
      (await fs.readFile(
        path.resolve(process.cwd(), 'data/game.json'),
        'utf8'
      ));

    return {
      ok: true,
      json: async () => JSON.parse(content),
      text: async () => content,
      status: 200,
      statusText: 'OK',
    };
  }

  try {
    let absolutePath = path.resolve(process.cwd(), identifier);
    let content;
    try {
      content = await fs.readFile(absolutePath, 'utf8');
    } catch (err) {
      if (absolutePath.endsWith('mod-manifest.json')) {
        absolutePath = absolutePath.replace(
          'mod-manifest.json',
          'mod.manifest.json'
        );
        content = await fs.readFile(absolutePath, 'utf8');
      } else {
        throw err;
      }
    }

    return {
      ok: true,
      json: async () => JSON.parse(content),
      text: async () => content,
      status: 200,
      statusText: 'OK',
    };
  } catch {
    return { ok: false, status: 404, statusText: 'Not Found' };
  }
}

describe('Anatomy status-effect registry loading', () => {
  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = nodeFileFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    currentGameConfig = JSON.stringify(
      {
        mods: ['core', 'descriptors', 'anatomy'],
      },
      null,
      2
    );
  });

  it('loads anatomy status-effects registry entries into the data registry', async () => {
    const container = new AppContainer();
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    container.register(tokens.ILogger, logger);
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: () => Promise.resolve(),
    });
    container.register(tokens.ISafeEventDispatcher, {
      dispatch: jest.fn(),
    });

    registerInterpreters(container);
    await registerLoaders(container);

    const modsLoader = container.resolve(tokens.ModsLoader);
    const loadReport = await modsLoader.loadMods('status-effects-world');

    expect(loadReport.finalModOrder).toEqual([
      'core',
      'descriptors',
      'anatomy',
    ]);

    const dataRegistry = container.resolve(tokens.IDataRegistry);
    const statusEffectEntries = dataRegistry.getAll('statusEffects');

    expect(statusEffectEntries.length).toBeGreaterThan(0);
    expect(statusEffectEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'status_effects',
          _fullId: 'anatomy:status_effects',
          _modId: 'anatomy',
        }),
      ])
    );
  });
});
