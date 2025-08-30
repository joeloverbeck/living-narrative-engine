# Mod Integration Test Architecture Analysis

## Executive Summary

This report analyzes the architecture of the mod integration test suites in `tests/integration/mods/` and provides recommendations for improving code reuse, maintainability, and scalability. The analysis covers 48 test files across 5 mod categories, revealing significant opportunities for architectural improvements that will be critical as the project scales to potentially thousands of mod test suites.

### Current State Assessment

**Strengths:**
- Comprehensive coverage of mod functionality
- Well-organized by mod categories (exercise, sex, positioning, violence, intimacy)
- Consistent use of existing test infrastructure (`createRuleTestEnvironment`)
- Good separation between action tests and rule tests

**Critical Concerns:**
- Massive code duplication (40-60 lines per test file)
- No specialized base classes for mod testing
- Inconsistent test patterns across different mod categories
- Complex setup requirements that make tests brittle
- Missing specialized utilities for common mod test scenarios

### Priority Recommendations

1. **Immediate:** Create mod-specific base test classes to eliminate duplication
2. **Immediate:** Implement specialized test utilities for mod scenarios
3. **Near-term:** Migrate existing tests to use new infrastructure
4. **Long-term:** Establish patterns and documentation for scalable mod testing

## Detailed Analysis

### Current Architecture

#### Test File Structure Analysis

**File Distribution:**
```
tests/integration/mods/
├── exercise/ (2 files)
│   ├── show_off_biceps_action.test.js
│   └── rules/showOffBicepsRule.integration.test.js
├── sex/ (9 files)
│   ├── 8 action test files
│   └── rules/pressAgainstBackRule.integration.test.js
├── positioning/ (8 files)
│   ├── 6 action test files
│   └── rules/ (5 rule test files)
├── violence/ (4 files)
│   ├── 2 action test files
│   └── rules/ (2 rule test files)
└── intimacy/ (25 files)
    ├── 16 action test files
    └── rules/ (9 rule test files)
```

**Total Impact:**
- **48 test files** with significant code duplication
- **Estimated 1,920+ lines of duplicated code** (40 lines × 48 files)
- **5 different mod categories** with inconsistent patterns

#### Common Code Duplication Patterns

**1. Handler Creation Function (30+ lines per file)**

Every test file contains an identical or nearly identical `createHandlers` function:

```javascript
function createHandlers(entityManager, eventBus, logger) {
  const safeDispatcher = {
    dispatch: jest.fn((eventType, payload) => {
      eventBus.dispatch(eventType, payload);
      return Promise.resolve(true);
    }),
  };

  return {
    QUERY_COMPONENT: new QueryComponentHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_NAME: new GetNameHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    }),
    GET_TIMESTAMP: new GetTimestampHandler({ logger }),
    DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
      dispatcher: eventBus,
      logger,
      addPerceptionLogEntryHandler: { execute: jest.fn() },
    }),
    DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
    END_TURN: new EndTurnHandler({
      safeEventDispatcher: safeDispatcher,
      logger,
    }),
    SET_VARIABLE: new SetVariableHandler({ logger }),
  };
}
```

**Variations observed:**
- Some files add `ADD_COMPONENT` handler
- Intimacy tests sometimes omit `SET_VARIABLE` handler
- Handler order varies between files

**2. Test Environment Setup (20-30 lines per file)**

```javascript
beforeEach(() => {
  const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
  const expanded = expandMacros(ruleFile.actions, {
    get: (type, id) => (type === 'macros' ? macros[id] : undefined),
  });

  const dataRegistry = {
    getAllSystemRules: jest
      .fn()
      .mockReturnValue([{ ...ruleFile, actions: expanded }]),
    getConditionDefinition: jest.fn((id) =>
      id === 'mod:event-is-action-specific' ? conditionFile : undefined
    ),
  };

  testEnv = createRuleTestEnvironment({
    createHandlers,
    entities: [],
    rules: [{ ...ruleFile, actions: expanded }],
    dataRegistry,
  });
});
```

