import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const MODULE_PATH = '../../../src/speech-patterns-generator-main.js';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const importEntrypointWithForcedAutoInit = async () => import(MODULE_PATH);

describe('speech-patterns-generator main entrypoint integration', () => {
  let readyStateValue;
  let originalReadyDescriptor;
  let tokensRef;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <div id="speech-patterns-container"></div>
      <span id="active-llm-name"></span>
    `;
    readyStateValue = 'complete';
    tokensRef = null;

    originalReadyDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyStateValue,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';

    if (originalReadyDescriptor) {
      Object.defineProperty(document, 'readyState', originalReadyDescriptor);
    } else {
      delete document.readyState;
    }
  });

  it('initializes immediately when DOM is ready and shows the configured LLM display name', async () => {
    readyStateValue = 'complete';
    const consoleInfoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    let bootstrapSpy;
    let llmAdapter;
    let container;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { SpeechPatternsGeneratorController } = await import(
        '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js'
      );
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      tokensRef = tokens;

      llmAdapter = {
        getCurrentActiveLlmId: jest.fn().mockResolvedValue('integration-llm'),
        getAvailableLlmOptions: jest
          .fn()
          .mockResolvedValue([
            { configId: 'integration-llm', displayName: 'Integration Friendly LLM' },
          ]),
      };

      container = {
        resolve: jest.fn((token) =>
          token === tokens.LLMAdapter ? llmAdapter : undefined
        ),
      };

      bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockImplementation(async (config) => {
          expect(config.pageName).toBe('Speech Patterns Generator');
          expect(config.controllerClass).toBe(
            SpeechPatternsGeneratorController
          );
          expect(config.includeModLoading).toBe(true);
          return { controller: { id: 'controller' }, container, bootstrapTime: 7 };
        });

      await importEntrypointWithForcedAutoInit();
    });

    await flushPromises();

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(container.resolve).toHaveBeenCalledWith(tokensRef.LLMAdapter);
    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(llmAdapter.getAvailableLlmOptions).toHaveBeenCalledTimes(1);
    expect(document.getElementById('active-llm-name').textContent).toBe(
      'Integration Friendly LLM'
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'Speech Patterns Generator initialized successfully'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('waits for DOMContentLoaded when the document is still loading and falls back to the default label when no active LLM exists', async () => {
    readyStateValue = 'loading';
    const consoleInfoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    let bootstrapSpy;
    let llmAdapter;
    let container;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { SpeechPatternsGeneratorController } = await import(
        '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js'
      );
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      tokensRef = tokens;

      llmAdapter = {
        getCurrentActiveLlmId: jest.fn().mockResolvedValue(null),
        getAvailableLlmOptions: jest.fn(),
      };

      container = {
        resolve: jest.fn((token) =>
          token === tokens.LLMAdapter ? llmAdapter : undefined
        ),
      };

      bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockResolvedValue({
          controller: { id: 'controller' },
          container,
          bootstrapTime: 11,
        });

      await importEntrypointWithForcedAutoInit();
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const handler = addEventListenerSpy.mock.calls[0][1];
    await handler();
    await flushPromises();

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(container.resolve).toHaveBeenCalledWith(tokensRef.LLMAdapter);
    expect(llmAdapter.getAvailableLlmOptions).not.toHaveBeenCalled();
    expect(document.getElementById('active-llm-name').textContent).toBe(
      'Default LLM'
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'Speech Patterns Generator initialized successfully'
    );
  });

  it('falls back to the raw identifier when no matching LLM metadata is available', async () => {
    readyStateValue = 'complete';
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    let llmAdapter;
    let container;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { SpeechPatternsGeneratorController } = await import(
        '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js'
      );
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      tokensRef = tokens;

      llmAdapter = {
        getCurrentActiveLlmId: jest.fn().mockResolvedValue('mystery-llm'),
        getAvailableLlmOptions: jest.fn().mockResolvedValue([
          { configId: 'another-llm', displayName: 'Another' },
        ]),
      };

      container = {
        resolve: jest.fn((token) =>
          token === tokens.LLMAdapter ? llmAdapter : undefined
        ),
      };

      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockResolvedValue({
          controller: { id: 'controller' },
          container,
          bootstrapTime: 9,
        });

      await importEntrypointWithForcedAutoInit();
    });

    await flushPromises();

    expect(document.getElementById('active-llm-name').textContent).toBe(
      'mystery-llm'
    );
    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(llmAdapter.getAvailableLlmOptions).toHaveBeenCalledTimes(1);
  });

  it('uses the LLM identifier when the metadata omits a display name', async () => {
    readyStateValue = 'complete';
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    let llmAdapter;
    let container;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { SpeechPatternsGeneratorController } = await import(
        '../../../src/characterBuilder/controllers/SpeechPatternsGeneratorController.js'
      );
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      tokensRef = tokens;

      llmAdapter = {
        getCurrentActiveLlmId: jest.fn().mockResolvedValue('llm-without-name'),
        getAvailableLlmOptions: jest.fn().mockResolvedValue([
          { configId: 'llm-without-name', displayName: '' },
        ]),
      };

      container = {
        resolve: jest.fn((token) =>
          token === tokens.LLMAdapter ? llmAdapter : undefined
        ),
      };

      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockResolvedValue({
          controller: { id: 'controller' },
          container,
          bootstrapTime: 10,
        });

      await importEntrypointWithForcedAutoInit();
    });

    await flushPromises();

    expect(document.getElementById('active-llm-name').textContent).toBe(
      'llm-without-name'
    );
    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(llmAdapter.getAvailableLlmOptions).toHaveBeenCalledTimes(1);
  });

  it('skips LLM resolution entirely when the display element is missing', async () => {
    document.body.innerHTML = '<div id="speech-patterns-container"></div>';
    readyStateValue = 'complete';
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    let llmAdapter;
    let container;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      tokensRef = tokens;

      llmAdapter = {
        getCurrentActiveLlmId: jest.fn(),
        getAvailableLlmOptions: jest.fn(),
      };

      container = {
        resolve: jest.fn((token) =>
          token === tokens.LLMAdapter ? llmAdapter : undefined
        ),
      };

      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockResolvedValue({
          controller: { id: 'controller' },
          container,
          bootstrapTime: 5,
        });

      await importEntrypointWithForcedAutoInit();
    });

    await flushPromises();

    expect(container.resolve).not.toHaveBeenCalled();
    expect(llmAdapter.getCurrentActiveLlmId).not.toHaveBeenCalled();
    expect(llmAdapter.getAvailableLlmOptions).not.toHaveBeenCalled();
  });

  it('logs an error and shows an unknown status when the LLM adapter throws', async () => {
    readyStateValue = 'complete';
    const failure = new Error('LLM adapter unavailable');
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    let llmAdapter;
    let container;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      tokensRef = tokens;

      llmAdapter = {
        getCurrentActiveLlmId: jest.fn().mockRejectedValue(failure),
        getAvailableLlmOptions: jest.fn(),
      };

      container = {
        resolve: jest.fn((token) =>
          token === tokens.LLMAdapter ? llmAdapter : undefined
        ),
      };

      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockResolvedValue({
          controller: { id: 'controller' },
          container,
          bootstrapTime: 6,
        });

      await importEntrypointWithForcedAutoInit();
    });

    await flushPromises();

    expect(document.getElementById('active-llm-name').textContent).toBe(
      'Unknown'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update LLM display',
      failure
    );
    expect(llmAdapter.getAvailableLlmOptions).not.toHaveBeenCalled();
  });

  it('renders a user-facing error when bootstrap fails', async () => {
    readyStateValue = 'complete';
    const failure = new Error('bootstrap explosion');
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );

      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockRejectedValue(failure);

      await importEntrypointWithForcedAutoInit();
    });

    await flushPromises();

    const container = document.getElementById('speech-patterns-container');
    expect(container.innerHTML).toContain(
      'Failed to initialize the application'
    );
    expect(container.innerHTML).toContain(failure.message);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize Speech Patterns Generator:',
      failure
    );
  });

  it('still logs initialization failures when no container element is present', async () => {
    document.body.innerHTML = '';
    readyStateValue = 'complete';
    jest.spyOn(console, 'info').mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const failure = new Error('bootstrap missing container');

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );

      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockRejectedValue(failure);

      await importEntrypointWithForcedAutoInit();
    });

    await flushPromises();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize Speech Patterns Generator:',
      failure
    );
    expect(document.body.innerHTML).toBe('');
  });
});
