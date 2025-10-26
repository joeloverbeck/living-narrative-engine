# TEAOUTTHR-007: Create Comprehensive Scope Resolver Registry Documentation

## Overview
**Priority**: P2 (Long-term)
**Effort**: 8 hours
**Impact**: Medium
**Dependencies**: TEAOUTTHR-006 (Expanded scope coverage must be complete first)

## Problem Statement
While ScopeResolverHelpers provides valuable scope resolvers, there is no centralized documentation describing:
- What each registered scope does
- Requirements for each scope (components needed)
- Example usage scenarios for each scope
- When to use factory methods vs pre-registered scopes
- Complete API reference for factory methods

This makes it difficult for developers to:
- Discover available scopes
- Understand which scope fits their use case
- Know when to create custom resolvers
- Learn factory method patterns

## Goals
1. Create comprehensive scope resolver registry documentation
2. Document all positioning scopes with descriptions and requirements
3. Document all inventory scopes
4. Document all anatomy scopes
5. Provide usage examples for each scope category
6. Document factory method patterns for custom scopes
7. Create quick reference tables for rapid lookup

## Implementation Steps

### Step 1: Create New Documentation File

**File**: `docs/testing/scope-resolver-registry.md`

**Template Structure**:
```markdown
# Scope Resolver Registry

Complete reference for all scope resolvers available in ScopeResolverHelpers library.

**Last Updated**: 2025-10-26
**Library**: `tests/common/mods/scopeResolverHelpers.js`

## Overview

The ScopeResolverHelpers library provides pre-configured scope resolvers for common testing scenarios. This eliminates the need for manual scope implementation (40+ lines of boilerplate) and ensures consistent scope behavior across tests.

### Usage Pattern

\`\`\`javascript
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

beforeEach(async () => {
  testFixture = await ModTestFixture.forAction('modId', 'actionName');

  // Register scope category
  ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
});
\`\`\`

### Scope Categories

| Category | Registration Method | Coverage |
|----------|-------------------|----------|
| **Positioning** | `registerPositioningScopes(testEnv)` | 11+ scopes |
| **Inventory** | `registerInventoryScopes(testEnv)` | 5+ scopes |
| **Anatomy** | `registerAnatomyScopes(testEnv)` | 3+ scopes |

---

## Positioning Scopes

Scopes for handling positioning, furniture, sitting, standing, kneeling, and facing relationships.

**Registration**:
\`\`\`javascript
ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
\`\`\`

[Continue with detailed scope documentation...]
```

---

### Step 2: Document Positioning Scopes

**Template for Each Scope**:
```markdown
### `positioning:scope_name`

**Description**: Brief explanation of what the scope resolves to.

**Pattern Type**: [Component Lookup | Array Filter | Location Match | Component Filter]

**Requirements**:
- Actor must have `mod:component_name` component
- [Additional requirements]

**Returns**: Set of entity IDs matching the scope criteria

**Example Usage**:
\`\`\`javascript
// Action that uses this scope
{
  "id": "mod:action_name",
  "targets": "positioning:scope_name",
  // ...
}
\`\`\`

**Test Setup**:
\`\`\`javascript
// Arrange scenario
const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

// Add required components
scenario.actor.components['positioning:component_name'] = {
  field: 'value',
};

// Execute action
const availableActions = await testFixture.getAvailableActions(scenario.actor.id);
\`\`\`

**Common Use Cases**:
- [Use case 1]
- [Use case 2]

---
```

**Document Each Positioning Scope**:

1. **positioning:furniture_actor_sitting_on**
   - Description: Returns the furniture entity the actor is currently sitting on
   - Pattern: Component Lookup
   - Requirements: Actor has `positioning:sitting_on` component
   - Use cases: "stand up", "get up from furniture" actions

2. **positioning:actors_sitting_on_same_furniture**
   - Description: All actors sitting on the same furniture as the actor
   - Pattern: Array Filter
   - Requirements: Actor has `positioning:sitting_on`, furniture has occupants
   - Use cases: "talk to person on couch", group sitting interactions

