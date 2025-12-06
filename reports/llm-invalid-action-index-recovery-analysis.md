# LLM Invalid Action Index Recovery - Analysis & Recommendations

**Date**: 2025-11-07 (Updated: 2025-11-07)
**Issue**: Rare case where competent LLM returns invalid action index, breaking immersion with generic fallback message
**Current Behavior**: Forces character to say "I encountered an unexpected issue and will wait for a moment."

**Report Status**: ✅ Verified against codebase - All assumptions and file references corrected

---

## Update Notes

This report has been verified against the actual codebase. Key corrections made:

1. **File Path Correction**: References to `src/utils/actionIndexValidation.js` corrected to `src/utils/actionIndexUtils.js`
2. **Data Flow Clarification**: The current implementation DOES pass LLM data to validation via `debugData.result`, but this data is NOT preserved in the Error object thrown
3. **Line Number Updates**: All file references updated with accurate line ranges
4. **Implementation Details**: Proposed solution updated to work with existing `debugData.result` structure
5. **Error Class Location**: Clarified that new error class should be created in `src/errors/` directory
6. **Step 3 Clarification**: Noted that `AbstractDecisionProvider` requires NO changes as it already passes data correctly

---

## Executive Summary

When an LLM returns an invalid action index during gameplay, the current fallback mechanism discards all LLM-generated content (speech, thoughts, notes) and replaces it with a generic, immersion-breaking message. This report analyzes the error flow, identifies the root cause as a **data loss architecture problem**, and recommends a minimal-change solution that preserves immersion by rescuing LLM-generated speech while safely executing a fallback action.

**Recommended Solution**: Enhance the validation error to carry LLM data, allowing the fallback factory to preserve character voice while substituting a safe action (`core:wait`).

---

## Problem Analysis

### Error Flow Trace

The error originates from this call chain:

```
LLMChooser.choose()
  → LLMResponseProcessor.processResponse() [extracts: index, speech, thoughts, notes]
    → AbstractDecisionProvider.decide() [has all LLM data]
      → assertValidActionIndex() [❌ THROWS HERE - data lost]
        → GenericTurnStrategy.decideAction() [❌ NO access to LLM data]
          → AIFallbackActionFactory.create() [❌ Generates generic message]
```

### Critical Data Loss Point

**File**: `src/turns/providers/abstractDecisionProvider.js:73-97`

```javascript
async decide(actor, context, actions, abortSignal) {
  // ✅ Has all LLM-generated data
  const { index, speech, thoughts, notes } = await this.choose(
    actor,
    context,
    actions,
    abortSignal
  );

  // ⚠️ Passes LLM data to validation via debugData parameter
  // BUT throws Error without preserving it in the Error object
  await assertValidActionIndex(
    index,
    actions.length,
    this.constructor.name,
    actor.id,
    this.#safeEventDispatcher,
    this.#logger,
    { result: { index, speech, thoughts, notes } } // Data goes to event dispatch, not Error
  );

  // Never reached on error
  return {
    chosenIndex: index,
    speech: speech ?? null,
    thoughts: thoughts ?? null,
    notes: notes ?? null,
  };
}
```

**File**: `src/turns/strategies/genericTurnStrategy.js:65-76`

```javascript
catch (err) {
  if (!this.fallbackFactory) throw err;

  // ❌ No LLM data available in Error object - only error info
  const fb = this.fallbackFactory.create(err.name, err, actor.id);

  const meta = {
    speech: fb.speech ?? null,  // Generic fallback message
    thoughts: null,             // Lost
    notes: null,                // Lost
  };

  return { kind: 'fallback', action: fb, extractedData: meta };
}
```

### What Gets Lost

**Important Clarification**: The current implementation DOES pass LLM data to `assertValidActionIndex()` via the `debugData.result` parameter. This data IS dispatched to the event system via `safeDispatchError()` for logging and monitoring. However, when the function throws an Error, this data is NOT preserved in the Error object itself.

