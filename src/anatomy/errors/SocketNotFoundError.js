/**
 * @file Error for socket not found on root entity
 * @description Enhanced error for missing socket references in blueprint slots
 */

import AnatomyError from './AnatomyError.js';

/**
 * Error thrown when a socket referenced in a blueprint slot does not exist on the root entity
 *
 * @class
 * @augments {AnatomyError}
 */
class SocketNotFoundError extends AnatomyError {
  /**
   * Creates a new SocketNotFoundError instance
   *
   * @param {object} params - Error parameters
   * @param {string} params.blueprintId - The blueprint ID where the error occurred
   * @param {string} params.slotName - The slot name referencing the missing socket
   * @param {string} params.socketId - The socket ID that was not found
   * @param {string} params.rootEntityId - The root entity ID that should have the socket
   * @param {string[]} params.availableSockets - Array of available socket IDs on the root entity
   * @param {string} [params.entityPath] - File path to the root entity definition
   */
  constructor({
    blueprintId,
    slotName,
    socketId,
    rootEntityId,
    availableSockets,
    entityPath,
  }) {
    const fixes = [`Option 1: Add socket to root entity`];

    if (entityPath) {
      fixes.push(`  File: ${entityPath}`);
    }

    fixes.push(
      `  Add to anatomy:sockets.sockets array:`,
      '  {',
      `    "id": "${socketId}",`,
      '    "allowedTypes": ["part_type_here"],',
      '    "orientation": "mid",',
      '    "nameTpl": "{{type}}"',
      '  }',
      '',
      `Option 2: Use existing socket`,
      `  Available sockets: [${availableSockets.join(', ')}]`,
      `  Update blueprint slots.${slotName}.socket`
    );

    super({
      context: `Blueprint '${blueprintId}', Slot '${slotName}'`,
      problem: `Socket '${socketId}' not found on root entity '${rootEntityId}'`,
      impact: `Slot processing will fail during anatomy generation`,
      fix: fixes,
      references: [
        'docs/anatomy/blueprints-and-templates.md',
        'docs/anatomy/anatomy-system-guide.md',
        'data/mods/anatomy/components/sockets.component.json (schema)',
      ],
    });

    this.blueprintId = blueprintId;
    this.slotName = slotName;
    this.socketId = socketId;
    this.rootEntityId = rootEntityId;
    this.availableSockets = availableSockets;
  }
}

export default SocketNotFoundError;