**3. Test Entity Patterns**

Common entity structures repeated across files:

```javascript
// Basic actor-target setup
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
```

**4. Event Dispatch and Assertion Patterns**

```javascript
await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
  eventName: 'core:attempt_action',
  actorId: 'actor1',
  actionId: 'mod:specific_action',
  targetId: 'target1',
  originalInput: 'action_name target1',
});

// Standard assertions
const successEvent = testEnv.events.find(
  (e) => e.eventType === 'core:display_successful_action_result'
);
expect(successEvent).toBeDefined();

const perceptibleEvent = testEnv.events.find(
  (e) => e.eventType === 'core:perceptible_event'
);
expect(perceptibleEvent).toBeDefined();

const turnEndedEvent = testEnv.events.find(
  (e) => e.eventType === 'core:turn_ended'
);
expect(turnEndedEvent).toBeDefined();
```

### Category-Specific Patterns

#### Positioning Tests

**Special Requirements:**
- Often need `positioning:closeness` components
- May add components during execution (`ADD_COMPONENT` handler)
- Test positioning state changes

```javascript
// Closeness setup pattern
'positioning:closeness': { partners: ['target1'] },

// Component addition verification
const actor = testEnv.entityManager.getEntityInstance('test:actor1');
expect(actor.components['positioning:kneeling_before']).toBeDefined();
```

#### Intimacy Tests

**Special Requirements:**
- Almost always need `positioning:closeness` components
- Largest category with 25 test files
- Most consistent patterns due to volume

#### Sex/Violence Tests

**Special Requirements:**
- May need anatomy components for complex actions
- Often test failure scenarios for missing prerequisites

```javascript
// Anatomy setup example
'anatomy:body': {
  body: { root: 'torso1' },
},
```

#### Exercise Tests

**Special Requirements:**
- Smallest category (2 files)
- Simple patterns focused on basic action execution

### Test Infrastructure Dependencies

**Current Dependencies:**
- `createRuleTestEnvironment` from `tests/common/engine/systemLogicTestEnv.js`
- Multiple operation handlers imported individually
- Constants from `src/constants/`
- Utility functions like `expandMacros`

**Infrastructure Analysis:**

The existing `systemLogicTestEnv.js` provides good foundational infrastructure but is generic. Mod tests need specialized utilities that understand:
- Common mod component patterns
- Standard entity relationship setups
- Mod-specific assertion patterns
- Event flow validation for mod actions

## Architectural Problems

### 1. Code Duplication Scale

**Current Impact:**
- **1,920+ duplicated lines** across 48 files
- **Handler creation**: 30 lines × 48 = 1,440 lines
- **Setup patterns**: 10 lines × 48 = 480 lines
- **Additional duplication** in imports, constants, utilities

**Maintenance Burden:**
- Changes to handler creation require updating 48+ files
- New operation handlers need to be added to every file manually
- Inconsistencies creep in due to copy-paste errors
- Testing new infrastructure changes requires extensive manual updates

### 2. Inconsistent Test Patterns

**Handler Variations:**
```javascript
// Some files include ADD_COMPONENT
ADD_COMPONENT: new AddComponentHandler({
  entityManager,
  logger,
  safeEventDispatcher: safeDispatcher,
}),

// Some files include different handlers
SET_VARIABLE: new SetVariableHandler({ logger }),

// Order and naming inconsistencies
DISPATCH_PERCEPTIBLE_EVENT vs. DISPATCH_EVENT ordering
```

**Entity Setup Variations:**
```javascript
// Some files use simple IDs
id: 'actor1'

// Others use namespaced IDs  
id: 'test:actor1'

// Production-style IDs in some tests
id: 'p_erotica:iker_aguirre_instance'
```

### 3. Missing Specialized Utilities