When `assertValidActionIndex` throws a standard Error:

1. **Speech**: LLM's actual character dialogue/narration (dispatched to events, but lost in Error object)
2. **Thoughts**: Internal character reasoning (dispatched to events, but lost in Error object)
3. **Notes**: Metadata for memory system (dispatched to events, but lost in Error object)

What IS preserved in the Error object:

- Error name/message
- Actor ID (via error dispatch context, not Error object)
- Stack trace

What IS preserved in the event system (but not accessible to fallback handler):

- All LLM data (speech, thoughts, notes) via `safeDispatchError()`
- Full debugData context

**The Problem**: The fallback handler in `GenericTurnStrategy` only has access to the Error object, not the event system's data. This is the architectural gap that needs bridging.

### Current Fallback Behavior

**File**: `src/turns/services/AIFallbackActionFactory.js:38-72`

The factory generates a generic message based on error type:

```javascript
create(failureContext, error, actorId) {
  this.#logger.error(
    `AIFallbackActionFactory: Creating fallback for actor ${actorId} due to ${failureContext}.`,
    { actorId, error, errorMessage: error.message, stack: error.stack }
  );

  let userFriendlyErrorBrief = 'an unexpected issue';
  if (
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('http error 500')
  ) {
    userFriendlyErrorBrief = 'a server connection problem';
  } else if (failureContext === 'llm_response_processing') {
    userFriendlyErrorBrief = 'a communication issue';
  }

  const speechMessage = `I encountered ${userFriendlyErrorBrief} and will wait for a moment.`;

  return {
    actionDefinitionId: DEFAULT_FALLBACK_ACTION.actionDefinitionId,
    commandString: DEFAULT_FALLBACK_ACTION.commandString,
    speech: speechMessage,
    resolvedParameters: {
      actorId,
      isFallback: true,
      failureReason: failureContext,
      diagnostics: { /* ... */ },
    },
  };
}
```

**Issues with this approach**:

- ❌ Breaks character immersion (meta-reference to "issue")
- ❌ Same generic message for all characters
- ❌ Discards potentially valid LLM speech
- ❌ Lost character thoughts/notes hurt memory coherence

---

## Root Cause: Architecture Problem

### Design Issues

1. **Tight Coupling**: `AbstractDecisionProvider.decide()` combines data extraction and validation in a way that makes recovery impossible

2. **No Error Data Preservation**: While validation functions receive LLM data via the `debugData` parameter and dispatch it in error events, they throw standard Error objects that don't preserve this data for downstream error handlers

3. **Data Dispatched But Not Preserved**: The LLM data IS sent to the event system via `safeDispatchError()` but is NOT carried in the Error object that propagates up the call stack

4. **Limited Fallback Context**: `AIFallbackActionFactory.create()` signature only accepts `(failureContext, error, actorId)` - no slot for preserved data

5. **Assumption of Total Failure**: Architecture assumes if validation fails, entire LLM response is invalid (not true for index-only errors)

### Why This Happens Rarely

LLMs typically excel at following structured output formats, especially when schemas are enforced. The JSON schema validation (`LLM_TURN_ACTION_RESPONSE_SCHEMA`) catches most malformed responses. This error occurs when:

1. LLM returns **structurally valid** JSON (passes schema validation)
2. But `chosenIndex` value is **semantically invalid** (out of bounds)

This is a rare edge case where the LLM:

- ✅ Followed JSON structure perfectly
- ✅ Provided valid speech/thoughts/notes
- ❌ Selected an action index that doesn't exist (off-by-one error, hallucination, etc.)

---

## Recommended Solution: Enhanced Validation Error

### Approach Overview

**Option A: Validation Error Enhancement** (Recommended)

Modify the validation error to carry LLM data through the error handling chain, allowing the fallback factory to preserve character voice while substituting a safe action.

**Why this approach:**

