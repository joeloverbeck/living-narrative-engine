import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OpenRouterToolCallingStrategy } from '../../../src/llms/strategies/openRouterToolCallingStrategy.js';
import { LLMStrategyError } from '../../../src/llms/errors/LLMStrategyError.js';
import {
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
} from '../../../src/llms/constants/llmConstants.js';

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

  it('_buildProviderRequestPayloadAdditions builds payload with valid tool name', () => {
    const llmConfig = {
      configId: 'llm1',
      jsonOutputStrategy: { toolName: 'my_tool' },
    };
    const result = strategy._buildProviderRequestPayloadAdditions(
      {},
      llmConfig
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
      { llmId: llmConfig.configId, toolName: 'my_tool' }
    );
  });

  it('_buildProviderRequestPayloadAdditions throws for invalid tool name', () => {
    const llmConfig = { configId: 'bad', jsonOutputStrategy: {} };
    expect(() =>
      strategy._buildProviderRequestPayloadAdditions({}, llmConfig)
    ).toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid or missing'),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });

  it('_extractJsonOutput extracts JSON when tool call is valid', async () => {
    const llmConfig = {
      configId: 'llm2',
      jsonOutputStrategy: { toolName: 'tool_a' },
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
    const result = await strategy._extractJsonOutput(response, llmConfig);
    expect(result).toBe('{"a":1}');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `OpenRouterToolCallingStrategy (${llmConfig.configId}): Successfully extracted JSON string from tool_calls[0].function.arguments for tool 'tool_a'.`,
      { llmId: llmConfig.configId, length: result.length }
    );
  });

  it('_extractJsonOutput throws when message missing', async () => {
    const llmConfig = {
      configId: 'llm3',
      jsonOutputStrategy: { toolName: 'x' },
    };
    await expect(strategy._extractJsonOutput({}, llmConfig)).rejects.toThrow(
      LLMStrategyError
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('did not contain'),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });
});
