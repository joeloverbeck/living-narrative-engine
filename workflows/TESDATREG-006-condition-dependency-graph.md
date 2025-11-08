# TESDATREG-006: Condition Dependency Graph

**Priority**: Low
**Category**: Testing Infrastructure / Build System
**Timeline**: Long-term (Next Quarter)
**Effort**: Large (2-3 weeks)
**Related Report**: reports/test-dataregistry-scope-dsl-issues.md

## Overview

Build a comprehensive dependency graph of all conditions during mod loading, automatically resolve and validate transitive condition dependencies, and provide tooling to detect and prevent dependency issues before runtime. This system ensures that all `condition_ref` references are valid and that circular dependencies are detected early.

## Problem Statement

Currently, condition dependencies are:

1. **Resolved at runtime**: Errors only appear when a scope/condition is actually evaluated
2. **Not validated during mod loading**: Invalid `condition_ref` values pass silently
3. **Not analyzed for circular dependencies**: Circular refs cause infinite loops
4. **Not documented**: No tooling to visualize condition dependency trees
5. **Fragile in tests**: Each test must manually identify and load dependencies

This leads to:
- Runtime failures that should be caught at load time
- Difficult debugging when conditions reference missing conditions
- Potential for infinite loops with circular dependencies
- No visibility into the condition dependency structure
- Fragile test setup that breaks when dependencies change

## Success Criteria

- [ ] Condition dependency graph built during mod loading
- [ ] Automatic detection of all `condition_ref` usage
- [ ] Validation that all referenced conditions exist
- [ ] Detection of circular condition dependencies
- [ ] Topological sort for optimal loading order
- [ ] CLI tool to visualize dependency graph
- [ ] Export dependency graph to various formats (JSON, DOT, Mermaid)
- [ ] Integration with test environment for automatic loading
- [ ] Performance: Build graph for 500 conditions in < 1 second
- [ ] Unit tests with 95%+ coverage
- [ ] Integration tests with real mod data
- [ ] Documentation and tooling guide

## Proposed Architecture

### System Overview

```
┌────────────────────────────────────────────────────┐
│         Mod Loading Phase                          │
│                                                     │
│  1. Load all condition files                       │
│  2. Parse condition definitions                    │
│  3. Extract condition_ref usage                    │
│  4. Build dependency graph                         │
│  5. Detect circular dependencies                   │
│  6. Topological sort for load order                │
│  7. Validate all refs exist                        │
└──────────────────┬─────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────┐
│      ConditionDependencyGraph                      │
│                                                     │
│  - Graph data structure (nodes = conditions)       │
│  - Edge tracking (dependencies)                    │
│  - Circular dependency detection                   │
│  - Topological sorting                             │
│  - Query API for traversal                         │
└──────────────────┬─────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────┐
│         Tooling & Visualization                    │
│                                                     │
│  - CLI: condition-graph visualize                  │
│  - CLI: condition-graph validate                   │
│  - Export to DOT/Mermaid/JSON                      │
│  - Dependency reports                              │
└────────────────────────────────────────────────────┘
```

### Core Components

1. **ConditionDependencyGraph** - Graph data structure and operations
2. **ConditionDependencyAnalyzer** - Extracts dependencies from conditions
3. **ConditionDependencyValidator** - Validates graph integrity
4. **ConditionGraphBuilder** - Builds graph during mod loading
5. **ConditionGraphVisualizer** - Exports graph to various formats

## API Design

### ConditionDependencyGraph Class

```javascript
/**
 * Represents the dependency graph of all conditions in the system.
 */
class ConditionDependencyGraph {
  /**
   * Adds a condition node to the graph.
   *
   * @param {string} conditionId - The condition ID (e.g., "mod:condition")
   * @param {object} metadata - Condition metadata
   */
  addNode(conditionId, metadata)

  /**
   * Adds a dependency edge from one condition to another.
   *
   * @param {string} fromId - Source condition ID
   * @param {string} toId - Target condition ID (dependency)
   */
  addEdge(fromId, toId)

  /**
   * Gets all direct dependencies of a condition.
   *
   * @param {string} conditionId - The condition ID
   * @returns {Set<string>} Set of condition IDs this condition depends on
   */
  getDependencies(conditionId)

  /**
   * Gets all conditions that depend on this condition.
   *
   * @param {string} conditionId - The condition ID
   * @returns {Set<string>} Set of condition IDs that depend on this condition
   */
  getDependents(conditionId)

  /**
   * Gets all transitive dependencies (recursive).
   *
   * @param {string} conditionId - The condition ID
   * @param {number} maxDepth - Maximum recursion depth (default: 10)
   * @returns {Set<string>} All transitive dependencies
   */
  getTransitiveDependencies(conditionId, maxDepth = 10)

  /**
   * Detects circular dependencies in the graph.
   *
   * @returns {Array<string[]>} Array of circular dependency chains
   */
  detectCircularDependencies()

  /**
   * Performs topological sort to determine safe loading order.
   *
   * @returns {string[]} Condition IDs in safe loading order
   * @throws {Error} If circular dependencies exist
   */
  topologicalSort()

  /**
   * Validates the graph integrity.
   *
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validate()

  /**
   * Exports the graph to various formats.
   *
   * @param {string} format - Format: 'json', 'dot', 'mermaid'
   * @returns {string} Graph in requested format
   */
  export(format)

  /**
   * Gets graph statistics.
   *
   * @returns {object} Stats (node count, edge count, max depth, etc.)
   */
  getStats()
}
```

