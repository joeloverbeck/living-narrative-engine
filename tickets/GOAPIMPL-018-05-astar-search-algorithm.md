# GOAPIMPL-018-05: A* Search Algorithm

**Parent Ticket**: GOAPIMPL-018 (GOAP A* Algorithm)
**Priority**: CRITICAL
**Estimated Effort**: 2.5 hours
**Dependencies**: GOAPIMPL-018-01 (MinHeap), GOAPIMPL-018-02 (state helpers), GOAPIMPL-018-03 (task library), GOAPIMPL-018-04 (parameter binding)

## Description

Implement the core A* search algorithm that finds optimal task sequences to achieve goals. Integrates all helper methods into complete planning logic.

## Acceptance Criteria

- [ ] A* search with open list (MinHeap) and closed set (Set)
- [ ] Goal satisfaction checking and plan termination
- [ ] Successor generation with parameter binding
- [ ] Effect simulation via IPlanningEffectsSimulator
- [ ] State deduplication via hashing
- [ ] Open list duplicate detection with path replacement
- [ ] Search limits (maxNodes, maxTime, maxDepth)
- [ ] Heuristic calculation via IHeuristicRegistry
- [ ] Plan reconstruction via PlanningNode.getPath()
- [ ] Returns null for unsolvable goals
- [ ] Comprehensive logging at all decision points
- [ ] 90%+ coverage

## Files to Modify

- `src/goap/planner/goapPlanner.js` - Add `plan()` method (~200 lines)

## Method Signature

```javascript
/**
 * Find optimal task sequence to achieve goal using A* search
 *
 * @param {string} actorId - Acting entity ID
 * @param {object} goal - Goal definition with goalState
 * @param {object} initialState - Starting world state
 * @param {object} options - Search configuration
 * @param {string} options.heuristic - Heuristic name (default: 'goal-distance')
 * @param {number} options.maxNodes - Max nodes to explore (default: 1000)
 * @param {number} options.maxTime - Max time in ms (default: 5000)
 * @param {number} options.maxDepth - Max plan length (default: 20)
 * @returns {Array<{taskId, parameters}>|null} Plan or null if unsolvable
 */
plan(actorId, goal, initialState, options = {}) {
  // A* search implementation
}
```

## Testing Requirements

Tests in `tests/unit/goap/planner/goapPlanner.plan.test.js`:
1. Simple single-task plan
2. Multi-task plan
3. Returns null for unsolvable goal
4. Enforces maxNodes limit
5. Enforces maxTime limit
6. Enforces maxDepth limit
7. Finds optimal path (shortest cost)
8. State deduplication works
9. Open list duplicate handling works
10. Heuristic errors handled (Infinity fallback)
11. Parameter binding failures skip task
12. Effect simulation failures skip task

---

**Next Ticket**: GOAPIMPL-018-06 (DI Registration)
