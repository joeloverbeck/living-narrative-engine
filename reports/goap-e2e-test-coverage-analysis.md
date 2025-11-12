# GOAP System E2E Test Coverage Analysis

**Report Date:** 2025-11-12
**Analyst:** Claude (Automated Analysis)
**Status:** Complete

## Executive Summary

This report analyzes the Goal-Oriented Action Planning (GOAP) system within the Living Narrative Engine to identify workflows, assess existing test coverage, and recommend prioritized e2e (end-to-end) tests to ensure system reliability.

### Key Findings

1. **Current E2E Coverage:** 0% - No dedicated GOAP e2e tests exist in `tests/e2e/`
2. **Existing Coverage:** Basic integration test (`goapWorkflow.integration.test.js`) and minimal unit tests
3. **Critical Gap:** Complete lack of e2e tests for a complex, newly implemented system
4. **Recommendation:** Implement 12 prioritized e2e tests covering 7 major workflows

## GOAP System Architecture Overview

The GOAP system is organized into three tiers:

### Tier 1: Effects Auto-Generation (Completed)
- **Purpose:** Automated analysis of rule operations to generate planning metadata
- **Components:**
  - EffectsAnalyzer (`src/goap/analysis/effectsAnalyzer.js`)
  - EffectsGenerator (`src/goap/generation/effectsGenerator.js`)
  - EffectsValidator (`src/goap/validation/effectsValidator.js`)

### Tier 2: Simple Action Planning (Implemented)
- **Purpose:** Basic single-action selection based on goal satisfaction
- **Components:**
  - GoalManager (`src/goap/goals/goalManager.js`)
  - GoalStateEvaluator (`src/goap/goals/goalStateEvaluator.js`)
  - ActionSelector (`src/goap/selection/actionSelector.js`)
  - SimplePlanner (`src/goap/planning/simplePlanner.js`)
  - PlanCache (`src/goap/planning/planCache.js`)
  - AbstractPreconditionSimulator (`src/goap/simulation/abstractPreconditionSimulator.js`)

### Tier 3: Multi-Step Planning (Future)
- **Status:** Not yet implemented
- **Planned Components:** Advanced planner, state simulator, plan repair

### Integration Layer
- **GoapDecisionProvider** (`src/turns/providers/goapDecisionProvider.js`)
  - Integrates GOAP with the turn system
  - Orchestrates goal selection, planning, and action execution

## Identified GOAP Workflows

### 1. Effects Generation Workflow (Tier 1)
**Description:** Automated generation of planning effects from action rule operations

**Steps:**
1. Load action and rule definitions from mod data
2. Find rule associated with action (naming convention: `{mod}:handle_{action}`)
3. Analyze rule operations to identify state-changing operations
4. Trace execution paths through conditionals (IF, IF_CO_LOCATED)
5. Generate planning effects (ADD_COMPONENT, REMOVE_COMPONENT, MODIFY_COMPONENT)
6. Identify abstract preconditions for runtime-dependent conditions
7. Validate generated effects against `planning-effects.schema.json`
8. Inject effects into action definition's `planningEffects` field

**Current Coverage:**
- ✅ Unit tests for EffectsAnalyzer operations
- ✅ Unit tests for EffectsGenerator
- ❌ No integration test for full workflow
- ❌ No e2e test

### 2. Goal Selection Workflow (Tier 2)
**Description:** Selection of the highest-priority relevant unsatisfied goal for an actor

**Steps:**
1. Get all goal definitions available to actor's mod set
2. Evaluate relevance condition (JSON Logic) for each goal
3. Filter to only relevant goals
4. Evaluate goal state (JSON Logic) for each relevant goal
5. Filter out already-satisfied goals
6. Sort unsatisfied goals by priority (descending)
7. Return highest-priority goal

**Current Coverage:**
- ✅ Unit tests for GoalManager
- ✅ Unit tests for GoalStateEvaluator
- ✅ Basic integration test in goapWorkflow.integration.test.js
- ❌ No comprehensive e2e test with real goal definitions