3. **positioning:closest_leftmost_occupant**
   - Description: Actor sitting to the left of the actor on same furniture
   - Pattern: Component Lookup + Position Calculation
   - Requirements: Actor sitting, furniture has occupants
   - Use cases: "scoot closer to left", directional interactions

4. **positioning:closest_rightmost_occupant**
   - Description: Actor sitting to the right of the actor on same furniture
   - Pattern: Component Lookup + Position Calculation
   - Requirements: Actor sitting, furniture has occupants
   - Use cases: "scoot closer to right", directional interactions

5. **positioning:furniture_allowing_sitting_at_location**
   - Description: Furniture entities at actor's location that allow sitting
   - Pattern: Location Match + Component Filter
   - Requirements: Furniture has `positioning:allows_sitting` component
   - Use cases: "sit down on furniture" action discovery

6. **positioning:standing_actors_at_location**
   - Description: All standing actors at the same location as actor
   - Pattern: Location Match + Component Filter
   - Requirements: Actors at same location without sitting/kneeling
   - Use cases: Proximity-based standing interactions

7. **positioning:sitting_actors**
   - Description: All actors currently sitting (anywhere)
   - Pattern: Component Filter
   - Requirements: Actors have `positioning:sitting_on` component
   - Use cases: Global sitting state queries

8. **positioning:kneeling_actors**
   - Description: All actors currently kneeling (anywhere)
   - Pattern: Component Filter
   - Requirements: Actors have `positioning:kneeling` component
   - Use cases: Kneeling state-dependent actions

9. **positioning:furniture_actor_behind**
   - Description: Furniture entity the actor is positioned behind
   - Pattern: Component Lookup
   - Requirements: Actor has `positioning:behind_furniture` component
   - Use cases: "step out from behind furniture" actions

10. **positioning:actor_being_bitten_by_me** (NEW)
    - Description: Entity whose neck the actor is currently biting
    - Pattern: Component Lookup with Reciprocal Validation
    - Requirements: Actor has `positioning:biting_neck`, target has `positioning:being_bitten_in_neck`
    - Use cases: "tear out throat", "drink blood" vampire actions

11. **positioning:close_actors_facing_each_other_or_behind_target** (NEW)
    - Description: Close actors either facing each other or with actor behind target
    - Pattern: Array Filter with Complex Logic
    - Requirements: Actor has `positioning:closeness`, facing_away components
    - Use cases: "grab neck", stealth attack actions

---

### Step 3: Document Inventory Scopes

**Section Template**:
```markdown
## Inventory Scopes

Scopes for handling items, containers, equipped items, and inventory management.

**Registration**:
\`\`\`javascript
ScopeResolverHelpers.registerInventoryScopes(testFixture.testEnv);
\`\`\`

### Available Scopes

[Document each inventory scope with same pattern as positioning]
```

**Identify and Document**:
- Review `tests/common/mods/scopeResolverHelpers.js` for registered inventory scopes
- Document each with description, requirements, examples
- Include use cases for item actions (pickup, drop, give, take)

---

### Step 4: Document Anatomy Scopes

**Section Template**:
```markdown
## Anatomy Scopes

Scopes for handling body parts, anatomy interactions, and anatomical relationships.

**Registration**:
\`\`\`javascript
ScopeResolverHelpers.registerAnatomyScopes(testFixture.testEnv);
\`\`\`

### Available Scopes

[Document each anatomy scope]
```

---

### Step 5: Document Factory Methods

