# TWOPHAEMOSTAUPD-006: TwoPhaseDecisionOrchestrator

## Summary

Create the main orchestrator that coordinates Phase 1 (mood update) and Phase 2 (action decision) LLM calls, ensuring mood is persisted before the action prompt is generated.

## Status

Completed

## Assumptions (Updated)

- `LLMResponseProcessor.processResponse()` returns `{ success, action, extractedData }` where `action.chosenIndex` and `action.speech` are always present (matching current `LLMChooser` behavior).
- `LLMChooser.choose()` returns `index` and `speech` directly from `action.chosenIndex` / `action.speech` without null fallbacks; the new orchestrator must mirror this shape while sourcing mood/sexual updates from Phase 1.
- `IMoodPersistenceService` is already registered via `src/ai/services/MoodPersistenceService.js` and should be consumed through DI tokens (no direct imports in the orchestrator).

## Dependencies

- **Requires:** TWOPHAEMOSTAUPD-003 (MoodUpdatePromptPipeline)
- **Requires:** TWOPHAEMOSTAUPD-004 (MoodResponseProcessor)
- **Requires:** TWOPHAEMOSTAUPD-005 (MoodPersistenceService)

## Files to Touch

| File | Action |
|------|--------|
| `src/turns/orchestrators/TwoPhaseDecisionOrchestrator.js` | CREATE |
| `src/turns/orchestrators/` (directory) | CREATE if not exists |
| `src/dependencyInjection/tokens/tokens-ai.js` | MODIFY |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY |
| `tests/unit/turns/orchestrators/TwoPhaseDecisionOrchestrator.test.js` | CREATE |

## Out of Scope

- **DO NOT** modify `LLMChooser` yet (separate ticket TWOPHAEMOSTAUPD-007)
- **DO NOT** modify persistence listeners
- **DO NOT** modify UI components
- **DO NOT** add debug button changes
- **DO NOT** add fallback to single-prompt behavior

## Implementation Details

### New Directory

Create `src/turns/orchestrators/` if it doesn't exist.

### New File: `TwoPhaseDecisionOrchestrator.js`

