# EXPDIAPATSENANA-005: PathSensitiveAnalyzer Service - Branch Enumeration

## Summary

Create the `PathSensitiveAnalyzer` service with the core branch enumeration logic. This ticket implements the algorithm to parse JSON Logic trees, identify OR nodes, and enumerate all execution paths through OR branches.

## Priority: High | Effort: Medium

## Rationale

The core innovation of path-sensitive analysis is treating OR branches independently rather than merging all gates. This ticket implements the foundational logic to:
1. Parse JSON Logic prerequisite trees
2. Identify OR nodes (fork points)
3. Enumerate all distinct execution paths
4. Handle branch explosion limits

## Dependencies

- **EXPDIAPATSENANA-004** (PathSensitiveResult model)
- **EXPDIAPATSENANA-001** (AnalysisBranch model)
- Existing `IGateConstraintAnalyzer` service
- Existing `IIntensityBoundsCalculator` service
- Existing `IDataRegistry` service

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/PathSensitiveAnalyzer.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) |
| `tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement constraint calculation per branch - that's EXPDIAPATSENANA-006
- **DO NOT** implement knife-edge detection - that's EXPDIAPATSENANA-006
- **DO NOT** implement feasibility volume calculation - that's EXPDIAPATSENANA-009
- **DO NOT** modify existing GateConstraintAnalyzer or IntensityBoundsCalculator
- **DO NOT** create UI components - that's EXPDIAPATSENANA-008
- **DO NOT** modify existing models (AxisInterval, GateConstraint, DiagnosticResult)

## Implementation Details

### PathSensitiveAnalyzer Service (Branch Enumeration Only)

```javascript
/**
 * @file PathSensitiveAnalyzer - Path-sensitive static analysis for OR branches
 * @see specs/expression-diagnostics-path-sensitive-analysis.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import AnalysisBranch from '../models/AnalysisBranch.js';
import PathSensitiveResult from '../models/PathSensitiveResult.js';

/**
 * Default options for path-sensitive analysis
 */
const DEFAULT_OPTIONS = Object.freeze({
  maxBranches: 100,
  knifeEdgeThreshold: 0.02,
  computeVolume: false
});

class PathSensitiveAnalyzer {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #gateConstraintAnalyzer;

  /** @type {object} */
  #intensityBoundsCalculator;

  /** @type {object} */
  #logger;

  /**
   * @param {Object} deps
   * @param {object} deps.dataRegistry - IDataRegistry
   * @param {object} deps.gateConstraintAnalyzer - IGateConstraintAnalyzer
   * @param {object} deps.intensityBoundsCalculator - IIntensityBoundsCalculator
   * @param {object} deps.logger - ILogger
   */
  constructor({ dataRegistry, gateConstraintAnalyzer, intensityBoundsCalculator, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getLookupData']
    });
    validateDependency(gateConstraintAnalyzer, 'IGateConstraintAnalyzer', logger, {
      requiredMethods: ['analyze']
    });
    validateDependency(intensityBoundsCalculator, 'IIntensityBoundsCalculator', logger, {
      requiredMethods: ['analyzeExpression']
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error']
    });

