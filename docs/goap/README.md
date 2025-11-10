# GOAP (Goal-Oriented Action Planning) System

## Overview

The GOAP system for Living Narrative Engine provides AI-driven action selection based on goal-oriented planning. This system enables NPCs to make intelligent decisions by planning sequences of actions that achieve their goals while considering the current world state.

## Architecture

The GOAP system is organized into three tiers:

### Tier 1: Effects Auto-Generation
Automated analysis of rule operations to generate planning metadata.

**Components:**
- **Effects Analyzer**: Analyzes rule operations to extract world state changes
- **Effects Generator**: Generates planning effects from analyzed operations
- **Effects Validator**: Validates generated effects against schemas

### Tier 2: Simple Action Planning
Basic single-action selection based on goal satisfaction.

**Components:**
- **Goal Manager**: Manages NPC goals and priorities
- **Goal State Evaluator**: Evaluates if a goal is satisfied by action effects
- **Action Selector**: Selects the best action to achieve current goal
- **Simple Planner**: Basic planning that selects single actions

### Tier 3: Multi-Step Planning
Advanced planning with action sequences and state simulation.

**Components:**
- **Plan Cache**: Caches generated plans for performance
- **Advanced Planner**: Plans multi-step action sequences
- **State Simulator**: Simulates world state changes during planning

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

## Data Flow

```
Action Definition (JSON)
    ↓
Rule Operations
    ↓
Effects Analyzer ← Operation Mapping
    ↓
Planning Effects (auto-generated)
    ↓
Goal State Evaluator
    ↓
Action Selector
    ↓
Selected Action → Execution
```

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

### Tier 1 (Auto-Generation)
- Analysis happens once during mod loading
- No runtime performance impact
- Generated effects cached with action definitions

### Tier 2 (Simple Planning)
- O(n) action evaluation where n = available actions
- Single-action selection per turn
- Minimal overhead (<5ms typical)

### Tier 3 (Multi-Step Planning)
- Plan caching reduces repeated planning
- Configurable search depth limits
- Typical planning time: 10-50ms for 3-5 step plans

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

### Schema Tests
- `tests/unit/goap/schemas/` - Schema validation tests
- Coverage target: 95%+

### Integration Tests
- `tests/integration/goap/` - System integration tests
- Tests with real actions and goals
- Validates end-to-end planning flow

### Performance Tests
- `tests/performance/goap/` - Performance benchmarks
- Ensures planning meets latency targets

## Development Roadmap

### Phase 1: Effects Auto-Generation (Current)
- [x] GOAP-TIER1-001: Schema design and DI setup
- [ ] GOAP-TIER1-002: Effects analyzer implementation
- [ ] GOAP-TIER1-003: Effects generator implementation

### Phase 2: Simple Action Planning
- [ ] GOAP-TIER2-001: Goal system implementation
- [ ] GOAP-TIER2-002: Action selector implementation
- [ ] GOAP-TIER2-003: Simple planner implementation

### Phase 3: Multi-Step Planning
- [ ] GOAP-TIER3-001: State simulator implementation
- [ ] GOAP-TIER3-002: Advanced planner implementation
- [ ] GOAP-TIER3-003: Plan cache implementation

## Related Documentation

- [Operation Mapping](./operation-mapping.md) - Complete operation-to-effect mapping
- [Effects Analyzer Architecture](./effects-analyzer-architecture.md) - Analyzer design
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
