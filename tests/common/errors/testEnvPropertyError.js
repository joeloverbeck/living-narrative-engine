/**
 * @file Error thrown when accessing undefined properties on testEnv
 */

import { findSimilar } from '../../../src/utils/suggestionUtils.js';

/**
 * Common property name confusions and their corrections
 */
const COMMON_CONFUSIONS = {
  scopeResolver: 'unifiedScopeResolver',
  resolver: 'unifiedScopeResolver',
  scopeDsl: 'unifiedScopeResolver',
  entityMgr: 'entityManager',
  evtBus: 'eventBus',
  bus: 'eventBus',
};

/**
 * Formats an error message with available properties, suggestions, and hints.
 *
 * @param {string} property - The property that was accessed
 * @param {string[]} availableProperties - List of available properties
 * @param {string[]} suggestions - Similar property names
 * @param {string[]} hints - Helpful hints for common confusions
 * @returns {string} Formatted error message
 */
function formatErrorMessage(property, availableProperties, suggestions, hints) {
  let msg = `Property '${property}' does not exist on testEnv.\n\n`;
  msg += `Available properties:\n`;
  msg += availableProperties.map((p) => `  - ${p}`).join('\n');

  if (suggestions.length > 0) {
    msg += `\n\nDid you mean: '${suggestions[0]}'?`;
  }

  if (hints.length > 0) {
    msg += `\n\nHint: ${hints.join('\n       ')}`;
  }

  return msg;
}

/**
 * Error thrown when accessing undefined properties on testEnv objects.
 * Provides helpful suggestions and hints for common property name mistakes.
 */
class TestEnvPropertyError extends Error {
  /**
   * Creates a new TestEnvPropertyError.
   *
   * @param {string} property - The property that was accessed
   * @param {string[]} availableProperties - List of available properties on testEnv
   */
  constructor(property, availableProperties) {
    const suggestions = findSimilar(property, availableProperties, {
      maxDistance: 5,
      maxSuggestions: 3,
    });

    const hints = [];
    if (COMMON_CONFUSIONS[property]) {
      hints.push(
        `Common property name confusion: ${property} → ${COMMON_CONFUSIONS[property]}`
      );
    }

    const message = formatErrorMessage(
      property,
      availableProperties,
      suggestions,
      hints
    );
    super(message);

    this.name = 'TestEnvPropertyError';
    this.property = property;
    this.availableProperties = availableProperties;
    this.suggestions = suggestions;
    this.hints = hints;
  }
}

export { TestEnvPropertyError, COMMON_CONFUSIONS };
