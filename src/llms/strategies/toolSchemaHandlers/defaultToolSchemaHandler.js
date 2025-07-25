/**
 * @file Default tool schema handler for LLM strategies
 * @description Provides default tool schema generation behavior that can be used
 * by strategies that don't require custom schema logic.
 */

import {
  OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA,
  OPENROUTER_DEFAULT_TOOL_DESCRIPTION,
} from '../../constants/llmConstants.js';

/**
 * @class DefaultToolSchemaHandler
 * @description Handles default tool schema generation using the standard game AI action schema.
 * This provides backward compatibility with existing implementations while serving as a fallback
 * for strategies that don't implement custom schema logic.
 */
export class DefaultToolSchemaHandler {
  /**
   * @private
   * @type {import('../../../interfaces/coreServices.js').ILogger}
   */
  #logger;

  /**
   * Creates an instance of DefaultToolSchemaHandler.
   *
   * @param {object} dependencies - The dependencies for this handler.
   * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger - A logger instance.
   */
  constructor({ logger }) {
    if (!logger || typeof logger.error !== 'function') {
      throw new Error(
        'DefaultToolSchemaHandler: Constructor requires a valid ILogger instance.'
      );
    }
    this.#logger = logger;
  }

  /**
   * Builds the default game AI tool schema.
   * This method provides the standard tool schema used throughout the system
   * for game AI decision-making.
   *
   * @param {string} llmId - The LLM identifier for logging purposes
   * @param {object} [requestOptions] - Optional request-specific options
   * @param {string} [requestOptions.toolName] - Override for the tool name
   * @param {string} [requestOptions.toolDescription] - Override for the tool description
   * @returns {object} The default tool schema object
   */
  buildDefaultToolSchema(llmId, requestOptions = {}) {
    // Use default game AI schema
    const toolParametersSchema =
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA.schema ||
      OPENROUTER_GAME_AI_ACTION_SPEECH_SCHEMA;

    // Default tool name and description unless overridden
    const toolName = requestOptions.toolName || 'game_ai_action_speech';
    const toolDescription =
      requestOptions.toolDescription || OPENROUTER_DEFAULT_TOOL_DESCRIPTION;

    this.#logger.debug(
      `DefaultToolSchemaHandler (${llmId}): Building default tool schema with name '${toolName}'.`,
      { llmId, toolName }
    );

    return {
      type: 'function',
      function: {
        name: toolName,
        description: toolDescription,
        parameters: toolParametersSchema,
      },
    };
  }

  /**
   * Validates that a tool schema has the required structure.
   *
   * @param {object} toolSchema - The tool schema to validate
   * @param {string} llmId - The LLM identifier for logging purposes
   * @returns {boolean} True if the schema is valid, false otherwise
   */
  validateToolSchema(toolSchema, llmId) {
    if (!toolSchema || typeof toolSchema !== 'object') {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool schema - must be an object.`,
        { llmId, toolSchema }
      );
      return false;
    }

    if (toolSchema.type !== 'function') {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool schema - type must be 'function'.`,
        { llmId, type: toolSchema.type }
      );
      return false;
    }

    if (!toolSchema.function || typeof toolSchema.function !== 'object') {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool schema - function property must be an object.`,
        { llmId, function: toolSchema.function }
      );
      return false;
    }

    const { name, description, parameters } = toolSchema.function;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool schema - function.name must be a non-empty string.`,
        { llmId, name }
      );
      return false;
    }

    if (
      !description ||
      typeof description !== 'string' ||
      description.trim() === ''
    ) {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool schema - function.description must be a non-empty string.`,
        { llmId, description }
      );
      return false;
    }

    if (!parameters || typeof parameters !== 'object') {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool schema - function.parameters must be an object.`,
        { llmId, parameters }
      );
      return false;
    }

    this.#logger.debug(
      `DefaultToolSchemaHandler (${llmId}): Tool schema validation passed for '${name}'.`,
      { llmId, toolName: name }
    );

    return true;
  }

  /**
   * Builds a tool schema with custom parameters while maintaining the standard structure.
   *
   * @param {object} customParameters - Custom parameters schema
   * @param {string} toolName - The tool name to use
   * @param {string} toolDescription - The tool description to use
   * @param {string} llmId - The LLM identifier for logging purposes
   * @returns {object} The custom tool schema object
   */
  buildCustomToolSchema(customParameters, toolName, toolDescription, llmId) {
    // Validate inputs
    if (!customParameters || typeof customParameters !== 'object') {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid custom parameters - must be an object.`,
        { llmId, customParameters }
      );
      throw new Error('Custom parameters must be an object');
    }

    if (!toolName || typeof toolName !== 'string' || toolName.trim() === '') {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool name - must be a non-empty string.`,
        { llmId, toolName }
      );
      throw new Error('Tool name must be a non-empty string');
    }

    if (
      !toolDescription ||
      typeof toolDescription !== 'string' ||
      toolDescription.trim() === ''
    ) {
      this.#logger.error(
        `DefaultToolSchemaHandler (${llmId}): Invalid tool description - must be a non-empty string.`,
        { llmId, toolDescription }
      );
      throw new Error('Tool description must be a non-empty string');
    }

    const customToolSchema = {
      type: 'function',
      function: {
        name: toolName,
        description: toolDescription,
        parameters: customParameters,
      },
    };

    this.#logger.debug(
      `DefaultToolSchemaHandler (${llmId}): Built custom tool schema with name '${toolName}'.`,
      {
        llmId,
        toolName,
        schemaProperties: Object.keys(customParameters.properties || {}),
      }
    );

    return customToolSchema;
  }
}
