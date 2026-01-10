# MONCARREPGEN-008: Unit Tests - Modal Renderer

## Summary

Create unit tests for `MonteCarloReportModal` covering show/hide lifecycle, content display, copy functionality, and status messaging.

## Priority: Medium | Effort: Small-Medium

## Rationale

Unit tests for the modal ensure:
- Proper lifecycle management (show/hide hooks)
- Content is correctly displayed and cleared
- Clipboard copy functionality works
- Status messages display correctly
- Focus management follows accessibility patterns

## Dependencies

- **MONCARREPGEN-005** - MonteCarloReportModal class must exist

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify MonteCarloReportModal.js
- **DO NOT** create integration tests - that's MONCARREPGEN-009
- **DO NOT** test report generator - that's MONCARREPGEN-007
- **DO NOT** test actual clipboard API - mock it

## Implementation Details

### Test File Structure

```javascript
/**
 * @file Unit tests for MonteCarloReportModal
 * @see specs/monte-carlo-report-generator.md
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock clipboard utils before importing modal
jest.mock('../../../../src/domUI/helpers/clipboardUtils.js', () => ({
  copyToClipboard: jest.fn(),
}));

import MonteCarloReportModal from '../../../../src/domUI/expression-diagnostics/MonteCarloReportModal.js';
import { copyToClipboard } from '../../../../src/domUI/helpers/clipboardUtils.js';

describe('MonteCarloReportModal', () => {
  let modal;
  let mockLogger;
  let mockDocumentContext;
  let mockEventDispatcher;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="mc-report-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
          <button id="mc-report-close-btn"></button>
          <pre id="mc-report-content"></pre>
          <div id="mc-report-status"></div>
          <button id="mc-report-copy-btn"></button>
        </div>
      </div>
    `;

    // Setup mocks
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDocumentContext = {
      getDocument: () => document,
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    // Reset clipboard mock
    copyToClipboard.mockReset();
    copyToClipboard.mockResolvedValue(true);

    // Create modal instance
    modal = new MonteCarloReportModal({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockEventDispatcher,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    modal = null;
  });

  // Test sections below...
});
```

### Test Categories

#### 1. Constructor Tests
```javascript
describe('Constructor', () => {
  it('should create instance with valid dependencies', () => {
    expect(modal).toBeInstanceOf(MonteCarloReportModal);
  });

  it('should bind to correct DOM elements', () => {
    expect(modal.elements.modalElement).toBeTruthy();
    expect(modal.elements.closeButton).toBeTruthy();
    expect(modal.elements.contentArea).toBeTruthy();
    expect(modal.elements.copyButton).toBeTruthy();
    expect(modal.elements.statusMessageElement).toBeTruthy();
  });

  it('should start with modal hidden', () => {
    expect(modal.isVisible).toBe(false);
  });
});
```

#### 2. showReport() Tests
```javascript
describe('showReport()', () => {
  it('should store markdown content', () => {
    const content = '# Test Report\nSome content';
    modal.showReport(content);

    expect(modal.elements.contentArea.textContent).toBe(content);
  });

  it('should make modal visible', () => {
    modal.showReport('test content');

    expect(modal.isVisible).toBe(true);
  });

  it('should call show() internally', () => {
    const showSpy = jest.spyOn(modal, 'show');
    modal.showReport('test');

    expect(showSpy).toHaveBeenCalled();
    showSpy.mockRestore();
  });
});
```

#### 3. Lifecycle Hook Tests
```javascript
describe('Lifecycle Hooks', () => {
  describe('_onShow()', () => {
    it('should populate content area with stored markdown', () => {
      const content = '# Report Title\n\nBody text';
      modal.showReport(content);

      expect(modal.elements.contentArea.textContent).toBe(content);
    });
  });

  describe('_onHide()', () => {
    it('should clear content area', () => {
      modal.showReport('some content');
      modal.hide();

      // Wait for hide animation
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(modal.elements.contentArea.textContent).toBe('');
          resolve();
        }, 400); // Slightly longer than hide animation
      });
    });

    it('should clear stored report content', () => {
      modal.showReport('some content');
      modal.hide();

      // Verify internal state is cleared (via next showReport)
      return new Promise((resolve) => {
        setTimeout(() => {
          // If we show again without content, it should be empty
          modal.show();
          expect(modal.elements.contentArea.textContent).toBe('');
          resolve();
        }, 400);
      });
    });
  });
});
```

#### 4. Copy Functionality Tests
```javascript
describe('Copy Functionality', () => {
  it('should call copyToClipboard with report content', async () => {
    const content = '# Test Report';
    modal.showReport(content);

    // Trigger copy button click
    modal.elements.copyButton.click();

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(copyToClipboard).toHaveBeenCalledWith(content);
  });

  it('should show success message on successful copy', async () => {
    copyToClipboard.mockResolvedValue(true);
    modal.showReport('test');

    modal.elements.copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(modal.elements.statusMessageElement.textContent).toContain('Copied');
  });

  it('should show error message on failed copy', async () => {
    copyToClipboard.mockResolvedValue(false);
    modal.showReport('test');

    modal.elements.copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(modal.elements.statusMessageElement.textContent).toContain('Failed');
  });

  it('should handle copy exception gracefully', async () => {
    copyToClipboard.mockRejectedValue(new Error('Clipboard error'));
    modal.showReport('test');

    modal.elements.copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(modal.elements.statusMessageElement.textContent).toContain('Failed');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should show error if no content to copy', async () => {
    modal.show(); // Show without content

    modal.elements.copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(modal.elements.statusMessageElement.textContent).toContain('No content');
  });

  it('should auto-clear status message after 2 seconds', async () => {
    jest.useFakeTimers();
    modal.showReport('test');

    modal.elements.copyButton.click();
    await Promise.resolve(); // Let async handlers run

    expect(modal.elements.statusMessageElement.textContent).not.toBe('');

    jest.advanceTimersByTime(2100);
    await Promise.resolve();

    expect(modal.elements.statusMessageElement.textContent).toBe('');

    jest.useRealTimers();
  });
});
```

#### 5. Focus Management Tests
```javascript
describe('Focus Management', () => {
  it('should return copy button as initial focus element', () => {
    const focusElement = modal._getInitialFocusElement();

    expect(focusElement).toBe(modal.elements.copyButton);
  });

  it('should fall back to close button if copy button unavailable', () => {
    // Remove copy button
    modal.elements.copyButton = null;

    const focusElement = modal._getInitialFocusElement();

    expect(focusElement).toBe(modal.elements.closeButton);
  });
});
```

#### 6. Close Behavior Tests
```javascript
describe('Close Behavior', () => {
  it('should close on close button click', () => {
    modal.showReport('test');
    expect(modal.isVisible).toBe(true);

    modal.elements.closeButton.click();

    expect(modal.isVisible).toBe(false);
  });

  it('should close on Escape key', () => {
    modal.showReport('test');

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(modal.isVisible).toBe(false);
  });

  it('should close on backdrop click', () => {
    modal.showReport('test');

    // Click on modal overlay itself, not content
    modal.elements.modalElement.click();

    expect(modal.isVisible).toBe(false);
  });
});
```

#### 7. Edge Case Tests
```javascript
describe('Edge Cases', () => {
  it('should handle empty string content', () => {
    expect(() => modal.showReport('')).not.toThrow();
    expect(modal.elements.contentArea.textContent).toBe('');
  });

  it('should handle very long content', () => {
    const longContent = 'x'.repeat(100000);
    expect(() => modal.showReport(longContent)).not.toThrow();
    expect(modal.elements.contentArea.textContent).toBe(longContent);
  });

  it('should handle content with special characters', () => {
    const specialContent = '# Report\n<script>alert("xss")</script>\n```code```';
    modal.showReport(specialContent);

    // Content should be treated as text, not HTML
    expect(modal.elements.contentArea.textContent).toBe(specialContent);
    expect(modal.elements.contentArea.innerHTML).not.toContain('<script>');
  });

  it('should handle multiple show/hide cycles', () => {
    for (let i = 0; i < 5; i++) {
      modal.showReport(`Content ${i}`);
      modal.hide();
    }

    // Should still work
    modal.showReport('Final content');
    expect(modal.elements.contentArea.textContent).toBe('Final content');
  });
});
```

### DOM Setup Requirements

The test DOM must include all elements that `buildModalElementsConfig` expects:
- `#mc-report-modal` - Modal overlay
- `#mc-report-close-btn` - Close button
- `#mc-report-content` - Content display area
- `#mc-report-status` - Status message area
- `#mc-report-copy-btn` - Copy button

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js --verbose --coverage
```

### Coverage Requirements

- **Statements**: >= 85%
- **Branches**: >= 80%
- **Functions**: >= 85%
- **Lines**: >= 85%

### Invariants That Must Remain True

1. **DOM isolation**: Tests clean up DOM after each test
2. **Mock isolation**: Clipboard mock reset between tests
3. **Async handling**: Proper await/timeout for async operations
4. **No real clipboard**: Always mock `copyToClipboard`

## Verification Commands

```bash
# Run tests with coverage
npm run test:unit -- tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js --verbose --coverage

# Run in watch mode
npm run test:unit -- tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js --watch

# Lint test file
npx eslint tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js
```

## Definition of Done

- [ ] Test file created at correct path
- [ ] Clipboard utils properly mocked
- [ ] DOM setup includes all required elements
- [ ] Constructor tests verify element binding
- [ ] showReport() tests verify content and visibility
- [ ] Lifecycle hook tests verify _onShow and _onHide
- [ ] Copy tests cover success, failure, exception, empty content
- [ ] Status auto-clear tested with fake timers
- [ ] Focus management tests verify initial focus element
- [ ] Close behavior tests verify button, Escape, backdrop
- [ ] Edge case tests for empty, long, special content
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] Test file passes ESLint
- [ ] DOM cleanup in afterEach
