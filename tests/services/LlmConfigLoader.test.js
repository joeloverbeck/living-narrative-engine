// tests/services/LlmConfigLoader.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {LlmConfigLoader} from '../../src/services/llmConfigLoader.js'; // Adjust path as needed
import {Workspace_retry} from '../../src/utils/apiUtils.js'; // Adjust path as needed

// Mock the Workspace_retry utility
jest.mock('../../src/utils/apiUtils.js', () => ({
    Workspace_retry: jest.fn(),
}));

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

const validConfigContent = {
    defaultLlmId: "test-llm-1",
    llms: {
        "test-llm-1": {
            id: "test-llm-1",
            displayName: "Test LLM 1",
            endpointUrl: "https://api.example.com/llm1",
            modelIdentifier: "model-1",
            apiType: "test-type",
            jsonOutputStrategy: {method: "test-strategy"},
            defaultParameters: {temperature: 0.5}
        },
        "test-llm-2": {
            id: "test-llm-2",
            displayName: "Test LLM 2",
            apiKeyEnvVar: "TEST_LLM_2_API_KEY",
            endpointUrl: "https://api.example.com/llm2",
            modelIdentifier: "model-2",
            apiType: "test-type-2",
            jsonOutputStrategy: {method: "test-strategy-2"}
        }
    }
};
const minimalValidConfigContent = {llms: {}}; // For constructor tests

const defaultConfigPath = "config/llm-configs.json";