### ConditionDependencyAnalyzer Class

```javascript
/**
 * Analyzes condition definitions to extract dependencies.
 */
class ConditionDependencyAnalyzer {
  /**
   * Extracts all condition_ref references from a condition definition.
   * Recursively traverses the entire logic tree to find nested refs.
   *
   * @example
   * // Direct ref
   * { "condition_ref": "mod:other-condition" }
   *
   * // Nested in logic operators
   * { "and": [
   *   { "condition_ref": "mod:cond-1" },
   *   { "condition_ref": "mod:cond-2" }
   * ]}
   *
   * @param {object} conditionDef - Condition definition
   * @returns {Set<string>} Set of referenced condition IDs
   */
  static extractConditionRefs(conditionDef)

  /**
   * Analyzes all conditions in a mod and builds dependency info.
   *
   * @param {string} modId - The mod to analyze
   * @returns {Promise<Map<string, Set<string>>>} Map of conditionId -> dependencies
   */
  static async analyzeModConditions(modId)

  /**
   * Analyzes all conditions across multiple mods.
   *
   * @param {string[]} modIds - Mods to analyze
   * @returns {Promise<Map<string, Set<string>>>} Complete dependency mapping
   */
  static async analyzeAllConditions(modIds)
}
```

### ConditionGraphBuilder Class

```javascript
/**
 * Builds the condition dependency graph during mod loading.
 */
class ConditionGraphBuilder {
  /**
   * Builds the dependency graph for specified mods.
   *
   * @param {string[]} modIds - Mods to include
   * @param {object} options - Build options
   * @returns {Promise<ConditionDependencyGraph>} The built graph
   */
  static async build(modIds, options = {})

  /**
   * Incrementally updates the graph when a mod is added.
   *
   * @param {ConditionDependencyGraph} graph - Existing graph
   * @param {string} modId - Mod to add
   * @returns {Promise<void>}
   */
  static async addMod(graph, modId)

  /**
   * Removes a mod from the graph.
   *
   * @param {ConditionDependencyGraph} graph - Existing graph
   * @param {string} modId - Mod to remove
   * @returns {Promise<void>}
   */
  static async removeMod(graph, modId)
}
```

## Existing Implementation Analysis

### Current Circular Dependency Detection

**Location**: `src/utils/conditionRefResolver.js`

The codebase already contains runtime circular dependency detection:

```javascript
export function resolveConditionRefs(logic, repo, logger, visited = new Set()) {
  // ...
  if (visited.has(conditionId)) {
    throw new Error(
      `Circular condition_ref detected. Path: ${[...visited, conditionId].join(' -> ')}`
    );
  }
  visited.add(conditionId);
  // ... resolution logic ...
}
```

**Key Differences**:
- **Current**: Runtime detection (errors during action execution)
- **Proposed**: Build-time detection (errors during mod loading)

**Integration Strategy**:
1. Reuse `resolveConditionRefs` traversal logic in `ConditionDependencyAnalyzer`
2. Build-time graph provides **static analysis** before runtime
3. Runtime resolver remains as **fallback validation**

### Current Condition Loading Architecture

Conditions are currently loaded via:
- **Loader**: `src/loaders/conditionLoader.js` (extends SimpleItemLoader)
- **Phase**: Loaded during ContentPhase via ModProcessor
- **Storage**: Stored in dataRegistry under 'conditions' type

**Integration Point**:
- ConditionGraphPhase runs **after** ContentPhase (conditions already loaded)
- Graph analyzes already-loaded conditions from registry
- Graph validates references and structure

