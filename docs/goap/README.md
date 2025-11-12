# GOAP (Goal-Oriented Action Planning) System

## Overview

The GOAP system for Living Narrative Engine provides AI-driven action selection based on goal-oriented planning. This system enables NPCs to make intelligent decisions by planning sequences of actions that achieve their goals while considering the current world state.

## Architecture

The GOAP system consists of three integrated architectural tiers, all of which are fully implemented:

### Tier 1: Effects Auto-Generation
Automated analysis of rule operations to generate planning metadata.

**Components:**
- **Effects Analyzer**: Analyzes rule operations to extract world state changes
- **Effects Generator**: Generates planning effects from analyzed operations
- **Effects Validator**: Validates generated effects against schemas

### Tier 2: Goal-Based Action Selection
Goal-oriented action selection based on world state evaluation.

**Components:**
- **Goal Manager**: Manages NPC goals and priorities
- **Goal State Evaluator**: Evaluates goal relevance and satisfaction
- **Action Selector**: Selects actions that best achieve active goals

### Tier 3: Multi-Step Planning & Optimization
Advanced planning with action sequences, state simulation, and caching.

**Components:**
- **Plan Cache**: Caches generated plans with multiple invalidation strategies
- **Advanced Planner**: Plans multi-step action sequences across turns
- **State Simulator**: Simulates world state changes during planning
- **Error Recovery**: Handles planning failures gracefully

## Key Concepts

### Planning Effects

Planning effects describe how an action changes the world state from the planner's perspective. These are **metadata only** and are never executed.

**Effect Types:**
- `ADD_COMPONENT`: Adds a component to an entity
- `REMOVE_COMPONENT`: Removes a component from an entity
- `MODIFY_COMPONENT`: Modifies component data
- `CONDITIONAL`: Effects that apply conditionally

**Example:**
```json
{
  "planningEffects": {
    "effects": [
      {
        "operation": "ADD_COMPONENT",
        "entity": "actor",
        "component": "positioning:sitting"
      },
      {
        "operation": "REMOVE_COMPONENT",
        "entity": "actor",
        "component": "positioning:standing"
      }
    ],
    "cost": 1.0
  }
}
```

### Goals

Goals represent desired world states that NPCs want to achieve. They are defined as sets of component requirements.

**Example:**
```json
{
  "goal": "be_sitting",
  "requirements": [
    {
      "entity": "self",
      "component": "positioning:sitting",
      "mustExist": true
    }
  ]
}
```

### Abstract Preconditions

Abstract preconditions are reusable condition functions used in conditional effects. They define simulation behavior for conditions that can't be fully evaluated during planning.

**Example:**
```json
{
  "abstractPreconditions": {
    "isTargetFriendly": {
      "description": "Checks if target is friendly towards actor",
      "parameters": ["actor", "target"],
      "simulationFunction": "assumeTrue"
    }
  }
}
```

### Plan Caching

The GOAP system employs intelligent plan caching to improve performance. Plans are cached per actor and can be reused across multiple turns.

**Cache Invalidation Strategies:**
- **Actor-Specific Invalidation**: Invalidate plans for a single actor when their state changes
- **Goal-Based Invalidation**: Invalidate plans when specific goals become satisfied or irrelevant
- **Global Invalidation**: Clear all cached plans when world state changes significantly
- **Automatic Recreation**: Plans are automatically regenerated after invalidation when needed

**Benefits:**
- Reduced planning overhead for repeated decision-making
- Consistent behavior across turns when world state remains stable
- Efficient handling of multiple actors making concurrent decisions

### Multi-Actor Support

The GOAP system supports multiple actors making independent decisions concurrently:

- **Cache Isolation**: Each actor's plans are cached independently
- **Concurrent Decisions**: Multiple actors can plan and execute actions simultaneously
- **Selective Invalidation**: Changes to one actor don't affect others' cached plans unless world state changes
- **Cross-Mod Goals**: Actors can pursue goals from different mods working together

### Error Recovery

The system handles planning failures gracefully:

- **No Valid Actions**: Returns null when no actions satisfy current goals
- **Unsatisfiable Goals**: Handles scenarios where goals cannot be achieved with available actions
- **Degraded Performance**: Continues functioning even under high load or complex scenarios
- **Consistent Null Responses**: Returns predictable results when planning cannot proceed

