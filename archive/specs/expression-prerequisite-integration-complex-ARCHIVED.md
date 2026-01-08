## Goal
Define integration test suites that prove complex expression prerequisites trigger correctly when evaluated with real mood/sexual state calculations and core lookup data.

## Scope
- Target complex expressions in `data/mods/emotions/expressions/` that use nested JSON logic, previous state deltas, and/or sexual state composites.
- Use real `EmotionCalculatorService` with `core:emotion_prototypes` and `core:sexual_prototypes` lookups loaded into the data registry.
- Build contexts via `ExpressionContextBuilder` so prerequisites run against the same context shape used by the simulator.
- Do not stub emotion/sexual outputs; compute them from raw mood/sexual state values.

## Test Harness and Data Setup
- Base test bed: `IntegrationTestBed`.
- Override `tokens.IEmotionCalculatorService` with a real `EmotionCalculatorService` instance (constructed with the test bed logger + data registry).
- Load lookup JSONs into the data registry before creating the expression registry:
  - `data/mods/core/lookups/emotion_prototypes.lookup.json` -> `lookups` entry `core:emotion_prototypes`
  - `data/mods/core/lookups/sexual_prototypes.lookup.json` -> `lookups` entry `core:sexual_prototypes`
- Load only the specific target expression JSON for each test (avoid collisions where other expressions match first). Store each under `expressions`.
- Use a minimal entity manager stub (same shape as existing expression integration tests).
- For tests needing previous state, build a previous context with `ExpressionContextBuilder.buildContext(...)` and pass `{ emotions, sexualStates, moodAxes }` from that previous context into the current context as `previousState`.

## Proposed Integration Suites

### Suite A: Emotion + previous-state deltas (no sexual states)
File suggestion: `tests/integration/expressions/expressionPrerequisites.complex.integration.test.js`

Each test should:
- Build previous/current contexts.
- Assert the computed values used by prerequisites (e.g., `context.emotions.disgust`).
- Run `expressionEvaluatorService.evaluateAll(context)` and assert the target expression id is present.

#### A1. emotions-positive-affect:awed_transfixion
Expression: `data/mods/emotions/expressions/awed_transfixion.expression.json`
Prereqs: awe >= 0.65, terror <= 0.35, rage <= 0.35, (surprise_startle >= 0.25 OR awe delta >= 0.12), and euphoria relationship.

Current mood (raw axes):
- valence: 60
- arousal: 90
- engagement: 90
- agency_control: -60
- threat: 10
- future_expectancy: 20
- self_evaluation: 0

Previous mood (raw axes):
- valence: 40
- arousal: 60
- engagement: 50
- agency_control: -30
- threat: 10
- future_expectancy: 10
- self_evaluation: 0

Expected checks:
- `context.emotions.awe >= 0.65`
- `context.emotions.terror` undefined or < 0.35
- `context.emotions.rage` undefined or < 0.35
- `context.emotions.surprise_startle >= 0.25` OR `context.emotions.awe - previous.awe >= 0.12`
- `context.emotions.euphoria` may be >= 0.65, but `awe >= euphoria + 0.05` should hold.

#### A2. emotions:horror_revulsion
Expression: `data/mods/emotions/expressions/horror_revulsion.expression.json`
Prereqs: disgust >= 0.6, moodAxes.threat >= 0.25, moodAxes.valence <= -0.2, max(fear, alarm) >= 0.35, terror < 0.55, plus spike in disgust/threat/fear.

Current mood (raw axes):
- valence: -80
- arousal: 60
- threat: 50
- engagement: -20
- agency_control: -30
- future_expectancy: -10
- self_evaluation: -10

Previous mood (raw axes):
- valence: -60
- arousal: 40
- threat: 20
- engagement: -10
- agency_control: -10
- future_expectancy: -5
- self_evaluation: -5

Expected checks:
- `context.emotions.disgust >= 0.6`
- `context.emotions.fear >= 0.35` OR `context.emotions.alarm >= 0.35`
- `context.emotions.terror < 0.55`
- `context.moodAxes.threat >= 0.25`
- `context.moodAxes.valence <= -0.2`
- `max(disgust delta, threat delta, fear delta) >= 0.12`