### Current Test Infrastructure

**Test Environment**: `tests/common/engine/systemLogicTestEnv.js`
- `createRuleTestEnvironment` (lines 66-100+)
- Uses `createBaseRuleEnvironment` with explicit `conditions` parameter
- Receives conditions as: `conditions = {}` parameter

**ModTestFixture**: `tests/common/mods/ModTestFixture.js`
- `forActionAutoLoad` already handles auto-loading (line 136)
- Uses file convention patterns for discovery
- Auto-loads rules and conditions automatically

**Current Pattern**:
```javascript
const testFixture = await ModTestFixture.forActionAutoLoad(
  'sex-anal-penetration',
  ACTION_ID
);
// Auto-loads rules and conditions automatically
```

## Implementation Details

### Files to Create

**⚠️ IMPORTANT**: The `src/conditions/` directory **does not currently exist**. This is a new directory that must be created.

**Alternative Option**: Place files in existing structure:
- `src/loaders/analysis/` for graph/analyzer classes
- `src/validation/` for validator class

**Decision Required**: Confirm directory structure approach before implementation.

1. **`src/conditions/conditionDependencyGraph.js`** (NEW DIRECTORY)
   - Graph data structure
   - Core graph operations
   - Circular dependency detection
   - Topological sort implementation

2. **`src/conditions/conditionDependencyAnalyzer.js`**
   - Dependency extraction logic
   - Mod analysis methods
   - Condition file parsing

3. **`src/conditions/conditionDependencyValidator.js`**
   - Graph validation logic
   - Error detection and reporting
   - Validation rules

4. **`src/conditions/conditionGraphBuilder.js`**
   - Graph construction during mod loading
   - Incremental updates
   - Integration with mod loading system

5. **`src/conditions/conditionGraphVisualizer.js`**
   - Export to DOT format (Graphviz)
   - Export to Mermaid format
   - Export to JSON
   - CLI integration

6. **`scripts/validate-condition-dependencies.js`**
   - CLI tool for visualization and validation
   - Commands: visualize, validate, stats, export
   - **Note**: Follows project naming convention (`validate:*`)

### Integration Points

#### Mod Loading Integration

**⚠️ CRITICAL**: ModsLoader uses **session-based phase architecture**, not direct method modification.

```javascript
// CREATE NEW PHASE: src/loaders/phases/ConditionGraphPhase.js

import LoaderPhase from './LoaderPhase.js';
import ConditionGraphBuilder from '../../conditions/conditionGraphBuilder.js';
import { ModsLoaderPhaseError } from '../../errors/modsLoaderPhaseError.js';

export default class ConditionGraphPhase extends LoaderPhase {
  async execute(context) {
    this.logger.debug('Building condition dependency graph...');

    const graph = await ConditionGraphBuilder.build(
      context.finalModOrder,  // From previous phases
      context.registry        // DataRegistry from context
    );

    // Validate graph integrity
    const validation = graph.validate();
    if (!validation.valid) {
      throw new ModsLoaderPhaseError(
        'ConditionGraphPhase',
        'VALIDATION_FAILED',
        'Condition dependency validation failed:\n' +
          validation.errors.map(e => `  - ${e}`).join('\n')
      );
    }

    // Detect circular dependencies
    const circular = graph.detectCircularDependencies();
    if (circular.length > 0) {
      throw new ModsLoaderPhaseError(
        'ConditionGraphPhase',
        'CIRCULAR_DEPENDENCIES',
        'Circular condition dependencies detected:\n' +
          circular.map(chain => `  - ${chain.join(' -> ')}`).join('\n')
      );
    }

    // Log statistics
    const stats = graph.getStats();
    this.logger.info(
      `Condition dependency graph: ${stats.nodeCount} conditions, ` +
      `${stats.edgeCount} dependencies, max depth ${stats.maxDepth}`
    );

    // Return updated context with graph (immutable pattern)
    return Object.freeze({
      ...context,
      conditionGraph: graph,
    });
  }
}

// REGISTER PHASE: Add to src/loaders/phases/index.js
export { default as ConditionGraphPhase } from './ConditionGraphPhase.js';

// INTEGRATE PHASE: Add to ModsLoadSession phase pipeline
import { ConditionGraphPhase } from './phases/index.js';

const phases = [
  // ... existing phases ...
  new ValidationPhase(logger),
  new ConditionGraphPhase(logger), // Add after validation, before rules
  // ... remaining phases ...
];
```

**Actual ModsLoader Signature**:
```javascript
// Current: loadMods(worldName, requestedModIds)
// NOT: loadMods(modIds)
```