    this.#dataRegistry = dataRegistry;
    this.#gateConstraintAnalyzer = gateConstraintAnalyzer;
    this.#intensityBoundsCalculator = intensityBoundsCalculator;
    this.#logger = logger;
  }

  /**
   * Analyze expression with path-sensitive OR handling.
   *
   * @param {object} expression - Expression with prerequisites
   * @param {object} [options] - Analysis options
   * @param {number} [options.maxBranches=100] - Limit for branch explosion
   * @param {number} [options.knifeEdgeThreshold=0.02] - Width below which interval is "knife-edge"
   * @param {boolean} [options.computeVolume=false] - Whether to compute feasibility volume
   * @returns {PathSensitiveResult}
   */
  analyze(expression, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!expression?.id) {
      throw new Error('PathSensitiveAnalyzer requires expression with id');
    }

    this.#logger.debug(`PathSensitiveAnalyzer: Analyzing ${expression.id}`);

    // 1. Build branch tree by traversing logic and forking at OR nodes
    const branchTree = this.#buildBranchTree(expression.prerequisites || []);

    // 2. Enumerate all paths (with explosion protection)
    const branches = this.#enumerateBranches(branchTree, opts.maxBranches);

    this.#logger.debug(`PathSensitiveAnalyzer: Enumerated ${branches.length} branches`);

    // Note: Constraint analysis (step 3-5) is implemented in EXPDIAPATSENANA-006
    // For now, return result with enumerated branches only

    return new PathSensitiveResult({
      expressionId: expression.id,
      branches,
      reachabilityByBranch: [], // Populated by EXPDIAPATSENANA-006
      feasibilityVolume: null   // Computed by EXPDIAPATSENANA-009
    });
  }

  /**
   * Build a tree structure representing the OR/AND logic.
   * @private
   * @param {Array} prerequisites
   * @returns {Object}
   */
  #buildBranchTree(prerequisites) {
    const tree = { type: 'root', children: [] };

    for (const prereq of prerequisites) {
      if (prereq?.logic) {
        tree.children.push(this.#parseLogicNode(prereq.logic));
      }
    }

    return tree;
  }

  /**
   * Parse a JSON Logic node into a tree structure.
   * @private
   * @param {*} logic
   * @returns {Object}
   */
  #parseLogicNode(logic) {
    if (!logic || typeof logic !== 'object') {
      return { type: 'leaf', logic, prototypes: [] };
    }

    if (logic.and) {
      return {
        type: 'and',
        children: logic.and.map(child => this.#parseLogicNode(child))
      };
    }

    if (logic.or) {
      return {
        type: 'or',
        children: logic.or.map(child => this.#parseLogicNode(child))
      };
    }

    // Leaf node (comparison, etc.) - extract prototype references
    const prototypes = this.#extractPrototypesFromLeaf(logic);
    return { type: 'leaf', logic, prototypes };
  }

  /**
   * Extract prototype IDs from a leaf node.
   * @private
   * @param {Object} logic
   * @returns {string[]}
   */
  #extractPrototypesFromLeaf(logic) {
    const prototypes = [];

    // Look for patterns like {"var": "emotions.flow"} or {"var": "sexualStates.aroused"}
    const varPath = this.#findVarPath(logic);
    if (varPath) {
      const parts = varPath.split('.');
      if (parts.length >= 2) {
        // emotions.flow -> flow, sexualStates.aroused -> aroused
        prototypes.push(parts[1]);
      }
    }

    return prototypes;
  }

  /**
   * Recursively find {"var": "..."} paths in logic.
   * @private
   * @param {*} obj
   * @returns {string|null}
   */
  #findVarPath(obj) {
    if (!obj || typeof obj !== 'object') return null;

    if (obj.var && typeof obj.var === 'string') {
      return obj.var;
    }

    // Search in arrays and nested objects
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          const result = this.#findVarPath(item);
          if (result) return result;
        }
      } else if (typeof value === 'object') {
        const result = this.#findVarPath(value);
        if (result) return result;
      }
    }

    return null;
  }

  /**
   * Enumerate all paths through the logic tree.
   * At each OR node, create a separate branch for each child.
   * @private
   * @param {Object} tree
   * @param {number} maxBranches
   * @returns {AnalysisBranch[]}
   */
  #enumerateBranches(tree, maxBranches) {
    const branches = [];
    let branchCounter = 0;

    /**
     * Recursive enumeration helper
     * @param {Object} node
     * @param {string[]} currentPrototypes - Prototypes accumulated so far
     * @param {string} pathPrefix - Path identifier prefix
     * @param {string[]} pathDescriptors - Human-readable path descriptions
     * @returns {Array<{prototypes: string[], description: string}>}
     */
    const enumeratePaths = (node, currentPrototypes, pathPrefix, pathDescriptors) => {
      if (branches.length >= maxBranches) {
        this.#logger.warn(`PathSensitiveAnalyzer: Branch limit (${maxBranches}) reached`);
        return [];
      }

      if (node.type === 'leaf') {
        // Leaf: add its prototypes to current path
        const newPrototypes = [...currentPrototypes, ...node.prototypes];
        return [{ prototypes: newPrototypes, descriptors: pathDescriptors }];
      }

      if (node.type === 'and' || node.type === 'root') {
        // AND/root: all children contribute to the same path
        let paths = [{ prototypes: [...currentPrototypes], descriptors: [...pathDescriptors] }];

        for (const child of node.children) {
          const newPaths = [];
          for (const path of paths) {
            const childResults = enumeratePaths(child, path.prototypes, pathPrefix, path.descriptors);
            newPaths.push(...childResults);
          }
          paths = newPaths;
        }

        return paths;
      }

      if (node.type === 'or') {
        // OR: fork into separate paths for each child
        const allPaths = [];

        for (let i = 0; i < node.children.length; i++) {
          if (branches.length >= maxBranches) break;

          const child = node.children[i];
          const childDescriptor = this.#generateBranchDescription(child);
          const newDescriptors = [...pathDescriptors, childDescriptor];

          const childPaths = enumeratePaths(
            child,
            [...currentPrototypes],
            `${pathPrefix}.${i}`,
            newDescriptors
          );

          allPaths.push(...childPaths);
        }

        return allPaths;
      }

      return [];
    };

    // Start enumeration
    const paths = enumeratePaths(tree, [], '0', []);

    // Convert paths to AnalysisBranch instances
    for (const path of paths) {
      if (branches.length >= maxBranches) break;

      const description = path.descriptors.length > 0
        ? path.descriptors.join(' → ')
        : 'Single path (no OR branches)';

      // Deduplicate prototypes
      const uniquePrototypes = [...new Set(path.prototypes)];

      branches.push(new AnalysisBranch({
        branchId: `branch_${branchCounter++}`,
        description,
        requiredPrototypes: uniquePrototypes
      }));
    }

    // If no branches were created (no OR nodes), create single branch with all prototypes
    if (branches.length === 0) {
      const allPrototypes = this.#collectAllPrototypes(tree);
      branches.push(new AnalysisBranch({
        branchId: 'branch_0',
        description: 'Single path (no OR branches)',
        requiredPrototypes: [...new Set(allPrototypes)]
      }));
    }

    return branches;
  }

  /**
   * Generate human-readable description for a branch node.
   * @private
   * @param {Object} node
   * @returns {string}
   */
  #generateBranchDescription(node) {
    if (node.type === 'leaf') {
      const prototypes = node.prototypes;
      if (prototypes.length > 0) {
        return `${prototypes.join('/')} path`;
      }
      return 'condition';
    }

    if (node.type === 'and') {
      const leafPrototypes = this.#collectAllPrototypes(node);
      if (leafPrototypes.length > 0) {
        return `${leafPrototypes.slice(0, 2).join('+')}${leafPrototypes.length > 2 ? '+...' : ''} path`;
      }
      return 'AND block';
    }

    if (node.type === 'or') {
      return 'nested OR';
    }

    return 'branch';
  }

  /**
   * Collect all prototypes from a subtree.
   * @private
   * @param {Object} node
   * @returns {string[]}
   */
  #collectAllPrototypes(node) {
    const prototypes = [];

    const collect = (n) => {
      if (n.type === 'leaf') {
        prototypes.push(...(n.prototypes || []));
      } else if (n.children) {
        for (const child of n.children) {
          collect(child);
        }
      }
    };

    collect(node);
    return prototypes;
  }
}

