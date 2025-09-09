# PROXBASCLOS-013-04: State Consistency Validator

**Parent Ticket**: PROXBASCLOS-013  
**Phase**: Edge Case Handling - Part 4  
**Priority**: Medium  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-013-02 (ComponentStateValidator)  
**Estimated Time**: 1-2 hours

## Summary

Create a `StateConsistencyValidator` class that performs system-wide validation of proximity and closeness state consistency. This validator detects and reports inconsistencies like unidirectional relationships and orphaned movement locks across the entire system.

## Implementation Requirements

### 1. Create StateConsistencyValidator Class

**New File**: `src/utils/stateConsistencyValidator.js`

The validator should:
- Scan all entities for consistency issues
- Detect unidirectional closeness relationships
- Find orphaned movement locks
- Generate detailed issue reports
- Support debugging and maintenance operations

### 2. Core Methods

#### 2.1 validateAllClosenessRelationships()

Scans all entities with closeness components and validates bidirectional consistency:

```javascript
validateAllClosenessRelationships() {
  const issues = [];
  const checkedPairs = new Set();

  // Get all entities with closeness components
  const entitiesWithCloseness = this.#entityManager.getEntitiesWithComponent('positioning:closeness');

  for (const entityId of entitiesWithCloseness) {
    const closenessData = this.#entityManager.getComponentData(entityId, 'positioning:closeness');
    
    if (!closenessData || !closenessData.partners) continue;

    for (const partnerId of closenessData.partners) {
      // Skip if we've already checked this pair
      const pairKey = [entityId, partnerId].sort().join('|');
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Check for bidirectional relationship
      const partnerCloseness = this.#entityManager.getComponentData(partnerId, 'positioning:closeness');
      
      if (!partnerCloseness || !partnerCloseness.partners || !partnerCloseness.partners.includes(entityId)) {
        issues.push({
          type: 'unidirectional_closeness',
          from: entityId,
          to: partnerId,
          message: `${entityId} has ${partnerId} as partner, but not vice versa`
        });
      }
    }
  }

  if (issues.length > 0) {
    this.#logger.warn('Closeness relationship consistency issues found', { issues });
  }

  return issues;
}
```

#### 2.2 validateMovementLocks()

Detects movement locks that shouldn't exist (orphaned locks):

```javascript
validateMovementLocks() {
  const issues = [];
  
  const entitiesWithMovement = this.#entityManager.getEntitiesWithComponent('positioning:movement');
  
  for (const entityId of entitiesWithMovement) {
    const movementData = this.#entityManager.getComponentData(entityId, 'positioning:movement');
    
    if (movementData && movementData.locked) {
      // Check if entity has closeness partners or is sitting
      const closenessData = this.#entityManager.getComponentData(entityId, 'positioning:closeness');
      const sittingData = this.#entityManager.getComponentData(entityId, 'positioning:sitting');
      
      if ((!closenessData || closenessData.partners.length === 0) && !sittingData) {
        issues.push({
          type: 'orphaned_movement_lock',
          entityId,
          message: `${entityId} has movement locked but no closeness partners or sitting state`
        });
      }
    }
  }

  if (issues.length > 0) {
    this.#logger.warn('Movement lock consistency issues found', { issues });
  }

  return issues;
}
```

#### 2.3 validateFurnitureOccupancy()

Additional validation for furniture occupancy consistency:

```javascript
validateFurnitureOccupancy() {
  const issues = [];
  
  const furnitureEntities = this.#entityManager.getEntitiesWithComponent('positioning:allows_sitting');
  
  for (const furnitureId of furnitureEntities) {
    const furnitureData = this.#entityManager.getComponentData(furnitureId, 'positioning:allows_sitting');
    
    if (!furnitureData || !furnitureData.spots) continue;
    
    furnitureData.spots.forEach((occupantId, spotIndex) => {
      if (occupantId) {
        // Check if occupant has corresponding sitting component
        const sittingData = this.#entityManager.getComponentData(occupantId, 'positioning:sitting');
        
        if (!sittingData) {
          issues.push({
            type: 'missing_sitting_component',
            furnitureId,
            occupantId,
            spotIndex,
            message: `${occupantId} is in furniture ${furnitureId} spot ${spotIndex} but has no sitting component`
          });
        } else if (sittingData.furniture_id !== furnitureId || sittingData.spot_index !== spotIndex) {
          issues.push({
            type: 'sitting_mismatch',
            furnitureId,
            occupantId,
            spotIndex,
            actualFurniture: sittingData.furniture_id,
            actualSpot: sittingData.spot_index,
            message: `Sitting component mismatch for ${occupantId}`
          });
        }
      }
    });
  }
  
  return issues;
}
```

#### 2.4 performFullValidation()

Convenience method to run all validations:

```javascript
performFullValidation() {
  const report = {
    timestamp: new Date().toISOString(),
    closenessIssues: this.validateAllClosenessRelationships(),
    movementLockIssues: this.validateMovementLocks(),
    furnitureOccupancyIssues: this.validateFurnitureOccupancy(),
    totalIssues: 0
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
        furnitureOccupancy: report.furnitureOccupancyIssues.length
      }
    });
  } else {
    this.#logger.info('State consistency validation passed - no issues found');
  }
  
  return report;
}
```

