# Ticket 02: CSS Styling and Responsive Design

## Overview

Create comprehensive CSS styling for the Character Concepts Manager page, including concept cards, grid layout, modals, and responsive design that matches the existing Character Builder design language.

## Dependencies

- Ticket 01: HTML Structure and Page Layout (must be completed first)

## Implementation Details

### 1. Create character-concepts-manager.css

Create a new file `css/character-concepts-manager.css` with the following structure:

```css
/* Import shared components */
@import url('./components.css');

/* Page-specific styles */
```

### 2. Page Layout Styles

Define the main layout grid:

```css
/* Page-specific layout */
.character-concepts-manager-main {
  grid-template-columns: 300px 1fr;
  gap: 2rem;
  padding: 2rem;
}

/* Control panel styling */
.concept-controls-panel {
  background: #ffffff;
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 2rem;
  height: fit-content;
  position: sticky;
  top: 2rem;
}

/* Results panel styling */
.concepts-display-panel {
  background: #ffffff;
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 2rem;
  min-height: 600px;
}
```

### 3. Action Buttons Styling

Style the primary action buttons:

```css
/* Action buttons container */
.action-buttons {
  margin-bottom: 2rem;
}

.action-buttons button {
  width: 100%;
}

/* Enhance primary button for create action */
#create-concept-btn {
  font-size: 1rem;
  padding: 1rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
```

### 4. Concepts Grid Layout

Create the responsive grid for concept cards:

```css
/* Concepts grid */
.concepts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  padding: 1rem;
}

/* Ensure grid items don't stretch */
.concepts-grid > * {
  height: fit-content;
}
```

### 5. Concept Card Styling

Design the concept cards with hover effects:

```css
/* Concept card styling */
.concept-card {
  background: #ffffff;
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.concept-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
  border-color: var(--narrative-purple-light);
}

/* Card header */
.concept-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

/* Status badges */
.concept-status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.concept-status.completed {
  background: rgba(46, 204, 113, 0.1);
  color: #27ae60;
}

.concept-status.draft {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

/* Menu button */
.concept-menu-btn {
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  font-size: 1.25rem;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.concept-menu-btn:hover {
  background: var(--bg-highlight);
  color: var(--text-primary);
}

/* Concept text */
.concept-text {
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0 0 1rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.95rem;
}

/* Metadata section */
.concept-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.direction-count strong {
  color: var(--narrative-purple);
  font-weight: 600;
}

.concept-date {
  font-style: italic;
}

/* Card actions */
.concept-card-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-primary);
}

.concept-card-actions button {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-primary);
  background: transparent;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.concept-card-actions button:hover {
  background: var(--bg-highlight);
  border-color: var(--narrative-purple);
  transform: translateY(-1px);
}

/* Specific button styles */
.edit-btn:hover {
  background: rgba(52, 152, 219, 0.1);
  border-color: #3498db;
  color: #2980b9;
}

.delete-btn:hover {
  background: rgba(231, 76, 60, 0.1);
  border-color: #e74c3c;
  color: #c0392b;
}

.view-directions-btn:hover {
  background: var(--narrative-purple-light);
  border-color: var(--narrative-purple);
  color: var(--narrative-purple-dark);
}
```

### 6. Statistics Display Styling

Style the statistics section:

```css
/* Statistics display */
.stats-display {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.stats-display h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  color: var(--text-primary);
  font-weight: 600;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-primary);
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.stat-value {
  font-weight: 600;
  color: var(--narrative-purple);
  font-size: 1.125rem;
}
```

### 7. Search Input Styling

Enhance the search input:

```css
/* Search input enhancement */
#concept-search {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  transition: all 0.2s ease;
}

#concept-search:focus {
  background: #ffffff;
  border-color: var(--narrative-purple);
  outline: none;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

#concept-search::placeholder {
  color: var(--text-tertiary);
}
```

### 8. Modal Enhancements

Style the modals specific to this page:

