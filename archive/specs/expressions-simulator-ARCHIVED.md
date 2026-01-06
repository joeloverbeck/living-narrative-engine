# Expressions Simulator

## Overview
Add a new "Emotions" section to `index.html` that links to an Expressions Simulator page. The simulator lets a user input `core:mood` and `core:sexual_state` component values, previews the derived emotion/sexual-state text, and evaluates expressions (loaded from `data/mods/*/expressions/`) against those values. It also shows the total expression count and the perceptible event messages for both the acting actor and a non-actor observer.

## Goals
- Provide a dedicated Expressions Simulator page reachable from the main menu.
- Generate UI inputs based on `data/mods/core/components/mood.component.json` and `data/mods/core/components/sexual_state.component.json`.
- Update the formatted "Current: ..." emotion and sexual-state text on input changes, matching the display style in `src/domUI/emotionalStatePanel.js` and `src/domUI/sexualStatePanel.js`.
- Use the existing expression registry/evaluator/dispatcher services to:
  - Show total loaded expressions.
  - List all matching expressions in descending priority.
  - Identify the selected expression (first in the list).
  - Produce the actor/observer perceptible event messages using existing logic.
- Include comprehensive tests for the new page/controller.

## Non-Goals
- No changes to expression data files or lookups.
- No changes to the runtime game UI (other than adding the menu entry).
- No changes to the expression evaluation logic itself.

## UI/UX Requirements
- New section in `index.html`:
  - Title: "Emotions"
  - Description: short copy describing expressions/mood tooling
  - Button: "Expressions Simulator" linking to `expressions-simulator.html`
- New page `expressions-simulator.html`:
  - Back-to-menu link
  - Two input panels:
    - Mood axes (7 inputs)
    - Sexual state values (3 inputs)
  - Derived text display:
    - Emotion text output: "Current: ..." (same wording as `EmotionalStatePanel`)
    - Sexual state text output: "Current: ..." (same wording as `SexualStatePanel`)
  - Expression results panel:
    - Total expression count in registry
    - "Trigger Expression" button
    - Matching expressions list (descending priority)
    - Selected expression (first match)
    - Actor message + observer message blocks

## Data Sources and Services
- Component definitions:
  - `core:mood` and `core:sexual_state` definitions from the data registry.
  - Use `dataRegistry.get('components', 'core:mood')` and `dataRegistry.get('components', 'core:sexual_state')` to read `dataSchema.properties` for min/max/default/description.
- Emotion/sexual state calculations:
  - Use `EmotionCalculatorService`:
    - Emotions display: `calculateEmotions(moodData, null)` to mirror `EmotionalStatePanel`.
    - Sexual states display: `calculateSexualArousal(sexualStateData)` then `calculateSexualStates(moodData, arousal)`, formatted with `formatSexualStatesForPrompt`.
- Expressions:
  - Use `ExpressionRegistry` to count total expressions (`getAllExpressions().length`).
  - Use `ExpressionContextBuilder.buildContext(...)` and `ExpressionEvaluatorService.evaluateAll(...)` to find matches (sorted by priority).
  - Use `ExpressionEvaluatorService.evaluate(...)` or `matches[0]` for the selected expression.
- Perceptible event messages:
  - Use `ExpressionDispatcher.dispatch(...)` to create a `core:perceptible_event` payload (capture it locally).
  - Use `PerceptionEntryBuilder.buildForRecipient(...)` to generate:
    - Actor message (recipient == actorId)
    - Observer message (recipient == observerId)
  - If sense filtering is not wired, pass `filteredRecipientsMap = null` to use base descriptions.

## Simulator State Model
- `currentMood`: object with 7 mood axes (integers, -100..100).
- `currentSexualState`: object with `sex_excitation`, `sex_inhibition`, `baseline_libido`.
- `previousState`: stored when "Trigger Expression" is pressed; pass into `ExpressionContextBuilder` to support `previousEmotions` and `previousSexualStates` prerequisites.
  - First trigger uses `previousState = null`.
  - After triggering, persist `{ emotions, sexualStates, moodAxes }` from the built context for the next run.

