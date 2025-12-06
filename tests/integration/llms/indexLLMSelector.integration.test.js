import fs from 'fs/promises';
import path from 'path';

const ORIGINAL_READY_STATE_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  document,
  'readyState'
);
const ORIGINAL_FETCH = global.fetch;

const waitFor = async (checkFn, { timeout = 15000, interval = 50 } = {}) => {
  const start = Date.now();

  while (true) {
    try {
      const result = await checkFn();
      if (result !== false) {
        return result;
      }
    } catch (error) {
      if (Date.now() - start >= timeout) {
        throw error;
      }
    }
    if (Date.now() - start >= timeout) {
      throw new Error('waitFor timeout exceeded');
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }
};

const setDocumentReadyState = (value) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => value,
  });
};

const restoreDocumentReadyState = () => {
  if (ORIGINAL_READY_STATE_DESCRIPTOR) {
    Object.defineProperty(
      document,
      'readyState',
      ORIGINAL_READY_STATE_DESCRIPTOR
    );
  } else {
    delete document.readyState;
  }
};

const sanitizePath = (rawPath) => {
  const withoutQuery = rawPath.split('?')[0];
  const withoutOrigin = withoutQuery.replace(/^https?:\/\/[^/]+/i, '');
  const normalized = withoutOrigin.replace(/^\.\//, '').replace(/^\//, '');
  return normalized;
};

const createFetchStub = (overrides = {}) =>
  jest.fn(async (resource) => {
    const url = typeof resource === 'string' ? resource : resource?.url;
    if (!url) {
      throw new Error('Test fetch stub received an invalid resource.');
    }
    if (overrides[url]) {
      return overrides[url]();
    }
    const relativePath = sanitizePath(url);
    if (overrides[relativePath]) {
      return overrides[relativePath]();
    }
    const absolutePath = path.join(process.cwd(), relativePath);
    try {
      const data = await fs.readFile(absolutePath, 'utf8');
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(data),
        text: async () => data,
      };
    } catch (error) {
      throw new Error(
        `Test fetch stub could not load '${url}' (resolved to '${absolutePath}'): ${error.message}`
      );
    }
  });

jest.setTimeout(60000);

describe('index-llm-selector integration', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <div id="llm-selection-modal" style="display: block"></div>
      <span id="current-llm-name">Loading...</span>
    `;
  });

  afterEach(() => {
    restoreDocumentReadyState();
    if (ORIGINAL_FETCH) {
      global.fetch = ORIGINAL_FETCH;
    } else {
      delete global.fetch;
    }
    document.body.innerHTML = '';
  });

  it('initializes the selector and refreshes display when the modal closes', async () => {
    setDocumentReadyState('loading');

    const fetchStub = createFetchStub();
    global.fetch = fetchStub;

    await import('../../../src/index-llm-selector.js');

    document.dispatchEvent(new Event('DOMContentLoaded'));

    const llmNameElement = document.getElementById('current-llm-name');
    expect(llmNameElement).not.toBeNull();

    const expectedName = await waitFor(() => {
      const content = llmNameElement.textContent;
      if (content && content !== 'Loading...' && content !== 'Error loading') {
        return content;
      }
      throw new Error('LLM name display has not updated yet');
    });

    // Simulate a stale value before closing the modal to ensure the observer triggers an update.
    llmNameElement.textContent = 'Stale Value';
    const modal = document.getElementById('llm-selection-modal');
    modal.style.display = 'block';
    modal.style.display = 'none';

    await waitFor(() => {
      const content = llmNameElement.textContent;
      if (content && content === expectedName) {
        return true;
      }
      throw new Error('LLM name was not refreshed after modal close');
    });

    expect(fetchStub).toHaveBeenCalled();
  });

  it('initializes immediately when the DOM is already ready', async () => {
    setDocumentReadyState('complete');

    // Remove the modal element to cover the branch where the observer is not registered.
    document.body.innerHTML = '<span id="current-llm-name">Loading...</span>';

    const fetchStub = createFetchStub();
    global.fetch = fetchStub;

    await import('../../../src/index-llm-selector.js');

    const llmNameElement = document.getElementById('current-llm-name');
    expect(llmNameElement).not.toBeNull();

    await waitFor(() => {
      const content = llmNameElement.textContent;
      if (content && content !== 'Loading...' && content !== 'Error loading') {
        return true;
      }
      throw new Error('Immediate initialization did not update display yet');
    });

    expect(fetchStub).toHaveBeenCalled();
  });
});
