# Multi-Target Action Test Enhancement Specification

## 1. Executive Summary

This specification outlines the requirements and implementation guidelines for enhancing the end-to-end (e2e) test coverage of the multi-target action system in the Living Narrative Engine. While the core formatting bug has been fixed at the `MultiTargetActionFormatter` level, there is a critical gap in e2e test coverage that validates the complete action discovery → formatting → availability pipeline for scenarios where a single target scope resolves to multiple entities.

## 2. Problem Statement

### 2.1 Current Issue

The system lacks comprehensive e2e tests for the scenario where:

- An action definition has a single target scope (e.g., `intimacy:close_actors_facing_each_other_with_torso_clothing`)
- That scope resolves to multiple valid entities at runtime
- The system should generate separate action instances for each valid target combination
- All generated actions should be discoverable and available through the complete pipeline

### 2.2 Existing Test Coverage Gap

While the codebase contains several multi-target e2e tests (`multiTargetExecution.e2e.test.js`, `multiTargetFullPipeline.e2e.test.js`, and `pipeline/MultiTargetDecomposition.e2e.test.js`), none specifically validate the scenario where a single target scope resolves to multiple entities without the `generateCombinations` flag. These existing tests focus on execution and decomposition but don't comprehensively test the discovery and availability pipeline for this specific use case.

### 2.3 Example Scenario

Consider the `adjust_clothing` action:

```json
{
  "targets": {
    "primary": {
      "scope": "intimacy:close_actors_facing_each_other_with_torso_clothing",
      "placeholder": "primary"
    },
    "secondary": {
      "scope": "clothing:target_topmost_torso_upper_clothing",
      "placeholder": "secondary",
      "contextFrom": "primary"
    }
  },
  "template": "adjust {primary}'s {secondary}"
}
```

Given:

- Actor A is in closeness with actors B and C
- Actor B has a "denim jacket"
- Actor C has a "T-shirt"

Expected Available Actions:

1. "adjust B's denim jacket"
2. "adjust C's T-shirt"

Currently, no e2e test validates this complete scenario through the actual pipeline.

## 3. Requirements

### 3.1 Functional Requirements

#### 3.1.1 New E2E Test Suite

- **ID**: REQ-001
- **Description**: Create a comprehensive e2e test suite that validates the complete multi-target action pipeline
- **Location**: `tests/e2e/actions/multiTargetDiscoveryPipeline.e2e.test.js`
- **Rationale**: Named to distinguish from `multiTargetFullPipeline.e2e.test.js` which focuses on execution, while this focuses specifically on discovery and availability for single-target-multiple-entity scenarios
- **Scope**: Must test real action definitions through the actual discovery → validation → formatting → availability pipeline

#### 3.1.2 Enhanced Existing Test Suite

- **ID**: REQ-002
- **Description**: Create additional test cases in `singleTargetMultipleEntities.e2e.test.js` that use real action definitions instead of mocked discovery results
- **Current State**: The existing file uses mock data to simulate discovery results
- **Enhancement**: Add new test cases that exercise the complete pipeline with real action definitions from mod files
- **Scope**: Supplement existing mock-based tests with true e2e tests using actual action definitions

#### 3.1.3 Test Matrix Coverage

- **ID**: REQ-003
- **Description**: Ensure comprehensive test coverage for all target resolution combinations
- **Matrix**:
  - Single target scope → Multiple entities
  - Multiple target scopes → Single entity each
  - Multiple target scopes → Multiple entities each (cartesian product)
  - Optional targets with multiple entities
  - Context-dependent targets with multiple primary entities

### 3.2 Technical Requirements

#### 3.2.1 Pipeline Validation

- **ID**: REQ-004
- **Description**: Tests must validate the complete pipeline flow:
  1. Action Discovery: Resolves scopes to find valid targets
  2. Target Resolution: Determines which entities match scope criteria
  3. Action Formatting: Generates action instances for each target combination
  4. Availability Check: Validates prerequisites for each generated action

#### 3.2.2 Real Data Testing

- **ID**: REQ-005
- **Description**: Tests must use:
  - Real action definitions from mod files
  - Actual entity data with proper component structures
  - Real scope resolution through the DSL system
  - Actual prerequisite validation

#### 3.2.3 Performance Boundaries

- **ID**: REQ-006
- **Description**: Tests must validate performance boundaries
  - Handle reasonable limits (e.g., 20-50 generated actions)
  - Verify system behavior with large target sets
  - Ensure graceful handling of edge cases

## 4. Implementation Guidelines

### 4.1 Test Structure

#### 4.1.1 New Test File Structure

