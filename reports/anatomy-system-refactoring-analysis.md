# Anatomy System Refactoring Analysis Report

**Date**: 2025-11-03
**Focus**: Architecture Analysis & Resilience Improvements
**Status**: Critical Brittleness Identified

---

## Executive Summary

The Living Narrative Engine's anatomy system experienced **massive regressions** during recent test fixes, breaking body part generation and clothing assignment. Root cause analysis reveals **critical architectural brittleness** stemming from tight coupling, lack of validation, and synchronization requirements between key components.

### Key Findings

🔴 **Critical**: SlotGenerator and SocketGenerator must maintain perfect synchronization but share no common code
🔴 **Critical**: Pattern matching failures are silent, cascading into runtime failures
🔴 **Critical**: Hard-coded component dependencies create fragile coupling

🟡 **Important**: No load-time validation of blueprint-recipe consistency
🟡 **Important**: Template changes cascade through system with no safety nets

### Recommended Priorities

1. **Immediate** (Week 1): Extract shared orientation resolution module
2. **Short-term** (Weeks 2-4): Add validation at load time, improve error messages
3. **Long-term** (Months 1-3): Decouple clothing integration, formalize contracts, comprehensive testing

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Root Cause of Recent Regressions](#root-cause-of-recent-regressions)
3. [Brittleness Analysis](#brittleness-analysis)
4. [Refactoring Strategy](#refactoring-strategy)
5. [Implementation Recommendations](#implementation-recommendations)
6. [Testing Strategy](#testing-strategy)
7. [Appendices](#appendices)

---

## Current Architecture Overview

### Design Philosophy

The anatomy system follows a **"Blueprint → Recipe → Instance"** generation pipeline:

```
1. Blueprint Definition (data/mods/*/anatomy/blueprints/)
   ↓
2. Structure Template Processing (V2) or Manual Slots (V1)
   ↓
3. Recipe Pattern Matching (data/mods/*/anatomy/recipes/)
   ↓
4. Part Selection & Entity Graph Building
   ↓
5. Instance Creation (Runtime Entities)
```

### Key Architectural Patterns

#### 1. **Blueprint System** (V1 vs V2)

**V1 Blueprints** - Explicit slot definitions:
```json
{
  "id": "anatomy:humanoid_body",
  "slots": {
    "left_hand": { "type": "hand", "allowedTypes": ["hand"] },
    "right_hand": { "type": "hand", "allowedTypes": ["hand"] }
  }
}
```

**V2 Blueprints** - Template-based generation:
```json
{
  "id": "anatomy:octopoid_body",
  "structureTemplate": "anatomy:structure_octopoid",
  "structureParameters": {
    "tentacleCount": 8,
    "eyeCount": 2
  }
}
```

**Trade-offs**:
- V1: Verbose but explicit, easier to debug
- V2: Concise but more complex dependency chain, harder to debug

#### 2. **Recipe System** (Pattern Matching)

**V1 Patterns** - Explicit matches:
```json
{
  "matches": ["left_hand", "right_hand"],
  "partType": "anatomy:human_hand"
}
```

**V2 Patterns** - Enhanced matchers:
```json
{
  "matchesGroup": "limbSet:tentacle",
  "matchesPattern": "tentacle_*",
  "matchesAll": { "slotType": "tentacle" }
}
```

**Critical Requirement**: Pattern matchers depend on exact slot key format from SlotGenerator.

#### 3. **Generation Pipeline** (Orchestrated)

```
AnatomyGenerationService (Facade)
  ↓
AnatomyOrchestrator (Coordinator)
  ↓
┌─────────────────────────────────────────┐
│ Three Parallel Workflows:               │
│  1. AnatomyGenerationWorkflow           │
│  2. DescriptionGenerationWorkflow       │
│  3. GraphBuildingWorkflow               │
└─────────────────────────────────────────┘
  ↓
Entity Graph Built in ECS
```

**Key Services**:
- `bodyBlueprintFactory.js` - Creates blueprints from definitions
- `slotGenerator.js` - Generates slots from structure templates
- `socketGenerator.js` - Generates sockets from templates
- `recipeProcessor.js` - Loads and processes recipes
- `recipePatternResolver.js` - Resolves V2 pattern matching
- `partSelectionService.js` - Selects parts matching requirements
- `entityGraphBuilder.js` - Builds entity graph from parts

#### 4. **Clothing Integration** (Strategy Pattern)

```
SlotResolver (Orchestrator)
  ├─ ClothingSlotMappingStrategy (Priority 1)
  ├─ BlueprintSlotStrategy (Priority 2)
  └─ DirectSocketStrategy (Priority 3)
```

**Integration Flow**:
```
Anatomy Generation → Clothing Instantiation → SlotResolver → Anatomy Socket Index
                                                    ↑
                                              (Circular dependency)
```

---

## Root Cause of Recent Regressions

### The Cascade Failure Pattern

Recent commit `af53a1948` ("Fixed incredibly nasty regressions") reveals the failure cascade:

```
Step 1: Structure Template Change
  ↓
Step 2: SlotGenerator produces different slot keys
  ↓
Step 3: SocketGenerator produces mismatched socket IDs
  ↓
Step 4: Recipe patterns fail to match (zero matches)
  ↓
Step 5: No body parts generated (silent failure)
  ↓
Step 6: Clothing assignment fails (no slots to attach to)
  ↓
Step 7: Tests fail with cryptic errors
```

### Specific Example: Octopoid Creatures

**Before (Working)**:
```javascript
// Structure template generates slots:
tentacle_1, tentacle_2, ..., tentacle_8

// Recipe pattern matches:
{ "matchesPattern": "tentacle_*" } → 8 matches ✅
```

**After (Broken)**:
```javascript
// Test fix changes orientation resolution logic
// SlotGenerator now produces:
tentacle_front_left_1, tentacle_front_right_1, ...

// Recipe pattern fails:
{ "matchesPattern": "tentacle_*" } → 0 matches ❌
```

**Why Silent Failure?**

Commit `24f320e4a` softened validation to allow zero matches:
```javascript
// recipePatternResolver.js (approximate lines 188-194)
if (!pattern.matches) {
  this.#logger.debug('Skipping V2 pattern');  // ❌ Only debug, no warning!
  continue;
}
```

**Note**: Code line numbers are approximate and may shift with ongoing development.

This **hides configuration errors** until runtime anatomy generation fails.

### Files Modified in Regression Fix

- `src/anatomy/socketGenerator.js` - Socket ID generation logic
- `src/anatomy/partSelectionService.js` - Part selection adjustments
- `data/mods/anatomy/entities/kraken.entity.json` - Entity fixes
- `data/mods/anatomy/entities/octopus.entity.json` - Entity fixes
- `data/mods/anatomy/entities/squid.entity.json` - Entity fixes
- `data/mods/anatomy/recipes/*` - Recipe pattern updates

**Root Cause**: Template variable resolution logic diverged between SlotGenerator and SocketGenerator, breaking the critical synchronization requirement.

---

## Brittleness Analysis

### 🔴 Critical Issues

#### 1. SlotGenerator ↔ SocketGenerator Synchronization

**Location**: `src/anatomy/slotGenerator.js` ↔ `src/anatomy/socketGenerator.js`

**Problem**: Both services must use **identical** template variable resolution logic, but share no common code.

**Evidence**:
```javascript
// slotGenerator.js (approximate lines 260-288)
#generateSlotKey(socketPattern, index, totalCount, arrangement) {
  const orientation = this.#resolveOrientation(
    orientationScheme,
    index,
    totalCount,
    positions,
    arrangement
  );
  const variables = {
    index,
    orientation,
    position: orientation,  // Must match SocketGenerator!
    type: allowedTypes[0]
  };
  return this.#applyTemplate(idTemplate, variables);
}

// socketGenerator.js has DUPLICATE logic with subtle differences
```

**Brittleness Factors**:
- Any change to orientation resolution must be synchronized across two files
- No compile-time or runtime validation of synchronization
- Recent regressions prove this synchronization failed
- DRY principle violation (logic duplicated)

**Impact**: 🔴 **CRITICAL** - Breaks all V2 anatomy generation

**Affected Entities**: All creatures using V2 structure templates (kraken, octopus, squid, spiders, etc.)

---

#### 2. Pattern Resolution Dependency Chain

**Location**: Template → SlotGenerator → Blueprint → RecipePatternResolver

**Problem**: Recipe pattern matching depends on blueprint slot structure with no validation.

**Dependency Chain**:
```
StructureTemplate (data/mods/*/anatomy/structure-templates/)
  ↓ (defines socket patterns)
SlotGenerator (src/anatomy/slotGenerator.js)
  ↓ (generates slot keys)
Blueprint Slots (runtime structure)
  ↓ (slot keys must match patterns)
RecipePatternResolver (src/anatomy/recipePatternResolver.js)
  ↓ (matches patterns to slots)
Recipe Slots (runtime matches)
```

**Brittleness Factors**:
- Changes to structure template cascade through entire chain
- No validation that patterns will match actual slots
- `matchesGroup: "limbSet:leg"` silently fails if limbSet structure changes
- Pattern matching errors only discovered at runtime

**Example Failure**:
```json
// Recipe pattern
{
  "matchesGroup": "limbSet:tentacle",
  "partType": "anatomy:kraken_tentacle"
}

// If structure template changes tentacle generation,
// pattern matching silently fails with zero matches
```

**Impact**: 🔴 **CRITICAL** - Silent failures, hard to debug

**Documentation Warning** (from `docs/anatomy/v2-structure-templates.md`):
> "IMPORTANT: Slot keys must exactly match socket IDs generated by SocketGenerator."

This is acknowledged as a critical requirement but not enforced by code!

---

#### 3. Hard-Coded Component Dependencies

**Location**: Multiple services across `src/anatomy/`

**Problem**: Services have hard-coded component ID dependencies with no dependency injection.

**Examples**:
```javascript
// anatomyGenerationService.js (approximate line 143)
const anatomyBodyData = entity.getComponentData(ANATOMY_BODY_COMPONENT_ID);
// Hard-coded constant import

// partSelectionService.js - requires 'anatomy:part' component
merged.components = [...new Set([...existingComponents, ...recipeSlot.tags])];
// Implicit assumption about component structure

// bodyGraphService.js - assumes specific component schema
const bodyData = this.#componentMutationService.getComponentData(
  entityId,
  ANATOMY_BODY_COMPONENT_ID
);
```

**Brittleness Factors**:
- Component ID changes break multiple services
- No configuration-driven component requirements
- Implicit assumptions about component schema
- Testing requires exact component structure

**Impact**: 🔴 **CRITICAL** - Fragile to schema evolution

---

### 🟡 Important Issues

#### 4. No Runtime Pattern Validation

**Location**: `src/anatomy/recipePatternResolver.js`

**Problem**: No validation that recipe patterns will match any slots.

**Current Code**:
```javascript
// recipePatternResolver.js (approximate lines 188-194)
for (const pattern of recipe.patterns) {
  if (!pattern.matches) {
    this.#logger.debug('Skipping V2 pattern');  // ❌ Only debug!
    continue;
  }
}
```

**What Should Happen**:
```javascript
for (const pattern of recipe.patterns) {
  const matches = this.#resolvePattern(pattern, blueprint);
  if (matches.length === 0) {
    this.#logger.warn(
      `Pattern matched zero slots: ${JSON.stringify(pattern)}\n` +
      `Available slots: ${Object.keys(blueprint.slots).join(', ')}`
    );
    // In strict mode, could throw error
  }
}
```

**Brittleness Factors**:
- Typos in `matchesGroup` silently produce zero matches
- Configuration errors only discovered at runtime
- No feedback loop for mod authors
- Debugging requires deep system knowledge

**Impact**: 🟡 **IMPORTANT** - Hard to debug, poor developer experience

**Recent Change**:
Commit `24f320e4a` ("Fix recipe pattern resolver zero-match handling") softened validation to allow zero matches. This **hides configuration errors**!

---

#### 5. Missing Blueprint↔Recipe Consistency Checks

**Location**: Mod loading phase

**Problem**: No load-time validation that recipes reference valid blueprint slots.

**What's Missing**:
- ✅ Recipe can reference slots that don't exist in blueprint
- ✅ Blueprint can define slots that recipe doesn't populate
- ❌ Only fails when generating anatomy, not at load time
- ❌ No warning for incomplete coverage

**Example Scenario**:
```json
// Blueprint defines:
{
  "slots": {
    "left_hand": { ... },
    "right_hand": { ... },
    "left_foot": { ... },
    "right_foot": { ... }
  }
}

// Recipe only covers hands:
{
  "patterns": [
    {
      "matchesPattern": "*_hand",
      "partType": "anatomy:human_hand"
    }
  ]
  // Missing feet! No warning at load time.
}
```

**Brittleness Factors**:
- Incomplete recipes pass validation
- Only discovered when anatomy has missing parts
- No quality metrics for recipe completeness
- Mod authors get no feedback

**Impact**: 🟡 **IMPORTANT** - Poor quality feedback loop

---

### 🟢 Recommended Improvements

#### 6. Template Variable Resolution Complexity

**Location**: `src/anatomy/slotGenerator.js:302-335`

**Problem**: Orientation scheme resolution has many branches and special cases.

**Current Implementation**:
```javascript
// slotGenerator.js (approximate lines 302-335)
#resolveOrientation(scheme, index, totalCount, positions, arrangement) {
  switch (scheme) {
    case 'bilateral':
      return this.#resolveBilateralOrientation(index, totalCount, arrangement);

    case 'quadrupedal':
      // Special case: maps to bilateral
      return this.#resolveBilateralOrientation(index, totalCount, 'quadrupedal');

    case 'radial':
      return this.#resolveRadialOrientation(index, totalCount, positions);

    case 'custom':
      return this.#resolveCustomOrientation(index, positions);

    case 'indexed':
    default:
      return String(index);
  }
}

// Bilateral has special case for totalCount === 4
// Radial has special case for totalCount === 8 (octagonal)
```

**Brittleness Factors**:
- Magic numbers (4, 8) with special behavior
- Easy to introduce bugs when adding new schemes
- Difficult to test exhaustively
- No documentation of edge cases

**Impact**: 🟢 **RECOMMENDED** - Error-prone when extending

---

#### 7. Clothing Integration State Management

**Location**: `src/anatomy/integration/SlotResolver.js`

**Problem**: Multiple caches and mapping state with complex invalidation logic.

**Current Architecture**:
```javascript
// SlotResolver.js (approximate lines 45-74)
constructor({ cache, slotEntityMappings, ... }) {
  this.#cache = cache || new Map();
  // Multiple cache types supported
  // Slot-to-entity mappings stored separately
  // Strategy selection based on runtime state
}
```

**Brittleness Factors**:
- Cache invalidation logic spread across multiple services
- Slot-to-entity mappings must be manually updated
- No transactional guarantees
- Timing-sensitive (invalidation must happen before queries)

**Circular Dependency**:
```
Anatomy needs clothing slot mappings
  ↓
Clothing needs anatomy sockets to exist
  ↓
Resolution strategies query anatomy structures
  ↓
(Back to anatomy)
```

**Impact**: 🟢 **RECOMMENDED** - Maintainability concern

---

## Refactoring Strategy

### Phase 1: Immediate Stability Fixes (Week 1)

**Goal**: Prevent future regressions with minimal architectural changes.

#### 1.1 Extract Shared Orientation Resolution Module

**Priority**: 🔴 **CRITICAL**

**Implementation**:

Create `src/anatomy/shared/orientationResolver.js`:
```javascript
/**
 * Shared orientation resolution logic for SlotGenerator and SocketGenerator.
 * CRITICAL: Both services MUST use this module to maintain synchronization.
 */
export class OrientationResolver {
  /**
   * Resolves orientation string for a socket/slot based on scheme.
   * @param {string} scheme - 'bilateral', 'radial', 'indexed', 'custom', 'quadrupedal'
   * @param {number} index - Zero-based index
   * @param {number} totalCount - Total number of sockets
   * @param {Array<string>} positions - Custom positions array
   * @param {string} arrangement - Arrangement type
   * @returns {string} Orientation string
   */
  static resolveOrientation(scheme, index, totalCount, positions, arrangement) {
    switch (scheme) {
      case 'bilateral':
        return this.#resolveBilateral(index, totalCount, arrangement);

      case 'quadrupedal':
        return this.#resolveBilateral(index, totalCount, 'quadrupedal');

      case 'radial':
        return this.#resolveRadial(index, totalCount, positions);

      case 'custom':
        return this.#resolveCustom(index, positions);

      case 'indexed':
      default:
        return String(index);
    }
  }

  static #resolveBilateral(index, totalCount, arrangement) {
    // Move implementation from slotGenerator.js
    // Single source of truth
  }

  static #resolveRadial(index, totalCount, positions) {
    // Move implementation from slotGenerator.js
    // Single source of truth
  }

  static #resolveCustom(index, positions) {
    // Move implementation from slotGenerator.js
    // Single source of truth
  }
}
```

**Update SlotGenerator**:
```javascript
import { OrientationResolver } from './shared/orientationResolver.js';

#generateSlotKey(socketPattern, index, totalCount, arrangement) {
  const orientation = OrientationResolver.resolveOrientation(
    socketPattern.orientationScheme,
    index,
    totalCount,
    socketPattern.positions,
    arrangement
  );
  // Rest of implementation
}
```

**Update SocketGenerator**:
```javascript
import { OrientationResolver } from './shared/orientationResolver.js';

#generateSockets(socketPattern, count, arrangement) {
  for (let i = 0; i < count; i++) {
    const orientation = OrientationResolver.resolveOrientation(
      socketPattern.orientationScheme,
      i,
      count,
      socketPattern.positions,
      arrangement
    );
    // Rest of implementation
  }
}
```

**Benefits**:
- Single source of truth prevents synchronization bugs
- Easier to add new orientation schemes
- Testable in isolation
- Forces both services to use identical logic

**Testing**:
```javascript
// tests/unit/anatomy/shared/orientationResolver.test.js
describe('OrientationResolver', () => {
  describe('bilateral scheme', () => {
    it('should resolve left/right for count=2', () => {
      expect(OrientationResolver.resolveOrientation('bilateral', 0, 2)).toBe('left');
      expect(OrientationResolver.resolveOrientation('bilateral', 1, 2)).toBe('right');
    });

    it('should resolve front_left/front_right/back_left/back_right for count=4', () => {
      // Test all four positions
    });
  });

  describe('radial scheme', () => {
    it('should resolve compass directions for count=8', () => {
      // Test all eight directions
    });
  });

  // Exhaustive tests for all schemes and edge cases
});
```

**Risk**: Low - Pure extraction, no logic changes

**Estimated Effort**: 4-8 hours

---

#### 1.2 Add Pattern Validation Warnings

**Priority**: 🟡 **IMPORTANT**

**Implementation**:

Update `src/anatomy/recipePatternResolver.js`:
```javascript
#resolvePattern(pattern, blueprint, logger) {
  const matches = this.#performMatching(pattern, blueprint);

  // Add validation warning
  if (matches.length === 0) {
    const availableSlots = Object.keys(blueprint.slots).join(', ');
    logger.warn(
      `Recipe pattern matched zero slots:\n` +
      `  Pattern: ${JSON.stringify(pattern)}\n` +
      `  Blueprint: ${blueprint.id}\n` +
      `  Available slots: ${availableSlots}\n` +
      `  This may indicate a configuration error.`
    );
  }

  return matches;
}
```

**Benefits**:
- Immediate feedback when patterns fail
- Helps mod authors debug recipe issues
- No breaking changes (warnings, not errors)
- Easy to implement

**Configuration Option**:
```javascript
// In config, allow strict mode
{
  "anatomy": {
    "validation": {
      "strictPatternMatching": false  // Set to true to throw on zero matches
    }
  }
}
```

**Risk**: Low - Additive change

**Estimated Effort**: 2-4 hours

---

#### 1.3 Implement Load-Time Blueprint-Recipe Validation

**Priority**: 🟡 **IMPORTANT**

**Implementation**:

Create `src/anatomy/validation/blueprintRecipeValidator.js`:
```javascript
/**
 * Validates consistency between blueprints and recipes at load time.
 */
export class BlueprintRecipeValidator {
  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Validates that recipe patterns will match blueprint slots.
   * @param {Object} blueprint - Blueprint definition
   * @param {Object} recipe - Recipe definition
   * @returns {ValidationResult} Warnings and errors
   */
  validate(blueprint, recipe) {
    const results = {
      errors: [],
      warnings: [],
      coverage: 0
    };

    // Check all patterns match at least one slot
    for (const pattern of recipe.patterns) {
      const matches = this.#simulatePatternMatch(pattern, blueprint);
      if (matches.length === 0) {
        results.warnings.push({
          type: 'zero_matches',
          pattern,
          message: `Pattern matches zero slots in blueprint ${blueprint.id}`
        });
      }
    }

    // Check slot coverage (what percentage of slots have parts)
    const totalSlots = Object.keys(blueprint.slots).length;
    const coveredSlots = this.#calculateCoverage(blueprint, recipe);
    results.coverage = totalSlots > 0 ? (coveredSlots / totalSlots) * 100 : 0;

    if (results.coverage < 100) {
      results.warnings.push({
        type: 'incomplete_coverage',
        coverage: results.coverage,
        message: `Recipe covers only ${results.coverage.toFixed(1)}% of blueprint slots`
      });
    }

    return results;
  }

  #simulatePatternMatch(pattern, blueprint) {
    // Simulate pattern matching logic without creating actual entities
    // Returns list of slot keys that would match
  }

  #calculateCoverage(blueprint, recipe) {
    // Calculate how many blueprint slots are covered by recipe patterns
  }
}
```

**Integration Point**:
```javascript
// In modsLoader.js or anatomyRecipeLoader.js
const validator = container.resolve('IBlueprintRecipeValidator');

for (const [blueprintId, blueprint] of blueprints) {
  for (const [recipeId, recipe] of recipes) {
    if (recipe.targetBlueprint === blueprintId) {
      const result = validator.validate(blueprint, recipe);

      if (result.warnings.length > 0) {
        logger.warn(`Blueprint-Recipe validation warnings for ${recipeId}:`,
          result.warnings);
      }

      if (result.coverage < 80) {
        logger.warn(
          `Low recipe coverage (${result.coverage}%) for ${recipeId} → ${blueprintId}`
        );
      }
    }
  }
}
```

**Benefits**:
- Catches configuration errors at load time
- Provides quality metrics (coverage percentage)
- Helps mod authors validate their content
- No runtime performance impact

**Risk**: Low - Validation only, doesn't change behavior

**Estimated Effort**: 8-16 hours

---

### Phase 2: Structural Improvements (Weeks 2-4)

**Goal**: Decouple systems, improve maintainability, reduce complexity.

#### 2.1 Decouple Clothing from Anatomy

**Priority**: 🟢 **RECOMMENDED**

**Current Problem**: Circular dependency and complex cache management.

**Proposed Architecture**:

```
┌─────────────────────────────────────┐
│ Anatomy System (Owner)              │
│  - Generates body structure         │
│  - Publishes ANATOMY_GENERATED evt  │
│  - Provides read-only socket index  │
└─────────────────────────────────────┘
          ↓ (One-way dependency)
┌─────────────────────────────────────┐
│ Clothing System (Consumer)          │
│  - Listens to ANATOMY_GENERATED     │
│  - Queries socket index             │
│  - Instantiates clothing items      │
└─────────────────────────────────────┘
```

**Event-Based Integration**:
```javascript
// Anatomy publishes event when generation complete
eventBus.dispatch({
  type: 'ANATOMY_GENERATED',
  payload: {
    entityId,
    socketIndex: this.#socketIndex.getAllSockets(entityId),
    timestamp: Date.now()
  }
});

// Clothing listens and reacts
eventBus.on('ANATOMY_GENERATED', async (event) => {
  const { entityId, socketIndex } = event.payload;
  await this.#clothingService.instantiateDefaultClothing(entityId, socketIndex);
});
```

**Benefits**:
- Clear ownership boundaries
- Unidirectional dependency flow
- Easier to test in isolation
- Cache management simplified

**Migration Strategy**:
1. Add event publication to AnatomyGenerationWorkflow
2. Update ClothingInstantiationService to subscribe to events
3. Remove circular dependencies from SlotResolver
4. Simplify cache invalidation logic

**Risk**: Medium - Requires coordination across multiple services

**Estimated Effort**: 20-30 hours

---

#### 2.2 Formalize Template Contract with JSON Schema

**Priority**: 🟢 **RECOMMENDED**

**Goal**: Validate structure templates and enforce contracts.

**Create Schema**: `data/schemas/anatomy/structure-template.schema.json`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "schema://living-narrative-engine/anatomy/structure-template",
  "type": "object",
  "required": ["id", "socketPatterns"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9_]+:[a-z0-9_]+$"
    },
    "socketPatterns": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["slotType", "idTemplate", "orientationScheme"],
        "properties": {
          "orientationScheme": {
            "enum": ["bilateral", "radial", "indexed", "custom", "quadrupedal"]
          },
          "idTemplate": {
            "type": "string",
            "description": "Template with {index}, {orientation}, {type} variables"
          }
        }
      }
    }
  }
}
```

**Validation at Load Time**:
```javascript
// In anatomyLoader.js
const template = loadStructureTemplate(templateId);
const validationResult = validateAgainstSchema(
  template,
  'schema://living-narrative-engine/anatomy/structure-template'
);

if (!validationResult.valid) {
  throw new InvalidStructureTemplateError(
    `Template ${templateId} failed validation: ${formatAjvErrors(validationResult.errors)}`
  );
}
```

**Benefits**:
- Catches template errors at load time
- Documents expected structure
- IDE autocomplete support
- Prevents invalid configurations

**Risk**: Low - Validation only

**Estimated Effort**: 8-12 hours

---

#### 2.3 Centralize Cache Management

**Priority**: 🟢 **RECOMMENDED**

**Current Problem**: Cache invalidation spread across multiple services.

**Proposed Solution**: Cache Coordinator service

```javascript
/**
 * Centralized cache management for anatomy system.
 * Coordinates invalidation across multiple caches.
 */
export class AnatomyCacheCoordinator {
  constructor({ eventBus, logger }) {
    this.#caches = new Map();
    this.#eventBus = eventBus;

    // Subscribe to invalidation events
    this.#eventBus.on('ENTITY_DESTROYED', this.#handleEntityDestroyed.bind(this));
    this.#eventBus.on('ANATOMY_MODIFIED', this.#handleAnatomyModified.bind(this));
  }

  /**
   * Registers a cache for coordinated invalidation.
   */
  registerCache(cacheId, cache) {
    this.#caches.set(cacheId, cache);
  }

  /**
   * Invalidates all caches for an entity (transactional).
   */
  invalidateEntity(entityId) {
    for (const [cacheId, cache] of this.#caches) {
      cache.delete(entityId);
    }

    this.#eventBus.dispatch({
      type: 'ANATOMY_CACHE_INVALIDATED',
      payload: { entityId }
    });
  }

  #handleEntityDestroyed({ payload: { entityId } }) {
    this.invalidateEntity(entityId);
  }

  #handleAnatomyModified({ payload: { entityId } }) {
    this.invalidateEntity(entityId);
  }
}
```

**Benefits**:
- Single source of truth for invalidation
- Transactional invalidation (all-or-nothing)
- Event-driven architecture
- Easier to debug cache issues

**Risk**: Low - Improves existing functionality

**Estimated Effort**: 12-16 hours

---

### Phase 3: Long-Term Resilience (Months 1-3)

**Goal**: Comprehensive testing, documentation, and quality improvements.

#### 3.1 Comprehensive Testing Strategy

**Contract Tests** for SlotGenerator ↔ SocketGenerator:
```javascript
// tests/unit/anatomy/slotSocketContract.test.js
describe('SlotGenerator ↔ SocketGenerator Contract', () => {
  it('should generate matching keys for all orientation schemes', () => {
    const schemes = ['bilateral', 'radial', 'indexed', 'custom', 'quadrupedal'];

    for (const scheme of schemes) {
      for (const count of [1, 2, 4, 8, 16]) {
        const slotKeys = slotGenerator.generateKeys(scheme, count);
        const socketIds = socketGenerator.generateIds(scheme, count);

        expect(slotKeys).toEqual(socketIds);
      }
    }
  });
});
```

**Property-Based Testing** for orientation schemes:
```javascript
// tests/unit/anatomy/orientationProperties.test.js
import { fc, test } from 'fast-check';

