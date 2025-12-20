# Perception Event Logging System Refactoring Specification

## Document Overview

This specification analyzes the perception event logging system based on comprehensive E2E test suite analysis, identifies implicit contracts enforced by tests, documents inconsistencies between entry points, and proposes prioritized refactoring recommendations.

**Analysis Scope:**
- `tests/e2e/perception/PerceptibleEventLoggingPipeline.e2e.test.js` (127 lines)
- `tests/e2e/perception/PerceptionLogLimits.e2e.test.js` (379 lines)
- `tests/e2e/perception/RecipientRoutingAndExclusion.e2e.test.js` (247 lines)
- `tests/e2e/perception/SenseAwareFiltering.e2e.test.js` (748 lines)
- `tests/e2e/perception/SensorialLinkPropagation.e2e.test.js` (828 lines)

**Handler Files:**
- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`

---

## Section 1: Implicit Contracts Extracted from E2E Tests

### 1.1 Event Shapes

#### DISPATCH_PERCEPTIBLE_EVENT Operation

```typescript
{
  type: 'DISPATCH_PERCEPTIBLE_EVENT',
  parameters: {
    // Required fields
    location_id: string,           // Location where event occurs
    description_text: string,      // Primary description for observers
    perception_type: string,       // Event category (e.g., 'social.interaction')
    actor_id: string,              // Entity performing the action

    // Optional target fields
    target_id?: string,            // Target of the action
    actor_description?: string,    // First-person description for actor (bypasses filtering)
    target_description?: string,   // Target-perspective description (respects filtering)

    // Alternate sensory descriptions
    alternate_descriptions?: {
      auditory?: string,           // Sound-based fallback
      tactile?: string,            // Touch-based fallback
      olfactory?: string,          // Smell-based fallback
      limited?: string,            // Last-resort minimal description
    },

    // Filtering control
    sense_aware?: boolean,         // Default: true - enables sense filtering

    // Routing control
    contextual_data?: {
      recipientIds?: string[],     // Explicit recipient list
      excludedActorIds?: string[], // Exclusion list
    },

    // Propagation control
    origin_location_id?: string,   // Prevents loop in sensorial propagation
  }
}
```

**Evidence:**
- `PerceptibleEventLoggingPipeline.e2e.test.js:58-82` - Basic parameter structure
- `SenseAwareFiltering.e2e.test.js:142-212` - alternate_descriptions usage
- `RecipientRoutingAndExclusion.e2e.test.js:77-113` - contextual_data.recipientIds
- `SensorialLinkPropagation.e2e.test.js:195-281` - origin_location_id for loop prevention

#### ADD_PERCEPTION_LOG_ENTRY Operation

```typescript
{
  type: 'ADD_PERCEPTION_LOG_ENTRY',
  parameters: {
    // Required fields
    location_id: string,           // Where to log the entry
    entry: {                       // Log entry data
      descriptionText: string,
      timestamp: string,           // ISO8601 format
      perceptionType: string,
      actorId: string,
      targetId?: string | null,
      involvedEntities?: any[],
      perceivedVia?: string,       // Added by sense filter
      originalDescription?: string, // Debug: original before filtering
    },

    // Propagation control
    origin_location_id?: string,   // Source location for propagation
    originating_actor_id?: string, // Actor to exclude from linked locations

    // Routing control
    recipient_ids?: string[],      // Explicit recipients
    excluded_actor_ids?: string[], // Exclusion list

    // Description variants (forwarded from dispatch)
    actor_description?: string,
    target_description?: string,
    target_id?: string | null,
    alternate_descriptions?: object,
    sense_aware?: boolean,
  }
}
```

**Evidence:**
- `addPerceptionLogEntryHandler.js:84-134` - Parameter validation
- `log_perceptible_events.rule.json:10-27` - Field mapping from dispatch

---

### 1.2 Recipient Routing Semantics

#### Contract 1: Explicit Recipients Take Absolute Precedence

When `recipientIds` (DISPATCH) or `recipient_ids` (ADD) is provided and non-empty, ONLY those entity IDs receive log entries. Location broadcast is completely bypassed.

**Evidence:**
- `RecipientRoutingAndExclusion.e2e.test.js:77-113` ("routes explicitly listed recipients only")
  - Line 92-93: Only Alice receives entry, Bob (same location) does not
  - Line 102-108: Verify Alice has entry, Bob's log is empty

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:169-175` - `usingExplicitRecipients = recipients.length > 0`
- `addPerceptionLogEntryHandler.js:171-175` - Sets `entityIds = new Set(recipients)` directly

#### Contract 2: Exclusion List Inverts Broadcast

When `excludedActorIds` (DISPATCH) or `excluded_actor_ids` (ADD) is provided, all entities in location EXCEPT those excluded receive entries.

**Evidence:**
- `RecipientRoutingAndExclusion.e2e.test.js:115-151` ("excludes actors from broadcast delivery")
  - Line 130-131: Alice excluded, Bob in same location
  - Line 140-146: Bob receives entry, Alice's log is empty

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:179-186` - Filters `allInLocation` to exclude specified IDs

#### Contract 3: Default is Full Location Broadcast

Without explicit recipients or exclusions, ALL entities with `core:perception_log` component in the location receive entries.

**Evidence:**
- `PerceptibleEventLoggingPipeline.e2e.test.js:58-125` - Basic pipeline test
  - Line 105: Both actors receive same log entry

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:188` - Falls through to `entityIds = allInLocation`

#### Contract 4: Mutual Exclusivity Enforcement (CRITICAL INCONSISTENCY)

When BOTH `recipientIds` AND `excludedActorIds` are provided, the handlers differ:

| Entry Point | Behavior | Code Location |
|-------------|----------|---------------|
| DISPATCH_PERCEPTIBLE_EVENT | **ERROR** - Aborts operation, dispatches SYSTEM_ERROR_OCCURRED | `dispatchPerceptibleEventHandler.js:135-146` |
| ADD_PERCEPTION_LOG_ENTRY | **WARN** - Logs warning, continues with recipientIds only | `addPerceptionLogEntryHandler.js:160-167` |

**Evidence:**
- `RecipientRoutingAndExclusion.e2e.test.js:153-200` ("aborts dispatch when recipients and exclusions conflict")
  - Line 180-181: Sets both recipientIds AND excludedActorIds
  - Line 188-195: Verifies NO log entries created (dispatch aborted)

- `RecipientRoutingAndExclusion.e2e.test.js:202-245` ("warns and uses recipients when exclusions conflict")
  - Line 218-224: ADD operation with both parameters
  - Line 232-241: Alice (recipient) gets entry, Bob (excluded) does not

**Shared Utility:**
- `perceptionParamsUtils.js:80-110` - `validateRecipientExclusionExclusivity()`
  - Takes `behavior` parameter: `'error'` or `'warn'`
  - DISPATCH calls with `'error'`
  - ADD calls with `'warn'`

---

### 1.3 Propagation Semantics (Sensorial Links)

#### Contract 5: Sensorial Links Enable Cross-Location Propagation

Locations with `locations:sensorial_links.targets` array propagate events to linked locations automatically.

