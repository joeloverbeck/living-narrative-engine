import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { LLMSelectionPersistence } from '../../../src/llms/services/llmSelectionPersistence.js';

const MODULE_PATH = '../../../src/traits-rewriter-main.js';
const DISPLAY_NAME = 'Claude Sonnet 4.5 (OpenRouter - Tool Calling)';
const STORAGE_KEY = LLMSelectionPersistence.STORAGE_KEY;
const ORIGINAL_READY_STATE_DESCRIPTOR = Object.getOwnPropertyDescriptor(document, 'readyState');

jest.setTimeout(60000);

const flushMicrotasks = async (cycles = 5) => {
  for (let i = 0; i < cycles; i += 1) {
     
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const waitForCondition = async (checkFn, {
  timeout = 30000,
  interval = 50,
} = {}) => {
  const start = Date.now();
   
  while (true) {
    const result = await checkFn();
    if (result) {
      return result;
    }
    if (Date.now() - start > timeout) {
      throw new Error('Timed out waiting for condition to be met.');
    }
     
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

const sanitizePath = (input) => {
  if (!input) {
    return '';
  }
  const url = typeof input === 'string' ? input : input.url;
  const withoutQuery = url.split('?')[0].split('#')[0];
  return withoutQuery
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
};

const createFileResponse = async (identifier) => {
  const sanitized = sanitizePath(identifier);
  if (!sanitized) {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => {
        throw new Error('Missing resource');
      },
      text: async () => {
        throw new Error('Missing resource');
      },
    };
  }

  let resolvedPath = path.resolve(process.cwd(), sanitized);
  try {
    let content;
    try {
      content = await fs.readFile(resolvedPath, 'utf8');
    } catch (error) {
      if (resolvedPath.endsWith('mod-manifest.json')) {
        resolvedPath = resolvedPath.replace('mod-manifest.json', 'mod.manifest.json');
        content = await fs.readFile(resolvedPath, 'utf8');
      } else {
        throw error;
      }
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => JSON.parse(content),
      text: async () => content,
    };
  } catch (error) {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => {
        throw error;
      },
      text: async () => {
        throw error;
      },
    };
  }
};

const createFetchStub = (overrideHandler) => {
  const fetchMock = jest.fn(async (request) => {
    if (overrideHandler) {
      const override = await overrideHandler(request);
      if (override) {
        return override;
      }
    }
    return createFileResponse(request);
  });
  return fetchMock;
};

const setReadyState = (value) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => value,
  });
};

const restoreReadyState = () => {
  if (ORIGINAL_READY_STATE_DESCRIPTOR) {
    Object.defineProperty(document, 'readyState', ORIGINAL_READY_STATE_DESCRIPTOR);
  } else {
    delete document.readyState;
  }
};

const renderTraitsRewriterDom = ({ includeLlmIndicator = true } = {}) => {
  const llmIndicator = includeLlmIndicator
    ? `<div class="llm-status-bar"><strong id="active-llm-name">Loading...</strong></div>`
    : '';

  document.body.innerHTML = `
    <div id="app" class="cb-page-container">
      ${llmIndicator}
      <main id="main-content" class="cb-page-main traits-rewriter-main">
        <section>
          <textarea id="character-definition"></textarea>
          <div id="character-input-error"></div>
          <button id="rewrite-traits-button"></button>
          <button id="export-json-button"></button>
          <button id="export-text-button"></button>
          <button id="copy-traits-button"></button>
          <button id="clear-input-button"></button>
          <button id="retry-button"></button>
        </section>
        <section>
          <div id="generation-progress" style="display:none">
            <p class="progress-text"></p>
          </div>
          <div id="loading-state"></div>
          <div id="results-state"></div>
          <div id="error-state"></div>
          <div id="rewritten-traits-container"></div>
          <div id="generation-error" class="error-message"></div>
          <div id="empty-state"></div>
          <div id="character-name-display"></div>
          <div id="traits-sections"></div>
          <div id="screen-reader-announcement"></div>
        </section>
      </main>
      <div id="error-display"></div>
    </div>
  `;
};

