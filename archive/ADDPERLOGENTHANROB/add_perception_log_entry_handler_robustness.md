# Specification: AddPerceptionLogEntryHandler Robustness

## Context

**Location**: `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`

**Role**: Core operation handler for adding perception log entries to entities. This is the primary mechanism through which AI-powered NPCs and human players receive narrative events. Most LLM interactions pass through perception logs, making this a critical system component.

**Current Size**: 617 lines (production code), 2,085 lines (test code) - 3.4:1 ratio

**Dependencies**:
- `EntityManager` - entity/component queries and mutations
- `SafeEventDispatcher` - error event dispatching
- `RecipientSetBuilder` - recipient set determination (explicit/exclusion/broadcast modes)
- `RecipientRoutingPolicyService` - mutual exclusivity validation
- `PerceptionFilterService` (optional) - sense-based filtering

**Integration Points**:
- Called by rule execution when `DISPATCH_PERCEPTIBLE_EVENT` operations are processed
- Writes to `core:perception_log` component on recipient entities
- Reads `core:sensorial_links` component for propagation
- Reads `core:name` component for origin labeling

---

## Problem

### What Failed

During test coverage improvement from ~95.7% to 100%, several issues emerged:

1. **Unreachable Code Discovered** (lines 508-510, 533-535):
   - The "No matching recipients" branch for explicit mode was logically impossible
   - `RecipientSetBuilder.build()` only returns `mode: 'explicit'` when input `explicitRecipients` array is non-empty (see `recipientSetBuilder.js:68-73`)
   - Empty `recipient_ids` array falls through to broadcast mode, never triggering explicit mode
   - **Resolution**: Removed unreachable ternary branches, added explanatory comments

2. **Complex Mock Requirements**:
   - Testing required 16+ mock configurations per test case
   - Inner closure `writeEntriesForRecipients` captures variables from outer scope
   - Path isolation required careful mock state management

3. **Path Explosion**:
   - 8+ distinct execution paths with 6+ nesting levels
   - Sensorial link propagation adds recursive complexity
   - Optional `perceptionFilterService` doubles conditional paths

### Test References

- Test file: `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`
- Coverage achieved: 100% lines/functions/statements, 93.38% branches
- Remaining uncovered branches are dead code paths that cannot be reached

### Root Cause

The handler evolved organically with features added incrementally:
1. Basic perception logging (original)
2. Explicit recipient targeting (v2)
3. Exclusion lists (v3)
4. Sense-based filtering (v4)
5. Sensorial link propagation (v5)
6. Role-based descriptions (actor/target) (v6)

Each iteration added conditional logic without restructuring, creating a complex control flow.

---

## Truth Sources

### 1. RecipientSetBuilder Contract

**File**: `src/perception/services/recipientSetBuilder.js:54-95`

```javascript
build({ locationId, explicitRecipients, excludedActors, traceId, deterministic }) {
  // Lines 68-73: Explicit mode ONLY when array has items
  if (normalizedRecipients.length > 0) {
    return this.#formatResult(new Set(normalizedRecipients), 'explicit', deterministic);
  }

  // Lines 78-88: Exclusion mode when exclusions provided
  if (normalizedExclusions.length > 0) {
    return this.#formatResult(filtered, 'exclusion', deterministic);
  }

  // Lines 91-94: Broadcast mode (default)
  return this.#formatResult(allInLocation, 'broadcast', deterministic);
}
```

**Invariant**: `mode === 'explicit'` implies `entityIds.size > 0`

### 2. Operation Schema

**File**: `data/schemas/operations/addPerceptionLogEntry.schema.json`

Required parameters:
- `location_id: string` (minLength: 1)
- `entry: object` (minProperties: 1)

Optional parameters:
- `recipient_ids: string[] | string`
- `excluded_actor_ids: string[] | string`
- `actor_description: string`
- `target_description: string`
- `target_id: string | null`
- `alternate_descriptions: object | string`
- `sense_aware: boolean` (default: true)
- `origin_location_id: string`
- `originating_actor_id: string`

