# CORMOTGEN-019: Add Keyboard Shortcuts and Accessibility

## Ticket ID

CORMOTGEN-019

## Title

Implement keyboard shortcuts and comprehensive accessibility features

## Status

TODO

## Priority

MEDIUM

## Estimated Effort

3-4 hours

## Dependencies

- CORMOTGEN-002 (HTML structure)
- All UI components

## Description

Add keyboard navigation, shortcuts, and WCAG AA accessibility compliance to ensure the feature is usable by all users.

## Technical Requirements

### 1. Keyboard Shortcuts

```javascript
class KeyboardShortcutManager {
  shortcuts = {
    'ctrl+enter': 'generate',
    'ctrl+e': 'export',
    'ctrl+shift+delete': 'clearAll',
    escape: 'closeModal',
    tab: 'navigate',
    enter: 'select',
    delete: 'deleteSelected',
  };

  initialize() {
    document.addEventListener('keydown', this.#handleKeydown.bind(this));
  }

  #handleKeydown(event) {
    const shortcut = this.#getShortcut(event);
    if (shortcut) {
      event.preventDefault();
      this.#executeAction(shortcut);
    }
  }
}
```

### 2. ARIA Labels

```html
<!-- Direction selector -->
<div role="listbox" aria-label="Select thematic direction">
  <div role="option" aria-selected="false" tabindex="0">Direction Title</div>
</div>

<!-- Motivation blocks -->
<article role="article" aria-label="Core motivation block">
  <button aria-label="Copy motivation to clipboard">Copy</button>
  <button aria-label="Delete this motivation">Delete</button>
</article>
```

### 3. Focus Management

```javascript
class FocusManager {
  trapFocus(container) {
    const focusable = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    container.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
}
```

### 4. Screen Reader Support

- Announce state changes
- Provide context for actions
- Include skip links
- Use semantic HTML

### 5. Color Contrast

- Ensure WCAG AA compliance (4.5:1)
- Provide high contrast mode
- Don't rely on color alone

## Implementation Steps

1. Add keyboard event handlers
2. Implement shortcut system
3. Add ARIA attributes
4. Implement focus management
5. Test with screen readers
6. Verify color contrast
7. Add skip navigation

## Validation Criteria

- [ ] All features keyboard accessible
- [ ] Shortcuts work correctly
- [ ] ARIA labels present
- [ ] Focus trap in modals
- [ ] Screen reader compatible
- [ ] WCAG AA compliant
- [ ] Tab order logical

## Checklist

- [ ] Add keyboard handlers
- [ ] Implement shortcuts
- [ ] Add ARIA labels
- [ ] Manage focus
- [ ] Test screen readers
- [ ] Check contrast ratios
- [ ] Document shortcuts
