# GOADISANA-024: Verify Player Type Routing Still Works

## Context

The `core:player_type` component routes actors to different decision providers (human, llm, goap). After replacing `GoapDecisionProvider` with a stub, we must verify that all three player types still route correctly and that the GOAP stub works as expected.

**Fatal Flaw Context**: While GOAP services are removed, the routing mechanism to the decision provider must continue working. The stub should handle GOAP actors gracefully.

## Objective

Create and run integration tests verifying that player type routing works for all three provider types: human, llm, and goap (stub).

## Files Affected

**Test file to CREATE**:
- `tests/integration/turns/playerTypeRouting.integration.test.js`

**Components tested**:
- `core:player_type` component
- Decision provider routing (registerActorAwareStrategy.js)
- GoapDecisionProvider stub
- Human and LLM providers (should be unchanged)

## Detailed Steps

1. **Create integration test file**:
   ```bash
   touch tests/integration/turns/playerTypeRouting.integration.test.js
   ```

2. **Implement test cases**:
   - Test human player type routing
   - Test llm player type routing
   - Test goap player type routing (stub)
   - Test fallback behavior (no player_type component)

3. **Test structure** (example):
   ```javascript
   describe('Player Type Routing Integration', () => {
     it('should route human actors to HumanDecisionProvider', async () => {
       // Create actor with core:player_type { type: 'human' }
       // Trigger decision
       // Verify HumanDecisionProvider was invoked
     });

     it('should route llm actors to LLMDecisionProvider', async () => {
       // Create actor with core:player_type { type: 'llm' }
       // Trigger decision
       // Verify LLMDecisionProvider was invoked
     });

     it('should route goap actors to GoapDecisionProvider stub', async () => {
       // Create actor with core:player_type { type: 'goap' }
       // Trigger decision with available actions
       // Verify stub selects first action
       // Verify no GOAP service errors
     });

     it('should handle goap actors with no actions gracefully', async () => {
       // Create actor with core:player_type { type: 'goap' }
       // Trigger decision with empty action list
       // Verify stub returns null index
       // Verify no errors thrown
     });

     it('should fallback to default provider when player_type missing', async () => {
       // Create actor without core:player_type component
       // Trigger decision
       // Verify fallback behavior (likely human or llm)
     });
   });
   ```

4. **Run the new test**:
   ```bash
   npm run test:integration -- --testPathPattern="playerTypeRouting"
   ```

5. **Verify all routing tests pass**

6. **Document test results**:
   - Save test output
   - Confirm all routing scenarios work

## Acceptance Criteria

- [ ] Integration test file created: `tests/integration/turns/playerTypeRouting.integration.test.js`
- [ ] Test covers human player type routing
- [ ] Test covers llm player type routing
- [ ] Test covers goap player type routing with actions
- [ ] Test covers goap player type routing without actions
- [ ] Test covers fallback behavior
- [ ] All routing tests pass
- [ ] GOAP stub selects first action as expected
- [ ] GOAP stub returns null for empty action list
- [ ] No GOAP service resolution errors occur
- [ ] Test output saved to `tickets/player-type-routing-test-output.txt`

## Dependencies

**Requires**:
- GOADISANA-023 (all tests pass)
- GOADISANA-008 (GoapDecisionProvider stub implemented)

**Blocks**:
- GOADISANA-025 (application startup verification)

## Verification Commands

```bash
# Create test file location
mkdir -p tests/integration/turns/

# Run the specific test
npm run test:integration -- --testPathPattern="playerTypeRouting" 2>&1 | tee tickets/player-type-routing-test-output.txt

# Verify test ran
grep "Player Type Routing" tickets/player-type-routing-test-output.txt

# Check test results
grep "passing\|failing" tickets/player-type-routing-test-output.txt

# Run full integration suite to ensure no breakage
npm run test:integration
```

## Expected Test Behavior

**Human Player Type**:
- Routes to HumanDecisionProvider
- UI prompts for player decision (in real scenario)
- No GOAP code involved

**LLM Player Type**:
- Routes to LLMDecisionProvider
- Uses AI for decision making
- No GOAP code involved

**GOAP Player Type**:
- Routes to GoapDecisionProvider (stub)
- Stub selects first action if actions available
- Stub returns null if no actions
- Logs selection decision
- No errors thrown
- No GOAP service dependencies

**Fallback Behavior**:
- Uses default provider (human or llm, based on config)
- Graceful degradation if player_type not set

## Test Implementation Guide

**Key Test Utilities Needed**:
- Create test actors with player_type component
- Mock available actions list
- Trigger turn decision process
- Capture decision provider invocation
- Verify provider selection

**Test Setup**:
```javascript
let container, entityManager, turnManager;

beforeEach(() => {
  container = createContainer();
  entityManager = container.resolve('IEntityManager');
  turnManager = container.resolve('ITurnManager');
});
```

**Actor Creation**:
```javascript
const actor = entityManager.createEntity('test_actor');
entityManager.addComponent(actor.id, 'core:player_type', { type: 'goap' });
```

## If Tests Fail

**Common Issues**:
1. **Routing not working**: Check registerActorAwareStrategy.js configuration
2. **Stub not found**: Verify GoapDecisionProvider registration in aiRegistrations.js
3. **DI resolution error**: Check container configuration
4. **Player type component not found**: Verify component schema and loader

**Resolution Steps**:
1. Identify which routing scenario fails
2. Check relevant provider registration
3. Verify player_type component data
4. Fix routing configuration
5. Re-run tests
6. Document fix

## Notes

- This test verifies the preserved entry points work correctly
- GOAP stub should handle actors gracefully (no crashes)
- Routing mechanism is preserved for future task-based implementation
- Test should be kept for ongoing validation
- Future task-based provider can replace stub without changing routing
