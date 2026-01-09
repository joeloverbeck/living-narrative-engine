# Specification: Two-Phase Emotional State Update System

## Problem Statement

The current character turn system has a timing issue with emotional state updates:

1. A single LLM prompt currently handles: mood updates, sexual state updates, speech, thoughts, notes, and action selection
2. **The problem**: The emotional state passed to the prompt reflects the state BEFORE recent events happened
3. **Example**: A character was happily watching TV. Then a rock crashes through the wall. The prompt still contains the "happy watching TV" emotional state when asking the LLM to both update moods AND decide on actions

This breaks how people actually work: first they have an emotional reaction to events, THEN they think, plan, and decide. Our system passes stale emotional state to action decisions.

## Solution Overview

Split the single LLM call into two sequential calls:

1. **Phase 1 (Mood Update)**: Send prompt to update mood + sexual state based on recent events
2. **Persist State**: Update entity components and UI panels immediately
3. **Phase 2 (Action Decision)**: Send prompt with FRESH emotional state for speech, thoughts, notes, action selection

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CURRENT (BROKEN) FLOW                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Turn Start → Build Prompt (STALE emotional state) → LLM Call           │
│            → Response: moodUpdate + sexualUpdate + speech + action       │
│            → Persist mood updates (TOO LATE - action already decided)    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         NEW (CORRECT) FLOW                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Turn Start → Build Mood Prompt → LLM Call #1                           │
│            → Response: moodUpdate + sexualUpdate ONLY                    │
│            → Persist mood updates → Update UI panels                     │
│            → Build Action Prompt (FRESH emotional state) → LLM Call #2  │
│            → Response: speech + thoughts + notes + action                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Design Decisions (User Input)

1. **Perception Log**: The prompt receives the full perception log (up to 50 entries as capped by `addPerceptionLogEntryHandler.js`). The mood update prompt will use the same perception log as the action prompt.

2. **Debug Button**: The "Prompt to LLM" button will show a combined view - both prompts (mood update and action decision) side-by-side or in tabs for easy comparison.

3. **Error Handling**: If Phase 1 (mood update) fails, the entire turn should fail rather than falling back to single-prompt behavior. This ensures consistent behavior and makes bugs visible.

---

## Current Architecture

### Key Files

| File | Purpose |
|------|---------|
| `src/turns/adapters/llmChooser.js` | Main LLM interaction point (`choose()` method) |
| `src/prompting/AIPromptPipeline.js` | Orchestrates prompt generation |
| `src/prompting/AIPromptContentProvider.js` | Assembles prompt content sections |
| `src/prompting/promptBuilder.js` | Template substitution |
| `src/turns/services/LLMResponseProcessor.js` | Parses LLM response |
| `src/turns/schemas/llmOutputSchemas.js` | Response schema definitions |
| `src/ai/moodSexualPersistenceListener.js` | Persists mood/sexual updates to entity |
| `src/expressions/expressionPersistenceListener.js` | Evaluates expressions after state update |
| `data/prompts/corePromptText.json` | Prompt instructions including mood update rules |

### Current Data Flow

```
GenericTurnStrategy.decideAction()
  → LLMDecisionProvider.decide()
    → LLMChooser.choose()
      → AIPromptPipeline.generatePrompt()
      → LLMAdapter.getAIDecision()
      → LLMResponseProcessor.processResponse()
    → Returns {index, speech, thoughts, notes, moodUpdate, sexualUpdate}
  → ACTION_DECIDED event dispatched
  → MoodSexualPersistenceListener updates entity components
  → ExpressionPersistenceListener evaluates expressions
```

### Current Response Schema

```javascript
// src/turns/schemas/llmOutputSchemas.js - LLM_TURN_ACTION_RESPONSE_SCHEMA
required: ['chosenIndex', 'speech', 'thoughts', 'moodUpdate', 'sexualUpdate']
```

### Current Prompt Instructions

The `finalLlmInstructionText` in `data/prompts/corePromptText.json` contains BOTH:
- Mood/sexual state update instructions
- Speech, thought, notes, and action selection instructions

---

## Implementation Design

### Phase 1: New Schemas

#### 1.1 New Mood-Only Response Schema

**File:** `src/turns/schemas/llmOutputSchemas.js`

```javascript
export const LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID = 'llmMoodUpdateResponseSchema/v1';

export const LLM_MOOD_UPDATE_RESPONSE_SCHEMA = {
  $id: 'http://yourdomain.com/schemas/llmMoodUpdateResponse.schema.json',
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    moodUpdate: { /* same as existing */ },
    sexualUpdate: { /* same as existing */ },
  },
  required: ['moodUpdate', 'sexualUpdate'],
};
```

