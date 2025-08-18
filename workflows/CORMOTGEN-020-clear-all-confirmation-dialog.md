# CORMOTGEN-020: Implement Clear All with Confirmation Dialog

## Ticket ID

CORMOTGEN-020

## Title

Add Clear All functionality with modal confirmation dialog

## Status

TODO

## Priority

MEDIUM

## Estimated Effort

2-3 hours

## Dependencies

- CORMOTGEN-002 (HTML modal structure)
- CORMOTGEN-004 (Controller)

## Description

Implement the Clear All feature that removes all motivations for a direction with a proper confirmation modal to prevent accidental data loss.

## Technical Requirements

### 1. Modal Implementation

```javascript
class ConfirmationModal {
  constructor({ title, message, onConfirm, onCancel }) {
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  show() {
    const modal = document.getElementById('confirmation-modal');
    modal.style.display = 'flex';

    // Update content
    modal.querySelector('h3').textContent = this.title;
    modal.querySelector('p').textContent = this.message;

    // Focus management
    this.#trapFocus(modal);

    // Event handlers
    this.#attachEventHandlers();
  }

  hide() {
    const modal = document.getElementById('confirmation-modal');
    modal.style.display = 'none';

    // Restore focus
    this.#restoreFocus();
  }
}
```

### 2. Clear All Logic

```javascript
async clearAllMotivations() {
  const count = this.#currentMotivations.length;

  if (count === 0) return;

  const modal = new ConfirmationModal({
    title: 'Clear All Motivations?',
    message: `This will permanently delete ${count} motivation${count > 1 ? 's' : ''} for this direction.`,
    onConfirm: async () => {
      try {
        // Show loading
        this.#showClearingState();

        // Delete from database
        await this.#service.clearAllForDirection(this.#directionId);

        // Clear display
        this.#clearDisplay();

        // Show success
        this.#showSuccess(`Cleared ${count} motivations`);

      } catch (error) {
        this.#showError('Failed to clear motivations');
      }
    },
    onCancel: () => {
      // Just close modal
    }
  });

  modal.show();
}
```

### 3. Safety Features

- Disable button if no motivations
- Show count in confirmation
- ESC key cancels
- Click outside cancels
- Loading state during deletion

### 4. Visual Design

```css
.modal {
  backdrop-filter: blur(4px);
  animation: fadeIn 0.2s;
}

.modal-content {
  animation: slideIn 0.3s;
  max-width: 400px;
}

.btn-danger:hover {
  background: var(--danger-dark);
  transform: scale(1.02);
}
```

## Implementation Steps

1. Create modal class
2. Implement show/hide logic
3. Add focus trapping
4. Connect to Clear All button
5. Implement deletion logic
6. Add loading states
7. Handle errors

## Validation Criteria

- [ ] Modal appears on click
- [ ] Shows correct count
- [ ] ESC key cancels
- [ ] Deletion works
- [ ] Loading state shows
- [ ] Success message appears
- [ ] Focus management works

## Checklist

- [ ] Create modal class
- [ ] Add show/hide methods
- [ ] Implement focus trap
- [ ] Connect to button
- [ ] Add deletion logic
- [ ] Handle loading states
- [ ] Test all scenarios
