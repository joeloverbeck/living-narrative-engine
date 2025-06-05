// tests/services/llmConfigLoader.extended.test.js
// --- FILE START ---

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
// Correct the import path based on your actual project structure
// Assuming LlmConfigLoader is now in 'src/services/' not 'src/llms/services/'
import { LlmConfigLoader } from '../../src/llms/services/llmConfigLoader.js';
import { Workspace_retry } from '../../src/utils/apiUtils.js';

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
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
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
      return 'http://example.com/schemas/llm-configs.schema.json';
    }
    return `http://example.com/schemas/${typeName}.schema.json`;
  }),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/rule.schema.json'),
});

const defaultLlmConfigPath = 'dependencyInjection/llm-configs.json'; // Renamed for clarity

// Example valid llm-configs.json content, now as a root object
const mockValidRootConfig = {
  defaultConfigId: 'full_config_example_01',
  configs: {
    full_config_example_01: {
      configId: 'full_config_example_01', // Recommended to match key
      displayName: 'Full Example 1',
      modelIdentifier: 'anthropic/claude-3-sonnet-20240229',
      endpointUrl: 'https://api.anthropic.com/v1/messages',
      apiType: 'anthropic_messages',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [
        {
          key: 'system_prompt',
          prefix: '<system_prompt>\n',
          suffix: '\n</system_prompt>',
        },
        {
          key: 'context_world_lore',
          prefix: '<context_world_lore>\n',
          suffix: '\n</context_world_lore>',
        },
        {
          key: 'user_input',
          prefix: '<user_input>\n',
          suffix: '\n</user_input>',
        },
        { key: 'assistant_response_prefix', prefix: 'Character: ', suffix: '' },
      ],
      promptAssemblyOrder: [
        'system_prompt',
        'context_world_lore',
        'user_input',
        'assistant_response_prefix',
      ],
    },
    minimal_config_example_02: {
      configId: 'minimal_config_example_02', // Recommended to match key
      displayName: 'Minimal Example 2',
      modelIdentifier: 'generic-model-*',
      endpointUrl: 'http://localhost:8080/v1/chat/completions',
      apiType: 'openai_compatible',
      jsonOutputStrategy: { method: 'native_json_mode' },
      promptElements: [{ key: 'query', prefix: '', suffix: '' }],
      promptAssemblyOrder: ['query'],
    },
  },
};

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
    });
    Workspace_retry.mockReset();
  });

  describe('LLM Root Configuration Parsing', () => {
    test('should correctly parse a valid llm-configs.json root object with multiple entries', async () => {
      const localMockValidRootConfig = JSON.parse(
        JSON.stringify(mockValidRootConfig)
      );
      Workspace_retry.mockResolvedValueOnce(localMockValidRootConfig);
      // Schema validation should pass for this valid root object
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: true,
        errors: null,
      });

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(Workspace_retry).toHaveBeenCalledWith(
        defaultLlmConfigPath,
        expect.any(Object),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );
      expect(schemaValidatorMock.validate).toHaveBeenCalledWith(
        configurationMock.getContentTypeSchemaId('llm-configs'),
        localMockValidRootConfig
      );

      expect(result.error).toBeUndefined();
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(result.defaultConfigId).toBe('full_config_example_01');
      expect(result.configs).toBeDefined();
      expect(Object.keys(result.configs).length).toBe(2);

      const firstConfig = result.configs['full_config_example_01'];
      expect(firstConfig).toBeDefined();
      expect(firstConfig.configId).toBe('full_config_example_01');
      expect(firstConfig.modelIdentifier).toBe(
        'anthropic/claude-3-sonnet-20240229'
      );
      expect(firstConfig.promptElements.length).toBe(4);
      expect(firstConfig.promptElements[0].key).toBe('system_prompt');
      expect(firstConfig.promptAssemblyOrder).toEqual([
        'system_prompt',
        'context_world_lore',
        'user_input',
        'assistant_response_prefix',
      ]);

      expect(loggerMock.info).toHaveBeenCalledWith(
        `LlmConfigLoader: Semantic validation passed for ${defaultLlmConfigPath}.`
      );
      // Also check the final success log to be thorough
      expect(loggerMock.info).toHaveBeenCalledWith(
        `LlmConfigLoader: LLM Prompt configurations from ${defaultLlmConfigPath} processed successfully.`
      );
    });

    test('should handle a minimal valid root configuration (e.g., empty configs map)', async () => {
      const minimalRootConfig = {
        defaultConfigId: 'some_default_or_placeholder', // Schema requires defaultConfigId
        configs: {}, // Empty configs map
      };
      Workspace_retry.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalRootConfig))
      );
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: true,
        errors: null,
      }); // Assume this is schema-valid

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBeUndefined();
      expect(typeof result).toBe('object');
      expect(result.defaultConfigId).toBe('some_default_or_placeholder');
      expect(result.configs).toEqual({});
      // CORRECTED LOG EXPECTATION:
      expect(loggerMock.info).toHaveBeenCalledWith(
        `LlmConfigLoader: Semantic validation passed for ${defaultLlmConfigPath}.`
      );
      // Also check the final success log
      expect(loggerMock.info).toHaveBeenCalledWith(
        `LlmConfigLoader: LLM Prompt configurations from ${defaultLlmConfigPath} processed successfully.`
      );
    });
  });

  describe('Individual Configuration Object Parsing (within root.configs)', () => {
    test('should parse correctly if all required fields in a dependencyInjection object are present', async () => {
      const singleEntryRootConfig = {
        defaultConfigId: 'test_config_001',
        configs: {
          test_config_001: {
            configId: 'test_config_001', // Required
            displayName: 'Test Config 001', // Required
            modelIdentifier: 'test/model-v1', // Required
            endpointUrl: 'http://example.com/api', // Required
            apiType: 'custom', // Required
            jsonOutputStrategy: { method: 'manual_prompting' }, // Required
            promptElements: [{ key: 'main', prefix: '<p>', suffix: '</p>' }], // Required
            promptAssemblyOrder: ['main'], // Required
            // Optional fields like apiKeyEnvVar, apiKeyFileName, defaultParameters, etc., are omitted
          },
        },
      };
      Workspace_retry.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(singleEntryRootConfig))
      );
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: true,
        errors: null,
      });

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBeUndefined();
      expect(result.defaultConfigId).toBe('test_config_001');
      expect(result.configs).toHaveProperty('test_config_001');
      expect(result.configs['test_config_001'].configId).toBe(
        'test_config_001'
      );
      expect(result.configs['test_config_001'].modelIdentifier).toBe(
        'test/model-v1'
      );
      // CORRECTED LOG EXPECTATION:
      expect(loggerMock.info).toHaveBeenCalledWith(
        `LlmConfigLoader: Semantic validation passed for ${defaultLlmConfigPath}.`
      );
      // Also check the final success log
      expect(loggerMock.info).toHaveBeenCalledWith(
        `LlmConfigLoader: LLM Prompt configurations from ${defaultLlmConfigPath} processed successfully.`
      );
    });
  });

  describe('Error Handling for LLM Configs', () => {
    test('should return LoadConfigsErrorResult for syntactically invalid JSON', async () => {
      const parsingError = new SyntaxError(
        "Unexpected token 'X' in JSON at position 0"
      );
      Workspace_retry.mockRejectedValueOnce(parsingError);

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBe(true);
      // Message updated in LlmConfigLoader to match this test expectation
      expect(result.message).toBe(
        `Failed to load, parse, or validate LLM Prompt configurations from ${defaultLlmConfigPath}: ${parsingError.message}`
      );
      expect(result.stage).toBe('parse');
      expect(result.originalError).toBe(parsingError);
      expect(result.path).toBe(defaultLlmConfigPath); // Property name is 'path'
      expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
    });

    test('should return LoadConfigsErrorResult if schema validation fails for the root object structure', async () => {
      // Example: defaultConfigId is missing, which is required by the new schema
      const malformedRootObject = {
        // defaultConfigId: "missing", // This field is missing
        configs: {
          someConf: { configId: 'someConf' /* ... other valid fields */ },
        },
      };
      Workspace_retry.mockResolvedValueOnce(malformedRootObject);

      const rawSchemaError = {
        instancePath: '', // Or could be "/defaultConfigId" if schema identifies specific missing field
        keyword: 'required',
        message: "must have required property 'defaultConfigId'",
        schemaPath: '#/required',
        params: { missingProperty: 'defaultConfigId' },
      };
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: false,
        errors: [rawSchemaError],
      });

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBe(true);
      // Message updated in LlmConfigLoader to match this test expectation
      expect(result.message).toBe(
        'LLM Prompt configuration schema validation failed.'
      );
      expect(result.stage).toBe('validation');
      expect(result.path).toBe(defaultLlmConfigPath); // Property name is 'path'

      expect(result.validationErrors).toEqual([
        expect.objectContaining({
          errorType: 'SCHEMA_VALIDATION',
          // configId might be "N/A (root data)" or similar depending on #formatAjvErrorToStandardizedError logic for root errors
          configId: 'N/A (root data)', // Assuming error is on root due to missing top-level required prop
          path: '(root)', // Or "defaultConfigId" if instancePath was /defaultConfigId
          message: "must have required property 'defaultConfigId'",
          details: expect.objectContaining(rawSchemaError),
        }),
      ]);
    });

    test('should return LoadConfigsErrorResult if semantic validation fails for prompt configs', async () => {
      const semanticallyInvalidRootConfig = {
        defaultConfigId: 'bad_order_config',
        configs: {
          bad_order_config: {
            configId: 'bad_order_config',
            displayName: 'Bad Order',
            modelIdentifier: 'test/model',
            endpointUrl: 'http://example.com/api',
            apiType: 'custom',
            jsonOutputStrategy: { method: 'manual_prompting' },
            promptElements: [{ key: 'system', prefix: '', suffix: '' }],
            promptAssemblyOrder: ['non_existent_key'], // Key not in promptElements
          },
        },
      };
      Workspace_retry.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(semanticallyInvalidRootConfig))
      );
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: true,
        errors: null,
      }); // Schema validation passes

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBe(true);
      // Message updated in LlmConfigLoader to match this test expectation
      expect(result.message).toBe(
        'LLM Prompt configuration semantic validation failed.'
      );
      expect(result.stage).toBe('semantic_validation');
      expect(result.path).toBe(defaultLlmConfigPath); // Property name is 'path'
      expect(result.semanticErrors).toBeDefined();
      expect(result.semanticErrors.length).toBeGreaterThan(0);

      const firstSemanticError = result.semanticErrors[0];
      expect(firstSemanticError.configId).toBe('bad_order_config');
      expect(firstSemanticError.details.problematic_key_ref).toBe(
        'non_existent_key'
      );
      expect(firstSemanticError.message).toContain("'non_existent_key'");
      // Path should be absolute, pointing to the specific location within the dependencyInjection
      expect(firstSemanticError.path).toBe(
        'configs.bad_order_config.promptAssemblyOrder[0]'
      );
      expect(firstSemanticError.errorType).toBe(
        'SEMANTIC_VALIDATION_MISSING_ASSEMBLY_KEY'
      );
    });
    test('should return LoadConfigsErrorResult if "configs" property is not an object map', async () => {
      const malformedConfigsProperty = {
        defaultConfigId: 'main',
        configs: ['this should be an object, not an array'], // Invalid: configs is an array
      };
      Workspace_retry.mockResolvedValueOnce(malformedConfigsProperty);
      // Schema validation should catch this if schema strictly defines configs as an object.
      // If schema is loose and allows array here (it shouldn't for the new structure),
      // then semantic validation will catch it.
      // Let's assume schema catches it first.
      const rawSchemaError = {
        instancePath: '/configs',
        keyword: 'type',
        message: 'must be object',
        schemaPath: '#/properties/configs/type',
        params: { type: 'object' },
      };
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: false,
        errors: [rawSchemaError],
      });

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBe(true);
      expect(result.message).toBe(
        'LLM Prompt configuration schema validation failed.'
      );
      expect(result.stage).toBe('validation');
      expect(result.path).toBe(defaultLlmConfigPath);
      expect(result.validationErrors).toEqual([
        expect.objectContaining({
          errorType: 'SCHEMA_VALIDATION',
          configId: 'N/A (configs property)', // configId refers to the root 'configs' property
          path: 'configs', // Path points to the 'configs' property itself
          message: 'must be object',
          details: expect.objectContaining(rawSchemaError),
          expected: 'object',
        }),
      ]);
    });
  });
});

// --- FILE END ---