**Evidence:**
- `SensorialLinkPropagation.e2e.test.js:112-158` ("propagates events to linked locations with prefixed description")
  - Line 119-123: Origin location has sensorial_links to linked location
  - Line 150-156: Linked location actors receive prefixed entry

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:473-595` - Sensorial propagation logic

#### Contract 6: Prefix Format is Strict and Consistent

All propagated descriptions receive prefix: `"(From {locationName}) "` with trailing space.

**Evidence:**
- `SensorialLinkPropagation.e2e.test.js:148-150` - Exact prefix match verification
  ```javascript
  expect(linkedLog[0].descriptionText).toBe(
    '(From Origin Cave) The dragon roars loudly'
  );
  ```

**Fallback Behavior:**
- `SensorialLinkPropagation.e2e.test.js:160-191` ("uses location ID when name not available")
  - Line 185-188: When no `core:name`, uses location ID as prefix
  ```javascript
  expect(linkedLog[0].descriptionText).toBe(
    '(From unnamed-origin-loc) A strange sound echoes'
  );
  ```

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:553-559` - Prefix generation logic

#### Contract 7: Loop Prevention via origin_location_id

Bidirectional sensorial links do not cause infinite propagation or duplicate logging.

**Evidence:**
- `SensorialLinkPropagation.e2e.test.js:195-281` ("prevents loop when locations are bidirectionally linked")
  - Line 203-222: Both locations link to each other
  - Line 269-277: Each actor receives exactly ONE entry (not duplicated)

**Mechanism:**
- When propagating, `origin_location_id` is set to source location
- Target location checks: if `origin_location_id` != null AND != current location, skip propagation
- `addPerceptionLogEntryHandler.js:473-475`:
  ```javascript
  const canPropagateSensorialLinks =
    !usingExplicitRecipients &&
    (!originLocationId || originLocationId === locationId);
  ```

#### Contract 8: Originating Actor Excluded from Linked Location Logs

The actor who initiated the event is automatically excluded from receiving logs in linked locations (they already received it in their origin location).

**Evidence:**
- `SensorialLinkPropagation.e2e.test.js:325-428` ("excludes originating actor from linked location delivery")
  - Line 331-356: Dragon in both locations, triggers event
  - Line 414-424: Dragon gets ONE entry (origin), not two

- `SensorialLinkPropagation.e2e.test.js:430-466` ("originating actor logs in origin but excluded from linked")
  - Line 454-460: Explicitly verifies actor has entry in origin
  - Line 462: Linked location entry count excludes actor

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:567-569`:
  ```javascript
  if (originatingActorId) {
    exclusionSetForLinked.add(originatingActorId);
  }
  ```

#### Contract 9: Explicit Recipients Block All Propagation

When explicit recipients are specified, sensorial link propagation is completely disabled.

**Evidence:**
- `SensorialLinkPropagation.e2e.test.js:581-678` ("does not propagate when explicit recipients specified")
  - Line 599-612: Explicit recipientIds in contextual_data
  - Line 665-674: Linked location actors receive NO entries

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:473`:
  ```javascript
  const canPropagateSensorialLinks = !usingExplicitRecipients && ...
  ```

---

### 1.4 Filtering Semantics (Sense-Aware Descriptions)

#### Contract 10: Actor Description Bypasses All Filtering

When `actor_description` is provided and recipient is the `originating_actor_id`, use actor_description WITHOUT any sense filtering.

**Evidence:**
- `SenseAwareFiltering.e2e.test.js:365-433` ("uses actor_description for the originating actor regardless of lighting")
  - Line 381-386: Dark location, dragon can't see
  - Line 409: Dragon receives actor_description exactly
  - Line 414-416: Other observer gets filtered alternate description

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:310-314`:
  ```javascript
  if (actorDescription && recipientId === originatingActorId) {
    return { descriptionText: actorDescription, skipSenseFiltering: true };
  }
  ```

#### Contract 11: Target Description Respects Filtering

When `target_description` is provided and recipient is the `target_id` (and not also the actor), use target_description but filtering still applies.

**Evidence:**
- `SenseAwareFiltering.e2e.test.js:437-526` ("uses target_description for target and applies sense filtering")
  - Line 457-464: target_description provided
  - Line 493: Target receives target_description when can perceive

- `SenseAwareFiltering.e2e.test.js:528-600` ("applies sense filtering to target_description in dark room")
  - Line 573-579: Target can't see in dark room, gets alternate description

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:316-323`: Target gets target_description
- `addPerceptionLogEntryHandler.js:337-343`: Filtering applied to target description

#### Contract 12: Sense Fallback Cascade

When primary sense (visual) is unavailable, cascade through alternates:

| Priority | Condition | Description Used |
|----------|-----------|------------------|
| 1 | Lit location + can see | base description_text (visual) |
| 2 | Dark + can hear | alternate_descriptions.auditory |
| 3 | Dark + can smell | alternate_descriptions.olfactory |
| 4 | Dark + can feel | alternate_descriptions.tactile |
| 5 | All senses limited | alternate_descriptions.limited |
| 6 | No alternates | base description_text (fallback) |

**Evidence:**
- `SenseAwareFiltering.e2e.test.js:142-212` ("uses visual description when location is lit")
- `SenseAwareFiltering.e2e.test.js:214-283` ("falls back to auditory in darkness")
- `SenseAwareFiltering.e2e.test.js:285-361` ("uses limited when senses lacking")

#### Contract 13: sense_aware: false Disables ALL Filtering

Setting `sense_aware: false` bypasses the entire filtering system, using base description_text always.

**Evidence:**
- `SenseAwareFiltering.e2e.test.js:604-674` ("uses base description when sense_aware is false")
  - Line 628-631: sense_aware: false with alternates provided
  - Line 650: Base description used despite dark room

- `SenseAwareFiltering.e2e.test.js:676-745` ("ignores alternate_descriptions when sense_aware is false")
  - Line 700-704: Alternates provided but ignored
  - Line 720: Base description used even though limited perception

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:242-245`:
  ```javascript
  const shouldFilter =
    sense_aware !== false &&
    targetAlternateDescriptions &&
    this.#perceptionFilterService;
  ```

---

### 1.5 Log Storage Invariants

#### Contract 14: FIFO Ordering Preserved

When maxEntries is exceeded, oldest entries are dropped, newest are kept.

**Evidence:**
- `PerceptionLogLimits.e2e.test.js:130-147` ("truncates log entries when exceeding maxEntries limit")
  - Line 133-137: Dispatch 7 events with maxEntries=5
  - Line 142-146: Events 3-7 remain (oldest 1-2 dropped)

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:364`:
  ```javascript
  const nextLogEntries = [...logEntries, finalEntry].slice(-maxEntries);
  ```

#### Contract 15: Per-Actor Limits Enforced Independently

Each actor's maxEntries is respected independently, not globally.

**Evidence:**
- `PerceptionLogLimits.e2e.test.js:149-173` ("respects different maxEntries limits per actor")
  - Line 153-157: Actors with maxEntries 5, 3, and 50
  - Line 161-163: Dispatch 6 events
  - Line 166-171: Each actor respects their own limit

#### Contract 16: Atomic Batch Updates

All recipients in a single dispatch receive entries with identical timestamps.

