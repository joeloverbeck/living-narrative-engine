# MONCARREPGEN-005: Modal Renderer Class

**STATUS: COMPLETED**

## Summary

Create the `MonteCarloReportModal` class that extends `BaseModalRenderer` to display and manage the report modal, including the "Copy to Clipboard" functionality.

## Priority: High | Effort: Small-Medium

## Rationale

The modal renderer encapsulates all modal-specific logic:
- Showing/hiding the modal with proper focus management
- Displaying the markdown report content
- Handling clipboard copy with user feedback
- Following the established `BaseModalRenderer` pattern for consistency

## Dependencies

- None (uses existing `BaseModalRenderer` pattern)
- MONCARREPGEN-003 must be complete for the modal to find DOM elements

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/MonteCarloReportModal.js` | **Create** |

## Out of Scope

- **DO NOT** modify BaseModalRenderer - use it as-is
- **DO NOT** modify HTML structure - that's MONCARREPGEN-003
- **DO NOT** modify CSS - that's MONCARREPGEN-004
- **DO NOT** modify controller - that's MONCARREPGEN-006
- **DO NOT** create test files - that's MONCARREPGEN-008
- **DO NOT** add DI registration - that's MONCARREPGEN-002

## Implementation Details

### Class Structure

```javascript
/**
 * @file MonteCarloReportModal - Modal for displaying and copying MC analysis reports
 * @see specs/monte-carlo-report-generator.md
 */

import { BaseModalRenderer } from '../baseModalRenderer.js';
import { buildModalElementsConfig } from '../helpers/buildModalElementsConfig.js';
import { copyToClipboard } from '../helpers/clipboardUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

class MonteCarloReportModal extends BaseModalRenderer {
  #reportContent = '';

  /**
   * @param {object} deps
   * @param {import('../../interfaces/ILogger.js').ILogger} deps.logger
   * @param {import('../../interfaces/IDocumentContext.js').IDocumentContext} deps.documentContext
   * @param {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} deps.validatedEventDispatcher
   */
  constructor({ logger, documentContext, validatedEventDispatcher }) {
    const elementsConfig = buildModalElementsConfig({
      modalElement: '#mc-report-modal',
      closeButton: '#mc-report-close-btn',
      statusMessageElement: '#mc-report-status',
      contentArea: '#mc-report-content',
      copyButton: '#mc-report-copy-btn',
    });

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    this._operationInProgressAffectedElements = ['copyButton'];
    this.#bindEvents();
  }

  /**
   * Show the modal with the given markdown content.
   * @param {string} markdownContent - The markdown report to display
   */
  showReport(markdownContent) {
    this.#reportContent = markdownContent;
    this.show();
  }

  /**
   * @override
   * Lifecycle hook called when modal is shown.
   */
  _onShow() {
    // Populate content area with markdown
    if (this.elements.contentArea) {
      this.elements.contentArea.textContent = this.#reportContent;
    }
  }

  /**
   * @override
   * Lifecycle hook called when modal is hidden.
   */
  _onHide() {
    // Clear stored content
    this.#reportContent = '';

    // Clear content area
    if (this.elements.contentArea) {
      this.elements.contentArea.textContent = '';
    }
  }

  /**
   * @override
   * Return the element to focus when modal opens.
   */
  _getInitialFocusElement() {
    return this.elements.copyButton || this.elements.closeButton || null;
  }

  /**
   * Bind event listeners for copy functionality.
   * @private
   */
  #bindEvents() {
    if (this.elements.copyButton) {
      this._addDomListener(this.elements.copyButton, 'click', () => this.#handleCopy());
    }
  }

  /**
   * Handle copy button click.
   * @private
   */
  async #handleCopy() {
    if (!this.#reportContent) {
      this._displayStatusMessage('No content to copy.', 'error');
      return;
    }

    try {
      const success = await copyToClipboard(this.#reportContent);

      if (success) {
        this._displayStatusMessage('Copied to clipboard!', 'success');
      } else {
        this._displayStatusMessage('Failed to copy. Please select and copy manually.', 'error');
      }
    } catch (err) {
      this._logger.error('Clipboard copy failed:', err);
      this._displayStatusMessage('Failed to copy. Please select and copy manually.', 'error');
    }

    // Auto-clear status after 2 seconds
    setTimeout(() => this._clearStatusMessage(), 2000);
  }
}

export default MonteCarloReportModal;
```

### Key Implementation Notes

1. **Elements Config**: Uses `buildModalElementsConfig()` helper for consistent selector handling

2. **Content Storage**: `#reportContent` holds the markdown string until modal is closed

