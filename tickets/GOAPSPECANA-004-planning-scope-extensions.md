# GOAPSPECANA-004: Planning Scope Extensions Specification

**Status**: Not Started
**Priority**: CRITICAL
**Estimated Effort**: 2-3 days
**Dependencies**: None
**Blocks**: GOAPSPECANA-002, GOAPSPECANA-011

## Problem Statement

Lines 137-142 identify that scopeDsl is "currently limited" for planning needs but don't specify required extensions. Current scopeDsl assumes same-location queries (`docs/scopeDsl/`), but planning needs world-wide queries with knowledge limitations.

## Objective

Specify complete extensions to scopeDsl to support planning-time target selection with knowledge-aware, world-wide queries.

## Acceptance Criteria

- [ ] Required scopeDsl extensions documented
- [ ] New query operators specified
- [ ] Knowledge-aware query semantics defined
- [ ] Backward compatibility with execution-time scopes maintained
- [ ] Performance implications assessed
- [ ] Implementation strategy defined
- [ ] Example planning scopes provided

## Tasks

### 1. Analyze Current ScopeDsl Limitations
- [ ] Review existing scopeDsl documentation (`docs/scopeDsl/`)
- [ ] List current assumptions:
  - Same-location queries (actor and targets in same location)
  - No knowledge filtering
  - Immediate accessibility checks
- [ ] Identify gaps for planning needs:
  - World-wide entity queries
  - Knowledge-based filtering (`core:known_to`)
  - Potential accessibility (not current accessibility)

### 2. Define World-Wide Query Extension
- [ ] Specify new query scope: `world:*` vs `location:*`
- [ ] Example syntax:
  ```
  // Execution-time (current):
  items:examinable_items_here

  // Planning-time (new):
  items:known_nourishing_items_anywhere
  ```
- [ ] Define scope resolution differences:
  - `_here` suffix → current location only
  - `_anywhere` suffix → world-wide search
  - `_reachable` suffix → pathfinding-aware
- [ ] Specify performance bounds (max entities scanned)

### 3. Define Knowledge-Aware Query Extension
- [ ] Specify `known_to` filter operator:
  ```
  items:nourishing_items_anywhere[known_to(actor)]
  ```
- [ ] Define knowledge check semantics:
  - Entity must have `core:known_to` component
  - Component must include actor.id in array
  - If no `core:known_to`, treat as unknown (filtered out)
- [ ] Specify integration with visibility system
- [ ] Document knowledge update mechanism (reference GOAPSPECANA-011)

### 4. Define Reachability Query Extension
- [ ] Specify `reachable_from` filter operator:
  ```
  locations:safe_locations[reachable_from(actor.location)]
  ```
- [ ] Define reachability semantics:
  - Uses pathfinding/navigation system
  - Considers locked doors, blocked paths
  - May have performance cost (document)
- [ ] Specify caching strategy for reachability checks

### 5. Specify Potential vs Actual Accessibility
- [ ] Define distinction:
  - **Actual accessibility** (execution-time): "Can actor use this target RIGHT NOW?"
    - Considers: same location, not in container, permissions, actor posture
  - **Potential accessibility** (planning-time): "Could actor EVENTUALLY use this target?"
    - Considers: known to actor, exists, not destroyed
    - Ignores: current location, current permissions
- [ ] Document filtering rules for each context
- [ ] Specify scope naming convention to distinguish

### 6. Backward Compatibility Analysis
- [ ] Ensure existing execution-time scopes unaffected
- [ ] Define migration path for ambiguous scopes
- [ ] Specify scope context parameter:
  ```javascript
  scopeEngine.resolve(scopeId, {
    context: 'planning' | 'execution',
    actor: actorId,
    worldState: snapshot  // for planning
  });
  ```

### 7. Performance Implications
- [ ] Estimate query costs:
  - World-wide scan: O(all_entities)
  - Knowledge filter: O(matching_entities)
  - Reachability: O(graph_search) - expensive
- [ ] Define performance requirements:
  - Planning scope resolution MUST complete <50ms for <500 entities
  - Reachability checks SHOULD be cached (invalidate on world changes)
- [ ] Recommend optimization strategies:
  - Spatial indexing for location queries
  - Knowledge graph caching
  - Lazy evaluation of expensive filters

### 8. Create Example Planning Scopes
- [ ] Example 1: Known nourishing items anywhere
  ```json
  {
    "id": "items:known_nourishing_items_anywhere",
    "query": "items:nourishing_items[known_to(actor)]",
    "context": "planning",
    "description": "All nourishing items the actor knows about"
  }
  ```

- [ ] Example 2: Reachable safe locations
  ```json
  {
    "id": "locations:safe_reachable_locations",
    "query": "locations:safe_locations[reachable_from(actor.location)]",
    "context": "planning",
    "description": "Safe locations actor can reach"
  }
  ```

- [ ] Example 3: Known actors in different location
  ```json
  {
    "id": "actors:known_actors_elsewhere",
    "query": "actors:all[known_to(actor) & !same_location(actor)]",
    "context": "planning",
    "description": "Actors the actor knows about in other locations"
  }
  ```

### 9. Document in Specification
- [ ] Replace lines 137-142 with complete extension specification
- [ ] Add planning scope section with syntax and semantics
- [ ] Include performance requirements
- [ ] Link example scopes

## Expected Outputs

1. **Specification Update** (lines 137-142 expanded):
   - Complete planning scope extension specification
   - New operators documented
   - Knowledge-aware query semantics
   - Performance requirements
   - Example planning scopes

2. **ScopeDsl Extension Design**: `docs/scopeDsl/planning-extensions.md`
   - World-wide query operators
   - Knowledge-aware filtering
   - Reachability queries
   - Context-sensitive resolution
   - Performance optimization strategies

3. **Example Scopes**: `data/mods/core/scopes/planning/`
   - `known_nourishing_items_anywhere.scope`
   - `safe_reachable_locations.scope`
   - `known_actors_elsewhere.scope`

4. **ScopeDsl Implementation Plan**: `docs/goap/scopedsl-implementation.md`
   - Extension points in existing scopeDsl engine
   - New resolver implementations
   - Performance optimization strategy
   - Testing approach

5. **Performance Benchmark Plan**:
   - Test scenarios (entity counts, query complexity)
   - Target performance metrics
   - Optimization milestones

## Success Metrics

- All planning scope requirements clearly specified
- Backward compatibility maintained
- Performance requirements defined and achievable
- Example scopes validate against requirements
- Implementation plan is clear and actionable
- No ambiguity about planning vs execution scopes

## Notes

- ScopeDsl engine in `src/scopeDsl/` - review existing architecture
- Planning scopes may need separate resolver implementations
- Knowledge system integration critical (see GOAPSPECANA-011)
- Performance is critical - world-wide scans could be expensive
- Consider incremental implementation: world-wide first, then knowledge-aware, then reachability
- May need to prototype to validate performance assumptions
