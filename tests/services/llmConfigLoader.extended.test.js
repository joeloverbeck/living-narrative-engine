// tests/services/llmConfigLoader.extended.test.js
// --- FILE START ---

import {jest, describe, beforeEach, test, expect} from '@jest/globals';
import {LlmConfigLoader} from '../../src/llms/services/llmConfigLoader.js';
import {Workspace_retry} from '../../src/utils/apiUtils.js';

jest.mock('../../src/utils/apiUtils.js', () => ({
    Workspace_retry: jest.fn(),
}));

const mockLoggerInstance = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
});

const mockSchemaValidatorInstance = () => ({
    addSchema: jest.fn().mockResolvedValue(undefined),
    removeSchema: jest.fn().mockReturnValue(true),
    getValidator: jest.fn().mockReturnValue(() => ({isValid: true, errors: null})),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    validate: jest.fn().mockReturnValue({isValid: true, errors: null}),
});

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
            return 'http://example.com/schemas/llm-configs.schema.json'; // Schema for the prompt config objects
        }
        return `http://example.com/schemas/${typeName}.schema.json`;
    }),
    getRuleSchemaId: jest.fn().mockReturnValue('http://example.com/schemas/rule.schema.json'),
});

// Updated default path for prompt configurations
const defaultPromptConfigPath = "config/llm-configs.json";

// Example valid llm-configs.json content (an array of prompt config objects)
const validPromptConfigsArray = [
    {
        config_id: "full_config_example_01",
        model_identifier: "anthropic/claude-3-sonnet-20240229",
        prompt_elements: [
            {key: "system_prompt", prefix: "<system_prompt>\n", suffix: "\n</system_prompt>"},
            {key: "context_world_lore", prefix: "<context_world_lore>\n", suffix: "\n</context_world_lore>"},
            {key: "user_input", prefix: "<user_input>\n", suffix: "\n</user_input>"},
            {key: "assistant_response_prefix", prefix: "Character: ", suffix: ""}
        ],
        prompt_assembly_order: ["system_prompt", "context_world_lore", "user_input"]
    },
    {
        config_id: "minimal_config_example_02",
        model_identifier: "generic-model-*",
        prompt_elements: [
            {key: "query", prefix: "", suffix: ""}
        ],
        prompt_assembly_order: ["query"]
    }
];