## Operation Mapping

The GOAP system maps rule operations to planning effects. See [operation-mapping.md](./operation-mapping.md) for the complete mapping table.

### State-Changing Operations
Operations that modify world state and generate planning effects:
- `ADD_COMPONENT`, `REMOVE_COMPONENT`, `MODIFY_COMPONENT`
- `ATOMIC_MODIFY_COMPONENT`
- Component-based operations (e.g., `LOCK_MOVEMENT`, `TRANSFER_ITEM`)

### Non-State Operations
Operations that don't affect planning:
- `DISPATCH_EVENT`, `LOG`, `END_TURN`
- Query operations that only produce context data

## Effects Analyzer Architecture

The effects analyzer automatically extracts planning effects from rule operations. See [effects-analyzer-architecture.md](./effects-analyzer-architecture.md) for detailed design.

**Key Features:**
- Automatic operation analysis
- Macro resolution
- Path tracing for conditionals
- Abstract precondition identification

## Integration with Existing Systems

### Action System Integration
- Actions define `planningEffects` in their JSON files
- Effects are auto-generated during mod loading (Tier 1)
- Effects are validated against planning-effects.schema.json

### Rule System Integration
- Rules remain unchanged (execution code)
- Effects analyzer reads rule operations
- No runtime overhead - analysis happens during loading

### Event System Integration
- GOAP planning decisions trigger events
- `GOAL_SELECTED`, `ACTION_PLANNED`, `PLAN_FAILED` events
- Integration with existing event bus

## Performance Considerations

### Effects Generation (Tier 1)
- Analysis happens once during mod loading
- No runtime performance impact
- Generated effects cached with action definitions

### Action Planning (Tiers 2 & 3)
- O(n) action evaluation where n = available actions
- Plan caching significantly reduces repeated planning overhead
- Multi-actor scenarios: 5 actors can complete decision-making in under 5 seconds
- Performance scales with:
  - Number of available actions
  - Number of relevant goals
  - World state complexity
  - Cache hit rate

### Optimization Strategies
- **Plan Reuse**: Cached plans are reused across turns when world state is stable
- **Selective Invalidation**: Only affected plans are cleared when state changes
- **Lazy Evaluation**: Plans are only generated when needed
- **Cache Isolation**: Each actor maintains independent cache to avoid interference

## Schema Validation

All planning effects are validated against JSON schemas:
- `planning-effects.schema.json`: Planning effects structure
- `action.schema.json`: Action definitions (accepts `planningEffects`)

Validation ensures:
- Type safety
- Required fields present
- Valid component references
- Proper effect structure

## Dependency Injection

GOAP services are registered in the DI container:

**Tokens:** `src/dependencyInjection/tokens/tokens-goap.js`
**Registrations:** `src/dependencyInjection/registrations/goapRegistrations.js`

Services can be injected into other components:
```javascript
constructor({ actionSelector, goalManager }) {
  this.actionSelector = actionSelector;
  this.goalManager = goalManager;
}
```

## Testing

### End-to-End Tests

The GOAP system has comprehensive e2e test coverage in `tests/e2e/goap/`:

**Core System Tests:**
- `CompleteGoapDecisionWithRealMods.e2e.test.js` - Complete decision workflow with real mods
- `ActionSelectionWithEffectSimulation.e2e.test.js` - Action selection with future state simulation
- `GoalPrioritySelectionWorkflow.e2e.test.js` - Goal priority evaluation and selection
- `GoalRelevanceAndSatisfactionEvaluation.e2e.test.js` - Goal relevance and satisfaction checking

**Planning & Caching Tests:**
- `PlanCachingAndInvalidation.e2e.test.js` - Cache strategies (actor-specific, goal-based, global)
- `MultiTurnGoalAchievement.e2e.test.js` - Multi-turn goal pursuit and plan persistence
- `PlanningEffectsMatchRuleExecution.e2e.test.js` - Validates planning effects accuracy vs actual execution

**Multi-Actor Tests:**
- `MultiActorConcurrentGoapDecisions.e2e.test.js` - Concurrent decision-making with cache isolation
- `multipleActors.e2e.test.js` - Performance test with 5 actors (< 5000ms target)

