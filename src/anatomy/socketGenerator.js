/**
 * @file SocketGenerator - Generates socket definitions from structure template patterns
 * @see docs/anatomy/structure-templates.md
 * @see workflows/ANABLUNONHUM-007-socket-generator.md
 */

import { validateDependency } from '../utils/dependencyUtils.js';

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

    // Resolve orientation based on scheme
    const orientation = this.#resolveOrientation(
      orientationScheme,
      index,
      totalCount,
      positions,
      arrangement
    );

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
   * Resolves orientation based on orientation scheme
   *
   * @param {string} scheme - Orientation scheme (bilateral, quadrupedal, radial, indexed, custom)
   * @param {number} index - Current index (1-based)
   * @param {number} totalCount - Total count of items in set
   * @param {Array<string>} [positions] - Explicit positions for custom/radial schemes
   * @param {string} [arrangement] - Arrangement type for context
   * @returns {string} Resolved orientation string
   * @private
   */
  #resolveOrientation(scheme = 'indexed', index, totalCount, positions, arrangement) {
    const effectivePositions = positions ?? null;
    const effectiveArrangement = arrangement ?? null;

    switch (scheme) {
      case 'bilateral':
        return this.#resolveBilateralOrientation(
          index,
          totalCount,
          effectiveArrangement
        );

      case 'quadrupedal':
        // Quadrupedal is a specific bilateral arrangement
        return this.#resolveBilateralOrientation(
          index,
          totalCount,
          'quadrupedal'
        );

      case 'radial':
        return this.#resolveRadialOrientation(
          index,
          totalCount,
          effectivePositions
        );

      case 'custom':
        return this.#resolveCustomOrientation(index, effectivePositions);

      case 'indexed':
      default:
        return String(index);
    }
  }

  /**
   * Resolves bilateral orientation (left/right pairs)
   * For quadrupedal arrangements, produces left_front, right_front, left_rear, right_rear
   *
   * @param {number} index - Current index (1-based)
   * @param {number} totalCount - Total count of items
   * @param {string} [arrangement] - Arrangement type
   * @returns {string} Bilateral orientation
   * @private
   */
  #resolveBilateralOrientation(index, totalCount, arrangement) {
    const arrangementType = arrangement ?? null;

    // For quadrupedal arrangement (4 legs)
    if (arrangementType === 'quadrupedal' && totalCount === 4) {
      const positions = ['left_front', 'right_front', 'left_rear', 'right_rear'];
      return positions[index - 1];
    }

    // Standard bilateral: alternate left/right
    // Odd indices = left, even indices = right
    const side = index % 2 === 1 ? 'left' : 'right';

    // For pairs, just return left/right
    if (totalCount === 2) {
      return side;
    }

    // For larger sets, we might need position qualifiers
    // But for now, just alternate left/right
    return side;
  }

  /**
   * Resolves radial orientation (circular arrangement)
   * Uses positions array if provided, otherwise generates position names
   *
   * @param {number} index - Current index (1-based)
   * @param {number} totalCount - Total count of items
   * @param {Array<string>} [positions] - Explicit position names
   * @returns {string} Radial position name
   * @private
   */
  #resolveRadialOrientation(index, totalCount, positions) {
    const effectivePositions = positions ?? null;

    if (effectivePositions && effectivePositions.length > 0) {
      // Use explicit positions array (0-based indexing)
      return effectivePositions[index - 1] || `position_${index}`;
    }

    // Generate default radial positions based on count
    // For common counts, use named positions
    if (totalCount === 8) {
      const octagonalPositions = [
        'anterior',
        'anterior_right',
        'right',
        'posterior_right',
        'posterior',
        'posterior_left',
        'left',
        'anterior_left',
      ];
      return octagonalPositions[index - 1];
    }

    // Default: use generic position naming
    return `position_${index}`;
  }

  /**
   * Resolves custom orientation using explicit positions array
   *
   * @param {number} index - Current index (1-based)
   * @param {Array<string>} [positions] - Explicit position names
   * @returns {string} Position name from array
   * @private
   */
  #resolveCustomOrientation(index, positions) {
    const effectivePositions = positions ?? null;

    if (!effectivePositions || effectivePositions.length === 0) {
      this.#logger.warn(
        `SocketGenerator: Custom orientation scheme used without positions array, falling back to index ${index}`
      );
      return `position_${index}`;
    }

    return effectivePositions[index - 1] || `position_${index}`;
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
