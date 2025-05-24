// llm-proxy-server/server.js
// --- FILE MODIFIED ---

// Import necessary modules
import express from 'express';
import dotenv from 'dotenv';
import * as path from 'node:path'; // For resolving config path
import {fileURLToPath} from 'node:url'; // For __dirname in ES modules
// MODIFICATION: Import cors middleware (Ticket 1.5.8)
import cors from 'cors';

// MODIFICATION: Import the new proxy LLM config loader
import {loadProxyLlmConfigs} from './proxyLlmConfigLoader.js';
// MODIFICATION: Import the API key file retriever utility (adjust path as necessary)
import {getApiKeyFromFile} from '../src/utils/apiKeyFileRetriever.js';
// MODIFICATION: Import Workspace_retry for making API calls to the actual LLM provider
import {Workspace_retry} from '../src/utils/apiUtils.js';


// Load environment variables from .env file
dotenv.config();

// Initialize the Express application
const app = express();

// MODIFICATION START (Ticket 1.5.8): CORS Configuration
const PROXY_ALLOWED_ORIGIN = process.env.PROXY_ALLOWED_ORIGIN;
const proxyLogger = console; // Using console as a simple logger for the proxy

if (PROXY_ALLOWED_ORIGIN) {
    proxyLogger.info(`LLM Proxy Server: CORS will be enabled for origin: ${PROXY_ALLOWED_ORIGIN}`);
    const corsOptions = {
        origin: PROXY_ALLOWED_ORIGIN.split(','), // Allow multiple origins if comma-separated
        methods: ['POST', 'OPTIONS'], // Allow POST and OPTIONS for preflight
        allowedHeaders: ['Content-Type'], // Allow Content-Type header
        // Add any other custom headers your client might send to the proxy here.
        // credentials: true, // If you need to handle cookies or authorization headers from the client
    };
    app.use(cors(corsOptions));
    // The cors middleware by default handles OPTIONS requests implicitly.
    // Logging for actual CORS preflight can be verbose; specific logging if issues arise can be added.
    // For now, the setup log is the primary CORS logging.
    // Example: app.options('/api/llm-request', (req, res, next) => {
    // proxyLogger.debug("LLM Proxy Server: Received OPTIONS preflight request for /api/llm-request");
    // next();
    // }, cors(corsOptions));
} else {
    proxyLogger.warn('LLM Proxy Server: PROXY_ALLOWED_ORIGIN environment variable not set. CORS will not be specifically configured, and requests from different origins might be blocked by default browser policies.');
}
// MODIFICATION END (Ticket 1.5.8): CORS Configuration


// Middleware to parse JSON bodies
app.use(express.json());

// Define the port for the server
// Use the port from environment variables, or default to 3001
const PORT = process.env.PROXY_PORT || 3001;

// MODIFICATION START: Configuration Loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to llm-configs.json, relative to the proxy server's execution directory (server.js)
const LLM_CONFIG_FILE_PATH = process.env.LLM_CONFIG_PATH || path.join(__dirname, 'llm-configs.json');

let loadedLlmConfigs = null;
let isProxyOperational = false;
// const proxyLogger = console; // Already defined above

// Task 1: Determine projectRootPath for Proxy (for apiKeyFileName)
const PROXY_PROJECT_ROOT_PATH = process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES; // Corrected to match .env.example
if (PROXY_PROJECT_ROOT_PATH) {
    proxyLogger.info(`LLM Proxy Server: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is set to '${PROXY_PROJECT_ROOT_PATH}'. This will be used for API key file retrieval.`);
} else {
    proxyLogger.warn('LLM Proxy Server: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES environment variable is not set. API key retrieval from files will not be possible.');
}


