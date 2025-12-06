import { describe, it, expect } from '@jest/globals';
import { OpenRouterToolCallingStrategy } from '../../../../src/llms/strategies/openRouterToolCallingStrategy.js';
import { EnvironmentContext } from '../../../../src/llms/environmentContext.js';
import {
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
} from '../../../../src/llms/constants/llmConstants.js';
import { LLMStrategyError } from '../../../../src/llms/errors/LLMStrategyError.js';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class RecordingHttpClient {
  constructor(responseFactory) {
    this.responseFactory = responseFactory;
    this.calls = [];
  }

  async request(url, options) {
    const call = { url, options };
    this.calls.push(call);
    const result =
      typeof this.responseFactory === 'function'
        ? await this.responseFactory(call)
        : this.responseFactory;
    return result ?? {};
  }
}

const BASE_CONFIG = Object.freeze({
  configId: 'openrouter-tool-calling-integration-test',
  endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
  modelIdentifier: 'anthropic/claude-3.5-sonnet',
  apiType: 'openrouter',
  defaultParameters: {
    temperature: 0.65,
    top_p: 0.85,
  },
  providerSpecificHeaders: {
    'HTTP-Referer': 'http://localhost',
    'X-Title': 'Living Narrative Engine Integration Tests',
  },
  jsonOutputStrategy: {
    method: 'openrouter_tool_calling',
    toolName: 'function_call',
  },
});

const GAME_SUMMARY = 'The scout studies the cavern before reporting back.';

/**
 *
 * @param loggerOverrides
 */
function createServerEnvironment(loggerOverrides = {}) {
  const envLogger = createEnhancedMockLogger(loggerOverrides);
  return {
    environmentContext: new EnvironmentContext({
      logger: envLogger,
      executionEnvironment: 'server',
      projectRootPath: process.cwd(),
    }),
    envLogger,
  };
}

