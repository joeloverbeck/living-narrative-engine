// src/anatomy/socketManager.js

/**
 * @file Service responsible for managing socket occupancy and validation
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} Socket
 * @property {string} id - Socket identifier
 * @property {string[]} allowedTypes - Array of allowed part types
 * @property {string} [orientation] - Socket orientation (e.g., 'left', 'right')
 * @property {string} [nameTpl] - Name template for attached parts
 */

/**
 * Service that manages socket availability and validation during anatomy generation
 */
export class SocketManager {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    if (!entityManager) {
      throw new InvalidArgumentError('entityManager is required');
    }
    if (!logger) {
      throw new InvalidArgumentError('logger is required');
    }

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Gets a socket from a parent entity
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID to retrieve
   * @returns {Socket|null} The socket or null if not found
   */
  getSocket(parentId, socketId) {
    const socketsComponent = this.#entityManager.getComponentData(
      parentId,
      'anatomy:sockets'
    );

    if (!socketsComponent?.sockets) {
      this.#logger.debug(
        `SocketManager: No sockets component found on entity '${parentId}'`
      );
      return null;
    }

    const socket = socketsComponent.sockets.find((s) => s.id === socketId);

    if (!socket) {
      this.#logger.debug(
        `SocketManager: Socket '${socketId}' not found on entity '${parentId}'`
      );
    }

    return socket;
  }

  /**
   * Checks if a socket is occupied
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID
   * @param {Set<string>} socketOccupancy - Set tracking occupied sockets
   * @returns {boolean} True if occupied
   */
  isSocketOccupied(parentId, socketId, socketOccupancy) {
    const occupancyKey = this.#createOccupancyKey(parentId, socketId);
    return socketOccupancy.has(occupancyKey);
  }

  /**
   * Marks a socket as occupied
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID
   * @param {Set<string>} socketOccupancy - Set tracking occupied sockets
   */
  occupySocket(parentId, socketId, socketOccupancy) {
    const occupancyKey = this.#createOccupancyKey(parentId, socketId);
    socketOccupancy.add(occupancyKey);

    this.#logger.debug(
      `SocketManager: Occupied socket '${socketId}' on entity '${parentId}'`
    );
  }

  /**
   * Validates that a socket exists and is available
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID
   * @param {Set<string>} socketOccupancy - Set tracking occupied sockets
   * @param {boolean} isRequired - Whether the socket is required
   * @returns {{valid: boolean, socket?: Socket, error?: string}} Validation result
   */
  validateSocketAvailability(parentId, socketId, socketOccupancy, isRequired) {
    const socket = this.getSocket(parentId, socketId);

    if (!socket) {
      const parentEntity = this.#entityManager.getEntityInstance(parentId);
      const error = `Socket '${socketId}' not found on parent entity '${parentEntity?.definitionId || parentId}'`;

      if (isRequired) {
        return { valid: false, error };
      }

      this.#logger.debug(`SocketManager: ${error} (optional socket)`);
      return { valid: false };
    }

    if (this.isSocketOccupied(parentId, socketId, socketOccupancy)) {
      const error = `Socket '${socketId}' is already occupied on parent '${parentId}'`;

      if (isRequired) {
        return { valid: false, error };
      }

      this.#logger.debug(`SocketManager: ${error} (optional socket)`);
      return { valid: false };
    }

    return { valid: true, socket };
  }

  /**
   * Validates that a part type is allowed in a socket
   *
   * @param {Socket} socket - The socket to check
   * @param {string} partType - The part type to validate
   * @returns {boolean} True if part type is allowed
   */
  isPartTypeAllowed(socket, partType) {
    // Handle wildcard
    if (socket.allowedTypes.includes('*')) {
      return true;
    }

    return socket.allowedTypes.includes(partType);
  }

  /**
   * Generates a name for a part based on socket template
   *
   * @param {Socket} socket - Socket with name template
   * @param {string} childEntityId - Child entity ID
   * @param {string} parentId - Parent entity ID
   * @returns {string|null} Generated name or null if no template
   */
  generatePartName(socket, childEntityId, parentId) {
    if (!socket.nameTpl) {
      return null;
    }

    let name = socket.nameTpl;

    // Get part info
    const anatomyPart = this.#entityManager.getComponentData(
      childEntityId,
      'anatomy:part'
    );
    const parentName =
      this.#entityManager.getComponentData(parentId, 'core:name')?.text ||
      'parent';

    // Get effective orientation (from child entity's anatomy:part or socket)
    const effectiveOrientation =
      anatomyPart?.orientation || socket.orientation || '';

    // Debug logging for troubleshooting
    this.#logger.debug(
      `SocketManager: Generating name for child '${childEntityId}' with template '${socket.nameTpl}' - anatomyPart.orientation: '${anatomyPart?.orientation}', socket.orientation: '${socket.orientation}', effectiveOrientation: '${effectiveOrientation}', subType: '${anatomyPart?.subType}', socket.id: '${socket.id}'`
    );

    // Replace template tokens
    // For {{orientation}}, use socket orientation if available, otherwise use effective orientation
    // This handles cases where socket definitions don't include orientation but it's inferred from slot names
    name = name.replace(
      '{{orientation}}',
      socket.orientation || effectiveOrientation
    );
    name = name.replace('{{effective_orientation}}', effectiveOrientation);
    name = name.replace(
      '{{type}}',
      anatomyPart?.subType?.replace(/_/g, ' ') || 'part'
    );
    name = name.replace('{{parent.name}}', parentName);

    // Substitute {{index}} with the socket's index value
    name = name.replace('{{index}}', String(socket.index || ''));

    const finalName = name.trim();

    this.#logger.debug(
      `SocketManager: Generated name '${finalName}' for part using template '${socket.nameTpl}'`
    );

    return finalName;
  }

  /**
   * Validates all occupied sockets in the graph
   *
   * @param {Set<string>} socketOccupancy - Set of occupied sockets
   * @returns {string[]} Array of validation errors
   */
  validateOccupiedSockets(socketOccupancy) {
    const errors = [];

    for (const occupancyKey of socketOccupancy) {
      const [parentId, socketId] = occupancyKey.split(':');
      const socket = this.getSocket(parentId, socketId);

      if (!socket) {
        errors.push(
          `Occupied socket '${socketId}' not found on entity '${parentId}'`
        );
      }
    }

    return errors;
  }

  /**
   * Creates an occupancy key for tracking
   *
   * @param {string} parentId - Parent entity ID
   * @param {string} socketId - Socket ID
   * @returns {string} Occupancy key
   * @private
   */
  #createOccupancyKey(parentId, socketId) {
    return `${parentId}:${socketId}`;
  }
}

export default SocketManager;
