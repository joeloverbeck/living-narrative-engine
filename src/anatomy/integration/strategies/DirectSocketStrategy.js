/**
 * @file Strategy for resolving direct socket references to anatomy attachment points
 * @see src/interfaces/ISlotResolutionStrategy.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../../utils/loggerUtils.js';

/** @typedef {import('../../../interfaces/ISlotResolutionStrategy.js')} ISlotResolutionStrategy */
/** @typedef {import('../../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Strategy for resolving direct socket-based slot mappings
 * Handles mappings that specify socket IDs directly
 */
class DirectSocketStrategy {
  #logger;
  #entityManager;
  #bodyGraphService;

  constructor({ logger, entityManager, bodyGraphService }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);

    validateDependency(entityManager, 'IEntityManager', null, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });
    validateDependency(bodyGraphService, 'IBodyGraphService');

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
  }

  /**
   * Determines if this strategy can handle the given mapping
   *
   * @param {object} mapping - The clothing slot mapping
   * @returns {boolean} True if mapping contains direct socket references
   */
  canResolve(mapping) {
    return !!(
      mapping &&
      mapping.anatomySockets &&
      Array.isArray(mapping.anatomySockets)
    );
  }

  /**
   * Resolves direct socket references to attachment points
   *
   * @param {string} entityId - Entity to resolve for
   * @param {object} mapping - The clothing slot mapping
   * @returns {Promise<ResolvedAttachmentPoint[]>} Resolved attachment points
   */
  async resolve(entityId, mapping) {
    if (!this.canResolve(mapping)) {
      return [];
    }

    this.#logger.info(
      `DirectSocketStrategy: Resolving for entity '${entityId}', sockets: ${JSON.stringify(mapping.anatomySockets)}`
    );

    const bodyGraph = await this.#bodyGraphService.getBodyGraph(entityId);
    const attachmentPoints = [];

    // For direct sockets, we need to find which parts have these sockets
    // Check body parts first (preferred over root entity)
    const bodyParts = bodyGraph.getAllPartIds();

    this.#logger.info(
      `DirectSocketStrategy: Found ${bodyParts.length} body parts for entity '${entityId}'`
    );

    for (const partId of bodyParts) {
      const socketsComponent = await this.#entityManager.getComponentData(
        partId,
        'anatomy:sockets'
      );

      if (socketsComponent?.sockets) {
        this.#logger.info(
          `DirectSocketStrategy: Part '${partId}' has ${socketsComponent.sockets.length} sockets: ${socketsComponent.sockets.map((s) => s.id).join(', ')}`
        );
        for (const socket of socketsComponent.sockets) {
          if (mapping.anatomySockets.includes(socket.id)) {
            attachmentPoints.push({
              entityId: partId,
              socketId: socket.id,
              slotPath: 'direct',
              orientation: socket.orientation || 'neutral',
            });

            this.#logger.info(
              `DirectSocketStrategy: Found socket '${socket.id}' on part '${partId}'`
            );
          }
        }
      } else {
        this.#logger.info(
          `DirectSocketStrategy: Part '${partId}' has NO anatomy:sockets component`
        );
      }
    }

    this.#logger.info(
      `DirectSocketStrategy: After checking body parts, found ${attachmentPoints.length} attachment points`
    );

    // Only check root entity if no body parts have the sockets
    if (attachmentPoints.length === 0) {
      const rootSockets = await this.#entityManager.getComponentData(
        entityId,
        'anatomy:sockets'
      );

      if (rootSockets?.sockets) {
        for (const socket of rootSockets.sockets) {
          if (mapping.anatomySockets.includes(socket.id)) {
            attachmentPoints.push({
              entityId: entityId,
              socketId: socket.id,
              slotPath: 'direct',
              orientation: socket.orientation || 'neutral',
            });

            this.#logger.info(
              `DirectSocketStrategy: Found socket '${socket.id}' on root entity '${entityId}'`
            );
          }
        }
      }
    }

    this.#logger.info(
      `DirectSocketStrategy: Returning ${attachmentPoints.length} total attachment points for entity '${entityId}'`
    );

    return attachmentPoints;
  }
}

export default DirectSocketStrategy;