**Section**:
```markdown
## Creating Custom Scope Resolvers

For scopes not in the standard library, use factory methods to create resolvers.

### Factory Method Reference

#### createComponentLookupResolver

**Purpose**: Resolve to entity ID stored in a component field

**Signature**:
\`\`\`javascript
ScopeResolverHelpers.createComponentLookupResolver(scopeName, config)
\`\`\`

**Config Parameters**:
- `componentType` (string): Component to read from (e.g., `'positioning:biting_neck'`)
- `sourceField` (string): Field containing target entity ID (e.g., `'bitten_entity_id'`)
- `contextSource` (string): Where to get source entity (`'actor'` | `'target'`)
- `validateReciprocal` (boolean, optional): Validate two-way relationship
- `reciprocalComponent` (string, optional): Target's component for validation
- `reciprocalField` (string, optional): Target's field containing source ID

**Example**:
\`\`\`javascript
const bitingResolver = ScopeResolverHelpers.createComponentLookupResolver(
  'positioning:actor_being_bitten_by_me',
  {
    componentType: 'positioning:biting_neck',
    sourceField: 'bitten_entity_id',
    contextSource: 'actor',
    validateReciprocal: true,
    reciprocalComponent: 'positioning:being_bitten_in_neck',
    reciprocalField: 'biting_entity_id',
  }
);

ScopeResolverHelpers._registerResolvers(
  testFixture.testEnv,
  testFixture.testEnv.entityManager,
  { 'positioning:actor_being_bitten_by_me': bitingResolver }
);
\`\`\`

**Use When**:
- Scope resolves to single entity from component field
- Need to validate reciprocal relationships
- Pattern: "entity X is related to entity Y"

---

#### createArrayFilterResolver

**Purpose**: Filter array of entity IDs based on custom logic

**Signature**:
\`\`\`javascript
ScopeResolverHelpers.createArrayFilterResolver(scopeName, config)
\`\`\`

**Config Parameters**:
- `getArray` (function): `(actor, context, entityManager) => entityId[]`
- `filterFn` (function): `(entityId, actor, context, entityManager) => boolean`

**Example**:
\`\`\`javascript
const facingResolver = ScopeResolverHelpers.createArrayFilterResolver(
  'positioning:close_actors_facing_each_other_or_behind_target',
  {
    getArray: (actor, context, em) => {
      const closeness = em.getComponentData(actor.id, 'positioning:closeness');
      return closeness?.partners || [];
    },
    filterFn: (partnerId, actor, context, em) => {
      const actorFacingAway = em.getComponentData(actor.id, 'positioning:facing_away')?.facing_away_from || [];
      const partnerFacingAway = em.getComponentData(partnerId, 'positioning:facing_away')?.facing_away_from || [];

      const facingEachOther = !actorFacingAway.includes(partnerId) && !partnerFacingAway.includes(actor.id);
      const actorBehind = partnerFacingAway.includes(actor.id);

      return facingEachOther || actorBehind;
    },
  }
);
\`\`\`

**Use When**:
- Scope resolves to subset of entities from array
- Complex filtering logic required
- Pattern: "entities from list that match criteria"

---

#### createLocationMatchResolver

**Purpose**: Resolve to entities at the same location

**Signature**:
\`\`\`javascript
ScopeResolverHelpers.createLocationMatchResolver(scopeName, config)
\`\`\`

**Config Parameters**:
- `filterFn` (function, optional): Additional filtering after location match

**Example**:
\`\`\`javascript
const standingAtLocation = ScopeResolverHelpers.createLocationMatchResolver(
  'positioning:standing_actors_at_location',
  {
    filterFn: (entity) => {
      return !entity.components?.['positioning:sitting_on'] &&
             !entity.components?.['positioning:kneeling'];
    },
  }
);
\`\`\`

**Use When**:
- Scope resolves to entities at same location
- Optional filtering by component presence
- Pattern: "entities in same room [that meet criteria]"

---

#### createComponentFilterResolver

**Purpose**: Resolve to all entities with a specific component

**Signature**:
\`\`\`javascript
ScopeResolverHelpers.createComponentFilterResolver(scopeName, config)
\`\`\`

**Config Parameters**:
- `componentType` (string): Component to filter by
- `filterFn` (function, optional): Additional filtering logic

**Example**:
\`\`\`javascript
const sittingActors = ScopeResolverHelpers.createComponentFilterResolver(
  'positioning:sitting_actors',
  {
    componentType: 'positioning:sitting_on',
  }
);
\`\`\`

**Use When**:
- Scope resolves to all entities with component (global)
- Pattern: "all entities with component X"

---

### Choosing the Right Factory Method

| Pattern | Factory Method | Example |
|---------|---------------|---------|
| "Entity ID from component field" | `createComponentLookupResolver` | "furniture actor is sitting on" |
| "Filter entities from array" | `createArrayFilterResolver` | "close actors facing each other" |
| "Entities at same location" | `createLocationMatchResolver` | "standing actors at location" |
| "All entities with component" | `createComponentFilterResolver` | "all kneeling actors" |
```