**Evidence:**
- `PerceptionLogLimits.e2e.test.js:219-237` ("updates all recipients atomically in same batch")
  - Line 233-235: Verify timestamps match exactly

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:382-465` - Batch update strategies

#### Contract 17: Corruption Recovery

Invalid logEntries (non-array) or maxEntries (non-number) are recovered gracefully.

**Evidence:**
- `PerceptionLogLimits.e2e.test.js:269-284` ("recovers from corrupted logEntries")
  - Line 272: Set logEntries to string "not an array"
  - Line 280-282: After dispatch, valid array with 1 entry

- `PerceptionLogLimits.e2e.test.js:286-304` ("recovers from corrupted maxEntries")
  - Line 289: Set maxEntries to "invalid"
  - Line 300-302: Uses default 50, keeps last 50 entries

**Handler Implementation:**
- `addPerceptionLogEntryHandler.js:294-300`:
  ```javascript
  if (!Array.isArray(logEntries)) {
    logEntries = [];
  }
  if (typeof maxEntries !== 'number' || maxEntries < 1) {
    maxEntries = DEFAULT_MAX_LOG_ENTRIES; // 50
  }
  ```

---

### 1.6 Error and Warning Policies

#### Errors (Abort Operation)

| Scenario | Handler | Action | Test Evidence |
|----------|---------|--------|---------------|
| Recipients + Exclusions conflict | DISPATCH | Abort, dispatch SYSTEM_ERROR_OCCURRED | RecipientRoutingAndExclusion:153-200 |
| Missing required parameters | Both | Abort via safeDispatchError | Implicit in validation |
| Invalid perception_type | DISPATCH | Abort with suggestion | dispatchPerceptibleEventHandler.js:181-193 |

#### Warnings (Continue with Safe Default)

| Scenario | Handler | Action | Test Evidence |
|----------|---------|--------|---------------|
| Recipients + Exclusions conflict | ADD | Warn, use recipientIds | RecipientRoutingAndExclusion:202-245 |
| target_description but target lacks log | ADD | Warn, skip target | addPerceptionLogEntryHandler.js:207-211 |
| Legacy perception_type | DISPATCH | Warn deprecation | dispatchPerceptibleEventHandler.js:196-200 |

#### Silent Handling (No Error/Warning)

| Scenario | Handler | Action |
|----------|---------|--------|
| Empty location (no recipients) | ADD | Debug log, skip batch update |
| No matching explicit recipients | ADD | Debug log, continue |
| All actors excluded | ADD | Debug log, continue |
| Recipient can't perceive (filtered) | ADD | Silent skip (no entry) |

---

## Section 2: Entry Point Inconsistencies

### 2.1 Conflict Handling Policy Inconsistency

**Issue:** Same validation (recipient + exclusion conflict) produces different outcomes.

| Aspect | DISPATCH_PERCEPTIBLE_EVENT | ADD_PERCEPTION_LOG_ENTRY |
|--------|---------------------------|--------------------------|
| Mode | `'error'` | `'warn'` |
| Behavior | Aborts operation | Continues with recipientIds |
| Event dispatched? | No | N/A (log entry may be written) |
| Handler lines | 135-146 | 160-167 |

**Impact:** Users cannot predict whether conflicts are fatal or recoverable.

**Recommendation:** Unify to `'error'` mode (abort on conflict) per user confirmation.

### 2.2 Parameter Normalization Differences

| Aspect | DISPATCH | ADD |
|--------|----------|-----|
| contextual_data type check | Line 121-124: Explicit `typeof` check | None - direct destructure |
| Spread operator | `{ ...contextual_data }` safe spread | Direct property access |
| Array normalization | `normalizeEntityIds()` | `normalizeEntityIds()` |

**Code Comparison:**

```javascript
// DISPATCH - Defensive
const normalizedContextualData =
  typeof contextual_data === 'object' && contextual_data !== null
    ? { ...contextual_data }
    : {};

// ADD - Direct (less defensive)
const {
  origin_location_id: originLocationId,
  recipient_ids,
  excluded_actor_ids,
  // ...
} = params;
```

### 2.3 Logging Asymmetry

| Handler | Debug Statements | Coverage |
|---------|------------------|----------|
| DISPATCH | 1 | Only at final dispatch |
| ADD | 15+ | Validation, routing, filtering, batching, propagation |

**DISPATCH logging (line 242-244):**
```javascript
this.#logger.debug('DISPATCH_PERCEPTIBLE_EVENT: dispatching event', {
  payload,
});
```

**ADD logging examples:**
- Line 228-235: No recipients debug
- Line 266-268: Sense filtering result
- Line 402-408, 429-435, 458-464: Batch update progress
- Line 467-469: No perceivers
- Line 515-521: Linked location status

**Impact:** Difficult to trace event flow; DISPATCH is a "black box" compared to ADD.

### 2.4 Location Validation Differences

| Aspect | DISPATCH | ADD |
|--------|----------|-----|
| Validates location exists? | No | Yes (via getEntitiesInLocation fallback) |
| Validation method | Trusts parameter | Queries EntityManager |
| Fallback | None | Empty Set() |

---

## Section 3: Refactoring Recommendations

### Priority Order
1. Semantic consistency (single routing/conflict policy)
2. Determinism & ordering guarantees under burst writes
3. Observability/debuggability (trace ids, decision records)
4. Stable engine interfaces (EntityManager / location membership query)
5. Modder-facing API ergonomics (schema validation, normalization)
6. Performance (only if needed)

---

### R1: Unified Routing Policy Service

**Priority:** 1 - Semantic Consistency

**USER DECISION:** Error mode is canonical (abort on conflict)

#### Evidence

| Test File | Lines | Contract Verified |
|-----------|-------|-------------------|
| RecipientRoutingAndExclusion.e2e.test.js | 153-200 | DISPATCH aborts on conflict |
| RecipientRoutingAndExclusion.e2e.test.js | 202-245 | ADD warns on conflict |

These tests explicitly document the INCONSISTENT behavior that must be unified.

#### Proposed Design

**New Service:** `RecipientRoutingPolicyService`

**Location:** `src/perception/services/recipientRoutingPolicyService.js`

```javascript
/**
 * Centralized routing policy for perception events.
 * Enforces single canonical behavior for recipient/exclusion conflicts.
 */
class RecipientRoutingPolicyService {
  #logger;
  #dispatcher;

  constructor({ logger, dispatcher }) {
    this.#logger = logger;
    this.#dispatcher = dispatcher;
  }

  /**
   * Validates routing parameters for mutual exclusivity.
   * @returns {ValidationResult} { valid: boolean, error?: string }
   */
  validateRouting(recipientIds, excludedActorIds, operationName) {
    if (recipientIds?.length > 0 && excludedActorIds?.length > 0) {
      return {
        valid: false,
        error: `${operationName}: recipientIds and excludedActorIds are mutually exclusive`,
      };
    }
    return { valid: true };
  }

