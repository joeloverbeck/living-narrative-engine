// src/dependencyInjection/registrations/adapterRegistrations.js
// --- FILE START ---
/* eslint-env node */

/**
 * @file Registers port adapter implementations with the DI container,
 * including the ConfigurableLLMAdapter and its dependencies.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../turns/ports/ICommandInputPort.js').ICommandInputPort} ICommandInputPort */
/** @typedef {import('../../turns/ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../turns/ports/ITurnEndPort.js').ITurnEndPort} ITurnEndPort */
/** @typedef {import('../../turns/interfaces/ILLMAdapter.js').ILLMAdapter} ILLMAdapter */
/** @typedef {import('../../llms/interfaces/IApiKeyProvider.js').IApiKeyProvider} IApiKeyProvider */
/** @typedef {import('../../llms/interfaces/IHttpClient.js').IHttpClient} IHttpClient */
// IFileSystemReader and IEnvironmentVariableReader are no longer needed here as they were server-specific
// /** @typedef {import('../../../interfaces/IServerUtils.js').IFileSystemReader} IFileSystemReader */
// /** @typedef {import('../../../interfaces/IServerUtils.js').IEnvironmentVariableReader} IEnvironmentVariableReader */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { SHUTDOWNABLE } from '../tags.js';

// --- Standard Adapter Imports ---
import { EventBusCommandInputGateway } from '../../turns/adapters/eventBusCommandInputGateway.js';
import { EventBusPromptAdapter } from '../../turns/adapters/eventBusPromptAdapter.js';
import EventBusTurnEndAdapter from '../../turns/adapters/eventBusTurnEndAdapter.js';

// --- New LLM Related Imports ---
import { ConfigurableLLMAdapter } from '../../turns/adapters/configurableLLMAdapter.js';
import { EnvironmentContext } from '../../llms/environmentContext.js';
// NodeFileSystemReader, ProcessEnvReader, ServerApiKeyProvider are removed as they are server-specific
import { ClientApiKeyProvider } from '../../llms/clientApiKeyProvider.js';
import { RetryHttpClient } from '../../llms/retryHttpClient.js';
import { LLMStrategyFactory } from '../../llms/LLMStrategyFactory.js';
// LlmConfigLoader import is removed here as it's not directly instantiated in this file anymore
// for the adapter's immediate initialization. It will be needed by the code that calls init().
// import {LlmConfigLoader} from '../../llms/services/llmConfigLoader.js';

/**
 * Registers the default port adapters and the ConfigurableLLMAdapter with its dependencies
 * for a client-side environment.
 *
 * @param {AppContainer} container - The application's DI container.
 */