---

### Step 6: Add Quick Reference Tables

**Section**:
```markdown
## Quick Reference

### Scope Selection Guide

**Need to find...**

| Scenario | Scope Name | Category |
|----------|-----------|----------|
| Furniture actor sits on | `positioning:furniture_actor_sitting_on` | Positioning |
| Actors on same furniture | `positioning:actors_sitting_on_same_furniture` | Positioning |
| Actor to left on furniture | `positioning:closest_leftmost_occupant` | Positioning |
| Actor to right on furniture | `positioning:closest_rightmost_occupant` | Positioning |
| Furniture allowing sitting | `positioning:furniture_allowing_sitting_at_location` | Positioning |
| Standing actors nearby | `positioning:standing_actors_at_location` | Positioning |
| All sitting actors | `positioning:sitting_actors` | Positioning |
| All kneeling actors | `positioning:kneeling_actors` | Positioning |
| Furniture actor behind | `positioning:furniture_actor_behind` | Positioning |
| Entity being bitten | `positioning:actor_being_bitten_by_me` | Positioning |
| Close actors (facing/behind) | `positioning:close_actors_facing_each_other_or_behind_target` | Positioning |

### Coverage Matrix

| Mod Category | Total Scopes | Registered | Custom Needed | Coverage |
|--------------|--------------|------------|---------------|----------|
| **Positioning** | 15+ | 11 | 4 | 73% → 90%* |
| **Inventory** | 8+ | 5 | 3 | 62% → 80%* |
| **Anatomy** | 5+ | 3 | 2 | 60% → 85%* |

*After TEAOUTTHR-006 completion
```

---

### Step 7: Add Troubleshooting Section

**Section**:
```markdown
## Troubleshooting

### Scope Not Registered Error

**Symptom**: Action not discovered, no error message

**Cause**: Scope used in action but not registered in test

**Solution**:
1. Identify scope from action definition: `cat data/mods/{mod}/actions/{action}.action.json`
2. Check if scope in registry (this document)
3. If in registry: Add `ScopeResolverHelpers.register*Scopes()` to test
4. If not in registry: Create custom resolver using factory methods

### Custom Scope Implementation

**Symptom**: Action uses scope not in standard library

**Solution**:
1. Identify scope pattern (lookup, filter, location, component)
2. Choose appropriate factory method
3. Create and register custom resolver
4. See [Creating Custom Scope Resolvers](#creating-custom-scope-resolvers)

### Performance Issues

**Symptom**: Slow test execution with many scopes

**Optimization**:
- Register only needed scope categories
- Use `testFixture.reset()` instead of recreating fixture
- Disable diagnostics mode in production tests
```

---

## Files to Create
- `docs/testing/scope-resolver-registry.md` (complete new file)

## Files to Modify
- `docs/testing/mod-testing-guide.md` (add link to registry)
- `tests/common/mods/scopeResolverHelpers.js` (add JSDoc references to registry)

## Acceptance Criteria
✅ Complete scope-resolver-registry.md created
✅ All positioning scopes documented (11+)
✅ All inventory scopes documented (5+)
✅ All anatomy scopes documented (3+)
✅ All factory methods documented with examples
✅ Quick reference tables included
✅ Troubleshooting section added
✅ Cross-references from mod-testing-guide.md
✅ JSDoc comments in scopeResolverHelpers.js reference registry
✅ Examples are copy-pasteable and syntactically correct

## Testing Approach
- Validate all scope names against actual scopeResolverHelpers.js implementation
- Test all code examples for syntax correctness
- Verify factory method signatures match actual API
- Ensure cross-references link correctly

## Related Tickets
- TEAOUTTHR-001: Primary testing guide references this registry
- TEAOUTTHR-006: Provides expanded scope coverage to document
- TEAOUTTHR-008: Auto-registration will reference this registry

## Success Metrics
- Centralized scope reference eliminates searching through code
- Developers can quickly identify appropriate scope for use case
- Factory method patterns clearly documented for custom scopes
- Coverage matrix shows progress toward 90%+ scope coverage
