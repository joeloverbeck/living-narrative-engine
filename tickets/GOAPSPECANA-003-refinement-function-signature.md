# GOAPSPECANA-003: Refinement Function Signature Specification

**Status**: Not Started
**Priority**: CRITICAL
**Estimated Effort**: 1 day
**Dependencies**: GOAPSPECANA-001
**Blocks**: GOAPSPECANA-007, GOAPSPECANA-013

## Problem Statement

The specification implies refinement behavior (lines 71-106) but never defines the exact function signature. Missing specifications:
- Input parameters not defined
- Return type structure unclear
- Error handling contract missing
- Async vs sync behavior unspecified
- Integration with task execution unclear

## Objective

Define complete refinement function signature with clear input/output contracts and error handling.

## Acceptance Criteria

- [ ] Complete function signature documented (TypeScript or JSDoc)
- [ ] Input parameters fully specified
- [ ] Return type structure defined
- [ ] Error handling contract documented
- [ ] Success and failure cases enumerated
- [ ] Integration points with task execution specified
- [ ] Example implementations provided

## Tasks

### 1. Define Base Function Signature
- [ ] Determine synchronous vs asynchronous (likely async for world queries)
- [ ] Define signature structure:
  ```typescript
  interface RefinementInput {
    task: Task;              // Planning task to refine
    boundParameters: Map<string, EntityId>;  // Resolved targets
    worldState: WorldState;  // Current game state (snapshot)
    actor: EntityId;         // Acting entity
    context: RefinementContext;  // Additional context
  }

  interface RefinementOutput {
    success: boolean;
    primitiveActions?: PrimitiveAction[];  // If success=true
    failureReason?: string;  // If success=false
    metadata?: RefinementMetadata;  // Debugging info
  }

  type RefinementFunction = (input: RefinementInput) => Promise<RefinementOutput>;
  ```

### 2. Specify Input Structure
- [ ] Document `Task` structure (reference GOAPSPECANA-002)
- [ ] Define `boundParameters` format (parameter name → resolved entity ID)
- [ ] Specify `WorldState` interface:
  - What data is included? (full world? actor-local?)
  - Is it a snapshot? (immutable)
  - How to query entities?
- [ ] Define `RefinementContext`:
  - Goal being pursued
  - Plan metadata
  - Execution history (for replanning)

### 3. Specify Output Structure
- [ ] Define `PrimitiveAction` structure:
  ```typescript
  interface PrimitiveAction {
    actionId: string;        // e.g., "items:pick_up_item"
    targets: Map<string, EntityId>;  // Target bindings
    metadata?: ActionMetadata;
  }
  ```
- [ ] Enumerate `failureReason` values:
  - `"no_valid_target"` - Cannot find suitable entity
  - `"preconditions_failed"` - World state incompatible
  - `"invalid_state"` - Actor cannot perform action
  - `"refinement_error"` - Logic error in refinement
- [ ] Define `RefinementMetadata`:
  - Considered alternatives
  - Decision rationale
  - Performance metrics

### 4. Error Handling Contract
- [ ] Distinguish between:
  - Expected failures (return `success: false`)
  - Unexpected errors (throw exception)
- [ ] Specify exception types:
  - `RefinementLogicError` - Bug in refinement code
  - `InvalidTaskError` - Malformed task structure
  - `WorldStateError` - Cannot query world state
- [ ] Document error propagation to planner

### 5. Integration Specification
- [ ] Document how refinement is invoked:
  - By whom? (PlanExecutor? TaskManager?)
  - When? (before executing task? on-demand?)
  - Context passing (how is context built?)
- [ ] Specify refinement caching:
  - Can results be cached?
  - Cache invalidation triggers
- [ ] Define failure escalation:
  - Refinement fails → replan immediately? or retry?
  - Max retry attempts

### 6. Create Example Implementations
- [ ] Example 1: Simple refinement (item in inventory)
  ```javascript
  async function refineConsumeNourishingItem({ task, boundParameters, worldState, actor }) {
    const itemId = boundParameters.get('item');
    const actorInventory = worldState.getComponent(actor, 'core:inventory');

    if (actorInventory.items.includes(itemId)) {
      // Simple case: already have item
      return {
        success: true,
        primitiveActions: [{
          actionId: 'items:consume_item',
          targets: new Map([['item', itemId]])
        }]
      };
    }

    // Complex case: need to acquire first
    const itemLocation = worldState.getComponent(itemId, 'core:location').location;
    return {
      success: true,
      primitiveActions: [
        { actionId: 'world:move_to_location', targets: new Map([['location', itemLocation]]) },
        { actionId: 'items:pick_up_item', targets: new Map([['item', itemId]]) },
        { actionId: 'items:consume_item', targets: new Map([['item', itemId]]) }
      ]
    };
  }
  ```

- [ ] Example 2: Failed refinement (no valid target)
- [ ] Example 3: Complex multi-step refinement

### 7. Document in Specification
- [ ] Replace lines 71-106 with complete signature specification
- [ ] Add refinement function contract section
- [ ] Include example implementations
- [ ] Link to task schema (GOAPSPECANA-002)

## Expected Outputs

1. **Specification Update** (lines 71-106 replaced):
   - Complete function signature (TypeScript/JSDoc)
   - Input parameter documentation
   - Output structure documentation
   - Error handling contract
   - Integration specification

2. **Type Definitions**: `src/goap/types/refinementTypes.js`
   ```javascript
   /** @typedef {import('./taskTypes.js').Task} Task */
   /** @typedef {import('./worldStateTypes.js').WorldState} WorldState */

   /**
    * @typedef {Object} RefinementInput
    * @property {Task} task - Planning task to refine
    * @property {Map<string, string>} boundParameters - Resolved targets
    * @property {WorldState} worldState - Current game state snapshot
    * @property {string} actor - Acting entity ID
    * @property {RefinementContext} context - Additional context
    */

   // ... complete type definitions
   ```

3. **Example Implementations**: `docs/goap/refinement-examples.md`
   - 3+ complete worked examples
   - Success and failure cases
   - Common patterns

4. **Integration Guide**: `docs/goap/refinement-integration.md`
   - How to invoke refinement
   - Context building
   - Error handling
   - Caching strategies

## Success Metrics

- Function signature is unambiguous
- All input/output types clearly defined
- Error handling contract comprehensive
- Example implementations compile and run
- Integration points clearly specified
- No ambiguity remains about refinement contract

## Notes

- Signature should support both HTN and code-based approaches (abstract interface)
- Consider async/await for world state queries
- WorldState snapshot critical to prevent state mutation during planning
- Failure handling must trigger replanning in main loop
- Consider performance implications of complex refinement logic
