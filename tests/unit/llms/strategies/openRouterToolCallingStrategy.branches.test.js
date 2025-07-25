import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OpenRouterToolCallingStrategy } from '../../../../src/llms/strategies/openRouterToolCallingStrategy.js';
import { LLMStrategyError } from '../../../../src/llms/errors/LLMStrategyError.js';

// Helper to build a minimal response with a tool call
const buildResponse = (toolCall) => ({
  choices: [{ message: { tool_calls: [toolCall] } }],
});

describe('OpenRouterToolCallingStrategy additional branches', () => {
  let strategy;
  let mockHttpClient;
  let mockLogger;

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

  it('throws when extraction tool name is invalid', async () => {
    const llmConfig = {
      configId: 'badId',
      jsonOutputStrategy: { toolName: '' },
    };
    // Missing providerRequestPayload causes inability to determine expected tool name
    await expect(
      strategy._extractJsonOutput({}, llmConfig, undefined)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unable to determine expected tool name'),
      expect.objectContaining({ llmId: llmConfig.configId })
    );
  });

  it('throws when tool_calls array is missing', async () => {
    const llmConfig = {
      configId: 'id1',
      jsonOutputStrategy: { toolName: 'tool' },
    };
    const response = { choices: [{ message: {} }] };
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput(response, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('tool_calls'),
      expect.any(Object)
    );
  });

  it('throws when tool call type is invalid', async () => {
    const llmConfig = {
      configId: 'id2',
      jsonOutputStrategy: { toolName: 'tool' },
    };
    const response = buildResponse({
      type: 'bad',
      function: { name: 'tool', arguments: '{}' },
    });
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput(response, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('tool_calls'),
      expect.any(Object)
    );
  });

  it('throws when tool function is missing', async () => {
    const llmConfig = {
      configId: 'id3',
      jsonOutputStrategy: { toolName: 'tool' },
    };
    const response = buildResponse({ type: 'function' });
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput(response, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('throws when tool function name mismatches', async () => {
    const llmConfig = {
      configId: 'id4',
      jsonOutputStrategy: { toolName: 'tool' },
    };
    const response = buildResponse({
      type: 'function',
      function: { name: 'other', arguments: '{}' },
    });
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput(response, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('throws when arguments are missing', async () => {
    const llmConfig = {
      configId: 'id5',
      jsonOutputStrategy: { toolName: 'tool' },
    };
    const response = buildResponse({
      type: 'function',
      function: { name: 'tool' },
    });
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput(response, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('throws when arguments are not a string', async () => {
    const llmConfig = {
      configId: 'id6',
      jsonOutputStrategy: { toolName: 'tool' },
    };
    const response = buildResponse({
      type: 'function',
      function: { name: 'tool', arguments: 42 },
    });
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput(response, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('throws when arguments are empty string', async () => {
    const llmConfig = {
      configId: 'id7',
      jsonOutputStrategy: { toolName: 'tool' },
    };
    const response = buildResponse({
      type: 'function',
      function: { name: 'tool', arguments: '   ' },
    });
    const providerRequestPayload = {
      tools: [
        {
          type: 'function',
          function: { name: 'tool' },
        },
      ],
    };
    await expect(
      strategy._extractJsonOutput(response, llmConfig, providerRequestPayload)
    ).rejects.toThrow(LLMStrategyError);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