**Common Scenarios Lacking Utilities:**
- Setting up actor-target relationships with closeness
- Creating multi-actor scenarios with observers
- Setting up anatomy structures for body-related actions
- Validating event sequences for action-rule flows
- Testing failure scenarios with missing prerequisites

**Result:** Every test file reimplements these scenarios differently.

### 4. Scalability Concerns

**Current Growth Pattern:**
- 48 files across 5 categories = ~10 files per category
- Each new mod category will likely need 8-15 test files
- Each new action/rule needs its own integration test

**Projected Scale Issues:**
- **100 mod categories** = 1,000+ test files
- **5,000+ duplicated files** with current patterns
- **150,000+ lines of duplicated code**
- **Maintenance nightmare** for core system changes

### 5. Test Brittleness

**Current Fragility Points:**
- Direct imports of operation handlers make tests brittle to refactoring
- Hardcoded event type strings throughout tests
- Complex setup requirements that break easily
- No abstraction layer for common mod test operations

## Architectural Solutions

### 1. Mod-Specific Base Classes

**ModActionTestBase**
```javascript
class ModActionTestBase {
  constructor(modId, actionId, ruleFile, conditionFile) {
    this.modId = modId;
    this.actionId = actionId;
    this.ruleFile = ruleFile;
    this.conditionFile = conditionFile;
  }

  setupTestEnvironment() {
    // Standardized test environment setup
    // Handles macro expansion, data registry, handlers
  }

  createStandardActorTarget(names = ['Alice', 'Bob']) {
    // Creates standard actor-target setup
  }

  async executeAction(actorId, targetId, options = {}) {
    // Standardized action execution
  }

  assertActionSuccess(expectedMessage) {
    // Standard success assertions
  }

  assertPerceptibleEvent(expectedEvent) {
    // Standard perceptible event assertions
  }
}
```

**ModRuleTestBase**
```javascript
class ModRuleTestBase extends ModActionTestBase {
  // Specialized for rule testing scenarios
  // Includes rule-specific setup and assertions
}
```

### 2. Specialized Test Utilities

**ModEntityBuilder (Fluent API)**
```javascript
const actor = new ModEntityBuilder('actor1')
  .withName('Alice')
  .atLocation('room1')
  .closeToEntity('target1')
  .withComponent('custom:component', { value: 'test' })
  .build();
```

**ModTestHandlerFactory**
```javascript
class ModTestHandlerFactory {
  static createStandardHandlers(entityManager, eventBus, logger) {
    // Centralized handler creation with all standard handlers
    // Configurable based on test requirements
  }

  static createHandlersWithAddComponent(entityManager, eventBus, logger) {
    // Variant for tests that need ADD_COMPONENT
  }
}
```

**ModAssertionHelpers**
```javascript
class ModAssertionHelpers {
  static assertActionWorkflow(events, expectedFlow) {
    // Validates complete action execution workflow
  }

  static assertComponentAdded(entityManager, entityId, componentId, expectedData) {
    // Validates component addition for positioning actions
  }

  static assertEventSequence(events, expectedSequence) {
    // Validates event ordering and content
  }
}
```

### 3. Test Environment Factory

**ModTestFixture**
```javascript
class ModTestFixture {
  static forAction(modId, actionId, options = {}) {
    return new ModActionTestFixture(modId, actionId, options);
  }

  static forRule(modId, ruleId, options = {}) {
    return new ModRuleTestFixture(modId, ruleId, options);
  }

  static forCategory(categoryName, options = {}) {
    return new ModCategoryTestFixture(categoryName, options);
  }
}
```

## Implementation Plan

### Phase 1: Infrastructure Creation (Week 1)

**Day 1-2: Base Infrastructure**
1. Create `tests/common/mods/` directory structure
2. Implement `ModTestHandlerFactory` with standard handler creation
3. Create `ModEntityBuilder` with fluent API for entity creation
4. Implement `ModAssertionHelpers` with common assertion patterns

