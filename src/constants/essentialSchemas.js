// src/constants/essentialSchemas.js

/**
 * @file Lists schema type names that are required for engine startup.
 */

/**
 * Schema types that must be configured and loaded before gameplay.
 *
 * @type {string[]}
 */
export const ESSENTIAL_SCHEMA_TYPES = [
  'game',
  'components',
  'mod-manifest',
  'entityDefinitions',
  'entityInstances',
  'actions',
  'events',
  'rules',
  'conditions',
];

export default ESSENTIAL_SCHEMA_TYPES;