**Advanced Features Tests:**
- `AbstractPreconditionConditionalEffects.e2e.test.js` - Abstract preconditions and conditional effects
- `CrossModGoalAndActionInteraction.e2e.test.js` - Cross-mod goal and action compatibility
- `ErrorRecoveryAndGracefulDegradation.e2e.test.js` - Error handling and graceful failures
- `GoapPerformanceUnderLoad.e2e.test.js` - Performance validation under load

**Behavior Tests:**
- `catBehavior.e2e.test.js` - Cat NPC finding food (hunger goal)
- `goblinBehavior.e2e.test.js` - Goblin NPC combat decisions and weapon pickup

### Unit Tests
Unit tests cover individual components in `tests/unit/goap/`:
- Effects analyzer, generator, and validator
- Schema validation
- Coverage target: 90%+ branches, 95%+ lines

### Integration Tests
Integration tests validate component interactions in `tests/integration/goap/`:
- Effects generation workflow
- Schema integration
- Validation pipeline

### Performance Tests
Performance benchmarks in `tests/performance/goap/`:
- Effects generation performance
- Planning performance under load
- Memory leak detection

### Running Tests

```bash
# Run all e2e GOAP tests
npm run test:e2e -- tests/e2e/goap/

# Run specific e2e test
npm run test:e2e -- tests/e2e/goap/CompleteGoapDecisionWithRealMods.e2e.test.js

# Run all GOAP tests (all types)
npm run test:unit -- tests/unit/goap/
npm run test:integration -- tests/integration/goap/
npm run test:e2e -- tests/e2e/goap/
npm run test:performance -- tests/performance/goap/
```

## Implementation Status

All three architectural tiers are fully implemented and tested:

### Phase 1: Effects Auto-Generation ✅ Completed
- [x] GOAP-TIER1-001: Schema design and DI setup
- [x] GOAP-TIER1-002: Effects analyzer implementation
- [x] GOAP-TIER1-003: Effects generator implementation
- [x] GOAP-TIER1-004: Effects validator implementation
- [x] GOAP-TIER1-005: Effects testing and documentation

### Phase 2: Goal-Based Action Selection ✅ Completed
- [x] GOAP-TIER2-001: Goal system implementation
- [x] GOAP-TIER2-002: Goal evaluation and relevance checking
- [x] GOAP-TIER2-003: Action selector implementation
- [x] GOAP-TIER2-004: Priority-based goal selection

**Proven by:** `GoalPrioritySelectionWorkflow.e2e.test.js`, `GoalRelevanceAndSatisfactionEvaluation.e2e.test.js`

### Phase 3: Multi-Step Planning ✅ Completed
- [x] GOAP-TIER3-001: State simulator implementation
- [x] GOAP-TIER3-002: Advanced planner implementation
- [x] GOAP-TIER3-003: Plan cache with multiple invalidation strategies
- [x] GOAP-TIER3-004: Multi-turn goal achievement
- [x] GOAP-TIER3-005: Multi-actor concurrent decision-making
- [x] GOAP-TIER3-006: Error recovery and graceful degradation

**Proven by:** `PlanCachingAndInvalidation.e2e.test.js`, `MultiTurnGoalAchievement.e2e.test.js`, `MultiActorConcurrentGoapDecisions.e2e.test.js`, `CompleteGoapDecisionWithRealMods.e2e.test.js`

## Related Documentation

### Core Documentation
- [Effects System](./effects-system.md) - Complete guide to effects generation, analysis, and runtime placeholders
- [Operation Mapping](./operation-mapping.md) - Complete operation-to-effect mapping and result structures
- [Planning System](./planning-system.md) - Goals, action selection, abstract preconditions, and SimplePlanner
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

### External Resources
- [GOAP Theory](https://alumni.media.mit.edu/~jorkin/goap.html) - Original GOAP paper by Jeff Orkin

## Contributing

When working with the GOAP system:

1. **Understand separation**: Planning effects vs. execution code
2. **Follow schemas**: All effects must validate
3. **Test thoroughly**: 95%+ coverage for critical components
4. **Document clearly**: GOAP concepts can be complex
5. **Consider performance**: Planning must be fast enough for real-time gameplay

## Questions?

For questions or issues:
- Check existing documentation in `docs/goap/`
- Review test examples in `tests/unit/goap/` and `tests/integration/goap/`
- Open a GitHub issue with the `goap` label
