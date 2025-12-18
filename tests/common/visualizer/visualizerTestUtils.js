import { jest } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const WAIT_INTERVAL_MS = 10; // Reduced from 25ms for faster polling
const DEFAULT_TIMEOUT_MS = 10000; // Reduced from 120s - 10s is plenty for E2E tests

/**
 * Waits until the provided condition evaluates to true or the timeout elapses.
 *
 * @param {() => boolean} condition - Predicate evaluated repeatedly until it returns true.
 * @param {number} [timeout] - Maximum wait time in milliseconds.
 * @returns {Promise<void>} Resolves when the condition becomes true.
 * @throws {Error} If the timeout expires before the condition becomes true.
 */
export async function waitForCondition(
  condition,
  timeout = DEFAULT_TIMEOUT_MS
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }

  throw new Error('Timed out waiting for condition to be satisfied.');
}

/**
 * Creates a fetch mock that resolves relative URLs to files inside the repository.
 *
 * @returns {jest.Mock} Fetch mock that serves repository files without hitting the network.
 */
export function createFileFetchMock() {
  return jest.fn(async (resource) => {
    const requestInfo = typeof resource === 'string' ? resource : resource?.url;

    if (!requestInfo) {
      throw new Error('Unsupported fetch invocation - missing URL.');
    }

    if (/^https?:/i.test(requestInfo)) {
      throw new Error(`Unexpected network request to ${requestInfo}`);
    }

    const sanitizedPath = requestInfo.split('?')[0];
    const relativePath = sanitizedPath
      .replace(/^\.\/+/, '')
      .replace(/^\/+/, '');
    const absolutePath = path.resolve(REPO_ROOT, relativePath);

    let fileText;
    let fileBuffer;

    try {
    if (relativePath === 'data/game.json') {
        const rawText = await fs.readFile(absolutePath, 'utf-8');
        const parsed = JSON.parse(rawText);

        // Preserve the configured mods (used by mod loader to pull dependencies)
        // but filter out any that aren't present in the repo to avoid filesystem
        // errors in tests.
        const availableMods = new Set(
          await fs.readdir(path.resolve(REPO_ROOT, 'data/mods'))
        );

        const configuredMods = (parsed.mods || []).filter((modId) =>
          availableMods.has(modId)
        );

        // Fallback minimal set for cases where the config is empty; keep anatomy
        // and clothing-capable mods so the visualizer has real data to render.
        const fallbackMods = [
          'core',
          'anatomy',
          'clothing',
          'base-clothing',
          'outer-clothing',
          'underwear',
          'items',
        ].filter((modId) => availableMods.has(modId));

        const selectedMods = configuredMods.length > 0 ? configuredMods : fallbackMods;

        fileText = JSON.stringify({ ...parsed, mods: selectedMods });
        fileBuffer = Buffer.from(fileText, 'utf-8');
      } else {
        fileBuffer = await fs.readFile(absolutePath);
        fileText = fileBuffer.toString('utf-8');
      }
    } catch (error) {
      throw new Error(
        `Unable to satisfy fetch request for "${requestInfo}" (resolved to "${absolutePath}") - ${error.message}`
      );
    }

    return buildResponse(requestInfo, fileText, fileBuffer);
  });
}

/**
 * Builds a lightweight Response-like object for the mocked fetch implementation.
 *
 * @param {string} requestInfo - Original request identifier.
 * @param {string} fileText - Text representation of the payload.
 * @param {Buffer} fileBuffer - Buffer with the payload contents.
 * @returns {Response} A minimal Response-compatible object.
 */
function buildResponse(requestInfo, fileText, fileBuffer) {
  const response = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    redirected: false,
    type: 'basic',
    url: requestInfo,
    json: async () => JSON.parse(fileText),
    text: async () => fileText,
    arrayBuffer: async () =>
      fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength
      ),
    clone() {
      return buildResponse(requestInfo, fileText, fileBuffer);
    },
  };

  Object.defineProperty(response, 'bodyUsed', {
    configurable: true,
    enumerable: true,
    get() {
      return false;
    },
  });

  return response;
}

