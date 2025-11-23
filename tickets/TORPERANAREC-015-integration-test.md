# TORPERANAREC-015: Create Tortoise Person Integration Test

## Objective
Create comprehensive integration test to verify complete anatomy generation and formatting.

## Dependencies
- **REQUIRES**: TORPERANAREC-001 through TORPERANAREC-014 (all implementation complete)

## Files to Touch
- **CREATE**: `tests/integration/anatomy/tortoisePerson.integration.test.js`

## Out of Scope
- Do NOT modify existing test files
- Do NOT modify test utilities or helpers
- Do NOT create unit tests (only integration test)
- Do NOT test individual entity files in isolation

## Implementation Details

### File: `tortoisePerson.integration.test.js`

Create integration test with:

1. **Test Setup**:
   - Use `AnatomyIntegrationTestBed` from test utilities
   - Setup in `beforeEach`, cleanup in `afterEach`

2. **Test Suites** (2 describe blocks):

**Suite 1: "Complete Anatomy Generation"**

Test 1: "should generate complete tortoise anatomy with all required parts"
- Generate anatomy using `anatomy:tortoise_person` recipe and blueprint
- Verify root entity exists and is torso
- Verify 16 total body parts:
  - 1 torso + 2 shell + 1 head + 1 beak + 2 eyes + 2 arms + 2 hands + 2 legs + 2 feet + 1 tail
- Verify all parts present in partsMap:
  - Shell: carapace, plastron
  - Head: head, beak, left_eye, right_eye
  - Arms: left_arm, right_arm
  - Hands: left_hand, right_hand
  - Legs: left_leg, right_leg
  - Feet: left_foot, right_foot
  - Tail: tail

Test 2: "should have correct body descriptors"
- Verify height: "short"
- Verify build: "stocky"
- Verify composition: "average"
- Verify hairDensity: "hairless"
- Verify skinColor: "olive-green"
- Verify smell: "earthy"

Test 3: "should have shell parts with correct descriptors"
- Verify carapace texture: "scaled"
- Verify carapace shape: "domed"
- Verify plastron texture: "smooth"
- Verify plastron shape: "flat"

Test 4: "should have clawed hands and feet"
- Verify left_hand projection: "clawed"
- Verify left_hand digit_count: 3
- Verify right_hand projection: "clawed"
- Verify right_hand digit_count: 3
- Verify left_foot projection: "clawed"
- Verify left_foot digit_count: 3
- Verify right_foot projection: "clawed"
- Verify right_foot digit_count: 3

Test 5: "should have beak properly attached to head"
- Verify head exists
- Verify beak exists
- Verify beak texture: "ridged"
- Verify beak shape: "hooked"

**Suite 2: "Formatting Output"**

Test 6: "should include shell, beak, and claw mentions in description"
- Generate anatomy
- Format description using testBed formatter
- Verify description includes (case-insensitive):
  - "carapace" or "shell"
  - "beak"
  - "claw"
  - "amber" and "eye"

## Acceptance Criteria

### Tests that must pass:
1. All 6 tests pass successfully
2. `npm run test:integration` - Integration test suite passes
3. Test coverage includes:
   - Anatomy graph generation
   - Body descriptors
   - Part descriptors
   - Formatting output

### Invariants that must remain true:
1. No existing tests are modified
2. Test uses AnatomyIntegrationTestBed helper
3. Test setup/cleanup follows project patterns
4. All assertions use Jest matchers
5. Test naming follows project conventions
6. Expected part count is exactly 16
7. All part names match recipe expectations
8. All descriptor values match recipe specification

## Test Execution Commands
```bash
npm run test:integration -- tortoisePerson.integration.test.js
npm run test:integration  # Run all integration tests
```

## Definition of Done
- [ ] Test file created in correct location
- [ ] All 6 tests implemented
- [ ] Test uses proper setup/cleanup
- [ ] All assertions verify correct values
- [ ] Tests pass locally
- [ ] No existing tests broken
- [ ] File follows project test patterns
- [ ] File committed with descriptive message