#### Test Environment Integration

**Approach**: Enhance existing ModTestFixture with **opt-in** dependency graph support.

```javascript
// ENHANCE: tests/common/mods/ModTestFixture.js

class ModTestFixture {
  #conditionGraph = null;

  /**
   * Auto-load action with optional dependency graph construction.
   *
   * @param {string} modId - Mod identifier
   * @param {string} actionId - Full action ID (modId:actionName)
   * @param {object} options - Options
   * @param {boolean} options.buildDependencyGraph - Build graph for auto-loading
   * @returns {Promise<ModTestFixture>}
   */
  async forActionAutoLoad(modId, actionId, options = {}) {
    // ... existing auto-load logic ...

    if (options.buildDependencyGraph) {
      this.#conditionGraph = await ConditionGraphBuilder.build(
        [modId],
        this.testEnv.dataRegistry
      );

      // Auto-load dependencies in topological order
      const loadOrder = this.#conditionGraph.topologicalSort();
      for (const conditionId of loadOrder) {
        if (!this.testEnv.dataRegistry.has('conditions', conditionId)) {
          await this.#loadConditionFile(modId, conditionId);
        }
      }
    }

    return this;
  }

  /**
   * Get transitive dependencies for a condition (requires graph).
   *
   * @param {string} conditionId - Condition to query
   * @returns {Set<string>} All transitive dependencies
   * @throws {Error} If dependency graph not built
   */
  getConditionDependencies(conditionId) {
    if (!this.#conditionGraph) {
      throw new Error(
        'Dependency graph not built. Use buildDependencyGraph: true option'
      );
    }
    return this.#conditionGraph.getTransitiveDependencies(conditionId);
  }
}

// USAGE (OPT-IN, BACKWARD COMPATIBLE):
const fixture = await ModTestFixture.forActionAutoLoad(
  'violence',
  'violence:grab_neck',
  { buildDependencyGraph: true } // NEW: Opt-in dependency graph
);

// Diagnostic helper
const deps = fixture.getConditionDependencies('violence:actor-can-grab');
console.log('Transitive dependencies:', deps);
```

**Backward Compatibility**:
- Existing tests without `buildDependencyGraph: true` continue to work
- Graph construction is **opt-in** for performance
- No breaking changes to existing test patterns

## Detailed Implementation

### ConditionDependencyGraph