export const TEST_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/**
 * Shared bootstrap context for test suites.
 * Allows expensive bootstrap to be performed once per suite, not per test.
 *
 * @typedef {Object} SharedBootstrapContext
 * @property {Object} bootstrapper - CommonBootstrapper instance
 * @property {Object} container - DI container
 * @property {Object} services - Resolved services from bootstrap
 * @property {Object} entityManager - Entity manager service
 * @property {Object} registry - Entity registry service
 * @property {Object} eventDispatcher - Event dispatcher service
 * @property {Object} logger - Logger service
 * @property {Function} fetchMock - The fetch mock function
 */

/**
 * Performs shared bootstrap for an entire test suite.
 * Call this in beforeAll() to avoid repeated expensive initialization.
 * Uses the same configuration as the anatomy-visualizer entry point.
 *
 * @returns {Promise<SharedBootstrapContext>} Shared services for the test suite
 */
export async function performSharedBootstrap() {
  const fetchMock = createFileFetchMock();
  global.fetch = fetchMock;
  window.fetch = fetchMock;

  const { CommonBootstrapper } = await import(
    '../../../src/bootstrapper/CommonBootstrapper.js'
  );
  const { registerVisualizerComponents } = await import(
    '../../../src/dependencyInjection/registrations/visualizerRegistrations.js'
  );

  const bootstrapper = new CommonBootstrapper();

  const { container, services } = await bootstrapper.bootstrap({
    containerConfigType: 'minimal',
    worldName: 'default',
    includeAnatomyFormatting: true,
    postInitHook: async (services, container) => {
      registerVisualizerComponents(container);
    },
  });

  const { logger, registry, entityManager, eventDispatcher } = services;

  return {
    bootstrapper,
    container,
    services,
    entityManager,
    registry,
    eventDispatcher,
    logger,
    fetchMock,
  };
}

/**
 * Creates a fresh UI instance using shared services.
 * Much faster than full bootstrap (~50ms vs ~1200ms).
 *
 * Creates fresh instances of stateful components (VisualizerState,
 * VisualizerStateController) to ensure test isolation while reusing
 * expensive stateless services (entity manager, registry, etc.).
 *
 * @param {SharedBootstrapContext} context - Shared bootstrap context
 * @returns {Promise<Object>} Fresh AnatomyVisualizerUI instance
 */
export async function createFreshUIInstance(context) {
  const { default: AnatomyVisualizerUI } = await import(
    '../../../src/domUI/AnatomyVisualizerUI.js'
  );
  const { tokens } = await import(
    '../../../src/dependencyInjection/tokens.js'
  );
  // Import stateful components to create fresh instances
  const { VisualizerState } = await import(
    '../../../src/domUI/visualizer/VisualizerState.js'
  );
  const { AnatomyLoadingDetector } = await import(
    '../../../src/domUI/visualizer/AnatomyLoadingDetector.js'
  );
  const { VisualizerStateController } = await import(
    '../../../src/domUI/visualizer/VisualizerStateController.js'
  );

  const { logger, registry, entityManager, eventDispatcher, container } =
    context;

  const anatomyDescriptionService = container.resolve(
    tokens.AnatomyDescriptionService
  );

  // Create fresh instances of stateful components for test isolation
  const visualizerState = new VisualizerState({ logger });
  const anatomyLoadingDetector = new AnatomyLoadingDetector({
    entityManager,
    eventDispatcher,
    logger,
  });
  const visualizerStateController = new VisualizerStateController({
    visualizerState,
    anatomyLoadingDetector,
    eventDispatcher,
    entityManager,
    logger,
  });

  // Resolve stateless visualization components from container (safe to reuse)
  const visualizationComposer = container.resolve(tokens.VisualizationComposer);

  // Try to resolve ClothingManagementService - it may not be registered
  let clothingManagementService = null;
  try {
    clothingManagementService = container.resolve(
      tokens.ClothingManagementService
    );
  } catch {
    // ClothingManagementService not available - equipment panel will be disabled
  }

  const ui = new AnatomyVisualizerUI({
    logger,
    registry,
    entityManager,
    anatomyDescriptionService,
    eventDispatcher,
    documentContext: { document },
    visualizerStateController,
    visualizationComposer,
    clothingManagementService,
  });

  await ui.initialize();

  return ui;
}

/**
 * Cleans up after shared bootstrap.
 * Call this in afterAll() to properly reset module state.
 */
export function cleanupSharedBootstrap() {
  delete global.fetch;
  delete window.fetch;
}
