# GOAP System Dismantling Analysis Report

**Report Date:** 2025-01-13  
**Author:** Claude (Anthropic)  
**Purpose:** Comprehensive analysis for complete GOAP system removal and future task-based reimplementation

---

## Executive Summary

The current GOAP (Goal-Oriented Action Planning) implementation is **fatally flawed** and must be completely dismantled. The fundamental error was attempting to auto-generate effects from existing actions under the false assumption that planning-time filters match execution-time filters. This approach failed because:

1. **Filter Divergence**: Action discovery's scope resolution and prerequisites apply at execution time with full context, while planning-time effects assume static, context-free conditions
2. **Impossible State Simulation**: The planner cannot accurately simulate future world states when action availability depends on dynamic runtime queries (ScopeDSL, JSON Logic)
3. **Architectural Mismatch**: Actions were designed for execution (rules → operations → handlers), not for declarative planning effects

**Recommendation:** Complete removal of GOAP system, preserving only the player type routing mechanism for future task-based reimplementation.

---

## Table of Contents

1. [Fatal Flaw Analysis](#fatal-flaw-analysis)
2. [Entry Points to PRESERVE](#entry-points-to-preserve)
3. [Files to REMOVE](#files-to-remove)
4. [Dependencies and Side Effects](#dependencies-and-side-effects)
5. [Removal Strategy](#removal-strategy)

---

## Fatal Flaw Analysis

### The Core Problem

The GOAP system attempted to generate planning effects by analyzing rule operations, mapping:

```javascript
// Rule operation:
{ type: "ADD_COMPONENT", entity: "actor", component: "positioning:sitting" }

// → Generated planning effect:
{ operation: "ADD_COMPONENT", entity: "actor", component: "positioning:sitting" }
```

**This approach assumes:**
- Planning-time preconditions match execution-time preconditions
- Action availability can be determined statically
- Future world states can be simulated without full execution context

**Reality:**
- Action discovery uses ScopeDSL for dynamic target selection
- Prerequisites use JSON Logic with runtime-only data
- forbidden_components, required_components check actual component existence
- Scope queries like `actor.location.entities[{...}]` require full world state traversal

### Example of the Failure

```javascript
// Action: "positioning:sit_down"
// Target scope: "actor.location.entities[{"==": [{"var": "component"}, "positioning:allows_sitting"]}]"

// GOAP Planning Time:
// ❌ Cannot evaluate scope - no access to full world state traversal
// ❌ Cannot determine which entities are valid targets
// ❌ Cannot simulate if action will be available in future state

// Execution Time:
// ✅ ScopeDSL engine traverses actual world state
// ✅ JSON Logic evaluates against real component data
// ✅ Action discovery returns concrete, executable actions
```

### Why Auto-Generation Failed

The effects analyzer tried to extract "ADD_COMPONENT" operations from rules and assume they represent planning effects. But:

1. **Conditional operations** in rules depend on runtime context variables
2. **Macro expansions** contain execution-specific logic (logging, events, validation)
3. **Abstract preconditions** (hasInventoryCapacity, hasComponent) require full component queries
4. **Data flow analysis** cannot predict which IF branches will execute without runtime state

**The fundamental error:** Confusing execution operations (what happens) with planning effects (what to expect). These are not the same.

---

## Entry Points to PRESERVE

### Critical: Player Type Component and Routing

**File:** `data/mods/core/components/player_type.component.json`

**Content:**
```json
{
  "id": "core:player_type",
  "description": "Indicates the type of player controlling this entity",
  "dataSchema": {
    "properties": {
      "type": {
        "type": "string",
        "enum": ["human", "llm", "goap"]
      }
    }
  }
}
```

**Why Preserve:** This component is the entry point for routing actor decisions to different providers. Future task-based implementation will use the same mechanism.

---

### Critical: Decision Provider Routing

**File:** `src/dependencyInjection/registrations/registerActorAwareStrategy.js`

**Relevant Code to Preserve:**
```javascript
providers: {
  human: c.resolve(tokens.IHumanDecisionProvider),
  llm: c.resolve(tokens.ILLMDecisionProvider),
  goap: c.resolve(tokens.IGoapDecisionProvider),  // Keep registration point
}

providerResolver: (actor) => {
  if (actor && typeof actor.getComponentData === 'function') {
    const playerTypeData = actor.getComponentData('core:player_type');
    if (playerTypeData?.type) {
      return playerTypeData.type; // 'human', 'llm', or 'goap'
    }
  }
  // Fallback logic...
}
```

**Why Preserve:** The routing mechanism is sound. The `IGoapDecisionProvider` token can be re-registered with a new task-based implementation without changing the routing logic.

---

### Critical: Decision Provider Token Registration

**File:** `src/dependencyInjection/registrations/aiRegistrations.js`

**Relevant Code:**
```javascript
registrar.singletonFactory(tokens.IGoapDecisionProvider, async (c) => {
  const goapTokensModule = await import('../tokens/tokens-goap.js');
  const { goapTokens } = goapTokensModule;
  return new GoapDecisionProvider({
    goalManager: c.resolve(goapTokens.IGoalManager),
    simplePlanner: c.resolve(goapTokens.ISimplePlanner),
    planCache: c.resolve(goapTokens.IPlanCache),
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
  });
});
```

**What to Preserve:** The registration structure and token (`tokens.IGoapDecisionProvider`). Replace implementation with new task-based provider.

**What to Remove:** The dependency imports from `goapTokens` module, the specific GOAP service resolutions.

---

### Critical: Actor Turn Handler Integration

**File:** `src/turns/factories/actorAwareStrategyFactory.js`

**Relevant Code:**
```javascript
providerResolver = (actor) => {
  // Check new player_type component first using Entity API
  if (actor && typeof actor.getComponentData === 'function') {
    const playerTypeData = actor.getComponentData('core:player_type');
    const normalisedType = normalisePlayerType(playerTypeData?.type);
    if (normalisedType) {
      return normalisedType; // Returns 'goap' for GOAP actors
    }
  }
  // Fallback logic...
}
```

**Why Preserve:** This is where the `core:player_type` component value triggers the decision provider selection. The logic is correct and will work with any future GOAP replacement.

---

### Summary of Preservation Points

| Component | File | Purpose | Preservation Reason |
|-----------|------|---------|---------------------|
| `core:player_type` component | `data/mods/core/components/player_type.component.json` | Defines player types including 'goap' | Entry point for future task-based system |
| Provider routing logic | `src/dependencyInjection/registrations/registerActorAwareStrategy.js` | Routes decisions based on player type | Mechanism is sound, just needs new implementation |
| Provider resolver | `src/turns/factories/actorAwareStrategyFactory.js` | Reads player_type and selects provider | Works correctly, no changes needed |
| `IGoapDecisionProvider` token | `src/dependencyInjection/tokens/tokens-core.js` | DI token for goap provider | Re-register with new task-based provider |
| Registration factory | `src/dependencyInjection/registrations/aiRegistrations.js` | Registers IGoapDecisionProvider | Replace implementation, keep structure |

---

## Files to REMOVE

### Source Code Files (src/)

#### GOAP Core Services (9 files)

| File Path | Purpose | Reason for Removal |
|-----------|---------|-------------------|
| `src/goap/generation/effectsGenerator.js` | Auto-generates effects from rules | Fatal flaw: assumes planning==execution |
| `src/goap/validation/effectsValidator.js` | Validates generated effects | No effects to validate after removal |
| `src/goap/analysis/effectsAnalyzer.js` | Analyzes rule operations | Cannot predict runtime behavior |
| `src/goap/goals/goalStateEvaluator.js` | Evaluates goal state conditions | Built for static effects model |
| `src/goap/goals/goalManager.js` | Selects goals by priority | Built for GOAP planning model |
| `src/goap/simulation/abstractPreconditionSimulator.js` | Simulates preconditions during planning | Cannot simulate without full execution |
| `src/goap/selection/actionSelector.js` | Selects actions toward goals | Greedy selection insufficient |
| `src/goap/planning/simplePlanner.js` | One-step greedy planner | Validation approach failed |
| `src/goap/planning/planCache.js` | Caches generated plans | No plans to cache |

#### Dependency Injection (3 files)

| File Path | Purpose | Reason for Removal |
|-----------|---------|-------------------|
| `src/dependencyInjection/tokens/tokens-goap.js` | GOAP-specific DI tokens | All GOAP services removed |
| `src/dependencyInjection/registrations/goapRegistrations.js` | Registers GOAP services | All GOAP services removed |
| `src/dependencyInjection/baseContainerConfig.js` | **PARTIAL UPDATE** - Remove `registerGoapServices` import/call | Keep file, remove GOAP registration only |

#### Decision Provider (1 file - REPLACE, don't remove)

| File Path | Action | Reason |
|-----------|--------|--------|
| `src/turns/providers/goapDecisionProvider.js` | **REPLACE IMPLEMENTATION** | Keep as placeholder or replace with task-based provider |

**Replacement Options:**
1. Revert to simple placeholder (return first action)
2. Implement basic task-based decision logic
3. Leave as stub for future task implementation

---

### Test Files (tests/)

#### Unit Tests (17 files)

| File Path | Purpose |
|-----------|---------|
| `tests/unit/goap/schemas/planningEffects.schema.test.js` | Schema validation tests |
| `tests/unit/goap/analysis/effectsAnalyzer.edgeCases.test.js` | Effects analyzer edge cases |
| `tests/unit/goap/analysis/effectsAnalyzer.test.js` | Effects analyzer core tests |
| `tests/unit/goap/analysis/effectsAnalyzer.additionalBranches.test.js` | Effects analyzer branch coverage |
| `tests/unit/goap/generation/effectsGenerator.validation.test.js` | Effects generator validation |
| `tests/unit/goap/generation/effectsGenerator.test.js` | Effects generator core tests |
| `tests/unit/goap/validation/effectsValidator.test.js` | Effects validator tests |
| `tests/unit/goap/goals/goalStateEvaluator.test.js` | Goal state evaluation tests |
| `tests/unit/goap/goals/goalManager.test.js` | Goal manager tests |
| `tests/unit/goap/simulation/abstractPreconditionSimulator.test.js` | Abstract precondition simulation tests |
| `tests/unit/goap/selection/actionSelector.test.js` | Action selector tests |
| `tests/unit/goap/planning/simplePlanner.test.js` | Simple planner tests |
| `tests/unit/goap/planning/planCache.test.js` | Plan cache tests |

#### Integration Tests (13 files)

| File Path | Purpose |
|-----------|---------|
| `tests/integration/goap/schemaIntegration.test.js` | Schema integration validation |
| `tests/integration/goap/effectsGeneration.integration.test.js` | Effects generation workflow |
| `tests/integration/goap/effectsValidation.integration.test.js` | Effects validation workflow |
| `tests/integration/goap/effectsGenerator.realDependencies.integration.test.js` | Generator with real dependencies |
| `tests/integration/goap/effectsValidation.realDependencies.integration.test.js` | Validator with real dependencies |
| `tests/integration/goap/effectsAnalyzer.integration.test.js` | Analyzer integration |
| `tests/integration/goap/goalSelection.integration.test.js` | Goal selection workflow |
| `tests/integration/goap/planning.integration.test.js` | Planning workflow |
| `tests/integration/goap/planCacheLogger.integration.test.js` | Plan cache logging |
| `tests/integration/goap/goalStateEvaluator.integration.test.js` | Goal state evaluator integration |
| `tests/integration/goap/actionSelection.integration.test.js` | Action selection workflow |
| `tests/integration/goap/abstractPreconditionSimulator.integration.test.js` | Precondition simulator integration |
| `tests/integration/goap/turnIntegration.test.js` | Turn system integration |
| `tests/integration/goap/goapWorkflow.integration.test.js` | Complete GOAP workflow |

#### E2E Tests (14 files)

| File Path | Purpose |
|-----------|---------|
| `tests/e2e/goap/catBehavior.e2e.test.js` | Cat NPC behavior scenarios |
| `tests/e2e/goap/multipleActors.e2e.test.js` | Multi-actor concurrency |
| `tests/e2e/goap/goblinBehavior.e2e.test.js` | Goblin NPC behavior scenarios |
| `tests/e2e/goap/CompleteGoapDecisionWithRealMods.e2e.test.js` | Complete decision workflow |
| `tests/e2e/goap/GoalPrioritySelectionWorkflow.e2e.test.js` | Goal priority selection |
| `tests/e2e/goap/ActionSelectionWithEffectSimulation.e2e.test.js` | Action selection with simulation |
| `tests/e2e/goap/PlanningEffectsMatchRuleExecution.e2e.test.js` | Effects vs execution validation |
| `tests/e2e/goap/PlanCachingAndInvalidation.e2e.test.js` | Plan caching strategies |
| `tests/e2e/goap/MultiActorConcurrentGoapDecisions.e2e.test.js` | Concurrent decision-making |
| `tests/e2e/goap/AbstractPreconditionConditionalEffects.e2e.test.js` | Abstract precondition handling |
| `tests/e2e/goap/MultiTurnGoalAchievement.e2e.test.js` | Multi-turn goal pursuit |
| `tests/e2e/goap/GoalRelevanceAndSatisfactionEvaluation.e2e.test.js` | Goal evaluation |
| `tests/e2e/goap/CrossModGoalAndActionInteraction.e2e.test.js` | Cross-mod interactions |
| `tests/e2e/goap/ErrorRecoveryAndGracefulDegradation.e2e.test.js` | Error handling |
| `tests/e2e/goap/EffectsValidationCLI.e2e.test.js` | CLI validation tool |
| `tests/e2e/goap/EffectsGenerationCLI.e2e.test.js` | CLI generation tool |

#### Performance & Memory Tests (2 files)

| File Path | Purpose |
|-----------|---------|
| `tests/performance/goap/effectsGeneration.performance.test.js` | Effects generation performance |
| `tests/performance/goap/GoapPlanningPerformance.test.js` | Planning performance benchmarks |
| `tests/memory/goap/GoapMemoryUsage.test.js` | Memory leak detection |

#### Test Helpers (1 file)

| File Path | Purpose |
|-----------|---------|
| `tests/common/goap/goapTestHelpers.js` | Shared test utilities |

**Total Test Files to Remove: 47 files**

---

### Documentation Files (docs/)

| File Path | Purpose | Removal Reason |
|-----------|---------|----------------|
| `docs/goap/README.md` | GOAP system overview | Describes failed architecture |
| `docs/goap/planning-system.md` | Planning, goals, action selection | Built on effects assumption |
| `docs/goap/effects-system.md` | Effects generation, analysis, runtime | Core flaw documentation |
| `docs/goap/operation-mapping.md` | Operation-to-effect mapping | Invalid mapping approach |
| `docs/goap/troubleshooting.md` | Common issues and solutions | No longer relevant |

**Total Documentation Files to Remove: 5 files**

---

### Specification Files (specs/)

| File Path | Purpose | Removal Reason |
|-----------|---------|----------------|
| `specs/goap-tier1-implementation.md` | Tier 1 implementation specification | Based on flawed effects approach |

**Total Spec Files to Remove: 1 file**

---

### Brainstorming Files (brainstorming/)

| File Path | Purpose | Removal Reason |
|-----------|---------|----------------|
| `brainstorming/goap-player-implementation-design.md` | GOAP design exploration | Historical design document |

**Total Brainstorming Files to Remove: 1 file**

---

### Report Files (reports/)

| File Path | Purpose | Action |
|-----------|---------|--------|
| `reports/goap-system-narrative-potential-blog-report.md` | GOAP narrative analysis | **KEEP** - Historical reference |
| `reports/goap-e2e-coverage-analysis.md` | E2E test coverage analysis | **KEEP** - Historical reference |

**Note:** These reports document the system that existed. They should be preserved as historical artifacts showing what was attempted and why it failed.

---

### Schema Files (data/schemas/)

| File Path | Purpose | Action |
|-----------|---------|--------|
| `data/schemas/planning-effects.schema.json` | Planning effects schema | **REMOVE** - Effects approach abandoned |
| `data/schemas/goal.schema.json` | Goal definition schema | **KEEP** - May be useful for task-based goals |

---

### Complete Removal Summary

| Category | File Count | Action |
|----------|------------|--------|
| Source Code (GOAP Core) | 9 | Remove completely |
| Source Code (DI) | 2 full + 1 partial | Remove completely + update 1 |
| Source Code (Provider) | 1 | Replace or stub |
| Unit Tests | 13 | Remove completely |
| Integration Tests | 14 | Remove completely |
| E2E Tests | 16 | Remove completely |
| Performance Tests | 2 | Remove completely |
| Memory Tests | 1 | Remove completely |
| Test Helpers | 1 | Remove completely |
| Documentation | 5 | Remove completely |
| Specifications | 1 | Remove completely |
| Brainstorming | 1 | Remove completely (keep in git history) |
| Reports | 0 | Keep both as historical reference |
| Schemas | 1 | Remove completely |
| **TOTAL FILES TO REMOVE** | **67 files** | |

---

## Dependencies and Side Effects

### Files That Import GOAP Code

#### Direct Imports to Update

**File:** `src/dependencyInjection/baseContainerConfig.js`

**Current Code:**
```javascript
import { registerGoapServices } from './registrations/goapRegistrations.js';

export function createContainer() {
  // ...
  registerGoapServices(container);
  // ...
}
```

**Update Required:**
```javascript
// Remove import
// Remove registerGoapServices call
```

---

**File:** `src/dependencyInjection/registrations/aiRegistrations.js`

**Current Code:**
```javascript
registrar.singletonFactory(tokens.IGoapDecisionProvider, async (c) => {
  const goapTokensModule = await import('../tokens/tokens-goap.js');
  const { goapTokens } = goapTokensModule;
  return new GoapDecisionProvider({
    goalManager: c.resolve(goapTokens.IGoalManager),
    simplePlanner: c.resolve(goapTokens.ISimplePlanner),
    planCache: c.resolve(goapTokens.IPlanCache),
    // ...
  });
});
```

**Update Required:**
```javascript
// Replace with placeholder or stub:
registrar.singletonFactory(tokens.IGoapDecisionProvider, (c) => {
  return new GoapDecisionProvider({
    logger: c.resolve(tokens.ILogger),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
  });
});

// GoapDecisionProvider becomes simple stub that returns first action
```

---

### Files That Reference But Don't Import

These files reference GOAP through the abstraction layers and will continue to work:

**File:** `src/dependencyInjection/registrations/registerActorAwareStrategy.js`
- **Reference:** Registers 'goap' provider in providers map
- **Impact:** None - will resolve the stub/replacement provider
- **Action:** No changes needed

**File:** `src/turns/factories/actorAwareStrategyFactory.js`
- **Reference:** Returns 'goap' from providerResolver
- **Impact:** None - continues to route to IGoapDecisionProvider
- **Action:** No changes needed

**File:** `src/turns/turnManager.js`
- **Reference:** None - uses decision provider abstraction
- **Impact:** None
- **Action:** No changes needed

---

### Goal Loading System

**File:** `src/loaders/goalLoader.js`

**Status:** Currently exists and loads goals from mods

**Decision Point:** Should we keep or remove the goal loader?

**Options:**
1. **KEEP** - Goals might be useful for task-based system
   - Goal schema could define high-level objectives for task selection
   - Simple priority-based goal system still valuable
   - Minimal maintenance burden

2. **REMOVE** - Goals were designed for GOAP planning
   - Current goal structure assumes planning effects
   - Task-based system may need different goal model
   - Can reintroduce if needed

**Recommendation:** **REMOVE** goal loader during GOAP dismantling. If task-based implementation needs goals, design a new goal schema specifically for that system rather than trying to adapt the GOAP goal model.

**Files to Remove:**
- `src/loaders/goalLoader.js`
- `data/schemas/goal.schema.json`
- Any test files for goalLoader (if they exist)

---

### Schema References

**File:** `data/schemas/action.schema.json`

**Current State:** May have been extended to include optional `planningEffects` field

**Check Required:**
```bash
grep -n "planningEffects" data/schemas/action.schema.json
```

**If Found:** Remove the `planningEffects` property definition from action schema

---

### Component System

**File:** `data/mods/core/components/player_type.component.json`

**Status:** **PRESERVE**

**Reason:** This is the entry point for the 'goap' player type. Keep the component definition intact. The enum value 'goap' remains valid even if current implementation is removed.

**No Changes Needed**

---

## Removal Strategy

### Phase 1: Preparation & Documentation (Week 1)

**Goals:**
- Document current state
- Create removal checklist
- Backup current implementation (git tag)
- Communicate removal plan to team

**Tasks:**
1. ✅ Create this dismantling analysis report
2. Create git tag: `goap-before-removal` for historical reference
3. Review files to remove (validate list completeness)
4. Identify any missed dependencies via grep:
   ```bash
   grep -r "goapTokens" src/
   grep -r "IGoalManager\|ISimplePlanner\|IPlanCache\|IEffects" src/
   grep -r "planningEffects" src/ data/
   ```
5. Create backup branch: `backup/goap-implementation`

---

### Phase 2: Core Removal (Week 1-2)

**Order of Operations:**

#### Step 1: Remove GOAP Core Services
**Why First:** These are the leaves of the dependency tree

```bash
# Remove GOAP core directories
rm -rf src/goap/generation/
rm -rf src/goap/validation/
rm -rf src/goap/analysis/
rm -rf src/goap/goals/
rm -rf src/goap/simulation/
rm -rf src/goap/selection/
rm -rf src/goap/planning/

# Should leave src/goap/ empty or remove it:
rmdir src/goap/ || rm -rf src/goap/
```

**Verification:**
```bash
# Should return empty:
ls src/goap/
```

---

#### Step 2: Remove DI Registrations
**Why Second:** Now that services are gone, remove their registrations

```bash
# Remove GOAP DI files
rm src/dependencyInjection/tokens/tokens-goap.js
rm src/dependencyInjection/registrations/goapRegistrations.js
```

**Update base container config:**
```javascript
// File: src/dependencyInjection/baseContainerConfig.js

// Remove this import:
// import { registerGoapServices } from './registrations/goapRegistrations.js';

// Remove this call:
// registerGoapServices(container);
```

---

#### Step 3: Update GoapDecisionProvider
**Why Third:** Replace with stub now that GOAP services removed

**Option A: Simple Stub (Recommended)**
```javascript
// File: src/turns/providers/goapDecisionProvider.js

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

export class GoapDecisionProvider extends DelegatingDecisionProvider {
  #logger;

  constructor({ logger, safeEventDispatcher }) {
    // Simple placeholder: pick first action
    const delegate = async (_actor, _context, actions) => {
      if (!Array.isArray(actions) || actions.length === 0) {
        this.#logger.debug('No actions available for GOAP actor');
        return { index: null };
      }
      
      this.#logger.debug('GOAP placeholder: selecting first action');
      return { index: actions[0].index };
    };

    super({ delegate, logger, safeEventDispatcher });
    this.#logger = logger;
  }
}

export default GoapDecisionProvider;
```

**Option B: Remove and Throw Error**
```javascript
export class GoapDecisionProvider extends DelegatingDecisionProvider {
  constructor({ logger, safeEventDispatcher }) {
    const delegate = async () => {
      throw new Error('GOAP system removed - use LLM player type instead');
    };
    super({ delegate, logger, safeEventDispatcher });
  }
}
```

**Update DI Registration:**
```javascript
// File: src/dependencyInjection/registrations/aiRegistrations.js

// Remove dynamic import of goapTokens
// Replace with simple construction:
registrar.singletonFactory(tokens.IGoapDecisionProvider, (c) => {
  return new GoapDecisionProvider({
    logger: c.resolve(tokens.ILogger),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
  });
});
```

---

#### Step 4: Remove Schemas
**Why Fourth:** Schema files can be safely removed now

```bash
rm data/schemas/planning-effects.schema.json

# Optionally remove goal schema (see decision above):
rm data/schemas/goal.schema.json
```

**Update action.schema.json:**
```bash
# Check if planningEffects was added:
grep -n "planningEffects" data/schemas/action.schema.json

# If found, manually edit to remove that property
```

---

#### Step 5: Remove Goal Loader (If Decided)
**Why Fifth:** If removing goals, do it after schemas removed

```bash
# If removing goal system:
rm src/loaders/goalLoader.js

# Check for test files:
find tests/ -name "*goalLoader*" -type f
# Remove any found
```

---

### Phase 3: Test Removal (Week 2)

**Why Separate Phase:** Test removal is straightforward but extensive

```bash
# Remove all GOAP test directories
rm -rf tests/unit/goap/
rm -rf tests/integration/goap/
rm -rf tests/e2e/goap/
rm -rf tests/performance/goap/
rm -rf tests/memory/goap/
rm -rf tests/common/goap/
```

**Verification:**
```bash
# Should return empty:
find tests/ -path "*/goap/*" -o -name "*goap*"
```

---

### Phase 4: Documentation Removal (Week 2)

```bash
# Remove GOAP documentation
rm -rf docs/goap/

# Remove specification files
rm specs/goap-tier1-implementation.md

# Remove brainstorming (will remain in git history)
rm brainstorming/goap-player-implementation-design.md

# Keep reports as historical reference (no removal)
```

---

### Phase 5: Verification & Testing (Week 2-3)

**Verification Checklist:**

1. **No Import Errors:**
   ```bash
   npm run typecheck
   ```

2. **No GOAP References Remaining:**
   ```bash
   # Should return minimal or no results:
   grep -r "goapTokens" src/
   grep -r "IEffectsAnalyzer\|IEffectsGenerator\|IGoalManager" src/
   grep -r "planningEffects" src/ data/
   ```

3. **Build Succeeds:**
   ```bash
   npm run build
   ```

4. **Unit Tests Pass:**
   ```bash
   npm run test:unit
   ```

5. **Integration Tests Pass:**
   ```bash
   npm run test:integration
   ```

6. **Player Type Routing Still Works:**
   - Create test with human player type → should route to human provider
   - Create test with llm player type → should route to LLM provider
   - Create test with goap player type → should route to stub provider (no error)

7. **No Missing Dependencies:**
   ```bash
   npm run start
   # Check console for DI resolution errors
   ```

---

### Phase 6: Commit & Document (Week 3)

**Git Workflow:**

```bash
# Create feature branch for removal
git checkout -b remove-goap-system

# Stage all removals
git add -A

# Commit with detailed message
git commit -m "Remove GOAP system completely

The GOAP (Goal-Oriented Action Planning) system is being removed due to a 
fatal architectural flaw: the system attempted to auto-generate planning 
effects from execution rules, assuming that planning-time filters would match 
execution-time filters. This assumption was incorrect because:

1. Action discovery uses dynamic ScopeDSL queries and JSON Logic prerequisites
   that cannot be evaluated during static planning
2. The planner cannot accurately simulate future world states without full
   execution context
3. Effects were execution operations, not declarative planning metadata

Changes:
- Removed all GOAP core services (9 files in src/goap/)
- Removed GOAP DI tokens and registrations (2 files)
- Replaced GoapDecisionProvider with simple stub (placeholder for future tasks)
- Removed all GOAP tests (47 files)
- Removed GOAP documentation (5 files in docs/goap/)
- Removed GOAP specifications and brainstorming (2 files)
- Removed planning-effects schema
- Updated aiRegistrations.js to use stub provider

Preserved:
- core:player_type component (entry point for future task-based system)
- Decision provider routing mechanism (works with stub)
- IGoapDecisionProvider token (can be re-registered with new implementation)
- Historical reports (goap-system-narrative-potential-blog-report.md, 
  goap-e2e-coverage-analysis.md)

Next Steps:
- Design task-based decision system with explicit planning primitives
- Implement task → action decomposition (not effect-based planning)
- Re-use player_type routing for new implementation

See: reports/goap-dismantling-analysis.md for complete analysis

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Create PR
gh pr create --title "Remove GOAP system" --body "$(cat <<'EOF'
## Summary

Complete removal of the GOAP (Goal-Oriented Action Planning) system due to fatal architectural flaw.

## Problem

The GOAP system attempted to auto-generate planning effects from execution rules, assuming planning-time preconditions would match execution-time preconditions. This assumption was incorrect:

- Action discovery uses dynamic ScopeDSL queries that require full world state traversal
- JSON Logic prerequisites depend on runtime-only data
- Cannot simulate future action availability without full execution context

## Changes

**Removed:**
- All GOAP core services (effects generation, goal management, planning, selection, simulation)
- GOAP dependency injection tokens and registrations
- All GOAP tests (unit, integration, e2e, performance, memory)
- All GOAP documentation and specifications
- planning-effects.schema.json

**Preserved:**
- core:player_type component (entry point for future task-based system)
- Decision provider routing mechanism
- IGoapDecisionProvider token (stub implementation)
- Historical reports as reference

**Modified:**
- GoapDecisionProvider now simple stub (picks first action)
- aiRegistrations.js uses stub provider

## Test Plan

- [x] All unit tests pass
- [x] All integration tests pass
- [x] Build completes successfully
- [x] Type checking passes
- [x] Player type routing still works (human, llm, goap)
- [x] No import errors or missing dependencies

## Next Steps

Future task-based decision system will:
- Use explicit task primitives (not auto-generated effects)
- Decompose tasks into actions at execution time
- Re-use the preserved player_type routing mechanism

See: reports/goap-dismantling-analysis.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

### Removal Checklist

Use this checklist to track progress:

**Preparation:**
- [ ] Create git tag `goap-before-removal`
- [ ] Create backup branch `backup/goap-implementation`
- [ ] Review this report with team
- [ ] Get approval to proceed

**Core Removal:**
- [ ] Remove src/goap/ directory (9 files)
- [ ] Remove src/dependencyInjection/tokens/tokens-goap.js
- [ ] Remove src/dependencyInjection/registrations/goapRegistrations.js
- [ ] Update src/dependencyInjection/baseContainerConfig.js
- [ ] Update src/turns/providers/goapDecisionProvider.js (stub)
- [ ] Update src/dependencyInjection/registrations/aiRegistrations.js

**Schema & Loader Removal:**
- [ ] Remove data/schemas/planning-effects.schema.json
- [ ] Remove data/schemas/goal.schema.json (if decided)
- [ ] Check/update data/schemas/action.schema.json
- [ ] Remove src/loaders/goalLoader.js (if decided)

**Test Removal:**
- [ ] Remove tests/unit/goap/ (13 files)
- [ ] Remove tests/integration/goap/ (14 files)
- [ ] Remove tests/e2e/goap/ (16 files)
- [ ] Remove tests/performance/goap/ (2 files)
- [ ] Remove tests/memory/goap/ (1 file)
- [ ] Remove tests/common/goap/ (1 file)

**Documentation Removal:**
- [ ] Remove docs/goap/ (5 files)
- [ ] Remove specs/goap-tier1-implementation.md
- [ ] Remove brainstorming/goap-player-implementation-design.md
- [ ] Keep reports/ files (historical reference)

**Verification:**
- [ ] Run npm run typecheck (passes)
- [ ] Run npm run build (succeeds)
- [ ] Run npm run test:unit (passes)
- [ ] Run npm run test:integration (passes)
- [ ] Grep for remaining GOAP references (minimal)
- [ ] Test player type routing (human, llm, goap all work)
- [ ] Check console for DI errors (none)

**Git Workflow:**
- [ ] Create feature branch `remove-goap-system`
- [ ] Stage all changes
- [ ] Commit with detailed message
- [ ] Create pull request
- [ ] Get code review approval
- [ ] Merge to main
- [ ] Tag release: `v1.x.x-goap-removed`

---

## Conclusion

The GOAP system removal is **extensive but straightforward**:

- **67 files to remove** (source, tests, docs, specs)
- **4 files to update** (DI registrations, provider stub, container config)
- **Critical preservation**: player_type component and routing mechanism

The preserved entry points provide a clean foundation for future task-based implementation without the flawed effects-generation approach.

**Key Lesson:** Planning systems require explicit, declarative planning primitives (tasks), not attempts to infer planning effects from execution code (rules). The next implementation must separate planning concerns from execution concerns from the ground up.

---

**End of Report**
