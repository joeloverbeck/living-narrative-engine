// src/utils/processEnvReader.js
// --- CORRECTED FILE START ---
/* eslint-env node */

// Corrected import path
import { IEnvironmentVariableReader } from '../../llm-proxy-server/src/interfaces/IServerUtils.js';

/**
 * @class ProcessEnvReader
 * @implements {IEnvironmentVariableReader}
 * @description An implementation of IEnvironmentVariableReader that reads environment variables
 * from the Node.js `process.env` object, ensuring only direct properties are returned.
 */
export class ProcessEnvReader extends IEnvironmentVariableReader {
  /**
   * Retrieves the value of an environment variable from `process.env`.
   * Only returns the value if the variable is a direct property of `process.env`.
   *
   * @param {string} variableName - The name of the environment variable.
   * @returns {string | undefined} The value of the environment variable if set as a direct property, otherwise undefined.
   */
  getEnv(variableName) {
    // The ticket doesn't explicitly ask for validation on variableName itself,
    // but this check is good practice. We'll keep it simple for now.
    // if (typeof variableName !== 'string') { // Or variableName === ''
    //     return undefined; // Or throw new Error('Variable name must be a non-empty string.');
    // }

    // Ensure we only retrieve properties directly set on process.env
    // and not from its prototype chain.
    if (
      globalThis.process &&
      Object.prototype.hasOwnProperty.call(globalThis.process.env, variableName)
    ) {
      return globalThis.process.env[variableName];
    }
    return undefined;
  }
}

// --- CORRECTED FILE END ---
