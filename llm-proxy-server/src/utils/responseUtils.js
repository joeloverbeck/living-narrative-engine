// llm-proxy-server/src/utils/responseUtils.js

import { LOG_LLM_ID_NOT_APPLICABLE } from '../config/constants.js';
import { ensureValidLogger } from './loggerUtils.js'; // MODIFIED: Import ensureValidLogger

/**
 * @typedef {import('express').Response} ExpressResponse
 */

/**
 * @typedef {object} ILogger
 * @description Defines a basic logger interface.
 * @property {(message: any, ...optionalParams: any[]) => void} debug - Logs a debug message.
 * @property {(message: any, ...optionalParams: any[]) => void} info - Logs an informational message.
 * @property {(message: any, ...optionalParams: any[]) => void} warn - Logs a warning message.
 * @property {(message: any, ...optionalParams: any[]) => void} error - Logs an error message.
 */

/**
 * @typedef {object} ErrorDetails
 * @description Defines the structure for the 'details' object in error responses.
 * This object provides additional contextual information about the error.
 * @property {string | null} [llmId] - The identifier of the LLM involved, if applicable.
 * @property {string | null} [originalErrorMessage] - If the current error is wrapping another error,
 * this field can hold the message of the original, underlying error.
 * @property {string} [pathAttempted] - For errors related to file system access or resource loading.
 * @property {string} [attemptedFile] - Similar to pathAttempted, but for a specific file name.
 * @property {string} [targetUrl] - For errors during outbound HTTP requests.
 * @property {number | string} [llmApiStatusCode] - HTTP status code from an external LLM API.
 * @property {any} [serviceSpecificContext] - Placeholder for other service-specific key-value pairs.
 * Ensure no sensitive internal data is included if details are client-facing.
 */

/**
 * Sends a standardized JSON error response to the client and logs the error.
 *
 * @param {ExpressResponse} res - The Express Response object.
 * @param {number} httpStatusCode - The HTTP status code to send to the client.
 * @param {string} stage - A machine-readable string indicating the stage where the error occurred.
 * @param {string} errorMessage - A human-readable error message for the client.
 * @param {ErrorDetails} [details] - An object containing additional structured details about the error.
 * @param {string} [llmIdForLog] - The LLM ID for server-side log.
 * @param {ILogger} logger - An ILogger instance for logging the error.
 */
export function sendProxyError(
  res,
  httpStatusCode,
  stage,
  errorMessage,
  details = {},
  llmIdForLog = LOG_LLM_ID_NOT_APPLICABLE,
  logger
) {
  // MODIFIED: Use ensureValidLogger
  const effectiveLogger = ensureValidLogger(logger, 'sendProxyError');

  const errorResponse = {
    error: true,
    message: errorMessage,
    stage: stage,
    details: details || {}, // Ensure details is always an object
    originalStatusCode: httpStatusCode, // This reflects the status code the proxy intends to send.
  };

  // Log the error with structured details intended for the client
  effectiveLogger.error(
    `LLM Proxy Server: Sending error to client. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
    { errorDetailsSentToClient: errorResponse.details }
  );

  if (res.headersSent) {
    effectiveLogger.warn(
      `LLM Proxy Server: Attempted to send error response, but headers were already sent. LLM ID for log: ${llmIdForLog}, Status: ${httpStatusCode}, Stage: "${stage}", Message: "${errorMessage}"`,
      { errorDetailsNotSentDueToHeaders: errorResponse.details }
    );
    return;
  }

  try {
    res.status(httpStatusCode).json(errorResponse);
  } catch (sendError) {
    // Log the critical failure to send the original error response
    effectiveLogger.error(
      `LLM Proxy Server: CRITICAL - Failed to send original error response to client. LLM ID for log: ${llmIdForLog}, Original Stage: "${stage}", Original Message: "${errorMessage}". Send Error: ${sendError.message}`,
      {
        originalErrorIntendedForClient: errorResponse,
        failureToSendDetails: { name: sendError.name, stack: sendError.stack },
      }
    );
    // As a last resort, if sending JSON failed and headers aren't sent, try plain text.
    // This is unlikely to succeed if .json() failed due to response stream issues, but worth a try.
    if (!res.headersSent) {
      try {
        res
          .status(500)
          .send(
            'Internal Server Error: Failed to format and send detailed error response.'
          );
      } catch (lastDitchSendError) {
        effectiveLogger.error(
          `LLM Proxy Server: CRITICAL - Failed even to send last-ditch plain text error. LLM ID for log: ${llmIdForLog}. Last Ditch Error: ${lastDitchSendError.message}`,
          {
            lastDitchSendErrorDetails: {
              name: lastDitchSendError.name,
              stack: lastDitchSendError.stack,
            },
          }
        );
      }
    }
  }
}