describe('OrientationResolver Properties', () => {
  test('should produce unique orientations for all indices', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('bilateral', 'radial', 'indexed'),
        fc.integer({ min: 2, max: 16 }),
        (scheme, count) => {
          const orientations = [];
          for (let i = 0; i < count; i++) {
            orientations.push(
              OrientationResolver.resolveOrientation(scheme, i, count)
            );
          }

          // All orientations should be unique
          const unique = new Set(orientations);
          return unique.size === orientations.length;
        }
      )
    );
  });
});
```

**Integration Tests** for full pipeline:
```javascript
// tests/integration/anatomy/fullPipeline.test.js
describe('Anatomy Generation Pipeline', () => {
  it('should generate complete anatomy from blueprint and recipe', async () => {
    const blueprint = await loadBlueprint('anatomy:octopoid_body');
    const recipe = await loadRecipe('anatomy:octopoid_recipe');

    const result = await anatomyGenerator.generate({
      blueprint,
      recipe,
      parameters: { tentacleCount: 8 }
    });

    expect(result.entities).toHaveLength(9); // Body + 8 tentacles
    expect(result.clothingSlots).toBeDefined();
    expect(result.graph).toBeConnectedGraph();
  });
});
```

**Regression Test Suite**:
```javascript
// tests/regression/anatomy/octopoid.regression.test.js
describe('Octopoid Regression Tests', () => {
  it('should prevent recurrence of tentacle slot mismatch', async () => {
    // Captures the specific regression from commit af53a1948
    const entity = await generateOctopoid({ tentacleCount: 8 });

    const tentacles = entity.getParts({ type: 'tentacle' });
    expect(tentacles).toHaveLength(8);

    const clothingSlots = entity.getClothingSlots();
    expect(clothingSlots.some(slot => slot.includes('tentacle'))).toBe(true);
  });
});
```

**Estimated Effort**: 40-60 hours

---

#### 3.2 Documentation Updates

**Update Existing Docs**:
- `docs/anatomy/v2-structure-templates.md` - Add validation requirements
- `docs/anatomy/recipes.md` - Document pattern matching validation
- `docs/anatomy/architecture.md` - Update with new architecture diagram
- `docs/testing/anatomy-testing-guide.md` - Add testing patterns

**Create New Docs**:
- `docs/anatomy/troubleshooting.md` - Common issues and solutions
- `docs/anatomy/refactoring-history.md` - Document architectural changes
- `docs/development/anatomy-development-guide.md` - Developer onboarding

**Example Troubleshooting Guide**:
```markdown
# Anatomy System Troubleshooting

