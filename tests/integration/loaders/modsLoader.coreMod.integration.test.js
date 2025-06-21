/**
 * @jest-environment node
 */
const fs = require('fs/promises');
const path = require('path');
const { registerLoaders } = require('../../../src/dependencyInjection/registrations/loadersRegistrations.js');
const { tokens } = require('../../../src/dependencyInjection/tokens.js');
const ModsLoader = require('../../../src/loaders/modsLoader.js').default;
const { createLoadContext } = require('../../../src/loaders/LoadContext.js');

const GAME_JSON_PATH = path.join(__dirname, '../../../data/game.json');
const BACKUP_GAME_JSON_PATH = path.join(__dirname, '../../../data/game.json.bak');

// Helper to read/restore game.json
/**
 *
 */
async function backupGameJson() {
  await fs.copyFile(GAME_JSON_PATH, BACKUP_GAME_JSON_PATH);
}
/**
 *
 */
async function restoreGameJson() {
  await fs.copyFile(BACKUP_GAME_JSON_PATH, GAME_JSON_PATH);
  await fs.unlink(BACKUP_GAME_JSON_PATH);
}

/**
 *
 */
async function writeCoreOnlyGameJson() {
  const coreOnly = { mods: ['core'] };
  await fs.writeFile(GAME_JSON_PATH, JSON.stringify(coreOnly, null, 2));
}

// Node-compatible fetch for local files
/**
 *
 * @param identifier
 */
function nodeFileFetch(identifier) {
  const fs = require('fs/promises');
  const path = require('path');
  return (async () => {
    try {
      let absolutePath = path.resolve(process.cwd(), identifier);
      let content;
      try {
        content = await fs.readFile(absolutePath, 'utf8');
      } catch (err) {
        // If the file is 'mod-manifest.json', try 'mod.manifest.json' as fallback
        if (absolutePath.endsWith('mod-manifest.json')) {
          absolutePath = absolutePath.replace('mod-manifest.json', 'mod.manifest.json');
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
    } catch (error) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      };
    }
  })();
}

describe('Integration: ModsLoader can load the core mod (real files)', () => {
  let originalGameJson;
  const gameJsonPath = path.join(process.cwd(), 'data', 'game.json');
  let originalFetch;

  beforeAll(async () => {
    // Patch global.fetch for Node
    originalFetch = global.fetch;
    global.fetch = nodeFileFetch;
    // Backup original game.json
    try {
      originalGameJson = await fs.readFile(gameJsonPath, 'utf8');
    } catch (error) {
      originalGameJson = null;
    }
  });

  afterAll(async () => {
    // Restore original game.json if it existed
    if (originalGameJson !== null) {
      await fs.writeFile(gameJsonPath, originalGameJson);
    }
    // Restore original fetch
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    // Create a minimal game.json that only includes the core mod
    const testGameConfig = {
      mods: ['core']
    };
    await fs.writeFile(gameJsonPath, JSON.stringify(testGameConfig, null, 2));
  });

  it('loads the core mod without error and registers its manifest', async () => {
    // Set up a real DI container and register all loaders
    const AppContainer = require('../../../src/dependencyInjection/appContainer.js').default;
    const container = new AppContainer();
    
    // Register a simple logger
    const simpleLogger = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    container.register(tokens.ILogger, simpleLogger);
    
    // Register a minimal IValidatedEventDispatcher stub
    const validatedEventDispatcherStub = { dispatch: () => Promise.resolve() };
    container.register(tokens.IValidatedEventDispatcher, validatedEventDispatcherStub);
    
    // Register Node-compatible data fetcher
    // const nodeDataFetcher = new NodeDataFetcher();
    // container.register(tokens.IDataFetcher, nodeDataFetcher);
    
    registerLoaders(container);
    const logger = container.resolve(tokens.ILogger);
    // Spy on logger.error for critical errors
    const errorSpy = jest.spyOn(logger, 'error');
    
    // Get the real ModsLoader
    const modsLoader = container.resolve(tokens.ModsLoader);
    
    // Run the pipeline
    const result = await modsLoader.loadMods('testworld');
    
    // Verify the returned LoadReport
    expect(result).toEqual({
      finalModOrder: ['core'],
      totals: expect.any(Object),
      incompatibilities: 0,
    });
    
    // Check the registry for the core mod manifest
    const registry = container.resolve(tokens.IDataRegistry);
    const coreManifest = registry.get('mod_manifests', 'core');
    expect(coreManifest).toBeDefined();
    expect(coreManifest.id).toBe('core');
    
    // Verify no critical errors were logged
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL'),
      expect.anything()
    );
    
    // Verify the final mod order contains only 'core'
    const finalModOrder = registry.get('meta', 'final_mod_order');
    expect(finalModOrder).toEqual(['core']);
  });
}); 