## Complete Implementation

```javascript
/**
 * @file Validates state consistency across the proximity closeness system
 */

export class StateConsistencyValidator {
  #logger;
  #entityManager;

  /**
   * @param {object} logger - Logger instance
   * @param {object} entityManager - Entity manager instance
   */
  constructor(logger, entityManager) {
    this.#logger = logger;
    this.#entityManager = entityManager;
  }

  // [Include all methods from above]

  /**
   * Attempt to repair detected issues (optional utility method)
   * @param {Array} issues - Array of issues to repair
   * @returns {object} Repair report
   */
  async repairIssues(issues) {
    const repairReport = {
      attempted: issues.length,
      successful: 0,
      failed: []
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
            
          default:
            repairReport.failed.push({
              issue,
              reason: 'No repair strategy for issue type'
            });
        }
      } catch (error) {
        repairReport.failed.push({
          issue,
          reason: error.message
        });
      }
    }

    this.#logger.info('Issue repair completed', repairReport);
    return repairReport;
  }

  async #repairUnidirectionalCloseness(issue) {
    // Implementation for repairing unidirectional relationships
    const closenessData = this.#entityManager.getComponentData(issue.from, 'positioning:closeness');
    if (closenessData && closenessData.partners) {
      const updatedPartners = closenessData.partners.filter(id => id !== issue.to);
      await this.#entityManager.addComponent(issue.from, 'positioning:closeness', {
        partners: updatedPartners
      });
    }
  }

  async #repairOrphanedLock(issue) {
    // Implementation for unlocking orphaned movement
    await this.#entityManager.addComponent(issue.entityId, 'positioning:movement', {
      locked: false
    });
  }
}
```

## Testing Requirements

Create test file: `tests/unit/utils/stateConsistencyValidator.test.js`

### Test Scenarios

1. **Closeness Validation Tests**:
   - Detect unidirectional A→B relationships
   - Detect unidirectional B→A relationships
   - Handle missing closeness components
   - Skip already-checked pairs
   - Empty partners arrays

2. **Movement Lock Tests**:
   - Detect orphaned locks (no closeness, no sitting)
   - Valid locks with closeness partners
   - Valid locks with sitting state
   - Missing movement components

3. **Furniture Occupancy Tests**:
   - Missing sitting component for occupant
   - Sitting component mismatch
   - Empty furniture spots
   - Null occupants in spots

4. **Full Validation Tests**:
   - No issues found scenario
   - Multiple issue types detected
   - Correct issue counting
   - Proper logging levels

5. **Repair Function Tests** (if implemented):
   - Successful repairs
   - Failed repair attempts
   - Partial repair success

## Usage Example

```javascript
// In maintenance or debugging code
const validator = new StateConsistencyValidator(logger, entityManager);

// Run full validation
const report = validator.performFullValidation();

if (report.totalIssues > 0) {
  console.log('Issues detected:', report);
  
  // Optionally attempt repairs
  const allIssues = [
    ...report.closenessIssues,
    ...report.movementLockIssues
  ];
  const repairReport = await validator.repairIssues(allIssues);
  console.log('Repair results:', repairReport);
}
```

## Acceptance Criteria

- [ ] **Class Implementation**: StateConsistencyValidator class with all methods
- [ ] **Closeness Validation**: Detects all unidirectional relationships
- [ ] **Movement Lock Validation**: Finds all orphaned locks
- [ ] **Furniture Validation**: Detects occupancy inconsistencies
- [ ] **Issue Reporting**: Clear, detailed issue reports with context
- [ ] **Performance**: Can validate 1000 entities in <100ms
- [ ] **Test Coverage**: 90%+ branch coverage
- [ ] **Documentation**: Complete JSDoc for all public methods

## Files to Create

1. **Create**: `src/utils/stateConsistencyValidator.js` - Main validator class
2. **Create**: `tests/unit/utils/stateConsistencyValidator.test.js` - Comprehensive tests

## Integration Points

This validator can be used by:
- Debugging utilities
- Health check endpoints
- Maintenance scripts
- Test setup/teardown
- Data migration tools

## Definition of Done

- [ ] StateConsistencyValidator class implemented
- [ ] All validation methods working correctly
- [ ] Issue detection comprehensive and accurate
- [ ] Unit tests achieve 90%+ coverage
- [ ] Performance validated for large entity sets
- [ ] JSDoc documentation complete
- [ ] ESLint and prettier checks pass
- [ ] Optional repair functionality tested

## Notes for Implementation

- Use Set for tracking checked pairs to avoid duplicates
- Consider memory usage for large entity sets
- Make repair functionality optional/separate
- Ensure validator doesn't modify state during validation
- Consider adding severity levels to issues
- Think about making this available as a debug command

## Next Steps

After completing this ticket, proceed to:
- **PROXBASCLOS-013-05**: Edge Case Test Suite (comprehensive testing)