#### A3. emotions:steeled_courage
Expression: `data/mods/emotions/expressions/steeled_courage.expression.json`
Prereqs: courage >= 0.60, fear >= 0.45, determination >= 0.40, terror < 0.60, and a rise in courage or determination.

Current mood (raw axes):
- valence: -80
- arousal: 90
- threat: 90
- agency_control: 50
- future_expectancy: 20
- engagement: 20
- self_evaluation: 0

Previous mood (raw axes):
- valence: -80
- arousal: 70
- threat: 80
- agency_control: 30
- future_expectancy: 10
- engagement: 10
- self_evaluation: 0

Expected checks:
- `context.emotions.courage >= 0.60`
- `context.emotions.fear >= 0.45`
- `context.emotions.determination >= 0.40`
- `context.emotions.terror < 0.60`
- `max(courage delta, determination delta) >= 0.10`

#### A4. emotions-positive-affect:sigh_of_relief
Expression: `data/mods/emotions/expressions/sigh_of_relief.expression.json`
Prereqs: relief >= 0.55, previous fear >= 0.25, current fear <= 0.20, relief delta >= 0.15, fear delta <= -0.20.

Current mood (raw axes):
- valence: 80
- arousal: -10
- threat: -80
- agency_control: 0
- engagement: 0
- future_expectancy: 20
- self_evaluation: 10

Previous mood (raw axes):
- valence: -40
- arousal: 40
- threat: 50
- agency_control: -20
- engagement: 10
- future_expectancy: -10
- self_evaluation: -10

Expected checks:
- `context.emotions.relief >= 0.55`
- `previous.emotions.fear >= 0.25`
- `context.emotions.fear` undefined or <= 0.20
- `context.emotions.relief - previous.relief >= 0.15`
- `context.emotions.fear - previous.fear <= -0.20`

#### A5. emotions:dissociation
Expression: `data/mods/emotions/expressions/dissociation.expression.json`
Prereqs: numbness >= 0.60, numbness delta >= 0.20, interest delta <= -0.20.

Current mood (raw axes):
- valence: -40
- arousal: -100
- engagement: -60
- agency_control: -20
- future_expectancy: -40
- threat: 0
- self_evaluation: 0

Previous mood (raw axes):
- valence: 0
- arousal: -10
- engagement: 40
- agency_control: 0
- future_expectancy: 0
- threat: 0
- self_evaluation: 0

Expected checks:
- `context.emotions.numbness >= 0.60`
- `context.emotions.numbness - previous.numbness >= 0.20`
- `context.emotions.interest - previous.interest <= -0.20`

### Suite B: Sexual state composites + emotions
File suggestion: same file (separate describe block).

#### B1. emotions:aroused_but_ashamed_conflict
Expression: `data/mods/emotions/expressions/aroused_but_ashamed_conflict.expression.json`
Prereqs: sexualStates.aroused_with_shame >= 0.65, sexualStates.sexual_lust >= 0.45, emotions.shame >= 0.45.

Current mood (raw axes):
- valence: -10
- arousal: 100
- agency_control: -100
- threat: 30
- engagement: 90
- self_evaluation: -40
- future_expectancy: 0

Sexual state (raw):
- sex_excitation: 100
- sex_inhibition: 0
- baseline_libido: 0

Expected checks:
- `context.sexualArousal === 1.0`
- `context.sexualStates.aroused_with_shame >= 0.65`
- `context.sexualStates.sexual_lust >= 0.45`
- `context.emotions.shame >= 0.45`

## Assertions and Notes
- Use `context.emotions.* ?? 0` and `context.sexualStates.* ?? 0` for safety when a prototype is gated off.
- Ensure each test verifies the prerequisites themselves (numeric checks) plus the final evaluator match.
- Prefer `expressionEvaluatorService.evaluateAll(context)` and assert the target expression id is present; avoid relying on priority order.
- Keep values in raw component units (mood axes in [-100..100], sexual state in [0..100]) because `EmotionCalculatorService` expects raw component values.

## Out of Scope
- No new expression definitions.
- No changes to expression evaluation logic.
- No UI simulator changes.
