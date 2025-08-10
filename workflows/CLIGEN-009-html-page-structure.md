# CLIGEN-009: HTML Page Structure & Layout

## Summary

Create the HTML page structure for the Clichés Generator, including semantic markup, responsive layout, accessibility features, and integration points for JavaScript functionality. The page follows existing character builder patterns for consistency.

## Status

- **Type**: Implementation
- **Priority**: Medium
- **Complexity**: Low
- **Estimated Time**: 4 hours
- **Dependencies**: None (can be developed in parallel)

## Objectives

### Primary Goals

1. **Create HTML Structure** - Semantic, accessible markup
2. **Responsive Layout** - Mobile-first design approach
3. **Form Controls** - Direction selector and generate button
4. **Display Areas** - Sections for direction info and clichés
5. **Loading States** - Skeleton screens and spinners
6. **Accessibility** - WCAG 2.1 AA compliance

### Success Criteria

- [ ] Valid HTML5 markup
- [ ] Responsive on all screen sizes
- [ ] Accessibility score > 95%
- [ ] All interactive elements keyboard accessible
- [ ] Proper ARIA labels and roles
- [ ] Semantic structure for screen readers
- [ ] Loading states implemented

## Technical Specification

### 1. Main HTML Page

#### File: `cliches-generator.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Generate common clichés and tropes to avoid for character development">
    <title>Clichés Generator - Living Narrative Engine</title>
    
    <!-- Styles -->
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/components.css">
    <link rel="stylesheet" href="css/character-builder.css">
    <link rel="stylesheet" href="css/cliches-generator.css">
    
    <!-- Preload critical resources -->
    <link rel="preload" href="cliches-generator.js" as="script">
    
    <!-- Favicon -->
    <link rel="icon" type="image/png" href="favicon.png">