```css
/* Modal enhancements for concept forms */
#concept-modal .modal-content {
  max-width: 600px;
}

#concept-modal .cb-textarea {
  min-height: 150px;
  resize: vertical;
}

/* Character counter styling */
.char-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

.char-count.warning {
  color: #f39c12;
}

.char-count.error {
  color: #e74c3c;
}

/* Delete confirmation modal */
#delete-confirmation-modal .modal-content {
  max-width: 500px;
}

#delete-modal-message {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
}

#delete-modal-message strong {
  color: var(--narrative-purple);
  font-weight: 600;
}

/* Danger button styling */
.cb-button-danger {
  background: #e74c3c;
  color: white;
  padding: 1rem 2rem;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.cb-button-danger:hover:not(:disabled) {
  background: #c0392b;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(231, 76, 60, 0.3);
}

.cb-button-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### 9. State Container Styling

Enhance the various state displays:

```css
/* Empty state enhancement */
.cb-empty-state {
  text-align: center;
  padding: 4rem 2rem;
}

.cb-empty-state p {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.cb-empty-state p:first-child {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--text-primary);
}

/* Loading state enhancement */
.cb-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1.5rem;
}

/* Error state enhancement */
.cb-error-state {
  text-align: center;
  padding: 4rem 2rem;
}

.error-title {
  font-size: 1.25rem;
  color: #e74c3c;
  font-weight: 600;
  margin-bottom: 1rem;
}

.error-message {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}
```

### 10. Responsive Design

Add responsive breakpoints:

```css
/* Tablet breakpoint */
@media (max-width: 1024px) {
  .character-concepts-manager-main {
    grid-template-columns: 250px 1fr;
    gap: 1.5rem;
    padding: 1.5rem;
  }

  .concepts-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
}

/* Mobile breakpoint */
@media (max-width: 768px) {
  .character-concepts-manager-main {
    grid-template-columns: 1fr;
    gap: 1rem;
    padding: 1rem;
  }

  .concept-controls-panel {
    position: static;
    margin-bottom: 1rem;
  }

  .concepts-grid {
    grid-template-columns: 1fr;
    padding: 0.5rem;
  }

  .concept-card {
    padding: 1rem;
  }

  .concept-card-actions {
    flex-wrap: wrap;
  }

  .concept-card-actions button {
    min-width: calc(50% - 0.25rem);
  }

  .stats-display {
    margin-top: 1.5rem;
  }

  /* Modal adjustments */
  .modal-content {
    margin: 1rem;
    max-width: calc(100% - 2rem);
  }
}

/* Small mobile breakpoint */
@media (max-width: 480px) {
  .cb-page-header h1 {
    font-size: 1.5rem;
  }

  .concept-card-actions button {
    min-width: 100%;
    margin-bottom: 0.5rem;
  }

  .concept-card-actions {
    padding-top: 0.5rem;
  }

  .concept-meta {
    flex-direction: column;
    gap: 0.5rem;
  }
}
```

### 11. Animation and Transitions

Add smooth animations:

```css
/* Card entrance animation */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.concept-card {
  animation: fadeInUp 0.3s ease-out;
}

/* Stagger animation for multiple cards */
.concept-card:nth-child(1) {
  animation-delay: 0.05s;
}
.concept-card:nth-child(2) {
  animation-delay: 0.1s;
}
.concept-card:nth-child(3) {
  animation-delay: 0.15s;
}
.concept-card:nth-child(4) {
  animation-delay: 0.2s;
}
.concept-card:nth-child(5) {
  animation-delay: 0.25s;
}
.concept-card:nth-child(6) {
  animation-delay: 0.3s;
}

/* Smooth height transitions */
.concepts-grid {
  transition: min-height 0.3s ease;
}
```

## Acceptance Criteria

1. ✅ CSS file created in correct location
2. ✅ Two-column layout with sticky controls panel
3. ✅ Concept cards styled with hover effects
4. ✅ Statistics display properly styled
5. ✅ Modal styling matches existing patterns
6. ✅ Responsive design works on all breakpoints
7. ✅ Search input has focus states
8. ✅ Button hover states implemented
9. ✅ Animations are smooth and performant
10. ✅ All colors use CSS variables from design system

## Testing Requirements

1. Test on multiple screen sizes (desktop, tablet, mobile)
2. Verify sticky positioning works correctly
3. Check hover states on all interactive elements
4. Test with multiple concept cards for grid layout
5. Verify animations don't cause layout shift
6. Test with long concept text for truncation

## Notes

- Use existing CSS variables from the design system
- Maintain consistency with other Character Builder pages
- Keep animations subtle and performant
- Ensure sufficient color contrast for accessibility
- Test with both light and dark themes if applicable