```javascript
/**
 * @file Orchestrates two-phase emotional state update flow
 * Phase 1: Generate mood prompt → LLM call → Parse → Persist mood
 * Phase 2: Generate action prompt (fresh mood) → LLM call → Parse → Return
 */

export class TwoPhaseDecisionOrchestrator {
  #moodUpdatePipeline;
  #moodResponseProcessor;
  #moodPersistenceService;
  #aiPromptPipeline;
  #llmAdapter;
  #llmResponseProcessor;
  #logger;

  constructor({
    moodUpdatePipeline,
    moodResponseProcessor,
    moodPersistenceService,
    aiPromptPipeline,
    llmAdapter,
    llmResponseProcessor,
    logger,
  }) {
    // Validate all 7 dependencies
    this.#validateDependencies({
      moodUpdatePipeline,
      moodResponseProcessor,
      moodPersistenceService,
      aiPromptPipeline,
      llmAdapter,
      llmResponseProcessor,
      logger,
    });

    this.#moodUpdatePipeline = moodUpdatePipeline;
    this.#moodResponseProcessor = moodResponseProcessor;
    this.#moodPersistenceService = moodPersistenceService;
    this.#aiPromptPipeline = aiPromptPipeline;
    this.#llmAdapter = llmAdapter;
    this.#llmResponseProcessor = llmResponseProcessor;
    this.#logger = logger;
  }

  #validateDependencies(deps) {
    if (!deps.moodUpdatePipeline?.generateMoodUpdatePrompt) {
      throw new Error('TwoPhaseDecisionOrchestrator: moodUpdatePipeline required');
    }
    if (!deps.moodResponseProcessor?.processMoodResponse) {
      throw new Error('TwoPhaseDecisionOrchestrator: moodResponseProcessor required');
    }
    if (!deps.moodPersistenceService?.persistMoodUpdate) {
      throw new Error('TwoPhaseDecisionOrchestrator: moodPersistenceService required');
    }
    if (!deps.aiPromptPipeline?.generatePrompt) {
      throw new Error('TwoPhaseDecisionOrchestrator: aiPromptPipeline required');
    }
    if (!deps.llmAdapter?.getAIDecision) {
      throw new Error('TwoPhaseDecisionOrchestrator: llmAdapter required');
    }
    if (!deps.llmResponseProcessor?.processResponse) {
      throw new Error('TwoPhaseDecisionOrchestrator: llmResponseProcessor required');
    }
    if (!deps.logger?.debug) {
      throw new Error('TwoPhaseDecisionOrchestrator: logger required');
    }
  }

  /**
   * Execute two-phase decision flow.
   * @param {Object} params
   * @param {Object} params.actor - Actor entity
   * @param {Object} params.context - Turn context
   * @param {Array} params.actions - Available actions
   * @param {AbortSignal} [params.abortSignal] - Optional abort signal
   * @returns {Promise<Object>} Decision result matching LLMChooser.choose() return type
   */
  async orchestrate({ actor, context, actions, abortSignal }) {
    this.#logger.debug(`TwoPhaseDecisionOrchestrator: Starting for actor ${actor.id}`);

    // ========================================
    // PHASE 1: Mood Update
    // ========================================
    this.#logger.debug('TwoPhaseDecisionOrchestrator: Phase 1 - Mood Update');

    // Generate mood-only prompt
    const moodPrompt = await this.#moodUpdatePipeline.generateMoodUpdatePrompt(actor, context);

    // Call LLM for mood update
    const moodRawResponse = await this.#llmAdapter.getAIDecision(moodPrompt, abortSignal);

    // Parse and validate mood response
    // If this fails, the entire turn fails (no fallback)
    const moodParsed = await this.#moodResponseProcessor.processMoodResponse(
      moodRawResponse,
      actor.id
    );

    // Persist mood update BEFORE Phase 2
    // This ensures Phase 2 prompt sees fresh emotional state
    await this.#moodPersistenceService.persistMoodUpdate(
      actor.id,
      moodParsed.moodUpdate,
      moodParsed.sexualUpdate
    );

    this.#logger.debug('TwoPhaseDecisionOrchestrator: Phase 1 complete, mood persisted');

    // ========================================
    // PHASE 2: Action Decision
    // ========================================
    this.#logger.debug('TwoPhaseDecisionOrchestrator: Phase 2 - Action Decision');

    // Generate action prompt (now with FRESH emotional state)
    const actionPrompt = await this.#aiPromptPipeline.generatePrompt(actor, context, actions);

    // Call LLM for action decision
    const actionRawResponse = await this.#llmAdapter.getAIDecision(actionPrompt, abortSignal);

    // Parse and validate action response
    const actionResult = await this.#llmResponseProcessor.processResponse(
      actionRawResponse,
      actor.id
    );

    this.#logger.debug('TwoPhaseDecisionOrchestrator: Phase 2 complete');

    // ========================================
    // Return combined result
    // ========================================
    // Must match LLMChooser.choose() return type for backward compatibility
    return {
      index: actionResult.action.chosenIndex,
      speech: actionResult.action.speech,
      thoughts: actionResult.extractedData?.thoughts ?? null,
      notes: actionResult.extractedData?.notes ?? null,
      moodUpdate: moodParsed.moodUpdate,
      sexualUpdate: moodParsed.sexualUpdate,
    };
  }
}
```

### DI Token

Add to `tokens-ai.js`:
```javascript
TwoPhaseDecisionOrchestrator: 'TwoPhaseDecisionOrchestrator',
```

### DI Registration