## Problem: Body parts not generated

**Symptoms**: Entity has anatomy component but missing body parts

**Root Causes**:
1. Recipe pattern matching failed (check logs for zero-match warnings)
2. Blueprint-recipe mismatch (validate with BlueprintRecipeValidator)
3. Structure template error (check schema validation)

**Debugging Steps**:
1. Enable debug logging: `config.anatomy.logging.level = 'debug'`
2. Check pattern matching: Look for "Pattern matched zero slots" warnings
3. Validate blueprint: Use BlueprintRecipeValidator
4. Verify template: Check structure template schema

## Problem: Clothing not attaching to body parts

**Symptoms**: Clothing items created but not attached to sockets

**Root Causes**:
1. Socket IDs don't match clothing slot expectations
2. Cache invalidation timing issue
3. Missing anatomy-generated event

**Debugging Steps**:
1. Check socket index: `socketIndex.getAllSockets(entityId)`
2. Verify clothing slot mappings
3. Check event dispatch logs for ANATOMY_GENERATED
```

**Estimated Effort**: 20-30 hours

---

#### 3.3 Modularity Improvements

**Break Down Large Services**:

Current `AnatomyGenerationService` is a facade with complex dependencies. Refactor into smaller modules:

```
AnatomyGenerationService (thin facade)
  ↓
