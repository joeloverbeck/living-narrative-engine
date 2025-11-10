# Effects Analyzer Architecture

## Overview

The Effects Analyzer is the core component of GOAP Tier 1 that automatically generates planning metadata from action rules. It analyzes rule operations, resolves macros, traces execution paths, and outputs planning effects that describe how actions change world state.

## Design Principles

1. **Automated Analysis**: No manual effect authoring required
2. **Schema Compliance**: All generated effects validate against planning-effects.schema.json
3. **Conservative**: When uncertain, create abstract preconditions rather than incorrect effects
4. **Traceable**: Maintain mapping from operations to effects for debugging
5. **Efficient**: Analysis happens once during mod loading, not at runtime

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Effects Analyzer                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Operation  │  │    Macro     │  │    Path      │     │
│  │   Registry   │  │   Resolver   │  │   Tracer     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                          │                                 │
│                          ▼                                 │
│              ┌──────────────────────┐                      │
│              │  Abstract Precond.   │                      │
│              │     Detector         │                      │
│              └──────────────────────┘                      │
│                          │                                 │
└──────────────────────────┼─────────────────────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │ Effects Generator    │
              └──────────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │ Effects Validator    │
              └──────────────────────┘
                           │
                           ▼
              ┌──────────────────────┐
              │  Planning Effects    │
              │       (JSON)         │
              └──────────────────────┘
```

## Component Responsibilities

### Effects Analyzer

**Purpose**: Main orchestrator that analyzes action rules and produces effects

**Responsibilities:**
- Loads action and rule definitions
- Analyzes operation sequences
- Coordinates macro resolution and path tracing
- Identifies abstract preconditions
- Invokes effects generator

**Interface:**
```javascript
class EffectsAnalyzer {
  /**
   * Analyzes an action and generates planning effects
   * @param {string} actionId - Action identifier
   * @param {object} actionDefinition - Action JSON definition
   * @param {object} ruleDefinition - Associated rule JSON definition
   * @returns {object} Planning effects object
   */
  async analyzeAction(actionId, actionDefinition, ruleDefinition) {
    // 1. Build analysis context
    // 2. Analyze operations
    // 3. Trace execution paths
    // 4. Identify abstract preconditions
    // 5. Generate effects
    // 6. Validate effects
    // 7. Return planning effects
  }

  /**
   * Analyzes a single operation
   * @param {object} operation - Rule operation
   * @param {object} context - Analysis context
   * @returns {Array<object>} Generated effects
   */
  analyzeOperation(operation, context) {
    // Delegate to operation-specific analyzer
  }
}
```

**Dependencies:**
- `IOperationRegistry`: Registry of operation analyzers
- `IMacroResolver`: Resolves macro expressions
- `IPathTracer`: Traces conditional execution paths
- `IAbstractPreconditionDetector`: Detects abstract preconditions
- `IEffectsGenerator`: Generates final effects
- `IEffectsValidator`: Validates generated effects
- `ILogger`: Logging service

---

### Operation Registry

**Purpose**: Maps operation types to specialized analyzer functions

**Responsibilities:**
- Registers operation type → analyzer mappings
- Provides analyzer lookup
- Categorizes operations (state-changing, context, control flow, excluded)

**Interface:**
```javascript
class OperationRegistry {
  /**
   * Registers an operation analyzer
   * @param {string} operationType - Operation type (e.g., 'ADD_COMPONENT')
   * @param {Function} analyzer - Analyzer function
   * @param {string} category - Operation category
   */
  register(operationType, analyzer, category) {
    this.#registry.set(operationType, { analyzer, category });
  }

  /**
   * Gets analyzer for operation type
   * @param {string} operationType - Operation type
   * @returns {Function|null} Analyzer function or null
   */
  getAnalyzer(operationType) {
    return this.#registry.get(operationType)?.analyzer;
  }

  /**
   * Checks if operation generates effects
   * @param {string} operationType - Operation type
   * @returns {boolean}
   */
  isStateChanging(operationType) {
    return this.#registry.get(operationType)?.category === 'state-changing';
  }
}
```

**Operation Analyzer Signature:**
```javascript
/**
 * @param {object} operation - Rule operation
 * @param {object} context - Analysis context
 * @returns {Array<object>} Generated effects
 */
