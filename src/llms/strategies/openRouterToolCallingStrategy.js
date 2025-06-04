// src/llms/strategies/openRouterToolCallingStrategy.js
// --- FILE START ---
import { BaseOpenRouterStrategy } from './base/baseOpenRouterStrategy.js';
import { LLMStrategyError } from '../errors/LLMStrategyError.js';
import {
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA, // Still needed for the parameters schema
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION, // Can still be used for description
} from '../constants/llmConstants.js';

/**
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @class OpenRouterToolCallingStrategy
 * @augments {BaseOpenRouterStrategy}
 * @description Strategy for OpenRouter-compatible LLMs using the OpenAI tool-calling mechanism.
 */
export class OpenRouterToolCallingStrategy extends BaseOpenRouterStrategy {
  /**
   * Constructs an instance of OpenRouterToolCallingStrategy.
   *
   * @param {object} deps - The dependencies object.
   * @param {IHttpClient} deps.httpClient - The HTTP client for making API requests.
   * @param {ILogger} deps.logger - The logger instance.
   * (Logger validity is ensured by BaseLLMStrategy's constructor via super(logger) call)
   */
  constructor({ httpClient, logger }) {
    super({ httpClient, logger }); // Pass dependencies to the BaseOpenRouterStrategy constructor
    // this.logger is guaranteed to be valid here.
    this.logger.debug(`${this.constructor.name} initialized.`);
  }

  /**
   * Constructs the provider-specific part of the request payload for Tool Calling mode.
   *
   * @override
   * @protected
   * @param {object} baseMessagesPayload - The base messages payload.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @returns {object} An object containing the `tools` and `tool_choice` parameters.
   * @throws {LLMStrategyError} If tool schema configuration is invalid.
   */
  _buildProviderRequestPayloadAdditions(baseMessagesPayload, llmConfig) {
    // MODIFICATION START: Use llmConfig.configId for logging
    const llmId = llmConfig?.configId || 'UnknownLLM';
    // MODIFICATION END

    // MODIFICATION START: Use toolName from llmConfig.jsonOutputStrategy
    const configuredToolName = llmConfig.jsonOutputStrategy?.toolName;

    if (
      !configuredToolName ||
      typeof configuredToolName !== 'string' ||
      configuredToolName.trim() === ''
    ) {
      // This case should ideally be caught by upstream validation in ConfigurableLLMAdapter,
      // but as a safeguard:
      this.logger.error(
        `${this.constructor.name} (${llmId}): Invalid or missing 'toolName' in llmConfig.jsonOutputStrategy. Expected a non-empty string.`,
        {
          llmId,
          jsonOutputStrategy: llmConfig.jsonOutputStrategy,
        }
      );
      throw new LLMStrategyError(
        `Invalid or missing toolName in configuration for LLM ID ${llmId}.`,
        llmId
      );
    }
    // MODIFICATION END

    // The parameters schema can still come from constants if it's standardized for this strategy's purpose.
    // If the parameters schema also needs to be dynamic from llmConfig, that would be a further change.
    // For now, only toolName is made dynamic as per schema definition.
    const toolParametersSchema =
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA;

    if (!toolParametersSchema || typeof toolParametersSchema !== 'object') {
      this.logger.error(
        `${this.constructor.name} (${llmId}): Invalid tool parameters schema (OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA). Expected an object.`,
        {
          llmId,
          toolParametersSchema,
        }
      );
      throw new LLMStrategyError(`Invalid tool parameters schema.`, llmId);
    }

    const tool = {
      type: 'function',
      function: {
        name: configuredToolName, // Use the configured tool name
        description: OPENROUTER_DEFAULT_TOOL_DESCRIPTION, // Keep using constant for description
        parameters: toolParametersSchema,
      },
    };

    this.logger.debug(
      `${this.constructor.name} (${llmId}): Defined tool for use with name '${configuredToolName}'.`,
      {
        llmId,
        toolName: tool.function.name, // Log the actually used tool name
      }
    );

    return {
      tools: [tool],
      tool_choice: { type: 'function', function: { name: tool.function.name } },
    };
  }

