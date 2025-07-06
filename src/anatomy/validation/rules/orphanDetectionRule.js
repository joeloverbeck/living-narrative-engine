/**
 * @file Validation rule for detecting orphaned parts
 */

import { ValidationRule } from '../validationRule.js';

/**
 * Checks for orphaned parts (parts with joints to entities not in the graph)
 * and warns about multiple root entities
 */
export class OrphanDetectionRule extends ValidationRule {
  get ruleId() {
    return 'orphan-detection';
  }

  get ruleName() {
    return 'Orphan Detection';
  }

  /**
   * Validate for orphaned parts and multiple roots
   *
   * @param {import('../validationContext.js').ValidationContext} context
   * @returns {Promise<import('../validationRule.js').ValidationIssue[]>}
   */
  async validate(context) {
    const issues = [];
    const { entityIds, entityManager, logger } = context;

    logger.debug(
      `OrphanDetectionRule: Checking for orphans in graph with ${entityIds.length} entities`
    );

    const entityIdSet = new Set(entityIds);
    const rootEntities = [];

    for (const entityId of entityIds) {
      const joint = entityManager.getComponentData(entityId, 'anatomy:joint');

      if (joint && !entityIdSet.has(joint.parentId)) {
        // Orphaned part - has a parent that's not in the graph
        issues.push(
          this.createError(
            `Orphaned part '${entityId}' has parent '${joint.parentId}' not in graph`,
            {
              entityId,
              parentId: joint.parentId,
              socketId: joint.socketId,
            }
          )
        );
      }

      // Track root entities (no joint component)
      if (!joint) {
        rootEntities.push(entityId);
      }
    }

    // Check for multiple roots (warning, not error)
    if (rootEntities.length > 1) {
      issues.push(
        this.createWarning(
          `Multiple root entities found: ${rootEntities.join(', ')}`,
          {
            rootEntities,
            count: rootEntities.length,
          }
        )
      );
    }

    // Store root entities in context metadata for other rules to use
    context.setMetadata('rootEntities', rootEntities);

    logger.debug(
      `OrphanDetectionRule: Found ${issues.filter((i) => i.severity === 'error').length} orphans ` +
        `and ${rootEntities.length} root entities`
    );

    return issues;
  }
}

export default OrphanDetectionRule;
