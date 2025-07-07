// @jest-environment node
const fs = require('fs/promises');
const path = require('path');
const {
  registerLoaders,
} = require('../../../src/dependencyInjection/registrations/loadersRegistrations.js');
const { tokens } = require('../../../src/dependencyInjection/tokens.js');

// Node-compatible fetch for local files
/**
 * Fetch a local JSON file and return a minimal Response-like object.
 *
 * @param {string} identifier Path to the file to fetch.
 * @returns {Promise<object>} An object mimicking the Response interface.
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
    } catch {
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
      mods: ['core'],
    };
    await fs.writeFile(gameJsonPath, JSON.stringify(testGameConfig, null, 2));
  });

  it('loads the core mod without error and registers its manifest', async () => {
    // Set up a real DI container and register all loaders
    const AppContainer =
      require('../../../src/dependencyInjection/appContainer.js').default;
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
    container.register(
      tokens.IValidatedEventDispatcher,
      validatedEventDispatcherStub
    );

    // Register a minimal ISafeEventDispatcher stub
    const safeEventDispatcherStub = { dispatch: jest.fn() };
    container.register(tokens.ISafeEventDispatcher, safeEventDispatcherStub);

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
