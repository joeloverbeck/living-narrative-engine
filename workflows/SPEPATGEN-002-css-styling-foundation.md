# SPEPATGEN-002: Set Up CSS Styling Foundation

## Ticket Overview

- **Epic**: Speech Patterns Generator Implementation
- **Phase**: 1 - Foundation Setup
- **Type**: Frontend/Styling
- **Priority**: High
- **Estimated Effort**: 1 day
- **Dependencies**: SPEPATGEN-001 (HTML Page Structure)

## Description

Create the CSS styling foundation for the Speech Patterns Generator, implementing responsive design, accessibility features, and visual consistency with existing character builder tools. This includes layout, typography, components, and interactive states.

## Requirements

### CSS File Creation

- **File**: `css/speech-patterns-generator.css`
- **Purpose**: Page-specific styles extending existing component library
- **Integration**: Referenced from HTML page created in SPEPATGEN-001

### Complete CSS Implementation

Based on the specification, implement the full styling system:

```css
/* Speech Patterns Generator Specific Styles */

.speech-patterns-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  min-height: calc(100vh - var(--header-height) - var(--footer-height));
}

/* Character Input Panel */
.character-input-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.content-guidelines-notice {
  background: var(--warning-bg-color, #fff3cd);
  border: 1px solid var(--warning-border-color, #ffeaa7);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.notice-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--warning-text-color, #856404);
  margin-bottom: 0.5rem;
}

.notice-text {
  font-size: 0.9rem;
  color: var(--warning-text-color, #856404);
  margin: 0;
  line-height: 1.4;
}

/* Character Input Section */
.character-input-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.input-label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--primary-text-color);
}

.input-description {
  font-size: 0.9rem;
  color: var(--secondary-text-color);
  margin-bottom: 1rem;
  line-height: 1.4;
}

.character-definition-input {
  flex: 1;
  min-height: 400px;
  padding: 1rem;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.4;
  resize: vertical;
  background: var(--input-bg-color, #ffffff);
  color: var(--primary-text-color);
  transition: border-color 0.2s ease;
}

.character-definition-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-color-alpha);
}

.character-definition-input.error {
  border-color: var(--error-color);
}

.input-help {
  margin-top: 0.5rem;
}

.input-help p {
  font-size: 0.8rem;
  color: var(--secondary-text-color);
  margin: 0;
  line-height: 1.3;
}

/* Generation Controls */
.generation-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.shortcut-hint {
  background: var(--info-bg-color, #e3f2fd);
  border-left: 4px solid var(--info-border-color, #2196f3);
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
}

.shortcut-hint div {
  margin-bottom: 0.25rem;
}

.shortcut-hint div:last-child {
  margin-bottom: 0;
}

.shortcut-hint kbd {
  background: var(--kbd-bg-color, #f5f5f5);
  border: 1px solid var(--kbd-border-color, #ccc);
  border-radius: 3px;
  padding: 0.125rem 0.25rem;
  font-size: 0.75rem;
  font-family: monospace;
  margin: 0 0.125rem;
}

/* Speech Patterns Display */
.speech-patterns-display-panel {
  display: flex;
  flex-direction: column;
}

.cb-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
}

.panel-actions {
  display: flex;
  gap: 0.5rem;
}

.speech-patterns-container {
  flex: 1;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* Custom Scrollbar for Speech Patterns Container */
.speech-patterns-container::-webkit-scrollbar {
  width: 8px;
}

.speech-patterns-container::-webkit-scrollbar-track {
  background: var(--scrollbar-track-color, #f1f1f1);
  border-radius: 4px;
}

.speech-patterns-container::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb-color, #c1c1c1);
  border-radius: 4px;
}

.speech-patterns-container::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover-color, #a8a8a8);
}

.speech-patterns-results {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 1rem;
}

.results-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
}

.results-header h3 {
  color: var(--primary-color);
  margin-bottom: 0.5rem;
  font-size: 1.25rem;
}

.results-subtitle {
  color: var(--secondary-text-color);
  font-style: italic;
  margin: 0;
}

/* Individual Speech Pattern Display */
.speech-pattern-item {
  background: var(--card-bg-color, #ffffff);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  position: relative;
}

.speech-pattern-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color, rgba(0, 0, 0, 0.1));
}

.pattern-number {
  position: absolute;
  top: -10px;
  left: 1.5rem;
  background: var(--primary-color);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pattern-description {
  font-size: 1rem;
  color: var(--primary-text-color);
  margin-bottom: 1rem;
  margin-top: 0.5rem;
  font-weight: 500;
  line-height: 1.5;
}

.pattern-example {
  background: var(--code-bg-color, #f8f9fa);
  border-left: 4px solid var(--accent-color, #6c757d);
  padding: 1rem;
  border-radius: 4px;
  font-style: italic;
  color: var(--secondary-text-color);
  margin-bottom: 0.5rem;
  position: relative;
}

.pattern-example::before {
  content: '"';
  position: absolute;
  left: 0.5rem;
  top: 0.25rem;
  font-size: 2rem;
  color: var(--accent-color, #6c757d);
  opacity: 0.3;
}

.pattern-example::after {
  content: '"';
  position: absolute;
  right: 0.5rem;
  bottom: -0.25rem;
  font-size: 2rem;
  color: var(--accent-color, #6c757d);
  opacity: 0.3;
}

.pattern-circumstances {
  font-size: 0.85rem;
  color: var(--tertiary-text-color);
  margin-top: 0.75rem;
  padding-left: 1rem;
  border-left: 2px solid var(--info-border-color, #e0e0e0);
}

.pattern-circumstances::before {
  content: 'Context: ';
  font-weight: 600;
  color: var(--secondary-text-color);
}

/* Loading and Empty States */
.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--spinner-track-color, #f3f3f3);
  border-top: 4px solid var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: var(--secondary-text-color);
}

.empty-state-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state-text {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  color: var(--primary-text-color);
}

.empty-state-subtext {
  font-size: 0.9rem;
  line-height: 1.4;
  max-width: 400px;
}

/* Footer Enhancements */
.footer-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pattern-count {
  font-size: 0.9rem;
  color: var(--secondary-text-color);
  font-weight: 500;
}

/* Button Enhancements */
.cb-button .button-icon {
  margin-right: 0.5rem;
  font-size: 1.1em;
}

.cb-button-primary:disabled,
.cb-button-secondary:disabled,
.cb-button-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Focus Management */
.cb-button:focus-visible,
.character-definition-input:focus-visible {
  outline: 2px solid var(--focus-color, #2196f3);
  outline-offset: 2px;
}

/* High Contrast Mode Support */
@media (prefers-contrast: high) {
  .speech-pattern-item {
    border-width: 2px;
  }

  .pattern-example {
    border-left-width: 6px;
  }

  .content-guidelines-notice {
    border-width: 2px;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .speech-pattern-item {
    transition: none;
  }

  .character-definition-input {
    transition: none;
  }

  .spinner {
    animation: none;
    border-top-color: var(--primary-color);
  }
}

/* Dark Mode Support */
@media (prefers-color-scheme: dark) {
  .character-definition-input {
    background: var(--dark-input-bg, #2a2a2a);
    color: var(--dark-text-color, #ffffff);
    border-color: var(--dark-border-color, #555);
  }

  .speech-pattern-item {
    background: var(--dark-card-bg, #1e1e1e);
    border-color: var(--dark-border-color, #555);
  }

  .pattern-example {
    background: var(--dark-code-bg, #2d2d2d);
  }

  .content-guidelines-notice {
    background: var(--dark-warning-bg, #3d2f00);
    border-color: var(--dark-warning-border, #6b5300);
  }

  .shortcut-hint {
    background: var(--dark-info-bg, #0d2133);
    border-left-color: var(--dark-info-border, #1976d2);
  }
}

/* Responsive Design */
@media (max-width: 1024px) {
  .speech-patterns-main {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .character-definition-input {
    min-height: 300px;
  }

  .cb-panel-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .panel-actions {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .speech-patterns-main {
    gap: 1rem;
    padding: 1rem;
  }

  .character-definition-input {
    min-height: 250px;
    font-size: 0.8rem;
  }

  .speech-pattern-item {
    padding: 1rem;
  }

  .pattern-number {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
    top: -8px;
    left: 1rem;
  }

  .pattern-description {
    font-size: 0.9rem;
  }

  .pattern-example {
    padding: 0.75rem;
    font-size: 0.9rem;
  }

  .cb-panel-header h2 {
    font-size: 1.25rem;
  }

  .empty-state-icon {
    font-size: 3rem;
  }

  .empty-state-text {
    font-size: 1.1rem;
  }

  .shortcut-hint {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .speech-patterns-main {
    padding: 0.5rem;
  }

  .speech-pattern-item {
    padding: 0.75rem;
    border-radius: 6px;
  }

  .pattern-example {
    padding: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .cb-button .button-text {
    display: none;
  }

  .cb-button .button-icon {
    margin-right: 0;
  }

  .panel-actions {
    flex-direction: column;
  }
}

/* Print Styles */
@media print {
  .cb-page-header,
  .footer-navigation,
  .generation-controls,
  .panel-actions,
  .loading-indicator {
    display: none;
  }

  .speech-patterns-main {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .speech-pattern-item {
    break-inside: avoid;
    box-shadow: none;
    border: 1px solid #000;
  }

  .pattern-example {
    background: transparent;
    border-left: 2px solid #000;
  }
}

/* Accessibility Enhancements */
.screen-reader-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--primary-color);
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 6px;
}

/* Animation for Pattern Appearance */
.speech-pattern-item.fade-in {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### CSS Custom Properties Integration

Ensure compatibility with existing CSS custom properties:

```css
:root {
  /* Speech Patterns Generator specific variables */
  --speech-pattern-card-bg: var(--card-bg-color, #ffffff);
  --speech-pattern-hover-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  --speech-pattern-border-radius: 8px;
  --speech-pattern-spacing: 1.5rem;

  /* Pattern numbering */
  --pattern-number-size: 32px;
  --pattern-number-bg: var(--primary-color);
  --pattern-number-color: white;

  /* Loading and empty states */
  --spinner-size: 40px;
  --empty-state-icon-size: 4rem;
  --empty-state-opacity: 0.5;
}
```

## Technical Specifications

### CSS Architecture

1. **Mobile-First Design**
   - Base styles for mobile devices
   - Progressive enhancement for larger screens
   - Breakpoints: 480px, 768px, 1024px

2. **Accessibility Features**
   - High contrast mode support
   - Reduced motion preferences
   - Dark mode compatibility
   - Focus management styles

3. **Performance Optimizations**
   - Efficient CSS selectors
   - Minimal reflow/repaint operations
   - Hardware-accelerated animations
   - Print stylesheet optimization

### Component Integration

1. **Existing Components**
   - Leverage existing button styles (.cb-button variants)
   - Extend existing panel layouts (.cb-input-panel, .cb-output-panel)
   - Use existing typography scale and spacing

2. **New Components**
   - Speech pattern cards with hover effects
   - Content guidelines notice styling
   - Loading states and empty states
   - Keyboard shortcut hints

## Acceptance Criteria

### Visual Design Requirements

- [ ] Two-panel responsive layout functions correctly
- [ ] Character input textarea styled with monospace font
- [ ] Speech pattern cards display with proper spacing and hover effects
- [ ] Content guidelines notice prominently styled with warning colors
- [ ] Loading spinner and empty states properly styled

### Responsive Design Requirements

- [ ] Layout adapts correctly to mobile devices (768px and below)
- [ ] Tablet layout maintains usability (768px - 1024px)
- [ ] Desktop layout provides optimal two-panel experience
- [ ] Text remains readable at all screen sizes
- [ ] Touch targets meet minimum size requirements on mobile

### Accessibility Requirements

- [ ] Focus indicators visible and meet contrast requirements
- [ ] High contrast mode support functional
- [ ] Reduced motion preferences respected
- [ ] Dark mode styles provide sufficient contrast
- [ ] Screen reader text properly hidden but accessible

### Performance Requirements

- [ ] CSS loads without blocking page render
- [ ] Animations perform smoothly (60fps target)
- [ ] Hover effects respond immediately
- [ ] No visual layout shifts during loading

### Integration Requirements

- [ ] Styles integrate seamlessly with existing component library
- [ ] CSS custom properties align with existing theme system
- [ ] Print styles provide usable printed output
- [ ] Cross-browser compatibility maintained (Chrome, Firefox, Safari, Edge)

## Files Modified

- **NEW**: `css/speech-patterns-generator.css`

## Dependencies For Next Tickets

This CSS foundation is required for:

- SPEPATGEN-005 (Controller Implementation) - styles support dynamic content
- SPEPATGEN-009 (UI Polish) - base styles for enhancement
- SPEPATGEN-010 (Accessibility) - accessibility styles foundation

## Notes

- Follow existing design token system for consistency
- Ensure styles support dynamic content insertion from controller
- Pay attention to loading states and transitions for good UX
- Consider future dark mode integration with existing theme system
- Test thoroughly across different browser implementations
