# TSTAIMIG-008: Migrate Violence Category Test Suites

## Objective

Migrate the 4 test files in the Violence category from legacy patterns to the new testing infrastructure, leveraging the validated patterns from exercise category while introducing runtime integration complexity.

## Background

The Violence category represents the next complexity level, featuring runtime integration with entity relationships, action execution, and event validation. This migration builds on the successful exercise category migration while introducing new patterns for entity management and runtime testing.

## Dependencies

- **TSTAIMIG-006**: Exercise category migration completed
- **TSTAIMIG-007**: Exercise category validation completed  
- Validated infrastructure and migration patterns
- ModActionTestBase patterns established (if available)

## Target Files

This ticket will migrate **4 violence category test files** with runtime integration patterns:

- Entity creation and positioning setup
- Action execution and validation
- Event validation and relationship verification
- Multi-entity interaction testing

## Acceptance Criteria

### Migration Requirements

- [ ] **Runtime Integration Pattern Migration**
  - [ ] Extend ModActionTestBase for action test classes
  - [ ] Use ModEntityBuilder for entity setup and positioning
  - [ ] Leverage assertActionSuccess() for validation
  - [ ] Implement closeToEntity() and positioning methods

- [ ] **Entity Management Migration**
  - [ ] Replace manual entity creation with ModEntityBuilder
  - [ ] Use atLocation() and inSameLocationAs() for positioning
  - [ ] Implement relationship setup patterns
  - [ ] Preserve all entity interaction logic

- [ ] **Event Validation Migration**
  - [ ] Convert manual event filtering to assertion helpers
  - [ ] Use ModAssertionHelpers.assertActionSuccess()
  - [ ] Maintain event sequence validation
  - [ ] Preserve relationship verification logic

### Success Criteria Achievement

- [ ] **Code Reduction Target**: 80-90% reduction per file
- [ ] **Performance Requirements**: <30% regression limit
- [ ] **Quality Preservation**: 100% test case preservation
- [ ] **Integration Success**: All runtime patterns functional

## Implementation Steps

### Phase 1: Runtime Integration Pattern Development

1. **ModActionTestBase Extension Pattern**
   ```javascript
   class ViolenceActionTest extends ModActionTestBase {
     constructor() {
       super('violence', 'violence:action_id', actionRule, actionCondition);
     }
     
     setupTestEntities() {
       const actor = new ModEntityBuilder('actor1')
         .withName('TestActor')
         .atLocation('test-location')
         .build();
         
       const target = new ModEntityBuilder('target1')
         .withName('TestTarget')
         .inSameLocationAs(actor)
         .closeToEntity(actor)
         .build();
         
       return { actor, target };
     }
   }
   ```

2. **Entity Relationship Pattern**
   ```javascript
   setupComplexEntityRelationships() {
     const entities = this.setupTestEntities();
     
     // Add violence-specific components
     entities.actor = new ModEntityBuilder(entities.actor.id)
       .withComponent('violence:aggression', { level: 'moderate' })
       .build();
       
     return entities;
   }
   ```

3. **Event Validation Pattern**
   ```javascript
   validateViolenceActionSuccess() {
     ModAssertionHelpers.assertActionSuccess(
       this.capturedEvents,
       'Violence action executed successfully',
       { 
         shouldEndTurn: true, 
         shouldHavePerceptibleEvent: true,
         shouldUpdateRelationships: true
       }
     );
   }
   ```

### Phase 2: File-by-File Migration

1. **Migration Pattern Application**
   - Apply runtime integration patterns consistently
   - Use ModEntityBuilder for all entity setup
   - Implement ModActionTestBase extension where appropriate
   - Convert event validation to helper usage

2. **Entity Setup Standardization**
   - Replace manual entity creation patterns
   - Standardize positioning and relationship setup
   - Use infrastructure for component addition
   - Preserve all entity interaction logic

3. **Test Structure Optimization**
   - Reduce duplicated setup code
   - Leverage base class functionality
   - Consolidate similar assertions
   - Eliminate redundant validations

### Phase 3: Integration and Validation

1. **Quality Gate Execution**
   ```bash
   npm run qa:validate-migration violence
   npm run test:integration tests/integration/mods/violence/
   npm run metrics:collect-migrated violence
   ```

2. **Performance and Behavior Validation**
   - Compare execution times before/after
   - Verify behavioral equivalence
   - Validate entity relationship handling
   - Confirm event sequence preservation

## Migration Patterns for Violence Category

### Pattern 1: Entity Creation and Setup
```javascript
// Legacy: Manual entity creation
const actor = gameEngine.createEntity('actor1');
gameEngine.addComponent(actor, 'name', { name: 'TestActor' });
gameEngine.addComponent(actor, 'location', { location: 'test-location' });

// Migrated: ModEntityBuilder usage
const actor = new ModEntityBuilder('actor1')
  .withName('TestActor')
  .atLocation('test-location')
  .build();
```

### Pattern 2: Action Execution and Validation
```javascript
// Legacy: Manual action execution and event filtering
await actionHandler.execute(actionData, context);
const successEvents = capturedEvents.filter(e => e.type === 'ACTION_SUCCESS');
expect(successEvents).toHaveLength(1);

// Migrated: Assertion helper usage
await this.executeAction(actor.id, target.id);
ModAssertionHelpers.assertActionSuccess(this.capturedEvents, expectedMessage);
```

### Pattern 3: Relationship Verification
```javascript
// Legacy: Manual relationship checking
const relationship = gameEngine.getComponent(actor, 'relationships');
expect(relationship.hostility[target.id]).toBeGreaterThan(0);

// Migrated: Infrastructure-supported verification
ModAssertionHelpers.assertComponentAdded(
  this.entityManager, actor.id, 'relationships', 
  { hostility: expect.objectContaining({ [target.id]: expect.any(Number) }) }
);
```

## Success Criteria

### Quantitative Metrics
- [ ] **Code Reduction**: 80-90% for each of 4 files
- [ ] **Performance Impact**: <30% regression per file
- [ ] **Test Preservation**: 100% of test cases maintained
- [ ] **Quality Gates**: All quality gates pass

### Qualitative Metrics
- [ ] **Pattern Consistency**: Runtime integration patterns applied consistently
- [ ] **Infrastructure Usage**: Maximum utilization of available infrastructure
- [ ] **Maintainability**: Tests easier to understand and modify
- [ ] **Scalability**: Patterns applicable to more complex categories

## Deliverables

1. **Migrated Test Files** (4 files)
   - All violence category tests migrated
   - Runtime integration patterns implemented
   - Entity management standardized
   - Event validation optimized

2. **Runtime Integration Pattern Library**
   - ModActionTestBase extension patterns
   - ModEntityBuilder usage patterns
   - Event validation helper patterns
   - Relationship verification patterns

3. **Migration Documentation**
   - Runtime integration migration guide
   - Entity management best practices
   - Event validation standardization
   - Performance optimization techniques

## Quality Gates for This Ticket

- [ ] All 4 violence category files successfully migrated
- [ ] Code reduction targets achieved (80-90%)
- [ ] Performance requirements met (<30% regression)
- [ ] Runtime integration patterns validated
- [ ] Entity management infrastructure working
- [ ] Ready for violence category validation (TSTAIMIG-009)