```javascript
// src/conditions/conditionDependencyGraph.js

class ConditionDependencyGraph {
  #nodes = new Map(); // conditionId -> { id, metadata }
  #edges = new Map(); // conditionId -> Set<conditionId> (dependencies)
  #reverseEdges = new Map(); // conditionId -> Set<conditionId> (dependents)

  addNode(conditionId, metadata = {}) {
    if (this.#nodes.has(conditionId)) {
      throw new Error(`Node "${conditionId}" already exists in graph`);
    }

    this.#nodes.set(conditionId, { id: conditionId, ...metadata });
    this.#edges.set(conditionId, new Set());
    this.#reverseEdges.set(conditionId, new Set());
  }

  addEdge(fromId, toId) {
    if (!this.#nodes.has(fromId)) {
      throw new Error(`Source node "${fromId}" does not exist`);
    }
    if (!this.#nodes.has(toId)) {
      throw new Error(`Target node "${toId}" does not exist`);
    }

    this.#edges.get(fromId).add(toId);
    this.#reverseEdges.get(toId).add(fromId);
  }

  getDependencies(conditionId) {
    return new Set(this.#edges.get(conditionId) || []);
  }

  getDependents(conditionId) {
    return new Set(this.#reverseEdges.get(conditionId) || []);
  }

  getTransitiveDependencies(conditionId, maxDepth = 10) {
    const visited = new Set();
    const queue = [{ id: conditionId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift();

      if (visited.has(id) || depth >= maxDepth) continue;
      visited.add(id);

      const deps = this.getDependencies(id);
      for (const depId of deps) {
        if (!visited.has(depId)) {
          queue.push({ id: depId, depth: depth + 1 });
        }
      }
    }

    visited.delete(conditionId); // Remove self
    return visited;
  }

  detectCircularDependencies() {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (nodeId, path) => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        cycle.push(nodeId); // Complete the cycle
        cycles.push(cycle);
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const deps = this.getDependencies(nodeId);
      for (const depId of deps) {
        dfs(depId, [...path]);
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.#nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  topologicalSort() {
    // Kahn's algorithm for topological sort
    const inDegree = new Map();
    const queue = [];
    const result = [];

    // Initialize in-degrees
    for (const nodeId of this.#nodes.keys()) {
      inDegree.set(nodeId, this.getDependents(nodeId).size);
      if (inDegree.get(nodeId) === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift();
      result.push(nodeId);

      const deps = this.getDependencies(nodeId);
      for (const depId of deps) {
        inDegree.set(depId, inDegree.get(depId) - 1);
        if (inDegree.get(depId) === 0) {
          queue.push(depId);
        }
      }
    }

    if (result.length !== this.#nodes.size) {
      throw new Error(
        'Cannot perform topological sort: circular dependencies detected'
      );
    }

    return result;
  }

  validate() {
    const errors = [];

    // Check for nodes with missing dependencies
    for (const [nodeId, deps] of this.#edges) {
      for (const depId of deps) {
        if (!this.#nodes.has(depId)) {
          errors.push(
            `Condition "${nodeId}" references missing dependency "${depId}"`
          );
        }
      }
    }

    // Check for circular dependencies
    const circular = this.detectCircularDependencies();
    if (circular.length > 0) {
      for (const cycle of circular) {
        errors.push(`Circular dependency: ${cycle.join(' -> ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  export(format) {
    switch (format) {
      case 'json':
        return this.#exportJSON();
      case 'dot':
        return this.#exportDOT();
      case 'mermaid':
        return this.#exportMermaid();
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  #exportJSON() {
    const nodes = Array.from(this.#nodes.values());
    const edges = [];

    for (const [fromId, deps] of this.#edges) {
      for (const toId of deps) {
        edges.push({ from: fromId, to: toId });
      }
    }

    return JSON.stringify({ nodes, edges }, null, 2);
  }

  #exportDOT() {
    let dot = 'digraph ConditionDependencies {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const nodeId of this.#nodes.keys()) {
      const label = nodeId.replace(/:/g, ':\\n');
      dot += `  "${nodeId}" [label="${label}"];\n`;
    }

    dot += '\n';

    // Add edges
    for (const [fromId, deps] of this.#edges) {
      for (const toId of deps) {
        dot += `  "${fromId}" -> "${toId}";\n`;
      }
    }

    dot += '}\n';
    return dot;
  }

  #exportMermaid() {
    let mermaid = 'graph LR\n';

    for (const [fromId, deps] of this.#edges) {
      for (const toId of deps) {
        const fromLabel = fromId.replace(/:/g, ':');
        const toLabel = toId.replace(/:/g, ':');
        mermaid += `  ${fromLabel} --> ${toLabel}\n`;
      }
    }

    return mermaid;
  }

  getStats() {
    const depths = new Map();

    const calculateDepth = (nodeId) => {
      if (depths.has(nodeId)) return depths.get(nodeId);

      const deps = this.getDependencies(nodeId);
      if (deps.size === 0) {
        depths.set(nodeId, 0);
        return 0;
      }

      let maxDepth = 0;
      for (const depId of deps) {
        const depDepth = calculateDepth(depId);
        maxDepth = Math.max(maxDepth, depDepth + 1);
      }

      depths.set(nodeId, maxDepth);
      return maxDepth;
    };

    for (const nodeId of this.#nodes.keys()) {
      calculateDepth(nodeId);
    }

    const depthValues = Array.from(depths.values());

    return {
      nodeCount: this.#nodes.size,
      edgeCount: Array.from(this.#edges.values()).reduce(
        (sum, deps) => sum + deps.size,
        0
      ),
      maxDepth: Math.max(...depthValues, 0),
      avgDepth: depthValues.reduce((sum, d) => sum + d, 0) / depthValues.length || 0,
      isolatedNodes: Array.from(this.#nodes.keys()).filter(
        id => this.getDependencies(id).size === 0 &&
               this.getDependents(id).size === 0
      ).length,
    };
  }
}

export default ConditionDependencyGraph;
```

## CLI Tool

### Command Structure

```bash
# Visualize dependency graph
npm run validate:condition-graph -- visualize [--format dot|mermaid|json] [--output file]

# Validate all condition dependencies
npm run validate:condition-graph -- validate [--mods mod1,mod2]

# Show statistics
npm run condition-graph:stats [--mods mod1,mod2]

# Export graph (alternative command)
npm run condition-graph:visualize -- --format dot --output graph.dot

# Find dependencies of a condition
npm run condition-graph:deps -- positioning:actor-facing