#### 1.2 Modified Action Response Schema (v5)

**File:** `src/turns/schemas/llmOutputSchemas.js`

```javascript
export const LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID = 'llmTurnActionResponseSchema/v5';

export const LLM_TURN_ACTION_RESPONSE_SCHEMA_V5 = {
  // Same structure but:
  // - Remove moodUpdate and sexualUpdate from properties
  // - required: ['chosenIndex', 'speech', 'thoughts']
};
```

---

### Phase 2: New Prompt Content

#### 2.1 Split Prompt Instructions

**File:** `data/prompts/corePromptText.json`

Add new entry `moodUpdateOnlyInstructionText`:
- Extract the "EMOTIONAL + SEXUAL STATE UPDATE" section from `finalLlmInstructionText`
- Include: axis definitions, update heuristics, change magnitudes
- Exclude: speech rules, thought rules, notes rules, action selection rules
- Add: instruction to respond with ONLY moodUpdate and sexualUpdate JSON

Modify existing `finalLlmInstructionText`:
- Remove the "EMOTIONAL + SEXUAL STATE UPDATE" section
- Keep: speech coloring rules (reference the inner state), thought coloring, notes rules, action selection

#### 2.2 New Prompt Content Provider Method

**File:** `src/prompting/AIPromptContentProvider.js`

Add method:
```javascript
async getMoodUpdatePromptData(gameStateDto, logger) {
  // Similar to getPromptData but:
  // - Uses getMoodUpdateInstructionText() instead of getFinalLlmInstructionText()
  // - Does NOT include availableActionsInfoContent
  // - Includes: character context, world context, perception log, current inner state
}
```

---

### Phase 3: New Services

#### 3.1 MoodUpdatePromptPipeline

**File:** `src/prompting/MoodUpdatePromptPipeline.js` (NEW)

```javascript
export class MoodUpdatePromptPipeline {
  async generateMoodUpdatePrompt(actor, context) {
    const currentLlmId = await this.#llmAdapter.getCurrentActiveLlmId();
    const gameStateDto = await this.#gameStateProvider.buildGameState(actor, context, this.#logger);
    const promptData = await this.#promptContentProvider.getMoodUpdatePromptData(gameStateDto, this.#logger);
    return await this.#promptBuilder.build(currentLlmId, promptData);
  }
}
```

#### 3.2 MoodResponseProcessor

**File:** `src/turns/services/MoodResponseProcessor.js` (NEW)

```javascript
export class MoodResponseProcessor {
  async processMoodResponse(llmJsonResponse, actorId) {
    const parsed = await this.#llmJsonService.parseAndRepair(llmJsonResponse, actorId);
    this.#validateSchema(parsed, LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID);
    return {
      moodUpdate: parsed.moodUpdate,
      sexualUpdate: parsed.sexualUpdate,
    };
  }
}
```

#### 3.3 TwoPhaseDecisionOrchestrator

**File:** `src/turns/orchestrators/TwoPhaseDecisionOrchestrator.js` (NEW)

```javascript
export class TwoPhaseDecisionOrchestrator {
  async orchestrate({ actor, context, actions, abortSignal }) {
    // PHASE 1: Mood Update
    const moodPrompt = await this.#moodUpdatePipeline.generateMoodUpdatePrompt(actor, context);
    const moodRaw = await this.#llmAdapter.getAIDecision(moodPrompt, abortSignal);
    const moodParsed = await this.#moodResponseProcessor.processMoodResponse(moodRaw, actor.id);

    // Persist immediately (BEFORE Phase 2)
    await this.#moodPersistenceService.persistMoodUpdate(actor.id, moodParsed.moodUpdate, moodParsed.sexualUpdate);
    this.#dispatchMoodUpdatedEvent(actor.id, moodParsed);

    // PHASE 2: Action Decision (with fresh emotional state)
    const actionPrompt = await this.#actionDecisionPipeline.generatePrompt(actor, context, actions);
    const actionRaw = await this.#llmAdapter.getAIDecision(actionPrompt, abortSignal);
    const actionParsed = await this.#actionResponseProcessor.processResponse(actionRaw, actor.id);

    return {
      index: actionParsed.action.chosenIndex,
      speech: actionParsed.action.speech,
      thoughts: actionParsed.extractedData?.thoughts ?? null,
      notes: actionParsed.extractedData?.notes ?? null,
      moodUpdate: moodParsed.moodUpdate,
      sexualUpdate: moodParsed.sexualUpdate,
    };
  }
}
```

---

### Phase 4: New Event Type

