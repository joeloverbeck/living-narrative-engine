/**
 * @file Integration tests for the cliches-generator entry point using the real bootstrap workflow.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const WAIT_INTERVAL_MS = 25;
const DEFAULT_TIMEOUT_MS = 120000;

jest.setTimeout(DEFAULT_TIMEOUT_MS);

/**
 * Wait until a condition evaluates to true or throw after a timeout.
 *
 * @param {() => boolean} condition - Predicate evaluated on every polling interval.
 * @param {number} [timeout] - Maximum time to wait in milliseconds.
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
 * Create a fetch mock that resolves local files relative to the repository root.
 *
 * @returns {jest.Mock} Jest mock that emulates the Fetch API.
 */
function createFileFetchMock() {
  return jest.fn(async (resource) => {
    const requestInfo = typeof resource === 'string' ? resource : resource?.url;

    if (!requestInfo) {
      throw new Error('Unsupported fetch invocation without a URL.');
    }

    if (/^https?:/i.test(requestInfo)) {
      throw new Error(`Unexpected network request to ${requestInfo}`);
    }

    const sanitizedPath = requestInfo.split('?')[0];
    const relativePath = sanitizedPath.replace(/^\.\/+/, '').replace(/^\/+/, '');
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
        const prioritizedMods = ['core'];
        const filteredMods = prioritizedMods.filter((modId) =>
          availableMods.has(modId)
        );
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
 * Build a minimal Response-like object for the mocked fetch implementation.
 *
 * @param {string} requestInfo - Original request identifier.
 * @param {string} fileText - Text representation of the payload.
 * @param {Buffer} fileBuffer - Buffer with the payload contents.
 * @returns {Response} Minimal Response-compatible object.
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

describe('cliches-generator entry point (real modules)', () => {
  let readyStateValue;
  let originalNodeEnv;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();

    readyStateValue = 'loading';
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyStateValue,
    });

    document.body.innerHTML = `
      <div id="cliches-generator-container" class="cb-page-container">
        <header class="cb-page-header">
          <div class="header-content">
            <h1>Clichés Generator</h1>
          </div>
        </header>
        <main class="cb-page-main cliches-generator-main">
          <section class="cb-input-panel direction-selection-panel">
            <form id="cliches-form" class="cb-form">
              <div class="cb-form-group">
                <label for="direction-selector">Choose Direction:</label>
                <select id="direction-selector" class="cb-select">
                  <option value="">-- Choose a thematic direction --</option>
                </select>
              </div>
              <div class="cb-form-actions">
                <button type="submit" id="generate-btn" class="cb-button" disabled>
                  Generate Clichés
                </button>
              </div>
            </form>
            <div id="selected-direction-display" style="display: none">
              <div id="direction-content"></div>
              <div id="direction-meta"></div>
            </div>
            <div id="original-concept-display" style="display: none">
              <div id="concept-content"></div>
            </div>
          </section>
          <section class="cb-output-panel cliches-display-panel">
            <div id="status-messages"></div>
            <div id="cliches-container">
              <div id="empty-state" class="cb-empty-state"></div>
              <div id="loading-state" class="cb-loading-state" style="display: none"></div>
              <div id="results-state" class="cb-results-state" style="display: none"></div>
              <div id="error-state" class="cb-error-state" style="display: none">
                <p id="error-message"></p>
                <button type="button" id="retry-btn"></button>
              </div>
            </div>
          </section>
        </main>
        <footer class="cb-page-footer">
          <nav class="footer-navigation">
            <button id="back-btn" class="cb-button">← Back to Main Menu</button>
          </nav>
        </footer>
      </div>
    `;

    window.__clichesController = undefined;
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    delete document.readyState;
    document.body.innerHTML = '';
    delete global.fetch;
    delete window.fetch;
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it(
    'initializes after DOMContentLoaded when the document is still loading',
    async () => {
      const fetchMock = createFileFetchMock();
      global.fetch = fetchMock;
      window.fetch = fetchMock;

      process.env.NODE_ENV = 'development';

      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { ClichesGeneratorController } = await import(
        '../../../src/clichesGenerator/controllers/ClichesGeneratorController.js'
      );
      const bootstrapSpy = jest.spyOn(
        CharacterBuilderBootstrap.prototype,
        'bootstrap'
      );
      const cleanupSpy = jest.spyOn(
        ClichesGeneratorController.prototype,
        'cleanup'
      );
      const windowAddEventListenerSpy = jest.spyOn(window, 'addEventListener');

      await import('../../../src/cliches-generator-main.js');

      expect(bootstrapSpy).not.toHaveBeenCalled();

      readyStateValue = 'interactive';
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await waitForCondition(() => bootstrapSpy.mock.results.length === 1);
      const bootstrapResultPromise = bootstrapSpy.mock.results[0]?.value;
      const bootstrapResult = await bootstrapResultPromise;
      expect(bootstrapResult?.controller).toBeInstanceOf(
        ClichesGeneratorController
      );

      const stateHistory = bootstrapResult.controller.getStateHistory();
      expect(stateHistory[0]?.action).toBe('initialized');

      expect(window.__clichesController).toBeInstanceOf(
        ClichesGeneratorController
      );

      const beforeUnloadCall = windowAddEventListenerSpy.mock.calls.find(
        ([type]) => type === 'beforeunload'
      );
      expect(beforeUnloadCall).toBeTruthy();
      const beforeUnloadHandler = beforeUnloadCall[1];
      await beforeUnloadHandler();
      expect(cleanupSpy).toHaveBeenCalled();
    },
    DEFAULT_TIMEOUT_MS
  );

  it(
    'bootstraps immediately when the document is already loaded',
    async () => {
      const fetchMock = createFileFetchMock();
      global.fetch = fetchMock;
      window.fetch = fetchMock;

      readyStateValue = 'complete';

      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { ClichesGeneratorController } = await import(
        '../../../src/clichesGenerator/controllers/ClichesGeneratorController.js'
      );
      const bootstrapSpy = jest.spyOn(
        CharacterBuilderBootstrap.prototype,
        'bootstrap'
      );

      await import('../../../src/cliches-generator-main.js');

      await waitForCondition(() => bootstrapSpy.mock.results.length === 1);
      const config = bootstrapSpy.mock.calls[0][0];
      expect(config).toMatchObject({
        pageName: 'cliches-generator',
        includeModLoading: true,
        customSchemas: ['/data/schemas/cliche.schema.json'],
      });
      expect(config.controllerClass).toBe(ClichesGeneratorController);

      const bootstrapResultPromise = bootstrapSpy.mock.results[0]?.value;
      const bootstrapResult = await bootstrapResultPromise;
      expect(bootstrapResult?.controller).toBeInstanceOf(
        ClichesGeneratorController
      );

      expect(window.__clichesController).toBeUndefined();
    },
    DEFAULT_TIMEOUT_MS
  );

  it(
    'renders an error message when bootstrap fails',
    async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const bootstrapFailure = new Error('integration bootstrap failure');
      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockRejectedValue(bootstrapFailure);

      readyStateValue = 'loading';

      const module = await import('../../../src/cliches-generator-main.js');

      await expect(module.initializeApp()).rejects.toThrow(
        'integration bootstrap failure'
      );

      const errorContainer = document.getElementById(
        'cliches-generator-container'
      );
      expect(errorContainer.innerHTML).toContain('Unable to Load Clichés Generator');
    },
    DEFAULT_TIMEOUT_MS
  );
});
