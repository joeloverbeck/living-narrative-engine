/**
 * @file Validation rule for socket occupancy limits
 */

import { ValidationRule } from '../validationRule.js';

/**
 * Validates that sockets referenced in socketOccupancy actually exist
 */
export class SocketLimitRule extends ValidationRule {
  get ruleId() {
    return 'socket-limit';
  }

  get ruleName() {
    return 'Socket Limit Validation';
  }

  /**
   * Validate socket occupancy
   *
   * @param {import('../validationContext.js').ValidationContext} context
   * @returns {Promise<import('../validationRule.js').ValidationIssue[]>}
   */
  async validate(context) {
    const issues = [];
    const { socketOccupancy, entityManager, logger } = context;

    logger.debug(
      `SocketLimitRule: Validating ${socketOccupancy.size} occupied sockets`
    );

    // With the new design, each socket can only have one part
    // The socketOccupancy Set tracks which sockets are occupied
    // We validate that all occupied sockets actually exist
    for (const socketKey of socketOccupancy) {
      const [parentId, socketId] = socketKey.split(':');

      // Get socket definition
      const socketsComponent = entityManager.getComponentData(
        parentId,
        'anatomy:sockets'
      );
      const socket = socketsComponent?.sockets?.find(s => s.id === socketId);

      if (!socket) {
        issues.push(
          this.createError(
            `Socket '${socketId}' not found on entity '${parentId}'`,
            { parentId, socketId }
          )
        );
      }
    }

    logger.debug(
      `SocketLimitRule: Found ${issues.length} socket limit violations`
    );

    return issues;
  }
}

export default SocketLimitRule;