├─ BlueprintResolutionModule
│   ├─ BlueprintFactory
│   └─ SlotGenerator
├─ RecipeResolutionModule
│   ├─ RecipeProcessor
│   └─ PatternResolver
├─ EntityConstructionModule
│   ├─ PartSelector
│   └─ EntityGraphBuilder
└─ ValidationModule
    ├─ BlueprintValidator
    └─ RecipeValidator
```

**Benefits**:
- Clearer service boundaries
- Easier to test in isolation
- Reduced complexity per module
- Better separation of concerns

**Risk**: Medium - Requires careful refactoring

**Estimated Effort**: 40-60 hours

---

## Implementation Recommendations

### Critical Success Factors

1. **Test Before Refactoring**
   - Create regression tests capturing current behavior
   - Add contract tests before extracting shared modules
   - Maintain test coverage throughout refactoring

2. **Incremental Migration**
   - Don't rewrite everything at once
   - Deploy Phase 1 fixes before starting Phase 2
   - Validate each change reduces brittleness

3. **Communication**
   - Document all breaking changes
   - Update mod authors about validation changes
   - Maintain changelog for anatomy system

### Migration Path

**Week 1** (Phase 1):
- Day 1-2: Extract OrientationResolver
- Day 3: Add pattern validation warnings
- Day 4-5: Implement load-time validation

**Week 2** (Phase 2 Start):
- Day 1-3: Formalize template contracts
- Day 4-5: Begin cache centralization

**Week 3** (Phase 2 Continue):
- Day 1-3: Decouple clothing integration
- Day 4-5: Testing and validation

**Week 4** (Phase 2 Complete):
- Day 1-3: Complete clothing decoupling
- Day 4-5: Integration testing

**Month 2-3** (Phase 3):
- Comprehensive testing infrastructure
- Documentation updates
- Modularity improvements

### Code Review Checklist

Before merging anatomy system changes:

- [ ] All tests pass (unit, integration, regression)
- [ ] No new ESLint warnings
- [ ] TypeScript type checking passes
- [ ] Coverage maintained or improved
- [ ] OrientationResolver used (not duplicated logic)
- [ ] Pattern matching validation added
- [ ] Load-time validation included
- [ ] Documentation updated
- [ ] Changelog entry created
- [ ] Migration guide provided (if breaking changes)

### Risk Mitigation

**Rollback Plan**:
- Feature flags for new validation logic
- Backward compatibility mode for pattern matching
- Gradual rollout (enable per-mod initially)

**Testing in Production**:
- Enable strict validation warnings in development only
- Monitor error rates after deployment
- Gradual migration of mods to new system

---

## Testing Strategy

### Test Pyramid

```
                /\
               /  \
              / E2E \
             /--------\
            /Integration\
           /--------------\
          /  Unit Tests    \
         /------------------\
        / Contract Tests     \
       /----------------------\