### 3. Component Contracts

**Perception Log Component** (`core:perception_log`):
```javascript
{
  maxEntries: number,  // default: 50
  logEntries: Array<{
    descriptionText: string,
    perceptionType: string,
    timestamp: number,
    actorId?: string,
    perceivedVia?: string,
    originalDescription?: string
  }>
}
```

**Sensorial Links Component** (`core:sensorial_links`):
```javascript
{
  targets: string[]  // Array of linked location IDs
}
```

---

## Desired Behavior

### Normal Cases

1. **Standard Broadcast**: Entry delivered to all entities with `perception_log` in location
2. **Explicit Recipients**: Entry delivered only to specified recipient IDs
3. **Exclusion Mode**: Entry delivered to all except excluded IDs
4. **Sense Filtering**: Entries filtered based on recipient sense capabilities
5. **Role Descriptions**: Actor receives `actor_description`, target receives `target_description`
6. **Sensorial Propagation**: Entry propagated to linked locations with prefix

### Edge Cases

1. **Empty Location**: No entities with perception log → log debug, return
2. **All Excluded**: Exclusions remove all recipients → log debug, return
3. **No Sensorial Links**: No propagation, process primary location only
4. **Self-Loop Prevention**: Skip current location in sensorial targets
5. **Corrupted Log Data**: Non-array `logEntries` → recover to empty array
6. **Invalid maxEntries**: Non-positive number → reset to default (50)
7. **Missing Target Perception Log**: Warn but continue processing

### Failure Modes

| Scenario | Behavior | Log Level |
|----------|----------|-----------|
| Invalid params | Dispatch error event, return | error |
| Missing location_id | Dispatch error event, return | error |
| Missing entry | Dispatch error event, return | error |
| Mutual exclusivity violation | Return (policy service handles) | warn |
| Batch update failure | Fallback to individual updates | error |
| Individual update failure | Continue with next, dispatch error | error |

---

## Invariants

Properties that MUST always hold:

1. **Recipient Determination First**: `RecipientSetBuilder.build()` is called before any entry writing
2. **Explicit Mode Guarantee**: `mode === 'explicit'` implies `entityIds.size > 0`
3. **No Double Processing**: Each recipient receives exactly one entry per operation
4. **Sense Filtering Consistency**: Filtered recipients never receive entries
5. **Actor Description Bypass**: `actor_description` bypasses sense filtering for actor
6. **Target Description Filtering**: `target_description` undergoes sense filtering for target
7. **Prefix Transformation**: Sensorial propagation always prefixes with origin name
8. **Log Truncation**: `logEntries.length <= maxEntries` after every update
9. **Component Preservation**: Original component data structure is preserved, only `logEntries` modified

---

## API Contracts

### Stable (Must Not Change)

1. **Operation Type**: `"ADD_PERCEPTION_LOG_ENTRY"` (schema constant)
2. **Required Parameters**: `location_id`, `entry`
3. **Parameter Types**: As defined in schema
4. **Component IDs**: `core:perception_log`, `core:sensorial_links`, `core:name`

### RecipientSetBuilder Interface

```typescript
interface RecipientSetResult {
  entityIds: Set<string> | string[];  // Sorted array when deterministic
  mode: 'explicit' | 'exclusion' | 'broadcast';
}

interface RecipientSetBuilder {
  build(options: {
    locationId: string;
    explicitRecipients?: string[];
    excludedActors?: string[];
    traceId?: string;
    deterministic?: boolean;
  }): RecipientSetResult;
}
```

### Entry Format

```typescript
interface PerceptionEntry {
  descriptionText: string;
  perceptionType: string;
  timestamp: number;
  actorId?: string;
  perceivedVia?: string;        // Added by sense filtering
  originalDescription?: string;  // Preserved when filtered
}
```

