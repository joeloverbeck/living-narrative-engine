# CLIPORMOD-002: Create Portrait Modal CSS Styles

## Status
🔴 NOT STARTED

## Priority
HIGH - Required for modal visual presentation

## Dependencies
- None (can be done in parallel with CLIPORMOD-001)

## Description
Create the CSS stylesheet for the portrait modal component, including all visual styles, animations, responsive design, and accessibility considerations. The styles should integrate with the existing design system and use CSS custom properties for theming.

## File to Create
`css/components/_portrait-modal.css`

## CSS Structure

### 1. Base Modal Styles
```css
/* Portrait Modal Overlay - extends existing .modal-overlay */
.portrait-modal-overlay {
  background-color: rgba(0, 0, 0, 0.8); /* Darker for image viewing */
  z-index: var(--z-index-modal, 1000);
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-md);
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
}

.portrait-modal-overlay.visible {
  display: flex;
  opacity: 1;
}

/* Portrait Modal Content Container */
.portrait-modal-content {
  max-width: 90vw;
  max-height: 90vh;
  padding: var(--spacing-md);
  background-color: var(--panel-bg-color);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-xl);
  position: relative;
  display: flex;
  flex-direction: column;
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
}

.portrait-modal-overlay.visible .portrait-modal-content {
  opacity: 1;
  transform: scale(1);
}
```

### 2. Modal Header Styles
```css
.portrait-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--border-color-subtle);
}

.portrait-modal-title {
  margin: 0;
  font-size: var(--font-size-h3);
  color: var(--primary-text-color);
  font-weight: var(--font-weight-semibold);
}

.portrait-modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: var(--spacing-xs);
  color: var(--secondary-text-color);
  border-radius: var(--border-radius-sm);
  transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
  line-height: 1;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.portrait-modal-close:hover,
.portrait-modal-close:focus-visible {
  background-color: var(--accent-color-focus-ring);
  color: var(--primary-text-color);
}

.portrait-modal-close:focus-visible {
  outline: 2px solid var(--accent-color-primary);
  outline-offset: 2px;
}
```

### 3. Modal Body and Image Container
```css
.portrait-modal-body {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  min-height: 200px;
}

.portrait-image-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.portrait-modal-image {
  max-width: 100%;
  max-height: 70vh;
  height: auto;
  width: auto;
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-lg);
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.3s ease-in-out;
  display: block;
}

.portrait-modal-image.loaded {
  opacity: 1;
}
```

### 4. Loading and Error States
```css
.portrait-loading-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--secondary-text-color);
  font-style: italic;
  display: none;
}

.portrait-loading-spinner::before {
  content: "";
  display: block;
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 3px solid var(--border-color-subtle);
  border-top-color: var(--accent-color-primary);
  border-radius: 50%;
  animation: spinner 0.8s linear infinite;
}

@keyframes spinner {
  to {
    transform: rotate(360deg);
  }
}

.portrait-error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--error-text-color);
  text-align: center;
  padding: var(--spacing-md);
  background-color: var(--error-bg-color);
  border: 1px solid var(--error-text-color);
  border-radius: var(--border-radius-md);
  display: none;
}

.portrait-error-message.visible {
  display: block;
}
```

### 5. Clickable Portrait Enhancement
```css
/* Enhance speech bubble portraits that are clickable */
.speech-portrait.clickable {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  cursor: pointer;
}

.speech-portrait.clickable:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.speech-portrait.clickable:focus-visible {
  outline: 2px solid var(--accent-color-primary);
  outline-offset: 2px;
}

.speech-portrait.clickable:active {
  transform: scale(1.02);
}
```

### 6. Animation Keyframes
```css
/* Fade in animation for modal appearance */
@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Fade out animation for modal dismissal */
@keyframes modalFadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}

.portrait-modal-overlay.fade-in {
  animation: modalFadeIn 0.3s ease-out forwards;
}

.portrait-modal-overlay.fade-out {
  animation: modalFadeOut 0.3s ease-in forwards;
}
```