3. **Lifecycle Hooks**:
   - `_onShow()`: Populates the `<pre>` element with markdown text
   - `_onHide()`: Clears content to free memory

4. **Copy Handling**:
   - Uses existing `copyToClipboard()` from `clipboardUtils.js`
   - Shows success/error via `_displayStatusMessage()` (inherited method)
   - Auto-clears status after 2 seconds

5. **Focus Management**:
   - `_getInitialFocusElement()` returns copy button for quick access
   - Falls back to close button if copy button unavailable

6. **Event Binding**:
   - Uses `_addDomListener()` for proper cleanup on destroy
   - Only binds if element exists (defensive coding)

### Import References

```javascript
// BaseModalRenderer location
import { BaseModalRenderer } from '../baseModalRenderer.js';

// Helper utilities
import { buildModalElementsConfig } from '../helpers/buildModalElementsConfig.js';
import { copyToClipboard } from '../helpers/clipboardUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
```

## Acceptance Criteria

### Tests That Must Pass

After MONCARREPGEN-008 is complete:
```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js --verbose
```

### Invariants That Must Remain True

1. **Content isolation**: `#reportContent` is cleared on hide
2. **DOM cleanup**: Content area cleared to prevent memory leaks
3. **Event cleanup**: Uses `_addDomListener()` for auto-cleanup
4. **Null safety**: All element access checks for existence
5. **BaseModalRenderer compliance**: Properly extends and uses inherited methods
6. **No external state**: Modal does not modify any external state

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint the new file
npx eslint src/domUI/expression-diagnostics/MonteCarloReportModal.js

# Manual verification: Import and check structure
node -e "
  import('./src/domUI/expression-diagnostics/MonteCarloReportModal.js')
    .then(m => {
      console.log('Class imported successfully');
      console.log('Prototype methods:', Object.getOwnPropertyNames(m.default.prototype));
    })
    .catch(e => console.error('Import failed:', e));
"
```

## Definition of Done

- [x] `MonteCarloReportModal.js` created in `src/domUI/expression-diagnostics/`
- [x] Class extends `BaseModalRenderer`
- [x] Constructor uses `buildModalElementsConfig()` with correct selectors
- [x] Constructor calls `super()` with required dependencies
- [x] `showReport(markdownContent)` method implemented
- [x] `_onShow()` lifecycle hook populates content area
- [x] `_onHide()` lifecycle hook clears content
- [x] `_getInitialFocusElement()` returns copy button
- [x] Copy button click handler implemented
- [x] Uses `copyToClipboard()` from `clipboardUtils.js`
- [x] Success/error messages displayed via `_displayStatusMessage()`
- [x] Status auto-clears after 2 seconds
- [x] `_operationInProgressAffectedElements` configured
- [x] Event listener uses `_addDomListener()` for cleanup
- [x] All element access is null-safe
- [x] File passes ESLint
- [x] File passes typecheck
- [x] JSDoc comments on public methods

---

## Outcome

**Completed on**: 2026-01-10

### Files Created

| File | Description |
|------|-------------|
| `src/domUI/expression-diagnostics/MonteCarloReportModal.js` | Modal renderer class extending BaseModalRenderer |
| `tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js` | Unit tests (18 tests, 100% coverage) |

### Implementation Notes

1. **Logger Access**: Used `this.logger` instead of `this._logger` for error logging, following the pattern where BaseModalRenderer exposes the logger property publicly.

2. **JSDoc Style**: Added blank lines between block descriptions and `@param` tags to satisfy the project's ESLint jsdoc/tag-lines rule.

3. **Import Simplification**: Did not include `validateDependency` import since BaseModalRenderer handles dependency validation internally.

4. **Tests Added Early**: Although the ticket said "DO NOT create test files - that's MONCARREPGEN-008", basic tests were added during implementation per user request to ensure the modal works correctly.

### Test Coverage

```
MonteCarloReportModal.js | 100% Stmts | 100% Branch | 100% Funcs | 100% Lines
```

All 18 tests passing:
- Constructor tests (3)
- showReport() tests (2)
- _onShow lifecycle tests (2)
- _onHide lifecycle tests (2)
- _getInitialFocusElement tests (3)
- Copy functionality tests (5)
- Event binding tests (1)

### Verification Results

- ESLint: Passes with no errors or warnings
- Unit Tests: 18/18 passing
- Type check: Pre-existing errors in codebase (not related to this change)