# Find what depends on a condition
npm run condition-graph:dependents -- positioning:actor-facing
```

**Note**: Follows existing project naming convention (`validate:*`, `command:subcommand`)

### CLI Implementation

```javascript
// scripts/validate-condition-dependencies.js

import ConditionGraphBuilder from '../src/conditions/conditionGraphBuilder.js';

const commands = {
  async visualize(args) {
    const format = args.format || 'mermaid';
    const graph = await ConditionGraphBuilder.build(args.mods || ['core']);

    const output = graph.export(format);

    if (args.output) {
      await fs.writeFile(args.output, output);
      console.log(`Graph exported to ${args.output}`);
    } else {
      console.log(output);
    }
  },

  async validate(args) {
    const graph = await ConditionGraphBuilder.build(args.mods || ['core']);
    const validation = graph.validate();

    if (validation.valid) {
      console.log('✓ All condition dependencies are valid');
    } else {
      console.error('✗ Validation errors:');
      validation.errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }
  },

  async stats(args) {
    const graph = await ConditionGraphBuilder.build(args.mods || ['core']);
    const stats = graph.getStats();

    console.log('Condition Dependency Statistics:');
    console.log(`  Total conditions: ${stats.nodeCount}`);
    console.log(`  Total dependencies: ${stats.edgeCount}`);
    console.log(`  Maximum depth: ${stats.maxDepth}`);
    console.log(`  Average depth: ${stats.avgDepth.toFixed(2)}`);
    console.log(`  Isolated conditions: ${stats.isolatedNodes}`);
  },

  async deps(args) {
    const conditionId = args._[1];
    if (!conditionId) {
      console.error('Usage: condition-graph deps <conditionId>');
      process.exit(1);
    }

    const graph = await ConditionGraphBuilder.build(args.mods || ['core']);
    const deps = graph.getTransitiveDependencies(conditionId);

    console.log(`Dependencies of ${conditionId}:`);
    if (deps.size === 0) {
      console.log('  (none)');
    } else {
      Array.from(deps).sort().forEach(id => console.log(`  - ${id}`));
    }
  },

  async dependents(args) {
    const conditionId = args._[1];
    if (!conditionId) {
      console.error('Usage: condition-graph dependents <conditionId>');
      process.exit(1);
    }

    const graph = await ConditionGraphBuilder.build(args.mods || ['core']);
    const dependents = graph.getDependents(conditionId);

    console.log(`Conditions that depend on ${conditionId}:`);
    if (dependents.size === 0) {
      console.log('  (none)');
    } else {
      Array.from(dependents).sort().forEach(id => console.log(`  - ${id}`));
    }
  },
};

// Parse args and run command
const args = parseArgs(process.argv.slice(2));
const command = args._[0];

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  console.error('Available commands: visualize, validate, stats, deps, dependents');
  process.exit(1);
}