describe('Integration: OpenRouterToolCallingStrategy', () => {
  it('executes a tool-calling request with request-specific overrides', async () => {
    const rawArguments =
      '  {"action":"investigate","speech":"Approaching the shrine."}  ';
    const httpClient = new RecordingHttpClient(() => ({
      choices: [
        {
          message: {
            tool_calls: [
              {
                type: 'function',
                function: {
                  name: 'expedition_tool',
                  arguments: rawArguments,
                },
              },
            ],
          },
        },
      ],
    }));

    const strategyLogger = createEnhancedMockLogger();
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient,
      logger: strategyLogger,
    });
    const { environmentContext } = createServerEnvironment();

    const customSchema = {
      type: 'object',
      properties: {
        action: { type: 'string' },
        speech: { type: 'string' },
        urgency: { type: 'integer' },
      },
      required: ['action', 'speech'],
    };

    const result = await strategy.execute({
      gameSummary: GAME_SUMMARY,
      llmConfig: { ...BASE_CONFIG },
      apiKey: 'server-tool-calling-key',
      environmentContext,
      requestOptions: {
        toolName: 'expedition_tool',
        toolSchema: customSchema,
        toolDescription: 'Generates the next expedition directive.',
        temperature: 0.42,
      },
    });

    expect(result).toBe(
      '{"action":"investigate","speech":"Approaching the shrine."}'
    );
    expect(httpClient.calls).toHaveLength(1);

    const [call] = httpClient.calls;
    expect(call.url).toBe(BASE_CONFIG.endpointUrl);

    const parsedBody = JSON.parse(call.options.body);
    expect(parsedBody.model).toBe(BASE_CONFIG.modelIdentifier);
    expect(parsedBody.temperature).toBe(0.42);
    expect(parsedBody.tools).toHaveLength(1);
    expect(parsedBody.tools[0].function).toEqual({
      name: 'expedition_tool',
      description: 'Generates the next expedition directive.',
      parameters: customSchema,
    });
    expect(parsedBody.tool_choice).toEqual({
      type: 'function',
      function: { name: 'expedition_tool' },
    });
    expect(parsedBody.messages).toEqual([
      { role: 'user', content: GAME_SUMMARY },
    ]);
  });

  it('buildToolSchema returns a custom schema when provided via request options', () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    const customSchema = {
      type: 'object',
      properties: {
        topic: { type: 'string' },
      },
    };

    const schema = strategy.buildToolSchema([{}], {
      toolSchema: customSchema,
      toolName: 'custom_tool',
      toolDescription: 'Custom tool description.',
    });

    expect(schema).toEqual({
      type: 'function',
      function: {
        name: 'custom_tool',
        description: 'Custom tool description.',
        parameters: customSchema,
      },
    });
  });

  it('buildToolSchema falls back to the default handler when custom schema is invalid', () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    const schema = strategy.buildToolSchema(
      [{ function: { name: 'ignored' } }],
      {
        toolSchema: 'not-an-object',
      }
    );

    expect(schema).toEqual({
      type: 'function',
      function: {
        name: 'game_ai_action_speech',
        description: OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
        parameters:
          OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
          OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
      },
    });
  });

  it('buildToolSchema returns null when no tools are supplied', () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    expect(strategy.buildToolSchema()).toBeNull();
    expect(strategy.buildToolSchema([])).toBeNull();
  });

  it('builds provider payload additions using request overrides and validates schema objects', () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    const baseMessagesPayload = {
      messages: [{ role: 'user', content: GAME_SUMMARY }],
    };

    const customSchema = {
      type: 'object',
      properties: {
        direction: { type: 'string' },
      },
    };

    const payload = strategy._buildProviderRequestPayloadAdditions(
      baseMessagesPayload,
      { ...BASE_CONFIG },
      {
        toolName: 'scouting_tool',
        toolSchema: customSchema,
        toolDescription: 'Determines scouting actions.',
      }
    );

    expect(payload).toEqual({
      tools: [
        {
          type: 'function',
          function: {
            name: 'scouting_tool',
            description: 'Determines scouting actions.',
            parameters: customSchema,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'scouting_tool' } },
    });
  });

  it('throws when toolName is missing from both request options and configuration', () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    expect(() =>
      strategy._buildProviderRequestPayloadAdditions(
        { messages: [] },
        {
          ...BASE_CONFIG,
          jsonOutputStrategy: { method: 'openrouter_tool_calling' },
        },
        {}
      )
    ).toThrow(LLMStrategyError);
  });

  it('throws when a non-object tool schema is provided for the provider payload', () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    expect(() =>
      strategy._buildProviderRequestPayloadAdditions(
        { messages: [] },
        { ...BASE_CONFIG },
        {
          toolName: 'invalid_schema_tool',
          toolSchema: null,
        }
      )
    ).toThrow(LLMStrategyError);
  });

  it('falls back to the default schema when request options omit toolSchema', () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    const payload = strategy._buildProviderRequestPayloadAdditions(
      { messages: [] },
      { ...BASE_CONFIG },
      { toolName: 'recon_tool' }
    );

    expect(payload.tools[0].function.parameters).toEqual(
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
        OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA
    );
    expect(payload.tools[0].function.description).toBe(
      OPENROUTER_DEFAULT_TOOL_DESCRIPTION
    );
  });

  it('throws when provider payload lacks the expected tool name', async () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    await expect(
      strategy._extractJsonOutput({}, { configId: 'missing-tool-name' }, {})
    ).rejects.toThrow(LLMStrategyError);
  });

  it('throws when response is missing the expected message object', async () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    await expect(
      strategy._extractJsonOutput(
        {},
        { configId: 'missing-message' },
        { tools: [{ function: { name: 'function_call' } }] }
      )
    ).rejects.toThrow(LLMStrategyError);
  });

  it('throws detailed errors for invalid tool_calls entries', async () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    const llmConfig = { configId: 'invalid-tool-call' };
    const providerPayload = {
      tools: [{ function: { name: 'function_call' } }],
    };

    const cases = [
      {
        toolCall: {
          type: 'assistant',
          function: { name: 'function_call', arguments: '{}' },
        },
        expected: 'toolCall.type',
      },
      {
        toolCall: {
          type: 'function',
        },
        expected: 'toolCall.function is missing',
      },
      {
        toolCall: {
          type: 'function',
          function: { name: 'other_call', arguments: '{}' },
        },
        expected: 'toolCall.function.name',
      },
      {
        toolCall: {
          type: 'function',
          function: { name: 'function_call', arguments: null },
        },
        expected: 'arguments is missing or null',
      },
      {
        toolCall: {
          type: 'function',
          function: { name: 'function_call', arguments: { action: 'move' } },
        },
        expected: 'arguments to be a string',
      },
      {
        toolCall: {
          type: 'function',
          function: { name: 'function_call', arguments: '   ' },
        },
        expected: 'arguments was an empty string',
      },
    ];

    await Promise.all(
      cases.map(async ({ toolCall, expected }) => {
        await expect(
          strategy._extractJsonOutput(
            {
              choices: [
                {
                  message: {
                    tool_calls: [toolCall],
                  },
                },
              ],
            },
            llmConfig,
            providerPayload
          )
        ).rejects.toThrow(expected);
      })
    );
  });

  it('throws when no tool_calls array is present in the response', async () => {
    const strategy = new OpenRouterToolCallingStrategy({
      httpClient: new RecordingHttpClient(() => ({})),
      logger: createEnhancedMockLogger(),
    });

    await expect(
      strategy._extractJsonOutput(
        {
          choices: [
            {
              message: {
                content: 'No tool calls here.',
              },
            },
          ],
        },
        { configId: 'missing-tool-calls' },
        { tools: [{ function: { name: 'function_call' } }] }
      )
    ).rejects.toThrow(LLMStrategyError);
  });
});