(async () => {
    proxyLogger.info('LLM Proxy Server: Initializing and loading configurations...'); // [cite: 1211] (Covers "Configuration Loading" point from ticket indirectly at startup)
    const configResult = await loadProxyLlmConfigs(LLM_CONFIG_FILE_PATH, proxyLogger);

    if (!configResult.error) {
        loadedLlmConfigs = configResult.llmConfigs;
        isProxyOperational = true;
        proxyLogger.info(`LLM Proxy Server: Configurations loaded successfully. Proxy is operational. Default LLM ID (if any): ${loadedLlmConfigs?.defaultLlmId || 'Not set'}`); // [cite: 1211]
    } else {
        proxyLogger.error('LLM Proxy Server: CRITICAL ERROR - Failed to load LLM configurations.', { // [cite: 1211, 1212]
            message: configResult.message,
            stage: configResult.stage,
            path: configResult.pathAttempted,
            originalErrorMessage: configResult.originalError?.message
        });
        proxyLogger.error('LLM Proxy Server: Proxy will NOT be operational for LLM requests.');
        isProxyOperational = false;
    }
})();

// MODIFICATION END: Configuration Loading

/**
 * Helper function to send standardized error responses from the proxy.
 * @param {import('express').Response} res - The Express response object.
 * @param {number} httpStatusCode - The HTTP status code to send to the client.
 * @param {string} stage - The stage where the error occurred (enum from API contract).
 * @param {string} errorMessage - The human-readable error message.
 * @param {object} [details={}] - Additional structured details about the error.
 * @param {string} [llmIdForLog='N/A'] - The llmId involved, for logging context.
 */
function sendProxyError(res, httpStatusCode, stage, errorMessage, details = {}, llmIdForLog = 'N/A') {
    const errorResponse = {
        error: true,
        message: errorMessage,
        stage: stage,
        details: details,
        originalStatusCode: httpStatusCode // This is the code the proxy sends
    };
    // Log the error with context before sending the response [cite: 1212]
    proxyLogger.error(`LLM Proxy Server: Sending error to client. LLM ID: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: ${stage}, Message: ${errorMessage}`, details);
    res.status(httpStatusCode).json(errorResponse);
}


// Basic root route for testing if the server is running
app.get('/', (req, res) => {
    res.status(200).send('LLM Proxy Server is running!');
});

