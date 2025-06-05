// src/llms/strategies/openRouterJsonSchemaStrategy.js
// --- FILE START ---
import { BaseOpenRouterStrategy } from './base/baseOpenRouterStrategy.js';
import { LLMStrategyError } from '../errors/LLMStrategyError.js';
import { OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA } from '../constants/llmConstants.js'; // Still potentially used for tool_calls fallback logic's expected name

/**
 * @typedef {import('../../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @class OpenRouterJsonSchemaStrategy
 * @augments {BaseOpenRouterStrategy}
 * @description Strategy for OpenRouter compatible APIs that support JSON Schema mode
 * for structured output. This strategy configures the API request to expect a JSON object
 * conforming to a predefined schema and extracts the JSON content from the response,
 * primarily from `message.content`.
 */
export class OpenRouterJsonSchemaStrategy extends BaseOpenRouterStrategy {
  /**
   * Constructs an instance of OpenRouterJsonSchemaStrategy.
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
   * Constructs the provider-specific part of the request payload for JSON Schema mode.
   * This involves defining the 'response_format' object using the
   * schema from llmConfig.jsonOutputStrategy.jsonSchema.
   *
   * @override
   * @protected
   * @param {object} baseMessagesPayload - The base messages payload.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @returns {object} An object containing the `response_format` parameter.
   * @throws {LLMStrategyError} if jsonSchema is missing or invalid in llmConfig.
   */
  _buildProviderRequestPayloadAdditions(baseMessagesPayload, llmConfig) {
    // MODIFICATION START: Use llmConfig.configId for logging
    const llmId = llmConfig?.configId || 'UnknownLLM';
    // MODIFICATION END

    // MODIFICATION START: Use jsonSchema from llmConfig.jsonOutputStrategy
    const configuredJsonSchema = llmConfig.jsonOutputStrategy?.jsonSchema;

    if (
      !configuredJsonSchema ||
      typeof configuredJsonSchema !== 'object' ||
      Object.keys(configuredJsonSchema).length === 0
    ) {
      // Upstream validation in ConfigurableLLMAdapter ensures jsonSchema is an object if method is 'openrouter_json_schema'.
      // Here, we check if it's a non-empty object, as an empty schema {} might not be practically useful
      // or could be an oversight in the configuration.
      // Depending on API behavior, an empty schema could be valid but often a more defined schema is intended.
      this.logger.warn(
        `${this.constructor.name} (${llmId}): 'jsonSchema' in llmConfig.jsonOutputStrategy is missing, not an object, or is an empty object. Ensure the configuration provides a valid JSON schema.`,
        {
          llmId,
          jsonOutputStrategy: llmConfig.jsonOutputStrategy,
        }
      );
      // If an empty schema is problematic, an error should be thrown.
      // For now, proceeding with what's configured, assuming the API handles it or it's intentional.
      // If it MUST NOT be empty, an LLMStrategyError should be thrown:
      // throw new LLMStrategyError(`Missing or empty jsonSchema in configuration for LLM ID ${llmId}.`, llmId);
    }

    const responseFormat = {
      type: 'json_schema',
      json_schema: configuredJsonSchema, // Use the schema from the configuration
    };
    // MODIFICATION END

    this.logger.debug(
      `${this.constructor.name} (${llmId}): Using response_format with JSON schema from llmConfig.jsonOutputStrategy.jsonSchema.`,
      {
        llmId,
        schemaKeys: configuredJsonSchema
          ? Object.keys(configuredJsonSchema)
          : 'N/A',
      }
    );
    return { response_format: responseFormat };
  }