function analyzeOperation(operation, context) {
  // Return array of planning effects
}
```

---

### Macro Resolver

**Purpose**: Resolves macro expressions in operations to concrete values

**Responsibilities:**
- Resolves `{var: "name"}` expressions
- Resolves `{param: "name"}` expressions
- Resolves `{lookup: {...}}` expressions
- Maintains resolution context
- Identifies unresolvable macros (for parameterization)

**Interface:**
```javascript
class MacroResolver {
  /**
   * Resolves a macro expression
   * @param {object|string} value - Value that may contain macros
   * @param {object} context - Resolution context
   * @returns {object} { resolved: boolean, value: any }
   */
  resolve(value, context) {
    if (typeof value !== 'object') return { resolved: true, value };

    if (value.var) {
      return this.#resolveVar(value.var, context);
    }
    if (value.param) {
      return this.#resolveParam(value.param, context);
    }
    if (value.lookup) {
      return this.#resolveLookup(value.lookup, context);
    }

    // Recursively resolve object properties
    return this.#resolveObject(value, context);
  }

  /**
   * Builds resolution context from action
   * @param {object} actionDefinition - Action definition
   * @param {object} ruleDefinition - Rule definition
   * @returns {object} Resolution context
   */
  buildContext(actionDefinition, ruleDefinition) {
    return {
      parameters: actionDefinition.parameters || {},
      targets: actionDefinition.targets || {},
      variables: {},
      // Add more context sources
    };
  }
}
```

**Resolution Examples:**

```javascript
// Resolvable: Direct parameter reference
{ var: "componentType" } // context.parameters.componentType = "positioning:sitting"
// → { resolved: true, value: "positioning:sitting" }

// Resolvable: Lookup expression
{ lookup: { entity: "actor", field: "location" } }
// → { resolved: true, value: "bedroom" }

// Unresolvable: Runtime-dependent
{ var: "selectedItem" } // Not in static context
// → { resolved: false, value: "{selectedItem}" }
```

---

### Path Tracer

**Purpose**: Traces all possible execution paths through conditional operations

**Responsibilities:**
- Identifies conditional branches (IF, IF_CO_LOCATED)
- Traces each branch recursively
- Merges effects from multiple paths
- Detects path conditions (for conditional effects)

**Interface:**
```javascript
class PathTracer {
  /**
   * Traces execution paths through operations
   * @param {Array<object>} operations - Operations to trace
   * @param {object} context - Tracing context
   * @returns {Array<object>} Path analysis results
   */
  tracePaths(operations, context) {
    const paths = [];

    for (const operation of operations) {
      if (this.#isConditional(operation)) {
        const branches = this.#traceBranches(operation, context);
        paths.push(...branches);
      } else {
        paths.push({
          condition: null,
          effects: this.#analyzeOperation(operation, context)
        });
      }
    }

    return this.#mergePaths(paths);
  }

  /**
   * Traces conditional branches
   * @param {object} conditionalOp - IF or IF_CO_LOCATED operation
   * @param {object} context - Tracing context
   * @returns {Array<object>} Branch results
   */
  #traceBranches(conditionalOp, context) {
    const thenPath = {
      condition: conditionalOp.condition,
      effects: this.tracePaths(conditionalOp.then, context)
    };

    const elsePath = conditionalOp.else ? {
      condition: this.#negateCondition(conditionalOp.condition),
      effects: this.tracePaths(conditionalOp.else, context)
    } : null;

    return [thenPath, elsePath].filter(Boolean);
  }
}
```

**Path Tracing Example:**

```javascript
// Rule operation
{
  type: "IF",
  condition: { "==": [{"var": "trust"}, "high"] },
  then: [
    { type: "ADD_COMPONENT", entity: "actor", component: "test:happy" }
  ],
  else: [
    { type: "ADD_COMPONENT", entity: "actor", component: "test:neutral" }
  ]
}