describe('LlmConfigLoader', () => {
    /** @type {LlmConfigLoader} */
    let loader;
    /** @type {ReturnType<typeof mockLogger>} */
    let loggerMock;

    beforeEach(() => {
        jest.clearAllMocks();
        loggerMock = mockLogger();
        loader = new LlmConfigLoader({logger: loggerMock});
        // Reset the mock implementation for Workspace_retry before each test
        Workspace_retry.mockReset();
    });

    describe('constructor', () => {
        test('should use provided logger', async () => {
            Workspace_retry.mockResolvedValueOnce(minimalValidConfigContent); // Prevent validation error
            await loader.loadConfigs();
            expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('Attempting to load LLM configurations'));
        });

        test('should use console if no logger is provided', async () => {
            const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
            });
            Workspace_retry.mockResolvedValueOnce(minimalValidConfigContent); // Prevent validation error
            const loaderWithoutLogger = new LlmConfigLoader();
            await loaderWithoutLogger.loadConfigs();
            expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Attempting to load LLM configurations'));
            consoleInfoSpy.mockRestore();
        });

        test('should use default config path if none provided', async () => {
            Workspace_retry.mockResolvedValueOnce(validConfigContent);
            await loader.loadConfigs();
            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultConfigPath, // Check if default path was used
                expect.any(Object),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number)
            );
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Attempting to load LLM configurations from: ${defaultConfigPath}`);
        });

        test('should use provided defaultConfigPath in constructor', async () => {
            const customPath = "custom/path/to/configs.json";
            const loaderWithCustomPath = new LlmConfigLoader({logger: loggerMock, defaultConfigPath: customPath});
            Workspace_retry.mockResolvedValueOnce(validConfigContent);
            await loaderWithCustomPath.loadConfigs();
            expect(Workspace_retry).toHaveBeenCalledWith(
                customPath, // Check if custom path was used
                expect.any(Object),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number)
            );
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Attempting to load LLM configurations from: ${customPath}`);
        });
    });

    describe('loadConfigs', () => {
        test('AC1: should load and parse a valid llm-configs.json file successfully', async () => {
            Workspace_retry.mockResolvedValueOnce(validConfigContent);
            const result = await loader.loadConfigs(defaultConfigPath);

            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultConfigPath,
                {method: 'GET', headers: {'Accept': 'application/json'}},
                3, // defaultMaxRetries
                500, // defaultBaseDelayMs
                5000 // defaultMaxDelayMs
            );
            expect(result).toEqual(validConfigContent);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Successfully fetched and parsed LLM configurations from ${defaultConfigPath}.`);
        });

        test('AC5: should return the parsed configuration object matching expected structure', async () => {
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(validConfigContent))); // Deep copy
            const result = await loader.loadConfigs();
            expect(result).toEqual(validConfigContent);
        });

        test('AC2: should handle Workspace network errors (simulated by Workspace_retry rejecting)', async () => {
            const networkError = new Error("Simulated Network Error: Failed to fetch");
            Workspace_retry.mockRejectedValueOnce(networkError);

            const result = await loader.loadConfigs(defaultConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load or parse LLM configurations from ${defaultConfigPath}: ${networkError.message}`,
                stage: 'fetch_network_error',
                originalError: networkError,
                path: defaultConfigPath
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: Failed to load or parse LLM configurations from ${defaultConfigPath}. Error: ${networkError.message}`,
                expect.objectContaining({path: defaultConfigPath, originalErrorDetails: networkError})
            );
        });

        test('AC3: should handle HTTP errors from Workspace (e.g., 404 Not Found)', async () => {
            const httpError = new Error("API request to config/llm-configs.json failed after 1 attempt(s) with status 404: {\"error\":\"Not Found\"}");
            Workspace_retry.mockRejectedValueOnce(httpError);

            const result = await loader.loadConfigs(defaultConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load or parse LLM configurations from ${defaultConfigPath}: ${httpError.message}`,
                stage: 'fetch_not_found', // Corrected expectation
                originalError: httpError,
                path: defaultConfigPath
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: Failed to load or parse LLM configurations from ${defaultConfigPath}. Error: ${httpError.message}`,
                expect.objectContaining({path: defaultConfigPath, originalErrorDetails: httpError})
            );
        });

        test('AC3: should handle HTTP errors from Workspace (e.g., 500 Server Error)', async () => {
            const httpError = new Error("API request to config/llm-configs.json failed after 3 attempt(s) with status 500: {\"error\":\"Server Issue\"}");
            Workspace_retry.mockRejectedValueOnce(httpError);

            const result = await loader.loadConfigs(defaultConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load or parse LLM configurations from ${defaultConfigPath}: ${httpError.message}`,
                stage: 'fetch_server_error', // Corrected expectation
                originalError: httpError,
                path: defaultConfigPath
            });
        });


        test('AC4: should handle invalid JSON content (Workspace_retry throws JSON parsing error)', async () => {
            // Simulate Workspace_retry throwing an error as if response.json() failed
            const parsingError = new SyntaxError("Unexpected token i in JSON at position 0");
            Workspace_retry.mockRejectedValueOnce(parsingError); // Simulate parsing failure within Workspace_retry

            const result = await loader.loadConfigs(defaultConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load or parse LLM configurations from ${defaultConfigPath}: ${parsingError.message}`,
                stage: 'parse',
                originalError: parsingError,
                path: defaultConfigPath
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to load or parse LLM configurations from ${defaultConfigPath}. Error: ${parsingError.message}`),
                expect.anything()
            );
        });

        test('should handle configuration file that is not an object', async () => {
            // This test assumes Workspace_retry itself might return a non-object after "parsing"
            // (though ideally Workspace_retry would throw if it can't produce an object from JSON).
            Workspace_retry.mockResolvedValueOnce("this is not an object");

            const result = await loader.loadConfigs(defaultConfigPath);
            expect(result).toEqual({
                error: true,
                message: `Configuration file from ${defaultConfigPath} is malformed (e.g., not an object or missing 'llms' property).`,
                stage: 'validation',
                path: defaultConfigPath
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: Configuration file from ${defaultConfigPath} is malformed or missing 'llms' object.`,
                {path: defaultConfigPath, parsedResponse: "this is not an object"}
            );
        });

        test('should handle configuration file missing "llms" property', async () => {
            const invalidStructure = {defaultLlmId: "test-llm-1"}; // Missing 'llms'
            Workspace_retry.mockResolvedValueOnce(invalidStructure);

            const result = await loader.loadConfigs(defaultConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Configuration file from ${defaultConfigPath} is malformed (e.g., not an object or missing 'llms' property).`,
                stage: 'validation',
                path: defaultConfigPath
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: Configuration file from ${defaultConfigPath} is malformed or missing 'llms' object.`,
                {path: defaultConfigPath, parsedResponse: invalidStructure}
            );
        });

        test('should use custom file path if provided to loadConfigs method', async () => {
            const customPath = "another/config.json";
            Workspace_retry.mockResolvedValueOnce(validConfigContent);
            await loader.loadConfigs(customPath);
            expect(Workspace_retry).toHaveBeenCalledWith(
                customPath,
                expect.any(Object),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number)
            );
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Attempting to load LLM configurations from: ${customPath}`);
        });

        test('should use default path if provided filePath to loadConfigs is empty or whitespace', async () => {
            Workspace_retry.mockResolvedValueOnce(validConfigContent);
            await loader.loadConfigs("   "); // Whitespace path
            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultConfigPath, // Should fall back to default
                expect.any(Object),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number)
            );
        });
    });
});

// --- FILE END ---