describe('traits-rewriter-main entrypoint (integration)', () => {
  let originalFetch;
  let originalWindowFetch;
  let fetchMock;
  let bootstrapSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    localStorage.clear();
    setReadyState('complete');
    renderTraitsRewriterDom();
    if (typeof window !== 'undefined') {
      global.localStorage = window.localStorage;
    }

    fetchMock = createFetchStub();
    originalFetch = global.fetch;
    originalWindowFetch = typeof window !== 'undefined' ? window.fetch : undefined;
    global.fetch = fetchMock;
    if (typeof window !== 'undefined') {
      window.fetch = fetchMock;
    }

    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (bootstrapSpy) {
      bootstrapSpy.mockRestore();
      bootstrapSpy = null;
    }
    if (originalFetch) {
      global.fetch = originalFetch;
    }
    if (typeof window !== 'undefined') {
      window.fetch = originalWindowFetch;
    }
    restoreReadyState();
    document.body.innerHTML = '';
    jest.resetModules();
  });

  it('bootstraps with real modules and updates the active LLM display', async () => {
    await import(MODULE_PATH);

    const nameElement = document.getElementById('active-llm-name');
    const resolvedName = await waitForCondition(() => {
      const value = nameElement?.textContent ?? null;
      return value === DISPLAY_NAME ? value : null;
    });

    expect(resolvedName).toBe(DISPLAY_NAME);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('claude-sonnet-4.5');

    await waitForCondition(() =>
      console.info.mock.calls.some(([message]) => message === 'Traits Rewriter initialized successfully')
    );
  });

  it('defers initialization until DOMContentLoaded when the document is loading', async () => {
    setReadyState('loading');
    renderTraitsRewriterDom();
    await import(MODULE_PATH);

    const nameElement = document.getElementById('active-llm-name');
    expect(nameElement?.textContent).toBe('Loading...');

    document.dispatchEvent(new Event('DOMContentLoaded'));

    const resolvedName = await waitForCondition(() => {
      const value = nameElement?.textContent ?? null;
      return value === DISPLAY_NAME ? value : null;
    });

    expect(resolvedName).toBe(DISPLAY_NAME);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('claude-sonnet-4.5');
  });

  it('falls back to the default label when LLM initialization fails', async () => {
    const { CharacterBuilderBootstrap } = await import(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
    );
    const originalBootstrap = CharacterBuilderBootstrap.prototype.bootstrap;
    bootstrapSpy = jest
      .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
      .mockImplementation(async function wrappedBootstrap(config) {
        const result = await originalBootstrap.call(this, config);
        const originalResolve = result.container.resolve.bind(result.container);
        const llmAdapter = await originalResolve(tokens.LLMAdapter);
        jest
          .spyOn(llmAdapter, 'getCurrentActiveLlmId')
          .mockResolvedValue(null);
        jest
          .spyOn(llmAdapter, 'getAvailableLlmOptions')
          .mockResolvedValue([]);
        result.container.resolve = (token) =>
          token === tokens.LLMAdapter ? llmAdapter : originalResolve(token);
        return result;
      });

    await import(MODULE_PATH);

    const nameElement = document.getElementById('active-llm-name');
    const resolvedName = await waitForCondition(() => {
      const value = nameElement?.textContent ?? null;
      return value === 'Default LLM' ? value : null;
    });

    expect(resolvedName).toBe('Default LLM');
  });

  it('reports unknown status when the LLM adapter cannot be resolved', async () => {
    const { CharacterBuilderBootstrap } = await import(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
    );
    const originalBootstrap = CharacterBuilderBootstrap.prototype.bootstrap;
    bootstrapSpy = jest
      .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
      .mockImplementation(async function wrappedBootstrap(config) {
        const result = await originalBootstrap.call(this, config);
        const originalResolve = result.container.resolve.bind(result.container);
        result.container.resolve = (token) => {
          if (token === tokens.LLMAdapter) {
            throw new Error('Adapter missing');
          }
          return originalResolve(token);
        };
        return result;
      });

    await import(MODULE_PATH);

    const nameElement = document.getElementById('active-llm-name');
    const resolvedName = await waitForCondition(() => {
      const value = nameElement?.textContent ?? null;
      return value === 'Unknown' ? value : null;
    });

    expect(resolvedName).toBe('Unknown');

    await waitForCondition(() =>
      console.error.mock.calls.some(
        ([message]) => message === 'Failed to update LLM display'
      )
    );
  });

  it('renders an inline error message when bootstrap throws', async () => {
    const { CharacterBuilderBootstrap } = await import(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
    );
    bootstrapSpy = jest
      .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
      .mockImplementation(async () => {
        throw new Error('bootstrap failure');
      });

    await import(MODULE_PATH);
    await flushMicrotasks(6);

    const container = document.getElementById('rewritten-traits-container');
    expect(container?.innerHTML).toContain('Failed to initialize the application');
    expect(container?.innerHTML).toContain('bootstrap failure');
  });

  it('skips LLM display updates gracefully when the indicator element is missing', async () => {
    renderTraitsRewriterDom({ includeLlmIndicator: false });
    await import(MODULE_PATH);

    expect(document.getElementById('active-llm-name')).toBeNull();

    await waitForCondition(() =>
      console.info.mock.calls.some(([message]) => message === 'Traits Rewriter initialized successfully')
    );
  });
});
