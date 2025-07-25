import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OpenRouterToolCallingStrategy } from '../../../../src/llms/strategies/openRouterToolCallingStrategy.js';
import { LLMStrategyError } from '../../../../src/llms/errors/LLMStrategyError.js';
import {
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
} from '../../../../src/llms/constants/llmConstants.js';

describe('OpenRouterToolCallingStrategy', () => {
  let mockHttpClient;
  let mockLogger;
  let strategy;

  beforeEach(() => {
    mockHttpClient = { request: jest.fn() };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    strategy = new OpenRouterToolCallingStrategy({
      httpClient: mockHttpClient,
      logger: mockLogger,
    });
  });

  it('constructor logs initialization', () => {
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'OpenRouterToolCallingStrategy initialized.'
    );
  });

  it('_buildProviderRequestPayloadAdditions builds payload with valid tool name (no request options)', () => {
    const llmConfig = {
      configId: 'llm1',
      jsonOutputStrategy: { toolName: 'my_tool' },
    };
    const result = strategy._buildProviderRequestPayloadAdditions(
      {},
      llmConfig,
      {} // No request options
    );
    expect(result).toEqual({
      tools: [
        {
          type: 'function',
          function: {
            name: 'my_tool',
            description: OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
            parameters:
              OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
              OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'my_tool' } },
    });
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `OpenRouterToolCallingStrategy (${llmConfig.configId}): Defined tool for use with name 'my_tool'.`,
      { llmId: llmConfig.configId, toolName: 'my_tool', isCustomSchema: false }
    );
  });

  it('_buildProviderRequestPayloadAdditions throws for invalid tool name', () => {
    const llmConfig = { configId: 'bad', jsonOutputStrategy: {} };
    expect(() =>
      strategy._buildProviderRequestPayloadAdditions({}, llmConfig, {})
    ).toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("Missing or invalid 'toolName'"),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });

  // Request Options Tests
  it('_buildProviderRequestPayloadAdditions uses custom schema from request options', () => {
    const llmConfig = {
      configId: 'llm1',
      jsonOutputStrategy: { toolName: 'config_tool' },
    };
    const requestOptions = {
      toolSchema: {
        type: 'object',
        properties: {
          customField: { type: 'string', description: 'Custom field' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['customField'],
      },
      toolName: 'custom_tool',
      toolDescription: 'Custom tool description',
    };

    const result = strategy._buildProviderRequestPayloadAdditions(
      {},
      llmConfig,
      requestOptions
    );

    expect(result).toEqual({
      tools: [
        {
          type: 'function',
          function: {
            name: 'custom_tool', // Should use request option tool name over config
            description: 'Custom tool description', // Should use custom description
            parameters: requestOptions.toolSchema, // Should use custom schema
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'custom_tool' } },
    });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Using custom tool schema from request options'),
      expect.objectContaining({
        llmId: llmConfig.configId,
        schemaProperties: ['customField', 'confidence'],
      })
    );
  });

  it('_buildProviderRequestPayloadAdditions uses partial request options with config fallback', () => {
    const llmConfig = {
      configId: 'llm1',
      jsonOutputStrategy: { toolName: 'config_tool' },
    };
    const requestOptions = {
      toolName: 'override_tool', // Only override tool name
    };

    const result = strategy._buildProviderRequestPayloadAdditions(
      {},
      llmConfig,
      requestOptions
    );

    expect(result.tools[0].function.name).toBe('override_tool');
    expect(result.tools[0].function.description).toBe(
      OPENROUTER_DEFAULT_TOOL_DESCRIPTION
    );
    expect(result.tools[0].function.parameters).toEqual(
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
        OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'No custom tool schema provided, using default game AI schema'
      ),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });

  it('_buildProviderRequestPayloadAdditions uses request options tool name over config', () => {
    const llmConfig = {
      configId: 'llm1',
      jsonOutputStrategy: { toolName: 'config_tool' },
    };
    const requestOptions = {
      toolName: 'request_tool',
    };

    const result = strategy._buildProviderRequestPayloadAdditions(
      {},
      llmConfig,
      requestOptions
    );

    expect(result.tools[0].function.name).toBe('request_tool');
    expect(result.tool_choice.function.name).toBe('request_tool');
  });

  it('_buildProviderRequestPayloadAdditions throws for invalid custom schema', () => {
    const llmConfig = {
      configId: 'llm1',
      jsonOutputStrategy: { toolName: 'my_tool' },
    };
    const requestOptions = {
      toolSchema: null, // Invalid schema
    };

    expect(() =>
      strategy._buildProviderRequestPayloadAdditions(
        {},
        llmConfig,
        requestOptions
      )
    ).toThrow(LLMStrategyError);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid tool parameters schema'),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });

  it('_buildProviderRequestPayloadAdditions works without config tool name if request option provides it', () => {
    const llmConfig = {
      configId: 'llm1',
      jsonOutputStrategy: {}, // No toolName in config
    };
    const requestOptions = {
      toolName: 'request_tool',
    };

    const result = strategy._buildProviderRequestPayloadAdditions(
      {},
      llmConfig,
      requestOptions
    );

    expect(result.tools[0].function.name).toBe('request_tool');
  });

  it('_extractJsonOutput extracts JSON when tool call is valid', async () => {
    const llmConfig = {
      configId: 'llm2',
      jsonOutputStrategy: { toolName: 'tool_a' },
    };
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool_a' },
        },
      ],
    };
    const response = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: { name: 'tool_a', arguments: ' {"a":1} ' },
              },
            ],
          },
        },
      ],
    };
    const result = await strategy._extractJsonOutput(
      response,
      llmConfig,
      providerRequestPayload
    );
    expect(result).toBe('{"a":1}');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `OpenRouterToolCallingStrategy (${llmConfig.configId}): Successfully extracted JSON string from tool_calls[0].function.arguments for tool 'tool_a'.`,
      { llmId: llmConfig.configId, length: result.length, toolName: 'tool_a' }
    );
  });

  it('_extractJsonOutput throws when message missing', async () => {
    const llmConfig = {
      configId: 'llm3',
      jsonOutputStrategy: { toolName: 'x' },
    };
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'x' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput({}, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('did not contain'),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });

  it('_extractJsonOutput works with custom tool name from request options', async () => {
    const llmConfig = {
      configId: 'llm4',
      jsonOutputStrategy: { toolName: 'config_tool' },
    };
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'custom_tool' }, // Different from config
        },
      ],
    };
    const response = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'custom_tool',
                  arguments: '{"result": "success"}',
                },
              },
            ],
          },
        },
      ],
    };

    const result = await strategy._extractJsonOutput(
      response,
      llmConfig,
      providerRequestPayload
    );
    expect(result).toBe('{"result": "success"}');
  });

  it('_extractJsonOutput throws when provider payload missing tool info', async () => {
    const llmConfig = {
      configId: 'llm5',
      jsonOutputStrategy: { toolName: 'x' },
    };
    const providerRequestPayload = {}; // Missing tools

    await expect(
      strategy._extractJsonOutput({}, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unable to determine expected tool name from provider request payload'
      ),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });

  it('execute invokes _extractJsonOutput', async () => {
    const execConfig = {
      configId: 'exec',
      apiType: 'openrouter',
      endpointUrl: 'https://openrouter.ai/api',
      modelIdentifier: 'model-x',
      defaultParameters: {},
      providerSpecificHeaders: {},
      jsonOutputStrategy: { toolName: 'tool_exec' },
    };
    const response = { choices: [{ message: { tool_calls: [] } }] };
    mockHttpClient.request.mockResolvedValueOnce(response);
    const extractionSpy = jest
      .spyOn(strategy, '_extractJsonOutput')
      .mockResolvedValue('{}');
    const params = {
      gameSummary: 'summary',
      llmConfig: execConfig,
      apiKey: 'key',
      environmentContext: {
        isClient: jest.fn().mockReturnValue(false),
        isServer: jest.fn().mockReturnValue(true),
        getExecutionEnvironment: jest.fn().mockReturnValue('server'),
        getProjectRootPath: jest.fn().mockReturnValue('/root'),
        getProxyServerUrl: jest.fn(),
      },
    };
    const result = await strategy.execute(params);
    expect(result).toBe('{}');
    expect(extractionSpy).toHaveBeenCalledWith(
      response,
      execConfig,
      expect.any(Object)
    );
  });
});