  /**
   * Handles validation failure with canonical error behavior.
   * @returns {boolean} false (operation should abort)
   */
  handleValidationFailure(error, operationName) {
    this.#logger.error(error);
    this.#dispatcher.dispatch('SYSTEM_ERROR_OCCURRED', {
      source: operationName,
      message: error,
    });
    return false;
  }
}
```

**Changes to Existing Handlers:**

1. Both handlers receive `RecipientRoutingPolicyService` via DI
2. Replace direct calls to `validateRecipientExclusionExclusivity()` with service calls
3. Remove `behavior` parameter - always error mode

#### Migration Plan

**Phase 1: Create Service (Tests Green)**
```
1. Create RecipientRoutingPolicyService class
2. Create unit tests: tests/unit/perception/services/recipientRoutingPolicyService.test.js
   - Test validateRouting with valid inputs
   - Test validateRouting with conflict
   - Test handleValidationFailure dispatches error
3. Register token and factory in DI
4. NO handler changes yet
```

**Phase 2: Wire into DISPATCH (Tests Green)**
```
1. Inject service into DispatchPerceptibleEventHandler
2. Replace inline validation with service.validateRouting()
3. All existing tests pass (behavior unchanged - DISPATCH already uses error mode)
```

**Phase 3: Wire into ADD with Behavior Change (Update Test)**
```
1. Inject service into AddPerceptionLogEntryHandler
2. Replace inline validation with service.validateRouting()
3. Update RecipientRoutingAndExclusion.e2e.test.js:
   - Test "warns and uses recipients when exclusions conflict" → rename to "aborts when recipients and exclusions conflict"
   - Update assertions to expect NO entries (abort behavior)
4. Run all e2e tests - should pass with unified behavior
```

**Phase 4: Cleanup**
```
1. Remove behavior parameter from validateRecipientExclusionExclusivity()
2. Consider deprecating utility in favor of service
3. Update documentation
```

#### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Mods rely on ADD's warn behavior | Low | Medium | Documented as breaking change; mods should not send conflicting params |
| Service adds DI complexity | Low | Low | Follows existing service patterns |
| Phase 3 test update breaks CI | Low | Medium | Update test atomically with handler change |

#### Success Criteria

**Existing Tests:**
- `RecipientRoutingAndExclusion.e2e.test.js` - All 4 tests pass (1 updated)
- `PerceptibleEventLoggingPipeline.e2e.test.js` - 1 test passes
- All other e2e suites unaffected

**New Tests:**
- `tests/unit/perception/services/recipientRoutingPolicyService.test.js`:
  - `validateRouting returns valid for recipientIds only`
  - `validateRouting returns valid for excludedActorIds only`
  - `validateRouting returns valid for neither`
  - `validateRouting returns invalid for both`
  - `handleValidationFailure dispatches SYSTEM_ERROR_OCCURRED`

---

### R2: Trace ID Correlation System

**Priority:** 3 - Observability/Debuggability

#### Evidence

| Test File | Lines | Observation |
|-----------|-------|-------------|
| PerceptibleEventLoggingPipeline.e2e.test.js | 82-124 | Uses timestamp correlation only |
| SensorialLinkPropagation.e2e.test.js | 111-158 | Traces via description prefix, not ID |

No test verifies trace ID flow because no trace ID exists in current implementation.

#### Proposed Design

**New Utility:** `PerceptionTraceIdGenerator`

**Location:** `src/perception/tracing/perceptionTraceIdGenerator.js`

```javascript
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates unique trace IDs for perception event correlation.
 */
export class PerceptionTraceIdGenerator {
  /**
   * Generate a trace ID with timestamp and UUID segment.
   * Format: perc_<timestamp>_<uuid-8chars>
   * @returns {string} Unique trace ID
   */
  static generate() {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    return `perc_${timestamp}_${uuid}`;
  }
}
```

**Payload Enhancement (DispatchPerceptibleEventHandler):**

```javascript
// Line ~220 after building payload
const payload = {
  // existing fields...
  traceId: PerceptionTraceIdGenerator.generate(),
  contextualData: normalizedContextualData,
  // ...
};
```

**Rule Mapping (log_perceptible_events.rule.json):**

```json
{
  "parameters": {
    "trace_id": "{event.payload.traceId}",
    // existing mappings...
  }
}
```

**ADD Handler Enhancement:**

```javascript
// Line ~228 in debug logging
this.#logger.debug(`ADD_PERCEPTION_LOG_ENTRY [${traceId}]: processing`, {
  locationId,
  recipientCount: entityIds.size,
});
```

**Schema Updates:**

```json
// dispatchPerceptibleEvent.schema.json - add to properties
"trace_id": {
  "type": "string",
  "description": "Auto-generated correlation ID (internal use)",
  "pattern": "^perc_[0-9]+_[a-f0-9]+$"
}
```

#### Migration Plan

**Phase 1: Create Generator (Tests Green)**
```
1. Create PerceptionTraceIdGenerator class
2. Create unit tests: tests/unit/perception/tracing/perceptionTraceIdGenerator.test.js
   - Test format matches pattern
   - Test uniqueness across calls