```

### Testing Requirements by Phase

**Phase 1** (Immediate Fixes):
- ✅ Unit tests for OrientationResolver (all schemes, edge cases)
- ✅ Contract tests for SlotGenerator ↔ SocketGenerator
- ✅ Integration tests for pattern validation warnings
- ✅ Validation tests for BlueprintRecipeValidator

**Phase 2** (Structural Improvements):
- ✅ Integration tests for decoupled clothing system
- ✅ Schema validation tests for templates
- ✅ Cache invalidation tests (event-driven)

**Phase 3** (Long-Term Resilience):
- ✅ Property-based tests for orientation schemes
- ✅ Regression tests for known failures
- ✅ Full pipeline integration tests
- ✅ Performance tests for large entity graphs

### Test Coverage Goals

- **OrientationResolver**: 100% (critical component)
- **SlotGenerator**: 95%
- **SocketGenerator**: 95%
- **RecipePatternResolver**: 90%
- **BlueprintRecipeValidator**: 95%
- **Overall anatomy system**: 85%

### Testing Anti-Patterns to Avoid

❌ **Don't**: Mock OrientationResolver in SlotGenerator tests
✅ **Do**: Use real OrientationResolver, test contract compliance

❌ **Don't**: Test pattern matching with incomplete blueprints
✅ **Do**: Use realistic fixtures from actual mods

❌ **Don't**: Disable validation to make tests pass
✅ **Do**: Fix tests to match new validation requirements

---

## Appendices

### Appendix A: File Inventory

**Core Services** (23 files):
- `src/anatomy/anatomyGenerationService.js` - Facade
- `src/anatomy/anatomyOrchestrator.js` - Coordinator
- `src/anatomy/bodyBlueprintFactory.js` - Blueprint creation
- `src/anatomy/slotGenerator.js` - Slot generation (V2)
- `src/anatomy/socketGenerator.js` - Socket generation
- `src/anatomy/socketManager.js` - Socket operations
- `src/anatomy/recipeProcessor.js` - Recipe loading
- `src/anatomy/recipePatternResolver.js` - Pattern matching
- `src/anatomy/partSelectionService.js` - Part selection
- `src/anatomy/entityGraphBuilder.js` - Graph construction
- `src/anatomy/bodyGraphService.js` - Graph operations
- `src/anatomy/bodyDescriptionComposer.js` - Text generation
- `src/anatomy/bodySocketIndex.js` - Socket index
- `src/anatomy/bodyRecipeConfigValidator.js` - Recipe validation
- `src/anatomy/bodyStructureService.js` - Structure utilities
- `src/anatomy/anatomyCacheManager.js` - Cache management
- `src/anatomy/anatomyGraphAlgorithms.js` - Graph algorithms
- `src/anatomy/anatomyInitializationService.js` - Initialization
- `src/anatomy/bodyPartDescriptionBuilder.js` - Description building
- `src/anatomy/descriptorFormatter.js` - Formatting utilities
- `src/anatomy/graphIntegrityValidator.js` - Graph validation
- `src/anatomy/recipeConstraintEvaluator.js` - Constraint evaluation
- `src/anatomy/BodyDescriptionOrchestrator.js` - Description orchestration

**Workflows** (3 files):
- `src/anatomy/workflows/anatomyGenerationWorkflow.js`
- `src/anatomy/workflows/descriptionGenerationWorkflow.js`
- `src/anatomy/workflows/graphBuildingWorkflow.js`

**Integration** (3+ files):
- `src/anatomy/integration/SlotResolver.js` - Strategy coordinator
- `src/anatomy/integration/strategies/ClothingSlotMappingStrategy.js`
- `src/anatomy/integration/strategies/BlueprintSlotStrategy.js`
- `src/anatomy/integration/strategies/DirectSocketStrategy.js`

**Services Subdirectory** (src/anatomy/services/):
- `src/anatomy/services/anatomySocketIndex.js` - Socket indexing
- Additional activity-related services

**Additional Directories**:
- `src/anatomy/orchestration/` - Orchestration components
- `src/anatomy/cache/` - Cache implementations
- `src/anatomy/configuration/` - Configuration utilities
- `src/anatomy/constants/` - Anatomy constants
- `src/anatomy/templates/` - Template utilities
- `src/anatomy/utils/` - General utilities
- `src/anatomy/validation/` - Validation services

**Loaders** (6 files):
- `src/loaders/anatomyRecipeLoader.js`
- `src/loaders/anatomyStructureTemplateLoader.js`
- `src/loaders/anatomyBlueprintLoader.js`
- `src/loaders/anatomyBlueprintPartLoader.js`
- `src/loaders/anatomyFormattingLoader.js`
- `src/loaders/anatomySlotLibraryLoader.js`

### Appendix B: Dependency Graph

```
AnatomyGenerationService (Facade)
├─ AnatomyOrchestrator
│  ├─ AnatomyGenerationWorkflow
│  │  ├─ BodyBlueprintFactory
│  │  │  └─ SlotGenerator ⚠️ (synchronization required)
│  │  ├─ RecipeProcessor
│  │  │  └─ RecipePatternResolver
│  │  ├─ PartSelectionService
│  │  └─ EntityGraphBuilder
│  ├─ DescriptionGenerationWorkflow
│  │  └─ BodyDescriptionComposer
│  └─ GraphBuildingWorkflow
│     └─ BodyGraphService
├─ SocketGenerator ⚠️ (synchronization required)
├─ SocketManager
└─ BodySocketIndex