### 3. Action Selection Workflow (Tier 2)
**Description:** Selection of the best action to move toward a goal using greedy heuristics

**Steps:**
1. Filter available actions to those with `planningEffects`
2. For each plannable action:
   - Calculate current distance to goal using GoalStateEvaluator
   - Simulate applying action's effects to world state
   - Handle conditional effects and abstract preconditions
   - Calculate future distance to goal after effect simulation
   - Compute progress score (currentDistance - futureDistance)
3. Filter to actions with positive progress
4. Sort by progress score (descending)
5. Return action with highest progress

**Current Coverage:**
- ✅ Unit tests for ActionSelector
- ✅ Basic integration test
- ❌ No e2e test covering complex effect simulation
- ❌ No e2e test for abstract precondition evaluation

### 4. Plan Creation and Caching Workflow (Tier 2)
**Description:** Creation of single-step plans and caching for performance

**Steps:**
1. Check plan cache for actor ID
2. If cached plan exists:
   - Validate plan is still applicable
   - If invalid, invalidate cache and replan
3. If no valid cached plan:
   - Select goal using GoalManager
   - Check if goal already satisfied (skip if yes)
   - Use SimplePlanner to select action
   - Create plan object with single step
   - Cache plan for actor
4. Extract first step from plan
5. Match plan step to available action by actionId and targetId
6. Return action index

**Current Coverage:**
- ✅ Unit tests for SimplePlanner
- ✅ Unit tests for PlanCache
- ✅ Basic integration test with caching workflow
- ❌ No e2e test for cache invalidation scenarios
- ❌ No e2e test for multi-turn planning consistency

### 5. Complete GOAP Decision Workflow (Integration)
**Description:** Full end-to-end decision-making process from turn start to action execution

**Steps:**
1. Turn system invokes GoapDecisionProvider
2. GoapDecisionProvider receives actor, turnContext, and available actions
3. Build planning context (snapshot of world state from EntityManager)
4. Execute plan caching workflow (step 4 above)
5. Execute goal selection workflow (step 2 above)
6. Execute action selection workflow (step 3 above)
7. Create and cache plan
8. Find matching action in available actions array
9. Return decision with action index
10. Turn system executes selected action
11. Rule operations modify entity state
12. Components are added/removed/modified
13. Plan cache potentially invalidated based on state changes

**Current Coverage:**
- ✅ Basic integration test covering happy path
- ❌ No e2e test with real mod data
- ❌ No e2e test with real action discovery
- ❌ No e2e test with real rule execution
- ❌ No e2e test verifying state changes match planning predictions

### 6. Abstract Precondition Simulation Workflow
**Description:** Simulation of runtime-dependent conditions during planning

**Steps:**
1. Action effect contains conditional effect with abstract precondition
2. During effect simulation, ActionSelector evaluates condition
3. AbstractPreconditionSimulator receives function name and parameters
4. Simulator executes appropriate simulation function:
   - `hasInventoryCapacity`: Check weight limits in simulated state
   - `hasContainerCapacity`: Check container capacity in simulated state
   - `hasComponent`: Check component existence in simulated state
5. Simulator returns boolean result
6. ActionSelector applies appropriate effects based on result (then/else)
7. Continue with goal distance calculation

**Current Coverage:**
- ✅ Unit tests for AbstractPreconditionSimulator
- ❌ No integration test with ActionSelector
- ❌ No e2e test with conditional planning effects

### 7. Multi-Actor Concurrent GOAP Workflow
**Description:** Multiple actors making independent GOAP decisions simultaneously

**Steps:**
1. Turn system processes multiple actors
2. Each actor gets independent goal selection
3. Each actor gets independent action selection
4. Each actor has separate plan cache entry
5. Plans don't interfere with each other
6. State changes from one actor may invalidate other actors' plans