  /**
   * Extracts the JSON string from the OpenRouter response for JSON Schema mode.
   *
   * @override
   * @protected
   * @async
   * @param {any} responseData - The raw response data from the HTTP client.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {object} [providerRequestPayload] - The request payload sent to the provider.
   * @returns {Promise<string>} A promise that resolves to the extracted JSON string.
   * @throws {LLMStrategyError} If JSON content cannot be extracted.
   */
  async _extractJsonOutput(responseData, llmConfig, providerRequestPayload) {
    // MODIFICATION START: Use llmConfig.configId for logging
    const llmId = llmConfig?.configId || 'UnknownLLM';
    // MODIFICATION END
    let extractedJsonString = null;
    const message = responseData?.choices?.[0]?.message;

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
      message.content &&
      typeof message.content === 'string' &&
      message.content.trim() !== ''
    ) {
      extractedJsonString = message.content.trim();
      this.logger.info(
        `${this.constructor.name} (${llmId}): Extracted JSON string from message.content.`,
        { llmId }
      );
    } else if (message.content && typeof message.content === 'object') {
      // If the API directly returns a JSON object in message.content for json_schema mode
      extractedJsonString = JSON.stringify(message.content);
      this.logger.info(
        `${this.constructor.name} (${llmId}): Extracted JSON object from message.content and stringified it.`,
        { llmId }
      );
    } else {
      if (
        message.content === '' ||
        (typeof message.content === 'string' && message.content.trim() === '')
      ) {
        this.logger.warn(
          `${this.constructor.name} (${llmId}): message.content was an empty string. Will check tool_calls fallback.`,
          { llmId }
        );
      } else if (Object.prototype.hasOwnProperty.call(message, 'content')) {
        this.logger.warn(
          `${this.constructor.name} (${llmId}): message.content was present but not a non-empty string or object (type: ${typeof message.content}, value: ${message.content}). Will check tool_calls fallback.`,
          {
            llmId,
            contentType: typeof message.content,
            contentValue: message.content,
          }
        );
      } else {
        this.logger.info(
          `${this.constructor.name} (${llmId}): message.content is missing. Will check tool_calls fallback.`,
          { llmId }
        );
      }
    }

    // Fallback to tool_calls (original logic)
    // Note: If the primary mode is 'json_schema', relying on 'tool_calls' might indicate the LLM
    // didn't strictly follow the 'json_schema' mode. The 'expectedToolName' here uses a constant.
    if (
      extractedJsonString === null &&
      message.tool_calls &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      this.logger.info(
        `${this.constructor.name} (${llmId}): message.content not usable, attempting tool_calls fallback.`,
        { llmId }
      );
      const toolCall = message.tool_calls[0];
      // Using the constant name here, as the json_schema mode doesn't have a 'toolName' in its dependencyInjection.
      // This fallback assumes a specific tool structure if 'json_schema' mode fails to populate 'message.content'.
      const expectedToolNameForFallback =
        OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.name;

      if (
        toolCall?.type === 'function' &&
        toolCall.function?.name === expectedToolNameForFallback &&
        toolCall.function?.arguments &&
        typeof toolCall.function.arguments === 'string' &&
        toolCall.function.arguments.trim() !== ''
      ) {
        extractedJsonString = toolCall.function.arguments.trim();
        this.logger.info(
          `${this.constructor.name} (${llmId}): Extracted JSON string from tool_calls fallback (function: ${toolCall.function.name}).`,
          {
            llmId,
            functionName: toolCall.function.name,
          }
        );
      } else {
        this.logger.warn(
          `${this.constructor.name} (${llmId}): tool_calls structure for fallback did not match expected schema or arguments were empty. Expected function name '${expectedToolNameForFallback}'.`,
          {
            llmId,
            expectedToolName: expectedToolNameForFallback,
            toolCallDetails: {
              type: toolCall?.type,
              functionName: toolCall?.function?.name,
              hasArguments: toolCall?.function?.arguments !== undefined,
              argumentsType: typeof toolCall?.function?.arguments,
            },
          }
        );
      }
    }

    if (extractedJsonString === null || extractedJsonString.trim() === '') {
      const errorMsg = `${this.constructor.name} (${llmId}): Failed to extract JSON content from OpenRouter response. Neither message.content nor a valid tool_call fallback was usable.`;
      this.logger.error(errorMsg, {
        llmId,
        responseDataPreview: JSON.stringify(responseData)?.substring(0, 500),
      });
      throw new LLMStrategyError(errorMsg, llmId, null, {
        responsePreview: JSON.stringify(responseData)?.substring(0, 500),
      });
    }

    return extractedJsonString;
  }
}

// --- FILE END ---
