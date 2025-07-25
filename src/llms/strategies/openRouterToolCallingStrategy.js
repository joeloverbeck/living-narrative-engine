// src/llms/strategies/openRouterToolCallingStrategy.js
// --- FILE START ---
import { BaseOpenRouterStrategy } from './base/baseOpenRouterStrategy.js';
import { LLMStrategyError } from '../errors/LLMStrategyError.js';
import {
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA, // Still needed for the parameters schema
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION, // Can still be used for description
} from '../constants/llmConstants.js';
import { getLlmId } from '../utils/llmUtils.js';
import { DefaultToolSchemaHandler } from './toolSchemaHandlers/defaultToolSchemaHandler.js';

/**
 * @typedef {import('../interfaces/IHttpClient.js').IHttpClient} IHttpClient
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @class OpenRouterToolCallingStrategy
 * @augments {BaseOpenRouterStrategy}
 * @description Strategy for OpenRouter-compatible LLMs using the OpenAI tool-calling mechanism.
 */
export class OpenRouterToolCallingStrategy extends BaseOpenRouterStrategy {
  #toolSchemaHandler;

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

    // Initialize tool schema handler
    this.#toolSchemaHandler = new DefaultToolSchemaHandler({ logger });

    // this.logger is guaranteed to be valid here.
    this.logger.debug(`${this.constructor.name} initialized.`);
  }

  /**
   * Gets the tool schema handler instance.
   *
   * @private
   * @returns {DefaultToolSchemaHandler} The tool schema handler
   */
  _getToolSchemaHandler() {
    return this.#toolSchemaHandler;
  }

  /**
   * Enhanced tool schema building for OpenRouter tool calling strategy.
   * This method provides flexible tool schema generation that can use either
   * request-specific custom schemas or fall back to default behavior.
   *
   * @override
   * @param {Array<object>} tools - Array of tool definitions (currently supports single tool)
   * @param {object} [requestOptions] - Optional request-specific options
   * @param {object} [requestOptions.toolSchema] - Custom tool schema to use
   * @param {string} [requestOptions.toolName] - Custom tool name to use
   * @param {string} [requestOptions.toolDescription] - Custom tool description to use
   * @returns {object|null} Tool schema object or null if no tools provided
   */
  buildToolSchema(tools, requestOptions = {}) {
    const llmId = 'openrouter-tool-calling'; // Context-specific identifier

    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      this.logger.debug(
        `${this.constructor.name} (${llmId}): No tools provided for schema generation.`,
        { llmId }
      );
      return null;
    }

    const toolSchemaHandler = this._getToolSchemaHandler();

    try {
      // If custom schema is provided in request options, use it
      if (Object.prototype.hasOwnProperty.call(requestOptions, 'toolSchema')) {
        const customSchema = requestOptions.toolSchema;
        const toolName = requestOptions.toolName || 'custom_tool';
        const toolDescription =
          requestOptions.toolDescription || 'Custom tool for specific request';

        this.logger.debug(
          `${this.constructor.name} (${llmId}): Building custom tool schema from request options.`,
          { llmId, toolName, hasCustomSchema: !!customSchema }
        );

        if (customSchema && typeof customSchema === 'object') {
          return toolSchemaHandler.buildCustomToolSchema(
            customSchema,
            toolName,
            toolDescription,
            llmId
          );
        } else {
          this.logger.warn(
            `${this.constructor.name} (${llmId}): Invalid custom tool schema provided, falling back to default.`,
            { llmId, providedSchema: customSchema }
          );
          // Fall back to default schema without custom name/description when invalid schema provided
          return toolSchemaHandler.buildDefaultToolSchema(llmId, {});
        }
      }

      // Fall back to default tool schema
      this.logger.debug(
        `${this.constructor.name} (${llmId}): Building default tool schema.`,
        { llmId }
      );
      return toolSchemaHandler.buildDefaultToolSchema(llmId, requestOptions);
    } catch (error) {
      this.logger.error(
        `${this.constructor.name} (${llmId}): Error building tool schema: ${error.message}`,
        { llmId, error: error.message, requestOptions }
      );

      // Fall back to default schema as last resort
      try {
        this.logger.debug(
          `${this.constructor.name} (${llmId}): Attempting fallback to default tool schema.`,
          { llmId }
        );
        return toolSchemaHandler.buildDefaultToolSchema(llmId, {});
      } catch (fallbackError) {
        this.logger.error(
          `${this.constructor.name} (${llmId}): Fallback tool schema generation also failed: ${fallbackError.message}`,
          { llmId, fallbackError: fallbackError.message }
        );
        return null;
      }
    }
  }

  /**
   * Indicates that this strategy supports custom tool schema generation.
   *
   * @override
   * @returns {boolean} Always returns true for tool calling strategy
   */
  requiresCustomToolSchema() {
    return true;
  }

  /**
   * Validates that the provided tool call matches the expected structure.
   *
   * @param {object} toolCall - The tool call returned by the LLM.
   * @param {string} expectedName - The expected tool name.
   * @returns {string|null} Null if valid or an error message describing the failure.
   */
  validateToolCall(toolCall, expectedName) {
    if (toolCall.type !== 'function') {
      return `Expected toolCall.type to be "function", got "${toolCall.type}".`;
    }
    if (!toolCall.function) {
      return 'toolCall.function is missing.';
    }
    if (toolCall.function.name !== expectedName) {
      return `Expected toolCall.function.name to be "${expectedName}", got "${toolCall.function.name}".`;
    }
    if (
      toolCall.function.arguments === undefined ||
      toolCall.function.arguments === null
    ) {
      return 'toolCall.function.arguments is missing or null.';
    }
    if (typeof toolCall.function.arguments !== 'string') {
      return `Expected toolCall.function.arguments to be a string, got ${typeof toolCall.function.arguments}.`;
    }
    if (toolCall.function.arguments.trim() === '') {
      return 'toolCall.function.arguments was an empty string.';
    }
    return null;
  }

  /**
   * Constructs the provider-specific part of the request payload for Tool Calling mode.
   *
   * @override
   * @protected
   * @param {object} baseMessagesPayload - The base messages payload.
   * @param {LLMModelConfig} llmConfig - The LLM configuration.
   * @param {object} [requestOptions] - Optional request-specific options.
   * @returns {object} An object containing the `tools` and `tool_choice` parameters.
   * @throws {LLMStrategyError} If tool schema configuration is invalid.
   */
  _buildProviderRequestPayloadAdditions(
    baseMessagesPayload,
    llmConfig,
    requestOptions = {}
  ) {
    const llmId = getLlmId(llmConfig);

    // Determine tool name: request option overrides config
    const toolName =
      requestOptions.toolName || llmConfig.jsonOutputStrategy?.toolName;

    // Validation for toolName
    if (!toolName || typeof toolName !== 'string' || toolName.trim() === '') {
      const errorMsg = `${this.constructor.name} (${llmId}): Missing or invalid 'toolName'. Must be provided in either request options or llmConfig.jsonOutputStrategy.`;
      this.logger.error(errorMsg, { llmId });
      throw new LLMStrategyError(errorMsg, llmId);
    }

    // Determine tool schema: request option overrides default
    let toolParametersSchema;
    if (Object.prototype.hasOwnProperty.call(requestOptions, 'toolSchema')) {
      // Use request-specific schema (even if null or undefined)
      toolParametersSchema = requestOptions.toolSchema;
      this.logger.debug(
        `${this.constructor.name} (${llmId}): Using custom tool schema from request options.`,
        {
          llmId,
          schemaProperties: Object.keys(toolParametersSchema?.properties || {}),
        }
      );
    } else {
      // Fall back to default game AI schema
      toolParametersSchema =
        OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
        OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA;
      this.logger.debug(
        `${this.constructor.name} (${llmId}): No custom tool schema provided, using default game AI schema.`,
        { llmId }
      );
    }

    // Determine tool description: request option overrides default
    const toolDescription =
      requestOptions.toolDescription || OPENROUTER_DEFAULT_TOOL_DESCRIPTION;

    // Validate schema structure
    if (
      !toolParametersSchema ||
      typeof toolParametersSchema !== 'object' ||
      toolParametersSchema === null
    ) {
      this.logger.error(
        `${this.constructor.name} (${llmId}): Invalid tool parameters schema. Expected an object.`,
        { llmId, toolParametersSchema }
      );
      throw new LLMStrategyError(`Invalid tool parameters schema.`, llmId);
    }

    const tool = {
      type: 'function',
      function: {
        name: toolName,
        description: toolDescription,
        parameters: toolParametersSchema,
      },
    };

    this.logger.debug(
      `${this.constructor.name} (${llmId}): Defined tool for use with name '${toolName}'.`,
      {
        llmId,
        toolName: tool.function.name,
        isCustomSchema: !!requestOptions.toolSchema,
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
   * @param {object} [providerRequestPayload] - The request payload sent to the provider.
   * @returns {Promise<string>} A promise that resolves to the extracted JSON string.
   * @throws {LLMStrategyError} If JSON content cannot be extracted or validated.
   */
  async _extractJsonOutput(responseData, llmConfig, providerRequestPayload) {
    const llmId = getLlmId(llmConfig);
    const message = responseData?.choices?.[0]?.message;

    // Extract expected tool name from the provider request payload that was sent
    const expectedToolName = providerRequestPayload?.tools?.[0]?.function?.name;

    if (
      !expectedToolName ||
      typeof expectedToolName !== 'string' ||
      expectedToolName.trim() === ''
    ) {
      const errorMsg = `${this.constructor.name} (${llmId}): Unable to determine expected tool name from provider request payload for extraction.`;
      this.logger.error(errorMsg, {
        llmId,
        providerRequestPayload: JSON.stringify(
          providerRequestPayload
        )?.substring(0, 500),
      });
      throw new LLMStrategyError(errorMsg, llmId);
    }

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

      const reason = this.validateToolCall(toolCall, expectedToolName);

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
          expectedToolName, // Log the expected tool name from request payload
          responseDataPreview: JSON.stringify(responseData)?.substring(0, 500),
        });
        throw new LLMStrategyError(errorMsg, llmId, null, {
          toolCallDetails: toolCall,
          responsePreview: JSON.stringify(responseData)?.substring(0, 500),
        });
      }

      const extractedJsonString = toolCall.function.arguments.trim();
      this.logger.debug(
        `${this.constructor.name} (${llmId}): Successfully extracted JSON string from tool_calls[0].function.arguments for tool '${expectedToolName}'.`,
        {
          llmId,
          length: extractedJsonString.length,
          toolName: expectedToolName,
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