- ✅ Minimal code changes (5 files modified)
- ✅ Preserves immersion by using LLM speech
- ✅ Still executes safe fallback action (`core:wait`)
- ✅ Maintains all error logging and event dispatch
- ✅ Backward compatible
- ✅ No architectural refactoring required

### Implementation Design

#### 1. Create Custom Error Type

**New File**: `src/errors/actionIndexValidationError.js`

```javascript
/**
 * @file Custom error for action index validation failures with preserved LLM data
 */

/**
 * Error thrown when LLM provides invalid action index but otherwise valid data
 * @extends Error
 */
export class ActionIndexValidationError extends Error {
  constructor(message, { index, speech, thoughts, notes, actionsLength }) {
    super(message);
    this.name = 'ActionIndexValidationError';
    this.llmData = { index, speech, thoughts, notes };
    this.context = { actionsLength };

    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ActionIndexValidationError);
    }
  }

  /**
   * Check if this error has preserved LLM data
   */
  hasPreservedData() {
    return Boolean(
      this.llmData &&
        (this.llmData.speech || this.llmData.thoughts || this.llmData.notes)
    );
  }
}
```

#### 2. Modify Validation Function

**File**: `src/utils/actionIndexUtils.js:18-46`

```javascript
import { safeDispatchError } from './safeDispatchErrorUtils.js';
import { ActionIndexValidationError } from '../errors/actionIndexValidationError.js';

export async function assertValidActionIndex(
  chosenIndex,
  actionsLength,
  providerName,
  actorId,
  dispatcher,
  logger,
  debugData = {}
) {
  // Existing integer check
  if (!Number.isInteger(chosenIndex)) {
    await safeDispatchError(
      dispatcher,
      `${providerName}: Did not receive a valid integer 'chosenIndex' for actor ${actorId}.`,
      debugData,
      logger
    );
    throw new Error('Could not resolve the chosen action to a valid index.');
  }

  // Enhanced bounds check with data preservation
  if (chosenIndex < 1 || chosenIndex > actionsLength) {
    const message = 'Player chose an index that does not exist for this turn.';

    // Extract LLM data from debugData.result (current structure)
    const llmData = debugData.result || {};

    // Create enhanced error with preserved LLM data
    const error = new ActionIndexValidationError(message, {
      index: chosenIndex,
      actionsLength,
      speech: llmData.speech,
      thoughts: llmData.thoughts,
      notes: llmData.notes,
    });

    // Existing error dispatch logic (unchanged)
    await safeDispatchError(
      dispatcher,
      `${providerName}: invalid chosenIndex (${chosenIndex}) for actor ${actorId}.`,
      { ...debugData, actionsCount: actionsLength },
      logger
    );

    throw error;
  }
}
```

#### 3. Pass LLM Data to Validation (No Changes Needed)

**File**: `src/turns/providers/abstractDecisionProvider.js:73-97`

**Note**: The current implementation ALREADY passes LLM data to the validation function via the `debugData` parameter. The structure `{ result: { index, speech, thoughts, notes } }` is already being used. No changes are required here; the validation function modification (Step 2) will extract data from `debugData.result`.

```javascript
async decide(actor, context, actions, abortSignal) {
  const { index, speech, thoughts, notes } = await this.choose(
    actor,
    context,
    actions,
    abortSignal
  );

  // Current code ALREADY passes LLM data via debugData.result
  await assertValidActionIndex(
    index,
    actions.length,
    this.constructor.name,
    actor.id,
    this.#safeEventDispatcher,
    this.#logger,
    { result: { index, speech, thoughts, notes } } // ALREADY passing data
  );

  return {
    chosenIndex: index,
    speech: speech ?? null,
    thoughts: thoughts ?? null,
    notes: notes ?? null,
  };
}
```

#### 4. Update Fallback Factory Signature

**File**: `src/turns/services/AIFallbackActionFactory.js:38-72`

