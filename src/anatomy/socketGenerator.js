/**
 * @file SocketGenerator - Generates socket definitions from structure template patterns
 * @see docs/anatomy/structure-templates.md
 * @see workflows/ANABLUNONHUM-007-socket-generator.md
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { OrientationResolver } from './shared/orientationResolver.js';

/**
 * Service to generate socket definitions from structure template limbSet/appendage patterns.
 * Applies template variables and orientation schemes to create socket configurations.
 *
 * @example
 * const sockets = socketGenerator.generateSockets(structureTemplate);
 * // Returns: [{id: 'leg_1', orientation: 'left', allowedTypes: ['spider_leg'], ...}, ...]
 */
class SocketGenerator {
  #logger;

  /**
   * Creates a new SocketGenerator instance.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
  }

  /**
   * Generates socket definitions from a structure template.
   * Processes both limbSets and appendages to create complete socket list.
   *
   * @param {object} structureTemplate - Structure template with topology definition
   * @param {object} structureTemplate.topology - Topology configuration
   * @param {Array<object>} [structureTemplate.topology.limbSets] - Limb set definitions
   * @param {Array<object>} [structureTemplate.topology.appendages] - Appendage definitions
   * @returns {Array<object>} Array of generated socket definitions
   * @throws {Error} If template structure is invalid
   */
  generateSockets(structureTemplate) {
    if (!structureTemplate || !structureTemplate.topology) {
      throw new Error(
        'Invalid structure template: missing topology definition'
      );
    }

    const sockets = [];
    const { limbSets = [], appendages = [] } = structureTemplate.topology;

    this.#logger.debug(
      `SocketGenerator: Generating sockets from template with ${limbSets.length} limb sets and ${appendages.length} appendages`
    );

    // Process each limbSet
    for (const limbSet of limbSets) {
      const limbSockets = this.#generateSocketsFromLimbSet(limbSet);
      sockets.push(...limbSockets);
    }

    // Process each appendage
    for (const appendage of appendages) {
      const appendageSockets = this.#generateSocketsFromAppendage(appendage);
      sockets.push(...appendageSockets);
    }

    // Validate uniqueness
    this.#validateSocketUniqueness(sockets);

    this.#logger.info(
      `SocketGenerator: Generated ${sockets.length} sockets successfully`
    );

    return sockets;
  }

  /**
   * Generates sockets from a limb set definition
   *
   * @param {object} limbSet - Limb set configuration
   * @param {number} limbSet.count - Number of limbs to generate
   * @param {object} limbSet.socketPattern - Socket generation pattern
   * @param {string} [limbSet.arrangement] - Spatial arrangement type
   * @returns {Array<object>} Array of generated sockets
   * @private
   */
  #generateSocketsFromLimbSet(limbSet) {
    const sockets = [];
    const { count, socketPattern, arrangement } = limbSet;

    for (let index = 1; index <= count; index++) {
      const socket = this.#createSocketFromPattern(
        socketPattern,
        index,
        count,
        arrangement
      );
      sockets.push(socket);
    }

    return sockets;
  }

  /**
   * Generates sockets from an appendage definition
   *
   * @param {object} appendage - Appendage configuration
   * @param {number} appendage.count - Number of appendages to generate
   * @param {object} appendage.socketPattern - Socket generation pattern
   * @returns {Array<object>} Array of generated sockets
   * @private
   */
  #generateSocketsFromAppendage(appendage) {
    const sockets = [];
    const { count, socketPattern } = appendage;

    for (let index = 1; index <= count; index++) {
      const socket = this.#createSocketFromPattern(socketPattern, index, count);
      sockets.push(socket);
    }

    return sockets;
  }

  /**
   * Creates a socket definition from a socket pattern
   *
   * @param {object} socketPattern - Socket generation pattern
   * @param {string} socketPattern.idTemplate - Template for socket ID
   * @param {string} [socketPattern.orientationScheme] - Orientation scheme to use
   * @param {Array<string>} socketPattern.allowedTypes - Allowed part types
   * @param {string} [socketPattern.nameTpl] - Template for part naming
   * @param {Array<string>} [socketPattern.positions] - Explicit positions for custom/radial schemes
   * @param {number} index - Current index (1-based)
   * @param {number} totalCount - Total count of items in set
   * @param {string} [arrangement] - Arrangement type for context
   * @returns {object} Generated socket definition
   * @private
   */
  #createSocketFromPattern(
    socketPattern,
    index,
    totalCount,
    arrangement = null
  ) {
    const { idTemplate, orientationScheme, allowedTypes, nameTpl, positions } =
      socketPattern;

    // Resolve orientation using shared OrientationResolver
    const orientation = OrientationResolver.resolveOrientation(
      orientationScheme,
      index,
      totalCount,
      positions,
      arrangement
    );

    // Warn about custom scheme without positions (helpful for mod developers)
    if (
      orientationScheme === 'custom' &&
      (!positions || positions.length === 0)
    ) {
      this.#logger.warn(
        'SocketGenerator: Custom orientation scheme used without positions array. ' +
          'Falling back to indexed positions. Provide positions array for proper naming.'
      );
    }

    // Build template variable context
    const variables = {
      index,
      orientation,
      position: orientation, // position is alias for orientation in custom/radial schemes
      type: allowedTypes && allowedTypes[0] ? allowedTypes[0] : 'part',
    };

    // Apply template to generate socket ID
    const socketId = this.#applyTemplate(idTemplate, variables);

    // Build socket definition
    const socket = {
      id: socketId,
      orientation,
      allowedTypes: [...allowedTypes],
      index, // Store index for name template substitution
    };

    // Add optional name template if provided
    if (nameTpl) {
      socket.nameTpl = nameTpl;
    }

    return socket;
  }

  /**
   * Applies template variables to a template string
   * Replaces {{variable}} placeholders with actual values
   *
   * @param {string} template - Template string with {{variable}} placeholders
   * @param {object} variables - Variable values to substitute
   * @param {number} [variables.index] - Index variable
   * @param {string} [variables.orientation] - Orientation variable
   * @param {string} [variables.position] - Position variable
   * @param {string} [variables.type] - Type variable
   * @returns {string} Template with variables replaced
   * @private
   */
  #applyTemplate(template, variables) {
    let result = template;

    // Replace each variable
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return result;
  }

  /**
   * Validates that all socket IDs are unique
   *
   * @param {Array<object>} sockets - Array of socket definitions
   * @throws {Error} If duplicate socket IDs are found
   * @private
   */
  #validateSocketUniqueness(sockets) {
    const socketIds = new Set();
    const duplicates = [];

    for (const socket of sockets) {
      if (socketIds.has(socket.id)) {
        duplicates.push(socket.id);
      } else {
        socketIds.add(socket.id);
      }
    }

    if (duplicates.length > 0) {
      throw new Error(
        `SocketGenerator: Duplicate socket IDs detected: ${duplicates.join(', ')}`
      );
    }
  }
}

export default SocketGenerator;
