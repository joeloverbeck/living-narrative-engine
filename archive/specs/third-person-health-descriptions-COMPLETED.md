# Third-Person Health Descriptions for Generated Character Text

## Background

- The Physical Condition widget in `game.html` (`src/domUI/injuryStatusPanel.js`) renders first-person injury text via `InjuryAggregationService.aggregateInjuries` and `InjuryNarrativeFormatterService.formatFirstPerson`. The same narrative is injected into the actor persona prompt (`src/prompting/characterDataXmlBuilder.js`) through `healthState.firstPersonNarrative` built in `src/turns/services/actorDataExtractor.js`.
- Generated character descriptions (used by the Location panel tooltip and the world-context prompt) come from `BodyDescriptionComposer.composeDescription`, which stitches descriptors, `Wearing:` from `EquipmentDescriptionService`, and `Inventory:` from conspicuous items. These descriptions are stored on `core:description` and are consumed by the location renderer (`src/domUI/location/renderCharacterListItem.js`) and by the LLM world context formatter (`src/prompting/AIPromptContentProvider.js`, which parses newline/semicolon-delimited "Key: Value" pairs into bullets).

## Goal

Add a reusable third-person medical report that mirrors the first-person Physical Condition narrative but exposes only visually obvious injuries. Surface it in a new `Health:` line inside generated descriptions (between `Wearing:` and `Inventory:`) so it appears both in `game.html` location character tooltips and in the prompt previewed via the "Prompt to LLM" button.

## Requirements

- **Reuse pipeline**: Continue using `InjuryAggregationService` for injury data and extend `InjuryNarrativeFormatterService` with a third-person formatter so logic stays in one place and remains consistent with the first-person report.
- **Visibility rules**:
  - Include only injuries that are externally visible to observers (missing/dismembered parts, destroyed or damaged externals, fractures, bleeding/burning/poisoning on visible parts).
  - Exclude any body part that has an `anatomy:vital_organ` component (no heart/lung/brain details) and omit pain/subjective language.
  - For statues/non-living actors, still expose visually evident bleeding and fractures.
- **Output placement**: Always emit a `Health:` line in the body description. If no injuries are visible, emit `Health: Perfect health.`. Otherwise, emit sentences joined in a single line, e.g. `Health: Left arm and left ear are missing. Head is destroyed. Torso is badly damaged. Right arm is fractured. Blood pours freely from nose, mouth, and vagina.`
- **Style**: Stay close to the ordering/phrasing of the first-person formatter (dismemberment → destroyed → other states → effects), but in third-person voice and stripped of pain references.
- **Consumption**: The new line must flow through `core:description` so both the location tooltip and the world-context prompt (which splits on newlines/semicolons) render a `Health` bullet. The main actor’s first-person Physical Condition prompt remains unchanged.

## Implementation Sketch

1. **Expose visibility metadata**: Update `InjuryAggregationService` to mark each part with an `isVitalOrgan` (or similar) flag derived from the existing `anatomy:vital_organ` lookup, so formatters can filter without re-querying components.
2. **Third-person formatter**: Add a method such as `formatThirdPersonVisible(summary, options)` to `InjuryNarrativeFormatterService` that:
   - Filters out `isVitalOrgan` parts.
   - Reuses existing list/part-name helpers to produce third-person sentences for dismembered, destroyed, degraded states, fractures, and bleeding (use the existing third-person effect maps and severity wording for bleeding where available).
   - Avoids pain terms; focus on observable damage and effects (blood pouring, fractured, missing, destroyed, badly damaged, etc.).
3. **Description injection**: In `BodyDescriptionComposer.composeDescription`, after the `Wearing:` block and before `Inventory:`, call the aggregation + new formatter for the body entity and insert the resulting `Health:` line (use `Perfect health.` when no visible injuries). Ensure this passes through `DescriptionConfiguration` ordering cleanly and does not suppress existing lines.
4. **Prompt/UI flow**: Because descriptions are already stored on `core:description` and consumed by both the location renderer and `AIPromptContentProvider`, no extra wiring should be needed beyond ensuring the new `Health:` line is present and well-formatted for `_parseCharacterDescription` (newline- or semicolon-delimited key/value).

## Test Plan

- **Formatter unit tests** (`src/anatomy/services/injuryNarrativeFormatterService.js`):
  - Healthy actor → `Health: Perfect health.`
  - Dismemberment grouping (singular/plural) and destroyed states emit third-person sentences without pain language.
  - Bleeding severity reflected in third-person phrasing; fractures called out; poisoning/burning only when on non-vital, visible parts.
  - Vital organ parts (e.g., heart, lung, brain) are excluded even when destroyed/bleeding; verify mixed cases only list non-vital parts.
  - Statue/non-living actor with fractures/bleeding still reports those effects.
- **Composition integration tests** (`src/anatomy/bodyDescriptionComposer.js`):
  - Description includes the new `Health:` line between `Wearing:` and `Inventory:` for (a) no injuries, (b) visible injuries, (c) only vital-organ injuries (should fall back to `Perfect health.`).
  - Ensure existing equipment/inventory text remains unchanged.
- **Prompt/world-context tests** (`src/prompting/AIPromptContentProvider.js`):
  - World context rendering of other characters shows a `Health` bullet parsed from the description and matches the third-person formatter output.
  - Existing Physical Condition prompt (`characterDataXmlBuilder` first-person injuries) remains unaffected.
- **DOM/UI regression test** (`src/domUI/location/renderCharacterListItem.js` or DOM snapshot): tooltips/rendered character cards display the `Health:` line with newlines preserved.
