# LLM Action Decision Guardrails

## Context
- Scenario: In `game.html`, four LLM-driven actors cascaded into bad moves (locked-door attempt → detour to wrong location, another actor tried to approach someone who already left and latched onto a different target, subsequent actors moved based on the wrong premises). Once the first wrong move executed, locations and narrative state became scrambled.
- Current AI turn flow: `GenericTurnStrategy.decideAction` (`src/turns/strategies/genericTurnStrategy.js`) builds indexed actions, delegates to the decision provider (LLM path = `LLMDecisionProvider` → `LLMChooser` → `LLMResponseProcessor`), then immediately returns a turn action. `ActionDecisionWorkflow` (`src/turns/states/workflows/actionDecisionWorkflow.js`) records it and calls `requestProcessingCommandStateTransition`, which `ProcessingWorkflow` (`src/turns/states/workflows/processingWorkflow.js`) executes without UI confirmation. Index validation (`src/turns/providers/abstractDecisionProvider.js` + `src/utils/actionIndexUtils.js`) only checks bounds.
- Human turns already route through `PromptCoordinator` (`src/turns/prompting/promptCoordinator.js`), `EventBusPromptAdapter` (`src/turns/adapters/eventBusPromptAdapter.js`), and `ActionButtonsRenderer` (`src/domUI/actionButtonsRenderer.js`) via `PLAYER_TURN_PROMPT_ID`/`PLAYER_TURN_SUBMITTED_ID`.

## Pain Points
- LLM only returns `chosenIndex` + optional speech/thoughts/notes (schema: `src/turns/schemas/llmOutputSchemas.js`), so intent/target is implicit and unverifiable.
- Engine executes immediately; there is no post-choice sanity check beyond index validity.
- When the desired action is unavailable (e.g., door locked, target gone), the LLM guesses among remaining actions, even if they contradict its own intent.

## Options to Mitigate Wrong LLM Choices

1) **Human-in-the-loop gating (LLM suggests, human confirms or overrides)**
- Flow: keep the LLM turn up to the decision point, but instead of transitioning to `ProcessingCommandState`, emit a new “LLM suggested action” event (distinct UI chrome: not speech/thought/failure/success). Payload: actorId, suggestedIndex, suggestedCommandString/description, speech/thoughts/notes. Immediately trigger the same `PLAYER_TURN_PROMPT_ID` dispatch used for humans so `ActionButtonsRenderer` renders available actions; preselect the suggested index for fast accept. Only proceed to processing after a `PLAYER_TURN_SUBMITTED_ID` for that actor. We would need to render the LLM's speech/thoughts before emitting the 'LLM suggested event' (which would display the LLM's chosen action in the UI); the reason for this is that we need to know, as the human, what the LLM has thought and said to determine if the chosen action is correct. Of course, speech, thought and notes need to be processed mechanically through the app normally (resulting in modifications in perception logs, for example).
- Hooks: intercept right after `LLMDecisionProvider.decide` or inside `ActionDecisionWorkflow` before `requestProcessingCommandStateTransition`; add a “pending approval” flag on the turn context so other actors don’t tick until resolved; UI changes isolated to a new renderer or a new state in `ActionButtonsRenderer` to show the suggested callout.
- Pros: immediate safety net for bad picks; lets players inject flavor text before execution; minimal behavior change for human turns; reversible if humans always click “accept”. We don't support simultaneous AI actors, so the stop between turns isn't a problem.
- Cons/Risks: slows down fully autonomous runs; requires a timeout/fallback if the player ignores the prompt.

2) **Intent-first, engine-resolves action (deterministic mapping)**
- Flow: change the LLM contract to output `{goal/intent, targetIds?, preferredActionId?, reasons}`; engine maps that intent to an action composite using deterministic logic (`AvailableActionsProvider` + `ActionIndexingService`) and picks the best match (exact target match first, otherwise wait/idle). Execution remains automatic; speech/thoughts still come from the LLM.
- Hooks: extend `LLM_TURN_ACTION_RESPONSE_SCHEMA` and `LLMResponseProcessor`; add a mapper in `GenericTurnStrategy` that translates intent→action index (reuse GOAP-like target matching from `GoapDecisionProvider.#resolveActionHint`).
- Pros: removes guesswork; makes “can’t enter locked door” resolve to `wait` or “inspect door” rather than “walk elsewhere”. Keeps autoplay intact.
- Cons/Risks: schema change + prompt update; requires robust intent→action heuristics; still possible to mis-map if intent ambiguous or targets unknown; has no easy solution for cases for when the LLM choses the wrong type of action because the one intended has been rendered unavailable.

3) **Automatic secondary validation/rescoring before execution**
- Flow: after LLM chooses an index, run a validator that compares the chosen composite against lightweight signals: proximity to referenced targets, availability of preconditions (locked/occupied), whether the target actor/entity still exists in scope. If validation fails, either (a) re-prompt the LLM with a short “your pick was invalid, try again with these remaining actions”, (b) fall back to `wait`, or (c) surface a “LLM pick rejected” prompt to the human.
- Hooks: plug into `ActionDecisionWorkflow` between `_recordDecision` and `_emitActionDecided`, or wrap `GenericTurnStrategy.decideAction` to re-enter `decisionProvider.decide` with filtered actions. Reuse existing `safeDispatchError` to log context.
- Pros: automated, keeps autoplay; catches the exact failure mode (locked door / gone target) without UX changes; cheap to ship as a guardrail.
- Cons/Risks: needs reliable affordances to detect invalid picks (may need action metadata to expose preconditions); repeated LLM calls can be slow; failure fallback must avoid loops.

4) **Ask the LLM for N-best + engine selection**
- Flow: update the schema/prompt to request an ordered list of candidate indices (or actionIds) plus reasons; engine walks the list and picks the first still-valid option; optionally log the rejected ones for debugging.
- Hooks: schema + `LLMResponseProcessor` change; small change in `GenericTurnStrategy` to accept an array instead of a single `chosenIndex`.
- Pros: graceful handling when top choice is invalid; no new UI; minimal engine logic.
- Cons/Risks: prompt/token cost increases; still relies on the LLM to enumerate sensible backups; requires backward-compatible handling when only one choice is returned.

5) **State-aware prompt tightening**
- Flow: improve the single-pass prompt with more explicit constraints: “never pick actions that move you away from <target>”, “if desired location/target missing, choose wait/observe”, “only use actions that keep you near actor X”. Use structured action summaries (include target IDs/locations) in the prompt so the model has clearer affordances.
- Hooks: prompt builder (`src/prompting/promptDataFormatter.js` and any action listings feeding the prompt pipeline); no engine changes.
- Pros: fastest to ship; no UX change; may be “good enough” if mis-picks are rare.
- Cons/Risks: not a hard guarantee; depends on model compliance; still fails silently if the model drifts.

## Recommendation
- Primary: ship Option 1 to create a reliable human override path for LLM turns (distinct “LLM suggested” UI + reuse `PLAYER_TURN_PROMPT_ID`/`ActionButtonsRenderer` for execution). It directly prevents scenario breakage and enables the flavor-text injection you want.
- Secondary: add Option 3-style validation as a safety net for autoplay sessions (simple precondition checks + “retry or wait” fallback) so runs remain stable when no human is present.
- Longer term: consider Option 2 or 4 if we want fully autonomous, model-agnostic guardrails without requiring humans in the loop.