**Current Coverage:**
- ✅ Basic integration test with two actors
- ❌ No e2e test with 3+ actors
- ❌ No e2e test with competing goals
- ❌ No e2e test with cache invalidation cross-actor effects

## Existing Test Coverage Analysis

### Unit Tests
**Location:** `tests/unit/turns/providers/goapDecisionProvider.test.js`

**Coverage:**
- ✅ Basic input validation (empty actions, null actions)
- ✅ Returns first action index for non-empty array
- ❌ Does not test actual GOAP planning logic
- ❌ Mocked dependencies, no real GOAP services

**Assessment:** Minimal unit test coverage. The existing test only validates basic input/output without testing the core GOAP decision logic.

### Integration Tests
**Location:** `tests/integration/goap/goapWorkflow.integration.test.js`

**Coverage:**
- ✅ Full GOAP workflow with goal selection, action selection, and plan creation
- ✅ Plan caching across turns
- ✅ Plan invalidation on state changes
- ✅ Multiple actors with different goals
- ✅ No goal selected scenarios
- ✅ Already-satisfied goal scenarios

**Assessment:** Good integration test coverage for basic scenarios. However, tests use mocked data and don't exercise real mod content or action discovery.

### E2E Tests
**Location:** `tests/e2e/` (searched for `*goap*`)

**Coverage:**
- ❌ No GOAP-specific e2e tests found

**Assessment:** Critical gap. The GOAP system has zero e2e test coverage.

## Coverage Gaps and Risks

### Critical Gaps (High Risk)

1. **No Real Mod Integration**
   - **Risk:** GOAP planning may fail with real action definitions, rule operations, and goal definitions
   - **Impact:** System could be broken in production with real game content

2. **No Action Discovery Integration**
   - **Risk:** Planning may not work with dynamically discovered actions
   - **Impact:** Actions from action discovery may lack planning effects or have incompatible structures

3. **No Rule Execution Verification**
   - **Risk:** Planning effects may not match actual rule execution outcomes
   - **Impact:** Planner makes decisions based on incorrect predictions of action outcomes

4. **No State Change Validation**
   - **Risk:** Simulated effects during planning may differ from actual effects during execution
   - **Impact:** Actions may not achieve their intended goals, leading to poor AI behavior

5. **No Multi-Step Goal Achievement**
   - **Risk:** Goals requiring action sequences may never be achieved
   - **Impact:** AI actors unable to complete complex objectives

### High-Priority Gaps (Medium Risk)

6. **No Conditional Effect Verification**
   - **Risk:** Conditional effects with abstract preconditions may not work correctly
   - **Impact:** Planning may choose wrong actions when conditions affect outcomes

7. **No Cache Invalidation Stress Testing**
   - **Risk:** Cache may become stale, causing actors to execute invalid plans
   - **Impact:** Actions executed when preconditions no longer met

8. **No Goal Priority Conflict Resolution**
   - **Risk:** Priority system may not work as expected with real goal definitions
   - **Impact:** Actors may pursue wrong goals

### Medium-Priority Gaps (Low-Medium Risk)

9. **No Performance Testing Under Load**
   - **Risk:** GOAP planning may be too slow for real-time gameplay
   - **Impact:** Game stuttering or poor user experience

10. **No Error Recovery Testing**
    - **Risk:** System may not gracefully handle malformed goals, actions, or effects
    - **Impact:** System crashes or silent failures

11. **No Cross-Mod Goal/Action Interaction**
    - **Risk:** Actions from one mod may not work with goals from another mod
    - **Impact:** Broken AI when multiple mods are loaded

12. **No Multi-Turn Goal Pursuit**
    - **Risk:** Goals requiring multiple turns may be abandoned prematurely
    - **Impact:** Actors never complete long-term objectives

## Recommended E2E Tests (Prioritized)

### Priority 1: Critical Foundation Tests

#### Test 1: Complete GOAP Decision with Real Mod Data
**Priority:** CRITICAL
**Complexity:** High
**Estimated Effort:** 3-4 hours

