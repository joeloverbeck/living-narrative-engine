/**
 * @file Validation rule for joint consistency
 */

import { ValidationRule } from '../validationRule.js';

/**
 * Validates joint consistency - ensures joints reference valid parents and sockets
 */
export class JointConsistencyRule extends ValidationRule {
  get ruleId() {
    return 'joint-consistency';
  }

  get ruleName() {
    return 'Joint Consistency Validation';
  }

  /**
   * Validate joint consistency
   *
   * @param {import('../validationContext.js').ValidationContext} context
   * @returns {Promise<import('../validationRule.js').ValidationIssue[]>}
   */
  async validate(context) {
    const issues = [];
    const { entityIds, entityManager, logger } = context;

    logger.debug(
      `JointConsistencyRule: Validating joints for ${entityIds.length} entities`
    );

    for (const entityId of entityIds) {
      const joint = entityManager.getComponentData(entityId, 'anatomy:joint');
      if (!joint) continue;

      // Check for incomplete joint data
      if (!joint.parentId || !joint.socketId) {
        issues.push(
          this.createError(`Entity '${entityId}' has incomplete joint data`, {
            entityId,
            joint,
            missingFields: [
              !joint.parentId && 'parentId',
              !joint.socketId && 'socketId',
            ].filter(Boolean),
          })
        );
        continue;
      }

      // Check parent exists
      if (!entityIds.includes(joint.parentId)) {
        issues.push(
          this.createError(
            `Entity '${entityId}' has joint referencing non-existent parent '${joint.parentId}'`,
            {
              entityId,
              parentId: joint.parentId,
              socketId: joint.socketId,
            }
          )
        );
        continue;
      }

      // Check socket exists on parent
      const parentSockets = entityManager.getComponentData(
        joint.parentId,
        'anatomy:sockets'
      );
      const socket = parentSockets?.sockets?.find(
        (s) => s.id === joint.socketId
      );

      if (!socket) {
        issues.push(
          this.createError(
            `Entity '${entityId}' attached to non-existent socket '${joint.socketId}' on parent '${joint.parentId}'`,
            {
              entityId,
              parentId: joint.parentId,
              socketId: joint.socketId,
              availableSockets: parentSockets?.sockets?.map((s) => s.id) || [],
            }
          )
        );
      }
    }

    logger.debug(
      `JointConsistencyRule: Found ${issues.length} joint consistency violations`
    );

    return issues;
  }
}

export default JointConsistencyRule;