3. NO integration changes
```

**Phase 2: Wire into DISPATCH (Tests Green)**
```
1. Import generator into DispatchPerceptibleEventHandler
2. Add traceId to payload
3. Add optional field to schema
4. All existing tests pass (they don't assert on traceId)
```

**Phase 3: Wire into Rule and ADD (Tests Green)**
```
1. Update log_perceptible_events.rule.json to pass trace_id
2. ADD handler extracts and uses in logging
3. All debug logs include [traceId] prefix
4. All existing tests pass
```

**Phase 4: Add Correlation Test**
```
1. New e2e test: tests/e2e/perception/TraceIdCorrelation.e2e.test.js
   - Verify traceId present in log entry
   - Verify same traceId in origin and linked locations
   - Verify unique traceId per dispatch
```

#### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| UUID library dependency | None | None | Already used in project |
| Schema evolution | Low | Low | Optional field, backward compatible |
| Log volume increase | Low | Low | Debug level only |
| Payload size increase | Low | Low | ~30 chars per event |

#### Success Criteria

**Existing Tests:**
- All 5 e2e suites pass unchanged

**New Tests:**
- `tests/unit/perception/tracing/perceptionTraceIdGenerator.test.js`:
  - `generates string matching expected pattern`
  - `generates unique IDs on successive calls`
  - `includes timestamp in ID`

- `tests/e2e/perception/TraceIdCorrelation.e2e.test.js`:
  - `includes traceId in dispatched event payload`
  - `propagates traceId through rule to ADD handler`
  - `maintains same traceId across sensorial propagation`
  - `generates unique traceId per DISPATCH call`

---

### R3: Recipient Set Building Extraction

**Priority:** 1 - Semantic Consistency (DRY)

#### Evidence

**Duplicated Logic Locations:**

| Location | Lines | Purpose |
|----------|-------|---------|
| addPerceptionLogEntryHandler.js | 169-189 | Main location recipient building |
| addPerceptionLogEntryHandler.js | 571-580 | Sensorial link recipient building |

**Code Duplication:**
```javascript
// First occurrence (lines 169-189)
let entityIds;
if (usingExplicitRecipients) {
  entityIds = new Set(recipients);
} else {
  const allInLocation = this.#entityManager.getEntitiesInLocation(locationId) ?? new Set();
  if (usingExclusions) {
    const exclusionSet = new Set(excludedActors);
    entityIds = new Set([...allInLocation].filter((id) => !exclusionSet.has(id)));
  } else {
    entityIds = allInLocation;
  }
}

// Second occurrence (lines 571-580) - nearly identical
```

#### Proposed Design

**New Service:** `RecipientSetBuilder`

**Location:** `src/perception/services/recipientSetBuilder.js`

```javascript
/**
 * Builds recipient sets for perception events.
 * Single source of truth for recipient determination logic.
 */
class RecipientSetBuilder {
  #entityManager;
  #logger;

  constructor({ entityManager, logger }) {
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Build recipient set based on routing parameters.
   * @param {Object} options
   * @param {string} options.locationId - Location to query
   * @param {string[]} options.explicitRecipients - Explicit recipient list
   * @param {string[]} options.excludedActors - Actors to exclude
   * @param {string} [options.traceId] - For logging correlation
   * @returns {RecipientSetResult} { entityIds: Set<string>, mode: string }
   */
  build({ locationId, explicitRecipients = [], excludedActors = [], traceId }) {
    // Explicit recipients: use directly
    if (explicitRecipients.length > 0) {
      this.#logger.debug(`RecipientSetBuilder [${traceId}]: using explicit recipients`, {
        count: explicitRecipients.length,
      });
      return {
        entityIds: new Set(explicitRecipients),
        mode: 'explicit',
      };
    }

    // Get all entities in location
    const allInLocation = this.#entityManager.getEntitiesInLocation(locationId) ?? new Set();

    // Exclusion mode: filter out excluded actors
    if (excludedActors.length > 0) {
      const exclusionSet = new Set(excludedActors);
      const filtered = new Set([...allInLocation].filter(id => !exclusionSet.has(id)));
      this.#logger.debug(`RecipientSetBuilder [${traceId}]: using exclusion mode`, {
        total: allInLocation.size,
        excluded: excludedActors.length,
        remaining: filtered.size,
      });
      return {
        entityIds: filtered,
        mode: 'exclusion',
      };
    }

    // Broadcast mode: all in location
    this.#logger.debug(`RecipientSetBuilder [${traceId}]: using broadcast mode`, {
      count: allInLocation.size,
    });
    return {
      entityIds: allInLocation,
      mode: 'broadcast',
    };
  }
}
```

**Handler Refactoring:**

```javascript
// Replace inline logic with service call
const { entityIds, mode } = this.#recipientSetBuilder.build({
  locationId,
  explicitRecipients: recipients,
  excludedActors,
  traceId: validated.traceId,
});

const usingExplicitRecipients = mode === 'explicit';
const usingExclusions = mode === 'exclusion';
```

#### Migration Plan

**Phase 1: Create Service (Tests Green)**
```
1. Create RecipientSetBuilder class
2. Create unit tests: tests/unit/perception/services/recipientSetBuilder.test.js
   - Test explicit mode
   - Test exclusion mode
   - Test broadcast mode
   - Test empty location
   - Test null/undefined parameters
3. Register in DI
```

**Phase 2: Wire into ADD Handler (Tests Green)**
```
1. Inject RecipientSetBuilder
2. Replace first occurrence (main location)
3. Verify all e2e tests pass
4. Replace second occurrence (sensorial propagation)
5. Verify all e2e tests pass
```

**Phase 3: Add Deterministic Option (Tests Green)**
```
1. Add 'deterministic: boolean' option to build()
2. When true, return sorted array instead of Set
3. Update burst tests to verify ordering
4. Add explicit determinism test
```

#### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Service indirection overhead | Low | Low | Eliminates 30+ lines duplication |
| Subtle behavior difference | Low | Medium | Unit tests cover all modes |
| Set iteration non-determinism | Medium | Low | Phase 3 adds deterministic option |

#### Success Criteria

**Existing Tests:**
- All 5 e2e suites pass

**New Tests:**
- `tests/unit/perception/services/recipientSetBuilder.test.js`:
  - `returns explicit recipients when provided`
  - `excludes specified actors from broadcast`
  - `returns all in location for broadcast mode`
  - `returns empty set for empty location`
  - `handles null/undefined parameters gracefully`
  - `returns sorted array when deterministic is true`

**Code Quality:**
- No duplicated recipient building logic in handler
- Single service responsible for recipient determination

---

### R4: Schema Validation Strengthening

**Priority:** 5 - Modder-Facing API Ergonomics

#### Evidence

**Current Schema Gaps:**

| Schema | Field | Current Definition | Issue |
|--------|-------|-------------------|-------|
| dispatchPerceptibleEvent.schema.json | contextual_data | `type: "object"` only | No property validation |
| addPerceptionLogEntry.schema.json | alternate_descriptions | `oneOf: [object, string]` | Object has no structure |
| addPerceptionLogEntry.schema.json | entry | `type: "object", minProperties: 1` | No required fields |

**Runtime Validation in Handlers:**

```javascript
// dispatchPerceptibleEventHandler.js:121-124 - defensive type check
const normalizedContextualData =
  typeof contextual_data === 'object' && contextual_data !== null
    ? { ...contextual_data }
    : {};

// Handler has to defend against schema gaps
```

#### Proposed Design

**Schema Improvements:**

```json
// dispatchPerceptibleEvent.schema.json - contextual_data
"contextual_data": {
  "type": "object",
  "properties": {
    "recipientIds": {
      "oneOf": [
        { "type": "array", "items": { "type": "string", "minLength": 1 } },
        { "type": "string", "minLength": 1 }
      ],
      "description": "Explicit recipient entity IDs"
    },
    "excludedActorIds": {
      "oneOf": [
        { "type": "array", "items": { "type": "string", "minLength": 1 } },
        { "type": "string", "minLength": 1 }
      ],
      "description": "Entity IDs to exclude from broadcast"
    }
  },
  "additionalProperties": true,
  "default": {}
}

// addPerceptionLogEntry.schema.json - alternate_descriptions
"alternate_descriptions": {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "auditory": { "type": "string", "minLength": 1, "description": "Sound-based description" },
        "tactile": { "type": "string", "minLength": 1, "description": "Touch-based description" },
        "olfactory": { "type": "string", "minLength": 1, "description": "Smell-based description" },
        "limited": { "type": "string", "minLength": 1, "description": "Minimal description" }
      },
      "additionalProperties": false
    },
    {
      "type": "string",
      "minLength": 1,
      "description": "Placeholder resolved at runtime"
    }
  ]
}
```

**New Normalization Utility:**

**Location:** `src/utils/handlerUtils/perceptionNormalizationUtils.js`

```javascript
/**
 * Normalize contextual_data with type safety.
 * @param {any} contextual_data - Input from operation params
 * @param {Logger} logger - Logger instance
 * @param {string} operationName - For error context
 * @returns {NormalizedContextualData}
 */
export function normalizeContextualData(contextual_data, logger, operationName) {
  if (contextual_data === null || contextual_data === undefined) {
    return { recipientIds: [], excludedActorIds: [] };
  }

  if (typeof contextual_data !== 'object') {
    logger.warn(`${operationName}: contextual_data is not an object, using default`);
    return { recipientIds: [], excludedActorIds: [] };
  }

  return {
    recipientIds: normalizeEntityIds(contextual_data.recipientIds),
    excludedActorIds: normalizeEntityIds(contextual_data.excludedActorIds),
    ...contextual_data,
  };
}