```javascript
/**
 * Create fallback action with optional preserved LLM data
 * @param {string} failureContext - Error context/type
 * @param {Error} error - Original error
 * @param {string} actorId - Actor ID
 * @param {Object} preservedData - Optional LLM data to preserve
 * @param {string|null} preservedData.speech - LLM-generated speech
 * @param {string|null} preservedData.thoughts - LLM-generated thoughts
 * @param {Array|null} preservedData.notes - LLM-generated notes
 */
create(failureContext, error, actorId, preservedData = {}) {
  const issue = this.#getIssueFromContext(failureContext);

  // Use preserved speech if available, otherwise generate fallback
  const speech = preservedData.speech ||
    `I encountered ${issue} and will wait for a moment.`;

  this.#logger.info(
    `AIFallbackActionFactory: Creating fallback for actor ${actorId} ` +
    `due to ${failureContext}. ` +
    `Preserved data: ${preservedData.speech ? 'speech' : 'none'}`
  );

  return {
    actionDefinitionId: 'core:wait',
    speech,
    primaryTargetId: null,
  };
}
```

#### 5. Preserve Data in Strategy Catch Block

**File**: `src/turns/strategies/genericTurnStrategy.js:65-76`

```javascript
catch (err) {
  if (!this.fallbackFactory) {
    throw err;
  }

  // Extract preserved LLM data if available
  const preservedData = err.llmData || {};

  const fb = this.fallbackFactory.create(
    err.name,
    err,
    actor.id,
    preservedData // NEW: Pass preserved data
  );

  // Use preserved LLM data if available
  const meta = {
    speech: preservedData.speech || fb.speech,
    thoughts: preservedData.thoughts || null,
    notes: preservedData.notes || null,
  };

  return {
    kind: 'fallback',
    action: fb,
    extractedData: meta,
  };
}
```

---

## Benefits Analysis

### Immersion Improvement

**Before** (current):

```
> "I encountered an unexpected issue and will wait for a moment."
  [Generic, meta-reference, breaks character voice]
```

**After** (with preservation):

```
> "Perhaps I should take a moment to assess the situation more carefully..."
  [LLM's actual speech, maintains character voice]
  [Action: wait - functionally safe]
  [Thoughts preserved: "This merchant seems suspicious"]
  [Notes preserved for memory system]
```

### Technical Benefits

1. **Minimal Changes**: Only 5 files modified, no architectural refactoring
2. **Backward Compatible**: Works with/without preserved data
3. **Safe Fallback**: Still uses `core:wait` action (no side effects)
4. **Error Logging**: All existing error dispatch/logging preserved
5. **Data Recovery**: Preserves valuable LLM output for memory coherence
6. **Testable**: Easy to add unit tests for error preservation path

### User Experience

- ✅ Maintains immersion during rare LLM errors
- ✅ Character voice preserved
- ✅ Turn continues naturally with safe "wait" action
- ✅ Memory system receives thoughts/notes (continuity preserved)
- ✅ No visible "error" message to player

---

## Alternative Approaches Considered

### Option B: Decision Provider Refactor

**Concept**: Split `AbstractDecisionProvider.decide()` into two phases:

1. Call `choose()` and return all data
2. Validate index separately with full context

**Pros**:

- Cleaner separation of concerns
- More flexible for future validation needs

**Cons**:

- Requires refactoring base class and all implementations
- Higher risk of regression
- More test updates required
- Doesn't provide significant benefits over Option A

**Verdict**: Rejected - unnecessary complexity for this use case

### Option C: Strategy-Level Recovery

**Concept**: Wrap `decisionProvider.decide()` in try-catch, retry with modified index

**Pros**:

- Could potentially "fix" the invalid index
- No changes to validation layer

**Cons**:

- Risky: Which index to substitute? (1? Last valid?)
- May execute unintended action
- Doesn't address root cause (data loss)
- Complex retry logic

**Verdict**: Rejected - too risky, unpredictable behavior

---

## Implementation Checklist

### Phase 1: Core Changes (Required)

