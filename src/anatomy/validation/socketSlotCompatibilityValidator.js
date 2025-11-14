/**
 * @file Validates that blueprint additionalSlots reference valid sockets on root entity
 * @see ./socketExtractor.js
 */

import { extractSocketsFromEntity } from './socketExtractor.js';
import { levenshteinDistance } from '../../utils/stringUtils.js';

/**
 * Finds similar socket name using string similarity
 *
 * @param {string} requested - Requested socket name
 * @param {Array<string>} available - Available socket names
 * @returns {string|null} Most similar socket name or null
 */
function findSimilarSocketName(requested, available) {
  if (available.length === 0) return null;

  let closest = null;
  let minDistance = Infinity;

  for (const socket of available) {
    const distance = levenshteinDistance(
      requested.toLowerCase(),
      socket.toLowerCase()
    );

    if (distance < minDistance && distance <= 3) {
      minDistance = distance;
      closest = socket;
    }
  }

  return closest;
}

/**
 * Suggests how to fix socket mismatch
 *
 * @param {string} requestedSocket - Socket ID that was requested
 * @param {Map} availableSockets - Available sockets on entity
 * @param {string} rootEntityId - Root entity ID
 * @param {string} entitySourceFile - Source filename of entity (optional)
 * @returns {string} Fix suggestion
 */
function suggestSocketFix(
  requestedSocket,
  availableSockets,
  rootEntityId,
  entitySourceFile
) {
  const sourceFile =
    entitySourceFile ||
    `data/mods/*/entities/definitions/${rootEntityId.split(':')[1]}.entity.json`;

  if (availableSockets.size === 0) {
    return `Root entity has no sockets. Add anatomy:sockets component to entity file: ${sourceFile}`;
  }

  const socketList = Array.from(availableSockets.keys());

  // Try to find similar socket name
  const similar = findSimilarSocketName(requestedSocket, socketList);

  if (similar) {
    return `Socket '${requestedSocket}' not found. Did you mean '${similar}'? Available: [${socketList.join(', ')}]`;
  }

  return `Add socket '${requestedSocket}' to entity file '${sourceFile}' or use one of: [${socketList.join(', ')}]`;
}

/**
 * Validates structure template slot socket references
 *
 * @param {object} _blueprint - Blueprint definition (unused - placeholder for future enhancement)
 * @param {Map} _availableSockets - Available sockets (unused - placeholder for future enhancement)
 * @param {object} _rootEntity - Root entity (unused - placeholder for future enhancement)
 * @returns {Array<object>} Array of errors
 */
function validateStructureTemplateSockets(
  _blueprint,
  _availableSockets,
  _rootEntity
) {
  const errors = [];

  // Structure templates define slots that may reference sockets
  // This validation depends on structure template implementation
  // For now, this is a placeholder for future enhancement

  return errors;
}

/**
 * Validates that blueprint additionalSlots reference valid sockets on root entity
 *
 * @param {object} blueprint - Blueprint to validate
 * @param {object} dataRegistry - Data registry with entity definitions
 * @returns {Array<object>} Array of errors found
 */
export async function validateSocketSlotCompatibility(blueprint, dataRegistry) {
  const errors = [];

  if (!blueprint || !dataRegistry) {
    return errors;
  }

  // Check if root entity exists
  const rootEntity = dataRegistry.get('entityDefinitions', blueprint.root);

  if (!rootEntity) {
    errors.push({
      type: 'ROOT_ENTITY_NOT_FOUND',
      blueprintId: blueprint.id,
      rootEntityId: blueprint.root,
      message: `Root entity '${blueprint.root}' not found`,
      fix: `Create entity at data/mods/*/entities/definitions/${blueprint.root.split(':')[1]}.entity.json`,
      severity: 'error',
    });
    return errors; // Can't validate sockets without entity
  }

  // Extract available sockets from root entity
  const sockets = extractSocketsFromEntity(rootEntity);

  // Validate each additionalSlot references a valid socket
  for (const [slotName, slot] of Object.entries(
    blueprint.additionalSlots || {}
  )) {
    if (!slot.socket) {
      errors.push({
        type: 'MISSING_SOCKET_REFERENCE',
        blueprintId: blueprint.id,
        slotName: slotName,
        message: `Slot '${slotName}' has no socket reference`,
        fix: `Add "socket" property to additionalSlots.${slotName}`,
        severity: 'error',
      });
      continue;
    }

    if (!sockets.has(slot.socket)) {
      // Skip validation for optional slots - production gracefully handles missing sockets
      // by skipping optional slots (see slotResolutionOrchestrator.js:106-118)
      if (slot.optional === true) {
        continue;
      }

      errors.push({
        type: 'SOCKET_NOT_FOUND',
        blueprintId: blueprint.id,
        slotName: slotName,
        socketId: slot.socket,
        rootEntityId: blueprint.root,
        availableSockets: Array.from(sockets.keys()),
        message: `Socket '${slot.socket}' not found on root entity '${blueprint.root}'`,
        fix: suggestSocketFix(
          slot.socket,
          sockets,
          blueprint.root,
          rootEntity._sourceFile
        ),
        severity: 'error',
      });
    }
  }

  // Also validate structure template slots (if they reference sockets)
  if (blueprint.structureTemplate) {
    errors.push(
      ...validateStructureTemplateSockets(blueprint, sockets, rootEntity)
    );
  }

  return errors;
}
