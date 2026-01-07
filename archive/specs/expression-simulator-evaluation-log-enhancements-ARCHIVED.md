# Expression simulator evaluation log enhancements

## Goal
Enhance the Evaluation Log panel in `expressions-simulator.html` to show how many expressions were evaluated, and ensure evaluation entries are ordered by descending expression priority with the priority value clearly displayed for each entry.

## Scope
- UI/UX updates for the Evaluation Log header and entry layout.
- Rendering logic updates in `src/domUI/expressions-simulator/ExpressionsSimulatorController.js`.
- Styling updates in `css/expressions-simulator.css`.
- Tests covering evaluation count, priority display, and ordering.

## UX requirements
1. **Evaluation count**
   - Display a count of evaluated expressions on the same line as the "Evaluation Log" header, aligned to the right of the panel.
   - Format: `Evaluated: <count>` (keep capitalization consistent with other labels).
   - Default state before any evaluation: show `Evaluated: --`.
   - After evaluation: show the number of evaluated expressions (based on the `evaluations` array length).
   - If the evaluation log is cleared/reset between runs, revert to `Evaluated: --` until results are available.

2. **Priority indicator on each entry**
   - Each evaluation entry should display its expression priority to the left of the entry content.
   - Use a compact badge style (pill, circle, or rounded rectangle). Recommended label: `P<priority>` (e.g., `P10`).
   - If the expression has no valid numeric priority, use `P0` (consistent with `ExpressionRegistry` fallback).

3. **Evaluation order**
   - Entries must render in descending priority order (highest first). If priorities tie, fall back to stable ordering by expression id (ascending) to match registry behavior.
   - Ensure this ordering even if the `evaluations` array is not already sorted.

## Proposed UI structure changes
- Update the Evaluation Log header to include a count element:
  - Wrap the `h3` and count in a header container (e.g., `div.es-evaluation-panel-header`).
  - Add a count element with an id (e.g., `#es-evaluation-count`) for easy updates.
- Update each evaluation entry markup to include a priority badge element (e.g., `span.es-evaluation-priority`).

Example markup (structure only):
```
<div class="es-evaluation-panel-header">
  <h3>Evaluation Log</h3>
  <span id="es-evaluation-count" class="es-evaluation-count">Evaluated: --</span>
</div>
```

Within each log item, insert a priority badge before the header:
```
<div class="es-evaluation-item">
  <span class="es-evaluation-priority">P10</span>
  <div class="es-evaluation-content">
    <div class="es-evaluation-header">...</div>
    <div class="es-evaluation-details">...</div>
  </div>
</div>
```

## Implementation notes
- **Controller changes** (`src/domUI/expressions-simulator/ExpressionsSimulatorController.js`)
  - Bind the new `#es-evaluation-count` element in `#bindDom()` and track it in `#elements`.
  - Update `#renderEvaluationLog` to:
    - Set the count to `--` when `evaluations` is null/empty and the placeholder is shown.
    - Set the count to `evaluations.length` when evaluations exist.
    - Sort `evaluations` by priority desc (numeric), then by expression id asc before rendering.
    - Render a priority badge for each evaluation entry using the expression priority (fallback 0).
  - Keep existing placeholder and status messaging behavior intact.

- **CSS changes** (`css/expressions-simulator.css`)
  - Add styles for the new header container to align the count right (flex row with space-between).
  - Add styles for the priority badge (background, font size, border radius, inline alignment with the entry).
  - If a wrapper like `.es-evaluation-content` is introduced, ensure spacing between the badge and content is consistent with existing spacing variables.

- **HTML changes** (`expressions-simulator.html`)
  - Replace the `h3` with a header wrapper that includes the count element.

## Testing requirements
Add or update unit tests to validate the behavior. Use `tests/unit/domUI/expressionsSimulatorController.test.js` as the primary test file.

Required test cases:
1. **Evaluation count updates**
   - When `#renderEvaluationLog` receives evaluations, the count should reflect the number of entries.
   - When `#renderEvaluationLog` is called with null/empty, the count should reset to `Evaluated: --` and the placeholder should render.

2. **Priority badge rendering**
   - Each evaluation entry includes a badge with `P<priority>`.
   - Missing or non-numeric priority renders as `P0`.

3. **Priority order**
   - Given evaluations out of order, rendered entries should appear in descending priority order, using expression id as a tiebreaker.

4. **Regression coverage**
   - Update any existing DOM setup in tests to include the new `#es-evaluation-count` element and any wrapper nodes needed for the evaluation log.

## Acceptance criteria
- Evaluation Log header shows a right-aligned count that updates per evaluation run.
- Evaluation entries are ordered by priority desc, tie-breaker by expression id asc.
- Each entry shows a visible priority badge to the left.
- Unit tests cover count updates, ordering, and badge rendering.