**Day 3-4: Base Classes**
1. Implement `ModActionTestBase` class with standard action test patterns
2. Implement `ModRuleTestBase` class extending action base for rule testing
3. Create `ModTestFixture` factory for easy test environment creation

**Day 5: Integration and Testing**
1. Create comprehensive unit tests for new infrastructure
2. Create example usage documentation
3. Test infrastructure with sample mod test conversion

### Phase 2: Migration Strategy (Week 2-3)

**Migration Approach: By Category**

**Week 2 - Exercise & Violence (6 files):**
- Smallest categories, good for validating migration pattern
- Exercise: 2 files (show_off_biceps_action, rules/showOffBicepsRule)
- Violence: 4 files (slap_action, sucker_punch_action, 2 rule files)

**Week 3 - Positioning (8 files):**
- Medium complexity with special positioning component requirements
- Good test case for handling ADD_COMPONENT variations

**Week 4 - Sex (9 files):**
- Contains anatomy component complexity
- Tests infrastructure's flexibility with different entity setups

**Week 5 - Intimacy (25 files):**
- Largest category - validates infrastructure can handle scale
- Most consistent patterns - should be straightforward once pattern is established

### Phase 3: Documentation and Patterns (Week 6)

**Documentation Creation:**
1. Migration guide for converting existing mod tests
2. Best practices guide for new mod test development  
3. Architecture decision records documenting the new patterns
4. Examples and templates for common mod test scenarios

**Pattern Establishment:**
1. Create templates for new mod test development
2. Establish coding standards for mod tests
3. Create validation tools to ensure consistency
4. Update development workflow documentation

### Phase 4: Optimization and Enhancement (Week 7-8)

**Performance Optimization:**
1. Optimize test execution speed with shared setup
2. Implement test result caching where appropriate
3. Add parallel execution support for independent tests

**Advanced Features:**
1. Add support for complex multi-actor scenarios
2. Implement specialized assertions for mod-specific patterns
3. Create debugging utilities for mod test development
4. Add integration with mod development tools

## Expected Benefits

### Quantitative Improvements

**Code Reduction:**
- **70-80% reduction** in duplicated code
- **From 1,920+ lines to ~400 lines** of unique code
- **Estimated savings: 1,520+ lines** of maintenance burden

**Development Speed:**
- **New mod tests:** 15 minutes instead of 45 minutes
- **Maintenance updates:** Single location instead of 48+ files
- **Debugging:** Centralized utilities instead of scattered code

**Test Reliability:**
- **Consistent patterns** across all mod categories
- **Standardized assertions** reduce false positives/negatives
- **Centralized maintenance** reduces inconsistencies

### Qualitative Improvements

**Developer Experience:**
- Easier onboarding for new team members
- Clear patterns to follow for new mod development
- Less cognitive load when writing tests
- Better error messages and debugging support

**Maintainability:**
- Single source of truth for mod test patterns
- Easier to update when core systems change
- Better test organization and discoverability
- Reduced risk of copy-paste errors

**Scalability:**
- Architecture supports thousands of mod tests
- New mod categories easy to add
- Consistent quality across all mod tests
- Framework supports future enhancements

## Migration Strategy Details

### File-by-File Migration Process

**Step 1: Identify Conversion Patterns**
```javascript
// Before (example from kiss_cheek_action.test.js)
function createHandlers(entityManager, eventBus, logger) {
  // 30+ lines of handler creation
}

describe('intimacy:kiss_cheek action integration', () => {
  let testEnv;
  
  beforeEach(() => {
    // 20+ lines of setup
  });

  it('successfully executes kiss cheek action between close actors', async () => {
    testEnv.reset([/* complex entity setup */]);
    await testEnv.eventBus.dispatch(/* complex dispatch */);
    // Manual assertions
  });
});

// After (using new infrastructure)
class KissCheekActionTest extends ModActionTestBase {
  constructor() {
    super('intimacy', 'kiss_cheek', kissCheekRule, eventIsActionKissCheek);
  }
}

describe('intimacy:kiss_cheek action integration', () => {
  let testEnv;

  beforeEach(() => {
    testEnv = ModTestFixture.forAction('intimacy', 'kiss_cheek');
  });

  it('successfully executes kiss cheek action between close actors', async () => {
    const { actor, target } = testEnv.createCloseActors(['Alice', 'Bob']);
    await testEnv.executeAction(actor.id, target.id);
    testEnv.assertActionSuccess("Alice leans in to kiss Bob's cheek softly.");
  });
});
```

