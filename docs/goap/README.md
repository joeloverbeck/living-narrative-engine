# GOAP Documentation

Welcome to the GOAP (Goal-Oriented Action Planning) system documentation. This directory contains comprehensive guides for understanding, implementing, and debugging GOAP-based AI behavior.

## Quick Start

**New to GOAP?** Start here:
1. Read the [GOAP System Specs](../../specs/goap-system-specs.md) for architecture overview
2. Try [Task Loading Guide](./task-loading.md) to understand how tasks work
3. Use [Debugging Tools](./debugging-tools.md) when something doesn't work as expected

## Core Concepts

### System Architecture

- **[GOAP System Specs](../../specs/goap-system-specs.md)** - Complete architecture explanation
  - Task vs Action separation
  - Planning-level vs execution-level operations
  - Knowledge-limited scoping
  - Refinement process

### Planning

- **[Multi-Action Planning Guide](./multi-action-planning.md)** ⭐ NEW
  - How multi-action plans work
  - Task reusability and heuristics
  - Configuration options
  - Edge cases and troubleshooting

### Task Development

- **[Task Loading Guide](./task-loading.md)**
  - How tasks are loaded from mods
  - Task definition structure
  - Structural gates and preconditions
  - Planning effects

- **[Modder Guide: Task Parameters](./modder-guide-parameters.md)**
  - Parameter binding system
  - Planning scopes
  - Knowledge-limited scoping

### Refinement System

- **[Refinement: Parameter Binding](./refinement-parameter-binding.md)**
  - How parameters are bound during refinement
  - Scope resolution
  - Entity selection

- **[Refinement: Condition Context](./refinement-condition-context.md)**
  - Condition evaluation during refinement
  - Context building
  - State management

- **[Refinement: Action References](./refinement-action-references.md)**
  - How tasks reference executable actions
  - Action selection and validation
  - Action queue management

### Patterns and Best Practices

- **[Condition Patterns Guide](./condition-patterns-guide.md)**
  - Common condition patterns
  - JSON Logic usage
  - Best practices

## Development

### Debugging

- **[Debugging Tools Reference](./debugging-tools.md)**
  - Plan Inspector
  - State Diff Viewer
  - Refinement Tracer
  - GOAP Debugger API

- **[Debugging Multi-Action Scenarios](./debugging-multi-action.md)** ⭐ NEW
  - Quick diagnostics workflows
  - Common multi-action issues
  - Performance profiling
  - Troubleshooting checklist

### Testing

Located in `/tests/`:
- **Unit Tests**: `tests/unit/goap/`
- **Integration Tests**: `tests/integration/goap/`

## Documentation Structure

```
docs/goap/
├── README.md (this file)
├── multi-action-planning.md         ⭐ NEW - Multi-action planning guide
├── debugging-multi-action.md        ⭐ NEW - Multi-action debugging workflows
├── debugging-tools.md               📝 Updated - Debug tool reference
├── task-loading.md                  - Task loading system
├── modder-guide-parameters.md       - Parameter binding guide
├── refinement-parameter-binding.md  - Refinement parameter binding
├── refinement-condition-context.md  - Refinement condition evaluation
├── refinement-action-references.md  - Refinement action selection
├── condition-patterns-guide.md      - Condition patterns
├── examples/                        - Code examples
└── templates/                       - Template files

specs/
└── goap-system-specs.md            - Primary architecture specification
```

## Common Tasks

### Understanding Multi-Action Planning

1. Read [Multi-Action Planning Guide](./multi-action-planning.md)
2. Review usage examples in the guide
3. Understand heuristics and stopping criteria
4. Learn configuration options

### Debugging a Failed Plan

1. Enable debug logging (see [Debugging Multi-Action](./debugging-multi-action.md))
2. Check planning events for failure reason
3. Use Plan Inspector to see active plan
4. Follow troubleshooting checklist

### Creating a New Task

1. Read [Task Loading Guide](./task-loading.md)
2. Review [Modder Guide: Parameters](./modder-guide-parameters.md)
3. Define task with structural gates and planning effects
4. Test with [Debugging Tools](./debugging-tools.md)

### Implementing Refinement

1. Read [Refinement: Parameter Binding](./refinement-parameter-binding.md)
2. Understand [Refinement: Condition Context](./refinement-condition-context.md)
3. Review [Refinement: Action References](./refinement-action-references.md)
4. Use Refinement Tracer for debugging

## Key Terminology

- **Task**: Abstract planning-level intention (e.g., `task:consume_nourishing_item`)
- **Action**: Concrete execution-level operation (e.g., `items:consume_item`)
- **Refinement**: Translation from tasks to actions during execution
- **Structural Gates**: Coarse "is this task ever applicable?" filter
- **Planning Preconditions**: Fine "is this task applicable in this state?" check
- **Planning Effects**: State changes a task causes during planning
- **Heuristic**: Distance estimation function for A* search (goal-distance, RPG)
- **GOAP**: Goal-Oriented Action Planning - AI planning technique

## Architecture Quick Reference

### Two-Level System

```
Planning Level (Tasks)
├── Abstract intentions
├── Planning preconditions/effects
├── Knowledge-limited scopes
└── A* search with heuristics
    ↓
    Refinement (Translation)
    ↓
Execution Level (Actions)
├── Concrete operations
├── Execution prerequisites/gates
├── Location-limited scopes
└── Action queue execution
```

### Data Flow

```
1. Goal Selection
   ↓
2. Task Library Construction (structural gates)
   ↓
3. GOAP Planning (A* search on tasks)
   ↓
4. Plan Refinement (tasks → actions)
   ↓
5. Action Execution (primitive actions)
   ↓
6. Plan Invalidation Detection
   ↓
7. Replan if needed (goto 2)
```

## Related Documentation

### Project-Wide

- **[CLAUDE.md](../../CLAUDE.md)** - Project context and guidelines
- **[Testing Guide](../../docs/testing/)** - General testing patterns

### GOAP-Specific

- **Source Code**: `src/goap/`
- **Tests**: `tests/unit/goap/`, `tests/integration/goap/`
- **Schemas**: `data/schemas/task.schema.json`, `data/schemas/goal.schema.json`
- **Examples**: `data/mods/*/tasks/` (mod task definitions)

## Getting Help

### Debugging Steps

1. **Check debug logs**: Enable 'debug' level logging
2. **Inspect events**: Look for `goap:*` events in event bus
3. **Use debugger**: Get GOAPDebugger from DI container
4. **Generate report**: `debugger.generateReport(actorId)`
5. **Consult guides**: See [Debugging Multi-Action](./debugging-multi-action.md)

### Common Debugging Commands

```javascript
// Get debug tools
const debugger = container.resolve(tokens.IGOAPDebugger);

// Inspect active plan
const plan = debugger.inspectPlan(actorId);

// Check failure history
const failures = debugger.getFailureHistory(actorId);

// Generate comprehensive report
const report = debugger.generateReport(actorId);
```

## Contributing

When adding new GOAP documentation:

1. **Maintain consistency**: Follow existing structure and style
2. **Include code examples**: Provide working code snippets
3. **Cross-reference**: Link to related docs
4. **Update this README**: Add new doc to appropriate section
5. **Test examples**: Verify code examples execute correctly

## Version History

- **2025-11-16**: Added multi-action planning and debugging guides
- **2025-11-15**: Created README navigation hub
- **Earlier**: Initial GOAP documentation

---

**Need more help?** Check the [GOAP System Specs](../../specs/goap-system-specs.md) for the authoritative architecture reference.
