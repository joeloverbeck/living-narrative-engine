/**
 * @file Validation rule for detecting cycles in anatomy graphs
 */

import { ValidationRule } from '../validationRule.js';

/**
 * Validates that the anatomy graph has no cycles
 */
export class CycleDetectionRule extends ValidationRule {
  get ruleId() {
    return 'cycle-detection';
  }

  get ruleName() {
    return 'Cycle Detection';
  }

  /**
   * Validate that the graph has no cycles
   *
   * @param {import('../validationContext.js').ValidationContext} context
   * @returns {Promise<import('../validationRule.js').ValidationIssue[]>}
   */
  async validate(context) {
    const issues = [];
    const { entityIds, entityManager, logger } = context;

    logger.debug(
      `CycleDetectionRule: Checking for cycles in graph with ${entityIds.length} entities`
    );

    const visited = new Set();
    const recursionStack = new Set();
    let cycleDetected = false;

    const hasCycle = (entityId) => {
      visited.add(entityId);
      recursionStack.add(entityId);

      // Find children (entities that have this as parent in their joint)
      const children = entityIds.filter((id) => {
        const joint = entityManager.getComponentData(id, 'anatomy:joint');
        return joint?.parentId === entityId;
      });

      for (const childId of children) {
        if (!visited.has(childId)) {
          if (hasCycle(childId)) {
            return true;
          }
        } else if (recursionStack.has(childId)) {
          // Cycle detected
          if (!cycleDetected) {
            issues.push(
              this.createError('Cycle detected in anatomy graph', {
                involvedEntities: [entityId, childId],
                message: `Entity '${childId}' creates a cycle when referenced from '${entityId}'`,
              })
            );
            cycleDetected = true;
          }
          return true;
        }
      }

      recursionStack.delete(entityId);
      return false;
    };

    // Check each entity that could be a root (no joint component)
    for (const entityId of entityIds) {
      const joint = entityManager.getComponentData(entityId, 'anatomy:joint');
      if (!joint && !visited.has(entityId)) {
        hasCycle(entityId);
      }
    }

    // Also check any unvisited entities (important for detecting cycles with no roots)
    for (const entityId of entityIds) {
      if (!visited.has(entityId)) {
        hasCycle(entityId);
      }
    }

    logger.debug(
      `CycleDetectionRule: ${cycleDetected ? 'Found cycles' : 'No cycles detected'}`
    );

    return issues;
  }
}

export default CycleDetectionRule;
