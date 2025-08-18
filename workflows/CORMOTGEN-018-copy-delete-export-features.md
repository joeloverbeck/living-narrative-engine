# CORMOTGEN-018: Implement Copy, Delete, and Export Features

## Ticket ID

CORMOTGEN-018

## Title

Add copy to clipboard, delete, and export to text functionality

## Status

TODO

## Priority

MEDIUM

## Estimated Effort

3-4 hours

## Dependencies

- CORMOTGEN-015 (Display components)
- CORMOTGEN-017 (Accumulative display)

## Description

Implement user interaction features for managing motivation blocks including copy, delete, and export functionality.

## Technical Requirements

### 1. Copy to Clipboard

```javascript
async copyMotivation(motivationId) {
  const motivation = this.#findMotivation(motivationId);
  const text = this.#formatForClipboard(motivation);

  try {
    await navigator.clipboard.writeText(text);
    this.#showSuccess('Copied to clipboard');
  } catch (error) {
    // Fallback for older browsers
    this.#copyFallback(text);
  }
}

#formatForClipboard(motivation) {
  return `Core Motivation: ${motivation.coreMotivation}
Contradiction: ${motivation.contradiction}
Central Question: ${motivation.centralQuestion}`;
}
```

### 2. Delete Operations

```javascript
async deleteMotivation(motivationId) {
  // Show inline confirmation
  const confirmed = await this.#showInlineConfirm(motivationId);

  if (confirmed) {
    // Animate removal
    await this.#animateRemoval(motivationId);

    // Delete from database
    await this.#service.removeMotivation(motivationId);

    // Update display
    this.#removeFromDisplay(motivationId);
  }
}
```

### 3. Export to Text

```javascript
exportAllMotivations() {
  const text = this.#formatAllForExport();

  // Option 1: Copy to clipboard
  navigator.clipboard.writeText(text);

  // Option 2: Download as file
  this.#downloadAsFile(text, 'core-motivations.txt');
}

#formatAllForExport() {
  // Format with headers
  // Include metadata
  // Organize by date
}
```

### 4. Confirmation Dialogs

- Inline confirmation for single delete
- Modal confirmation for clear all
- Undo capability (5 seconds)

## Implementation Steps

1. Add copy functionality
2. Implement delete with confirmation
3. Create export formatter
4. Add download capability
5. Implement undo system
6. Add success notifications

## Validation Criteria

- [ ] Copy works on all browsers
- [ ] Delete requires confirmation
- [ ] Export formats correctly
- [ ] Undo works within timeout
- [ ] Notifications appear
- [ ] Keyboard shortcuts work

## Checklist

- [ ] Implement copy feature
- [ ] Add delete with confirm
- [ ] Create export formatter
- [ ] Add file download
- [ ] Implement undo
- [ ] Add notifications
- [ ] Test browser compatibility
