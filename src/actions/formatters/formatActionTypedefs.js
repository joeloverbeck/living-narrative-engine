// src/actions/formatters/formatActionTypedefs.js
/**
 * @file Shared typedefs for action formatting utilities.
 */

/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */

/**
 * Result object returned when formatting succeeds.
 *
 * @typedef {object} FormatActionOk
 * @property {true} ok - Indicates success.
 * @property {string} value - The formatted command string.
 */

/**
 * Result object returned when formatting fails.
 *
 * @typedef {object} FormatActionError
 * @property {false} ok - Indicates failure.
 * @property {string} error - The reason formatting failed.
 * @property {string} [details] - Additional error details.
 */

/**
 * Union of possible formatAction results.
 *
 * @typedef {FormatActionOk | FormatActionError} FormatActionCommandResult
 */

/**
 * Mapping of target types to formatter functions.
 *
 * @typedef {Object.<string, (command: string, context: ActionTargetContext, deps: object) => FormatActionCommandResult>} TargetFormatterMap
 */

export const __formatActionTypedefs = true;