**File:** `src/constants/eventIds.js`

```javascript
export const MOOD_STATE_UPDATED_ID = 'MOOD_STATE_UPDATED';
```

This event fires after Phase 1 completes, allowing:
- UI panels to update before Phase 2
- Expression evaluation to occur at the correct time

---

### Phase 5: Modify Existing Components

#### 5.1 Update LLMChooser

**File:** `src/turns/adapters/llmChooser.js`

Modify `choose()` to delegate to `TwoPhaseDecisionOrchestrator`:

```javascript
async choose({ actor, context, actions, abortSignal }) {
  return await this.#twoPhaseOrchestrator.orchestrate({
    actor, context, actions, abortSignal,
  });
}
```

#### 5.2 Update MoodSexualPersistenceListener

**File:** `src/ai/moodSexualPersistenceListener.js`

- Add handler for `MOOD_STATE_UPDATED` event
- Modify `ACTION_DECIDED` handler to skip if mood already updated this turn

#### 5.3 Update ExpressionPersistenceListener

**File:** `src/expressions/expressionPersistenceListener.js`

- Listen for `MOOD_STATE_UPDATED` instead of (or in addition to) `ACTION_DECIDED`
- Ensure expressions evaluate after Phase 1, not after Phase 2

#### 5.4 Update "Prompt to LLM" Debug Button

**Files to modify:**
- `src/engine/gameEngine.js` - `previewLlmPromptForCurrentActor()` method
- `game.html` or `src/domUI/` - Modal display logic

The debug button should show a combined view:
- Tab 1: "Mood Update Prompt" - Shows the Phase 1 prompt
- Tab 2: "Action Decision Prompt" - Shows the Phase 2 prompt

Implementation approach:
```javascript
async previewLlmPromptForCurrentActor() {
  // Generate BOTH prompts
  const moodPrompt = await this.#moodUpdatePipeline.generateMoodUpdatePrompt(actor, context);
  const actionPrompt = await this.#aiPromptPipeline.generatePrompt(actor, context, availableActions);

  // Dispatch event with both prompts
  this.#dispatcher.dispatch({
    type: UI_SHOW_LLM_PROMPT_PREVIEW,
    payload: {
      moodPrompt,    // NEW
      actionPrompt,  // Renamed from 'prompt'
      actorId: actor.id,
    },
  });
}
```

---

### Phase 6: DI Registration

#### 6.1 New Tokens

**File:** `src/dependencyInjection/tokens/tokens-ai.js`

```javascript
TwoPhaseDecisionOrchestrator: 'TwoPhaseDecisionOrchestrator',
MoodUpdatePromptPipeline: 'MoodUpdatePromptPipeline',
MoodResponseProcessor: 'MoodResponseProcessor',
IMoodPersistenceService: 'IMoodPersistenceService',
```

#### 6.2 Registration

**File:** `src/dependencyInjection/registrations/aiRegistrations.js`

Register factories for all new services.

---

## Error Handling

### Phase 1 Failure Strategy

If the mood update LLM call fails, the entire turn fails:

```javascript
async orchestrate({ actor, context, actions, abortSignal }) {
  // PHASE 1: Mood Update - failure aborts the turn
  const moodPrompt = await this.#moodUpdatePipeline.generateMoodUpdatePrompt(actor, context);
  const moodRaw = await this.#llmAdapter.getAIDecision(moodPrompt, abortSignal);
  const moodParsed = await this.#moodResponseProcessor.processMoodResponse(moodRaw, actor.id);

  // If we got here, Phase 1 succeeded - persist and continue
  await this.#moodPersistenceService.persistMoodUpdate(...);

  // PHASE 2: Action Decision
  // ...
}
```

This approach:
- Makes bugs immediately visible
- Ensures consistent behavior (no hidden fallback paths)
- Simplifies testing (one code path, not two)

---

## Testing Strategy

### Unit Tests

| Test File | Coverage |
|-----------|----------|
| `tests/unit/turns/orchestrators/twoPhaseDecisionOrchestrator.test.js` | Orchestrator flow, error handling, fallback |
| `tests/unit/prompting/MoodUpdatePromptPipeline.test.js` | Prompt generation |
| `tests/unit/turns/services/MoodResponseProcessor.test.js` | Schema validation, parsing |
| `tests/unit/turns/schemas/llmMoodUpdateResponseSchema.test.js` | New schema validation |

### Integration Tests

| Test File | Coverage |
|-----------|----------|
| `tests/integration/turns/twoPhaseDecisionFlow.integration.test.js` | Full two-phase flow with mocked LLM |
| `tests/integration/prompting/moodUpdatePromptIntegration.test.js` | Prompt generation with real services |

