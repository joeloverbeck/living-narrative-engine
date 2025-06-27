import Entity from '../../../src/entities/entity.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';

/**
 * @description Creates an {@link EntityDefinition} with the provided components.
 * @param {string} id - Unique definition identifier.
 * @param {Record<string, any>} [components] - Components mapped by ID.
 * @param {string} [description] - Optional description text.
 * @returns {EntityDefinition} The constructed definition instance.
 */
export function createEntityDefinition(
  id,
  components = {},
  description = 'Test definition'
) {
  return new EntityDefinition(id, { description, components });
}

/**
 * @description Creates an {@link Entity} instance with optional base components
 *   and component overrides.
 * @param {object} params - Parameters for entity creation.
 * @param {string} params.instanceId - Instance identifier for the entity.
 * @param {string} [params.definitionId] - Definition identifier.
 * @param {Record<string, any>} [params.baseComponents] - Components on the definition.
 * @param {Record<string, any>} [params.overrides] - Component overrides for the instance.
 * @returns {Entity} Newly created entity instance.
 */
export function createEntityInstance({
  instanceId,
  definitionId = 'test:def',
  baseComponents = {},
  overrides = {},
}) {
  const defId = definitionId.includes(':')
    ? definitionId
    : `test:${definitionId}`;
  const definition = createEntityDefinition(defId, baseComponents);
  const data = new EntityInstanceData(instanceId, definition, overrides);
  return new Entity(data);
}