await commands[command](args);
```

## Testing Requirements

### Unit Tests

**Location**: `tests/unit/conditions/` (directory exists with 4 test files currently)

1. **`tests/unit/conditions/conditionDependencyGraph.test.js`**
   - Node/edge operations
   - Circular dependency detection
   - Topological sort
   - Export formats
   - Statistics calculation

2. **`tests/unit/conditions/conditionDependencyAnalyzer.test.js`**
   - Dependency extraction
   - Mod analysis
   - Edge cases

3. **`tests/unit/conditions/conditionGraphBuilder.test.js`**
   - Graph construction
   - Incremental updates
   - Error handling

### Integration Tests

**Location**: `tests/integration/conditions/` (directory exists with 1 test file currently)

**Note**: Limited existing integration test coverage (~12 tests total use `systemLogicTestEnv`). New tests will establish patterns for future condition integration testing.

1. **`tests/integration/conditions/conditionDependencyGraph.integration.test.js`**
   - Real mod data
   - Full graph construction
   - Validation with actual conditions

2. **`tests/integration/conditions/conditionGraphCLI.integration.test.js`**
   - CLI tool execution
   - Export formats
   - Validation reports

**Alignment**: Follow patterns from `docs/testing/mod-testing-guide.md` for consistency with existing test infrastructure.

## Performance Targets

**Current Mod Ecosystem**: ~30 mods with conditions

**Baseline Targets** (scaled to realistic numbers):
- **Graph construction**: 100-200 conditions in < 1 second
- **Circular detection**: 200 nodes in < 500ms
- **Topological sort**: 200 nodes in < 300ms
- **Export**: Any format < 200ms
- **Memory**: < 20MB for 200 conditions

**Aspirational Targets** (10x current ecosystem):
- **Graph construction**: 500 conditions in < 2 seconds
- **Circular detection**: 1000 nodes in < 1 second
- **Topological sort**: 1000 nodes in < 500ms
- **Memory**: < 50MB for 1000 conditions

**Implementation Note**: Add baseline measurement task in Week 1 checklist to establish actual performance before optimization.

## Documentation Updates

1. **Create**: `docs/conditions/dependency-graph.md`
   - Architecture overview
   - Usage guide
   - CLI tool reference

2. **Create**: `docs/conditions/condition-graph-cli.md`
   - CLI command reference
   - Examples
   - Troubleshooting

3. **Update**: `docs/testing/mod-testing-guide.md`
   - How tests use the dependency graph
   - Automatic condition loading

## Acceptance Tests

- [ ] Graph correctly represents all condition dependencies
- [ ] Circular dependencies are detected
- [ ] Topological sort produces valid ordering
- [ ] Missing dependencies are reported
- [ ] Export to DOT format works
- [ ] Export to Mermaid format works
- [ ] Export to JSON format works
- [ ] CLI tool works for all commands
- [ ] Integration with mod loading works
- [ ] Integration with test environment works
- [ ] Performance targets met
- [ ] Unit tests achieve 95%+ coverage
- [ ] Integration tests cover all major scenarios
- [ ] Documentation is comprehensive

## Dependencies

### Runtime Dependencies
- **None** - Can be implemented with existing project dependencies

### Optional Dependencies (for enhanced functionality)
- **Graphviz** (`graphviz` npm package) - For rendering DOT format to PNG/SVG
- **Mermaid CLI** (`@mermaid-js/mermaid-cli`) - For rendering Mermaid diagrams
- **Note**: Exports are text-based by default; rendering packages optional

### Feature Flags
- `VALIDATE_CONDITION_DEPS` - Environment variable to enable/disable validation
- Default: `false` (opt-in initially)
- Future: `true` (after validation period)

### Integration Dependencies
- Requires ContentPhase to complete before ConditionGraphPhase
- Requires dataRegistry to be populated with conditions
- ModTestFixture enhancements are backward-compatible (no dependencies)

## Blockers

- None

## Implementation Risk Assessment

### High Risk Areas

1. **Phase Integration Timing**
   - Risk: Graph builds before conditions loaded or after rules validated
   - Mitigation: Clear phase ordering documentation, integration tests

2. **Backward Compatibility**
   - Risk: Breaking existing tests that don't use dependency graph
   - Mitigation: Opt-in approach, extensive regression testing

3. **Performance Impact**
   - Risk: Graph construction slows down every mod load
   - Mitigation: Feature flag, caching strategy, performance benchmarks

### Mitigation Strategies

#### Phased Rollout (4 Weeks)
```
Week 1: Core graph implementation (no integration)
  - Graph data structure
  - Unit tests
  - No codebase changes

Week 2: CLI tooling (standalone validation)
  - Command-line tools
  - Export formats
  - Can be used independently

Week 3: Optional mod loading integration (flag-controlled)
  - LoaderPhase with VALIDATE_CONDITION_DEPS flag
  - Disabled by default
  - Can be tested in isolation

Week 4: Test environment enhancement (opt-in)
  - ModTestFixture.buildDependencyGraph option
  - Backward compatible
  - Gradual adoption
```

#### Feature Flag Strategy
```javascript
// Environment-controlled validation
const ENABLE_CONDITION_GRAPH = process.env.VALIDATE_CONDITION_DEPS === 'true';

// Phase registration
const phases = [
  new ValidationPhase(logger),
  ...(ENABLE_CONDITION_GRAPH ? [new ConditionGraphPhase(logger)] : []),
  // ... remaining phases ...
];
```

#### Caching Strategy
```javascript
// Cache graph between test runs
class ConditionGraphCache {
  static #cache = new Map();
  static #modTimestamps = new Map();

  static get(modIds) {
    const key = modIds.sort().join(',');
    const cached = this.#cache.get(key);

    // Invalidate if any condition file changed
    if (cached && !this.#hasChanges(modIds)) {
      return cached;
    }

    return null;
  }

  static set(modIds, graph) {
    const key = modIds.sort().join(',');
    this.#cache.set(key, graph);
    this.#recordTimestamps(modIds);
  }