// MODIFICATION START: Main proxy route from Ticket 1.5.3, with API key retrieval (Ticket 1.5.5), and now request forwarding (Ticket 1.5.6) and response relaying (Ticket 1.5.7)
app.post('/api/llm-request', async (req, res) => { // Made async for file operations and Workspace_retry
    // Incoming Request Logging [cite: 1210]
    const clientPayloadSummary = {
        llmId: req.body?.llmId,
        hasTargetPayload: !!req.body?.targetPayload,
        targetPayloadKeys: req.body?.targetPayload ? Object.keys(req.body.targetPayload) : [],
        hasTargetHeaders: !!req.body?.targetHeaders,
        targetHeaderKeys: req.body?.targetHeaders ? Object.keys(req.body.targetHeaders) : []
    };
    proxyLogger.info(`LLM Proxy Server: Received POST request on /api/llm-request from ${req.ip}. Payload summary:`, clientPayloadSummary);


    if (!isProxyOperational) {
        sendProxyError(res, 503, 'initialization_failure', 'Proxy server is not operational due to configuration issues.');
        return;
    }

    const {llmId, targetPayload, targetHeaders} = req.body;

    // --- Request Validation (as per LLM_PROXY_API_CONTRACT.md) ---
    if (!llmId || typeof llmId !== 'string') {
        sendProxyError(res, 400, 'request_validation', 'Client request validation failed: llmId is required and must be a string.', {receivedLlmId: llmId});
        return;
    }
    if (!targetPayload || typeof targetPayload !== 'object') {
        sendProxyError(res, 400, 'request_validation', `Client request validation failed for llmId '${llmId}': targetPayload is required and must be an object.`, {receivedTargetPayloadType: typeof targetPayload}, llmId);
        return;
    }
    // --- End Request Validation ---


    // --- LLM Detail Retrieval ---
    const llmModelConfig = loadedLlmConfigs?.llms?.[llmId];

    if (!llmModelConfig) {
        proxyLogger.warn(`LLM Proxy Server: LLM configuration lookup failed for llmId '${llmId}'.`); // Part of LLM Detail Retrieval logging
        sendProxyError(res, 400, 'llm_config_lookup_error', `LLM configuration not found for the provided llmId '${llmId}'.`, {requestedLlmId: llmId}, llmId);
        return;
    }

    // LLM Detail Retrieval Logging (Success)
    proxyLogger.info(`LLM Proxy Server: Retrieved LLMModelConfig for llmId '${llmId}': DisplayName: ${llmModelConfig.displayName}`);
    proxyLogger.debug(`LLM Proxy Server: Config details for '${llmId}':`, {
        endpointUrl: llmModelConfig.endpointUrl,
        modelIdentifier: llmModelConfig.modelIdentifier,
        apiKeyEnvVar: llmModelConfig.apiKeyEnvVar ? 'Present' : 'Not Present', // Don't log the var name if it could be sensitive due to naming conventions
        apiKeyFileName: llmModelConfig.apiKeyFileName ? 'Present' : 'Not Present', // Don't log the file name directly if it could be sensitive
        apiType: llmModelConfig.apiType,
    });

    // --- API Key Retrieval Logic (Ticket 1.5.5) ---
    let actualApiKey = null;
    let apiKeyRetrievalErrorDetails = null;
    let apiKeySourceForLog = "N/A"; // For logging the source of the key

    const localApiTypes = ['ollama', 'llama_cpp_server_openai_compatible', 'tgi_openai_compatible'];
    const isCloudServiceRequiringKey = !localApiTypes.includes(llmModelConfig.apiType);

    if (isCloudServiceRequiringKey) {
        proxyLogger.info(`LLM Proxy Server: Cloud service detected for llmId '${llmId}'. Attempting API key retrieval.`);
        const {apiKeyEnvVar, apiKeyFileName} = llmModelConfig;

        if (apiKeyEnvVar && typeof apiKeyEnvVar === 'string' && apiKeyEnvVar.trim() !== '') {
            const envVarName = apiKeyEnvVar.trim();
            apiKeySourceForLog = `environment variable '${envVarName}'`;
            proxyLogger.debug(`LLM Proxy Server: Attempting to retrieve key from ${apiKeySourceForLog} for llmId '${llmId}'.`); // API Key Retrieval attempt
            const envValue = process.env[envVarName];
            if (envValue && typeof envValue === 'string' && envValue.trim() !== '') {
                actualApiKey = envValue.trim();
                proxyLogger.info(`LLM Proxy Server: Successfully retrieved API key for llmId '${llmId}' via ${apiKeySourceForLog}.`); // API Key Retrieval success
            } else {
                proxyLogger.warn(`LLM Proxy Server: Environment variable '${envVarName}' for llmId '${llmId}' not found or is empty.`); // API Key Retrieval failure (specific)
            }
        }

        if (!actualApiKey && apiKeyFileName && typeof apiKeyFileName === 'string' && apiKeyFileName.trim() !== '') {
            const fileName = apiKeyFileName.trim();
            apiKeySourceForLog = `file '${fileName}'`;
            proxyLogger.debug(`LLM Proxy Server: Attempting to retrieve key from ${apiKeySourceForLog} for llmId '${llmId}'.`); // API Key Retrieval attempt

            if (!PROXY_PROJECT_ROOT_PATH) {
                proxyLogger.error(`LLM Proxy Server: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES environment variable is not set for the proxy. Cannot retrieve API key from file '${fileName}' for llmId '${llmId}'.`); // API Key Retrieval failure
                apiKeyRetrievalErrorDetails = {
                    message: `Proxy server configuration error: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES not set, cannot access API key file '${fileName}'.`,
                    stage: 'api_key_retrieval_error',
                    details: {
                        llmId,
                        attemptedFile: fileName,
                        reason: "PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES not set for proxy"
                    }
                };
            } else {
                try {
                    const keyFromFile = await getApiKeyFromFile(fileName, PROXY_PROJECT_ROOT_PATH, proxyLogger);
                    if (keyFromFile && typeof keyFromFile === 'string' && keyFromFile.trim() !== '') {
                        actualApiKey = keyFromFile.trim();
                        proxyLogger.info(`LLM Proxy Server: Successfully retrieved API key for llmId '${llmId}' via ${apiKeySourceForLog}.`); // API Key Retrieval success
                    } else {
                        proxyLogger.warn(`LLM Proxy Server: API key file '${fileName}' for llmId '${llmId}' not found, unreadable, or empty.`); // API Key Retrieval failure (specific)
                        if (!apiKeyEnvVar || apiKeyEnvVar.trim() === '') { // Only file was specified
                            apiKeyRetrievalErrorDetails = {
                                message: `Failed to retrieve API key from file '${fileName}' for cloud LLM '${llmId}'. File not found or empty.`,
                                stage: 'api_key_retrieval_error',
                                details: {
                                    llmId,
                                    attemptedFile: fileName,
                                    reason: "File not found, unreadable, or empty"
                                }
                            };
                        } else { // Both env var and file were tried, and env var failed first
                            apiKeyRetrievalErrorDetails = {
                                message: `Failed to retrieve API key for cloud LLM '${llmId}' from env var '${apiKeyEnvVar.trim()}' and file '${fileName}'. Both methods failed.`,
                                stage: 'api_key_retrieval_error',
                                details: {
                                    llmId,
                                    attemptedEnvVar: apiKeyEnvVar.trim(),
                                    attemptedFile: fileName,
                                    reason: "Both env var and file retrieval failed."
                                }
                            };
                        }
                    }
                } catch (fileReadError) {
                    proxyLogger.error(`LLM Proxy Server: Error reading API key from file '${fileName}' for llmId '${llmId}'. Error: ${fileReadError.message}`, {
                        error: {
                            message: fileReadError.message,
                            stack: fileReadError.stack
                        }
                    }); // API Key Retrieval failure [cite: 1212, 1213]
                    apiKeyRetrievalErrorDetails = {
                        message: `Error reading API key file '${fileName}'.`,
                        stage: 'api_key_retrieval_error',
                        details: {llmId, attemptedFile: fileName, error: fileReadError.message}
                    };
                }
            }
        }
        // Final check if key was retrieved if it was supposed to be
        if (!actualApiKey && !apiKeyRetrievalErrorDetails) {
            const attemptedSources = [];
            if (apiKeyEnvVar && apiKeyEnvVar.trim() !== '') attemptedSources.push(`environment variable '${apiKeyEnvVar.trim()}'`);
            if (apiKeyFileName && apiKeyFileName.trim() !== '') attemptedSources.push(`file '${apiKeyFileName.trim()}'`);

            if (attemptedSources.length === 0) {
                proxyLogger.error(`LLM Proxy Server: No API key source (apiKeyEnvVar or apiKeyFileName) specified in configuration for cloud LLM '${llmId}'.`); // API Key Retrieval failure
                apiKeyRetrievalErrorDetails = {
                    message: `API key source not configured for cloud LLM '${llmId}'. Proxy cannot authenticate.`,
                    stage: 'api_key_retrieval_error',
                    details: {llmId, reason: "No apiKeyEnvVar or apiKeyFileName defined in LLM configuration."}
                };
            } else if (apiKeyEnvVar && apiKeyEnvVar.trim() !== '' && (!apiKeyFileName || apiKeyFileName.trim() === '')) {
                // This means only env var was specified and it failed (was empty or not found)
                apiKeyRetrievalErrorDetails = {
                    message: `Failed to retrieve API key for cloud LLM '${llmId}' from environment variable '${apiKeyEnvVar.trim()}'. Env var not found or empty.`,
                    stage: 'api_key_retrieval_error',
                    details: {
                        llmId,
                        attemptedEnvVar: apiKeyEnvVar.trim(),
                        reason: "Environment variable not found or empty."
                    }
                };
            }
        }

    } else {
        proxyLogger.info(`LLM Proxy Server: LLM '${llmId}' (apiType: ${llmModelConfig.apiType}) is local or does not require proxy-managed API key. API key retrieval is bypassed.`);
        apiKeySourceForLog = "Not applicable (local LLM)";
    }

    if (isCloudServiceRequiringKey && !actualApiKey) {
        const errorResponseBase = apiKeyRetrievalErrorDetails || { // Default if somehow not set
            message: `Critical error: API key for cloud service LLM '${llmId}' could not be obtained.`,
            stage: 'api_key_retrieval_error',
            details: {llmId, reason: "Unknown key retrieval failure."}
        };
        sendProxyError(res, 500, errorResponseBase.stage, errorResponseBase.message, errorResponseBase.details, llmId);
        return;
    }
    // --- End API Key Retrieval Logic ---

    // --- Ticket 1.5.6 & 1.5.7: Forward Request and Relay Response ---
    const actualLlmEndpointUrl = llmModelConfig.endpointUrl;
    if (!actualLlmEndpointUrl || typeof actualLlmEndpointUrl !== 'string' || actualLlmEndpointUrl.trim() === '') {
        sendProxyError(res, 500, 'llm_endpoint_resolution_error', `Proxy server configuration error: LLM endpoint URL is missing or invalid for llmId '${llmId}'.`, {
            llmId,
            configuredEndpoint: actualLlmEndpointUrl
        }, llmId);
        return;
    }

    const finalHeadersForLLM = {};
    finalHeadersForLLM['Content-Type'] = 'application/json'; // Default

    if (targetHeaders && typeof targetHeaders === 'object') {
        for (const key in targetHeaders) {
            if (Object.prototype.hasOwnProperty.call(targetHeaders, key) && key.toLowerCase() !== 'authorization' && key.toLowerCase() !== 'content-type') {
                finalHeadersForLLM[key] = targetHeaders[key];
            }
        }
    }

    if (llmModelConfig.providerSpecificHeaders && typeof llmModelConfig.providerSpecificHeaders === 'object') {
        for (const key in llmModelConfig.providerSpecificHeaders) {
            if (Object.prototype.hasOwnProperty.call(llmModelConfig.providerSpecificHeaders, key) && key.toLowerCase() !== 'authorization' && key.toLowerCase() !== 'content-type') {
                finalHeadersForLLM[key] = llmModelConfig.providerSpecificHeaders[key];
            }
        }
    }

    if (isCloudServiceRequiringKey && actualApiKey) {
        finalHeadersForLLM['Authorization'] = `Bearer ${actualApiKey}`; // DO NOT LOG actualApiKey
    }

    const retryParams = llmModelConfig.defaultParameters || {};
    const maxRetries = typeof retryParams.maxRetries === 'number' ? retryParams.maxRetries : 3;
    const baseDelayMs = typeof retryParams.baseDelayMs === 'number' ? retryParams.baseDelayMs : 1000;
    const maxDelayMs = typeof retryParams.maxDelayMs === 'number' ? retryParams.maxDelayMs : 10000;

    // Outbound Request Construction Logging [cite: 1211]
    const sanitizedTargetPayloadForLog = {...targetPayload};
    if (sanitizedTargetPayloadForLog.messages && Array.isArray(sanitizedTargetPayloadForLog.messages)) {
        sanitizedTargetPayloadForLog.messages = sanitizedTargetPayloadForLog.messages.map(m => ({
            ...m,
            content: typeof m.content === 'string' ? m.content.substring(0, 70) + (m.content.length > 70 ? '...' : '') : '[Non-string content]'
        }));
    } else if (typeof sanitizedTargetPayloadForLog.prompt === 'string') {
        sanitizedTargetPayloadForLog.prompt = sanitizedTargetPayloadForLog.prompt.substring(0, 70) + (sanitizedTargetPayloadForLog.prompt.length > 70 ? '...' : '');
    }
    // Further sanitization for other potentially sensitive fields if necessary

    proxyLogger.info(`LLM Proxy Server: Preparing to forward request to LLM provider for llmId '${llmId}'.`);
    proxyLogger.debug(`   Target URL: ${actualLlmEndpointUrl}`);
    proxyLogger.debug(`   Using API Key from source: ${apiKeySourceForLog} (Presence: ${isCloudServiceRequiringKey && !!actualApiKey})`);
    proxyLogger.debug(`   Forwarding Headers (Authorization token itself is NOT logged): ${JSON.stringify(Object.keys(finalHeadersForLLM))}`);
    proxyLogger.debug(`   Sanitized Target Payload Preview:`, sanitizedTargetPayloadForLog);


    try {
        // Outbound Request Attempt Logging [cite: 1213]
        proxyLogger.info(`LLM Proxy Server: Initiating call via Workspace_retry to ${actualLlmEndpointUrl} for llmId '${llmId}'. Retries: ${maxRetries}, BaseDelay: ${baseDelayMs}ms, MaxDelay: ${maxDelayMs}ms.`);

        const llmProviderParsedResponse = await Workspace_retry(
            actualLlmEndpointUrl,
            {
                method: 'POST',
                headers: finalHeadersForLLM,
                body: JSON.stringify(targetPayload) // Send the original full targetPayload
            },
            maxRetries,
            baseDelayMs,
            maxDelayMs
        );

        // Successful LLM Response Relaying (AC 1)
        // Workspace_retry currently only returns the parsed body, so we assume 200 OK.
        const relayedStatusCode = 200; // Assumption due to Workspace_retry behavior

        // Outbound Response Received & Response Relayed to Client Logging
        const responseBodyPreview = JSON.stringify(llmProviderParsedResponse)?.substring(0, 100) + (JSON.stringify(llmProviderParsedResponse)?.length > 100 ? "..." : "");
        proxyLogger.info(`LLM Proxy Server: Successfully received response from LLM provider for llmId '${llmId}'. Relaying to client with status ${relayedStatusCode}.`); // [cite: 1211]
        proxyLogger.debug(`   LLM Provider Response Body (Preview): ${responseBodyPreview}`);


        res.status(relayedStatusCode)
            .set('Content-Type', 'application/json') // Assuming LLM response is JSON
            .json(llmProviderParsedResponse);

    } catch (error) {
        // LLM Provider Error Relaying (AC 2) or Network Error from Workspace_retry
        // This also covers "Outbound Response Received" (as an error)
        proxyLogger.error(`LLM Proxy Server: Error during/after forwarding request to LLM provider for llmId '${llmId}'. Error: ${error.message}`); // [cite: 1211, 1212]
        proxyLogger.debug(`   Target URL was: ${actualLlmEndpointUrl}`);
        proxyLogger.debug(`   Error Details:`, {name: error.name, message: error.message, stack: error.stack}); // [cite: 1212]

        let relayedStatusCode = 500; // Default for unexpected errors from Workspace_retry
        let relayedBody = { // Default error body if we can't parse from Workspace_retry's error
            error: true,
            message: `Proxy failed to get response from LLM provider: ${error.message}`,
            stage: 'llm_forwarding_error_network', // Default, can be updated
            details: {
                llmId,
                targetUrl: actualLlmEndpointUrl,
                originalError: error.message
            }
        };
        let errorStage = 'llm_forwarding_error_network';

        if (error.message && typeof error.message === 'string') {
            // Attempt to parse status and body from Workspace_retry's error message format:
            // "API request to ${url} failed ... with status ${response.status}: ${errorBodyText}"
            const match = error.message.match(/status (\d{3}):\s*(.*)/s);
            if (match && match[1] && match[2]) {
                const llmApiStatus = parseInt(match[1], 10);
                const llmErrorBodyString = match[2];

                relayedStatusCode = llmApiStatus; // Relay exact status from LLM
                try {
                    relayedBody = JSON.parse(llmErrorBodyString); // Try to parse if LLM error body was JSON
                } catch (parseErr) {
                    relayedBody = llmErrorBodyString; // Send as plain text if not JSON
                    proxyLogger.warn(`LLM Proxy Server: LLM error body for status ${llmApiStatus} was not JSON. Relaying as text. Body preview: ${llmErrorBodyString.substring(0, 100)}...`);
                }

                if (llmApiStatus >= 400 && llmApiStatus < 500) {
                    errorStage = 'llm_forwarding_error_http_client';
                } else if (llmApiStatus >= 500 && llmApiStatus < 600) {
                    // For 5xx from LLM, proxy might return 502 Bad Gateway.
                    relayedStatusCode = 502; // Override status for client
                    errorStage = 'llm_forwarding_error_http_server';
                    // Re-wrap the body in the standard proxy error format if we are changing the status code
                    const relayedBodyPreview = typeof relayedBody === 'string' ? relayedBody.substring(0, 100) + "..." : JSON.stringify(relayedBody)?.substring(0, 100) + "...";
                    relayedBody = {
                        error: true,
                        message: `LLM provider reported a server-side error (original status ${llmApiStatus}). Proxy is treating this as a Bad Gateway.`,
                        stage: errorStage,
                        details: {
                            llmId,
                            targetUrl: actualLlmEndpointUrl,
                            llmApiStatusCode: llmApiStatus,
                            llmApiResponseBodyPreview: relayedBodyPreview
                        }
                    };
                }
                proxyLogger.info(`LLM Proxy Server: Relaying error from LLM provider. Original LLM Status: ${llmApiStatus}. Proxy sending status: ${relayedStatusCode}.`);
            } else {
                // If message doesn't match the expected format, it's likely a network error from Workspace_retry
                proxyLogger.warn(`LLM Proxy Server: Error message from Workspace_retry did not match expected LLM HTTP error format. Treating as network/generic forwarding error. Message: ${error.message}`);
            }
        }
        // Logging for the final decision on what to send to client
        // This also covers "Response Relayed to Client" (as an error)
        const bodyPreviewForLog = typeof relayedBody === 'string' ? relayedBody.substring(0, 100) + "..." : JSON.stringify(relayedBody)?.substring(0, 100) + "...";
        proxyLogger.error(`LLM Proxy Server: Relaying error to client for llmId '${llmId}'. Status: ${relayedStatusCode}, Stage: ${errorStage}, Body Preview: ${bodyPreviewForLog}`);


        // Determine Content-Type for error response
        let contentType = 'application/json';
        if (typeof relayedBody === 'string') {
            try {
                JSON.parse(relayedBody); // Check if it's a JSON string
            } catch (e) {
                contentType = 'text/plain'; // If not a JSON string, send as plain text
            }
        }

        res.status(relayedStatusCode)
            .set('Content-Type', contentType)
            .send(relayedBody);
    }
    // --- End Ticket 1.5.6 & 1.5.7 ---
});
// MODIFICATION END: Main proxy route