  /**
   * Extracts the JSON string from the OpenRouter response using `message.tool_calls`.
   *
   * @override
   * @protected
   * @async
   * @param {any} responseData - The raw response data from the HTTP client.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {object} [_providerRequestPayload] - The request payload sent to the provider.
   * @returns {Promise<string>} A promise that resolves to the extracted JSON string.
   * @throws {LLMStrategyError} If JSON content cannot be extracted or validated.
   */
  async _extractJsonOutput(responseData, llmConfig, _providerRequestPayload) {
    // MODIFICATION START: Use llmConfig.configId for logging
    const llmId = llmConfig?.configId || 'UnknownLLM';
    // MODIFICATION END
    const message = responseData?.choices?.[0]?.message;

    // MODIFICATION START: Use expectedToolName from llmConfig.jsonOutputStrategy
    const expectedToolName = llmConfig.jsonOutputStrategy?.toolName;

    if (
      !expectedToolName ||
      typeof expectedToolName !== 'string' ||
      expectedToolName.trim() === ''
    ) {
      const errorMsg = `${this.constructor.name} (${llmId}): Invalid or missing 'toolName' in llmConfig.jsonOutputStrategy for extraction. Expected a non-empty string.`;
      this.logger.error(errorMsg, {
        llmId,
        jsonOutputStrategy: llmConfig.jsonOutputStrategy,
      });
      throw new LLMStrategyError(errorMsg, llmId);
    }
    // MODIFICATION END

    if (!message) {
      const errorMsg = `${this.constructor.name} (${llmId}): Response structure did not contain 'choices[0].message'.`;
      this.logger.warn(errorMsg, {
        llmId,
        responseDataPreview: JSON.stringify(responseData)?.substring(0, 500),
      });
      throw new LLMStrategyError(errorMsg, llmId, null, {
        responsePreview: JSON.stringify(responseData)?.substring(0, 500),
      });
    }

    if (
      message.tool_calls &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      const toolCall = message.tool_calls[0];

      let reason = '';
      if (toolCall.type !== 'function') {
        reason = `Expected toolCall.type to be "function", got "${toolCall.type}".`;
      } else if (!toolCall.function) {
        reason = 'toolCall.function is missing.';
      } else if (toolCall.function.name !== expectedToolName) {
        // Compare with dynamically expected tool name
        reason = `Expected toolCall.function.name to be "${expectedToolName}", got "${toolCall.function.name}".`;
      } else if (
        toolCall.function.arguments === undefined ||
        toolCall.function.arguments === null
      ) {
        reason = 'toolCall.function.arguments is missing or null.';
      } else if (typeof toolCall.function.arguments !== 'string') {
        reason = `Expected toolCall.function.arguments to be a string, got ${typeof toolCall.function.arguments}.`;
      } else if (toolCall.function.arguments.trim() === '') {
        reason = 'toolCall.function.arguments was an empty string.';
      }

      if (reason) {
        const errorMsg = `${this.constructor.name} (${llmId}): Failed to extract JSON from tool_calls. ${reason}`;
        this.logger.error(errorMsg, {
          llmId,
          toolCallDetails: {
            type: toolCall?.type,
            functionName: toolCall?.function?.name,
            hasArguments:
              toolCall?.function?.arguments !== undefined &&
              toolCall?.function?.arguments !== null,
            argumentsType: typeof toolCall?.function?.arguments,
            argumentsIsEmpty:
              typeof toolCall?.function?.arguments === 'string'
                ? toolCall.function.arguments.trim() === ''
                : undefined,
          },
          expectedToolName, // Log the dynamically expected tool name
          responseDataPreview: JSON.stringify(responseData)?.substring(0, 500),
        });
        throw new LLMStrategyError(errorMsg, llmId, null, {
          toolCallDetails: toolCall,
          responsePreview: JSON.stringify(responseData)?.substring(0, 500),
        });
      }

      const extractedJsonString = toolCall.function.arguments.trim();
      this.logger.info(
        `${this.constructor.name} (${llmId}): Successfully extracted JSON string from tool_calls[0].function.arguments for tool '${expectedToolName}'.`,
        {
          llmId,
          length: extractedJsonString.length,
        }
      );
      return extractedJsonString;
    } else {
      const errorMsg = `${this.constructor.name} (${llmId}): Response did not contain expected 'message.tool_calls' array, or it was empty.`;
      this.logger.error(errorMsg, {
        llmId,
        messageObjectPreview: {
          has_tool_calls: Object.prototype.hasOwnProperty.call(
            message,
            'tool_calls'
          ),
          tool_calls_type: typeof message.tool_calls,
          tool_calls_length: Array.isArray(message.tool_calls)
            ? message.tool_calls.length
            : undefined,
        },
        responseDataPreview: JSON.stringify(responseData)?.substring(0, 500),
      });
      throw new LLMStrategyError(errorMsg, llmId, null, {
        messageObject: message,
        responsePreview: JSON.stringify(responseData)?.substring(0, 500),
      });
    }
  }
}

// --- FILE END ---
