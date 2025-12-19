/**
 * @file Validates state consistency across the proximity closeness system
 */

import { validateDependency } from './dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

export class StateConsistencyValidator {
  #logger;
  #entityManager;

  /**
   * Creates a new StateConsistencyValidator instance for system-wide state validation.
   *
   * @param {object} dependencies - Dependency injection object
   * @param {ILogger} dependencies.logger - Logger instance for debugging and error logging
   * @param {IEntityManager} dependencies.entityManager - Entity manager instance for entity operations
   */
  constructor({ logger, entityManager }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: [
        'getEntitiesWithComponent',
        'getComponentData',
        'addComponent',
      ],
    });

    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  /**
   * Validates all closeness relationships for bidirectional consistency.
   * Detects unidirectional relationships where A has B as partner but not vice versa.
   *
   * @returns {Array<object>} Array of consistency issues found
   */
  validateAllClosenessRelationships() {
    const issues = [];
    const checkedPairs = new Set();

    // Get all entities with closeness components
    const entitiesWithCloseness = this.#entityManager.getEntitiesWithComponent(
      'personal-space-states:closeness'
    );

    for (const entity of entitiesWithCloseness) {
      const entityId = entity.id;
      const closenessData = this.#entityManager.getComponentData(
        entityId,
        'personal-space-states:closeness'
      );

      if (!closenessData || !closenessData.partners) continue;

      for (const partnerId of closenessData.partners) {
        // Skip if we've already checked this pair
        const pairKey = [entityId, partnerId].sort().join('|');
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        // Check for bidirectional relationship
        const partnerCloseness = this.#entityManager.getComponentData(
          partnerId,
          'personal-space-states:closeness'
        );

        if (
          !partnerCloseness ||
          !partnerCloseness.partners ||
          !partnerCloseness.partners.includes(entityId)
        ) {
          issues.push({
            type: 'unidirectional_closeness',
            from: entityId,
            to: partnerId,
            message: `${entityId} has ${partnerId} as partner, but not vice versa`,
          });
        }
      }
    }

    if (issues.length > 0) {
      this.#logger.warn('Closeness relationship consistency issues found', {
        issues,
      });
    }

    return issues;
  }

  /**
   * Validates movement locks to detect orphaned locks without corresponding states.
   * A lock is orphaned if the entity has no closeness partners and is not sitting.
   *
   * @returns {Array<object>} Array of orphaned movement lock issues
   */
  validateMovementLocks() {
    const issues = [];

    const entitiesWithMovement =
      this.#entityManager.getEntitiesWithComponent('core:movement');

    for (const entity of entitiesWithMovement) {
      const entityId = entity.id;
      const movementData = this.#entityManager.getComponentData(
        entityId,
        'core:movement'
      );

      if (movementData && movementData.locked) {
        // Check if entity has closeness partners or is sitting
        const closenessData = this.#entityManager.getComponentData(
          entityId,
          'personal-space-states:closeness'
        );
        const sittingData = this.#entityManager.getComponentData(
          entityId,
          'sitting-states:sitting_on'
        );

        if (
          (!closenessData || closenessData.partners.length === 0) &&
          !sittingData
        ) {
          issues.push({
            type: 'orphaned_movement_lock',
            entityId,
            message: `${entityId} has movement locked but no closeness partners or sitting state`,
          });
        }
      }
    }

    if (issues.length > 0) {
      this.#logger.warn('Movement lock consistency issues found', { issues });
    }

    return issues;
  }

  /**
   * Validates furniture occupancy consistency between furniture spots and occupant sitting components.
   * Detects missing sitting components and mismatched furniture/spot references.
   *
   * @returns {Array<object>} Array of furniture occupancy issues
   */
  validateFurnitureOccupancy() {
    const issues = [];

    const furnitureEntities = this.#entityManager.getEntitiesWithComponent(
      'sitting:allows_sitting'
    );

    for (const furniture of furnitureEntities) {
      const furnitureId = furniture.id;
      const furnitureData = this.#entityManager.getComponentData(
        furnitureId,
        'sitting:allows_sitting'
      );

      if (!furnitureData || !furnitureData.spots) continue;

      furnitureData.spots.forEach((occupantId, spotIndex) => {
        if (occupantId) {
          // Check if occupant has corresponding sitting component
          const sittingData = this.#entityManager.getComponentData(
            occupantId,
            'sitting-states:sitting_on'
          );

          if (!sittingData) {
            issues.push({
              type: 'missing_sitting_component',
              furnitureId,
              occupantId,
              spotIndex,
              message: `${occupantId} is in furniture ${furnitureId} spot ${spotIndex} but has no sitting component`,
            });
          } else if (
            sittingData.furniture_id !== furnitureId ||
            sittingData.spot_index !== spotIndex
          ) {
            issues.push({
              type: 'sitting_mismatch',
              furnitureId,
              occupantId,
              spotIndex,
              actualFurniture: sittingData.furniture_id,
              actualSpot: sittingData.spot_index,
              message: `Sitting component mismatch for ${occupantId}`,
            });
          }
        }
      });
    }

    if (issues.length > 0) {
      this.#logger.warn('Furniture occupancy consistency issues found', {
        issues,
      });
    }

    return issues;
  }

  /**
   * Performs a complete validation of all state consistency checks.
   * Runs all validation methods and returns a comprehensive report.
   *
   * @returns {object} Validation report with all issues found
   */
  performFullValidation() {
    const report = {
      timestamp: new Date().toISOString(),
      closenessIssues: this.validateAllClosenessRelationships(),
      movementLockIssues: this.validateMovementLocks(),
      furnitureOccupancyIssues: this.validateFurnitureOccupancy(),
      totalIssues: 0,
    };

    report.totalIssues =
      report.closenessIssues.length +
      report.movementLockIssues.length +
      report.furnitureOccupancyIssues.length;

    if (report.totalIssues > 0) {
      this.#logger.warn('State consistency validation found issues', {
        totalIssues: report.totalIssues,
        breakdown: {
          closeness: report.closenessIssues.length,
          movementLocks: report.movementLockIssues.length,
          furnitureOccupancy: report.furnitureOccupancyIssues.length,
        },
      });
    } else {
      this.#logger.info(
        'State consistency validation passed - no issues found'
      );
    }

    return report;
  }

  /**
   * Attempts to repair detected consistency issues.
   *
   * @param {Array<object>} issues - Array of issues to repair
   * @returns {Promise<object>} Repair report with success/failure counts
   */
  async repairIssues(issues) {
    const repairReport = {
      attempted: issues.length,
      successful: 0,
      failed: [],
    };

    for (const issue of issues) {
      try {
        switch (issue.type) {
          case 'unidirectional_closeness':
            // Remove the unidirectional relationship
            await this.#repairUnidirectionalCloseness(issue);
            repairReport.successful++;
            break;

          case 'orphaned_movement_lock':
            // Unlock the orphaned movement
            await this.#repairOrphanedLock(issue);
            repairReport.successful++;
            break;

          case 'missing_sitting_component':
            // Cannot auto-repair - would need to know furniture details
            repairReport.failed.push({
              issue,
              reason:
                'Cannot auto-repair missing sitting component - manual intervention required',
            });
            break;

          case 'sitting_mismatch':
            // Fix the sitting component to match furniture state
            await this.#repairSittingMismatch(issue);
            repairReport.successful++;
            break;

          default:
            repairReport.failed.push({
              issue,
              reason: 'No repair strategy for issue type',
            });
        }
      } catch (error) {
        repairReport.failed.push({
          issue,
          reason: error.message,
        });
      }
    }

    this.#logger.info('Issue repair completed', repairReport);
    return repairReport;
  }

  /**
   * Repairs unidirectional closeness by removing the one-way relationship.
   *
   * @param {object} issue - The unidirectional closeness issue
   * @private
   */
  async #repairUnidirectionalCloseness(issue) {
    const closenessData = this.#entityManager.getComponentData(
      issue.from,
      'personal-space-states:closeness'
    );
    if (closenessData && closenessData.partners) {
      const updatedPartners = closenessData.partners.filter(
        (id) => id !== issue.to
      );
      await this.#entityManager.addComponent(
        issue.from,
        'personal-space-states:closeness',
        {
          partners: updatedPartners,
        }
      );
      this.#logger.debug('Repaired unidirectional closeness', {
        from: issue.from,
        removedPartner: issue.to,
      });
    }
  }

  /**
   * Repairs orphaned movement lock by unlocking the entity.
   *
   * @param {object} issue - The orphaned lock issue
   * @private
   */
  async #repairOrphanedLock(issue) {
    const movementData = this.#entityManager.getComponentData(
      issue.entityId,
      'core:movement'
    );
    if (movementData) {
      await this.#entityManager.addComponent(issue.entityId, 'core:movement', {
        ...movementData,
        locked: false,
      });
      this.#logger.debug('Repaired orphaned movement lock', {
        entityId: issue.entityId,
      });
    }
  }

  /**
   * Repairs sitting component mismatch by updating it to match furniture state.
   *
   * @param {object} issue - The sitting mismatch issue
   * @private
   */
  async #repairSittingMismatch(issue) {
    await this.#entityManager.addComponent(
      issue.occupantId,
      'sitting-states:sitting_on',
      {
        furniture_id: issue.furnitureId,
        spot_index: issue.spotIndex,
      }
    );
    this.#logger.debug('Repaired sitting component mismatch', {
      occupantId: issue.occupantId,
      furnitureId: issue.furnitureId,
      spotIndex: issue.spotIndex,
    });
  }
}