- [ ] Create `ActionIndexValidationError` class in `src/errors/actionIndexValidationError.js`
- [ ] Export the new error class from `src/errors/index.js`
- [ ] Modify `assertValidActionIndex()` in `src/utils/actionIndexUtils.js` to throw enhanced error
- [ ] Modify `AIFallbackActionFactory.create()` signature to accept optional `preservedData` parameter
- [ ] Update `GenericTurnStrategy` catch block in `src/turns/strategies/genericTurnStrategy.js` to extract preserved data

### Phase 2: Testing (Required)

- [ ] Unit test: `ActionIndexValidationError` construction and methods
- [ ] Unit test: `assertValidActionIndex()` preserves data in error
- [ ] Unit test: `AIFallbackActionFactory` uses preserved speech
- [ ] Integration test: End-to-end error flow with data preservation
- [ ] Integration test: Backward compatibility (errors without preserved data)

### Phase 3: Documentation (Recommended)

- [ ] Update `AIFallbackActionFactory.js` JSDoc
- [ ] Add inline comments explaining preservation mechanism
- [ ] Update this report with implementation outcomes

### Phase 4: Monitoring (Recommended)

- [ ] Add log statement when preserved data is used
- [ ] Track frequency of `ActionIndexValidationError` vs generic errors
- [ ] Monitor if issue rate changes after implementation

---

## Risk Assessment

### Low Risk

1. **Backward Compatible**: If `llmData` is undefined, fallback to existing behavior
2. **Safe Fallback Action**: `core:wait` has no side effects
3. **Preserved Error Logging**: All existing error dispatch unchanged
4. **Limited Scope**: Changes isolated to error handling path

### Potential Issues

1. **Speech Quality**: LLM speech might reference the invalid action
   - **Mitigation**: Still better than generic message; future enhancement could filter action-specific references

2. **Testing Coverage**: Need thorough tests for preservation path
   - **Mitigation**: Add comprehensive unit and integration tests

3. **Memory Bloat**: Errors now carry more data
   - **Mitigation**: Minimal (3 string fields), only for validation errors

---

## Future Enhancements

### Phase 2 Improvements (Post-Implementation)

1. **Intelligent Action Substitution**: Analyze LLM speech to suggest best-fit action instead of always using "wait"

2. **Speech Sanitization**: Remove action-specific references from preserved speech if they mention the invalid action

3. **Telemetry Dashboard**: Track and analyze patterns in invalid action indices to improve prompt engineering

4. **Fallback Speech Generation**: If preserved speech explicitly references invalid action, use LLM to generate corrected speech

5. **User Configuration**: Allow game developers to customize fallback behavior per actor type

---

## Conclusion

The current immersion-breaking fallback behavior stems from an architectural data loss problem where LLM-generated content is discarded during validation failure. The recommended solution—enhancing validation errors to carry preserved data—provides a minimal-risk, high-impact improvement that maintains character immersion while safely handling rare LLM errors.

**Recommendation**: Implement Option A (Enhanced Validation Error) in the next development cycle.

**Expected Outcome**: Players will no longer see meta-error messages; instead, characters will naturally pause with their own voice preserved, maintaining immersion even during edge case failures.

---

## References

### Key Files Analyzed

1. `src/turns/adapters/llmChooser.js` - LLM integration point
2. `src/turns/services/LLMResponseProcessor.js` - Response parsing
3. `src/turns/providers/abstractDecisionProvider.js` - Validation layer (lines 73-97)
4. `src/turns/strategies/genericTurnStrategy.js` - Error handling (lines 65-76)
5. `src/turns/services/AIFallbackActionFactory.js` - Fallback generation (lines 38-72)
6. `src/utils/actionIndexUtils.js` - Validation logic (lines 18-46)
7. `src/llms/constants/llmConstants.js` - Fallback action constants
8. `src/errors/` - Error class directory structure

### Related Documentation

- `/docs/testing/mod-testing-guide.md` - Testing patterns
- `CLAUDE.md` - Project architecture overview
- Error handling patterns in `src/errors/` directory