/**
 * Normalize alternate_descriptions with type safety.
 * @param {any} alternate_descriptions - Input from operation params
 * @param {Logger} logger - Logger instance
 * @param {string} operationName - For error context
 * @returns {Object|null}
 */
export function normalizeAlternateDescriptions(alternate_descriptions, logger, operationName) {
  if (alternate_descriptions === null || alternate_descriptions === undefined) {
    return null;
  }

  // String indicates unresolved placeholder - skip filtering
  if (typeof alternate_descriptions === 'string') {
    return null;
  }

  if (typeof alternate_descriptions !== 'object') {
    logger.warn(`${operationName}: alternate_descriptions invalid type, skipping`);
    return null;
  }

  return alternate_descriptions;
}
```

#### Migration Plan

**Phase 1: Create Utilities (Tests Green)**
```
1. Create perceptionNormalizationUtils.js
2. Create unit tests:
   - normalizeContextualData with null/undefined/object/non-object
   - normalizeAlternateDescriptions with null/string/object/non-object
3. NO handler changes
```

**Phase 2: Refactor Handlers (Tests Green)**
```
1. DISPATCH: use normalizeContextualData
2. ADD: use normalizeAlternateDescriptions
3. All e2e tests pass (behavior unchanged)
```

**Phase 3: Strengthen Schemas (Tests Green)**
```
1. Update dispatchPerceptibleEvent.schema.json
2. Update addPerceptionLogEntry.schema.json
3. Run schema validation tests
4. Existing mods valid (additionalProperties: true)
```

**Phase 4: Documentation**
```
1. Document schema structure in docs/modding/
2. Add migration notes for future strict mode
3. Deprecation warnings for loose typing
```

#### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing mods | Low | Medium | additionalProperties: true |
| Schema validation performance | None | None | Already using AJV |
| String placeholder handling | Low | Low | Utility handles gracefully |

#### Success Criteria

**Existing Tests:**
- All 5 e2e suites pass

**New Tests:**
- `tests/unit/utils/handlerUtils/perceptionNormalizationUtils.test.js`:
  - `normalizeContextualData handles null`
  - `normalizeContextualData handles undefined`
  - `normalizeContextualData handles valid object`
  - `normalizeContextualData handles non-object`
  - `normalizeAlternateDescriptions handles string placeholder`
  - `normalizeAlternateDescriptions handles valid object`

**Schema Tests:**
- Existing mod content validates against updated schemas

---

### R5: Logging Symmetry and Debug Instrumentation

**Priority:** 3 - Observability/Debuggability

#### Evidence

| Handler | Debug Log Count | Coverage |
|---------|-----------------|----------|
| DISPATCH | 1 | Final dispatch only |
| ADD | 15+ | Full execution path |

**DISPATCH gap:** No logging for validation, normalization, or routing decisions.

#### Proposed Design

**Enhanced DISPATCH Logging:**

```javascript
// dispatchPerceptibleEventHandler.js

async execute(params, executionContext) {
  const traceId = PerceptionTraceIdGenerator.generate();

  this.#logger.debug(`DISPATCH_PERCEPTIBLE_EVENT [${traceId}]: starting`, {
    locationId: params.location_id,
    actorId: params.actor_id,
    perceptionType: params.perception_type,
  });

  // ... validation ...

  this.#logger.debug(`DISPATCH_PERCEPTIBLE_EVENT [${traceId}]: validation passed`, {
    hasRecipients: normalizedContextualData.recipientIds.length > 0,
    hasExclusions: normalizedContextualData.excludedActorIds.length > 0,
    senseAware: params.sense_aware,
  });

  // ... build payload ...

  this.#logger.debug(`DISPATCH_PERCEPTIBLE_EVENT [${traceId}]: dispatching`, {
    eventId: EVENT_ID,
    payloadKeys: Object.keys(payload),
  });

  this.#dispatcher.dispatch(EVENT_ID, payload);
}
```

**Decision Record Structure:**

**Location:** `src/perception/tracing/perceptionDecisionRecord.js`

```javascript
/**
 * Records decisions made during perception event processing.
 * Useful for debugging complex routing/filtering scenarios.
 */
export class PerceptionDecisionRecord {
  constructor(traceId) {
    this.traceId = traceId;
    this.decisions = [];
    this.startTime = Date.now();
  }

  recordRouting(mode, recipientCount, exclusionCount) {
    this.decisions.push({
      phase: 'routing',
      mode,
      recipientCount,
      exclusionCount,
      timestamp: Date.now(),
    });
    return this;
  }

  recordFiltering(recipientId, result, reason) {
    this.decisions.push({
      phase: 'filtering',
      recipientId,
      result, // 'included' | 'excluded'
      reason, // 'no_component' | 'sense_filtered' | 'passed'
      timestamp: Date.now(),
    });
    return this;
  }

  recordPropagation(targetLocationId, recipientCount) {
    this.decisions.push({
      phase: 'propagation',
      targetLocationId,
      recipientCount,
      timestamp: Date.now(),
    });
    return this;
  }

  toSummary() {
    return {
      traceId: this.traceId,
      durationMs: Date.now() - this.startTime,
      totalDecisions: this.decisions.length,
      phases: [...new Set(this.decisions.map(d => d.phase))],
    };
  }
}
```

#### Migration Plan

**Phase 1: Create Decision Record (Tests Green)**
```
1. Create PerceptionDecisionRecord class
2. Create unit tests for record accumulation
3. NO handler changes
```

**Phase 2: Add DISPATCH Logging (Tests Green)**
```
1. Add 3-4 debug log statements to DISPATCH
2. Include traceId in all logs
3. All e2e tests pass
```

**Phase 3: Integrate Decision Recording (Tests Green)**
```
1. Both handlers create/update decision record
2. Pass record through payload/params
3. Log summary at ADD completion
```

**Phase 4: Debug API (Future)**
```
1. Optional debug_mode in params
2. When enabled, include decision summary in response
3. Modders can inspect perception decisions
```

#### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Log volume | Low | Low | Debug level only |
| Memory for decision record | Low | Low | Short-lived, GC after use |
| Performance overhead | Low | Low | String operations only |

#### Success Criteria

**Existing Tests:**
- All 5 e2e suites pass

**New Tests:**
- `tests/unit/perception/tracing/perceptionDecisionRecord.test.js`:
  - `records routing decisions`
  - `records filtering decisions`
  - `records propagation decisions`
  - `calculates duration correctly`
  - `generates accurate summary`

**Observability:**
- Debug logs show symmetric coverage between handlers
- TraceId visible in all log statements

---

### R6: Deterministic Set Iteration

**Priority:** 2 - Determinism & Ordering Guarantees

#### Evidence

| Test File | Lines | Concern |
|-----------|-------|---------|
| PerceptionLogLimits.e2e.test.js | 343-376 | Burst writes with multiple recipients |
| SensorialLinkPropagation.e2e.test.js | 469-577 | Multiple linked locations |

**Current Behavior:**
- `getEntitiesInLocation()` returns Set
- Set iteration is insertion-order in modern JS
- But insertion order depends on EntityManager population
- Across restarts/rebuilds, order may differ

#### Proposed Design

**EntityManager Enhancement:**

```javascript
// IEntityManager.js - add method

