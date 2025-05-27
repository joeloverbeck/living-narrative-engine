// src/core/config/registrations/adapterRegistrations.js
// --- FILE START ---

/**
 * @fileoverview Registers port adapter implementations with the DI container,
 * including the ConfigurableLLMAdapter and its dependencies.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
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
import {tokens} from '../tokens.js';
import {Registrar} from '../registrarHelpers.js';
import {SHUTDOWNABLE} from "../tags.js";

// --- Standard Adapter Imports ---
import {EventBusCommandInputGateway} from '../../turns/adapters/eventBusCommandInputGateway.js';
import {EventBusPromptAdapter} from '../../turns/adapters/eventBusPromptAdapter.js';
import EventBusTurnEndAdapter from '../../turns/adapters/eventBusTurnEndAdapter.js';

// --- New LLM Related Imports ---
import {ConfigurableLLMAdapter} from '../../turns/adapters/configurableLLMAdapter.js';
import {EnvironmentContext} from '../../llms/environmentContext.js';
// NodeFileSystemReader, ProcessEnvReader, ServerApiKeyProvider are removed as they are server-specific
import {ClientApiKeyProvider} from '../../llms/clientApiKeyProvider.js';
import {RetryHttpClient} from '../../llms/retryHttpClient.js';
import {LLMStrategyFactory} from '../../llms/LLMStrategyFactory.js';
import {LlmConfigLoader} from '../../llms/services/llmConfigLoader.js';

/**
 * Registers the default port adapters and the ConfigurableLLMAdapter with its dependencies
 * for a client-side environment.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerAdapters(container) { // Reverted to synchronous
    const registrar = new Registrar(container);
    /** @type {ILogger} */
    const logger = container.resolve(tokens.ILogger);
    logger.info('Adapter Registrations: Starting...');

    // --- Register EventBusCommandInputGateway ---
    registrar.tagged(SHUTDOWNABLE).singletonFactory(tokens.ICommandInputPort, (c) => {
        const ved = /** @type {IValidatedEventDispatcher} */ (c.resolve(tokens.IValidatedEventDispatcher));
        if (!ved) {
            logger.error(`Adapter Registration: Failed to resolve ${tokens.IValidatedEventDispatcher} for ${tokens.ICommandInputPort}.`);
            throw new Error(`Missing dependency ${tokens.IValidatedEventDispatcher} for EventBusCommandInputGateway`);
        }
        return new EventBusCommandInputGateway({validatedEventDispatcher: ved});
    });
    logger.debug(`Adapter Registration: Registered EventBusCommandInputGateway as ${tokens.ICommandInputPort} tagged with ${SHUTDOWNABLE.join(', ')}.`);

    // --- Register EventBusPromptAdapter ---
    registrar.singletonFactory(tokens.IPromptOutputPort, (c) => {
        const safeDispatcher = /** @type {ISafeEventDispatcher | null} */ (c.resolve(tokens.ISafeEventDispatcher));
        const validatedDispatcher = /** @type {IValidatedEventDispatcher | null} */ (c.resolve(tokens.IValidatedEventDispatcher));
        if (!safeDispatcher && !validatedDispatcher) {
            logger.error(`Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.IPromptOutputPort}.`);
            throw new Error(`Missing dispatcher dependency for EventBusPromptAdapter`);
        }
        return new EventBusPromptAdapter({
            safeEventDispatcher: safeDispatcher,
            validatedEventDispatcher: validatedDispatcher
        });
    });
    logger.debug(`Adapter Registration: Registered EventBusPromptAdapter as ${tokens.IPromptOutputPort}.`);

    // --- Register EventBusTurnEndAdapter ---
    registrar.singletonFactory(tokens.ITurnEndPort, (c) => {
        const safeDispatcher = /** @type {ISafeEventDispatcher | null} */ (c.resolve(tokens.ISafeEventDispatcher));
        const validatedDispatcher = /** @type {IValidatedEventDispatcher | null} */ (c.resolve(tokens.IValidatedEventDispatcher));
        if (!safeDispatcher && !validatedDispatcher) {
            logger.error(`Adapter Registration: Failed to resolve either ${tokens.ISafeEventDispatcher} or ${tokens.IValidatedEventDispatcher} for ${tokens.ITurnEndPort}.`);
            throw new Error(`Missing dispatcher dependency for EventBusTurnEndAdapter`);
        }
        return new EventBusTurnEndAdapter({
            // MODIFICATION START: Corrected property name from safeDispatcher to safeEventDispatcher
            safeEventDispatcher: safeDispatcher,
            // MODIFICATION END
            validatedEventDispatcher: validatedDispatcher,
            logger: logger
        });
    });
    logger.debug(`Adapter Registration: Registered EventBusTurnEndAdapter as ${tokens.ITurnEndPort}.`);

    // --- LLM Adapter Integration (Ticket 24) ---
    logger.info('Adapter Registrations: Starting LLM Adapter setup for CLIENT environment...');

    // 1. Instantiate Core Services and Context
    const executionEnv = 'client'; // Explicitly client for this version of registrations
    const projectRoot = null; // No project root concept from client-side like in Node.js file system

    // MODIFICATION START: Safely access process.env.PROXY_URL
    let proxyUrl = undefined;
    if (typeof process !== 'undefined' && process.env) {
        // If process.env.PROXY_URL is an empty string, it will become undefined here,
        // which is consistent with the original `|| undefined` behavior.
        proxyUrl = process.env.PROXY_URL || undefined;
    }
    // If your client needs to connect to the proxy, proxyUrl should be configured
    // to a value like 'http://localhost:3001' through a build system or other client-side config mechanism.
    // The fix above ensures no crash if process.env.PROXY_URL is not defined by a build tool.
    // MODIFICATION END

    const environmentContext = new EnvironmentContext({
        logger,
        executionEnvironment: executionEnv,
        projectRootPath: projectRoot,
        proxyServerUrl: proxyUrl // Will be undefined if not set via a build tool/client config
    });
    logger.debug(`Adapter Registration: EnvironmentContext instantiated. Environment: ${environmentContext.getExecutionEnvironment()}, Proxy URL: ${proxyUrl || 'Not configured'}`);

    // IFileSystemReader & IEnvironmentVariableReader are not used in client environment.

    // 2. Instantiate IApiKeyProvider - Always ClientApiKeyProvider for this bundle
    /** @type {IApiKeyProvider} */
    let apiKeyProvider;

    if (environmentContext.isClient()) { // This will always be true given executionEnv = 'client'
        apiKeyProvider = new ClientApiKeyProvider({logger});
        logger.debug('Adapter Registration: ClientApiKeyProvider instantiated.');
    } else {
        // This branch should ideally not be reachable if executionEnv is hardcoded 'client'.
        const errorMessage = `Adapter Registration: Critical error - Expected client environment for APIKeyProvider, but got '${environmentContext.getExecutionEnvironment()}'. This bundle is intended for client-side only.`;
        logger.error(errorMessage);
        throw new Error(errorMessage);
    }

    // 3. Instantiate IHttpClient (RetryHttpClient)
    const retryHttpClient = new RetryHttpClient({
        logger,
        // If RetryHttpClient needs proxyUrl directly, it would get it from EnvironmentContext
        // or have it passed if its constructor is updated. Assuming it uses EnvironmentContext internally
        // or that strategy factory below handles proxying.
    });
    logger.debug('Adapter Registration: RetryHttpClient instantiated.');

    // 4. Instantiate LLMStrategyFactory
    const llmStrategyFactory = new LLMStrategyFactory({
        httpClient: retryHttpClient,
        logger,
        // LLMStrategyFactory might also use environmentContext to know about the proxy
        // or this is handled by the adapter itself using the context.
    });
    logger.debug('Adapter Registration: LLMStrategyFactory instantiated.');

    // 5. Instantiate LlmConfigLoader
    const llmConfigLoader = new LlmConfigLoader({
        logger,
        // LlmConfigLoader for client might fetch configs differently, possibly through http if not bundled.
        // For now, assuming it's configured to load client-side appropriate configs.
    });
    logger.debug('Adapter Registration: LlmConfigLoader instantiated.');

    // 6. Instantiate Refactored ConfigurableLLMAdapter
    registrar.singletonFactory(tokens.ILLMAdapter, () => {
        const adapterInstance = new ConfigurableLLMAdapter({
            logger,
            environmentContext, // This passes the proxyUrl (or undefined) to the adapter
            apiKeyProvider,
            llmStrategyFactory
        });
        logger.info(`Adapter Registration: ConfigurableLLMAdapter instance created (token: ${tokens.ILLMAdapter}). Ready for async initialization.`);

        // The adapter's init method is now responsible for loading its own configuration
        // using the LlmConfigLoader.
        adapterInstance.init({llmConfigLoader})
            .then(() => {
                logger.info(`Adapter Registration: ConfigurableLLMAdapter (token: ${tokens.ILLMAdapter}) initialized successfully and is operational: ${adapterInstance.isOperational()}.`);
                if (!adapterInstance.isOperational()) {
                    logger.warn(`Adapter Registration: ConfigurableLLMAdapter (token: ${tokens.ILLMAdapter}) initialized BUT IS NOT OPERATIONAL. Check logs for LlmConfigLoader errors (e.g., if it tried to fetch remote llm-configs.json and failed, or if no LLMs were configured/valid).`);
                }
            })
            .catch(error => {
                // This error is critical because if the adapter fails to init, the app likely can't use LLMs.
                logger.error(`Adapter Registration: CRITICAL - ConfigurableLLMAdapter (token: ${tokens.ILLMAdapter}) failed to initialize: ${error.message}`, {error});
                // Depending on app requirements, you might want to re-throw or handle this more gracefully,
                // e.g., by setting a global state that LLM functionality is unavailable.
            });

        return adapterInstance;
    });
    logger.info(`Adapter Registration: Registered ConfigurableLLMAdapter factory as ${tokens.ILLMAdapter}. Asynchronous initialization will follow.`);

    logger.info('Adapter Registrations: LLM Adapter setup complete.');
    logger.info('Adapter Registrations: All registrations complete.');
}

// --- FILE END ---