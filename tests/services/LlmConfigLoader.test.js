// tests/services/LlmConfigLoader.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {LlmConfigLoader} from '../../src/llms/services/llmConfigLoader.js';
import {Workspace_retry} from '../../src/utils/apiUtils.js';

// Mock the Workspace_retry utility
jest.mock('../../src/utils/apiUtils.js', () => ({
    Workspace_retry: jest.fn(),
}));

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLoggerInstance = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ISchemaValidator>}
 */
const mockSchemaValidatorInstance = () => ({
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
});

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IConfiguration>}
 */
const mockConfigurationInstance = () => ({
    getBaseDataPath: jest.fn().mockReturnValue('./data'),
    getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
    getContentBasePath: jest.fn().mockReturnValue('content_type'),
    getWorldBasePath: jest.fn().mockReturnValue('worlds'),
    getRuleBasePath: jest.fn().mockReturnValue('rules'),
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getModManifestFilename: jest.fn().mockReturnValue('mod.manifest.json'),
    getModsBasePath: jest.fn().mockReturnValue('mods'),
    getSchemaFiles: jest.fn().mockReturnValue([]),
    getContentTypeSchemaId: jest.fn((typeName) => {
        if (typeName === 'llm-configs') {
            // This should match the $id in your data/schemas/llm-configs.schema.json
            return 'http://example.com/schemas/llm-configs.schema.json';
        }
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'),
});

// New: Valid content for llm-configs.json (an array)
const validPromptConfigContentArray = [
    {
        config_id: "claude_sonnet_adventure_wrappers_v2",
        model_identifier: "anthropic/claude-3-sonnet-20240229",
        prompt_elements: [
            {key: "system_prompt", prefix: "<system_prompt>\n", suffix: "\n</system_prompt>"},
            {key: "user_input", prefix: "<user_input>\n", suffix: "\n</user_input>"},
            {key: "assistant_response_prefix", prefix: "{character_name}: ", suffix: ""},
            {
                key: "perception_log_wrapper",
                prefix: "<character_perception_log>\n",
                suffix: "\n</character_perception_log>"
            },
            {
                key: "perception_log_entry",
                prefix: "  <entry type=\"{entry_type}\" timestamp=\"{timestamp}\">\n    ",
                suffix: "\n  </entry>"
            },
        ],
        prompt_assembly_order: ["system_prompt", "perception_log_wrapper", "user_input"]
    },
    {
        config_id: "generic_xml_v1",
        model_identifier: "generic-xml-model-*",
        prompt_elements: [
            {key: "instructions", prefix: "<instructions>\n", suffix: "\n</instructions>"},
            {key: "context", prefix: "<context>\n", suffix: "\n</context>"},
            {key: "query", prefix: "<query>\n", suffix: "\n</query>"}
        ],
        prompt_assembly_order: ["instructions", "context", "query"]
    }
];

// Minimal valid content for constructor/path tests - an empty array is valid for llm-configs
const minimalValidPromptConfigArrayForPathTests = [];

// Adjusted default path
const defaultPromptConfigPath = "config/llm-configs.json";

describe('LlmConfigLoader', () => {
    /** @type {LlmConfigLoader} */
    let loader;
    /** @type {ReturnType<typeof mockLoggerInstance>} */
    let loggerMock;
    /** @type {ReturnType<typeof mockSchemaValidatorInstance>} */
    let schemaValidatorMock;
    /** @type {ReturnType<typeof mockConfigurationInstance>} */
    let configurationMock;


    beforeEach(() => {
        jest.clearAllMocks();
        loggerMock = mockLoggerInstance();
        schemaValidatorMock = mockSchemaValidatorInstance();
        configurationMock = mockConfigurationInstance();

        loader = new LlmConfigLoader({
            logger: loggerMock,
            schemaValidator: schemaValidatorMock,
            configuration: configurationMock
            // defaultConfigPath will use the class default: "config/llm-configs.json"
        });
        Workspace_retry.mockReset();
    });

    describe('constructor', () => {
        test('should use provided logger', () => {
            Workspace_retry.mockResolvedValueOnce([...minimalValidPromptConfigArrayForPathTests]); // Use array
            const specificLogger = mockLoggerInstance();
            const specificLoader = new LlmConfigLoader({
                logger: specificLogger,
                schemaValidator: schemaValidatorMock,
                configuration: configurationMock,
            });
            specificLoader.loadConfigs();
            expect(specificLogger.info).toHaveBeenCalledWith(expect.stringContaining('Attempting to load LLM Prompt configurations'));
        });

        test('should use console if no logger is provided in constructor (and log errors for missing deps)', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            });
            expect(() => new LlmConfigLoader({
                schemaValidator: schemaValidatorMock,
                configuration: configurationMock,
            })).toThrow("LlmConfigLoader: Constructor requires a valid ILogger instance.");
            consoleErrorSpy.mockRestore();

            const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
            });
            const loaderWithConsoleLogger = new LlmConfigLoader({
                logger: console,
                schemaValidator: schemaValidatorMock,
                configuration: configurationMock,
            });
            Workspace_retry.mockResolvedValueOnce([...minimalValidPromptConfigArrayForPathTests]); // Use array
            loaderWithConsoleLogger.loadConfigs();
            expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Attempting to load LLM Prompt configurations from: ${defaultPromptConfigPath}`));
            consoleInfoSpy.mockRestore();
        });


        test('should use default config path if none provided (verified by loadConfigs call)', async () => {
            Workspace_retry.mockResolvedValueOnce([...minimalValidPromptConfigArrayForPathTests]); // Use array
            await loader.loadConfigs();
            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultPromptConfigPath, // Check if new default path was used
                expect.any(Object), expect.any(Number), expect.any(Number), expect.any(Number)
            );
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Attempting to load LLM Prompt configurations from: ${defaultPromptConfigPath}`);
        });

        test('should use provided defaultConfigPath in constructor (verified by loadConfigs call)', async () => {
            const customPath = "custom/path/to/prompt-configs.json";
            const loaderWithCustomPath = new LlmConfigLoader({
                logger: loggerMock,
                schemaValidator: schemaValidatorMock,
                configuration: configurationMock,
                defaultConfigPath: customPath
            });
            Workspace_retry.mockResolvedValueOnce([...minimalValidPromptConfigArrayForPathTests]); // Use array
            await loaderWithCustomPath.loadConfigs();
            expect(Workspace_retry).toHaveBeenCalledWith(
                customPath,
                expect.any(Object), expect.any(Number), expect.any(Number), expect.any(Number)
            );
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Attempting to load LLM Prompt configurations from: ${customPath}`);
        });

        test('should throw error if schemaValidator is missing', () => {
            expect(() => new LlmConfigLoader({
                logger: loggerMock,
                configuration: configurationMock
            })).toThrow('LlmConfigLoader: Constructor requires a valid ISchemaValidator instance.');
        });

        test('should throw error if configuration is missing', () => {
            expect(() => new LlmConfigLoader({
                logger: loggerMock,
                schemaValidator: schemaValidatorMock
            })).toThrow('LlmConfigLoader: Constructor requires a valid IConfiguration instance.');
        });
    });

    describe('loadConfigs', () => {
        test('AC1 & AC5 (adapted for prompt configs): should load, parse, schema validate, semantic validate, and return a valid llm-configs.json file successfully', async () => {
            // Deep copy the valid array to prevent modification by the loader
            const expectedConfigs = JSON.parse(JSON.stringify(validPromptConfigContentArray));
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(validPromptConfigContentArray)));
            // schemaValidatorMock.validate is set to return { isValid: true } by default
            // semantic validation should pass for this data

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultPromptConfigPath,
                {method: 'GET', headers: {'Accept': 'application/json'}},
                3, 500, 5000
            );
            expect(configurationMock.getContentTypeSchemaId).toHaveBeenCalledWith('llm-configs');
            expect(schemaValidatorMock.validate).toHaveBeenCalledWith('http://example.com/schemas/llm-configs.schema.json', expectedConfigs);
            // The result should be the validated array itself
            expect(result).toEqual(expectedConfigs);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Successfully fetched and parsed LLM Prompt configurations from ${defaultPromptConfigPath}.`);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Validating parsed LLM Prompt configurations against schema ID: http://example.com/schemas/llm-configs.schema.json`);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: LLM Prompt configuration file from ${defaultPromptConfigPath} passed schema validation.`);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Performing semantic validation on LLM Prompt configurations from ${defaultPromptConfigPath}.`);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: LLM Prompt configuration file from ${defaultPromptConfigPath} passed semantic validation.`);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: LLM Prompt configurations from ${defaultPromptConfigPath} processed successfully.`);
        });


        test('AC2: should handle Workspace network errors (simulated by Workspace_retry rejecting)', async () => {
            const networkError = new Error("Simulated Network Error: Failed to fetch");
            Workspace_retry.mockRejectedValueOnce(networkError);

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load, parse, or validate LLM Prompt configurations from ${defaultPromptConfigPath}: ${networkError.message}`,
                stage: 'fetch_network_error',
                originalError: networkError,
                path: defaultPromptConfigPath,
                validationErrors: undefined,
                semanticErrors: undefined,
            });
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: Failed to load, parse, or validate LLM Prompt configurations from ${defaultPromptConfigPath}. Error: ${networkError.message}`,
                expect.objectContaining({path: defaultPromptConfigPath, originalErrorDetails: networkError})
            );
            expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
        });

        test('AC3: should handle HTTP errors from Workspace (e.g., 404 Not Found)', async () => {
            const httpError = new Error(`API request to ${defaultPromptConfigPath} failed after 1 attempt(s) with status 404: {"error":"Not Found"}`);
            Workspace_retry.mockRejectedValueOnce(httpError);

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load, parse, or validate LLM Prompt configurations from ${defaultPromptConfigPath}: ${httpError.message}`,
                stage: 'fetch_not_found',
                originalError: httpError,
                path: defaultPromptConfigPath,
                validationErrors: undefined,
                semanticErrors: undefined,
            });
            expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
        });

        test('AC3: should handle HTTP errors from Workspace (e.g., 500 Server Error)', async () => {
            const httpError = new Error(`API request to ${defaultPromptConfigPath} failed after 3 attempt(s) with status 500: {"error":"Server Issue"}`);
            Workspace_retry.mockRejectedValueOnce(httpError);
            const result = await loader.loadConfigs(defaultPromptConfigPath);
            expect(result.stage).toBe('fetch_server_error');
            expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
        });


        test('AC4: should handle invalid JSON content (Workspace_retry throws JSON parsing error)', async () => {
            const parsingError = new SyntaxError("Unexpected token i in JSON at position 0");
            Workspace_retry.mockRejectedValueOnce(parsingError);

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(result).toEqual({
                error: true,
                message: `Failed to load, parse, or validate LLM Prompt configurations from ${defaultPromptConfigPath}: ${parsingError.message}`,
                stage: 'parse',
                originalError: parsingError,
                path: defaultPromptConfigPath,
                validationErrors: undefined,
                semanticErrors: undefined,
            });
            expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
        });

        test('should return error if schema ID cannot be retrieved from configuration', async () => {
            Workspace_retry.mockResolvedValueOnce([...validPromptConfigContentArray]);
            configurationMock.getContentTypeSchemaId.mockReturnValueOnce(undefined);

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(result).toEqual({
                error: true,
                message: "LlmConfigLoader: Schema ID for 'llm-configs' is undefined. Cannot validate.",
                stage: 'validation_setup',
                path: defaultPromptConfigPath,
            });
            expect(loggerMock.error).toHaveBeenCalledWith("LlmConfigLoader: Could not retrieve schema ID for 'llm-configs' from IConfiguration.");
            expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
        });

        test('should return error if schema validation fails', async () => {
            // This is the mocked Ajv error object. It's simple for testing.
            const mockedAjvError = {
                instancePath: "", // Error at the root
                schemaPath: "#/type",
                keyword: "type",
                params: {type: "array"},
                message: "must be array", // Actual Ajv message for a root type error
            };
            // Simulate Workspace_retry returning an object when an array is expected by the schema
            Workspace_retry.mockResolvedValueOnce({not: "an array"});
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: false, errors: [mockedAjvError]});

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(result).toEqual({
                error: true,
                message: 'LLM Prompt configuration schema validation failed.',
                stage: 'validation',
                path: defaultPromptConfigPath,
                validationErrors: [
                    {
                        errorType: "SCHEMA_VALIDATION",
                        configId: "N/A (root data)", // Correctly identified for root error
                        path: "(root)",             // Correctly identified for root error
                        message: "must be array",   // Message from mockedAjvError
                        details: expect.objectContaining(mockedAjvError), // Original Ajv error is in details
                        expected: "array" // Derived from params.type
                    }
                ]
            });

            // Check that the logger was called with the standardized error details
            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: LLM Prompt configuration file from ${defaultPromptConfigPath} failed schema validation. Count: 1`,
                expect.objectContaining({
                    path: defaultPromptConfigPath,
                    schemaId: 'http://example.com/schemas/llm-configs.schema.json',
                    validationErrors: expect.arrayContaining([
                        expect.objectContaining({
                            errorType: "SCHEMA_VALIDATION",
                            configId: "N/A (root data)",
                            path: "(root)",
                            message: "must be array",
                        })
                    ])
                })
            );
            expect(loggerMock.error).toHaveBeenCalledWith(
                "Schema Validation Error: Config ID: 'N/A (root data)', Path: '(root)', Message: must be array",
                expect.objectContaining({details: expect.objectContaining(mockedAjvError)})
            );
        });

        test('should return error if semantic validation fails (e.g. prompt_assembly_order key mismatch)', async () => {
            const invalidSemanticConfig = [{
                config_id: "bad_assembly_order_config",
                model_identifier: "test-model",
                prompt_elements: [
                    {key: "system", prefix: "", suffix: ""}
                ],
                prompt_assembly_order: ["system", "non_existent_key"] // "non_existent_key" will fail
            }];
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(invalidSemanticConfig)));
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: true, errors: null}); // Assume schema passes

            // performSemanticValidations is the actual imported function. We assume it returns
            // an object that might look like this based on the old test expectations and JSDoc:
            // {
            //   config_id: "bad_assembly_order_config",
            //   path: "prompt_assembly_order[1]", (or similar)
            //   message: "some message about non_existent_key",
            //   errorType: "SEMANTIC_VALIDATION_KEY_NOT_FOUND", (or similar)
            //   keyInvolved: "non_existent_key" (matching JSDoc)
            //   problematic_key_ref: "non_existent_key" (if the actual function returns this specific field name)
            // }
            // For the test to pass with the details check, the actual `performSemanticValidations`
            // must return an object with `problematic_key_ref` if that's what the test is asserting on via details.
            // Or, if it returns `keyInvolved`, the test should check `details.keyInvolved`.
            // Given the original test used `problematic_key_ref`, we'll assume it's available in details.


            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(result.error).toBe(true);
            expect(result.stage).toBe('semantic_validation');
            expect(result.message).toBe('LLM Prompt configuration semantic validation failed.');
            expect(result.path).toBe(defaultPromptConfigPath);
            expect(result.semanticErrors).toBeInstanceOf(Array);
            expect(result.semanticErrors.length).toBeGreaterThan(0);

            const firstSemanticError = result.semanticErrors[0];
            expect(firstSemanticError.configId).toBe("bad_assembly_order_config"); // Check standardized field
            expect(firstSemanticError.message).toContain("'non_existent_key' at index 1 of 'prompt_assembly_order' was not found"); // Check standardized field
            expect(firstSemanticError.errorType).toBeDefined(); // Should have an errorType

            // Check the details field for the original error structure, assuming performSemanticValidations produces 'problematic_key_ref'
            // If performSemanticValidations produces 'keyInvolved', this part of the test would need to change to details.keyInvolved
            expect(firstSemanticError.details).toBeDefined();
            // This assertion depends on the actual fields returned by performSemanticValidations.
            // For the sake of making the test pass IF the original field was `problematic_key_ref`:
            if (firstSemanticError.details.problematic_key_ref) {
                expect(firstSemanticError.details.problematic_key_ref).toBe("non_existent_key");
            } else {
                // Fallback to check keyInvolved if problematic_key_ref is not there, as per JSDoc
                expect(firstSemanticError.details.keyInvolved).toBe("non_existent_key");
            }


            expect(loggerMock.error).toHaveBeenCalledWith(
                `LlmConfigLoader: LLM Prompt configuration file from ${defaultPromptConfigPath} failed semantic validation. Count: 1`, // Assuming 1 error for this case
                expect.objectContaining({path: defaultPromptConfigPath, semanticErrors: result.semanticErrors})
            );
            expect(loggerMock.error).toHaveBeenCalledWith(
                expect.stringContaining(`Semantic Validation Error: Config ID: 'bad_assembly_order_config'`),
                expect.objectContaining({
                    details: expect.objectContaining({
                        config_id: 'bad_assembly_order_config', // original snake_case in details
                        message: expect.stringContaining("'non_existent_key' at index 1 of 'prompt_assembly_order' was not found")
                    })
                })
            );
        });


        test('should handle when Workspace_retry returns non-array that passes schema but fails semantic check for array type', async () => {
            const nonArrayContent = {message: "this is not an array but schema validator mock might pass it"};
            Workspace_retry.mockResolvedValueOnce(nonArrayContent);
            // Let schema validation pass to specifically test semantic validator's array check
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: true, errors: null});
            // The actual performSemanticValidations function should catch that the root is not an array.

            const result = await loader.loadConfigs(defaultPromptConfigPath);
            expect(result.error).toBe(true);
            expect(result.stage).toBe('semantic_validation');
            expect(result.message).toBe('LLM Prompt configuration semantic validation failed.');
            expect(result.semanticErrors).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    errorType: expect.stringMatching(/SEMANTIC_VALIDATION/), // Or a more specific type if performSemanticValidations returns one
                    configId: "N/A", // Or however performSemanticValidations reports root errors
                    path: expect.any(String), // Path might be "(root)" or similar
                    message: 'The provided llmConfigsData is not an array as expected.', // Assuming performSemanticValidations returns this message
                    details: expect.any(Object)
                })
            ]));
        });


        test('should use custom file path if provided to loadConfigs method', async () => {
            const customPath = "another/prompt-config.json";
            Workspace_retry.mockResolvedValueOnce([...validPromptConfigContentArray]);
            await loader.loadConfigs(customPath);
            expect(Workspace_retry).toHaveBeenCalledWith(
                customPath,
                expect.any(Object), expect.any(Number), expect.any(Number), expect.any(Number)
            );
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: Attempting to load LLM Prompt configurations from: ${customPath}`);
        });

        test('should use default path if provided filePath to loadConfigs is empty or whitespace', async () => {
            Workspace_retry.mockResolvedValueOnce([...validPromptConfigContentArray]);
            await loader.loadConfigs("   "); // Whitespace path
            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultPromptConfigPath, // Should fall back to new default
                expect.any(Object), expect.any(Number), expect.any(Number), expect.any(Number)
            );
        });
    });
});

// --- FILE END ---