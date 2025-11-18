import { describe, it, expect, beforeEach } from '@jest/globals';
import { ClientApiKeyProvider } from '../../../src/llms/clientApiKeyProvider.js';
import { EnvironmentContext } from '../../../src/llms/environmentContext.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

/**
 * Minimal logger that satisfies ILogger and records calls for assertions.
 */
class TestLogger {
  constructor() {
    this.calls = { debug: [], info: [], warn: [], error: [] };
  }

  debug(message, context) {
    this.calls.debug.push({ message, context });
  }

  info(message, context) {
    this.calls.info.push({ message, context });
  }

  warn(message, context) {
    this.calls.warn.push({ message, context });
  }

  error(message, context) {
    this.calls.error.push({ message, context });
  }
}

/**
 * Schema validator stub that fulfills the interface expected by ValidatedEventDispatcher.
 */
class PassthroughSchemaValidator {
  isSchemaLoaded() {
    return false;
  }

  validate() {
    return { isValid: true, errors: [] };
  }

  addSchema() {}
  addSchemas() {}
  removeSchema() {}
  getLoadedSchemaIds() {
    return [];
  }
}

/**
 *
 */
function createInfrastructure() {
  const logger = new TestLogger();
  const eventBus = new EventBus({ logger });
  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new PassthroughSchemaValidator();
  const validatedDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher: validatedDispatcher,
    logger,
  });

  const dispatchedEvents = [];
  eventBus.subscribe(SYSTEM_ERROR_OCCURRED_ID, (event) => {
    dispatchedEvents.push(event);
  });

  return { logger, safeDispatcher, dispatchedEvents };
}

describe('ClientApiKeyProvider integration with real event infrastructure', () => {
  /** @type {ReturnType<typeof createInfrastructure>} */
  let infra;

  beforeEach(() => {
    infra = createInfrastructure();
  });

  /**
   *
   * @param overrides
   */
  function createClientContext(overrides = {}) {
    return new EnvironmentContext({
      logger: infra.logger,
      executionEnvironment: 'client',
      proxyServerUrl: 'http://localhost:7070/proxy',
      ...overrides,
    });
  }

  /**
   *
   * @param overrides
   */
  function createServerContext(overrides = {}) {
    return new EnvironmentContext({
      logger: infra.logger,
      executionEnvironment: 'server',
      projectRootPath: '/tmp/project-root',
      ...overrides,
    });
  }

  it('validates constructor dependencies and throws when dispatcher is missing dispatch', () => {
    expect(
      () =>
        new ClientApiKeyProvider({
          logger: infra.logger,
          safeEventDispatcher: /** @type {any} */ ({}),
        })
    ).toThrow(/safeEventDispatcher/);
  });

  it('dispatches error and throws when environment context is invalid', async () => {
    const provider = new ClientApiKeyProvider({
      logger: infra.logger,
      safeEventDispatcher: infra.safeDispatcher,
    });

    await expect(
      provider.getKey({ configId: 'demo', apiType: 'openai', promptElements: [], promptAssemblyOrder: [] }, /** @type {any} */ ({}))
    ).rejects.toThrow(/Invalid environmentContext/);

    await new Promise((resolve) => setImmediate(resolve));

    expect(infra.dispatchedEvents).toHaveLength(1);
    expect(infra.dispatchedEvents[0]).toMatchObject({
      type: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message: expect.stringContaining('Invalid environmentContext'),
      },
    });
  });

  it('warns and returns null when invoked in a server environment', async () => {
    const provider = new ClientApiKeyProvider({
      logger: infra.logger,
      safeEventDispatcher: infra.safeDispatcher,
    });

    const key = await provider.getKey(
      {
        configId: 'demo',
        modelIdentifier: 'gpt',
        apiType: 'openai',
        promptElements: [],
        promptAssemblyOrder: [],
      },
      createServerContext()
    );

    expect(key).toBeNull();
    expect(infra.logger.calls.warn.some(({ message }) => message.includes('non-client environment'))).toBe(true);
    expect(infra.dispatchedEvents).toHaveLength(0);
  });

  it('dispatches error when llmConfig is missing for a client environment', async () => {
    const provider = new ClientApiKeyProvider({
      logger: infra.logger,
      safeEventDispatcher: infra.safeDispatcher,
    });

    const key = await provider.getKey(null, createClientContext());

    await new Promise((resolve) => setImmediate(resolve));

    expect(key).toBeNull();
    expect(infra.dispatchedEvents).toHaveLength(1);
    expect(infra.dispatchedEvents[0].payload).toMatchObject({
      message: expect.stringContaining('llmConfig is null or undefined'),
    });
  });

  it('reports configuration issues when cloud apiType lacks key identifiers', async () => {
    const provider = new ClientApiKeyProvider({
      logger: infra.logger,
      safeEventDispatcher: infra.safeDispatcher,
    });

    const key = await provider.getKey(
      {
        configId: 'cloud-demo',
        modelIdentifier: 'gpt-4',
        apiType: 'openai',
        promptElements: [],
        promptAssemblyOrder: [],
      },
      createClientContext()
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(key).toBeNull();
    expect(infra.dispatchedEvents).toHaveLength(1);
    expect(infra.dispatchedEvents[0].payload.details).toMatchObject({ apiType: 'openai' });
  });

  it('passes validation when cloud apiType contains key identifiers', async () => {
    const provider = new ClientApiKeyProvider({
      logger: infra.logger,
      safeEventDispatcher: infra.safeDispatcher,
    });

    const key = await provider.getKey(
      {
        configId: 'cloud-demo',
        modelIdentifier: 'gpt-4',
        apiType: 'openai',
        apiKeyEnvVar: 'OPENAI_KEY',
        promptElements: [],
        promptAssemblyOrder: [],
      },
      createClientContext()
    );

    expect(key).toBeNull();
    expect(infra.dispatchedEvents).toHaveLength(0);
    expect(
      infra.logger.calls.debug.some(({ message }) =>
        message.includes("has required key identifier(s)")
      )
    ).toBe(true);
  });

  it('logs informative message when apiType is non-cloud', async () => {
    const provider = new ClientApiKeyProvider({
      logger: infra.logger,
      safeEventDispatcher: infra.safeDispatcher,
    });

    const key = await provider.getKey(
      {
        configId: 'local-model',
        modelIdentifier: 'local',
        apiType: 'custom-local',
        promptElements: [],
        promptAssemblyOrder: [],
      },
      createClientContext()
    );

    expect(key).toBeNull();
    expect(
      infra.logger.calls.debug.some(({ message }) =>
        message.includes("is not listed as a cloud service")
      )
    ).toBe(true);
  });

  it('logs when apiType is missing or invalid', async () => {
    const provider = new ClientApiKeyProvider({
      logger: infra.logger,
      safeEventDispatcher: infra.safeDispatcher,
    });

    const key = await provider.getKey(
      {
        configId: 'unknown-type',
        modelIdentifier: 'mystery',
        promptElements: [],
        promptAssemblyOrder: [],
      },
      createClientContext()
    );

    expect(key).toBeNull();
    expect(
      infra.logger.calls.debug.some(({ message }) =>
        message.includes('apiType is missing or not a string')
      )
    ).toBe(true);
  });
});