### Manual Verification

1. Start game with LLM-controlled actor
2. Trigger an event that should cause emotional reaction (e.g., attack)
3. Verify emotional state panels update BEFORE action decision
4. Verify the action decision reflects the updated emotional state

---

## Implementation Status

### Completed Work

**Ticket 1: New Schemas** - ✅ COMPLETED
- Added `LLM_MOOD_UPDATE_RESPONSE_SCHEMA` and `LLM_MOOD_UPDATE_RESPONSE_SCHEMA_ID` to `src/turns/schemas/llmOutputSchemas.js`
- Added `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5` and `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5_ID` to `src/turns/schemas/llmOutputSchemas.js`
- ESLint passes on the modified file
- Unit tests still pending

---

## Implementation Tickets

### Ticket 1: New Schemas - ✅ DONE
- ~~Add `LLM_MOOD_UPDATE_RESPONSE_SCHEMA`~~
- ~~Add `LLM_TURN_ACTION_RESPONSE_SCHEMA_V5`~~
- Unit tests for both schemas (pending)

### Ticket 2: Prompt Text Split
- Add `moodUpdateOnlyInstructionText` to `corePromptText.json`
- Extract mood instructions from `finalLlmInstructionText`
- Modify `finalLlmInstructionText` to remove mood instructions

### Ticket 3: MoodUpdatePromptPipeline
- Create `src/prompting/MoodUpdatePromptPipeline.js`
- Add `getMoodUpdatePromptData()` to `AIPromptContentProvider`
- DI registration
- Unit tests

### Ticket 4: MoodResponseProcessor
- Create `src/turns/services/MoodResponseProcessor.js`
- DI registration
- Unit tests

### Ticket 5: TwoPhaseDecisionOrchestrator
- Create `src/turns/orchestrators/TwoPhaseDecisionOrchestrator.js`
- Add `MOOD_STATE_UPDATED` event ID
- DI registration
- Unit tests

### Ticket 6: Integration
- Modify `LLMChooser` to use orchestrator
- Update `MoodSexualPersistenceListener`
- Update `ExpressionPersistenceListener`
- Integration tests

### Ticket 7: Debug Button Update
- Modify `gameEngine.previewLlmPromptForCurrentActor()` to generate both prompts
- Update prompt preview modal to show tabs for both prompts
- Unit tests for the preview functionality

### Ticket 8: E2E Verification
- Manual testing
- E2E automated tests

---

## Files to Create

| File | Type |
|------|------|
| `src/prompting/MoodUpdatePromptPipeline.js` | New |
| `src/turns/services/MoodResponseProcessor.js` | New |
| `src/turns/orchestrators/TwoPhaseDecisionOrchestrator.js` | New |
| `tests/unit/turns/orchestrators/twoPhaseDecisionOrchestrator.test.js` | New |
| `tests/unit/prompting/MoodUpdatePromptPipeline.test.js` | New |
| `tests/unit/turns/services/MoodResponseProcessor.test.js` | New |
| `tests/integration/turns/twoPhaseDecisionFlow.integration.test.js` | New |

## Files to Modify

| File | Changes |
|------|---------|
| `src/turns/schemas/llmOutputSchemas.js` | Add new schemas |
| `data/prompts/corePromptText.json` | Split prompt instructions |
| `src/prompting/AIPromptContentProvider.js` | Add `getMoodUpdatePromptData()` |
| `src/turns/adapters/llmChooser.js` | Delegate to orchestrator |
| `src/ai/moodSexualPersistenceListener.js` | Handle new event |
| `src/expressions/expressionPersistenceListener.js` | Update event timing |
| `src/constants/eventIds.js` | Add `MOOD_STATE_UPDATED_ID` |
| `src/dependencyInjection/tokens/tokens-ai.js` | Add new tokens |
| `src/dependencyInjection/registrations/aiRegistrations.js` | Register new services |

---

## Design Decisions

### Why Two LLM Calls?
The timing problem cannot be solved with a single LLM call because:
1. The emotional state in the prompt is built BEFORE the LLM responds
2. We need the updated emotional state to influence action decisions
3. The only way to get fresh state is to persist Phase 1 results before building Phase 2 prompt

### Why Not Update State Mid-Response?
The prompt is built once before the LLM call. We cannot inject updated state into an already-sent prompt.

### Performance Consideration
Two LLM calls instead of one doubles latency for character turns. This is an acceptable tradeoff for correct emotional behavior.

### Backwards Compatibility
The fallback mechanism ensures that if Phase 1 fails, the system reverts to current single-prompt behavior, maintaining stability.
