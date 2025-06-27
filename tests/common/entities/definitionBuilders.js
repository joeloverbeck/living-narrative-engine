import EntityDefinition from '../../../src/entities/entityDefinition.js';

/**
 * @file Helper builders for entity definitions used in integration tests.
 * @see tests/common/entities/definitionBuilders.js
 */

/**
 * Builds a minimal {@link EntityDefinition} instance.
 *
 * @param {string} id - Unique definition identifier.
 * @param {Record<string, any>} components - Component map keyed by ID.
 * @param {string} [description] - Optional description text.
 * @returns {EntityDefinition} Newly constructed definition.
 */
export function buildEntityDefinition(
  id,
  components = {},
  description = 'Test definition'
) {
  return new EntityDefinition(id, { description, components });
}