</head>
<body>
    <!-- Skip to main content for accessibility -->
    <a href="#main-content" class="skip-link">Skip to main content</a>
    
    <div id="cliches-generator-container" class="cb-page-container">
        <!-- Header -->
        <header class="cb-page-header" role="banner">
            <div class="header-content">
                <h1 class="page-title">Clichés Generator</h1>
                <p class="page-subtitle">Identify overused tropes and stereotypes to avoid</p>
            </div>
            <nav class="header-nav" role="navigation" aria-label="Page navigation">
                <button 
                    id="back-to-menu-btn" 
                    class="nav-button"
                    aria-label="Return to character builder menu">
                    <svg class="icon" aria-hidden="true">
                        <use xlink:href="#icon-arrow-left"></use>
                    </svg>
                    <span>Back to Menu</span>
                </button>
            </nav>
        </header>

        <!-- Main Content -->
        <main id="main-content" class="cb-page-main cliches-generator-main" role="main">
            <!-- Left Panel: Input Section -->
            <section class="cb-input-panel" aria-labelledby="input-panel-heading">
                <h2 id="input-panel-heading" class="cb-panel-title">Direction Selection</h2>
                
                <form id="cliches-form" class="cb-form" novalidate>
                    <!-- Direction Selector -->
                    <div class="cb-form-group">
                        <label for="direction-selector" class="cb-label">
                            Select Thematic Direction
                            <span class="required" aria-label="required">*</span>
                        </label>
                        <select 
                            id="direction-selector" 
                            class="cb-select"
                            required
                            aria-required="true"
                            aria-describedby="direction-help">
                            <option value="">-- Choose a thematic direction --</option>
                            <!-- Options populated dynamically -->
                        </select>
                        <span id="direction-help" class="cb-help-text">
                            Select a thematic direction to view or generate clichés
                        </span>
                    </div>

                    <!-- Selected Direction Display -->
                    <div id="selected-direction-display" class="info-display" style="display: none;">
                        <h3 class="info-title">Selected Direction</h3>
                        <div id="direction-content" class="info-content">
                            <!-- Direction details populated dynamically -->
                        </div>
                        <div id="direction-meta" class="info-meta">
                            <!-- Metadata populated dynamically -->
                        </div>
                    </div>

                    <!-- Original Concept Display -->
                    <div id="original-concept-display" class="info-display" style="display: none;">
                        <h3 class="info-title">Original Concept</h3>
                        <div id="concept-content" class="info-content">
                            <!-- Concept text populated dynamically -->
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="cb-button-group">
                        <button 
                            type="submit" 
                            id="generate-btn" 
                            class="cb-button cb-button-primary"
                            disabled
                            aria-disabled="true">
                            <span class="button-text">Generate Clichés</span>
                            <span class="button-spinner" style="display: none;">
                                <svg class="spinner" aria-hidden="true">
                                    <use xlink:href="#icon-spinner"></use>
                                </svg>
                            </span>
                        </button>
                    </div>
                </form>

                <!-- Status Messages -->
                <div id="status-messages" class="cb-messages" role="status" aria-live="polite">
                    <!-- Messages populated dynamically -->
                </div>
            </section>

            <!-- Right Panel: Results Section -->
            <section class="cb-results-panel" aria-labelledby="results-panel-heading">
                <h2 id="results-panel-heading" class="cb-panel-title">Generated Clichés</h2>
                
                <div id="cliches-container" class="cb-state-container">
                    <!-- Empty State (default) -->
                    <div class="cb-empty-state" id="empty-state">
                        <svg class="empty-icon" aria-hidden="true">
                            <use xlink:href="#icon-document"></use>
                        </svg>
                        <h3 class="empty-title">No Clichés Generated</h3>
                        <p class="empty-description">
                            Select a thematic direction and click "Generate Clichés" to identify common tropes to avoid.
                        </p>
                    </div>

                    <!-- Loading State -->
                    <div class="cb-loading-state" id="loading-state" style="display: none;">
                        <div class="skeleton-loader">
                            <div class="skeleton-category">
                                <div class="skeleton-title"></div>
                                <div class="skeleton-item"></div>
                                <div class="skeleton-item"></div>
                                <div class="skeleton-item"></div>
                            </div>
                            <div class="skeleton-category">
                                <div class="skeleton-title"></div>
                                <div class="skeleton-item"></div>
                                <div class="skeleton-item"></div>
                            </div>
                        </div>
                        <p class="loading-message">Generating clichés...</p>
                    </div>

                    <!-- Results State -->
                    <div class="cb-results-state" id="results-state" style="display: none;">
                        <!-- Clichés will be populated here dynamically -->
                    </div>

                    <!-- Error State -->
                    <div class="cb-error-state" id="error-state" style="display: none;">
                        <svg class="error-icon" aria-hidden="true">
                            <use xlink:href="#icon-alert"></use>
                        </svg>
                        <h3 class="error-title">Generation Failed</h3>
                        <p class="error-description" id="error-message">
                            <!-- Error message populated dynamically -->
                        </p>
                        <button 
                            id="retry-btn" 
                            class="cb-button cb-button-secondary">
                            Try Again
                        </button>
                    </div>
                </div>
            </section>
        </main>

        <!-- Footer -->
        <footer class="cb-page-footer" role="contentinfo">
            <div class="footer-content">
                <p class="footer-text">Living Narrative Engine - Character Builder</p>
                <p class="footer-version">Version 1.0.0</p>
            </div>
        </footer>
    </div>

    <!-- Loading Overlay -->
    <div id="loading-overlay" class="loading-overlay" style="display: none;" role="status" aria-live="assertive">
        <div class="loading-content">
            <div class="spinner-large"></div>
            <p class="loading-text" id="loading-text">Loading...</p>
        </div>
    </div>

    <!-- Icon Sprites (SVG) -->
    <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
        <symbol id="icon-arrow-left" viewBox="0 0 24 24">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </symbol>
        <symbol id="icon-spinner" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="60" stroke-linecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </circle>
        </symbol>
        <symbol id="icon-document" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </symbol>
        <symbol id="icon-alert" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </symbol>
    </svg>

    <!-- Scripts -->
    <script src="cliches-generator.js" defer></script>
</body>
</html>
```

### 2. Cliché Results Template

#### Template for Dynamic Rendering

```html
<!-- Template for Cliché Category -->
<template id="cliche-category-template">
    <article class="cliche-category" data-category="">
        <header class="category-header">
            <h3 class="category-title"></h3>
            <span class="category-count" aria-label="Number of items"></span>
        </header>
        <ul class="cliche-list" role="list">
            <!-- Items will be added here -->
        </ul>
    </article>
</template>

<!-- Template for Cliché Item -->
<template id="cliche-item-template">
    <li class="cliche-item" role="listitem">
        <span class="item-text"></span>
    </li>
</template>

<!-- Template for Tropes Section -->
<template id="tropes-section-template">
    <section class="tropes-section" aria-labelledby="tropes-heading">
        <h3 id="tropes-heading" class="tropes-title">Overall Tropes & Stereotypes</h3>
        <ul class="tropes-list" role="list">
            <!-- Tropes will be added here -->
        </ul>
    </section>