## Bootstrap and Wiring
- New entry file: `src/expressions-simulator.js`.
  - Use `CommonBootstrapper` with `containerConfigType: 'minimal'` and mod loading enabled.
  - In `postInitHook`:
    - Call `registerExpressionServices(container)`.
    - Resolve needed services: `IDataRegistry`, `IEntityManager`, `IEmotionCalculatorService`, `IExpressionRegistry`, `IExpressionContextBuilder`, `IExpressionEvaluatorService`, `IExpressionDispatcher`.
    - Initialize a new `ExpressionsSimulatorController` (see below).
- Create `src/domUI/expressions-simulator/ExpressionsSimulatorController.js` to handle:
  - DOM binding and rendering
  - Input change handling
  - Expression evaluation + output rendering
  - Event message generation

## Dummy Actor/Observer Setup
Expression dispatch requires a valid actor name and location via `IEntityManager`. Use a simulator-owned actor and observer:
- Create or reuse an entity definition:
  - Preferred: create a runtime-only entity definition stored in the data registry (mirroring the structure of `*.character.json` definitions).
  - Must include: `core:name`, `core:actor`, `core:perception_log`.
- Create two entities with `EntityManager.createEntityInstance`:
  - Actor (e.g., `core:expression_sim_actor`)
  - Observer (e.g., `core:expression_sim_observer`)
- Add components to both:
  - `core:position` with a shared `locationId` string (e.g., `sim:expression_lab`).
  - Actor: `core:mood` + `core:sexual_state` from current inputs.
- On every input change, update the actor's component data (or maintain local state and supply it directly to `ExpressionContextBuilder`).

## Expression Evaluation Flow
1. Read current mood/sexual input values into objects.
2. Build context: `ExpressionContextBuilder.buildContext(actorId, mood, sexualState, previousState)`.
3. Evaluate matches: `ExpressionEvaluatorService.evaluateAll(context)`.
4. Render:
   - Total expressions count from registry.
   - Matching expressions list (id + priority + optional tags).
   - Selected expression (first match or "none").
5. If a match exists:
   - Call `ExpressionDispatcher.dispatch(actorId, selectedExpression, simulatedTurnNumber)`.
   - Capture the dispatched payload from the event bus (local listener or stub).
   - Build messages with `PerceptionEntryBuilder`:
     - `actorMessage = buildForRecipient({ recipientId: actorId, ... })`
     - `observerMessage = buildForRecipient({ recipientId: observerId, ... })`
6. If no match, show empty-state text and clear prior messages.

## HTML/CSS Notes
- New page should mirror other tool pages (e.g., `damage-simulator.html`) using `css/style.css` plus a new `css/expressions-simulator.css`.
- Keep forms accessible: labels, `aria-live` on outputs, and keyboard-friendly controls.
- Use input type `range` with a readout and paired `number` input for precise entry.

## Tests
Add comprehensive tests (Jest, runInBand for subsets) to cover:

### Unit Tests
- `ExpressionsSimulatorController`:
  - Renders inputs from component schemas correctly (min/max/default).
  - Updates emotion and sexual-state text when inputs change.
  - "Trigger Expression" calls evaluator and renders matches in priority order.
  - Previous-state caching affects delta-based expressions.
  - Actor/observer message rendering uses expression dispatcher output.

### Integration Tests
- Simulator bootstrap:
  - Mods load and expressions are present in registry.
  - `ExpressionEvaluatorService.evaluateAll` returns expected matches for known inputs.
  - Expression dispatch produces the expected perceptible event payload.

### E2E/DOM Tests (if feasible in existing setup)
- Load `expressions-simulator.html` with JSDOM or existing test harness:
  - Change slider values and assert text updates.
  - Trigger expression and assert list, selected expression, and messages render.

Reference existing tests for patterns:
- `tests/integration/expressions/expressionFlow.integration.test.js`
- `tests/integration/expressions/expressionEvaluatorService.integration.test.js`
- `tests/unit/expressions/expressionDispatcher.test.js`

## Open Questions / Decisions
- Confirm whether expressions should be re-evaluated live on input change or only on "Trigger Expression".
- Decide if a static runtime-only entity definition is acceptable, or if a dedicated simulator entity should be added to a mod (core or emotions).
