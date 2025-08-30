# MODTESTREF-002: Implement ModEntityBuilder

## Overview

Create a fluent API builder for standardized entity creation in mod tests, eliminating repetitive entity setup patterns across 48 test files. The builder will provide a chainable interface for creating entities with common mod test configurations like names, locations, closeness relationships, and components.

## Problem Statement

### Current Entity Setup Duplication

Every mod test manually creates entities with repetitive patterns:

```javascript
// Actor-target setup repeated in every test
testEnv.reset([
  {
    id: 'actor1',
    components: {
      [NAME_COMPONENT_ID]: { text: 'Alice' },
      [POSITION_COMPONENT_ID]: { locationId: 'room1' },
    },
  },
  {
    id: 'target1',
    components: {
      [NAME_COMPONENT_ID]: { text: 'Bob' },
      [POSITION_COMPONENT_ID]: { locationId: 'room1' },
    },
  },
]);

// Closeness setup for intimacy/positioning tests
'positioning:closeness': { partners: ['target1'] },

// Anatomy setup for sex/violence tests  
'anatomy:body': {
  body: { root: 'torso1' },
},
```

### Variation Inconsistencies

- **Entity IDs**: Some use `'actor1'`, others `'test:actor1'`, some use production IDs like `'p_erotica:iker_aguirre_instance'`
- **Component Structure**: Inconsistent component data formatting
- **Location Setup**: Different approaches to location assignment
- **Name Assignment**: Varied naming patterns and formats

### Impact

- **480+ lines** of repetitive entity setup code (10 lines × 48 files)
- **Maintenance burden** when component schemas change
- **Test brittleness** from hardcoded entity structures
- **Inconsistent patterns** leading to test failures

## Technical Requirements

### Builder Pattern Interface

**File Location**: `tests/common/mods/ModEntityBuilder.js`

**Dependencies**:
```javascript
// Component Constants
import { NAME_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';
// Additional component IDs as needed

// Validation
import { assertNonBlankString } from '../../src/utils/validationCore.js';
import { validateDependency } from '../../src/utils/dependencyUtils.js';
```

### Fluent API Design

```javascript
class ModEntityBuilder {
  constructor(entityId) {
    this.entity = {
      id: entityId,
      components: {}
    };
  }

  // Core identity methods
  withName(name) {
    // Sets NAME_COMPONENT_ID with text property
  }

  withDescription(description) {
    // Sets description component if applicable
  }

  // Location methods
  atLocation(locationId) {
    // Sets POSITION_COMPONENT_ID with locationId
  }

  inSameLocationAs(otherEntity) {
    // Matches location of another entity
  }

  // Relationship methods
  closeToEntity(entityId) {
    // Sets positioning:closeness component
  }

  closeToEntities(entityIds) {
    // Sets closeness to multiple entities
  }

  facingEntity(entityId) {
    // Sets facing relationship if applicable
  }

  // Anatomy methods
  withBasicAnatomy() {
    // Sets basic anatomy:body component
  }

  withCustomAnatomy(anatomyConfig) {
    // Sets custom anatomy configuration
  }

  // Component methods
  withComponent(componentId, data) {
    // Generic component addition
  }

  withComponents(componentMap) {
    // Bulk component addition
  }

  // Validation and building
  validate() {
    // Validates entity structure
  }

  build() {
    // Returns complete entity object
  }

  // Static factory methods
  static createActor(id, name) {
    // Creates basic actor entity
  }

  static createTarget(id, name) {
    // Creates basic target entity
  }

  static createObserver(id, name) {
    // Creates observer entity for multi-actor scenarios
  }

  static createActorTargetPair(actorName = 'Alice', targetName = 'Bob') {
    // Creates standard actor-target pair
  }
}
```

### Implementation Details

**Basic Entity Structure**:
```javascript
constructor(entityId) {
  assertNonBlankString(entityId, 'Entity ID', 'ModEntityBuilder constructor');
  
  this.entity = {
    id: entityId,
    components: {}
  };
  
  return this; // Enable chaining from constructor
}
```

**Name Component**:
```javascript
withName(name) {
  assertNonBlankString(name, 'Entity name', 'ModEntityBuilder.withName');
  
  this.entity.components[NAME_COMPONENT_ID] = {
    text: name
  };
  
  return this;
}
```

**Location Component**:
```javascript
atLocation(locationId) {
  assertNonBlankString(locationId, 'Location ID', 'ModEntityBuilder.atLocation');
  
  this.entity.components[POSITION_COMPONENT_ID] = {
    locationId: locationId
  };
  
  return this;
}

inSameLocationAs(otherEntity) {
  if (!otherEntity || !otherEntity.components || !otherEntity.components[POSITION_COMPONENT_ID]) {
    throw new Error('ModEntityBuilder.inSameLocationAs: otherEntity must have a location component');
  }
  
  const otherLocation = otherEntity.components[POSITION_COMPONENT_ID].locationId;
  return this.atLocation(otherLocation);
}
```