// Traced paths
[
  {
    condition: { "==": [{"var": "trust"}, "high"] },
    effects: [
      { operation: "ADD_COMPONENT", entity: "actor", component: "test:happy" }
    ]
  },
  {
    condition: { "!=": [{"var": "trust"}, "high"] },
    effects: [
      { operation: "ADD_COMPONENT", entity: "actor", component: "test:neutral" }
    ]
  }
]
```

---

### Abstract Precondition Detector

**Purpose**: Identifies conditions that can't be evaluated during planning

**Responsibilities:**
- Detects runtime-dependent conditions
- Generates abstract precondition definitions
- Names preconditions descriptively
- Determines appropriate simulation functions

**Interface:**
```javascript
class AbstractPreconditionDetector {
  /**
   * Analyzes a condition and determines if it's abstract
   * @param {object} condition - JSON Logic condition
   * @param {object} context - Analysis context
   * @returns {object|null} Abstract precondition definition or null
   */
  analyzeCondition(condition, context) {
    // Check if condition references runtime-only values
    const unresolvedVars = this.#findUnresolvedVariables(condition, context);

    if (unresolvedVars.length === 0) {
      return null; // Concrete condition
    }

    return {
      name: this.#generateName(condition, unresolvedVars),
      description: this.#generateDescription(condition),
      parameters: this.#extractParameters(unresolvedVars),
      simulationFunction: this.#determineSimulation(condition)
    };
  }

  /**
   * Generates a descriptive name for abstract precondition
   * @param {object} condition - JSON Logic condition
   * @param {Array<string>} unresolvedVars - Unresolved variables
   * @returns {string} Precondition name
   */
  #generateName(condition, unresolvedVars) {
    // Examples:
    // { "==": [{"var": "target.trust"}, "high"] }
    // → "targetTrustIsHigh"

    // { ">": [{"var": "target.health"}, 50] }
    // → "targetHealthAbove50"
  }

  /**
   * Determines simulation function
   * @param {object} condition - JSON Logic condition
   * @returns {string} Simulation function name
   */
  #determineSimulation(condition) {
    // "assumeTrue" - Optimistic: assume condition is true
    // "assumeFalse" - Pessimistic: assume condition is false
    // "assumeRandom" - Probabilistic: random outcome
    // "evaluateAtRuntime" - Defer to runtime evaluation
  }
}
```

**Simulation Function Types:**

| Function | Behavior | Use Case |
|----------|----------|----------|
| `assumeTrue` | Always returns true | Optimistic planning (e.g., friendly NPCs) |
| `assumeFalse` | Always returns false | Pessimistic planning (e.g., hostile NPCs) |
| `assumeRandom` | Returns true 50% of time | Uncertain outcomes |
| `evaluateAtRuntime` | Deferred evaluation | Complex conditions requiring world state |

---

### Effects Generator

**Purpose**: Generates final planning effects JSON from analyzed operations

**Responsibilities:**
- Converts analyzed operations to planning effects format
- Estimates action costs
- Formats abstract preconditions
- Ensures schema compliance
- Generates effect documentation

**Interface:**
```javascript
class EffectsGenerator {
  /**
   * Generates planning effects from analyzed data
   * @param {object} analysisResult - Result from effects analyzer
   * @returns {object} Planning effects JSON
   */
  generate(analysisResult) {
    const effects = {
      effects: this.#formatEffects(analysisResult.effects),
      cost: this.#estimateCost(analysisResult),
    };

    if (analysisResult.abstractPreconditions.length > 0) {
      effects.abstractPreconditions = this.#formatPreconditions(
        analysisResult.abstractPreconditions
      );
    }