</template>
```

### 3. Mobile-Responsive Structure

```html
<!-- Add viewport meta and responsive containers -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">

<!-- Mobile Navigation -->
<button 
    id="mobile-menu-toggle" 
    class="mobile-menu-toggle"
    aria-label="Toggle navigation menu"
    aria-expanded="false"
    style="display: none;">
    <span class="hamburger"></span>
</button>

<!-- Responsive Grid Layout -->
<style>
@media (max-width: 768px) {
    .cliches-generator-main {
        grid-template-columns: 1fr;
    }
    
    .cb-input-panel,
    .cb-results-panel {
        width: 100%;
    }
    
    .mobile-menu-toggle {
        display: block;
    }
}
</style>
```

### 4. Accessibility Features

```html
<!-- Screen Reader Announcements -->
<div class="sr-only" aria-live="polite" aria-atomic="true">
    <span id="sr-announcements"></span>
</div>

<!-- Focus Management -->
<script>
// Trap focus in modals
function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    lastFocusable.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    firstFocusable.focus();
                    e.preventDefault();
                }
            }
        }
    });
}
</script>

<!-- Keyboard Navigation -->
<script>
// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Alt + G: Focus generate button
    if (e.altKey && e.key === 'g') {
        document.getElementById('generate-btn')?.focus();
    }
    
    // Alt + S: Focus selector
    if (e.altKey && e.key === 's') {
        document.getElementById('direction-selector')?.focus();
    }
    
    // Escape: Close overlay
    if (e.key === 'Escape') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay.style.display !== 'none') {
            overlay.style.display = 'none';
        }
    }
});
</script>
```

## Implementation Tasks

### Phase 1: Base Structure (1 hour)

1. **Create HTML file**
   - [ ] DOCTYPE and metadata
   - [ ] Head section with resources
   - [ ] Body structure

2. **Add semantic markup**
   - [ ] Header, main, footer
   - [ ] Sections with labels
   - [ ] Proper heading hierarchy

### Phase 2: Form Elements (1 hour)

1. **Create form structure**
   - [ ] Direction selector
   - [ ] Generate button
   - [ ] Form validation attributes

2. **Add display areas**
   - [ ] Direction display
   - [ ] Concept display
   - [ ] Status messages

### Phase 3: Results Area (1 hour)

1. **Create state containers**
   - [ ] Empty state
   - [ ] Loading state
   - [ ] Results state
   - [ ] Error state

2. **Add templates**
   - [ ] Category template
   - [ ] Item template
   - [ ] Tropes template

### Phase 4: Accessibility (1 hour)

1. **Add ARIA attributes**
   - [ ] Roles and labels
   - [ ] Live regions
   - [ ] Descriptions

2. **Implement keyboard support**
   - [ ] Tab order
   - [ ] Focus management
   - [ ] Keyboard shortcuts

## Testing Requirements

### HTML Validation

```bash
# W3C HTML Validator
npx html-validate cliches-generator.html

# Expected output: No errors, warnings acceptable
```

### Accessibility Testing

```javascript
// Using axe-core
describe('Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const results = await axe.run(document.getElementById('cliches-generator-container'));
    expect(results.violations).toHaveLength(0);
  });
  
  it('should have proper heading hierarchy', () => {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    // Verify proper nesting
  });
  
  it('should have alt text for images', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      expect(img.hasAttribute('alt')).toBe(true);
    });
  });
});
```

### Responsive Testing

```javascript
// Test different viewports
const viewports = [
  { width: 320, height: 568 },  // Mobile
  { width: 768, height: 1024 }, // Tablet
  { width: 1920, height: 1080 } // Desktop
];

viewports.forEach(viewport => {
  describe(`Viewport ${viewport.width}x${viewport.height}`, () => {
    beforeEach(() => {
      window.innerWidth = viewport.width;
      window.innerHeight = viewport.height;
    });
    
    it('should display correctly', () => {
      // Test layout
    });
  });
});
```

## Acceptance Criteria

- [ ] Valid HTML5 markup
- [ ] Responsive on all devices
- [ ] WCAG 2.1 AA compliant
- [ ] All states implemented
- [ ] Keyboard navigable
- [ ] Screen reader friendly
- [ ] Performance optimized

## Definition of Done

- [ ] HTML implemented per specification
- [ ] Validation passing
- [ ] Accessibility audit passing
- [ ] Responsive testing complete
- [ ] Cross-browser tested
- [ ] Code reviewed
- [ ] Documentation updated