---

## What Is Allowed to Change

### Recommended Refactoring

1. **Extract `writeEntriesForRecipients` to Class Method**
   - Currently: Inner closure capturing 16+ variables
   - Change: Private class method with parameter object
   - Benefit: Reduces closure complexity, improves testability

2. **Create `PerceptionEntryBuilder` Service**
   - Extract entry construction logic (lines 329-380)
   - Handle role-based description selection
   - Handle sense filtering integration
   - Benefit: Single responsibility, easier unit testing

3. **Extract Sensorial Propagation Service**
   - Lines 518-612 handle recursive propagation
   - Dedicated service with clear interface
   - Benefit: Testable in isolation, clearer flow

4. **Consolidate Filtering Paths**
   - Current: Multiple conditional blocks for filtering
   - Change: Strategy pattern for filter/no-filter paths
   - Benefit: Reduced nesting, clearer intent

### Internal Implementation Details

The following may change without breaking contracts:

- Error message wording
- Debug log format
- Internal variable naming
- Batch update implementation strategy
- Default `maxEntries` value
- Prefix text format for sensorial propagation

---

## Testing Plan

### Unit Tests (Existing - Maintain)

**File**: `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`

Current coverage: 100% lines, 93.38% branches

Key test groups:
- Constructor validation
- Parameter validation (`#validateParams`)
- Recipient mode detection (explicit/exclusion/broadcast)
- Sense filtering paths
- Role-based description routing
- Batch update success/failure
- Fallback mode execution

### Regression Tests (Required)

1. **Unreachable Code Prevention**
   - Test: Verify explicit mode always produces non-empty entityIds
   - Purpose: Prevent reintroduction of unreachable branches

2. **RecipientSetBuilder Contract**
   - Test: Empty explicitRecipients → broadcast mode
   - Test: Non-empty explicitRecipients → explicit mode with entities
   - Purpose: Document and enforce the mode guarantee

3. **Sense Filtering Edge Cases**
   - Test: Partial filtering results (some recipients filtered)
   - Test: All recipients filtered → no entries written
   - Purpose: Prevent silent data loss

### Property-Based Tests (Recommended)

1. **Entry Preservation**
   - Property: `output.descriptionText` derived from `input.entry.descriptionText` or role descriptions
   - All outputs traceable to input sources

2. **Log Size Invariant**
   - Property: `logEntries.length <= maxEntries` always
   - After any number of operations

3. **Recipient Completeness**
   - Property: Every recipient with perception log receives exactly one entry
   - Unless filtered by sense or excluded

### Integration Tests (Existing - Maintain)

- Location broadcast scenarios
- Sensorial link propagation
- Multi-recipient updates
- Error recovery paths

---

## Implementation Priority

### Phase 1: Document Current State (Completed)
- [x] This specification document
- [x] Code comments on unreachable branches
- [x] Test coverage at 100% lines

### Phase 2: Low-Risk Refactoring
- [ ] Extract `writeEntriesForRecipients` to private method
- [ ] Create parameter object to reduce closure variables
- [ ] Add explicit early returns for empty recipient sets

### Phase 3: Service Extraction
- [ ] Create `PerceptionEntryBuilder` service
- [ ] Extract sensorial propagation logic
- [ ] Update DI registrations

### Phase 4: Architecture Improvement
- [ ] Implement strategy pattern for filtering
- [ ] Consider splitting handler for different modes
- [ ] Add structured telemetry for debugging

---

## References

- Handler: `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`
- Tests: `tests/unit/logic/operationHandlers/addPerceptionLogEntryHandler.test.js`
- Schema: `data/schemas/operations/addPerceptionLogEntry.schema.json`
- RecipientSetBuilder: `src/perception/services/recipientSetBuilder.js`
- Related spec: `specs/perception_event_logging_refactor.md`