**Description:** Full e2e test using real actions, goals, and rules from loaded mods (core, positioning, items)

**Test Scenario:**
1. Load real mods (core, positioning, items)
2. Create actor with hunger component (triggers `core:find_food` goal)
3. Create food item in location
4. Run full turn execution with action discovery
5. Verify GOAP selects pick_up_food action
6. Execute action through rule system
7. Verify actor has food component after execution
8. Verify planning effects matched actual state changes

**Success Criteria:**
- Goal selected matches expected priority
- Action selected moves toward goal
- Rule execution produces same state changes as planning effects predicted
- Actor satisfies goal after action execution

**Files to Create:**
- `tests/e2e/goap/CompleteGoapDecisionWithRealMods.e2e.test.js`

---

#### Test 2: Goal Priority Selection Workflow
**Priority:** CRITICAL
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

**Description:** Verify goal priority system works correctly with multiple competing goals

**Test Scenario:**
1. Load mods with multiple goals (find_food, rest_safely, defeat_enemy)
2. Create actor with multiple goal triggers (hungry, tired, in combat)
3. Verify highest-priority goal (defeat_enemy at 90) is selected first
4. Satisfy highest-priority goal (remove combat component)
5. Verify next-priority goal (find_food at 80) is selected
6. Continue until all goals satisfied or no goals remain

**Success Criteria:**
- Goals selected in correct priority order
- Satisfied goals are not re-selected
- Irrelevant goals are not considered
- Goal state evaluation works with JSON Logic conditions

**Files to Create:**
- `tests/e2e/goap/GoalPrioritySelectionWorkflow.e2e.test.js`

---

#### Test 3: Action Selection with Effect Simulation
**Priority:** CRITICAL
**Complexity:** High
**Estimated Effort:** 3-4 hours

**Description:** Verify action selection correctly simulates effects and calculates progress toward goals

**Test Scenario:**
1. Create goal requiring specific component (e.g., positioning:sitting)
2. Provide multiple actions with different effects:
   - sit_down (adds sitting, progress = +1)
   - stand_up (removes sitting, progress = -1)
   - wave (no relevant effect, progress = 0)
3. Verify ActionSelector:
   - Filters actions to those with planning effects
   - Simulates each action's effects
   - Calculates progress for each action
   - Selects sit_down (highest positive progress)
4. Execute selected action
5. Verify goal satisfied after execution

**Success Criteria:**
- Only actions with positive progress considered
- Action with highest progress selected
- Effect simulation accurately predicts state changes
- Selected action achieves goal

**Files to Create:**
- `tests/e2e/goap/ActionSelectionWithEffectSimulation.e2e.test.js`

---

#### Test 4: Planning Effects Match Rule Execution
**Priority:** CRITICAL
**Complexity:** High
**Estimated Effort:** 4-5 hours

**Description:** Verify planning effects generated from rules match actual rule execution outcomes

**Test Scenario:**
1. Load real actions with generated planning effects (e.g., positioning:sit_down)
2. Create test world state with actor standing
3. Simulate action effects during planning:
   - Record simulated state changes
4. Execute action through rule system:
   - Record actual state changes
5. Compare simulated vs. actual:
   - Component additions match
   - Component removals match
   - Component modifications match
   - No unexpected state changes
6. Repeat for actions with conditional effects

**Success Criteria:**
- Simulated effects match actual effects for all tested actions
- Conditional effects work correctly
- No components changed that weren't predicted
- Abstract preconditions evaluated correctly

**Files to Create:**
- `tests/e2e/goap/PlanningEffectsMatchRuleExecution.e2e.test.js`

---

### Priority 2: Critical Integration Tests

#### Test 5: Plan Caching and Invalidation
**Priority:** HIGH
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

**Description:** Verify plan caching works correctly and caches are invalidated appropriately