**Closeness Relationships**:
```javascript
closeToEntity(entityId) {
  assertNonBlankString(entityId, 'Entity ID for closeness', 'ModEntityBuilder.closeToEntity');
  
  if (!this.entity.components['positioning:closeness']) {
    this.entity.components['positioning:closeness'] = {
      partners: []
    };
  }
  
  if (!this.entity.components['positioning:closeness'].partners.includes(entityId)) {
    this.entity.components['positioning:closeness'].partners.push(entityId);
  }
  
  return this;
}

closeToEntities(entityIds) {
  if (!Array.isArray(entityIds)) {
    throw new Error('ModEntityBuilder.closeToEntities: entityIds must be an array');
  }
  
  entityIds.forEach(entityId => this.closeToEntity(entityId));
  return this;
}
```

**Anatomy Components**:
```javascript
withBasicAnatomy() {
  this.entity.components['anatomy:body'] = {
    body: { root: 'torso1' }
  };
  
  return this;
}

withCustomAnatomy(anatomyConfig) {
  if (!anatomyConfig || typeof anatomyConfig !== 'object') {
    throw new Error('ModEntityBuilder.withCustomAnatomy: anatomyConfig must be an object');
  }
  
  this.entity.components['anatomy:body'] = anatomyConfig;
  return this;
}
```

**Generic Component Addition**:
```javascript
withComponent(componentId, data) {
  assertNonBlankString(componentId, 'Component ID', 'ModEntityBuilder.withComponent');
  
  if (data === undefined || data === null) {
    throw new Error('ModEntityBuilder.withComponent: component data cannot be null or undefined');
  }
  
  this.entity.components[componentId] = data;
  return this;
}
```

**Factory Methods**:
```javascript
static createActor(id = 'actor1', name = 'Actor') {
  return new ModEntityBuilder(id)
    .withName(name)
    .atLocation('room1');
}

static createTarget(id = 'target1', name = 'Target') {
  return new ModEntityBuilder(id)
    .withName(name)
    .atLocation('room1');
}

static createActorTargetPair(actorName = 'Alice', targetName = 'Bob', location = 'room1') {
  const actor = new ModEntityBuilder('actor1')
    .withName(actorName)
    .atLocation(location)
    .closeToEntity('target1')
    .build();
    
  const target = new ModEntityBuilder('target1')
    .withName(targetName)
    .atLocation(location)
    .closeToEntity('actor1')
    .build();
    
  return { actor, target };
}
```

### Usage Patterns

**Before (manual entity creation)**:
```javascript
testEnv.reset([
  {
    id: 'actor1',
    components: {
      [NAME_COMPONENT_ID]: { text: 'Alice' },
      [POSITION_COMPONENT_ID]: { locationId: 'room1' },
      'positioning:closeness': { partners: ['target1'] },
    },
  },
  {
    id: 'target1',  
    components: {
      [NAME_COMPONENT_ID]: { text: 'Bob' },
      [POSITION_COMPONENT_ID]: { locationId: 'room1' },
      'positioning:closeness': { partners: ['actor1'] },
    },
  },
]);
```

**After (fluent builder)**:
```javascript
import { ModEntityBuilder } from '../common/mods/ModEntityBuilder.js';

// Simple pair creation
const { actor, target } = ModEntityBuilder.createActorTargetPair('Alice', 'Bob');
testEnv.reset([actor, target]);

// Custom configuration
const actor = new ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .closeToEntity('target1')
  .withBasicAnatomy()
  .build();

const target = new ModEntityBuilder('target1')
  .withName('Bob')
  .atLocation('room1')
  .closeToEntity('actor1')
  .withComponent('custom:component', { value: 'test' })
  .build();

testEnv.reset([actor, target]);
```

### Category-Specific Helpers

**Positioning Test Helpers**:
```javascript
// Positioning-specific methods
withKneelingBefore(entityId) {
  return this.withComponent('positioning:kneeling_before', {
    target: entityId
  });
}

withStandingBehind(entityId) {
  return this.withComponent('positioning:standing_behind', {
    target: entityId
  });
}
```

**Intimacy Test Helpers**:
```javascript
// Intimacy-specific factory
static createIntimateCouple(actorName = 'Alice', targetName = 'Bob') {
  const { actor, target } = this.createActorTargetPair(actorName, targetName);
  
  // Add intimacy-specific closeness
  actor.components['positioning:closeness'].intimacy_level = 'close';
  target.components['positioning:closeness'].intimacy_level = 'close';
  
  return { actor, target };
}
```

## Implementation Steps

### Step 1: Create Core Builder Class
1. Create `tests/common/mods/ModEntityBuilder.js`
2. Implement constructor with entity ID validation
3. Implement basic fluent methods: `withName`, `atLocation`, `withComponent`
4. Add `build()` method with validation

### Step 2: Implement Relationship Methods  
1. Add `closeToEntity` and `closeToEntities` methods
2. Implement `inSameLocationAs` method for location copying
3. Add `facingEntity` method for directional relationships
4. Test relationship building with multiple entities

### Step 3: Add Anatomy Support
1. Implement `withBasicAnatomy` for standard body structure
2. Add `withCustomAnatomy` for complex anatomy scenarios
3. Create anatomy helpers for common body configurations
4. Test with sex/violence mod requirements

