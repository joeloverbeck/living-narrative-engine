/**
 * @file Validates that socket nameTpl values produce unique display names
 * @description Prevents configuration errors where multiple sockets would resolve
 * to the same display name, causing confusion in visualizers and descriptions.
 */

import { BaseValidator } from './BaseValidator.js';
import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Validates socket nameTpl uniqueness within entity definitions.
 *
 * Detection rules:
 * 1. Literal duplicates: If nameTpl contains no {{variables}}, it must be unique
 * 2. Template with {{type}} only: Check if allowedTypes overlap between sockets
 * 3. Templates with {{orientation}} or {{effective_orientation}}: Considered unique
 *    (orientation differentiates between instances)
 */
export class SocketNameTplValidator extends BaseValidator {
  #dataRegistry;
  #logger;

  /**
   * @param {object} options
   * @param {object} options.logger - Logger instance
   * @param {object} options.dataRegistry - Data registry for entity lookups
   */
  constructor({ logger, dataRegistry }) {
    super({
      name: 'socket-nametpl-uniqueness',
      priority: 23, // After SocketSlotCompatibilityValidator (22)
      failFast: true, // Stop on duplicate detection
      logger,
    });

    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getEntityDefinition'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Validates nameTpl uniqueness for all entity definitions in the recipe
   *
   * @param {object} recipe - The anatomy recipe being validated
   * @param {object} _options - Validation options (unused)
   * @param {object} builder - ValidationResultBuilder for collecting results
   * @returns {Promise<void>}
   */
  async performValidation(recipe, _options, builder) {
    // Collect all entity definition IDs to validate
    const entityDefIds = this.#collectEntityDefinitionIds(recipe);

    for (const entityDefId of entityDefIds) {
      const entityDef = this.#dataRegistry.getEntityDefinition(entityDefId);
      if (!entityDef) {
        this.#logger.debug(
          `SocketNameTplValidator: Entity definition not found: ${entityDefId}`
        );
        continue;
      }

      this.#validateEntityDefinition(entityDef, builder);
    }
  }

  /**
   * Collects all entity definition IDs from recipe (root + attachments)
   *
   * @param {object} recipe
   * @returns {string[]}
   */
  #collectEntityDefinitionIds(recipe) {
    const ids = new Set();

    if (recipe.rootEntityDefinitionId) {
      ids.add(recipe.rootEntityDefinitionId);
    }

    if (Array.isArray(recipe.attachments)) {
      for (const attachment of recipe.attachments) {
        if (attachment.entityDefinitionId) {
          ids.add(attachment.entityDefinitionId);
        }
      }
    }

    return [...ids];
  }

  /**
   * Validates nameTpl uniqueness within a single entity definition
   *
   * @param {object} entityDef
   * @param {object} builder
   */
  #validateEntityDefinition(entityDef, builder) {
    const sockets = entityDef.sockets || [];
    if (sockets.length === 0) {
      return;
    }

    // Group sockets by their effective nameTpl resolution
    const groups = this.#groupSocketsByNameTpl(sockets);

    // Check each group for duplicates
    for (const [resolvedName, socketsInGroup] of groups.entries()) {
      if (socketsInGroup.length > 1) {
        // Check if this is a valid disambiguation case
        if (!this.#hasDifferentiatingFactor(socketsInGroup)) {
          const socketIds = socketsInGroup.map((s) => s.id);
          const socketIdsStr = socketIds.join(', ');
          builder.addError(
            'DUPLICATE_SOCKET_NAMETPL',
            `Entity '${entityDef.id}' has duplicate nameTpl '${resolvedName}' in sockets: ${socketIdsStr}. ` +
              `Add orientation variables ({{orientation}} or {{effective_orientation}}) or use unique nameTpl values.`,
            {
              entityId: entityDef.id,
              nameTpl: resolvedName,
              socketIds,
            }
          );
        }
      }
    }
  }

  /**
   * Groups sockets by their nameTpl resolution key
   *
   * For templates with {{type}} only, uses "template:allowedTypes" as key.
   * For templates with orientation, treats as unique per socket.
   * For literal strings, uses the string directly.
   *
   * @param {object[]} sockets
   * @returns {Map<string, object[]>}
   */
  #groupSocketsByNameTpl(sockets) {
    const groups = new Map();

    for (const socket of sockets) {
      if (!socket.nameTpl) {
        continue; // Skip sockets without nameTpl
      }

      const groupKey = this.#getGroupKey(socket);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(socket);
    }

    return groups;
  }

  /**
   * Determines the grouping key for a socket based on its nameTpl
   *
   * @param {object} socket
   * @returns {string}
   */
  #getGroupKey(socket) {
    const { nameTpl, allowedTypes = [] } = socket;

    // Check if nameTpl has orientation variables (makes each socket unique)
    if (this.#hasOrientationVariable(nameTpl)) {
      // Unique per socket - use socket id as key
      return `orientation:${socket.id}`;
    }

    // Check if nameTpl uses only {{type}} variable
    if (this.#hasOnlyTypeVariable(nameTpl)) {
      // Group by template + allowedTypes combination
      const sortedTypes = [...allowedTypes].sort().join(',');
      return `type:${nameTpl}:${sortedTypes}`;
    }

    // Literal string - use as-is for grouping
    return `literal:${nameTpl}`;
  }

  /**
   * Checks if nameTpl contains orientation variables
   *
   * @param {string} nameTpl
   * @returns {boolean}
   */
  #hasOrientationVariable(nameTpl) {
    return (
      nameTpl.includes('{{orientation}}') ||
      nameTpl.includes('{{effective_orientation}}')
    );
  }

  /**
   * Checks if nameTpl contains only the {{type}} variable (no other variables)
   *
   * @param {string} nameTpl
   * @returns {boolean}
   */
  #hasOnlyTypeVariable(nameTpl) {
    // Has {{type}} and no orientation variables
    if (!nameTpl.includes('{{type}}')) {
      return false;
    }
    return !this.#hasOrientationVariable(nameTpl);
  }

  /**
   * Checks if sockets in a group have differentiating factors
   *
   * Currently checks:
   * - Different allowedTypes (for {{type}} templates)
   *
   * @param {object[]} sockets
   * @returns {boolean}
   */
  #hasDifferentiatingFactor(sockets) {
    // For type-based templates, check if allowedTypes differ
    const firstSocket = sockets[0];
    if (this.#hasOnlyTypeVariable(firstSocket.nameTpl)) {
      const firstTypes = new Set(firstSocket.allowedTypes || []);

      for (let i = 1; i < sockets.length; i++) {
        const otherTypes = new Set(sockets[i].allowedTypes || []);

        // Check if there's any overlap
        const hasOverlap = [...firstTypes].some((t) => otherTypes.has(t));
        if (!hasOverlap) {
          return true; // Different types = different resolved names
        }
      }
    }

    return false;
  }
}
