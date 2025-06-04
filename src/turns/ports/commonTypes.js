// src/core/ports/commonTypes.js
// --- FILE START ---

/**
 * @file Common types used across different ports within the core domain.
 */

/**
 * @callback UnsubscribeFn
 * @description A function that, when called, unsubscribes the listener.
 * @returns {void}
 */

/**
 * Re-exporting DiscoveredActionInfo for clarity within the ports directory.
 * Defines the structure of information about a single action that an entity can perform.
 * @typedef {import('../../interfaces/IActionDiscoverySystem.js').DiscoveredActionInfo} DiscoveredActionInfo
 * @property {string} id - The unique identifier of the action (e.g., "core:move").
 * @property {string} command - The specific command string to invoke this action variant (e.g., "go north", "take rusty key").
 */

// Ensure this file is treated as a module.
export {};

// --- FILE END ---
