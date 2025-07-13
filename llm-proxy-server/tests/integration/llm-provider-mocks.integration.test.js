/**
 * @file llm-provider-mocks.integration.test.js
 * @description Integration tests with realistic LLM provider response mocks
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { LlmRequestController } from '../../src/handlers/llmRequestController.js';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../../src/middleware/validation.js';

describe('LLM Provider Mocks Integration Tests', () => {
  let app;
  let mockLogger;
  let mockLlmConfigService;
  let mockApiKeyService;
  let mockLlmRequestService;
  let controller;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock services
    mockLlmConfigService = {
      isOperational: jest.fn(() => true),
      getInitializationErrorDetails: jest.fn(() => null),
      getLlmById: jest.fn(),
    };

    mockApiKeyService = {
      getApiKey: jest.fn(),
      isApiKeyRequired: jest.fn(() => true),
    };

    mockLlmRequestService = {
      forwardRequest: jest.fn(),
    };

    // Create controller
    controller = new LlmRequestController(
      mockLogger,
      mockLlmConfigService,
      mockApiKeyService,
      mockLlmRequestService
    );

    // Create Express app
    app = express();
    app.use(express.json({ limit: '10mb' }));

    app.post(
      '/api/llm-request',
      validateRequestHeaders(),
      validateLlmRequest(),
      handleValidationErrors,
      controller.handleLlmRequest.bind(controller)
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('OpenAI-Compatible Provider Responses', () => {
    test('should handle OpenAI GPT-3.5-turbo response format', async () => {
      const mockLlmConfig = {
        displayName: 'OpenAI GPT-3.5-turbo',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-test-key',
        source: 'environment',
      });

      // Mock realistic OpenAI response
      const openaiResponse = {
        id: 'chatcmpl-7X8f2QvjK8Z9N3mL4Q1vR2sT6wE9',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-3.5-turbo-0613',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you today?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: openaiResponse,
      });

      const requestBody = {
        llmId: 'openai-gpt35-turbo',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 0.7,
          max_tokens: 100,
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(openaiResponse);

      expect(mockLlmRequestService.forwardRequest).toHaveBeenCalledWith(
        'openai-gpt35-turbo',
        mockLlmConfig,
        requestBody.targetPayload,
        {},
        'sk-test-key'
      );
    });

    test('should handle OpenAI function calling response', async () => {
      const mockLlmConfig = {
        displayName: 'OpenAI GPT-4',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-test-key',
        source: 'environment',
      });

      const functionCallResponse = {
        id: 'chatcmpl-func-123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-4-0613',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              function_call: {
                name: 'get_weather',
                arguments: '{"location": "San Francisco", "unit": "celsius"}',
              },
            },
            finish_reason: 'function_call',
          },
        ],
        usage: {
          prompt_tokens: 82,
          completion_tokens: 18,
          total_tokens: 100,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: functionCallResponse,
      });

      const requestBody = {
        llmId: 'openai-gpt4',
        targetPayload: {
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'What is the weather in San Francisco?' },
          ],
          functions: [
            {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
                },
                required: ['location'],
              },
            },
          ],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(functionCallResponse);
      expect(response.body.choices[0].message.function_call).toBeDefined();
    });

    test('should handle OpenAI streaming response simulation', async () => {
      const mockLlmConfig = {
        displayName: 'OpenAI GPT-3.5-turbo Streaming',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-test-key',
        source: 'environment',
      });

      // Simulate final streaming response
      const streamingResponse = {
        id: 'chatcmpl-stream-123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-3.5-turbo-0613',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                'This is a simulated streaming response that has been collected.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 12,
          total_tokens: 27,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: streamingResponse,
      });

      const requestBody = {
        llmId: 'openai-streaming',
        targetPayload: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Tell me a short story' }],
          stream: true,
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(streamingResponse);
    });
  });

  describe('Anthropic Claude Provider Responses', () => {
    test('should handle Anthropic Claude response format', async () => {
      const mockLlmConfig = {
        displayName: 'Anthropic Claude 3 Haiku',
        endpointUrl: 'https://api.anthropic.com/v1/messages',
        apiType: 'anthropic',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-ant-test-key',
        source: 'environment',
      });

      const claudeResponse = {
        id: 'msg_01ABC123DEF456',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: "Hello! I'm Claude, an AI assistant. How can I help you today?",
          },
        ],
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 15,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: claudeResponse,
      });

      const requestBody = {
        llmId: 'anthropic-claude3-haiku',
        targetPayload: {
          model: 'claude-3-haiku-20240307',
          max_tokens: 150,
          messages: [{ role: 'user', content: 'Hello' }],
        },
        targetHeaders: {
          'anthropic-version': '2023-06-01',
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(claudeResponse);
      expect(response.body.content[0].text).toContain('Claude');
    });

    test('should handle Claude with tools/function calling', async () => {
      const mockLlmConfig = {
        displayName: 'Anthropic Claude 3 Sonnet',
        endpointUrl: 'https://api.anthropic.com/v1/messages',
        apiType: 'anthropic',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-ant-test-key',
        source: 'environment',
      });

      const claudeToolResponse = {
        id: 'msg_tool_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_01ABC123',
            name: 'calculator',
            input: {
              operation: 'add',
              a: 15,
              b: 27,
            },
          },
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 25,
          output_tokens: 12,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: claudeToolResponse,
      });

      const requestBody = {
        llmId: 'anthropic-claude3-sonnet',
        targetPayload: {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 200,
          messages: [{ role: 'user', content: 'What is 15 + 27?' }],
          tools: [
            {
              name: 'calculator',
              description: 'Perform basic arithmetic operations',
              input_schema: {
                type: 'object',
                properties: {
                  operation: {
                    type: 'string',
                    enum: ['add', 'subtract', 'multiply', 'divide'],
                  },
                  a: { type: 'number' },
                  b: { type: 'number' },
                },
                required: ['operation', 'a', 'b'],
              },
            },
          ],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(claudeToolResponse);
      expect(response.body.content[0].type).toBe('tool_use');
    });
  });

  describe('OpenRouter Provider Responses', () => {
    test('should handle OpenRouter response with provider metadata', async () => {
      const mockLlmConfig = {
        displayName: 'OpenRouter Claude via OpenAI API',
        endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-or-test-key',
        source: 'environment',
      });

      const openrouterResponse = {
        id: 'chatcmpl-or-123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'anthropic/claude-3-haiku',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This response comes from Claude via OpenRouter.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 10,
          total_tokens: 22,
        },
        // OpenRouter-specific metadata
        'x-openrouter': {
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          generation_id: 'gen_abc123',
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: openrouterResponse,
      });

      const requestBody = {
        llmId: 'openrouter-claude3-haiku',
        targetPayload: {
          model: 'anthropic/claude-3-haiku',
          messages: [{ role: 'user', content: 'Hello via OpenRouter' }],
          temperature: 0.8,
        },
        targetHeaders: {
          'HTTP-Referer': 'https://yourgame.com',
          'X-Title': 'My Text Adventure Game',
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(openrouterResponse);
      expect(response.body['x-openrouter']).toBeDefined();
      expect(response.body['x-openrouter'].provider).toBe('anthropic');
    });
  });

  describe('Local LLM Provider Responses', () => {
    test('should handle local Ollama response format', async () => {
      const mockLlmConfig = {
        displayName: 'Local Ollama Llama2',
        endpointUrl: 'http://localhost:11434/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.isApiKeyRequired.mockReturnValue(false);

      const ollamaResponse = {
        id: 'chatcmpl-ollama-123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'llama2:7b',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: "Hello! I'm running locally on your machine via Ollama.",
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 8,
          completion_tokens: 12,
          total_tokens: 20,
        },
        // Ollama-specific fields
        system_fingerprint: 'ollama-local',
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: ollamaResponse,
      });

      const requestBody = {
        llmId: 'local-ollama-llama2',
        targetPayload: {
          model: 'llama2:7b',
          messages: [{ role: 'user', content: 'Hello local model' }],
          temperature: 0.7,
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(ollamaResponse);
      expect(mockApiKeyService.getApiKey).not.toHaveBeenCalled();
    });

    test('should handle local text-generation-webui response', async () => {
      const mockLlmConfig = {
        displayName: 'Local Text Generation WebUI',
        endpointUrl: 'http://localhost:5000/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.isApiKeyRequired.mockReturnValue(false);

      const webUIResponse = {
        id: 'chatcmpl-local-456',
        object: 'chat.completion',
        created: 1687123456,
        model: 'TheBloke_Llama-2-7B-Chat-GGML',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                "Greetings! I'm a locally hosted language model running on text-generation-webui.",
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: webUIResponse,
      });

      const requestBody = {
        llmId: 'local-webui-llama2',
        targetPayload: {
          model: 'TheBloke_Llama-2-7B-Chat-GGML',
          messages: [{ role: 'user', content: 'Hello local WebUI' }],
          max_tokens: 100,
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(webUIResponse);
    });
  });

  describe('JSON Schema Structured Output Responses', () => {
    test('should handle OpenAI structured output with JSON schema', async () => {
      const mockLlmConfig = {
        displayName: 'OpenAI GPT-4 with JSON Schema',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-test-key',
        source: 'environment',
      });

      const structuredResponse = {
        id: 'chatcmpl-structured-123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-4-1106-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                '{"name": "Elara Moonwhisper", "description": "A mystical elven ranger with silver hair and emerald eyes, skilled in archery and nature magic."}',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 45,
          completion_tokens: 28,
          total_tokens: 73,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: structuredResponse,
      });

      const requestBody = {
        llmId: 'openai-gpt4-json-schema',
        targetPayload: {
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'user',
              content: 'Generate a fantasy character description.',
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'character_description',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['name', 'description'],
              },
            },
          },
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(structuredResponse);

      // Validate that the content is valid JSON with expected structure
      const parsedContent = JSON.parse(
        response.body.choices[0].message.content
      );
      expect(parsedContent).toHaveProperty('name');
      expect(parsedContent).toHaveProperty('description');
      expect(typeof parsedContent.name).toBe('string');
      expect(typeof parsedContent.description).toBe('string');
    });

    test('should handle complex nested JSON schema response', async () => {
      const mockLlmConfig = {
        displayName: 'OpenAI GPT-4 Complex Schema',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-test-key',
        source: 'environment',
      });

      const complexStructuredResponse = {
        id: 'chatcmpl-complex-456',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-4-1106-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                character: {
                  name: 'Thorin Stormaxe',
                  class: 'Barbarian',
                  level: 5,
                  attributes: {
                    strength: 18,
                    dexterity: 14,
                    constitution: 16,
                    intelligence: 10,
                    wisdom: 12,
                    charisma: 8,
                  },
                  equipment: [
                    { name: 'Greataxe', type: 'weapon', damage: '1d12' },
                    { name: 'Hide Armor', type: 'armor', ac: 12 },
                  ],
                },
                backstory: 'A fierce warrior from the northern mountains.',
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 85,
          completion_tokens: 65,
          total_tokens: 150,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: complexStructuredResponse,
      });

      const requestBody = {
        llmId: 'openai-gpt4-complex-schema',
        targetPayload: {
          model: 'gpt-4-1106-preview',
          messages: [
            {
              role: 'user',
              content: 'Generate a complete D&D character sheet.',
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'dnd_character',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  character: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      class: { type: 'string' },
                      level: { type: 'integer' },
                      attributes: {
                        type: 'object',
                        properties: {
                          strength: { type: 'integer' },
                          dexterity: { type: 'integer' },
                          constitution: { type: 'integer' },
                          intelligence: { type: 'integer' },
                          wisdom: { type: 'integer' },
                          charisma: { type: 'integer' },
                        },
                        required: [
                          'strength',
                          'dexterity',
                          'constitution',
                          'intelligence',
                          'wisdom',
                          'charisma',
                        ],
                      },
                      equipment: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                            type: { type: 'string' },
                          },
                          required: ['name', 'type'],
                        },
                      },
                    },
                    required: [
                      'name',
                      'class',
                      'level',
                      'attributes',
                      'equipment',
                    ],
                  },
                  backstory: { type: 'string' },
                },
                required: ['character', 'backstory'],
              },
            },
          },
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(complexStructuredResponse);

      // Validate complex nested structure
      const parsedContent = JSON.parse(
        response.body.choices[0].message.content
      );
      expect(parsedContent).toHaveProperty('character');
      expect(parsedContent).toHaveProperty('backstory');
      expect(parsedContent.character).toHaveProperty('attributes');
      expect(parsedContent.character).toHaveProperty('equipment');
      expect(Array.isArray(parsedContent.character.equipment)).toBe(true);
      expect(parsedContent.character.equipment.length).toBeGreaterThan(0);
    });
  });

  describe('Response Size and Content Validation', () => {
    test('should handle large response from LLM provider', async () => {
      const mockLlmConfig = {
        displayName: 'OpenAI GPT-4 Large Response',
        endpointUrl: 'https://api.openai.com/v1/chat/completions',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'sk-test-key',
        source: 'environment',
      });

      const largeContent =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
          1000
        );
      const largeResponse = {
        id: 'chatcmpl-large-789',
        object: 'chat.completion',
        created: 1687123456,
        model: 'gpt-4-1106-preview',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: largeContent,
            },
            finish_reason: 'length',
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 4000,
          total_tokens: 4020,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: largeResponse,
      });

      const requestBody = {
        llmId: 'openai-gpt4-large',
        targetPayload: {
          model: 'gpt-4-1106-preview',
          messages: [{ role: 'user', content: 'Write a very long story.' }],
          max_tokens: 4000,
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(largeResponse);
      expect(response.body.choices[0].message.content.length).toBeGreaterThan(
        50000
      );
      expect(response.body.choices[0].finish_reason).toBe('length');
    });

    test('should handle response with special characters and unicode', async () => {
      const mockLlmConfig = {
        displayName: 'Unicode Content LLM',
        endpointUrl: 'https://api.test.com/v1/chat',
        apiType: 'openai',
      };

      mockLlmConfigService.getLlmById.mockReturnValue(mockLlmConfig);
      mockApiKeyService.getApiKey.mockResolvedValue({
        apiKey: 'test-key',
        source: 'environment',
      });

      const unicodeResponse = {
        id: 'chatcmpl-unicode-123',
        object: 'chat.completion',
        created: 1687123456,
        model: 'test-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                'Hello! 🌟 Here are some characters: 中文, العربية, русский, 日本語, emoji: 🎮🎯🔥, math: ∑∞≠',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      mockLlmRequestService.forwardRequest.mockResolvedValue({
        success: true,
        statusCode: 200,
        data: unicodeResponse,
      });

      const requestBody = {
        llmId: 'unicode-test',
        targetPayload: {
          model: 'test-model',
          messages: [
            { role: 'user', content: 'Respond with unicode characters' },
          ],
        },
      };

      const response = await request(app)
        .post('/api/llm-request')
        .send(requestBody)
        .expect(200);

      expect(response.body).toEqual(unicodeResponse);
      expect(response.body.choices[0].message.content).toContain('🌟');
      expect(response.body.choices[0].message.content).toContain('中文');
      expect(response.body.choices[0].message.content).toContain('∑∞≠');
    });
  });
});
