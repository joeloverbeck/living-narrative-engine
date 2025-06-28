// src/utils/errorTypes.js
/**
 * @file Shared error type definitions to avoid circular dependencies.
 */

/**
 * @typedef {object} FatalErrorUIElements
 * @property {HTMLElement | null | undefined} outputDiv - The main output area element.
 * @property {HTMLElement | null | undefined} errorDiv - The element for displaying errors.
 * @property {HTMLInputElement | null | undefined} inputElement - The user command input element.
 * @property {HTMLElement | null | undefined} titleElement - The title display element.
 */

/**
 * @typedef {object} FatalErrorDetails
 * @property {string} userMessage - Message to display to the user (e.g., in errorDiv or alert).
 * @property {string} consoleMessage - Message for console.error.
 * @property {Error} [errorObject] - The actual error object for console.error.
 * @property {string} [pageTitle] - Text for the h1 title element. Defaults to "Fatal Error!".
 * @property {string} [inputPlaceholder] - Placeholder text for the input element. Defaults to "Application failed to start."
 * @property {string} [phase] - The bootstrap phase where the error occurred (for logging, e.g., "DOM Check", "DI Config").
 */

// This file only contains type definitions, no runtime code.
export {};