// Start the server
app.listen(PORT, () => {
    proxyLogger.info(`LLM Proxy Server listening on port ${PORT}`);
    proxyLogger.info(`LLM Proxy Server: Expecting LLM configurations at: ${LLM_CONFIG_FILE_PATH}`);
    if (PROXY_ALLOWED_ORIGIN) { // MODIFICATION (Ticket 1.5.8)
        proxyLogger.info(`LLM Proxy Server: CORS enabled for origin(s): ${PROXY_ALLOWED_ORIGIN}`);
    } else {
        proxyLogger.warn('LLM Proxy Server: PROXY_ALLOWED_ORIGIN not set, CORS is not specifically configured.');
    }
    if (!process.env.PROXY_PORT) {
        proxyLogger.warn('  LLM Proxy Server: PROXY_PORT environment variable not set, using default.');
    }
    if (!PROXY_PROJECT_ROOT_PATH && isProxyOperational) {
        let usesFileKey = false;
        if (loadedLlmConfigs && loadedLlmConfigs.llms) {
            const localApiTypesForWarning = ['ollama', 'llama_cpp_server_openai_compatible', 'tgi_openai_compatible'];
            for (const id in loadedLlmConfigs.llms) {
                const cfg = loadedLlmConfigs.llms[id];
                const isCloud = !localApiTypesForWarning.includes(cfg.apiType);
                if (isCloud && cfg.apiKeyFileName && cfg.apiKeyFileName.trim() !== '') {
                    usesFileKey = true;
                    break;
                }
            }
        }
        if (usesFileKey) {
            proxyLogger.warn('  LLM Proxy Server: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES environment variable not set. API key retrieval from files will fail if configured for any LLM that uses apiKeyFileName.');
        }
    }
});

// Global Error Handler (Refinement for AC 3.4 and Task 2.3)
app.use((err, req, res, next) => {
    // Log the unhandled error with stack trace [cite: 1212]
    proxyLogger.error('LLM Proxy Server: Unhandled error caught by generic middleware:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
    });
    if (res.headersSent) {
        return next(err);
    }
    // Use the sendProxyError helper to ensure schema adherence
    sendProxyError(res, 500, 'internal_proxy_error', 'An unexpected internal server error occurred in the proxy.', {originalErrorMessage: err.message});
});

// --- FILE MODIFIED ---