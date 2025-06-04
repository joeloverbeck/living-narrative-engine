// llm-proxy-server/src/config/proxyLlmConfigLoader.js
// --- FILE START ---

import * as path from 'node:path';
import { ensureValidLogger } from './utils/loggerUtils.js'; // Assuming correct path to loggerUtils

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

/**
 * @typedef {import('../interfaces/iFileSystemReader.js').IFileSystemReader} IFileSystemReader
 */

/**
 * @typedef {import('../../src/llms/services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @typedef {object} LLMConfigurationFileForProxy
 * @description Represents the structure of the parsed llm-configs.json file for the proxy.
 * @property {string} [defaultConfigId] - Specifies the ID of the LLM configuration to use by default.
 * @property {Object<string, LLMModelConfig>} configs - A dictionary of LLM configurations.
 */

/**
 * @typedef {object} ProxyLoadConfigsErrorResult
 * @description Represents a failed configuration load attempt.
 * @property {true} error - Indicates an error occurred.
 * @property {string} message - Description of the error.
 * @property {string} [stage] - Stage where the error occurred.
 * @property {Error} [originalError] - The original error object, if any.
 * @property {string} [pathAttempted] - The file path that was attempted.
 */

/**
 * @typedef {object} ProxyLoadConfigsSuccessResult
 * @description Represents a successful configuration load attempt.
 * @property {false} error - Indicates no error occurred.
 * @property {LLMConfigurationFileForProxy} llmConfigs - The loaded configurations.
 */

/**
 * Loads and parses the LLM configuration file from the specified path using a file system reader.
 *
 * @async
 * @param {string} configFilePath - The absolute or relative path to the llm-configs.json file.
 * @param {ILogger} logger - A logger instance.
 * @param {IFileSystemReader} fileSystemReader - An instance conforming to IFileSystemReader to read the file.
 * @returns {Promise<ProxyLoadConfigsSuccessResult | ProxyLoadConfigsErrorResult>} A promise that resolves with
 * the parsed configurations or an error object.
 */
export async function loadProxyLlmConfigs(
  configFilePath,
  logger,
  fileSystemReader
) {
  const effectiveLogger = ensureValidLogger(logger, 'ProxyLlmConfigLoader');

  if (!fileSystemReader || typeof fileSystemReader.readFile !== 'function') {
    const errorMsg =
      'A valid fileSystemReader with a readFile method must be provided.';
    effectiveLogger.error(errorMsg, {
      dependency: 'fileSystemReader',
      pathAttempted: configFilePath,
    });
    return {
      error: true,
      message: `ProxyLlmConfigLoader: ${errorMsg}`,
      stage: 'initialization_error_dependency_missing_filereader',
      pathAttempted: configFilePath,
    };
  }

  const resolvedPath = path.resolve(configFilePath);
  effectiveLogger.info(
    `Attempting to load LLM configurations from: ${resolvedPath}`
  );

  try {
    const fileContent = await fileSystemReader.readFile(resolvedPath, 'utf-8');
    effectiveLogger.debug(
      `Successfully read file content from ${resolvedPath}. Length: ${fileContent.length}`
    );

    const parsedConfigs = JSON.parse(fileContent);
    effectiveLogger.debug(
      `Successfully parsed JSON content from ${resolvedPath}.`
    );

    if (
      typeof parsedConfigs !== 'object' ||
      parsedConfigs === null ||
      typeof parsedConfigs.configs !== 'object' ||
      parsedConfigs.configs === null
    ) {
      const errorMsg = `Configuration file from ${resolvedPath} is malformed or missing 'configs' object.`;
      effectiveLogger.error(errorMsg, {
        path: resolvedPath,
        parsedContentPreview: JSON.stringify(parsedConfigs)?.substring(0, 200),
      });
      return {
        error: true,
        message: `ProxyLlmConfigLoader: ${errorMsg}`,
        stage: 'validation_malformed_or_missing_configs_map', // Updated stage
        pathAttempted: resolvedPath,
      };
    }

    effectiveLogger.info(
      `LLM configurations loaded and validated successfully from ${resolvedPath}. Found ${Object.keys(parsedConfigs.configs).length} LLM configurations.`
    );
    return {
      error: false,
      llmConfigs: parsedConfigs, // This now correctly contains the object with the 'configs' property
    };
  } catch (error) {
    let stage = 'unknown_load_parse_error';
    let baseErrorMessage;

    if (error instanceof SyntaxError) {
      stage = 'parse_json_syntax_error';
      baseErrorMessage = `Failed to parse LLM configurations from ${resolvedPath} due to JSON syntax error: ${error.message}`;
    } else if (error.code === 'ENOENT') {
      stage = 'read_file_not_found';
      baseErrorMessage = `LLM configuration file not found at ${resolvedPath}.`;
    } else if (error.code) {
      stage = 'read_file_system_error';
      baseErrorMessage = `Failed to read LLM configuration file from ${resolvedPath} due to file system error (Code: ${error.code}): ${error.message}`;
    } else {
      baseErrorMessage = `An unexpected error occurred while loading/parsing LLM configurations from ${resolvedPath}: ${error.message}`;
    }

    effectiveLogger.error(baseErrorMessage, {
      pathAttempted: resolvedPath,
      errorStage: stage,
      originalError: {
        name: error.name,
        message: error.message,
        code: error.code,
      },
    });

    return {
      error: true,
      message: `ProxyLlmConfigLoader: ${baseErrorMessage}`,
      stage: stage,
      originalError: error,
      pathAttempted: resolvedPath,
    };
  }
}

// --- FILE END ---
