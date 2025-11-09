/**
 * @file Socket extraction utilities for anatomy entities
 * @see ./socketSlotCompatibilityValidator.js
 */

/**
 * Extracts socket information from entity definition
 *
 * @param {object} entity - Entity definition
 * @returns {Map<string, object>} Map of socket ID to socket data
 */
export function extractSocketsFromEntity(entity) {
  const socketsMap = new Map();

  if (!entity || typeof entity !== 'object') {
    return socketsMap;
  }

  // Check for anatomy:sockets component
  const socketsComponent = entity.components?.['anatomy:sockets'];

  if (!socketsComponent) {
    return socketsMap; // No sockets component
  }

  // Extract socket list
  const socketList = socketsComponent.sockets || [];

  for (const socket of socketList) {
    if (socket.id) {
      socketsMap.set(socket.id, {
        id: socket.id,
        orientation: socket.orientation,
        allowedTypes: socket.allowedTypes || [],
        nameTpl: socket.nameTpl,
        index: socket.index,
      });
    }
  }

  return socketsMap;
}
