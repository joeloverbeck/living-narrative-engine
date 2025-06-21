/**
 * @file Helper utilities for serialized entity structures used in tests.
 * @see tests/common/entities/serializationUtils.js
 */

/**
 * Creates a minimal serialized entity structure.
 *
 * @description Convenience helper for unit tests that need to construct
 * serialized entity objects. Provides defaults and ensures consistent shape.
 * @param {string} instanceId - Unique ID of the entity instance.
 * @param {string} definitionId - Definition ID that the entity conforms to.
 * @param {object} [components] - Component data keyed by component ID.
 * @returns {{instanceId: string, definitionId: string, components: object}} Serialized entity object.
 */
export function buildSerializedEntity(
  instanceId,
  definitionId,
  components = {}
) {
  return { instanceId, definitionId, components };
}