**Step 2: Validate Conversions**
- Run existing tests to capture baseline behavior
- Convert to new infrastructure
- Validate identical behavior with new implementation
- Compare test execution performance

**Step 3: Update Documentation**
- Update each converted file with usage examples
- Document any category-specific patterns discovered
- Create migration notes for complex cases

### Risk Mitigation

**Identified Risks:**

1. **Behavior Changes During Migration**
   - **Mitigation:** Comprehensive before/after test comparison
   - **Plan:** Run both old and new tests in parallel during migration

2. **Infrastructure Bugs Affecting Multiple Tests**
   - **Mitigation:** Thorough testing of base infrastructure
   - **Plan:** Staged rollout starting with smallest categories

3. **Performance Regression**
   - **Mitigation:** Performance benchmarks before/after migration
   - **Plan:** Optimize shared setup for better performance

4. **Team Adoption Resistance**
   - **Mitigation:** Clear documentation and training
   - **Plan:** Start with simple examples and provide migration support

### Success Metrics

**Migration Success Criteria:**
- [ ] All existing tests pass with new infrastructure
- [ ] Code duplication reduced by >70%
- [ ] Test development time reduced by >60%
- [ ] Zero test behavior regressions
- [ ] Documentation complete and validated

**Performance Targets:**
- Test execution time: No more than 10% slower
- Memory usage: No more than 20% increase
- Setup time: 50% faster for new test creation

## Long-term Vision

### Scalability Planning

**Projected Growth Handling:**
- Architecture supports 1,000+ mod categories
- Infrastructure can handle 10,000+ individual test files
- Patterns established for community mod testing
- Framework extensible for specialized mod types

**Future Enhancements:**
1. **Auto-generation** of basic mod tests from mod definitions
2. **Visual test builders** for complex scenarios
3. **Integration with mod development tools**
4. **Performance optimization** for large test suites
5. **Parallel execution** framework for faster CI/CD

### Community Impact

**Mod Developer Benefits:**
- Easy testing framework for community mods
- Clear patterns and examples to follow
- Reduced barrier to entry for mod testing
- Better quality assurance for community content

**Maintainer Benefits:**
- Consistent quality across all mod tests
- Easy to review and approve community contributions
- Automated validation of mod test quality
- Reduced maintenance overhead for test infrastructure

## Conclusion

The mod integration test architecture analysis reveals a critical need for infrastructure improvements to handle the project's growth trajectory. The current duplication of 1,920+ lines across 48 files represents a significant maintenance burden that will become unmanageable as the project scales to potentially thousands of mod test suites.

The proposed solution provides:

1. **Immediate relief** through 70-80% code reduction
2. **Long-term scalability** supporting thousands of mod tests
3. **Improved developer experience** with consistent patterns
4. **Better maintainability** through centralized infrastructure
5. **Future-proofing** for community mod development

Implementation should proceed in phases with careful validation at each step. The expected outcome is a test infrastructure that:

- **Scales efficiently** with project growth
- **Reduces maintenance burden** by 80%+  
- **Improves test quality** through standardization
- **Supports rapid mod development** with consistent patterns

By implementing these architectural improvements, the Living Narrative Engine will have a robust, scalable foundation for mod testing that can grow with the project's ambitious goals.