export function registerAdapters(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.info('Adapter Registrations: Starting...');

  // --- Register EventBusCommandInputGateway ---
  registrar
    .tagged(SHUTDOWNABLE)
    .singletonFactory(tokens.ICommandInputPort, (c) => {
      const ved = /** @type {IValidatedEventDispatcher} */ (
        c.resolve(tokens.IValidatedEventDispatcher)
      );
      if (!ved) {
        logger.error(
          `Adapter Registration: Failed to resolve ${tokens.IValidatedEventDispatcher} for ${tokens.ICommandInputPort}.`
        );
        throw new Error(
          `Missing dependency ${tokens.IValidatedEventDispatcher} for EventBusCommandInputGateway`
        );
      }
      return new EventBusCommandInputGateway({ validatedEventDispatcher: ved });
    });
  logger.debug(
    `Adapter Registration: Registered EventBusCommandInputGateway as ${tokens.ICommandInputPort} tagged with ${SHUTDOWNABLE.join(', ')}.`
  );

  // --- Register EventBusPromptAdapter ---
  registrar.singletonFactory(tokens.IPromptOutputPort, (c) => {
    const safeDispatcher = /** @type {ISafeEventDispatcher | null} */ (
      c.resolve(tokens.ISafeEventDispatcher)
    );
    const validatedDispatcher =
      /** @type {IValidatedEventDispatcher | null} */ (
        c.resolve(tokens.IValidatedEventDispatcher)
      );
    if (!safeDispatcher && !validatedDispatcher) {
      logger.error(
        `Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.IPromptOutputPort}.`
      );
      throw new Error(
        `Missing dispatcher dependency for EventBusPromptAdapter`
      );
    }
    return new EventBusPromptAdapter({
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: validatedDispatcher,
    });
  });
  logger.debug(
    `Adapter Registration: Registered EventBusPromptAdapter as ${tokens.IPromptOutputPort}.`
  );

  // --- Register EventBusTurnEndAdapter ---
  registrar.singletonFactory(tokens.ITurnEndPort, (c) => {
    const safeDispatcher = /** @type {ISafeEventDispatcher | null} */ (
      c.resolve(tokens.ISafeEventDispatcher)
    );
    const validatedDispatcher =
      /** @type {IValidatedEventDispatcher | null} */ (
        c.resolve(tokens.IValidatedEventDispatcher)
      );
    if (!safeDispatcher && !validatedDispatcher) {
      logger.error(
        `Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.ITurnEndPort}.`
      );
      throw new Error(
        `Missing dispatcher dependency for EventBusTurnEndAdapter`
      );
    }
    return new EventBusTurnEndAdapter({
      safeEventDispatcher: safeDispatcher,
      validatedEventDispatcher: validatedDispatcher,
      logger: logger,
    });
  });
  logger.debug(
    `Adapter Registration: Registered EventBusTurnEndAdapter as ${tokens.ITurnEndPort}.`
  );

  // --- LLM Adapter Integration (Ticket 24) ---
  logger.info(
    'Adapter Registrations: Starting LLM Adapter setup for CLIENT environment...'
  );

  // 1. Instantiate Core Services and Context
  const executionEnv = 'client';
  const projectRoot = null;

  let proxyUrl = undefined;
  if (globalThis.process && globalThis.process.env) {
    proxyUrl = globalThis.process.env.PROXY_URL || undefined;
  }

  const environmentContext = new EnvironmentContext({
    logger,
    executionEnvironment: executionEnv,
    projectRootPath: projectRoot,
    proxyServerUrl: proxyUrl,
  });
  logger.debug(
    `Adapter Registration: EnvironmentContext instantiated. Environment: ${environmentContext.getExecutionEnvironment()}, Proxy URL: ${proxyUrl || 'Not configured'}`
  );

  // 2. Instantiate IApiKeyProvider - Always ClientApiKeyProvider for this bundle
  /** @type {IApiKeyProvider} */
  let apiKeyProvider;

  if (environmentContext.isClient()) {
    apiKeyProvider = new ClientApiKeyProvider({ logger });
    logger.debug('Adapter Registration: ClientApiKeyProvider instantiated.');
  } else {
    const errorMessage = `Adapter Registration: Critical error - Expected client environment for APIKeyProvider, but got '${environmentContext.getExecutionEnvironment()}'. This bundle is intended for client-side only.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // 3. Instantiate IHttpClient (RetryHttpClient)
  const retryHttpClient = new RetryHttpClient({
    logger,
  });
  logger.debug('Adapter Registration: RetryHttpClient instantiated.');

  // 4. Instantiate LLMStrategyFactory
  const llmStrategyFactory = new LLMStrategyFactory({
    httpClient: retryHttpClient,
    logger,
  });
  logger.debug('Adapter Registration: LLMStrategyFactory instantiated.');

  // 5. LlmConfigLoader is NOT instantiated here for the adapter's init.
  //    The code that calls adapter.init() later will be responsible for
  //    creating/providing LlmConfigLoader, ensuring it gets an ISchemaValidator
  //    instance that has all necessary schemas loaded.

  // 6. Instantiate ConfigurableLLMAdapter (without immediate initialization)
  registrar.singletonFactory(tokens.ILLMAdapter, () => {
    // Dependencies for ConfigurableLLMAdapter constructor are resolved here or taken from above.
    const adapterInstance = new ConfigurableLLMAdapter({
      logger: container.resolve(tokens.ILogger), // Resolve a fresh logger instance if appropriate, or use the existing 'logger'
      environmentContext,
      apiKeyProvider,
      llmStrategyFactory,
      // initialLlmId: null // Or get from a configuration if needed
    });

    logger.info(
      `Adapter Registration: ConfigurableLLMAdapter instance (token: ${tokens.ILLMAdapter}) created. It must be initialized explicitly later in the application's bootstrap sequence, after all schemas have been loaded by SchemaLoader.`
    );

    // CRITICAL CHANGE: DO NOT call adapterInstance.init() here.
    // The init() call and its associated .then().catch() logic will be handled
    // by the component/service responsible for orchestrating the initialization sequence.

    return adapterInstance;
  });
  logger.info(
    `Adapter Registration: Registered ConfigurableLLMAdapter factory as ${tokens.ILLMAdapter}. Deferred (explicit) initialization is required.`
  );

  logger.info(
    'Adapter Registrations: LLM Adapter setup complete (instance created, not initialized).'
  );
  logger.info('Adapter Registrations: All registrations complete.');
}

// --- FILE END ---
