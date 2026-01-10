/**
 * @file expressions-simulator.entrypoint.realModules.integration.test.js
 * @description Integration test for expressions-simulator entrypoint using real DI wiring.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const WAIT_INTERVAL_MS = 25;
const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Wait until a condition returns true or the timeout elapses.
 *
 * @param {() => boolean} condition
 * @param {number} [timeout]
 * @returns {Promise<void>}
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
 * Build a lightweight Response-like object for the mocked fetch implementation.
 *
 * @param {string} requestInfo
 * @param {string} fileText
 * @param {Buffer} fileBuffer
 * @returns {Response}
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

/**
 * Create a fetch mock that loads local files relative to the repository root.
 *
 * @returns {jest.Mock}
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
        const preferredMods = ['core', 'emotions-sexual-desire', 'emotions-curiosity-attention', 'emotions-absorption', 'emotions-disengagement', 'emotions-confusion'];
        const filteredMods = preferredMods.filter((modId) =>
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

describe('expressions-simulator entrypoint (real modules)', () => {
  let readyStateValue;
  let originalReadyDescriptor;
  let originalFetch;
  let originalAlert;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();

    readyStateValue = 'complete';
    originalReadyDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyStateValue,
    });

    document.body.innerHTML = `
      <div id="expressions-simulator-container">
        <div id="es-mood-inputs"></div>
        <div id="es-sexual-inputs"></div>
        <div id="es-mood-derived"></div>
        <div id="es-sexual-derived"></div>
        <span id="es-expression-total">--</span>
        <button id="es-trigger-button" type="button"></button>
        <ul id="es-matching-list"></ul>
        <div id="es-selected-expression"></div>
        <div id="es-actor-message"></div>
        <div id="es-observer-message"></div>
      </div>
      <div id="error-output"></div>
    `;

    globalThis.__LNE_FORCE_AUTO_INIT__ = true;

    originalFetch = global.fetch;
    global.fetch = createFileFetchMock();

    originalAlert = global.alert;
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    delete globalThis.__LNE_FORCE_AUTO_INIT__;

    if (originalReadyDescriptor) {
      Object.defineProperty(document, 'readyState', originalReadyDescriptor);
    } else {
      delete document.readyState;
    }

    global.fetch = originalFetch;
    global.alert = originalAlert;
  });

  it('initializes the controller and renders expression totals', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      await import('../../src/expressions-simulator.js');
    });

    const totalEl = document.getElementById('es-expression-total');

    await waitForCondition(() => {
      const rawValue = totalEl?.textContent?.trim() ?? '';
      const parsed = Number.parseInt(rawValue, 10);
      return Number.isFinite(parsed) && parsed > 0;
    });

    expect(global.alert).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