// Export default options for testing
PathSensitiveAnalyzer.DEFAULT_OPTIONS = DEFAULT_OPTIONS;

export default PathSensitiveAnalyzer;
```

### DI Token Addition

In `tokens-diagnostics.js`:
```javascript
IPathSensitiveAnalyzer: 'IPathSensitiveAnalyzer',
```

### DI Registration Addition

In `expressionDiagnosticsRegistrations.js`:
```javascript
import PathSensitiveAnalyzer from '../../expressionDiagnostics/services/PathSensitiveAnalyzer.js';

container.register(
  diagnosticsTokens.IPathSensitiveAnalyzer,
  (c) => new PathSensitiveAnalyzer({
    dataRegistry: c.resolve(tokens.IDataRegistry),
    gateConstraintAnalyzer: c.resolve(diagnosticsTokens.IGateConstraintAnalyzer),
    intensityBoundsCalculator: c.resolve(diagnosticsTokens.IIntensityBoundsCalculator),
    logger: c.resolve(tokens.ILogger),
  })
);
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js --verbose
```

### Unit Test Coverage Requirements

**pathSensitiveAnalyzer.test.js (Branch Enumeration):**
- Constructor throws if dataRegistry is missing
- Constructor throws if gateConstraintAnalyzer is missing
- Constructor throws if intensityBoundsCalculator is missing
- Constructor throws if logger is missing
- `analyze()` throws if expression has no id
- `analyze()` returns PathSensitiveResult
- `analyze()` handles expression with no prerequisites
- Branch enumeration creates single branch when no OR nodes present
- Branch enumeration creates N branches for single OR with N children
- Branch enumeration creates N*M branches for two sequential ORs
- Branch enumeration handles nested ORs correctly
- Branch enumeration respects maxBranches limit
- Branch enumeration logs warning when limit reached
- Branch descriptions are meaningful (include prototype names)
- Prototype extraction works for "emotions.flow" pattern
- Prototype extraction works for "sexualStates.aroused" pattern
- Prototypes are deduplicated within a branch
- Empty OR arrays handled gracefully
- Deeply nested AND blocks traversed correctly
- DEFAULT_OPTIONS exported and frozen

### Invariants That Must Remain True

1. **At least one branch always returned** - Even for no-OR expressions
2. **Branch count <= maxBranches** - Never exceeds limit
3. **Prototypes are deduplicated** - No duplicates in requiredPrototypes
4. **Branch IDs are unique** - Each branch has distinct ID
5. **Original expression not modified** - Pure analysis

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/pathSensitiveAnalyzer.test.js --verbose

# Type checking
npm run typecheck

# Verify DI registration
node -e "
import('./src/dependencyInjection/tokens/tokens-diagnostics.js').then(m => {
  console.log('Token exists:', !!m.diagnosticsTokens.IPathSensitiveAnalyzer);
});
"
```

## Definition of Done

- [ ] `PathSensitiveAnalyzer.js` created with branch enumeration logic
- [ ] `services/index.js` updated with export
- [ ] DI token added to `tokens-diagnostics.js`
- [ ] Service registered in `expressionDiagnosticsRegistrations.js`
- [ ] Unit tests cover branch enumeration algorithm
- [ ] Tests verify OR/AND/leaf node handling
- [ ] Tests verify maxBranches limit enforcement
- [ ] Tests verify prototype extraction
- [ ] JSDoc documentation complete
- [ ] All tests pass
- [ ] No modifications to existing services