### 7. Responsive Design
```css
/* Tablet breakpoint */
@media (max-width: 768px) {
  .portrait-modal-content {
    max-width: 95vw;
    max-height: 95vh;
    margin: var(--spacing-sm);
    padding: var(--spacing-sm);
  }
  
  .portrait-modal-image {
    max-height: 60vh;
  }
  
  .portrait-modal-title {
    font-size: var(--font-size-h4);
  }
}

/* Mobile breakpoint */
@media (max-width: 480px) {
  .portrait-modal-overlay {
    padding: var(--spacing-xs);
  }
  
  .portrait-modal-content {
    max-width: 100%;
    max-height: 100%;
    border-radius: 0;
    margin: 0;
  }
  
  .portrait-modal-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }
  
  .portrait-modal-close {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
  }
  
  .portrait-modal-image {
    max-height: 50vh;
  }
}

/* Small mobile breakpoint */
@media (max-width: 320px) {
  .portrait-modal-title {
    font-size: var(--font-size-body);
  }
  
  .portrait-modal-image {
    max-height: 40vh;
  }
}
```

### 8. Accessibility Enhancements
```css
/* High contrast mode support */
@media (prefers-contrast: high) {
  .portrait-modal-content {
    border: 2px solid var(--primary-text-color);
  }
  
  .portrait-modal-close:focus-visible {
    outline-width: 3px;
  }
  
  .speech-portrait.clickable:focus-visible {
    outline-width: 3px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .portrait-modal-overlay,
  .portrait-modal-content,
  .portrait-modal-image,
  .speech-portrait.clickable,
  .portrait-modal-close {
    transition: none !important;
    animation: none !important;
  }
  
  .portrait-modal-overlay.visible {
    opacity: 1;
  }
  
  .portrait-modal-image.loaded {
    opacity: 1;
  }
  
  .speech-portrait.clickable:hover {
    transform: none;
  }
}

/* Dark mode adjustments (if needed) */
@media (prefers-color-scheme: dark) {
  .portrait-modal-overlay {
    background-color: rgba(0, 0, 0, 0.9);
  }
  
  .portrait-modal-content {
    box-shadow: 0 0 2rem rgba(0, 0, 0, 0.8);
  }
}
```

### 9. Print Styles
```css
@media print {
  .portrait-modal-overlay {
    display: none !important;
  }
}
```

## CSS Custom Properties Used
These should be defined in the main theme or fallback values should be provided:
- `--z-index-modal`
- `--spacing-xs`, `--spacing-sm`, `--spacing-md`
- `--panel-bg-color`
- `--border-radius-sm`, `--border-radius-md`, `--border-radius-lg`
- `--shadow-lg`, `--shadow-xl`
- `--border-width`
- `--border-color-subtle`
- `--font-size-h3`, `--font-size-h4`, `--font-size-body`
- `--primary-text-color`, `--secondary-text-color`
- `--font-weight-semibold`
- `--accent-color-primary`, `--accent-color-focus-ring`
- `--error-text-color`, `--error-bg-color`

## Integration Requirements
After creating this file, it needs to be:
1. Imported in the main CSS bundle (usually `css/main.css` or similar)
2. Added to the CSS build process if applicable
3. Verified that all CSS custom properties are defined in the theme

## Testing Considerations
- Test on multiple screen sizes
- Verify animations work correctly
- Check high contrast mode
- Test with reduced motion preference
- Verify all hover/focus states
- Test on touch devices
- Check print styles

## Success Criteria
- [ ] All styles follow existing design system conventions
- [ ] Uses CSS custom properties for theming
- [ ] Responsive design works on all screen sizes
- [ ] Animations are smooth and performant
- [ ] Accessibility features are properly implemented
- [ ] Reduced motion preference is respected
- [ ] High contrast mode is supported
- [ ] Focus states are clearly visible
- [ ] No style conflicts with existing modal styles

## Notes
- This CSS file should be created before or alongside CLIPORMOD-001
- The HTML structure (CLIPORMOD-003) must match these class names
- Consider performance impact of animations on lower-end devices