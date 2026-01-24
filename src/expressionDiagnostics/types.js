/**
 * @file Type definitions for expression diagnostics
 * @description Shared type definitions used across expression diagnostics services
 */

/**
 * @typedef {object} Prototype
 * @property {string} id - Unique prototype identifier
 * @property {string} type - Prototype type (emotional, sexual, etc.)
 * @property {Record<string, number>} weights - Axis weights for the prototype
 * @property {Array<object>} gates - Gate conditions for prototype activation
 */

/**
 * @typedef {string} PrototypeRef
 * Reference to a prototype by ID
 */

export {};