**Test Scenario:**
1. Actor with goal selects action and creates plan
2. Verify plan cached for actor
3. Next turn: verify cached plan reused (no replanning)
4. Modify world state relevant to plan (e.g., remove target entity)
5. Verify plan invalidated
6. Next turn: verify new plan created
7. Test cache invalidation strategies:
   - Actor-specific invalidation
   - Goal-based invalidation
   - Global cache clear

**Success Criteria:**
- Plans cached correctly
- Cached plans reused when valid
- Plans invalidated when world state changes
- New plans created after invalidation
- Multiple invalidation strategies work

**Files to Create:**
- `tests/e2e/goap/PlanCachingAndInvalidation.e2e.test.js`

---

#### Test 6: Multi-Actor Concurrent GOAP Decisions
**Priority:** HIGH
**Complexity:** Medium-High
**Estimated Effort:** 3-4 hours

**Description:** Verify multiple actors can make independent GOAP decisions simultaneously

**Test Scenario:**
1. Create 3 actors with different goals:
   - Actor A: hungry (find_food goal)
   - Actor B: tired (rest_safely goal)
   - Actor C: in combat (defeat_enemy goal)
2. All actors make decisions in same turn
3. Verify:
   - Each actor selects action for their own goal
   - Plans cached independently per actor
   - No interference between actors' decisions
4. Execute all actions
5. Modify state affecting Actor B's plan
6. Verify only Actor B's cache invalidated (not A or C)
7. Next turn: Verify Actor B replans, A and C reuse cached plans

**Success Criteria:**
- All actors make independent decisions
- Plans don't interfere with each other
- Cache invalidation is actor-specific
- Correct actions selected for each actor's goals

**Files to Create:**
- `tests/e2e/goap/MultiActorConcurrentGoapDecisions.e2e.test.js`

---

#### Test 7: Abstract Precondition Conditional Effects
**Priority:** HIGH
**Complexity:** High
**Estimated Effort:** 3-4 hours

**Description:** Verify conditional effects with abstract preconditions work correctly during planning and execution

**Test Scenario:**
1. Create action with conditional effects:
   - Condition: hasInventoryCapacity
   - Then: ADD_COMPONENT (items:inventory_item)
   - Else: DISPATCH_EVENT (inventory_full)
2. Test Case 1: Actor with capacity
   - Simulate effect during planning
   - Verify abstract precondition returns true
   - Verify "then" effects applied in simulation
   - Execute action
   - Verify item added to inventory
3. Test Case 2: Actor without capacity
   - Simulate effect during planning
   - Verify abstract precondition returns false
   - Verify "else" effects applied in simulation
   - Execute action
   - Verify event dispatched, item not added

**Success Criteria:**
- Abstract preconditions evaluated correctly during simulation
- Conditional effects apply correct branch (then/else)
- Planning simulation matches execution outcomes
- Different simulation strategies work (assumeTrue, assumeFalse)

**Files to Create:**
- `tests/e2e/goap/AbstractPreconditionConditionalEffects.e2e.test.js`

---

### Priority 3: Important Validation Tests

#### Test 8: Multi-Turn Goal Achievement
**Priority:** MEDIUM-HIGH
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

**Description:** Verify actors can pursue goals across multiple turns until satisfied

**Test Scenario:**
1. Create goal requiring multiple actions (e.g., find_food requires: navigate_to_food, pick_up_food)
2. Actor starts far from food
3. Turn 1: Actor navigates toward food
4. Verify goal not yet satisfied
5. Verify plan cache maintained
6. Turn 2: Actor picks up food
7. Verify goal satisfied
8. Verify actor moves to next goal or idles

**Success Criteria:**
- Actor maintains goal pursuit across multiple turns
- Cache preserves plan between turns
- Goal satisfaction checked after each action
- New goal selected after current goal satisfied

**Files to Create:**
- `tests/e2e/goap/MultiTurnGoalAchievement.e2e.test.js`

---

#### Test 9: Goal Relevance and Satisfaction Evaluation
**Priority:** MEDIUM-HIGH
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

**Description:** Verify goal relevance and satisfaction conditions work with complex JSON Logic

