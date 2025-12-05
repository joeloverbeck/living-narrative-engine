# THIPERHEADES-004: World context and tooltip consumption of Health line

Current state check:
- `BodyDescriptionComposer` already injects the third-person `Health:` line between `Wearing:` and `Inventory:` with unit/integration coverage, and Physical Condition/first-person flows are already validated elsewhere.
- Gap: `AIPromptContentProvider` only parses character descriptions when they contain both `:` and `,`, so common newline-delimited `Wearing:/Health:/Inventory:` blocks without commas collapse into a single description bullet—hiding the Health line in world context output.
- Tooltips already convert newlines to `<br>`, but there is no explicit assertion that a `Health:` line survives.

Scope:
- Loosen world-context parsing to treat newline/semicolon-delimited key-value descriptions (e.g., `Wearing:\nHealth:\nInventory:`) as structured attributes even when no commas are present.
- Keep first-person/Physical Condition prompts untouched.
- Add tests that lock in Health-line visibility in world context and tooltip rendering.

File list
- src/prompting/AIPromptContentProvider.js
- src/domUI/location/renderCharacterListItem.js
- tests/unit/prompting/AIPromptContentProvider.worldContextMarkdown.test.js (add Health parsing case)
- tests/unit/domUI/location/renderCharacterListItem.test.js (assert tooltip renders Health line/newlines)

Out of scope
- Changes to body description composition or formatter logic (already present and tested).
- Any modifications to first-person Physical Condition prompts or panels.
- Styling or CSS adjustments unrelated to showing the new text.

Acceptance criteria
- Tests:
  - Unit test under `tests/unit/prompting/` proves world-context parsing yields a `Health` bullet from newline-delimited descriptions that contain no commas.
  - Unit/DOM test under `tests/unit/domUI/location/` verifies rendered character tooltips include the `Health:` line with newline preservation.
  - `npm run test:unit -- tests/unit/prompting/AIPromptContentProvider.worldContextMarkdown.test.js` and `npm run test:unit -- tests/unit/domUI/location/renderCharacterListItem.test.js` pass.
- Invariants:
  - No regression to prompt ordering or content used by the main actor’s Physical Condition prompt.
  - Location rendering preserves existing formatting and labels aside from the added `Health` entry.

## Status
Completed.

## Outcome
- Relaxed world-context parsing so newline/semicolon-delimited key/value descriptions (including `Health:`) become structured bullets even without commas.
- Added unit coverage for `Wearing/Health/Inventory` parsing and a DOM test to assert tooltip preservation of the `Health:` line.
- Left Physical Condition/first-person prompt flows untouched; existing composition/formatter logic remains as-is.