/**
 * Get entities in location with deterministic ordering.
 * @param {string} locationId
 * @returns {string[]} Sorted entity IDs
 */
getEntitiesInLocationSorted(locationId) {
  const entities = this.getEntitiesInLocation(locationId);
  return entities ? [...entities].sort() : [];
}
```

**RecipientSetBuilder Enhancement:**

```javascript
build({ locationId, explicitRecipients, excludedActors, traceId, deterministic = false }) {
  // ... existing logic ...

  if (deterministic) {
    // Return sorted array for reproducible iteration
    return {
      entityIds: [...result.entityIds].sort(),
      mode: result.mode,
    };
  }

  return result;
}
```

#### Migration Plan

**Phase 1: Add EntityManager Method (Tests Green)**
```
1. Add getEntitiesInLocationSorted to IEntityManager
2. Implement in EntityManager
3. Unit tests for sorted behavior
```

**Phase 2: Wire into RecipientSetBuilder (Tests Green)**
```
1. Add 'deterministic' option
2. Default false (no behavior change)
3. ADD handler uses deterministic=true in debug builds
```

**Phase 3: Add Determinism Test**
```
1. New test verifying identical ordering across 100 runs
2. Uses seeded entity creation
3. Validates log entry order reproducibility
```

#### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Sort performance | Low | Low | O(n log n), small sets |
| Behavior change | None | None | Opt-in only |
| Memory overhead | Low | Low | Temporary array |

#### Success Criteria

**Existing Tests:**
- All 5 e2e suites pass

**New Tests:**
- `tests/unit/entities/entityManager.getEntitiesInLocationSorted.test.js`:
  - `returns sorted array`
  - `handles empty location`
  - `handles null location`

- `tests/e2e/perception/DeterministicOrdering.e2e.test.js`:
  - `produces identical recipient order across runs`
  - `produces identical log order across runs`

---

### R7: Stable Engine Interface Abstraction

**Priority:** 4 - Stable Engine Interfaces

#### Evidence

**Direct EntityManager Dependencies:**

| Handler | Line | Call |
|---------|------|------|
| addPerceptionLogEntryHandler.js | 176 | `this.#entityManager.getEntitiesInLocation()` |
| addPerceptionLogEntryHandler.js | 572 | `this.#entityManager.getEntitiesInLocation()` |

**Interface Definition:**
- `IEntityManager.js:156-164` - Defines `getEntitiesInLocation`

**Risk:** If EntityManager interface changes, handlers break.

#### Proposed Design

**New Port Interface:**

**Location:** `src/ports/ILocationMembershipQuery.js`

```javascript
/**
 * Port interface for querying entity membership in locations.
 * Abstracts perception handlers from EntityManager implementation details.
 */
export class ILocationMembershipQuery {
  /**
   * Get all entities currently in a location.
   * @param {string} locationId
   * @returns {Set<string>} Entity IDs in location
   */
  getEntitiesInLocation(locationId) {
    throw new Error('ILocationMembershipQuery.getEntitiesInLocation not implemented');
  }

  /**
   * Get entities in location with deterministic ordering.
   * @param {string} locationId
   * @returns {string[]} Sorted entity IDs
   */
  getEntitiesInLocationSorted(locationId) {
    throw new Error('ILocationMembershipQuery.getEntitiesInLocationSorted not implemented');
  }

  /**
   * Check if entity is in specific location.
   * @param {string} entityId
   * @param {string} locationId
   * @returns {boolean}
   */
  isInLocation(entityId, locationId) {
    throw new Error('ILocationMembershipQuery.isInLocation not implemented');
  }
}
```

**Adapter Implementation:**

**Location:** `src/perception/adapters/entityManagerLocationAdapter.js`

```javascript
import { ILocationMembershipQuery } from '../../ports/ILocationMembershipQuery.js';

/**
 * Adapts EntityManager to ILocationMembershipQuery interface.
 */
export class EntityManagerLocationAdapter extends ILocationMembershipQuery {
  #entityManager;

  constructor({ entityManager }) {
    super();
    this.#entityManager = entityManager;
  }

  getEntitiesInLocation(locationId) {
    return this.#entityManager.getEntitiesInLocation(locationId) ?? new Set();
  }

  getEntitiesInLocationSorted(locationId) {
    const entities = this.getEntitiesInLocation(locationId);
    return [...entities].sort();
  }

  isInLocation(entityId, locationId) {
    const entities = this.getEntitiesInLocation(locationId);
    return entities.has(entityId);
  }
}
```

**DI Registration:**

```javascript
// tokens.js
ILocationMembershipQuery: 'ILocationMembershipQuery',

// registrations.js
container.register(
  tokens.ILocationMembershipQuery,
  (deps) => new EntityManagerLocationAdapter({ entityManager: deps[tokens.IEntityManager] })
);
```

#### Migration Plan

**Phase 1: Create Port and Adapter (Tests Green)**
```
1. Create ILocationMembershipQuery interface
2. Create EntityManagerLocationAdapter
3. Unit tests for adapter
4. Register in DI
```

**Phase 2: Wire into RecipientSetBuilder (Tests Green)**
```
1. RecipientSetBuilder receives ILocationMembershipQuery
2. Replace entityManager.getEntitiesInLocation calls
3. All e2e tests pass
```

**Phase 3: Remove Direct EntityManager from ADD Handler (Tests Green)**
```
1. Handler receives RecipientSetBuilder (from R3)
2. RecipientSetBuilder uses ILocationMembershipQuery
3. Handler no longer needs direct EntityManager for location queries
```

#### Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Over-abstraction | Low | Low | Interface is minimal (3 methods) |
| DI complexity | Low | Low | Standard port/adapter pattern |
| Performance | None | None | Thin wrapper, no overhead |

#### Success Criteria

**Existing Tests:**
- All 5 e2e suites pass

**New Tests:**
- `tests/unit/perception/adapters/entityManagerLocationAdapter.test.js`:
  - `returns entities in location`
  - `returns empty set for unknown location`
  - `returns sorted array`
  - `checks entity presence correctly`

**Architecture:**
- Perception handlers decoupled from EntityManager
- Interface documented in `docs/architecture/ports/`

---

## Section 4: Things NOT to Refactor Yet

### 4.1 PerceptionFilterService Architecture

**Rationale:**
- Well-tested via `SenseAwareFiltering.e2e.test.js` (9 comprehensive tests)
- No reported bugs or semantic issues
- Lighting/sensory capability integration is stable
- Refactoring would require updating all sense-related tests

**Current State:**
- Service correctly cascades through sense alternatives
- Actor/target description handling works as designed
- sense_aware flag correctly bypasses filtering

**Recommendation:** Leave as-is until new requirements emerge.

### 4.2 Batch Update Optimization Strategy