**Test Scenario:**
1. Define goal with complex relevance condition:
   ```json
   {
     "and": [
       { "<": [{ "var": "actor.components.core:hunger.value" }, 30] },
       { ">=": [{ "var": "actor.components.core:energy.value" }, 20] },
       { "!": [{ "var": "actor.components.combat:in_combat" }] }
     ]
   }
   ```
2. Test relevance evaluation:
   - Actor meets all conditions: relevant
   - Actor fails one condition: not relevant
   - Actor meets no conditions: not relevant
3. Test goal state satisfaction:
   - Component exists: satisfied
   - Component doesn't exist: not satisfied
   - Component exists with correct value: satisfied
   - Component exists with wrong value: not satisfied

**Success Criteria:**
- JSON Logic evaluation works correctly
- Complex AND/OR/NOT conditions handled
- Component existence checks work
- Component value comparisons work
- Nested conditions evaluated correctly

**Files to Create:**
- `tests/e2e/goap/GoalRelevanceAndSatisfactionEvaluation.e2e.test.js`

---

#### Test 10: Cross-Mod Goal and Action Interaction
**Priority:** MEDIUM
**Complexity:** Medium-High
**Estimated Effort:** 3-4 hours

**Description:** Verify actions from one mod can satisfy goals from another mod

**Test Scenario:**
1. Load multiple mods (core, positioning, items)
2. Define goal in core mod: `core:be_sitting`
3. Define action in positioning mod: `positioning:sit_down`
4. Create actor with components triggering core goal
5. Verify positioning action selected for core goal
6. Execute action and verify goal satisfied
7. Test reverse: positioning goal, core action

**Success Criteria:**
- Goals from one mod work with actions from another
- Planning effects from any mod considered
- Cross-mod component references work
- No mod isolation issues

**Files to Create:**
- `tests/e2e/goap/CrossModGoalAndActionInteraction.e2e.test.js`

---

### Priority 4: Performance and Edge Cases

#### Test 11: GOAP Performance Under Load
**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

**Description:** Verify GOAP planning performance is acceptable for real-time gameplay

**Test Scenario:**
1. Create 10 actors with different goals
2. Each actor has 20-30 available actions
3. Measure planning time per actor:
   - Goal selection: < 5ms
   - Action selection: < 10ms
   - Total decision time: < 20ms
4. Run 10 turns and measure:
   - Average planning time
   - Max planning time
   - Cache hit rate (should be > 80% after turn 1)
5. Verify no memory leaks after 100 turns

**Success Criteria:**
- Planning time within acceptable bounds
- Cache provides performance benefit
- No performance degradation over time
- No memory leaks

**Files to Create:**
- `tests/e2e/goap/GoapPerformanceUnderLoad.e2e.test.js`

---

#### Test 12: Error Recovery and Graceful Degradation
**Priority:** MEDIUM
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

**Description:** Verify GOAP system handles errors gracefully without crashing

**Test Scenario:**
1. Test malformed goal definition:
   - Invalid JSON Logic
   - Missing required fields
   - Verify system logs error and skips goal
2. Test malformed action:
   - Invalid planning effects
   - Missing required fields
   - Verify system logs error and skips action
3. Test missing rule for action:
   - Action has no corresponding rule
   - Verify planning works without effects
4. Test entity state errors:
   - Entity not found
   - Component not found
   - Verify planning continues with available data
5. Test cache corruption:
   - Invalid cached plan
   - Verify cache invalidated and new plan created

**Success Criteria:**
- System doesn't crash on errors
- Errors logged appropriately
- Fallback behavior works
- Actors can still make decisions with partial data

**Files to Create:**
- `tests/e2e/goap/ErrorRecoveryAndGracefulDegradation.e2e.test.js`

---

## Testing Infrastructure Requirements

### Test Helpers (Existing)
- ✅ `createGoapTestBed()` from `tests/common/goap/goapTestHelpers.js`
- ✅ GoapTestBed class with GOAP service access
- ✅ Mock actor/entity creation
- ✅ Plan cache access