describe('LlmConfigLoader - Extended Prompt Config Tests', () => {
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
            configuration: configurationMock,
            // Uses the class default: "config/llm-configs.json"
        });
        Workspace_retry.mockReset();
    });

    describe('Prompt Configuration Array Parsing', () => {
        test('should correctly parse a valid llm-configs.json array with multiple entries', async () => {
            const mockConfigs = JSON.parse(JSON.stringify(validPromptConfigsArray));
            Workspace_retry.mockResolvedValueOnce(mockConfigs);
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: true, errors: null}); // Assume schema and semantic validation pass

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(Workspace_retry).toHaveBeenCalledWith(
                defaultPromptConfigPath,
                expect.any(Object), expect.any(Number), expect.any(Number), expect.any(Number)
            );
            expect(schemaValidatorMock.validate).toHaveBeenCalledWith(configurationMock.getContentTypeSchemaId('llm-configs'), mockConfigs);

            // Result should be the array itself
            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(mockConfigs);
            expect(result.length).toBe(2);

            // Check properties of the first config object
            const firstConfig = result[0];
            expect(firstConfig.config_id).toBe("full_config_example_01");
            expect(firstConfig.model_identifier).toBe("anthropic/claude-3-sonnet-20240229");
            expect(firstConfig.prompt_elements.length).toBe(4);
            expect(firstConfig.prompt_elements[0].key).toBe("system_prompt");
            expect(firstConfig.prompt_assembly_order).toEqual(["system_prompt", "context_world_lore", "user_input"]);

            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: LLM Prompt configuration file from ${defaultPromptConfigPath} passed semantic validation.`);
        });

        test('should handle an empty array as valid llm-configs.json content', async () => {
            const emptyArrayConfig = [];
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(emptyArrayConfig)));
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: true, errors: null});

            const result = await loader.loadConfigs(defaultPromptConfigPath);
            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual(emptyArrayConfig);
            expect(result.length).toBe(0);
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: LLM Prompt configuration file from ${defaultPromptConfigPath} passed semantic validation.`);
        });
    });

    describe('Optional Fields within a Prompt Config Object (as per schema)', () => {
        // The schema for llm-configs (data/schemas/llm-configs.schema.json)
        // defines all top-level properties of a config object as required.
        // So, "optional fields" tests would primarily relate to optional fields *within*
        // structures like prompt_elements, if any were defined as such, or if the
        // schema itself were to change to make some top-level fields optional.
        // For now, the schema enforces presence of config_id, model_identifier, etc.

        test('should parse correctly if all required fields in a config object are present', async () => {
            const singleEntryConfig = [{
                config_id: "test_config_001",
                model_identifier: "test/model-v1",
                prompt_elements: [{key: "main", prefix: "<p>", suffix: "</p>"}],
                prompt_assembly_order: ["main"]
            }];
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(singleEntryConfig)));
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: true, errors: null});

            const result = await loader.loadConfigs(defaultPromptConfigPath);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
            expect(result[0].config_id).toBe("test_config_001");
            expect(loggerMock.info).toHaveBeenCalledWith(`LlmConfigLoader: LLM Prompt configuration file from ${defaultPromptConfigPath} passed semantic validation.`);
        });
    });

    // Tests for 'defaultLlmId' are removed as it's not part of llm-configs.json structure.

    describe('Error Handling for Prompt Configs', () => {
        test('should return LoadConfigsErrorResult for syntactically invalid JSON', async () => {
            const parsingError = new SyntaxError("Unexpected token 'X' in JSON at position 0");
            Workspace_retry.mockRejectedValueOnce(parsingError);

            const result = await loader.loadConfigs(defaultPromptConfigPath);

            expect(result.error).toBe(true);
            // Message now refers to LLM Prompt configurations
            expect(result.message).toContain(`Failed to load, parse, or validate LLM Prompt configurations from ${defaultPromptConfigPath}: ${parsingError.message}`);
            expect(result.stage).toBe('parse');
            expect(result.originalError).toBe(parsingError);
            expect(result.path).toBe(defaultPromptConfigPath);
            expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
        });

        test('should return LoadConfigsErrorResult if schema validation fails for prompt configs (e.g., not an array)', async () => {
            const notAnArrayContent = {"some_object_not_array": true};
            Workspace_retry.mockResolvedValueOnce(notAnArrayContent);
            // This is the raw error object that schemaValidator.validate would return
            const rawSchemaError = {
                instancePath: "",
                keyword: "type",
                message: "must be array",
                schemaPath: "#/type",
                params: {type: "array"}
            };
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: false, errors: [rawSchemaError]});

            const result = await loader.loadConfigs(defaultPromptConfigPath);
            expect(result.error).toBe(true);
            expect(result.message).toBe('LLM Prompt configuration schema validation failed.');
            expect(result.stage).toBe('validation');
            expect(result.path).toBe(defaultPromptConfigPath);
            // Expect the standardized error structure
            expect(result.validationErrors).toEqual([
                expect.objectContaining({
                    errorType: "SCHEMA_VALIDATION",
                    configId: "N/A (root data)",
                    path: "(root)",
                    message: "must be array", // Message from the rawSchemaError
                    details: expect.objectContaining(rawSchemaError), // Original raw error in details
                    expected: "array" // Derived from rawSchemaError.params.type
                })
            ]);
        });

        test('should return LoadConfigsErrorResult if semantic validation fails for prompt configs', async () => {
            const semanticallyInvalidConfig = [{
                config_id: "bad_order",
                model_identifier: "test/model",
                prompt_elements: [{key: "system", prefix: "", suffix: ""}],
                prompt_assembly_order: ["non_existent_key"] // This key is not in prompt_elements
            }];
            Workspace_retry.mockResolvedValueOnce(JSON.parse(JSON.stringify(semanticallyInvalidConfig)));
            schemaValidatorMock.validate.mockReturnValueOnce({isValid: true, errors: null}); // Schema validation passes

            // We expect performSemanticValidations to return an error like:
            // {
            //   config_id: "bad_order",
            //   path: "prompt_assembly_order[0]", // Or similar, indicating the bad key
            //   message: "Key 'non_existent_key' not found...",
            //   errorType: "SEMANTIC_VALIDATION_KEY_NOT_FOUND",
            //   problematic_key_ref: "non_existent_key" // Assuming this field name from original test expectation
            // }
            // This test relies on the actual implementation of performSemanticValidations.

            const result = await loader.loadConfigs(defaultPromptConfigPath);
            expect(result.error).toBe(true);
            expect(result.message).toBe('LLM Prompt configuration semantic validation failed.');
            expect(result.stage).toBe('semantic_validation');
            expect(result.path).toBe(defaultPromptConfigPath);
            expect(result.semanticErrors).toBeDefined();
            expect(result.semanticErrors.length).toBeGreaterThan(0);

            const firstSemanticError = result.semanticErrors[0];
            expect(firstSemanticError.configId).toBe("bad_order"); // Check standardized camelCase field
            // Assuming performSemanticValidations's original error had 'problematic_key_ref' field
            // This will be in the 'details' of the standardized error.
            expect(firstSemanticError.details.problematic_key_ref).toBe("non_existent_key");
            // Also check other standardized fields
            expect(firstSemanticError.message).toContain("non_existent_key"); // Check the message on the standardized error
            expect(firstSemanticError.path).toBeDefined(); // Path should be a string
            expect(typeof firstSemanticError.path).toBe('string');
            expect(firstSemanticError.errorType).toBeDefined();
        });
    });
});

// --- FILE END ---