Add factory to `aiRegistrations.js`:
```javascript
registrar.singletonFactory(tokens.TwoPhaseDecisionOrchestrator, (c) =>
  new TwoPhaseDecisionOrchestrator({
    moodUpdatePipeline: c.resolve(tokens.MoodUpdatePromptPipeline),
    moodResponseProcessor: c.resolve(tokens.MoodResponseProcessor),
    moodPersistenceService: c.resolve(tokens.IMoodPersistenceService),
    aiPromptPipeline: c.resolve(tokens.IAIPromptPipeline),
    llmAdapter: c.resolve(tokens.ILLMAdapter),
    llmResponseProcessor: c.resolve(tokens.ILLMResponseProcessor),
    logger: c.resolve(tokens.ILogger),
  })
);
```

## Acceptance Criteria

### Tests that must pass

#### `TwoPhaseDecisionOrchestrator.test.js`

**Constructor validation tests:**
1. Throws if `moodUpdatePipeline` is missing
2. Throws if `moodResponseProcessor` is missing
3. Throws if `moodPersistenceService` is missing
4. Throws if `aiPromptPipeline` is missing
5. Throws if `llmAdapter` is missing
6. Throws if `llmResponseProcessor` is missing
7. Throws if `logger` is missing

**Phase 1 tests:**
8. Calls `moodUpdatePipeline.generateMoodUpdatePrompt()` with actor and context
9. Calls `llmAdapter.getAIDecision()` with mood prompt
10. Calls `moodResponseProcessor.processMoodResponse()` with raw response
11. Calls `moodPersistenceService.persistMoodUpdate()` with parsed values
12. Phase 1 failure throws error (no Phase 2 execution)

**Phase 2 tests:**
13. `moodPersistenceService.persistMoodUpdate()` called BEFORE `aiPromptPipeline.generatePrompt()`
14. Calls `aiPromptPipeline.generatePrompt()` with actor, context, actions
15. Calls `llmAdapter.getAIDecision()` with action prompt
16. Calls `llmResponseProcessor.processResponse()` with raw response
17. Phase 2 failure throws error (but Phase 1 already persisted)

**AbortSignal tests:**
18. Passes `abortSignal` to Phase 1 LLM call
19. Passes `abortSignal` to Phase 2 LLM call

**Return value tests:**
20. Returns object with `index` from `actionResult.action.chosenIndex`
21. Returns object with `speech` from `actionResult.action.speech`
22. Returns object with `thoughts` from action result
23. Returns object with `notes` from action result (may be null)
24. Returns object with `moodUpdate` from Phase 1
25. Returns object with `sexualUpdate` from Phase 1
26. Return shape is backward-compatible with `LLMChooser.choose()` consumers

### Invariants that must remain true

1. Phase 1 mood is persisted **BEFORE** Phase 2 prompt is generated
2. If Phase 1 fails, the entire turn fails (no fallback to single-prompt)
3. Return type matches `LLMChooser.choose()` return type exactly
4. DI token: `TwoPhaseDecisionOrchestrator`
5. AbortSignal passed to both LLM calls
6. No direct event dispatching (persistence service handles that)

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/turns/orchestrators/TwoPhaseDecisionOrchestrator.test.js

# Type check
npm run typecheck

# Lint
npx eslint src/turns/orchestrators/TwoPhaseDecisionOrchestrator.js
```

## Estimated Scope

- ~120 lines for `TwoPhaseDecisionOrchestrator.js`
- ~5 lines DI token addition
- ~15 lines DI registration
- ~300 lines for comprehensive tests
- Medium-sized, focused diff

## Outcome

- Created `TwoPhaseDecisionOrchestrator` with two-phase orchestration and return shape aligned to `LLMChooser` (index/speech sourced from `actionResult.action`).
- Wired DI token/registration for the orchestrator without touching `LLMChooser` or listeners (kept out-of-scope items untouched).
- Added unit coverage for constructor validation, phase ordering, abort signal forwarding, and failure behaviors.
