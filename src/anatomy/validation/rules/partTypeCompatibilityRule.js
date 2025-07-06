/**
 * @file Validation rule for part type compatibility with sockets
 */

import { ValidationRule } from '../validationRule.js';

/**
 * Validates that attached parts match socket allowed types
 */
export class PartTypeCompatibilityRule extends ValidationRule {
  get ruleId() {
    return 'part-type-compatibility';
  }

  get ruleName() {
    return 'Part Type Compatibility';
  }

  /**
   * Validate part type compatibility with sockets
   *
   * @param {import('../validationContext.js').ValidationContext} context
   * @returns {Promise<import('../validationRule.js').ValidationIssue[]>}
   */
  async validate(context) {
    const issues = [];
    const { entityIds, entityManager, logger } = context;

    logger.debug(
      `PartTypeCompatibilityRule: Validating part type compatibility for ${entityIds.length} entities`
    );

    for (const entityId of entityIds) {
      const joint = entityManager.getComponentData(entityId, 'anatomy:joint');
      if (!joint) continue;

      // Get part type
      const anatomyPart = entityManager.getComponentData(
        entityId,
        'anatomy:part'
      );
      if (!anatomyPart?.subType) continue;

      // Get parent socket
      const parentSockets = entityManager.getComponentData(
        joint.parentId,
        'anatomy:sockets'
      );
      const socket = parentSockets?.sockets?.find(
        (s) => s.id === joint.socketId
      );

      if (!socket) continue;

      // Check if part type is allowed (handle wildcard '*')
      if (
        !socket.allowedTypes.includes('*') &&
        !socket.allowedTypes.includes(anatomyPart.subType)
      ) {
        issues.push(
          this.createError(
            `Part type '${anatomyPart.subType}' not allowed in socket '${joint.socketId}' on entity '${joint.parentId}'`,
            {
              entityId,
              partType: anatomyPart.subType,
              socketId: joint.socketId,
              parentId: joint.parentId,
              allowedTypes: socket.allowedTypes,
            }
          )
        );
      }
    }

    logger.debug(
      `PartTypeCompatibilityRule: Found ${issues.length} part type compatibility violations`
    );

    return issues;
  }
}

export default PartTypeCompatibilityRule;