    return effects;
  }

  /**
   * Estimates action cost
   * @param {object} analysisResult - Analysis result
   * @returns {number} Estimated cost
   */
  #estimateCost(analysisResult) {
    // Base cost: 1.0
    // +0.1 per state-changing effect
    // +0.2 per conditional effect
    // +0.3 for complex operations (loops, etc.)

    let cost = 1.0;
    cost += analysisResult.effects.length * 0.1;
    cost += analysisResult.conditionals.length * 0.2;

    return Math.round(cost * 10) / 10; // Round to 1 decimal
  }

  /**
   * Formats effects for schema compliance
   * @param {Array<object>} effects - Analyzed effects
   * @returns {Array<object>} Formatted effects
   */
  #formatEffects(effects) {
    return effects.map(effect => {
      // Ensure all required fields present
      // Convert to schema-compliant format
      // Add effect metadata
    });
  }
}
```

---

### Effects Validator

**Purpose**: Validates generated effects against planning-effects schema

**Responsibilities:**
- Schema validation using AJV
- Semantic validation (e.g., component IDs valid)
- Error reporting with actionable messages
- Pre-validation before writing to action files

**Interface:**
```javascript
class EffectsValidator {
  /**
   * Validates planning effects
   * @param {object} effects - Planning effects to validate
   * @param {string} actionId - Action ID (for error messages)
   * @returns {object} { valid: boolean, errors: Array<string> }
   */
  validate(effects, actionId) {
    const schemaErrors = this.#validateSchema(effects);
    if (schemaErrors.length > 0) {
      return { valid: false, errors: schemaErrors };
    }

    const semanticErrors = this.#validateSemantics(effects, actionId);
    if (semanticErrors.length > 0) {
      return { valid: false, errors: semanticErrors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * Validates against JSON schema
   * @param {object} effects - Planning effects
   * @returns {Array<string>} Error messages
   */
  #validateSchema(effects) {
    const valid = this.#ajv.validate('planning-effects.schema.json', effects);
    if (!valid) {
      return this.#formatAjvErrors(this.#ajv.errors);
    }
    return [];
  }

  /**
   * Validates semantic correctness
   * @param {object} effects - Planning effects
   * @param {string} actionId - Action ID
   * @returns {Array<string>} Error messages
   */
  #validateSemantics(effects, actionId) {
    const errors = [];

    // Check component IDs are valid mod:component format
    // Check entity values are valid (actor, target, tertiary_target)
    // Check abstract preconditions are properly defined
    // Check cost is reasonable (< 100)

    return errors;
  }
}
```

---

## Data Flow

### Analysis Flow

```
1. Load Action + Rule
        ↓
2. Build Analysis Context
   - Action parameters
   - Target definitions
   - Initial variables
        ↓
3. Analyze Operations (recursive)
   - For each operation:
     - Lookup analyzer in registry
     - Resolve macros
     - Generate effects
     - If conditional: trace paths
        ↓
4. Identify Abstract Preconditions
   - Analyze conditions
   - Detect unresolvable variables
   - Generate precondition definitions
        ↓
5. Generate Planning Effects
   - Format effects
   - Estimate cost
   - Add preconditions
        ↓
6. Validate Effects
   - Schema validation
   - Semantic validation
        ↓
7. Return Planning Effects JSON
```

### Context Structure

```javascript
{
  // Static context (available during analysis)
  parameters: {
    componentType: "positioning:sitting",
    targetType: "actor"
  },
  targets: {
    primary: { entity: "target", required: true },
    secondary: { entity: "tertiary_target", required: false }
  },

  // Dynamic context (built during analysis)
  variables: {
    currentLocation: "bedroom",
    itemCount: 3
  },

  // Analysis state
  currentPath: [],
  abstractPreconditions: [],
  generatedEffects: []
}
```

---

## Operation Analysis Examples

### Example 1: Simple Component Addition

**Input Operation:**
```json
{
  "type": "ADD_COMPONENT",
  "entity": "actor",
  "component": "positioning:sitting"
}
```

**Analysis:**
1. Lookup analyzer: `addComponentAnalyzer`
2. Resolve macros: None to resolve
3. Generate effect:
   ```json
   {
     "operation": "ADD_COMPONENT",
     "entity": "actor",
     "component": "positioning:sitting"
   }
   ```

**Output:** Direct mapping

---

### Example 2: Conditional with Macro

**Input Operation:**
```json
{
  "type": "IF",
  "condition": { "var": "hasSpace" },
  "then": [
    {
      "type": "TRANSFER_ITEM",
      "itemId": { "var": "selectedItem" },
      "fromEntity": "actor",
      "toEntity": "target"
    }
  ]
}
```

**Analysis:**
1. Detect conditional operation
2. Analyze condition:
   - `hasSpace` not in context → abstract precondition
   - Generate precondition: `targetHasInventorySpace`
3. Trace `then` branch:
   - Analyze `TRANSFER_ITEM`
   - Resolve `selectedItem` → unresolvable → parameterize
   - Generate effects:
     ```json
     [
       {
         "operation": "REMOVE_COMPONENT",
         "entity": "actor",
         "component": "items:in_inventory",
         "componentId": "{selectedItem}"
       },
       {
         "operation": "ADD_COMPONENT",
         "entity": "target",
         "component": "items:in_inventory",
         "componentId": "{selectedItem}"
       }
     ]
     ```
4. Create conditional effect

**Output:**
```json
{
  "effects": [
    {
      "operation": "CONDITIONAL",
      "condition": {
        "abstractPrecondition": "targetHasInventorySpace",
        "params": ["target"]
      },
      "then": [
        {
          "operation": "REMOVE_COMPONENT",
          "entity": "actor",
          "component": "items:in_inventory",
          "componentId": "{selectedItem}"
        },
        {
          "operation": "ADD_COMPONENT",
          "entity": "target",
          "component": "items:in_inventory",
          "componentId": "{selectedItem}"
        }
      ]
    }
  ],
  "abstractPreconditions": {
    "targetHasInventorySpace": {
      "description": "Checks if target has inventory space",
      "parameters": ["target"],
      "simulationFunction": "assumeTrue"
    }
  }
}
```

---

### Example 3: Component-Based Operation

**Input Operation:**
```json
{
  "type": "LOCK_MOVEMENT",
  "entity": "actor"
}
```

**Analysis:**
1. Lookup analyzer: `lockMovementAnalyzer`
2. Analyzer knows this adds `positioning:movement_locked` component
3. Generate effect:
   ```json
   {
     "operation": "ADD_COMPONENT",
     "entity": "actor",
     "component": "positioning:movement_locked"
   }
   ```

**Output:** Maps to fundamental component operation

---

## Error Handling

### Unanalyzable Operations

When an operation can't be analyzed:

1. **Log warning** with operation type and context
2. **Skip operation** (no effect generated)
3. **Add comment** to generated effects indicating skipped operation
4. **Continue analysis** of remaining operations

Example:
```json
{
  "effects": [...],
  "_analysisWarnings": [
    "Skipped unanalyzable operation: CUSTOM_OPERATION at rule.operations[3]"
  ]
}
```

### Validation Failures

When generated effects fail validation:

1. **Log error** with validation details
2. **Throw exception** (analysis failure)
3. **Report to user** with actionable error message
4. **Prevent mod loading** until fixed

### Circular Dependencies

When macro resolution encounters circular references:

1. **Detect cycle** during resolution
2. **Mark as unresolvable** (parameterize)
3. **Log warning** about potential issue
4. **Continue analysis** with parameterized value

---

## Performance Considerations

### Caching

- **Operation analyzers**: Stateless, can be reused
- **Macro resolution**: Cache resolution results per context
- **Path tracing**: Memoize traced paths for identical operations

### Optimization Targets

- **Analysis time**: < 10ms per action (average)
- **Memory usage**: < 1MB per action analysis
- **Batch analysis**: 100+ actions per second

### Lazy Loading

- Load operation analyzers on-demand
- Build registry incrementally
- Cache validated effects for reuse

---

## Testing Strategy

### Unit Tests

**EffectsAnalyzer:**
- Test each operation type individually
- Test macro resolution scenarios
- Test path tracing with various conditionals
- Test error handling

**MacroResolver:**
- Test all macro types (`var`, `param`, `lookup`)
- Test nested macros
- Test unresolvable macros
- Test circular references

**PathTracer:**
- Test simple conditionals
- Test nested conditionals
- Test multiple branches
- Test path merging

**AbstractPreconditionDetector:**
- Test condition analysis
- Test name generation
- Test simulation function selection
- Test parameter extraction

### Integration Tests

- Test complete analysis pipeline
- Test with real action/rule definitions
- Test with complex multi-operation sequences
- Test validation integration

### Performance Tests

- Benchmark analysis time per action
- Measure memory usage
- Test batch analysis performance
- Identify bottlenecks

---

## Future Enhancements

### Phase 1 Extensions

- **Loop analysis**: Better handling of FOR_EACH operations
- **Cost refinement**: More sophisticated cost estimation
- **Effect optimization**: Merge redundant effects
- **Documentation generation**: Auto-generate effect descriptions

### Phase 2 Integration

- **Goal compatibility**: Analyze which goals action can satisfy
- **Precondition extraction**: Extract action preconditions from rule conditions
- **Effect probability**: Estimate effect success probability

### Phase 3 Features

- **State simulation**: Simulate effect application for validation
- **Effect composition**: Compose effects from multiple actions
- **Dynamic cost**: Runtime cost calculation based on world state

---

## References

- [Planning Effects Schema](../../data/schemas/planning-effects.schema.json)
- [Operation Mapping](./operation-mapping.md)
- [JSON Logic Documentation](https://jsonlogic.com/)
- [AJV Schema Validator](https://ajv.js.org/)
