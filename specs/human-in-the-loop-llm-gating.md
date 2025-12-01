# Human-in-the-Loop Gating for LLM Actions

## Document Information

**Version:** 0.1.0
**Status:** Design Specification
**Scope:** LLM-driven turns in `game.html` runtime
**Primary Contacts:** AI runtime team / UI runtime team

---

## Goal and Non-Goals

- **Goal:** Insert a human confirmation step for LLM turns: the LLM proposes an action; the player accepts or overrides before execution. Prevent invalid/undesired LLM moves from mutating narrative state.
- **Non-Goals:** Changing LLM prompt content, modifying human turn UX, or implementing autonomous retries (covered by other guardrail options).

---

## Affected Components

- `src/turns/strategies/genericTurnStrategy.js`: decision flow entry point.
- `src/turns/providers/llmDecisionProvider.js` + `src/turns/providers/abstractDecisionProvider.js`: LLM decision handling and index validation.
- `src/turns/states/workflows/actionDecisionWorkflow.js`: new gating step prior to processing.
- `src/turns/states/workflows/processingWorkflow.js`: must respect pending-approval guard.
- `src/turns/prompting/promptCoordinator.js` + `src/turns/adapters/eventBusPromptAdapter.js`: reuse human prompt dispatch for LLM suggestions.
- `src/domUI/actionButtonsRenderer.js` (or new renderer state): render suggested action callout and preselection.
- `src/turns/llm/llmResponseProcessor.js` + `src/turns/schemas/llmOutputSchemas.js`: ensure speech/thoughts/notes still flow before gating.
- `src/utils/actionIndexUtils.js`: may expose helper to clamp/preselect suggestion.

---

## Core Flow (LLM Turn)

1) `GenericTurnStrategy.decideAction` obtains `decisionResult` from `LLMDecisionProvider` (contains `chosenIndex`, optional speech/thoughts/notes).
2) Emit speech/thoughts/notes to perception logs as today.
3) Instead of transitioning to `ProcessingCommandState`, set a **pending approval** flag on the turn context/actor and emit a new event `llm:suggested_action` with payload: `{ actorId, suggestedIndex, suggestedActionDescriptor, speech?, thoughts?, notes? }`.
4) Dispatch `PLAYER_TURN_PROMPT_ID` via `PromptCoordinator`/`EventBusPromptAdapter` with the available actions to render `ActionButtonsRenderer`. Preselect `suggestedIndex` when it is still valid; otherwise highlight “wait/idle” fallback.
5) Wait for `PLAYER_TURN_SUBMITTED_ID` carrying the final index (accepted or overridden). Clear pending flag, record decision, and then invoke `requestProcessingCommandStateTransition` with the submitted action.
6) If a timeout/fallback is enabled (configurable), auto-accept the suggestion or choose `wait` after N seconds; log this path.
7) Prevent other actors/turns from advancing while pending approval is set.

---

## State & Data Contract

- **Pending flag:** stored on turn context or actor turn state; must block scheduling and processing workflows until cleared.
- **Suggested payload:** includes the rendered action string/description so UI can show “LLM suggests: <action>”.
- **Event names:** new `llm:suggested_action` (bus) + reuse existing `PLAYER_TURN_PROMPT_ID` / `PLAYER_TURN_SUBMITTED_ID` identifiers.
- **Fallback policy:** configurable in settings (disabled by default). Options: `autoAccept`, `autoWait`, `noop`.
- **Error handling:** if suggested index is out of bounds, clamp to available list, log warning, and still surface prompt with corrected preselection.

---

## UI/UX Notes

- Distinct chrome (badge/label) indicating “LLM suggestion” separate from speech/thought bubbles.
- Preselects suggested action button; keep keyboard/controller navigation unchanged.
- If speech/thoughts exist, render them before the suggestion callout so the human can judge correctness. Ideally we would want to see the LLM's speech or thought bubble (as normal), then render the suggestion callout.
- When overridden, UI should reflect “human chose X (LLM suggested Y)” in logs or debug pane for traceability.

---

## Telemetry & Logging

- Log every suggested action with actorId, suggestedIndex, finalIndex, override boolean, and whether fallback timeout triggered.
- Emit debug-level traces when pending flag blocks other actors.
- Capture invalid suggestion cases (index out of range) and auto-corrections.

---

## Testing Strategy

### Unit Tests

- **Decision gating:** `ActionDecisionWorkflow` (or inserted hook) halts before `ProcessingWorkflow` when provider is LLM, sets pending flag, and emits `llm:suggested_action` exactly once.
- **Preselection logic:** suggested index clamps to available actions; invalid indexes still render prompt without throwing.
- **Pending guard:** while pending flag is set, `ProcessingWorkflow` and other actor ticks are not invoked; clearing flag resumes flow.
- **Speech/thought propagation:** `LLMResponseProcessor` still forwards speech/thoughts/notes to the perception log before gating; ensure order is preserved.
- **Fallback policy:** configurable timeout path triggers correct default (autoAccept vs autoWait) and clears pending flag.
- **Event payload shape:** `llm:suggested_action` includes actorId, suggestedIndex, suggestedActionDescriptor, speech/thoughts/notes when present.

### Integration Tests (engine-level)

- **Happy path accept:** simulate LLM suggestion, emit `PLAYER_TURN_SUBMITTED_ID` with same index; verify `ProcessingWorkflow` executes once with that index and logs contain suggestion + acceptance.
- **Override path:** submit different index; confirm pending flag clears, overridden action executes, and telemetry marks override.
- **Invalid suggestion recovery:** LLM returns out-of-range index; prompt still renders with clamped selection, and execution uses submitted choice without crash.
- **UI renderer:** `ActionButtonsRenderer` shows “LLM suggestion” callout, preselects suggested button, and maintains accessibility/keyboard navigation.
- **Blocking behavior:** while an LLM turn awaits confirmation, no other actor decisions/processings occur; upon submission, next actor proceeds.
- **Timeout behavior:** with timeout enabled, absence of submission triggers fallback path and execution; ensure single execution and cleanup.

### Failure & Edge Case Tests

- **Event loss:** if `PLAYER_TURN_SUBMITTED_ID` never arrives and timeout disabled, ensure engine remains paused but logs warn; manual submission still works.
- **Cancelled turns:** if actor becomes invalid/removed while pending (which shouldn't be possible), ensure pending flag clears and no processing occurs; log cancellation.
- **Back-to-back turns:** when two LLM turns occur sequentially, ensure second suggestion waits until first is resolved and does not reuse stale state.
- **Telemetry hooks:** verify override metrics and invalid-suggestion warnings are emitted and do not leak PII.

### QA/UX Acceptance

- Visual inspection of callout styling vs existing UI; confirm clarity that action is AI-suggested.
- Input modalities (mouse/keyboard/controller if supported) still operate with preselection.
- Performance baseline: gating adds negligible overhead (< few ms) outside human wait time.

---

## Rollout Plan

- Ship behind config flag defaulting to **enabled** for LLM actors; expose toggle for autoplay/debug runs.
- Add high-verbosity logging in first release; trim after validation.
- Document how to bypass gating for automated test environments if needed (env var or setting).