  static #hasChanges(modIds) {
    // Check file modification times
    // Invalidate cache if any condition file changed
  }
}
```

### Pre-Implementation Validation Checklist

Before beginning implementation, validate:

- [ ] Confirm `src/conditions/` directory creation approved
- [ ] Verify LoaderPhase integration pattern correct
- [ ] Validate ModTestFixture enhancement approach acceptable
- [ ] Confirm backward compatibility requirements clear
- [ ] Review performance target expectations realistic
- [ ] Approve CLI naming conventions (`validate:*`, `command:subcommand`)
- [ ] Confirm opt-in vs mandatory validation strategy
- [ ] Establish baseline performance measurements approach
- [ ] Define feature flag rollout timeline
- [ ] Document cache invalidation strategy

## Related Tickets

- **TESDATREG-003**: Uses similar analysis logic (can share code)
- **TESDATREG-005**: Can integrate with unified scope registry
- **TESDATREG-007**: Test helpers will use the graph

## Implementation Checklist

### Week 1: Core Graph Implementation
- [ ] **Measure baseline**: Profile current condition loading performance
- [ ] Implement ConditionDependencyGraph class
- [ ] Implement node/edge operations
- [ ] Implement circular dependency detection (DFS)
- [ ] Implement topological sort (Kahn's algorithm)
- [ ] Implement validation logic
- [ ] Create unit tests for graph operations
- [ ] Achieve 95%+ coverage
- [ ] **Verify performance**: Ensure graph operations meet baseline targets

### Week 2: Analysis and Building
- [ ] Implement ConditionDependencyAnalyzer
- [ ] Implement dependency extraction logic
- [ ] Implement ConditionGraphBuilder
- [ ] Integrate with mod loading system
- [ ] Create unit tests for analyzer and builder
- [ ] Create integration tests with real mods

### Week 3: Visualization and Tooling
- [ ] Implement export to DOT format
- [ ] Implement export to Mermaid format
- [ ] Implement export to JSON format
- [ ] Implement CLI tool
- [ ] Add all CLI commands
- [ ] Create CLI integration tests
- [ ] Write documentation

### Week 3: Integration and Polish
- [ ] Integrate with test environment
- [ ] Integrate with ModTestFixture
- [ ] Performance testing and optimization
- [ ] Error message improvements
- [ ] Final documentation
- [ ] User guide and examples
- [ ] Migration guide

## Notes

- This is a foundational system that will benefit both runtime and tests
- Should be opt-in initially with flag to enable validation
- Performance is critical - must not slow down mod loading significantly
- Visualization tools will help developers understand complex dependency chains
- Consider caching the graph to avoid rebuilding on every load

## Workflow Validation Summary

**Last Validated**: 2025-11-08
**Validator**: workflow-assumptions-validator agent
**Status**: ✅ Corrected

### Major Corrections Applied

1. ✅ **Added "Existing Implementation Analysis" section**
   - Documented current `conditionRefResolver.js` runtime detection
   - Clarified build-time vs runtime validation difference
   - Noted current condition loading architecture

2. ✅ **Corrected file location assumptions**
   - Flagged that `src/conditions/` directory doesn't exist
   - Provided alternative placement options
   - Marked as design decision point

3. ✅ **Fixed ModsLoader integration pattern**
   - Replaced direct method modification with LoaderPhase pattern
   - Updated to use immutable LoadContext pattern
   - Corrected method signature: `loadMods(worldName, requestedModIds)`

4. ✅ **Revised test environment integration**
   - Changed from replacement to enhancement approach
   - Made dependency graph opt-in via flag
   - Ensured backward compatibility

5. ✅ **Updated CLI naming conventions**
   - Changed to `validate:condition-graph` pattern
   - Added `condition-graph:*` subcommands
   - Follows existing project standards

6. ✅ **Added implementation risk assessment**
   - Documented phased rollout strategy
   - Added feature flag approach
   - Included caching strategy

7. ✅ **Scaled performance targets**
   - Updated to realistic numbers (100-200 conditions)
   - Referenced actual mod count (~30 mods)
   - Added baseline measurement task

8. ✅ **Clarified dependencies**
   - No new runtime dependencies
   - Optional rendering packages documented
   - Feature flag strategy defined

9. ✅ **Enhanced test organization notes**
   - Added context about limited existing coverage
   - Positioned as pattern establishment
   - Referenced mod-testing-guide.md

10. ✅ **Improved ConditionDependencyAnalyzer documentation**
    - Added recursive traversal examples
    - Documented nested ref handling
    - Clarified JSON Logic integration

### Confidence Level
**95%** - All assumptions validated against actual codebase structure, patterns, and APIs.

### Recommendation
Workflow is now aligned with actual codebase patterns and can proceed to implementation after pre-implementation validation checklist is completed.