```javascript
describe('Multi-Target Discovery Pipeline E2E', () => {
  describe('Single Target Multiple Entities', () => {
    // Test cases for single target resolving to multiple entities
  });

  describe('Context-Dependent Multi-Target', () => {
    // Test cases for contextFrom scenarios
  });

  describe('Cartesian Product Generation', () => {
    // Test cases for multiple targets with multiple entities
  });

  describe('Real Action Definitions', () => {
    // Tests using actual mod action files
  });
});
```

#### 4.1.2 Test Data Setup Pattern

```javascript
// Use EntityManagerTestBed for consistent entity creation
const setupTestScenario = async (entityTestBed) => {
  // Create actors with proper positioning components
  // Create items with proper component data
  // Create locations with actor lists
  // Return entity references for assertions
};
```

### 4.2 Key Test Scenarios

#### 4.2.1 Adjust Clothing Scenario

- Setup multiple actors in closeness
- Each actor has different clothing items
- Validate all combinations are discoverable
- Verify each action can be executed

#### 4.2.2 Multi-Partner Actions

- Setup scenarios with multiple valid primary targets
- Test actions like `nibble_earlobe_playfully`
- Ensure all partner combinations generate actions

#### 4.2.3 Inventory-Based Actions

- Test with multiple items in inventory
- Validate actions generate for each item
- Test both simple and context-dependent cases

### 4.3 Integration Points

#### 4.3.1 Action Service Integration

- Use real `ActionServiceFacade` when possible
- Only mock external dependencies (LLM, file system)
- Validate through actual service methods

#### 4.3.2 Entity System Integration

- Use `EntityManagerTestBed` for entity creation
- Ensure proper component registration
- Validate entity relationships

### 4.4 Assertion Patterns

#### 4.4.1 Action Discovery Assertions

```javascript
// Verify correct number of actions
expect(availableActions).toHaveLength(expectedCount);

// Verify each expected action exists
expectedActions.forEach((expected) => {
  expect(availableActions).toContainEqual(
    expect.objectContaining({
      actionId: expected.actionId,
      command: expected.command,
      targets: expect.objectContaining(expected.targets),
    })
  );
});
```

#### 4.4.2 Pipeline Validation Assertions

- Verify scope resolution results
- Check formatter output
- Validate availability checks
- Ensure proper error handling

## 5. Test Implementation Priorities

### 5.1 Phase 1: Critical Gap Coverage

1. Create `multiTargetDiscoveryPipeline.e2e.test.js`
2. Implement adjust_clothing scenario test
3. Add basic single-target-multiple-entities cases

### 5.2 Phase 2: Comprehensive Coverage

1. Enhance existing test suites
2. Add complex cartesian product scenarios
3. Implement edge case handling

### 5.3 Phase 3: Performance and Limits

1. Add performance boundary tests
2. Implement large dataset scenarios
3. Add stress testing for action generation

## 6. Acceptance Criteria

### 6.1 Test Coverage Metrics

- All identified test scenarios implemented
- 100% coverage of multi-target action formatter paths
- 90%+ coverage of action discovery pipeline
- All edge cases documented and tested

### 6.2 Test Quality Criteria

- Tests use real action definitions
- No mock-based discovery in e2e tests
- Clear test descriptions and assertions
- Consistent use of test utilities

### 6.3 Documentation Requirements

- Test files include comprehensive JSDoc headers
- Each test case documents its scenario
- Failure messages provide clear debugging info
- Test patterns documented for future use

## 7. Technical Considerations

### 7.1 Test Performance

- E2E tests should complete within reasonable time (< 2s per test)
- Use focused entity creation (only required components)
- Consider parallel test execution where possible

### 7.2 Test Maintenance

- Tests should be resilient to schema changes
- Use data builders for complex entity setups
- Maintain clear separation between test data and assertions

### 7.3 Debugging Support

- Include debug output for action discovery
- Log intermediate pipeline states on failure
- Provide clear reproduction steps

## 8. Future Considerations

### 8.1 Automated Test Generation

- Consider generating tests from action definitions
- Automate coverage verification for new actions
- Build test matrices from mod configurations

### 8.2 Integration with CI/CD

- Ensure tests run in CI pipeline
- Add performance benchmarks
- Monitor test flakiness

## 9. Conclusion

This specification provides a comprehensive plan for enhancing the multi-target action test coverage. By implementing these requirements, the Living Narrative Engine will have robust validation of its multi-target action system, ensuring that complex action scenarios work correctly from discovery through execution.

The implementation should focus on creating real, end-to-end tests that validate the complete pipeline without relying on mocks, ensuring that the system behaves correctly in production scenarios.
