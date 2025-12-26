// @jest-environment node

import { describe, it, expect } from '@jest/globals';
import { DRINKABLE_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { findSimilar } from '../../../src/utils/suggestionUtils.js';

/**
 * Build suggestion candidates for namespace mismatches.
 *
 * @param {string} missingId - Missing component ID.
 * @param {Set<string>} registryIds - Registry IDs to compare against.
 * @returns {string[]} Suggested IDs.
 */
function findNamespaceSuggestions(missingId, registryIds) {
  const availableIds = [...registryIds];
  const suggestions = findSimilar(missingId, availableIds, {
    maxDistance: 4,
    maxSuggestions: 3,
    caseInsensitive: true,
  });
  if (suggestions.length > 0) {
    return suggestions;
  }

  const missingParts = missingId.split(':');
  if (missingParts.length < 2 || !missingParts[1]) {
    return suggestions;
  }

  return availableIds.filter((candidate) => {
    const candidateParts = candidate.split(':');
    return candidateParts.length > 1 && candidateParts[1] === missingParts[1];
  });
}

/**
 * Build a missing ID message with suggestions.
 *
 * @param {string} missingId - Missing component ID.
 * @param {Set<string>} registryIds - Registry IDs to compare against.
 * @returns {string} Error message.
 */
function buildMissingMessage(missingId, registryIds) {
  const suggestions = findNamespaceSuggestions(missingId, registryIds);

  if (suggestions.length === 0) {
    return `Missing component ID: ${missingId}`;
  }

  return `Missing component ID: ${missingId} (suggestions: ${suggestions.join(
    ', '
  )})`;
}

/**
 * Validate component IDs against a registry.
 *
 * @param {string[]} ids - Component IDs to validate.
 * @param {Set<string>} registryIds - Registry IDs to compare against.
 * @returns {{missing: string[], messages: string[]}} Validation results.
 */
function validateComponentIds(ids, registryIds) {
  const missing = ids.filter((id) => !registryIds.has(id));
  const messages = missing.map((missingId) =>
    buildMissingMessage(missingId, registryIds)
  );
  return { missing, messages };
}

describe('Namespace Mismatch Regression', () => {
  it('detects namespace mismatch from ITEMSPLIT-007', () => {
    // ITEMSPLIT-007 regression: handler expects drinking:drinkable, registry has items:drinkable.
    // See specs/operation-handler-namespace-coupling.md for context.
    const mockRegistryIds = new Set(['items:drinkable', 'core:actor']);

    const result = validateComponentIds(
      [DRINKABLE_COMPONENT_ID],
      mockRegistryIds
    );

    expect(result.missing).toEqual([DRINKABLE_COMPONENT_ID]);
    expect(result.messages[0]).toContain('items:drinkable');
  });

  it('suggests similar IDs when namespace mismatches occur', () => {
    const mockRegistryIds = new Set([
      'items:drinkable',
      'items:empty',
      'core:actor',
    ]);

    const result = validateComponentIds(
      [DRINKABLE_COMPONENT_ID],
      mockRegistryIds
    );

    expect(result.messages[0]).toContain('items:drinkable');
  });
});
