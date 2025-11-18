/**
 * @file anatomyVisualizer.entrypoint.realModules.integration.test.js
 * @description Integration tests for the anatomy-visualizer entrypoint using real DI container wiring.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const WAIT_INTERVAL_MS = 25;
const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Wait until a condition returns true or the timeout elapses.
 *
 * @param {() => boolean} condition - Predicate to evaluate.
 * @param {number} [timeout] - Maximum wait time in milliseconds.
 * @returns {Promise<void>} Resolves when the condition becomes true.
 */
async function waitForCondition(condition, timeout = DEFAULT_TIMEOUT_MS) {
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
 * Create a fetch mock that loads local files relative to the repository root.
 *
 * @returns {jest.Mock} A Jest mock that emulates the Fetch API for local resources.
 */
function createFileFetchMock() {
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
        const availableMods = new Set(
          await fs.readdir(path.resolve(REPO_ROOT, 'data/mods'))
        );
        const preferredMods = [
          'core',
          'movement',
          'companionship',
          'positioning',
          'items',
          'anatomy',
          'clothing',
          'exercise',
          'distress',
          'violence',
          'seduction',
          'affection',
          'caressing',
          'kissing',
          'isekai',
        ];
        const filteredMods = preferredMods.filter((modId) => availableMods.has(modId));
        fileText = JSON.stringify({ ...parsed, mods: filteredMods });
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
 * Build a lightweight Response-like object for the mocked fetch implementation.
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

describe('anatomy-visualizer entrypoint (real modules)', () => {
  let readyStateValue;
  let backButtonClickHandler;
  let originalBackButtonAddEventListener;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();

    readyStateValue = 'loading';
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyStateValue,
    });

    document.body.innerHTML = `
      <div id="anatomy-visualizer-container">
        <header id="anatomy-header">
          <h1>Anatomy Visualizer</h1>
          <button id="back-button" class="menu-button">Back to Menu</button>
        </header>
        <div id="entity-selector-container">
          <label for="entity-selector">Select Entity:</label>
          <select id="entity-selector">
            <option value="">Loading entities...</option>
          </select>
        </div>
        <div id="anatomy-content">
          <div id="anatomy-graph-panel" class="panel">
            <h2>Body Parts Graph</h2>
            <div id="anatomy-graph-container"></div>
          </div>
          <div id="right-panels-container">
            <div id="equipment-panel" class="panel">
              <h2>Equipment</h2>
              <div id="equipment-content">
                <p class="message">Loading equipment...</p>
              </div>
            </div>
            <div id="entity-description-panel" class="panel">
              <h2>Entity Description</h2>
              <div id="entity-description-content">
                <p>Select an entity to view its description.</p>
              </div>
            </div>
          </div>
        </div>
        <div id="error-output"></div>
      </div>
    `;

    const backButton = document.getElementById('back-button');
    backButtonClickHandler = undefined;
    originalBackButtonAddEventListener = backButton.addEventListener;
    backButton.addEventListener = function addEventListenerWithCapture(
      type,
      listener,
      options
    ) {
      if (type === 'click') {
        backButtonClickHandler = listener;
      }
      return originalBackButtonAddEventListener.call(this, type, listener, options);
    };

    global.alert = jest.fn();
  });

  afterEach(() => {
    const backButton = document.getElementById('back-button');
    if (backButton && originalBackButtonAddEventListener) {
      backButton.addEventListener = originalBackButtonAddEventListener;
    }
    backButtonClickHandler = undefined;
    originalBackButtonAddEventListener = undefined;
    delete document.readyState;
    delete global.fetch;
    delete window.fetch;
    delete global.alert;
    document.body.innerHTML = '';
  });

  it('initializes after DOMContentLoaded when the document is still loading', async () => {
    const fetchMock = createFileFetchMock();
    global.fetch = fetchMock;
    window.fetch = fetchMock;

    const { default: AnatomyVisualizerUI } = await import(
      '../../../src/domUI/AnatomyVisualizerUI.js'
    );
    const uiInitializeSpy = jest.spyOn(AnatomyVisualizerUI.prototype, 'initialize');

    const { CommonBootstrapper } = await import(
      '../../../src/bootstrapper/CommonBootstrapper.js'
    );
    const bootstrapSpy = jest.spyOn(CommonBootstrapper.prototype, 'bootstrap');

    await import('../../../src/anatomy-visualizer.js');

    expect(bootstrapSpy).not.toHaveBeenCalled();

    readyStateValue = 'interactive';
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await waitForCondition(() => bootstrapSpy.mock.results.length === 1);
    const bootstrapResult = bootstrapSpy.mock.results[0]?.value;
    await bootstrapResult;

    await waitForCondition(() => uiInitializeSpy.mock.results.length === 1);
    await uiInitializeSpy.mock.results[0]?.value;

    const entitySelector = document.getElementById('entity-selector');
    expect(entitySelector).toBeTruthy();
    const uiInstance = uiInitializeSpy.mock.instances[0];
    if (uiInstance) {
      const definitions = uiInstance._registry?.getAllEntityDefinitions?.() ?? [];
      expect(definitions.length).toBeGreaterThan(0);
    }
    expect(entitySelector.options.length).toBeGreaterThan(1);

    expect(backButtonClickHandler).toBeInstanceOf(Function);
    // Execute the captured handler directly to cover the navigation branch.
    try {
      backButtonClickHandler();
    } catch (navigationError) {
      // jsdom does not implement cross-document navigation; ensure the expected error is raised.
      expect(navigationError?.type).toBe('not implemented');
    }
  }, DEFAULT_TIMEOUT_MS);

  it('bootstraps immediately when the document is already loaded', async () => {
    const fetchMock = createFileFetchMock();
    global.fetch = fetchMock;
    window.fetch = fetchMock;

    readyStateValue = 'complete';

    const { default: AnatomyVisualizerUI } = await import(
      '../../../src/domUI/AnatomyVisualizerUI.js'
    );
    const uiInitializeSpy = jest.spyOn(AnatomyVisualizerUI.prototype, 'initialize');

    const { CommonBootstrapper } = await import(
      '../../../src/bootstrapper/CommonBootstrapper.js'
    );
    const bootstrapSpy = jest.spyOn(CommonBootstrapper.prototype, 'bootstrap');

    await import('../../../src/anatomy-visualizer.js');

    await waitForCondition(() => bootstrapSpy.mock.results.length === 1);
    const bootstrapResult = bootstrapSpy.mock.results[0]?.value;
    await bootstrapResult;

    await waitForCondition(() => uiInitializeSpy.mock.results.length === 1);
    await uiInitializeSpy.mock.results[0]?.value;

    expect(bootstrapSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        containerConfigType: 'minimal',
        worldName: 'default',
        includeAnatomyFormatting: true,
      })
    );
  }, DEFAULT_TIMEOUT_MS);

  it('reports fatal errors when bootstrap fails', async () => {
    const failingFetch = jest.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Error',
      json: async () => {
        throw new Error('fetch failure');
      },
      text: async () => 'fetch failure',
    }));
    global.fetch = failingFetch;
    window.fetch = failingFetch;

    readyStateValue = 'complete';

    const alertSpy = jest.spyOn(global, 'alert');

    const { CommonBootstrapper } = await import(
      '../../../src/bootstrapper/CommonBootstrapper.js'
    );
    const fatalSpy = jest.spyOn(
      CommonBootstrapper.prototype,
      'displayFatalStartupError'
    );

    await import('../../../src/anatomy-visualizer.js');

    await waitForCondition(() => fatalSpy.mock.calls.length === 1);

    expect(fatalSpy.mock.calls[0][0]).toMatch(
      /Failed to initialize anatomy visualizer: Failed to load game configuration/
    );
    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to initialize anatomy visualizer')
    );
  }, DEFAULT_TIMEOUT_MS);
});