**Rationale:**
- `batchAddComponentsOptimized` exists and functions correctly
- `PerceptionLogLimits.e2e.test.js` validates atomic behavior
- No performance issues reported
- Three-tier fallback (optimized → batch → individual) handles edge cases

**Current State:**
- Atomic updates verified by timestamp matching tests
- Fallback error handling works
- No memory issues observed

**Recommendation:** Leave as-is; optimize only if profiling indicates need.

### 4.3 Rule JSON Structure (log_perceptible_events.rule.json)

**Rationale:**
- Simple pass-through mapping works correctly
- Placeholder resolution is reliable
- Changes would require schema migration for existing mods
- No semantic issues with current structure

**Current State:**
- Correctly maps DISPATCH payload to ADD parameters
- Field naming consistent (camelCase → snake_case)
- All required fields passed through

**Recommendation:** Leave as-is; changes should be deferred to major version.

### 4.4 Sensorial Link Traversal Algorithm

**Rationale:**
- Loop prevention via `origin_location_id` works correctly
- `SensorialLinkPropagation.e2e.test.js` has 12 comprehensive tests
- Prefix generation is simple and correct
- Single-hop propagation is sufficient for current requirements

**Current State:**
- Bidirectional link handling verified
- Actor exclusion in propagation verified
- Multiple linked locations handled correctly

**Recommendation:** Leave as-is until multi-hop requirements emerge.

### 4.5 Test Infrastructure (ModTestHandlerFactory)

**Rationale:**
- Factory pattern is established across all perception tests
- `createHandlersWithPerceptionLogging` works reliably
- Changing would break test consistency
- Test helpers in `tests/common/` are stable

**Current State:**
- All 5 e2e suites use same factory pattern
- Mock service injection works correctly
- Test environment cleanup is reliable

**Recommendation:** Leave as-is; infrastructure changes are high-risk/low-reward.

---

## Implementation Sequence

### Phase A: Foundation (Estimated: 2-3 days)

1. **R1** - RecipientRoutingPolicyService
   - Create service with error-mode behavior
   - Unit tests
   - Wire into handlers

2. **R2** - PerceptionTraceIdGenerator
   - Create generator
   - Unit tests
   - Wire into DISPATCH payload

3. **R3** - RecipientSetBuilder
   - Create service
   - Unit tests
   - Wire into ADD handler

### Phase B: Integration (Estimated: 2-3 days)

4. Update test for unified routing policy (R1 completion)
5. Wire trace ID through rule and ADD handler (R2 completion)
6. Add deterministic option to RecipientSetBuilder (R6 partial)
7. Create perceptionNormalizationUtils (R4 partial)

### Phase C: Refinement (Estimated: 2 days)

8. Strengthen schemas (R4 completion)
9. Add symmetric logging to DISPATCH (R5)
10. Create ILocationMembershipQuery port (R7)

### Phase D: Verification (Estimated: 1 day)

11. Run full e2e suite
12. Add new integration tests for trace correlation
13. Add determinism verification tests
14. Documentation updates

---

## Critical Files Summary

### Files to Modify

| File | Changes | Recommendations |
|------|---------|-----------------|
| `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` | Add traceId, symmetric logging | R2, R5 |
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | Use services, extract recipient logic | R1, R3 |
| `src/utils/handlerUtils/perceptionParamsUtils.js` | Delegate to policy service | R1 |
| `data/schemas/operations/dispatchPerceptibleEvent.schema.json` | Add contextual_data structure | R4 |
| `data/schemas/operations/addPerceptionLogEntry.schema.json` | Strengthen alternate_descriptions | R4 |
| `tests/e2e/perception/RecipientRoutingAndExclusion.e2e.test.js` | Update conflict test | R1 |

### Files to Create

| File | Purpose | Recommendation |
|------|---------|----------------|
| `src/perception/services/recipientRoutingPolicyService.js` | Unified routing policy | R1 |
| `src/perception/tracing/perceptionTraceIdGenerator.js` | Trace ID generation | R2 |
| `src/perception/services/recipientSetBuilder.js` | Recipient set building | R3 |
| `src/utils/handlerUtils/perceptionNormalizationUtils.js` | Parameter normalization | R4 |
| `src/perception/tracing/perceptionDecisionRecord.js` | Decision logging | R5 |
| `src/ports/ILocationMembershipQuery.js` | Location query interface | R7 |
| `src/perception/adapters/entityManagerLocationAdapter.js` | EntityManager adapter | R7 |

### New Test Files

| File | Purpose | Recommendation |
|------|---------|----------------|
| `tests/unit/perception/services/recipientRoutingPolicyService.test.js` | Service unit tests | R1 |
| `tests/unit/perception/tracing/perceptionTraceIdGenerator.test.js` | Generator unit tests | R2 |
| `tests/unit/perception/services/recipientSetBuilder.test.js` | Builder unit tests | R3 |
| `tests/unit/utils/handlerUtils/perceptionNormalizationUtils.test.js` | Utility unit tests | R4 |
| `tests/e2e/perception/TraceIdCorrelation.e2e.test.js` | Trace flow e2e test | R2 |
| `tests/e2e/perception/DeterministicOrdering.e2e.test.js` | Ordering e2e test | R6 |

---

## Appendix: Test Coverage Map

### Existing E2E Tests and Contracts Verified

| Test File | Test Count | Primary Contracts |
|-----------|------------|-------------------|
| PerceptibleEventLoggingPipeline.e2e.test.js | 1 | Basic pipeline flow |
| PerceptionLogLimits.e2e.test.js | 8 | FIFO ordering, limits, corruption recovery |
| RecipientRoutingAndExclusion.e2e.test.js | 4 | Routing modes, conflict handling |
| SenseAwareFiltering.e2e.test.js | 9 | Sense cascade, actor/target descriptions |
| SensorialLinkPropagation.e2e.test.js | 12 | Propagation, prefixing, loop prevention |

### Test Assertions by Contract

| Contract # | Test Assertions | File:Lines |
|------------|-----------------|------------|
| C1 | 2 | RecipientRoutingAndExclusion:102-108 |
| C2 | 2 | RecipientRoutingAndExclusion:140-146 |
| C3 | 1 | PerceptibleEventLoggingPipeline:105 |
| C4 | 4 | RecipientRoutingAndExclusion:188-195, 232-241 |
| C5 | 2 | SensorialLinkPropagation:150-156 |
| C6 | 2 | SensorialLinkPropagation:185-188 |
| C7 | 2 | SensorialLinkPropagation:269-277 |
| C8 | 3 | SensorialLinkPropagation:414-424, 454-462 |
| C9 | 2 | SensorialLinkPropagation:665-674 |
| C10 | 2 | SenseAwareFiltering:409, 414-416 |
| C11 | 2 | SenseAwareFiltering:493, 573-579 |
| C12 | 6 | SenseAwareFiltering:various |
| C13 | 2 | SenseAwareFiltering:650, 720 |
| C14 | 2 | PerceptionLogLimits:142-146 |
| C15 | 3 | PerceptionLogLimits:166-171 |
| C16 | 1 | PerceptionLogLimits:233-235 |
| C17 | 2 | PerceptionLogLimits:280-282, 300-302 |

---

*Document generated from comprehensive E2E test suite analysis and handler code review.*
