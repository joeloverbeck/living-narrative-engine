import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { tokens } from '../../src/dependencyInjection/tokens.js';

const MODULE_PATH = '../../src/traits-rewriter-main.js';
const BOOTSTRAP_PATH =
  '../../src/characterBuilder/CharacterBuilderBootstrap.js';
const CONTROLLER_PATH =
  '../../src/characterBuilder/controllers/TraitsRewriterController.js';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const originalReadyState = document.readyState;

const setReadyState = (value) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value,
  });
};

const restoreReadyState = () => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: originalReadyState,
  });
};

describe('traits-rewriter-main entrypoint', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreReadyState();
    document.body.innerHTML = '';
  });

  const mockBootstrapModule = (impl) => {
    const bootstrapMock = jest.fn(impl);
    jest.doMock(BOOTSTRAP_PATH, () => ({
      CharacterBuilderBootstrap: jest.fn().mockImplementation(() => ({
        bootstrap: bootstrapMock,
      })),
    }));
    jest.doMock(CONTROLLER_PATH, () => ({
      TraitsRewriterController: jest.fn(),
    }));
    return bootstrapMock;
  };

  const createLlMElements = () => {
    document.body.innerHTML = `
      <div id="rewritten-traits-container"></div>
      <span id="active-llm-name"></span>
    `;
    return {
      nameElement: document.getElementById('active-llm-name'),
      errorContainer: document.getElementById('rewritten-traits-container'),
    };
  };

  it('updates the LLM display when initialization succeeds', async () => {
    setReadyState('loading');
    const { nameElement } = createLlMElements();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue('llm-123'),
      getAvailableLlmOptions: jest
        .fn()
        .mockResolvedValue([
          { configId: 'llm-123', displayName: 'Friendly LLM' },
        ]),
    };

    const container = {
      resolve: jest.fn((token) => {
        expect(token).toBe(tokens.LLMAdapter);
        return llmAdapter;
      }),
    };

    mockBootstrapModule(async (config) => {
      config.hooks?.postInit?.({ id: 'controller' });
      return { controller: { id: 'controller' }, container };
    });

    await jest.isolateModulesAsync(async () => {
      await import(MODULE_PATH);
    });

    const handler = addEventListenerSpy.mock.calls[0][1];
    await handler();

    expect(container.resolve).toHaveBeenCalledWith(tokens.LLMAdapter);
    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalled();
    expect(llmAdapter.getAvailableLlmOptions).toHaveBeenCalled();
    expect(nameElement.textContent).toBe('Friendly LLM');
  });

  it('falls back to displaying the LLM identifier when no option match is found', async () => {
    setReadyState('loading');
    const { nameElement } = createLlMElements();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue('llm-456'),
      getAvailableLlmOptions: jest
        .fn()
        .mockResolvedValue([{ configId: 'other' }]),
    };

    const container = {
      resolve: jest.fn().mockReturnValue(llmAdapter),
    };

    mockBootstrapModule(async (config) => {
      config.hooks?.postInit?.({ id: 'controller' });
      return { controller: { id: 'controller' }, container };
    });

    await jest.isolateModulesAsync(async () => {
      await import(MODULE_PATH);
    });

    const handler = addEventListenerSpy.mock.calls[0][1];
    await handler();

    expect(nameElement.textContent).toBe('llm-456');
  });

  it('displays a default label when no LLM is active', async () => {
    setReadyState('loading');
    const { nameElement } = createLlMElements();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue(null),
      getAvailableLlmOptions: jest.fn().mockResolvedValue([]),
    };

    const container = { resolve: jest.fn().mockReturnValue(llmAdapter) };

    mockBootstrapModule(async (config) => {
      config.hooks?.postInit?.({ id: 'controller' });
      return { controller: { id: 'controller' }, container };
    });

    await jest.isolateModulesAsync(async () => {
      await import(MODULE_PATH);
    });

    const handler = addEventListenerSpy.mock.calls[0][1];
    await handler();

    expect(nameElement.textContent).toBe('Default LLM');
  });

  it('initializes immediately when the DOM is already ready', async () => {
    setReadyState('complete');
    const { nameElement } = createLlMElements();

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue('immediate-llm'),
      getAvailableLlmOptions: jest
        .fn()
        .mockResolvedValue([
          { configId: 'immediate-llm', displayName: 'Chatty LLM' },
        ]),
    };

    const container = {
      resolve: jest.fn().mockReturnValue(llmAdapter),
    };

    mockBootstrapModule(async (config) => {
      config.hooks?.postInit?.({ id: 'controller' });
      return { controller: { id: 'controller' }, container };
    });

    await jest.isolateModulesAsync(async () => {
      await import(MODULE_PATH);
    });

    await flushPromises();

    expect(container.resolve).toHaveBeenCalledWith(tokens.LLMAdapter);
    expect(nameElement.textContent).toBe('Chatty LLM');
  });

  it('logs errors and marks the LLM display as unknown when adapter calls fail', async () => {
    setReadyState('loading');
    const { nameElement } = createLlMElements();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const failure = new Error('adapter failure');
    const container = {
      resolve: jest.fn(() => {
        throw failure;
      }),
    };

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockBootstrapModule(async (config) => {
      config.hooks?.postInit?.({ id: 'controller' });
      return { controller: { id: 'controller' }, container };
    });

    await jest.isolateModulesAsync(async () => {
      await import(MODULE_PATH);
    });

    const handler = addEventListenerSpy.mock.calls[0][1];
    await handler();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to update LLM display',
      failure
    );
    expect(nameElement.textContent).toBe('Unknown');
  });

  it('renders an inline error message when initialization fails', async () => {
    setReadyState('loading');
    const { errorContainer } = createLlMElements();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const failure = new Error('bootstrap failure');

    mockBootstrapModule(async () => {
      throw failure;
    });

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      await import(MODULE_PATH);
    });

    const handler = addEventListenerSpy.mock.calls[0][1];
    await handler();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to initialize Traits Rewriter:',
      failure
    );
    expect(errorContainer.innerHTML).toContain(
      'Failed to initialize the application'
    );
    expect(errorContainer.innerHTML).toContain(failure.message);
  });
});
