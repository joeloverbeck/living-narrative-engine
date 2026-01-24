/**
 * @file Default tool schema handler for LLM strategies
 * @description Provides tool schema generation behavior for LLM strategies.
 * Custom schemas must be explicitly provided - no default fallback schema exists.
 */

import { OPENROUTER_DEFAULT_TOOL_DESCRIPTION } from '../../constants/llmConstants.js';

/**
 * @class DefaultToolSchemaHandler
 * @description Handles tool schema generation for LLM strategies.
 * Custom schemas must be explicitly provided via buildCustomToolSchema().
 * No default fallback schema exists - callers must provide their own schema.
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
   * Builds a tool schema - requires explicit schema parameters.
   * No default fallback schema exists. Use buildCustomToolSchema() instead
   * with an explicit schema.
   *
   * @param {string} llmId - The LLM identifier for logging purposes
   * @param {object} [requestOptions] - Optional request-specific options
   * @throws {Error} Always throws - no default schema available
   * @deprecated Use buildCustomToolSchema() with an explicit schema instead
   */
  buildDefaultToolSchema(llmId, requestOptions = {}) {
    const errorMsg = `DefaultToolSchemaHandler (${llmId}): No default tool schema available. A custom schema must be explicitly provided via buildCustomToolSchema().`;
    this.#logger.error(errorMsg, { llmId, requestOptions });
    throw new Error(errorMsg);
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
