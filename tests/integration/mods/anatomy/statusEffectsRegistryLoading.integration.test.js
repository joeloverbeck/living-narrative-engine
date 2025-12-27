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
import StatusEffectRegistry from '../../../../src/anatomy/services/statusEffectRegistry.js';

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

    // Note: 'breathing-states' is loaded because it's a dependency of 'anatomy'
    expect(loadReport.finalModOrder).toEqual([
      'core',
      'descriptors',
      'breathing-states',
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

  it('aggregates status effects from anatomy and breathing mods via StatusEffectRegistry', async () => {
    // Override game config to include breathing mod
    currentGameConfig = JSON.stringify(
      {
        mods: ['core', 'descriptors', 'breathing-states', 'liquids-states', 'anatomy', 'breathing'],
      },
      null,
      2
    );

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
    const loadReport = await modsLoader.loadMods('multi-mod-status-effects-world');

    // Verify both mods are loaded
    expect(loadReport.finalModOrder).toContain('anatomy');
    expect(loadReport.finalModOrder).toContain('breathing');

    const dataRegistry = container.resolve(tokens.IDataRegistry);
    const statusEffectEntries = dataRegistry.getAll('statusEffects');

    // Should have registry entries from both mods
    expect(statusEffectEntries.length).toBeGreaterThanOrEqual(2);
    expect(statusEffectEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _fullId: 'anatomy:status_effects',
          _modId: 'anatomy',
        }),
        expect.objectContaining({
          _fullId: 'breathing:status_effects',
          _modId: 'breathing',
        }),
      ])
    );

    // Create StatusEffectRegistry and verify aggregation
    const registry = new StatusEffectRegistry({ dataRegistry, logger });

    // Anatomy status effects (5 total)
    expect(registry.get('bleeding')).toBeDefined();
    expect(registry.get('burning')).toBeDefined();
    expect(registry.get('poisoned')).toBeDefined();
    expect(registry.get('fractured')).toBeDefined();
    expect(registry.get('dismembered')).toBeDefined();

    // Breathing status effects (2 total)
    expect(registry.get('hypoxic')).toBeDefined();
    expect(registry.get('unconscious_anoxia')).toBeDefined();

    // Total should be 7 effects
    const allEffects = registry.getAll();
    expect(allEffects).toHaveLength(7);

    // Verify applyOrder includes effects from both mods
    const applyOrder = registry.getApplyOrder();
    expect(applyOrder).toContain('bleeding');
    expect(applyOrder).toContain('hypoxic');
    expect(applyOrder).toContain('unconscious_anoxia');

    // Verify specific effect properties from breathing mod
    const hypoxic = registry.get('hypoxic');
    expect(hypoxic.effectType).toBe('hypoxia');
    expect(hypoxic.componentId).toBe('breathing:hypoxic');

    const unconsciousAnoxia = registry.get('unconscious_anoxia');
    expect(unconsciousAnoxia.effectType).toBe('anoxic_unconsciousness');
    expect(unconsciousAnoxia.componentId).toBe('breathing:unconscious_anoxia');
  });
});