### Step 4: Create Static Factory Methods
1. Implement `createActor`, `createTarget`, `createObserver` 
2. Add `createActorTargetPair` for common two-entity scenarios
3. Create category-specific factories (intimacy, positioning)
4. Add multi-actor scenario factories

### Step 5: Add Category-Specific Extensions
1. Create positioning-specific helper methods
2. Add intimacy-specific configuration methods
3. Implement violence/exercise-specific helpers
4. Add sex-specific anatomy configurations

## Validation & Testing

### Unit Tests Required

**File**: `tests/unit/common/mods/ModEntityBuilder.test.js`

**Test Coverage**:
```javascript
describe('ModEntityBuilder', () => {
  describe('constructor', () => {
    it('should create builder with entity ID');
    it('should throw error for blank entity ID');
    it('should initialize empty components object');
  });

  describe('withName', () => {
    it('should set NAME_COMPONENT_ID with text property');
    it('should throw error for blank name');
    it('should return this for chaining');
  });

  describe('atLocation', () => {
    it('should set POSITION_COMPONENT_ID with locationId');
    it('should throw error for blank location ID');
    it('should return this for chaining');
  });

  describe('closeToEntity', () => {
    it('should create positioning:closeness component');
    it('should add entity to partners array');
    it('should not duplicate entities in partners');
    it('should handle multiple closeToEntity calls');
  });

  describe('withComponent', () => {
    it('should add component with provided data');
    it('should throw error for blank component ID');
    it('should throw error for null/undefined data');
  });

  describe('build', () => {
    it('should return complete entity object');
    it('should validate required components');
    it('should return immutable entity copy');
  });

  describe('static factory methods', () => {
    describe('createActorTargetPair', () => {
      it('should create actor and target with default names');
      it('should create entities with custom names');
      it('should set up mutual closeness relationships');
      it('should place entities in same location');
    });

    describe('createActor', () => {
      it('should create actor with default values');
      it('should create actor with custom name and ID');
    });
  });
});
```

### Integration Testing
1. Test builder with `createRuleTestEnvironment`
2. Verify entities work correctly in actual test scenarios  
3. Test complex entity relationships and dependencies
4. Validate component schema compliance

### Migration Testing
1. Replace entity creation in sample test file
2. Run test to ensure identical behavior
3. Compare entity objects between old and new approaches
4. Test performance impact of builder pattern

## Acceptance Criteria

### Functional Requirements
- [ ] Fluent API supports method chaining for all operations
- [ ] Builder creates entities compatible with existing test infrastructure
- [ ] Static factories provide convenient entity creation patterns
- [ ] Relationship methods correctly establish entity connections
- [ ] Component validation ensures data integrity
- [ ] Build method produces immutable entity objects

### Quality Requirements
- [ ] 100% unit test coverage for all builder methods
- [ ] Integration tests demonstrate working entity creation
- [ ] JSDoc documentation complete for all public methods
- [ ] Error handling for invalid parameters implemented
- [ ] Builder follows project naming and validation patterns

### Performance Requirements
- [ ] Entity building performance comparable to manual creation
- [ ] Memory usage efficient for large entity sets
- [ ] No performance regression in test execution

### Usability Requirements
- [ ] Clear method names that describe their purpose
- [ ] Intuitive method chaining order
- [ ] Helpful error messages for validation failures
- [ ] Category-specific helpers reduce common setup code

## Success Metrics

### Code Reduction
- **Target**: Eliminate 480+ lines of repetitive entity setup code
- **Measurement**: Line count comparison in entity creation sections
- **Success**: >80% reduction in manual entity setup code

### Consistency Improvement
- **Target**: Standardized entity structures across all mod tests
- **Measurement**: Entity structure variance analysis
- **Success**: <5% variance in standard entity patterns

### Developer Experience
- **Target**: Faster and more reliable entity creation
- **Measurement**: Developer feedback and entity setup time
- **Success**: 50%+ reduction in entity setup time and errors

### Test Reliability
- **Target**: More reliable tests through standardized entities
- **Measurement**: Test failure rates due to entity setup issues
- **Success**: 80%+ reduction in entity-related test failures

## Integration Points

### ModTestHandlerFactory Integration
- Builder entities must work with handlers created by MODTESTREF-001
- Entity IDs must be compatible with handler operation patterns

### ModActionTestBase Integration
- Base classes from MODTESTREF-004 will use builder for entity creation
- Builder must support inheritance and customization patterns

### Migration Strategy Integration  
- MODTESTREF-007 will use builder to replace existing entity creation
- Builder must maintain compatibility with existing test expectations

## Next Steps

Upon completion, this builder will be ready for:
1. **MODTESTREF-003**: Integration with ModAssertionHelpers for entity validation
2. **MODTESTREF-004**: Usage in ModActionTestBase and ModRuleTestBase classes
3. **MODTESTREF-005**: Integration with ModTestFixture factory
4. **MODTESTREF-007**: Migration of entity creation in all 48 test files

This builder will eliminate repetitive entity setup patterns and provide a foundation for consistent, maintainable entity creation across all mod integration tests.