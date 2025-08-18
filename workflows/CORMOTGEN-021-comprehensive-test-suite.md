# CORMOTGEN-021: Create Comprehensive Test Suite

## Ticket ID

CORMOTGEN-021

## Title

Implement complete test coverage for Core Motivations Generator

## Status

TODO

## Priority

HIGH

## Estimated Effort

6-8 hours

## Dependencies

- All implementation tickets (CORMOTGEN-001 to CORMOTGEN-020)

## Description

Create comprehensive unit, integration, and E2E tests for all Core Motivations functionality to ensure quality and prevent regressions.

## Technical Requirements

### 1. Unit Tests Structure

```
tests/unit/
├── characterBuilder/
│   ├── models/
│   │   └── coreMotivation.test.js
│   ├── prompts/
│   │   └── coreMotivationsGenerationPrompt.test.js
│   ├── services/
│   │   ├── CoreMotivationsGenerator.test.js
│   │   └── characterBuilderService.motivations.test.js
│   ├── storage/
│   │   └── characterDatabase.motivations.test.js
│   └── cache/
│       └── coreMotivationsCacheManager.test.js
└── coreMotivationsGenerator/
    ├── controllers/
    │   └── CoreMotivationsGeneratorController.test.js
    └── services/
        └── CoreMotivationsDisplayEnhancer.test.js
```

### 2. Integration Tests

```
tests/integration/
├── characterBuilder/
│   ├── coreMotivationsDatabase.test.js
│   ├── coreMotivationsService.test.js
│   └── coreMotivationsEventFlow.test.js
└── coreMotivationsGenerator/
    ├── bootstrap.test.js
    ├── generation.test.js
    └── uiIntegration.test.js
```

### 3. E2E Tests

```javascript
// tests/e2e/coreMotivationsGenerator.e2e.test.js
describe('Core Motivations Generator E2E', () => {
  it('should complete full generation workflow', async () => {
    // 1. Navigate to page
    // 2. Select direction
    // 3. Generate motivations
    // 4. Verify display
    // 5. Test interactions
  });

  it('should handle accumulative storage', async () => {
    // Generate multiple sets
    // Verify accumulation
    // Test persistence
  });

  it('should export and delete correctly', async () => {
    // Test export
    // Test individual delete
    // Test clear all
  });
});
```

### 4. Test Coverage Requirements

- Unit: 80% branches, 90% lines
- Integration: All critical paths
- E2E: User workflows

### 5. Mock Strategies

```javascript
// Mock LLM service
const mockLLMService = {
  generateCompletion: jest.fn().mockResolvedValue({
    motivations: [
      {
        coreMotivation: 'Test motivation',
        contradiction: 'Test contradiction',
        centralQuestion: 'Test question?',
      },
    ],
  }),
};

// Mock database
const mockDatabase = {
  saveCoreMotivation: jest.fn().mockResolvedValue({ id: 'test-id' }),
  getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
};
```

## Test Categories

### Unit Tests (30+ test files)

1. **Model Tests**
   - Validation logic
   - Factory methods
   - Data transformation

2. **Service Tests**
   - Generation logic
   - Error handling
   - Retry mechanism

3. **Database Tests**
   - CRUD operations
   - Index queries
   - Transactions

4. **UI Tests**
   - Component rendering
   - Event handling
   - State management

### Integration Tests (10+ test files)

1. **Database Integration**
   - Migration testing
   - Data persistence
   - Query performance

2. **Service Integration**
   - End-to-end generation
   - Event dispatching
   - Cache behavior

3. **UI Integration**
   - Controller initialization
   - Service coordination
   - Event flow

### E2E Tests (5+ scenarios)

1. Navigation and initialization
2. Generation workflow
3. Accumulative behavior
4. Export functionality
5. Error recovery

## Implementation Steps

1. Set up test structure
2. Create test utilities
3. Write unit tests
4. Write integration tests
5. Write E2E tests
6. Achieve coverage targets
7. Add CI integration

## Validation Criteria

- [ ] 80% branch coverage
- [ ] 90% line coverage
- [ ] All critical paths tested
- [ ] E2E scenarios pass
- [ ] Tests run in CI
- [ ] <30 second test suite

## Checklist

- [ ] Create test structure
- [ ] Write model tests
- [ ] Write service tests
- [ ] Write database tests
- [ ] Write UI tests
- [ ] Create integration tests
- [ ] Create E2E tests
- [ ] Verify coverage
