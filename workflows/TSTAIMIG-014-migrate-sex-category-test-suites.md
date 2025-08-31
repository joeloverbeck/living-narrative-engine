# TSTAIMIG-014: Migrate Sex Category Test Suites

## Objective

Migrate the 10 test files in the Sex category from legacy patterns to the new testing infrastructure, implementing complex anatomy requirements and explicit content validation patterns while achieving the target 80-90% code reduction.

## Background

The Sex category represents complex anatomy-based testing patterns with clothing state management, action prerequisites based on anatomy, and multi-component validation requirements. This migration builds on all previous category successes while introducing the most complex entity setup patterns.

## Dependencies

- **TSTAIMIG-013**: Intimacy category validation completed
- All previous category migrations validated
- Complex entity setup patterns established
- Anatomy component handling validated

## Target Files

**10 sex category test files** featuring:
- Anatomy component setup and validation
- Clothing state management and prerequisites
- Action prerequisites based on anatomy requirements
- Complex multi-component validation scenarios
- Explicit content handling with appropriate validation

## Acceptance Criteria

### Anatomy Requirements Pattern Migration

- [ ] **setupAnatomyComponents() Helper Method**
  - [ ] Create standardized anatomy setup patterns
  - [ ] Use ModEntityBuilder's withComponent() for anatomy setup
  - [ ] Implement clothing component integration via withClothing()
  - [ ] Validate anatomy prerequisites systematically

- [ ] **Complex Multi-Component Integration**
  - [ ] Integrate anatomy, clothing, and positioning components
  - [ ] Preserve all explicit content validation logic
  - [ ] Maintain prerequisites checking accuracy
  - [ ] Support complex entity relationship scenarios

- [ ] **Clothing State Management**
  - [ ] Standardize clothing component setup and validation
  - [ ] Preserve clothing state transition logic
  - [ ] Integrate clothing prerequisites with action validation
  - [ ] Support complex clothing interaction scenarios

### Advanced Infrastructure Integration

- [ ] **ModEntityBuilder Advanced Usage**
  - [ ] withComponent() for complex anatomy setup
  - [ ] withClothing() for clothing state management
  - [ ] Complex entity relationship management
  - [ ] Multi-component integration patterns

- [ ] **Custom Assertion Patterns**
  - [ ] Anatomy-specific assertion helpers (if needed)
  - [ ] Clothing state validation patterns
  - [ ] Multi-component validation helpers
  - [ ] Prerequisites validation standardization

## Implementation Steps

### Phase 1: Anatomy Pattern Development

1. **setupAnatomyComponents() Pattern Creation**
   ```javascript
   setupAnatomyComponents() {
     const actor = new ModEntityBuilder('actor1')
       .withName('TestActor')
       .atLocation('test-location')
       .withComponent('anatomy:chest', { 
         size: 'medium',
         covered: false,
         sensitivity: 'normal'
       })
       .withComponent('anatomy:genitals', {
         type: 'penis',
         size: 'average',
         state: 'flaccid'
       })
       .build();
       
     const target = new ModEntityBuilder('target1')
       .withName('TestTarget')
       .inSameLocationAs(actor)
       .withComponent('anatomy:chest', {
         size: 'large', 
         covered: true,
         sensitivity: 'high'
       })
       .withClothing({
         'clothing:shirt': { worn: true, coverage: ['chest'] },
         'clothing:bra': { worn: true, coverage: ['chest'] }
       })
       .build();
       
     return { actor, target };
   }
   ```

2. **Clothing State Management Pattern**
   ```javascript
   setupClothingScenarios() {
     const entities = this.setupAnatomyComponents();
     
     // Complex clothing state setup
     entities.target = new ModEntityBuilder(entities.target.id)
       .withClothing({
         'clothing:shirt': { worn: false, coverage: ['chest'] },
         'clothing:bra': { worn: false, coverage: ['chest'] },
         'clothing:pants': { worn: true, coverage: ['genitals', 'legs'] }
       })
       .build();
       
     return entities;
   }
   ```

### Phase 2: Prerequisites and Validation Migration

1. **Anatomy Prerequisites Validation**
   ```javascript
   validateAnatomyPrerequisites() {
     // Use standard assertion helpers for anatomy validation
     ModAssertionHelpers.assertComponentPresent(
       this.entityManager,
       this.actor.id,
       'anatomy:chest'
     );
     
     ModAssertionHelpers.assertComponentState(
       this.entityManager,
       this.target.id, 
       'anatomy:chest',
       { covered: false }
     );
   }
   ```

2. **Multi-Component Integration Validation**
   ```javascript
   validateComplexInteraction() {
     ModAssertionHelpers.assertActionSuccess(
       this.capturedEvents,
       'Sexual action executed successfully',
       {
         shouldEndTurn: true,
         shouldHavePerceptibleEvent: true,
         shouldUpdateAnatomy: true,
         shouldUpdateClothing: true
       }
     );
   }
   ```