### Additional Test Utilities Needed

1. **Real Mod Loader**
   - Load actual mod data (not mocks)
   - Initialize full game systems
   - Enable action discovery

2. **State Comparison Utilities**
   - Compare simulated vs. actual state changes
   - Deep component comparison
   - Component diff reporting

3. **Performance Monitoring**
   - Timing instrumentation
   - Memory usage tracking
   - Cache statistics collection

4. **Goal/Action Definition Helpers**
   - Programmatic goal creation
   - Programmatic action creation with planning effects
   - Rule definition helpers

### Test Data Requirements

1. **Test Goals**
   - Simple goals (single component requirement)
   - Complex goals (multiple component requirements)
   - Goals with conditional relevance
   - Goals with value comparisons

2. **Test Actions**
   - Actions with unconditional effects
   - Actions with conditional effects
   - Actions with abstract preconditions
   - Actions modifying multiple entities

3. **Test World States**
   - Minimal states (single actor)
   - Complex states (multiple actors, items, locations)
   - Edge case states (empty inventory, full inventory, etc.)

## Implementation Roadmap

### Phase 1: Critical Foundation (1-2 weeks)
**Tests:** 1-4
**Focus:** Verify core GOAP functionality works with real data
**Dependencies:** None
**Outcome:** Confidence in basic GOAP decision-making

### Phase 2: Critical Integration (1 week)
**Tests:** 5-7
**Focus:** Verify integration points work correctly
**Dependencies:** Phase 1 complete
**Outcome:** Confidence in caching, multi-actor, and conditional effects

### Phase 3: Important Validation (1 week)
**Tests:** 8-10
**Focus:** Verify edge cases and cross-mod interactions
**Dependencies:** Phase 2 complete
**Outcome:** Confidence in complex scenarios

### Phase 4: Performance and Robustness (3-5 days)
**Tests:** 11-12
**Focus:** Verify system performs well and handles errors gracefully
**Dependencies:** Phase 3 complete
**Outcome:** Production-ready GOAP system

## Test Execution Strategy

### Continuous Integration
1. Run all GOAP e2e tests on every commit
2. Gate merges on test pass
3. Track test execution time (alert if > 2 minutes total)
4. Monitor test flakiness (re-run flaky tests)

### Local Development
1. Run relevant test subset during development
2. Run full suite before committing
3. Use `--testNamePattern` for targeted test execution

### Test Maintenance
1. Update tests when GOAP functionality changes
2. Add regression tests for discovered bugs
3. Review test coverage monthly
4. Deprecate obsolete tests

## Success Metrics

### Coverage Targets
- **E2E Test Coverage:** 80% of critical workflows
- **Integration Test Coverage:** 90% of component interactions
- **Unit Test Coverage:** 95% of individual services

### Quality Targets
- **Test Pass Rate:** > 98%
- **Test Execution Time:** < 3 minutes for full e2e suite
- **Bug Detection Rate:** > 90% of GOAP bugs caught by tests before production

### Confidence Metrics
- **Production Incidents:** 0 GOAP-related incidents in first 3 months
- **Developer Confidence:** 90%+ confidence in GOAP system (survey)
- **Code Review Speed:** 50% faster reviews with comprehensive tests

## Appendix A: GOAP System File Reference

### Core Services
- `src/goap/planning/simplePlanner.js` - One-step planning algorithm
- `src/goap/planning/planCache.js` - Plan caching service
- `src/goap/goals/goalManager.js` - Goal selection service
- `src/goap/goals/goalStateEvaluator.js` - Goal state evaluation
- `src/goap/selection/actionSelector.js` - Action selection algorithm
- `src/goap/analysis/effectsAnalyzer.js` - Rule operation analysis
- `src/goap/generation/effectsGenerator.js` - Planning effects generation
- `src/goap/validation/effectsValidator.js` - Effects validation
- `src/goap/simulation/abstractPreconditionSimulator.js` - Precondition simulation
- `src/turns/providers/goapDecisionProvider.js` - Turn system integration

