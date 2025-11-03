/**
 * @file Shared orientation resolution logic for SlotGenerator and SocketGenerator.
 *
 * CRITICAL: Both services MUST use this module to maintain synchronization.
 *
 * This module enforces a single source of truth for orientation resolution,
 * preventing synchronization bugs between slot key generation and socket ID generation.
 *
 * Design Decisions:
 * - Accepts 1-based indices from callers (converts internally to 0-based for array access)
 * - Always returns valid string (never undefined) using String(index) as fallback
 * - Uses anatomical terms (anterior/posterior) not directional (front/back) for octagonal
 * - Position names follow existing conventions (left_front not front_left)
 */

/**
 * Resolves orientation strings for sockets/slots based on scheme.
 * Supports bilateral, radial, indexed, custom, and quadrupedal orientations.
 *
 * @example
 * // Bilateral scheme (2 items)
 * OrientationResolver.resolveOrientation('bilateral', 1, 2); // 'left'
 * OrientationResolver.resolveOrientation('bilateral', 2, 2); // 'right'
 * @example
 * // Quadrupedal scheme (4 items)
 * OrientationResolver.resolveOrientation('bilateral', 1, 4); // 'left_front'
 * OrientationResolver.resolveOrientation('bilateral', 4, 4); // 'right_rear'
 * @example
 * // Radial scheme (8 items - octagonal)
 * OrientationResolver.resolveOrientation('radial', 1, 8); // 'anterior'
 * OrientationResolver.resolveOrientation('radial', 3, 8); // 'right'
 */
export class OrientationResolver {
  /**
   * Resolves orientation for a given scheme and parameters.
   *
   * @param {string} scheme - Orientation scheme: 'bilateral', 'radial', 'indexed', 'custom', 'quadrupedal'
   * @param {number} index - One-based index (starts at 1, not 0) passed by callers; internally converted via index-1 for array access
   * @param {number} totalCount - Total number of sockets/slots
   * @param {Array<string>} positions - Custom positions array (for 'custom' scheme)
   * @param {string|null} arrangement - Arrangement type (e.g., 'quadrupedal')
   * @returns {string} Resolved orientation string (never returns undefined)
   */
  static resolveOrientation(
    scheme,
    index,
    totalCount,
    positions = [],
    arrangement = null
  ) {
    switch (scheme) {
      case 'bilateral':
        return this.#resolveBilateral(index, totalCount, arrangement);

      case 'quadrupedal':
        // Special case: maps to bilateral with quadrupedal arrangement
        return this.#resolveBilateral(index, totalCount, 'quadrupedal');

      case 'radial':
        return this.#resolveRadial(index, totalCount, positions);

      case 'custom':
        return this.#resolveCustom(index, positions);

      case 'indexed':
      default:
        return String(index);
    }
  }

  /**
   * Resolves bilateral orientation (left/right or left_front/right_front/left_rear/right_rear).
   *
   * NOTE: Standardized fallback logic - returns String(index) if out of bounds.
   * This prevents undefined values that could cause slot/socket mismatches.
   *
   * @private
   * @param {number} index - One-based index from caller
   * @param {number} totalCount - Total number of sockets/slots
   * @param {string|null} _arrangement - Optional arrangement type (reserved for future use)
   * @returns {string} Orientation string
   */
  static #resolveBilateral(index, totalCount, _arrangement) {
    // Convert 1-based index to 0-based for array access
    const arrayIndex = index - 1;

    // Validate bounds: out-of-bounds indices always fallback to String(index)
    if (arrayIndex < 0 || arrayIndex >= totalCount) {
      return String(index);
    }

    // Simple bilateral (2 items): left/right
    if (totalCount === 2) {
      return arrayIndex === 0 ? 'left' : 'right';
    }

    // Quadrupedal (4 items): left_front, right_front, left_rear, right_rear
    // Note: Position names follow existing convention (left_front not front_left)
    if (totalCount === 4) {
      const positions = [
        'left_front',
        'right_front',
        'left_rear',
        'right_rear',
      ];
      return positions[arrayIndex] || String(index);
    }

    // For other counts, alternate left/right
    return arrayIndex % 2 === 0 ? 'left' : 'right';
  }

  /**
   * Resolves radial orientation (compass directions or indexed).
   *
   * NOTE: Standardized fallback logic - returns String(index) if out of bounds.
   * For octagonal (8 items), uses anatomical terms (anterior/posterior) not directional (front/back).
   *
   * @private
   * @param {number} index - One-based index from caller
   * @param {number} totalCount - Total number of sockets/slots
   * @param {Array<string>} positions - Custom positions array (may be empty)
   * @returns {string} Orientation string
   */
  static #resolveRadial(index, totalCount, positions) {
    // Convert 1-based index to 0-based for array access
    const arrayIndex = index - 1;

    // Octagonal default - uses anatomical terms (anterior/posterior not front/back)
    if (totalCount === 8 && (!positions || positions.length === 0)) {
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
      return octagonalPositions[arrayIndex] || String(index);
    }

    // Use custom positions if provided and valid
    if (positions && positions.length > 0 && arrayIndex < positions.length) {
      return positions[arrayIndex];
    }

    // Fallback to index string
    return String(index);
  }

  /**
   * Resolves custom orientation from provided positions array.
   *
   * NOTE: Standardized fallback logic - returns String(index) if out of bounds.
   *
   * @private
   * @param {number} index - One-based index from caller
   * @param {Array<string>} positions - Custom positions array
   * @returns {string} Orientation string
   */
  static #resolveCustom(index, positions) {
    // Convert 1-based index to 0-based for array access
    const arrayIndex = index - 1;

    // No positions provided - use index
    if (!positions || positions.length === 0) {
      return String(index);
    }

    // Return position or fallback to index
    return positions[arrayIndex] || String(index);
  }
}
