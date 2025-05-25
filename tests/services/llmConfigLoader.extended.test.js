// tests/services/llmConfigLoader.extended.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {LlmConfigLoader} from '../../src/services/llmConfigLoader.js'; // Adjust path as needed
import {Workspace_retry} from '../../src/utils/apiUtils.js'; // Adjust path as needed

// Mock the Workspace_retry utility
jest.mock('../../src/utils/apiUtils.js', () => ({
    Workspace_retry: jest.fn(),
}));

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>} // Assuming ILogger path
 */
const mockLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

const defaultConfigPath = "config/llm-configs.json";

describe('LlmConfigLoader - Extended Schema Tests', () => {
    /** @type {LlmConfigLoader} */
    let loader;
    /** @type {ReturnType<typeof mockLogger>} */
    let loggerMock;

    beforeEach(() => {
        jest.clearAllMocks();
        loggerMock = mockLogger();
        loader = new LlmConfigLoader({logger: loggerMock});
        Workspace_retry.mockReset();
    });

    describe('Full Schema Parsing (Task 2)', () => {
        test('should correctly parse an LLM configuration entry with all fields from Table 3', async () => {
            const fullSchemaConfig = {
                id: "full-schema-llm",
                displayName: "Full Schema LLM",
                apiKeyEnvVar: "FULL_SCHEMA_API_KEY",
                endpointUrl: "https://api.example.com/full-schema",
                modelIdentifier: "full-schema-model-v1",
                apiType: "openai_compatible",
                promptFrame: {
                    system: "You are a helpful assistant.",
                    user: "User query: {{query}}",
                    assistantPrefix: "Assistant response: "
                },
                contextTokenLimit: 8192,
                jsonOutputStrategy: {
                    method: "tool_calling",
                    toolName: "json_extractor",
                    grammar: "root ::= object", // Though not typical for tool_calling, testing it's parsed
                },
                defaultParameters: {
                    temperature: 0.7,
                    max_tokens: 1024,
                    top_p: 0.9,
                },
                providerSpecificHeaders: {
                    "X-Custom-Header": "CustomValue",
                    "Authorization-Bearer": "should-be-overridden-by-api-key"
                }
            };

            const mockConfigsFile = {
                defaultLlmId: "full-schema-llm",
                llms: {
                    "full-schema-llm": {...fullSchemaConfig}
                }
            };

            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile))); // Deep copy

            const result = await loader.loadConfigs(defaultConfigPath);

            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultConfigPath,
                expect.any(Object), // options
                expect.any(Number), // maxRetries
                expect.any(Number), // baseDelayMs
                expect.any(Number)  // maxDelayMs
            );

            expect(result.error).toBeUndefined();
            expect(result.llms).toBeDefined();
            expect(result.llms["full-schema-llm"]).toBeDefined();

            const parsedConfig = result.llms["full-schema-llm"];
            expect(parsedConfig.id).toBe(fullSchemaConfig.id);
            expect(parsedConfig.displayName).toBe(fullSchemaConfig.displayName);
            expect(parsedConfig.apiKeyEnvVar).toBe(fullSchemaConfig.apiKeyEnvVar);
            expect(parsedConfig.endpointUrl).toBe(fullSchemaConfig.endpointUrl);
            expect(parsedConfig.modelIdentifier).toBe(fullSchemaConfig.modelIdentifier);
            expect(parsedConfig.apiType).toBe(fullSchemaConfig.apiType);
            expect(parsedConfig.promptFrame).toEqual(fullSchemaConfig.promptFrame);
            expect(parsedConfig.contextTokenLimit).toBe(fullSchemaConfig.contextTokenLimit);
            expect(parsedConfig.jsonOutputStrategy).toEqual(fullSchemaConfig.jsonOutputStrategy);
            expect(parsedConfig.defaultParameters).toEqual(fullSchemaConfig.defaultParameters);
            expect(parsedConfig.providerSpecificHeaders).toEqual(fullSchemaConfig.providerSpecificHeaders);
        });

        test('should correctly parse promptFrame when it is a string', async () => {
            const promptFrameString = "System: You are a test bot. User: {{query}}";
            const configWithPromptString = {
                id: "prompt-string-llm",
                displayName: "Prompt String LLM",
                endpointUrl: "https://api.example.com/prompt-string",
                modelIdentifier: "prompt-string-model",
                apiType: "generic",
                promptFrame: promptFrameString,
                jsonOutputStrategy: {method: "native_json_mode"}
            };
            const mockConfigsFile = {
                llms: {"prompt-string-llm": {...configWithPromptString}}
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            expect(result.llms["prompt-string-llm"].promptFrame).toBe(promptFrameString);
        });
    });

    describe('Optional Fields Handling (Task 3)', () => {
        test('All Optional Fields Missing: should parse successfully and apply defaults', async () => {
            const minimalConfig = {
                // Required fields
                id: "minimal-llm",
                displayName: "Minimal LLM",
                endpointUrl: "https://api.example.com/minimal",
                modelIdentifier: "minimal-model",
                apiType: "ollama",
                jsonOutputStrategy: {
                    method: "native_json_mode"
                }
            };
            const mockConfigsFile = {
                llms: {"minimal-llm": {...minimalConfig}}
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));

            const result = await loader.loadConfigs();
            expect(result.error).toBeUndefined();
            const parsedConfig = result.llms["minimal-llm"];

            expect(parsedConfig).toBeDefined();
            expect(parsedConfig.id).toBe(minimalConfig.id);
            expect(parsedConfig.displayName).toBe(minimalConfig.displayName);
            expect(parsedConfig.endpointUrl).toBe(minimalConfig.endpointUrl);
            expect(parsedConfig.modelIdentifier).toBe(minimalConfig.modelIdentifier);
            expect(parsedConfig.apiType).toBe(minimalConfig.apiType);
            expect(parsedConfig.jsonOutputStrategy.method).toBe("native_json_mode");

            expect(parsedConfig.defaultParameters).toEqual({});
            expect(parsedConfig.providerSpecificHeaders).toEqual({});
            expect(parsedConfig.apiKeyEnvVar).toBeUndefined();
            expect(parsedConfig.promptFrame).toBeUndefined();
            expect(parsedConfig.contextTokenLimit).toBeUndefined();
            expect(parsedConfig.jsonOutputStrategy.toolName).toBeUndefined();
            expect(parsedConfig.jsonOutputStrategy.grammar).toBeUndefined();
        });

        test('Individual Optional Fields: promptFrame as object', async () => {
            const promptFrameObj = {system: "System prompt", user: "User: {{input}}"};
            const mockConfigsFile = {
                llms: {
                    "test-llm": {
                        id: "test-llm",
                        displayName: "Test",
                        endpointUrl: "url",
                        modelIdentifier: "model",
                        apiType: "type",
                        jsonOutputStrategy: {method: "method"},
                        promptFrame: promptFrameObj
                    }
                }
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            expect(result.llms["test-llm"].promptFrame).toEqual(promptFrameObj);
        });

        test('Individual Optional Fields: jsonOutputStrategy with only method', async () => {
            const mockConfigsFile = {
                llms: {
                    "test-llm": {
                        id: "test-llm",
                        displayName: "Test",
                        endpointUrl: "url",
                        modelIdentifier: "model",
                        apiType: "type",
                        jsonOutputStrategy: {method: "some_method_only"}
                    }
                }
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            const strategy = result.llms["test-llm"].jsonOutputStrategy;
            expect(strategy.method).toBe("some_method_only");
            expect(strategy.toolName).toBeUndefined();
            expect(strategy.grammar).toBeUndefined();
        });

        test('Individual Optional Fields: jsonOutputStrategy with method and toolName', async () => {
            const toolName = "my_tool";
            const mockConfigsFile = {
                llms: {
                    "test-llm": {
                        id: "test-llm",
                        displayName: "Test",
                        endpointUrl: "url",
                        modelIdentifier: "model",
                        apiType: "type",
                        jsonOutputStrategy: {method: "tool_calling", toolName: toolName}
                    }
                }
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            const strategy = result.llms["test-llm"].jsonOutputStrategy;
            expect(strategy.method).toBe("tool_calling");
            expect(strategy.toolName).toBe(toolName);
            expect(strategy.grammar).toBeUndefined();
        });

        test('Individual Optional Fields: jsonOutputStrategy with method and grammar', async () => {
            const grammar = "root ::= {}";
            const mockConfigsFile = {
                llms: {
                    "test-llm": {
                        id: "test-llm",
                        displayName: "Test",
                        endpointUrl: "url",
                        modelIdentifier: "model",
                        apiType: "type",
                        jsonOutputStrategy: {method: "gbnf_grammar", grammar: grammar}
                    }
                }
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            const strategy = result.llms["test-llm"].jsonOutputStrategy;
            expect(strategy.method).toBe("gbnf_grammar");
            expect(strategy.grammar).toBe(grammar);
            expect(strategy.toolName).toBeUndefined();
        });

        test('Individual Optional Fields: defaultParameters and providerSpecificHeaders present', async () => {
            const defaultParams = {temp: 0.1};
            const headers = {"X-Test": "true"};
            const mockConfigsFile = {
                llms: {
                    "test-llm": {
                        id: "test-llm",
                        displayName: "Test",
                        endpointUrl: "url",
                        modelIdentifier: "model",
                        apiType: "type",
                        jsonOutputStrategy: {method: "method"},
                        defaultParameters: defaultParams,
                        providerSpecificHeaders: headers
                    }
                }
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            expect(result.llms["test-llm"].defaultParameters).toEqual(defaultParams);
            expect(result.llms["test-llm"].providerSpecificHeaders).toEqual(headers);
        });
    });

    describe('defaultLlmId Handling (Task 4)', () => {
        const dummyLlmConfig = {
            id: "llm1",
            displayName: "LLM One",
            endpointUrl: "url1",
            modelIdentifier: "model1",
            apiType: "type1",
            jsonOutputStrategy: {method: "method1"}
        };

        test('should correctly parse defaultLlmId when present and valid', async () => {
            const mockConfigsFile = {
                defaultLlmId: "llm1",
                llms: {"llm1": {...dummyLlmConfig}}
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            expect(result.defaultLlmId).toBe("llm1");
        });

        test('should correctly parse defaultLlmId even if it points to a non-existent LLM ID', async () => {
            // The loader's job is to parse; validation of the ID's existence is for the consumer.
            const mockConfigsFile = {
                defaultLlmId: "non-existent-llm",
                llms: {"llm1": {...dummyLlmConfig}}
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            expect(result.defaultLlmId).toBe("non-existent-llm");
        });

        test('should result in undefined defaultLlmId if it is missing from the config file', async () => {
            const mockConfigsFile = {
                // defaultLlmId is missing
                llms: {"llm1": {...dummyLlmConfig}}
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            expect(result.defaultLlmId).toBeUndefined();
        });

        test('should correctly parse defaultLlmId if it is present but an empty string', async () => {
            // The loader parses what's there; consumer decides if empty string is valid.
            const mockConfigsFile = {
                defaultLlmId: "",
                llms: {"llm1": {...dummyLlmConfig}}
            };
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(mockConfigsFile)));
            const result = await loader.loadConfigs();
            expect(result.defaultLlmId).toBe("");
        });
    });

    describe('Error Handling (Task 6 - Loader Perspective)', () => {
        test('should return LoadConfigsErrorResult for syntactically invalid JSON', async () => {
            // Simulate Workspace_retry itself throwing a SyntaxError, as if response.json() failed.
            const parsingError = new SyntaxError("Unexpected token N in JSON at position 0");
            Workspace_retry.mockRejectedValueOnce(parsingError); // Simulate parsing failure

            const result = await loader.loadConfigs(defaultConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load or parse LLM configurations from ${defaultConfigPath}: ${parsingError.message}`,
                stage: 'parse', // Assuming Workspace_retry correctly categorizes or the loader does
                originalError: parsingError,
                path: defaultConfigPath
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.stringContaining(`Failed to load or parse LLM configurations from ${defaultConfigPath}. Error: ${parsingError.message}`),
                expect.anything()
            );
        });

        test('should return LoadConfigsErrorResult if top-level "llms" object is missing', async () => {
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

        test('should return LoadConfigsErrorResult if parsed content is not an object (e.g. string, null)', async () => {
            Workspace_retry.mockResolvedValueOnce("not an object");

            const result = await loader.loadConfigs(defaultConfigPath);
            expect(result).toEqual({
                error: true,
                message: `Configuration file from ${defaultConfigPath} is malformed (e.g., not an object or missing 'llms' property).`,
                stage: 'validation',
                path: defaultConfigPath,
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: Configuration file from ${defaultConfigPath} is malformed or missing 'llms' object.`,
                {path: defaultConfigPath, parsedResponse: "not an object"}
            );

            Workspace_retry.mockResolvedValueOnce(null);
            const resultNull = await loader.loadConfigs(defaultConfigPath);
            expect(resultNull).toEqual({
                error: true,
                message: `Configuration file from ${defaultConfigPath} is malformed (e.g., not an object or missing 'llms' property).`,
                stage: 'validation',
                path: defaultConfigPath,
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: Configuration file from ${defaultConfigPath} is malformed or missing 'llms' object.`,
                {path: defaultConfigPath, parsedResponse: null}
            );
        });
    });
});

// --- FILE END ---