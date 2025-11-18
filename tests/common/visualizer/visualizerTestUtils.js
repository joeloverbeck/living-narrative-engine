import { jest } from '@jest/globals';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const WAIT_INTERVAL_MS = 25;
const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Waits until the provided condition evaluates to true or the timeout elapses.
 *
 * @param {() => boolean} condition - Predicate evaluated repeatedly until it returns true.
 * @param {number} [timeout] - Maximum wait time in milliseconds.
 * @returns {Promise<void>} Resolves when the condition becomes true.
 * @throws {Error} If the timeout expires before the condition becomes true.
 */
export async function waitForCondition(condition, timeout = DEFAULT_TIMEOUT_MS) {
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