Clothing Integration (Separate tree)
└─ SlotResolver
   ├─ ClothingSlotMappingStrategy
   ├─ BlueprintSlotStrategy
   └─ DirectSocketStrategy
      └─ BodySocketIndex (shared)
```

**Legend**:
- ⚠️ = Critical synchronization point
- → = Direct dependency
- ↔ = Circular dependency (should be eliminated)

### Appendix C: Testing Checklist

**Unit Testing**:
- [ ] OrientationResolver (all schemes)
- [ ] SlotGenerator (with shared resolver)
- [ ] SocketGenerator (with shared resolver)
- [ ] RecipePatternResolver (all pattern types)
- [ ] BlueprintRecipeValidator
- [ ] PartSelectionService
- [ ] EntityGraphBuilder

**Contract Testing**:
- [ ] SlotGenerator ↔ SocketGenerator (key matching)
- [ ] Blueprint ↔ Recipe (pattern coverage)
- [ ] Anatomy ↔ Clothing (slot resolution)

**Integration Testing**:
- [ ] Full anatomy generation pipeline
- [ ] Blueprint + Recipe → Entity graph
- [ ] Clothing integration workflow
- [ ] Cache invalidation scenarios

**Regression Testing**:
- [ ] Octopoid tentacle generation (commit af53a1948)
- [ ] Pattern matching zero-match handling (commit 24f320e4a)
- [ ] Spider leg generation
- [ ] Humanoid body generation

**Performance Testing**:
- [ ] Large entity graphs (>100 parts)
- [ ] Multiple entity generation (>50 entities)
- [ ] Cache hit rates
- [ ] Memory usage

---

## Conclusion

The anatomy system's brittleness stems from **tight coupling without synchronization enforcement**. The recent regressions prove that the current architecture allows changes to cascade silently through the system, breaking anatomy generation and clothing assignment with no early warning.

**Immediate Actions Required**:

1. ✅ Extract shared OrientationResolver (prevents synchronization bugs)
2. ✅ Add pattern validation warnings (catches configuration errors)
3. ✅ Implement load-time validation (fails fast)

**Long-Term Vision**:

A robust, resilient anatomy system with:
- ✅ Clear service boundaries
- ✅ Event-driven integration
- ✅ Comprehensive validation
- ✅ Extensive testing
- ✅ Excellent documentation

**Expected Outcomes**:

- **95% reduction** in synchronization bugs (shared resolver)
- **Early detection** of configuration errors (load-time validation)
- **Faster debugging** (comprehensive warnings and logs)
- **Higher confidence** in changes (contract tests)
- **Better developer experience** (clear errors, good docs)

**Next Steps**:

1. Review and approve refactoring plan
2. Create feature branch: `refactor/anatomy-system-resilience`
3. Begin Phase 1 implementation
4. Continuous testing and validation
5. Iterative deployment with monitoring

---

**Report Generated**: 2025-11-03
**Analysis Scope**: `src/anatomy/`, `docs/anatomy/`, `tests/*/anatomy/`
**Methodology**: Code analysis, git history review, documentation audit
**Recommendations Priority**: Critical → Important → Recommended
