# TWOPHAEMOSTAUPD-008: Debug Button Update (Prompt Preview)

Status: Completed

## Summary

Update the "Prompt to LLM" debug button to show both Phase 1 (mood update) and Phase 2 (action decision) prompts in a tabbed interface.

## Dependencies

- **Requires:** TWOPHAEMOSTAUPD-003 (MoodUpdatePromptPipeline)
- **Requires:** TWOPHAEMOSTAUPD-007 (Integration complete)

## Files to Touch

| File | Action |
|------|--------|
| `src/engine/gameEngine.js` | MODIFY |
| `src/domUI/PromptPreviewModal.js` | MODIFY |
| `game.html` | MODIFY |
| `css/components/_llm-prompt-debug.css` | MODIFY |
| `tests/unit/engine/gameEngine.test.js` | MODIFY |
| `tests/unit/engine/gameEngine.branchCoverage.test.js` | MODIFY (if needed for new branches) |
| `tests/unit/domUI/PromptPreviewModal.test.js` | MODIFY |
| `tests/integration/llmPromptDebug.spec.js` | MODIFY |
| `tests/integration/gameHtmlPromptPreviewModal.spec.js` | MODIFY |
| `tests/unit/ui/llmPromptDebugPanel.markup.test.js` | MODIFY |

## Out of Scope

- **DO NOT** modify game logic or turn flow
- **DO NOT** modify schemas or processors
- **DO NOT** add new LLM functionality
- **DO NOT** change orchestrator logic
- **DO NOT** modify actual prompt generation logic

## Implementation Details

### Modify: `gameEngine.js`

Find and modify `previewLlmPromptForCurrentActor()` method:

```javascript
async previewLlmPromptForCurrentActor() {
  const handler = this.#turnManager?.getActiveTurnHandler?.();
  const context = handler?.getTurnContext?.() ?? null;
  const actor = this.#turnManager?.getCurrentActor?.() ?? null;

  // Generate BOTH prompts
  const moodPrompt = await this.#moodUpdatePromptPipeline.generateMoodUpdatePrompt(actor, context);
  const actionPrompt = await this.#aiPromptPipeline.generatePrompt(actor, context, availableActions);

  // Dispatch event with both prompts (payload passed directly to SafeEventDispatcher)
  await this.#safeEventDispatcher.dispatch(
    UI_SHOW_LLM_PROMPT_PREVIEW,
    {
      moodPrompt,      // NEW - Phase 1 prompt
      actionPrompt,    // NEW - Phase 2 prompt
      prompt: actionPrompt, // Legacy field for existing listeners
      actorId: actor.id,
      actorName,
      llmId,
      actionCount,
      timestamp,
      errors,
    },
    { allowSchemaNotFound: true }
  );
}
```

**Additional changes to gameEngine.js:**
1. Add `moodUpdatePromptPipeline` to constructor dependencies (resolve `tokens.MoodUpdatePromptPipeline`)
2. Validate the new dependency
3. Store reference in private field

### Modify: UI Modal Component

Location is `src/domUI/PromptPreviewModal.js`.

**UI Requirements:**

1. **Tabbed Interface** (required):
   ```
   ┌─────────────────────────────────────────────────┐
   │ [Mood Update Prompt] [Action Decision Prompt]   │
   ├─────────────────────────────────────────────────┤
   │                                                 │
   │  <prompt content for selected tab>              │
   │                                                 │
   │                                                 │
   └─────────────────────────────────────────────────┘
   ```

2. **Tabbed Interface** is the only supported layout for this ticket.

**Implementation approach (conceptual):**

```javascript
// Handle new payload shape
handleShowPromptPreview(event) {
  const { moodPrompt, actionPrompt, prompt, actorId, actorName } = event.payload;

  // Create tabbed content
  this.#renderTabs([
    { label: 'Mood Update Prompt', content: moodPrompt },
    { label: 'Action Decision Prompt', content: actionPrompt },
  ]);

  // Show modal
  this.#modal.show();
}
```

**Backward Compatibility:**
If the payload has old shape (single `prompt` field), handle gracefully:

```javascript
handleShowPromptPreview(event) {
  const { moodPrompt, actionPrompt, prompt, actorId } = event.payload;

  if (prompt && !moodPrompt) {
    // Legacy single-prompt mode
    this.#renderSinglePrompt(prompt); // action prompt only
  } else {
    // New two-phase mode
    this.#renderTabs([...]);
  }
}
```

### Event Payload Change

**Old payload:**
```javascript
{
  type: 'UI_SHOW_LLM_PROMPT_PREVIEW',
  payload: {
    prompt: string,
    actorId: string,
  }
}
```

**New payload:**
```javascript
{
  type: 'UI_SHOW_LLM_PROMPT_PREVIEW',
  payload: {
    moodPrompt: string,    // NEW
    actionPrompt: string,  // Phase 2 prompt
    prompt: string,        // Legacy field for existing listeners (action prompt)
    actorId: string,
    actorName: string,     // Optional, for display
    llmId: string | null,
    actionCount: number,
    timestamp: string,
    errors: string[],
  }
}
```

## Acceptance Criteria

### Tests that must pass

#### `tests/unit/engine/gameEngine.test.js`

1. `previewLlmPromptForCurrentActor()` calls `moodUpdatePipeline.generateMoodUpdatePrompt()`
2. `previewLlmPromptForCurrentActor()` calls `aiPromptPipeline.generatePrompt()`
3. Dispatches `UI_SHOW_LLM_PROMPT_PREVIEW` event
4. Payload includes `moodPrompt` key with string value
5. Payload includes `actionPrompt` key with string value
6. Payload includes `prompt` key with string value (legacy)
7. Payload includes `actorId` key

#### Manual UI Testing

7. Click "Prompt to LLM" button with LLM-controlled actor selected
8. Modal displays with two tabs
9. "Mood Update Prompt" tab shows Phase 1 prompt content
10. "Action Decision Prompt" tab shows Phase 2 prompt content
11. Both tabs are independently scrollable
12. Clear labels identify each phase
13. Modal closes correctly
14. No JavaScript errors in console

### Invariants that must remain true

1. Preview is read-only (does not execute LLM calls)
2. Works for current actor only
3. Both prompts generated fresh each time (not cached)
4. UI handles missing prompts gracefully (shows placeholder or error message)
5. Backward compatible with any code that listens to `UI_SHOW_LLM_PROMPT_PREVIEW` by keeping `prompt` populated

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/engine/gameEngine.test.js tests/unit/domUI/PromptPreviewModal.test.js tests/unit/ui/llmPromptDebugPanel.markup.test.js

# Run integration tests
npm run test:integration -- tests/integration/llmPromptDebug.spec.js tests/integration/gameHtmlPromptPreviewModal.spec.js

# Lint
npx eslint src/engine/gameEngine.js

# Manual testing
npm run dev
# Then click "Prompt to LLM" button in game UI
```

## Estimated Scope

- ~40-60 lines modifications to `gameEngine.js`
- ~120-180 lines modifications to modal/markup/CSS for tabs
- Test updates across unit + integration
- Small to medium diff
- Requires manual UI testing

## Outcome

- Implemented tabbed prompt preview with separate mood/action panels and legacy `prompt` payload preserved.
- Updated engine preview payload to include `moodPrompt`/`actionPrompt` plus existing metadata and error handling.
- Adjusted HTML/CSS and unit/integration tests to match the new tabbed UI and payload shape.