### Documentation
- `docs/goap/README.md` - GOAP system overview
- `docs/goap/simple-planner.md` - SimplePlanner documentation
- `docs/goap/goal-system.md` - Goal system documentation
- `docs/goap/effects-generation-workflow.md` - Effects generation guide
- `docs/goap/effects-analyzer-architecture.md` - Analyzer design
- `docs/goap/abstract-preconditions.md` - Preconditions catalog
- `docs/goap/operation-mapping.md` - Operation-to-effect mapping
- `docs/goap/troubleshooting.md` - Common issues and solutions

### Schemas
- `data/schemas/goal.schema.json` - Goal definition schema
- `data/schemas/planning-effects.schema.json` - Planning effects schema

### Test Utilities
- `tests/common/goap/goapTestHelpers.js` - GOAP test bed and helpers
- `tests/integration/goap/goapWorkflow.integration.test.js` - Integration test examples

## Appendix B: Goal Definition Examples

The system includes the following test goals:

1. **core:find_food** - Actor needs to find food when hungry
   - Priority: 80
   - Relevance: hunger < 30, no food
   - Goal State: has food component

2. **core:rest_safely** - Actor needs to rest when tired
   - Priority: 60
   - Relevance: energy < 40
   - Goal State: lying down, energy >= 80

3. **core:defeat_enemy** - Actor needs to defeat enemy in combat
   - Priority: 90
   - Relevance: in combat, health > 20
   - Goal State: not in combat

## Appendix C: Test Naming Conventions

### E2E Test File Naming
- Format: `{Workflow}{Feature}.e2e.test.js`
- Examples:
  - `CompleteGoapDecisionWithRealMods.e2e.test.js`
  - `GoalPrioritySelectionWorkflow.e2e.test.js`
  - `ActionSelectionWithEffectSimulation.e2e.test.js`

### Test Suite Naming
- Use descriptive suite names matching workflow
- Example: `describe('Complete GOAP Decision with Real Mods', () => {...})`

### Test Case Naming
- Use "should" statements describing behavior
- Example: `it('should select highest-priority goal when multiple goals are relevant', () => {...})`

## Appendix D: Risk Mitigation

### High-Risk Scenarios

1. **Planning Effects Don't Match Execution**
   - **Mitigation:** Test 4 (Planning Effects Match Rule Execution)
   - **Detection:** Compare simulated vs. actual state changes
   - **Recovery:** Regenerate planning effects, update rules

2. **Cache Staleness Causes Invalid Actions**
   - **Mitigation:** Test 5 (Plan Caching and Invalidation)
   - **Detection:** Validate plans before execution
   - **Recovery:** Invalidate cache on state changes

3. **Performance Degradation in Production**
   - **Mitigation:** Test 11 (GOAP Performance Under Load)
   - **Detection:** Performance monitoring in e2e tests
   - **Recovery:** Optimize planning algorithms, increase caching

4. **Cross-Mod Incompatibilities**
   - **Mitigation:** Test 10 (Cross-Mod Goal and Action Interaction)
   - **Detection:** Test with multiple mod combinations
   - **Recovery:** Fix component references, update schemas

## Conclusion

The GOAP system is a complex, newly implemented AI decision-making framework that currently lacks comprehensive e2e test coverage. This report identifies 7 major workflows and recommends 12 prioritized e2e tests to ensure system reliability and production readiness.

**Immediate Actions:**
1. Implement Priority 1 tests (Tests 1-4) to validate core functionality
2. Set up CI/CD integration for GOAP e2e tests
3. Establish test coverage monitoring
4. Create test data fixtures for goals, actions, and world states

**Success Criteria:**
- All 12 e2e tests implemented and passing
- 80%+ workflow coverage achieved
- 0 production incidents in first 3 months
- Developer confidence in GOAP system established

---

**Report End**
