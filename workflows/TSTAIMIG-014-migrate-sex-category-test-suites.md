# TSTAIMIG-014: Migrate Sex Category Test Suites

## Objective

Migrate the 10 test files in the Sex category from legacy patterns to the new testing infrastructure, implementing complex anatomy requirements and explicit content validation patterns while achieving the target 80-90% code reduction.

## Background

The Sex category represents complex anatomy-based testing patterns with clothing state management, action prerequisites based on anatomy, and multi-component validation requirements. This migration builds on all previous category successes while introducing the most complex entity setup patterns.

### Current Test State
The sex category tests are currently using the OLD patterns with:
- `createRuleTestEnvironment` for test setup
- Manual handler creation via `new OperationHandler()`
- Direct entity object creation without builders
- No `ModTestFixture` usage

They need to migrate TO the new patterns:
- `ModTestFixture.forAction()` for test setup (with async/await)
- Automatic handler creation via fixtures
- `ModEntityBuilder` for all entity creation
- Standard assertion helpers from `ModAssertionHelpers`
- Proper anatomy entity structure (separate entities with `anatomy:part` component)

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
     // Actors reference their root body part
     const actor = new ModEntityBuilder('actor1')
       .withName('TestActor')
       .atLocation('test-location')
       .withBody('actor1_torso')  // Reference to root anatomy entity
       .build();
       
     // Anatomy parts are SEPARATE entities
     const actorTorso = new ModEntityBuilder('actor1_torso')
       .asBodyPart({
         parent: null,  // Root part has no parent
         children: ['actor1_chest', 'actor1_genitals'],
         subType: 'torso'
       })
       .build();
       
     const actorChest = new ModEntityBuilder('actor1_chest')
       .asBodyPart({
         parent: 'actor1_torso',
         children: [],
         subType: 'chest',
         size: 'medium',
         covered: false,
         sensitivity: 'normal'
       })
       .build();
       
     const actorGenitals = new ModEntityBuilder('actor1_genitals')
       .asBodyPart({
         parent: 'actor1_torso',
         children: [],
         subType: 'penis',
         size: 'average',
         state: 'flaccid'
       })
       .build();
       
     const target = new ModEntityBuilder('target1')
       .withName('TestTarget')
       .inSameLocationAs(actor)
       .withBody('target1_torso')
       .withClothing({
         'clothing:shirt': { worn: true, coverage: ['chest'] },
         'clothing:bra': { worn: true, coverage: ['chest'] }
       })
       .build();
       
     // Target anatomy entities
     const targetTorso = new ModEntityBuilder('target1_torso')
       .asBodyPart({
         parent: null,
         children: ['target1_chest'],
         subType: 'torso'
       })
       .build();
       
     const targetChest = new ModEntityBuilder('target1_chest')
       .asBodyPart({
         parent: 'target1_torso',
         children: [],
         subType: 'chest',
         size: 'large',
         covered: true,
         sensitivity: 'high'
       })
       .build();
       
     return { 
       actor, 
       actorTorso,
       actorChest,
       actorGenitals,
       target,
       targetTorso,
       targetChest
     };
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
     // Use existing assertion helpers for anatomy validation
     ModAssertionHelpers.assertEntityHasComponents(
       this.entityManager,
       this.actorChest.id,
       ['anatomy:part']
     );
     
     // For component state validation, use direct expectations
     const chestPart = this.entityManager.getComponentData(
       this.targetChest.id,
       'anatomy:part'
     );
     expect(chestPart.covered).toBe(false);
     
     // Or use assertBodyPart for structured validation
     ModAssertionHelpers.assertBodyPart(
       this.entityManager,
       this.targetChest.id,
       {
         parent: 'target1_torso',
         subType: 'chest',
         covered: false
       }
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

### Phase 3: Test Fixture Setup with Async/Await

1. **Proper Fixture Creation Pattern**
   ```javascript
   describe('Sex Action Tests', () => {
     let testFixture;
     let entities;
     
     beforeEach(async () => {  // Note the async
       // Create the test fixture - this is async!
       testFixture = await ModTestFixture.forAction(  // Note the await
         'sex',
         'sex:fondle_breasts'
         // Rule and condition files are auto-loaded
       );
       
       // Setup anatomy entities
       entities = setupAnatomyComponents();
       
       // Add entities to the test environment
       Object.values(entities).forEach(entity => {
         testFixture.addEntity(entity);
       });
     });
     
     afterEach(() => {
       testFixture?.cleanup();
     });
     
     it('should handle sexual interaction with anatomy', async () => {
       // Execute the action
       const result = await testFixture.executeAction({
         actor: entities.actor.id,
         target: entities.target.id
       });
       
       // Validate results
       ModAssertionHelpers.assertActionSuccess(
         testFixture.capturedEvents,
         'Sexual action executed successfully'
       );
     });
   });
   ```

### Phase 4: File-by-File Migration

1. **Pattern Application**
   - Apply anatomy setup patterns consistently
   - Implement clothing state management standardization
   - Convert prerequisites validation to helper usage
   - Preserve all explicit content validation logic
   - Always use async/await for fixture creation

2. **Quality Validation**
   - Ensure all anatomy scenarios preserved
   - Validate clothing state transitions maintained
   - Confirm prerequisites checking accuracy
   - Verify multi-component integration functionality
   - Confirm all async operations properly awaited

## Migration Patterns for Sex Category

### Pattern 1: Anatomy Component Setup
```javascript
// Legacy: Manual anatomy component addition to single entity
gameEngine.addComponent(actor, 'anatomy:chest', {
  size: 'medium', covered: false, sensitivity: 'normal'
});
gameEngine.addComponent(actor, 'anatomy:genitals', {
  type: 'penis', size: 'average', state: 'flaccid'  
});

// Migrated: Separate anatomy entities with proper structure
const actor = new ModEntityBuilder('actor1')
  .withName('TestActor')
  .withBody('actor1_torso')  // Reference to root anatomy entity
  .build();

const actorTorso = new ModEntityBuilder('actor1_torso')
  .asBodyPart({
    parent: null,
    children: ['actor1_chest', 'actor1_genitals'],
    subType: 'torso'
  })
  .build();

const actorChest = new ModEntityBuilder('actor1_chest')
  .asBodyPart({
    parent: 'actor1_torso',
    children: [],
    subType: 'chest',
    size: 'medium',
    covered: false,
    sensitivity: 'normal'
  })
  .build();

const actorGenitals = new ModEntityBuilder('actor1_genitals')
  .asBodyPart({
    parent: 'actor1_torso',
    children: [],
    subType: 'penis',
    size: 'average',
    state: 'flaccid'
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

// Migrated: Direct validation with proper entity structure
const chestData = this.entityManager.getComponentData(
  actorChest.id, 
  'anatomy:part'
);
expect(chestData.sensitivity).toBe('high');

const clothingData = this.entityManager.getComponentData(
  target.id,
  'clothing:items'
);
expect(clothingData['clothing:shirt'].worn).toBe(false);

// Or use assertBodyPart for anatomy validation
ModAssertionHelpers.assertBodyPart(
  this.entityManager,
  actorChest.id,
  { sensitivity: 'high', subType: 'chest' }
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