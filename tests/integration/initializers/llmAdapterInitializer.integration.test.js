import { describe, it, expect, beforeEach } from '@jest/globals';
import LlmAdapterInitializer from '../../../src/initializers/services/llmAdapterInitializer.js';

class RecordingLogger {
  constructor() {
    this.messages = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(...args) {
    this.messages.debug.push(args);
  }

  info(...args) {
    this.messages.info.push(args);
  }

  warn(...args) {
    this.messages.warn.push(args);
  }

  error(...args) {
    this.messages.error.push(args);
  }

  has(level, text) {
    return this.messages[level].some((entry) =>
      entry.some(
        (value) => typeof value === 'string' && value.includes(text)
      )
    );
  }
}

class StubConfigLoader {
  constructor({ data = { defaultConfigId: 'test' }, throwOnLoad = false } = {}) {
    this.data = data;
    this.throwOnLoad = throwOnLoad;
    this.loadCalls = 0;
  }

  async loadConfigs() {
    this.loadCalls += 1;
    if (this.throwOnLoad) {
      throw new Error('config load failure');
    }
    return this.data;
  }
}

/**
 *
 * @param root0
 * @param root0.initiallyInitialized
 * @param root0.initialOperational
 * @param root0.operationalAfterInit
 * @param root0.provideOperational
 * @param root0.initThrows
 */
function createAdapter({
  initiallyInitialized = false,
  initialOperational = true,
  operationalAfterInit = true,
  provideOperational = true,
  initThrows,
} = {}) {
  const state = {
    initCalls: 0,
    initialized: initiallyInitialized,
    operational: initialOperational,
    loadedConfigs: null,
  };

  const adapter = {
    state,
    async init({ llmConfigLoader }) {
      state.initCalls += 1;
      if (llmConfigLoader && typeof llmConfigLoader.loadConfigs === 'function') {
        state.loadedConfigs = await llmConfigLoader.loadConfigs();
      }
      if (initThrows) {
        throw new Error(initThrows);
      }
      state.initialized = true;
      state.operational = operationalAfterInit;
    },
    isInitialized: () => state.initialized,
  };

  if (provideOperational) {
    adapter.isOperational = () => state.operational;
  }

  return adapter;
}

describe('LlmAdapterInitializer integration', () => {
  let initializer;
  let logger;

  beforeEach(() => {
    initializer = new LlmAdapterInitializer();
    logger = new RecordingLogger();
  });

  it('logs an error when no adapter is provided', async () => {
    const loader = new StubConfigLoader();
    const result = await initializer.initialize(null, loader, logger);

    expect(result).toBe(false);
    expect(logger.has('error', 'No ILLMAdapter provided')).toBe(true);
  });

  it('requires the adapter to expose an init method', async () => {
    const adapter = { isInitialized: () => false };
    const loader = new StubConfigLoader();

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(false);
    expect(logger.has('error', 'missing required init() method')).toBe(true);
  });

  it('skips initialization when the adapter is already operational', async () => {
    const adapter = createAdapter({
      initiallyInitialized: true,
      initialOperational: true,
      operationalAfterInit: true,
    });
    const loader = new StubConfigLoader();

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(true);
    expect(adapter.state.initCalls).toBe(0);
    expect(
      logger.has('debug', 'ConfigurableLLMAdapter already initialized. Skipping')
    ).toBe(true);
  });

  it('warns when an already initialized adapter reports non-operational status', async () => {
    const adapter = createAdapter({
      initiallyInitialized: true,
      initialOperational: false,
      operationalAfterInit: false,
    });
    const loader = new StubConfigLoader();

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(false);
    expect(
      logger.has('warn', 'already initialized but not operational')
    ).toBe(true);
  });

  it('acknowledges pre-initialized adapters that lack an operational check', async () => {
    const adapter = createAdapter({
      initiallyInitialized: true,
      provideOperational: false,
    });
    const loader = new StubConfigLoader();

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(true);
    expect(adapter.state.initCalls).toBe(0);
    expect(
      logger.has('debug', 'already initialized (no operational check available)')
    ).toBe(true);
  });

  it('requires a valid configuration loader before invoking adapter.init', async () => {
    const adapter = createAdapter();

    const result = await initializer.initialize(adapter, {}, logger);

    expect(result).toBe(false);
    expect(adapter.state.initCalls).toBe(0);
    expect(
      logger.has('error', 'LlmConfigLoader missing or invalid')
    ).toBe(true);
  });

  it('initializes the adapter with configuration data when dependencies are valid', async () => {
    const adapter = createAdapter({ operationalAfterInit: true });
    const loader = new StubConfigLoader({ data: { defaultConfigId: 'alpha' } });

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(true);
    expect(adapter.state.initCalls).toBe(1);
    expect(loader.loadCalls).toBe(1);
    expect(adapter.state.loadedConfigs).toEqual({ defaultConfigId: 'alpha' });
    expect(
      logger.has(
        'debug',
        'ConfigurableLLMAdapter initialized successfully and is operational'
      )
    ).toBe(true);
  });

  it('warns when initialization completes but the adapter is not operational', async () => {
    const adapter = createAdapter({ operationalAfterInit: false });
    const loader = new StubConfigLoader();

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(false);
    expect(adapter.state.initCalls).toBe(1);
    expect(
      logger.has(
        'warn',
        'ConfigurableLLMAdapter.init() completed but the adapter is not operational'
      )
    ).toBe(true);
  });

  it('treats adapters without an operational check as successful after init', async () => {
    const adapter = createAdapter({
      operationalAfterInit: true,
      provideOperational: false,
    });
    const loader = new StubConfigLoader();

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(true);
    expect(adapter.state.initCalls).toBe(1);
    expect(
      logger.has(
        'debug',
        'ConfigurableLLMAdapter initialized (no operational check available)'
      )
    ).toBe(true);
  });

  it('logs a critical error when adapter initialization throws', async () => {
    const adapter = createAdapter({ initThrows: 'boom failure' });
    const loader = new StubConfigLoader();

    const result = await initializer.initialize(adapter, loader, logger);

    expect(result).toBe(false);
    expect(adapter.state.initCalls).toBe(1);
    expect(
      logger.has('error', 'CRITICAL error during ConfigurableLLMAdapter.init()')
    ).toBe(true);
  });
});
