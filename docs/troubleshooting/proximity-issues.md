# Proximity System Troubleshooting Guide

## Common Issues and Solutions

### Issue: "Parameter validation failed" errors

**Symptoms**:

- Operations fail with InvalidArgumentError
- Error message mentions parameter validation

**Diagnosis Steps**:

1. Check entity ID format (must include colon)
2. Verify spot index is 0-9
3. Ensure logger object has all required methods

**Solution**:

```javascript
// Correct format
{
  furniture_id: 'furniture:couch',  // namespace:id
  actor_id: 'game:alice',           // namespace:id
  spot_index: 1                     // integer 0-9
}
```

### Issue: Closeness relationships not establishing

**Symptoms**:

- Actors sit adjacent but no closeness created
- Movement not locked after sitting

**Diagnosis Steps**:

1. Run StateConsistencyValidator to check system state
2. Verify furniture has allows_sitting component
3. Check if actors already have conflicting relationships

**Solution**:

```javascript
// Debug with consistency validator
const validator = new StateConsistencyValidator({ logger, entityManager });
const report = validator.performFullValidation();
console.log('Issues found:', report);
```

### Issue: Unidirectional relationships detected

**Symptoms**:

- Warning logs about unidirectional closeness
- Actor A has B as partner but not vice versa

**Diagnosis Steps**:

1. Check if relationship establishment was interrupted
2. Verify both actors exist and have closeness components
3. Look for errors during update operations

**Solution**:

```javascript
// Repair unidirectional relationships
const validator = new StateConsistencyValidator({ logger, entityManager });
const issues = validator.validateAllClosenessRelationships();
await validator.repairIssues(issues);
```

### Issue: Movement locks not releasing

**Symptoms**:

- Actors remain locked after standing up
- Orphaned movement locks detected

**Diagnosis Steps**:

1. Check if stand up operation completed successfully
2. Verify closeness relationships were properly removed
3. Look for errors in movement update operations

**Solution**:

```javascript
// Manually unlock orphaned movement
await updateMovementLock(entityManager, actorId, false);
```

## Debugging Tools

### Enable Debug Logging

```javascript
// Set logger to debug level
logger.level = 'debug';

// Validation will log detailed information
validateProximityParameters(furnitureId, actorId, spotIndex, logger);
```

### State Inspection

```javascript
// Inspect current state
const furniture = entityManager.getComponentData(
  furnitureId,
  'positioning:allows_sitting'
);
const closeness = entityManager.getComponentData(
  actorId,
  'positioning:closeness'
);
const movement = entityManager.getComponentData(
  actorId,
  'positioning:movement'
);

console.log('Furniture spots:', furniture?.spots);
console.log('Actor partners:', closeness?.partners);
console.log('Movement locked:', movement?.locked);
```

### Consistency Check Command

```javascript
// Add as debug command in game
function debugCheckConsistency() {
  const validator = new StateConsistencyValidator({ logger, entityManager });
  const report = validator.performFullValidation();

  if (report.totalIssues > 0) {
    console.warn(`Found ${report.totalIssues} consistency issues`);
    console.table(report.closenessIssues);
    console.table(report.movementLockIssues);
    console.table(report.furnitureOccupancyIssues);
  } else {
    console.log('System state is consistent');
  }
}
```