### Phase 3: File-by-File Migration

1. **Pattern Application**
   - Apply anatomy setup patterns consistently
   - Implement clothing state management standardization
   - Convert prerequisites validation to helper usage
   - Preserve all explicit content validation logic

2. **Quality Validation**
   - Ensure all anatomy scenarios preserved
   - Validate clothing state transitions maintained
   - Confirm prerequisites checking accuracy
   - Verify multi-component integration functionality

## Migration Patterns for Sex Category

### Pattern 1: Anatomy Component Setup
```javascript
// Legacy: Manual anatomy component addition
gameEngine.addComponent(actor, 'anatomy:chest', {
  size: 'medium', covered: false, sensitivity: 'normal'
});
gameEngine.addComponent(actor, 'anatomy:genitals', {
  type: 'penis', size: 'average', state: 'flaccid'  
});

// Migrated: ModEntityBuilder with anatomy
const actor = new ModEntityBuilder('actor1')
  .withComponent('anatomy:chest', { 
    size: 'medium', covered: false, sensitivity: 'normal'
  })
  .withComponent('anatomy:genitals', {
    type: 'penis', size: 'average', state: 'flaccid'
  })
  .build();
```

### Pattern 2: Clothing State Management
```javascript
// Legacy: Manual clothing setup and state management
gameEngine.addComponent(target, 'clothing:shirt', { worn: true });
gameEngine.addComponent(target, 'clothing:bra', { worn: true });
// Complex state transition logic...

// Migrated: Integrated clothing management
const target = new ModEntityBuilder('target1')
  .withClothing({
    'clothing:shirt': { worn: true, coverage: ['chest'] },
    'clothing:bra': { worn: true, coverage: ['chest'] }
  })
  .build();
```

### Pattern 3: Multi-Component Validation
```javascript
// Legacy: Manual component validation
const anatomyComponent = gameEngine.getComponent(actor, 'anatomy:chest');
expect(anatomyComponent.sensitivity).toBe('high');
const clothingComponent = gameEngine.getComponent(target, 'clothing:shirt');
expect(clothingComponent.worn).toBe(false);

// Migrated: Integrated validation helpers
ModAssertionHelpers.assertComponentState(
  this.entityManager, actor.id, 'anatomy:chest', 
  { sensitivity: 'high' }
);
ModAssertionHelpers.assertComponentState(
  this.entityManager, target.id, 'clothing:shirt',
  { worn: false }
);
```

## Success Criteria

### Quantitative Metrics
- [ ] **Code Reduction**: 80-90% for all 10 files
- [ ] **Performance**: <30% regression per file  
- [ ] **Test Preservation**: 100% of test cases maintained
- [ ] **Component Integration**: All anatomy/clothing patterns working

### Qualitative Metrics
- [ ] **Pattern Sophistication**: Most complex patterns successfully implemented
- [ ] **Integration Quality**: Seamless multi-component integration
- [ ] **Maintainability**: Complex scenarios made maintainable
- [ ] **Reusability**: Patterns reusable for future complex scenarios

## Deliverables

1. **Migrated Test Files** (10 files)
   - Anatomy requirements patterns implemented
   - Clothing state management standardized
   - Multi-component integration optimized
   - Prerequisites validation systematized

2. **Advanced Pattern Library**
   - setupAnatomyComponents() helper patterns
   - Clothing state management patterns
   - Multi-component validation patterns
   - Complex entity interaction patterns

3. **Sex Category Documentation**
   - Anatomy component handling guidelines
   - Clothing state management procedures
   - Multi-component integration best practices
   - Complex scenario testing patterns

## Risk Mitigation

### Content Handling Risks
**Risk**: Explicit content validation changes behavior
- **Mitigation**: Careful preservation of all validation logic, thorough testing

### Complexity Risks  
**Risk**: Complex multi-component scenarios break during migration
- **Mitigation**: Incremental migration, extensive validation, rollback capability

## Dependencies for Next Tickets

This ticket enables:
- **TSTAIMIG-015**: Sex category validation (validates complex patterns)
- **TSTAIMIG-016**: Positioning phase 1 (uses advanced entity patterns)
- **TSTAIMIG-020**: Comprehensive validation (all categories completed)

## Quality Gates for This Ticket

- [ ] All 10 sex category files successfully migrated
- [ ] Complex anatomy patterns validated and working
- [ ] Clothing state management functional
- [ ] Multi-component integration successful
- [ ] Code reduction targets achieved (80-90%)
- [ ] Performance requirements met (<30% regression)
- [ ] Ready for sex category validation (TSTAIMIG-015)