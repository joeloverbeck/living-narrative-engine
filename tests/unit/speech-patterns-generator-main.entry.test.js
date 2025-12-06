import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { tokens } from '../../src/dependencyInjection/tokens.js';

const MODULE_PATH = '../../src/speech-patterns-generator-main.js';
const BOOTSTRAP_PATH =
  '../../src/characterBuilder/CharacterBuilderBootstrap.js';
const CONTROLLER_PATH =
  '../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js';

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

describe('speech-patterns-generator-main entrypoint', () => {
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
      SpeechPatternsGeneratorController: jest.fn(),
    }));
    return bootstrapMock;
  };

  const createDomElements = () => {
    document.body.innerHTML = `
      <div id="speech-patterns-container"></div>
      <span id="active-llm-name"></span>
    `;
    return {
      nameElement: document.getElementById('active-llm-name'),
      errorContainer: document.getElementById('speech-patterns-container'),
    };
  };

  it('updates the LLM display after deferred initialization', async () => {
    setReadyState('loading');
    const { nameElement } = createDomElements();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue('llm-1'),
      getAvailableLlmOptions: jest
        .fn()
        .mockResolvedValue([
          { configId: 'llm-1', displayName: 'Friendly LLM' },
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
    expect(llmAdapter.getAvailableLlmOptions).toHaveBeenCalled();
    expect(nameElement.textContent).toBe('Friendly LLM');
  });

  it('initializes immediately when the DOM is ready', async () => {
    setReadyState('complete');
    const { nameElement } = createDomElements();

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue('llm-2'),
      getAvailableLlmOptions: jest
        .fn()
        .mockResolvedValue([{ configId: 'llm-2', displayName: 'Chatty LLM' }]),
    };

    const container = { resolve: jest.fn().mockReturnValue(llmAdapter) };

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

  it('falls back to the LLM identifier when no matching option exists', async () => {
    setReadyState('loading');
    const { nameElement } = createDomElements();
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue('llm-3'),
      getAvailableLlmOptions: jest
        .fn()
        .mockResolvedValue([{ configId: 'other' }]),
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

    expect(nameElement.textContent).toBe('llm-3');
  });

  it('uses a default label when no active LLM is configured', async () => {
    setReadyState('loading');
    const { nameElement } = createDomElements();
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

  it('logs adapter errors and marks the display as unknown', async () => {
    setReadyState('loading');
    const { nameElement } = createDomElements();
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

  it('shows an inline error message when bootstrap fails', async () => {
    setReadyState('loading');
    const { errorContainer } = createDomElements();
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
      'Failed to initialize Speech Patterns Generator:',
      failure
    );
    expect(errorContainer.innerHTML).toContain(
      'Failed to initialize the application'
    );
    expect(errorContainer.innerHTML).toContain(failure.message);
  });
});
