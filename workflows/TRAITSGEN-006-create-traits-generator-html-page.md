# TRAITSGEN-006: Create Traits Generator HTML Page

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: UI/Frontend
- **Priority**: High
- **Estimated Effort**: 1.5 days
- **Dependencies**: TRAITSGEN-005 (Controller Implementation)

## Description
Create the main HTML page for traits generation with comprehensive UI layout, form controls, and results display. This page follows established character-builder patterns while implementing traits-specific requirements.

## Requirements

### File Creation
- **File**: `traits-generator.html`
- **Template**: Use `thematic-direction-generator.html` as structural base
- **Location**: Root directory (same level as other character-builder pages)

### Page Structure Requirements
Based on specification, implement these required sections:

#### 1. Header Section
```html
<header class="character-builder-header">
  <nav class="breadcrumb-nav" aria-label="Navigation breadcrumbs">
    <a href="index.html">Home</a> > 
    <a href="#character-builders">Character Builders</a> > 
    <span aria-current="page">Traits Generator</span>
  </nav>
  <h1>Character Traits Generator</h1>
  <p class="page-description">
    Generate detailed character traits based on core motivations, thematic directions, and cliché avoidance.
  </p>
</header>
```

#### 2. Left Panel - Selection Interface
```html
<section class="left-panel selection-interface" aria-label="Selection controls">
  <!-- Thematic Direction Selector -->
  <div class="form-group">
    <label for="direction-selector">Thematic Direction:</label>
    <select id="direction-selector" class="direction-selector" aria-describedby="direction-help">
      <option value="">Select a thematic direction...</option>
      <!-- Options populated by controller -->
    </select>
    <small id="direction-help" class="help-text">
      Only directions with both clichés and core motivations are shown.
    </small>
  </div>

  <!-- User Input Fields (all required) -->
  <fieldset class="user-inputs" id="user-inputs-fieldset" disabled>
    <legend>User Inputs (All Required)</legend>
    
    <div class="form-group">
      <label for="core-motivation-input">Core Motivation *</label>
      <textarea 
        id="core-motivation-input" 
        class="user-input-field" 
        rows="3" 
        placeholder="Enter the character's core motivation..."
        aria-describedby="core-motivation-help"
        required></textarea>
      <small id="core-motivation-help" class="help-text">
        What drives this character at their core?
      </small>
    </div>
    
    <div class="form-group">
      <label for="internal-contradiction-input">Internal Contradiction *</label>
      <textarea 
        id="internal-contradiction-input" 
        class="user-input-field" 
        rows="3" 
        placeholder="Enter the character's internal contradiction..."
        aria-describedby="contradiction-help"
        required></textarea>
      <small id="contradiction-help" class="help-text">
        What internal conflict makes this character complex?
      </small>
    </div>
    
    <div class="form-group">
      <label for="central-question-input">Central Question *</label>
      <textarea 
        id="central-question-input" 
        class="user-input-field" 
        rows="3" 
        placeholder="Enter the character's central question..."
        aria-describedby="question-help"
        required></textarea>
      <small id="question-help" class="help-text">
        What fundamental question does this character grapple with?
      </small>
    </div>
  </fieldset>

  <!-- Generate Button -->
  <div class="action-buttons">
    <button id="generate-button" class="btn btn-primary generate-btn" disabled>
      <span class="btn-text">Generate Traits</span>
      <span class="btn-icon" aria-hidden="true">✨</span>
    </button>
    <button id="clear-button" class="btn btn-secondary clear-btn">
      <span class="btn-text">Clear</span>
      <span class="btn-icon" aria-hidden="true">🗑️</span>
    </button>
  </div>
</section>
```

#### 3. Right Panel - Context Display
```html
<section class="right-panel context-display" aria-label="Context information">
  <!-- Core Motivations Panel (Read-only) -->
  <div class="core-motivations-panel">
    <h3>Associated Core Motivations</h3>
    <div id="core-motivations-list" class="core-motivations-list scrollable-content">
      <p class="empty-state" id="core-motivations-empty">
        Select a thematic direction to view associated core motivations.
      </p>
      <!-- Core motivations populated by controller -->
    </div>
  </div>

  <!-- User Input Summary Panel -->
  <div class="user-input-panel">
    <h3>Your Input Summary</h3>
    <div id="user-input-summary" class="user-input-summary">
      <div class="summary-item">
        <strong>Core Motivation:</strong>
        <span id="summary-core-motivation" class="summary-value">Not entered</span>
      </div>
      <div class="summary-item">
        <strong>Internal Contradiction:</strong>
        <span id="summary-contradiction" class="summary-value">Not entered</span>
      </div>
      <div class="summary-item">
        <strong>Central Question:</strong>
        <span id="summary-question" class="summary-value">Not entered</span>
      </div>
    </div>
  </div>
</section>
```

#### 4. Main Content - Results Container
```html
<main class="main-content" aria-label="Generated traits">
  <!-- Loading State -->
  <div id="loading-container" class="loading-container" hidden>
    <div class="loading-spinner" aria-hidden="true"></div>
    <div class="loading-message" id="loading-message">
      Generating character traits...
    </div>
  </div>

  <!-- Error State -->
  <div id="error-container" class="error-container" role="alert" hidden>
    <div class="error-icon" aria-hidden="true">⚠️</div>
    <div class="error-content">
      <h3 class="error-title">Generation Failed</h3>
      <p class="error-message" id="error-message">
        <!-- Error message populated by controller -->
      </p>
      <div class="error-actions">
        <button id="retry-button" class="btn btn-primary">Retry</button>
        <button id="error-clear-button" class="btn btn-secondary">Clear</button>
      </div>
    </div>
  </div>

  <!-- Results Display -->
  <div id="results-container" class="results-container" hidden>
    <div class="results-header">
      <h2>Generated Character Traits</h2>
      <div class="results-actions">
        <button id="export-button" class="btn btn-success export-btn">
          <span class="btn-text">Export to Text</span>
          <span class="btn-icon" aria-hidden="true">📄</span>
        </button>
        <button id="generate-more-button" class="btn btn-secondary">
          Generate Different Traits
        </button>
      </div>
    </div>

    <!-- Trait Categories Display -->
    <div class="traits-display" id="traits-display">
      <!-- Names Section -->
      <section class="trait-section names-section" id="names-section">
        <h3 class="section-title">Names</h3>
        <div class="trait-content" id="names-content">
          <!-- Populated by controller -->
        </div>
      </section>

      <!-- Physical Description Section -->
      <section class="trait-section physical-section" id="physical-section">
        <h3 class="section-title">Physical Description</h3>
        <div class="trait-content" id="physical-content">
          <!-- Populated by controller -->
        </div>
      </section>

      <!-- Personality Section -->
      <section class="trait-section personality-section" id="personality-section">
        <h3 class="section-title">Personality</h3>
        <div class="trait-content" id="personality-content">
          <!-- Populated by controller -->
        </div>
      </section>

      <!-- Strengths & Weaknesses Section -->
      <section class="trait-section strengths-weaknesses-section" id="strengths-weaknesses-section">
        <h3 class="section-title">Strengths & Weaknesses</h3>
        <div class="trait-content two-column" id="strengths-weaknesses-content">
          <div class="column">
            <h4>Strengths</h4>
            <div id="strengths-content"><!-- Populated by controller --></div>
          </div>
          <div class="column">
            <h4>Weaknesses</h4>
            <div id="weaknesses-content"><!-- Populated by controller --></div>
          </div>
        </div>
      </section>

      <!-- Likes & Dislikes Section -->
      <section class="trait-section likes-dislikes-section" id="likes-dislikes-section">
        <h3 class="section-title">Likes & Dislikes</h3>
        <div class="trait-content two-column" id="likes-dislikes-content">
          <div class="column">
            <h4>Likes</h4>
            <div id="likes-content"><!-- Populated by controller --></div>
          </div>
          <div class="column">
            <h4>Dislikes</h4>
            <div id="dislikes-content"><!-- Populated by controller --></div>
          </div>
        </div>
      </section>

      <!-- Fears Section -->
      <section class="trait-section fears-section" id="fears-section">
        <h3 class="section-title">Fears</h3>
        <div class="trait-content" id="fears-content">
          <!-- Populated by controller -->
        </div>
      </section>

      <!-- Goals Section -->
      <section class="trait-section goals-section" id="goals-section">
        <h3 class="section-title">Goals</h3>
        <div class="trait-content" id="goals-content">
          <!-- Populated by controller -->
        </div>
      </section>

      <!-- Notes Section -->
      <section class="trait-section notes-section" id="notes-section">
        <h3 class="section-title">Notes</h3>
        <div class="trait-content" id="notes-content">
          <!-- Populated by controller -->
        </div>
      </section>

      <!-- Profile Section -->
      <section class="trait-section profile-section" id="profile-section">
        <h3 class="section-title">Profile</h3>
        <div class="trait-content" id="profile-content">
          <!-- Populated by controller -->
        </div>
      </section>

      <!-- Secrets Section -->
      <section class="trait-section secrets-section" id="secrets-section">
        <h3 class="section-title">Secrets</h3>
        <div class="trait-content" id="secrets-content">
          <!-- Populated by controller -->
        </div>
      </section>
    </div>
  </div>
</main>
```

#### 5. Footer Section
```html
<footer class="character-builder-footer">
  <div class="keyboard-shortcuts">
    <h4>Keyboard Shortcuts</h4>
    <ul>
      <li><kbd>Ctrl</kbd> + <kbd>Enter</kbd>: Generate traits</li>
      <li><kbd>Ctrl</kbd> + <kbd>E</kbd>: Export to text</li>
      <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Del</kbd>: Clear all</li>
    </ul>
  </div>
  
  <div class="export-info">
    <h4>Export & Usage</h4>
    <p>Traits are exported as text files for your use. Create JSON files manually for game integration.</p>
  </div>
</footer>
```

### CSS Styling Requirements

#### Integration with Existing Styles
- **Base Styles**: Use existing character-builder CSS framework
- **Consistent Theming**: Match other generator pages exactly
- **Responsive Design**: Mobile-first responsive layout
- **Accessibility**: High contrast, focus indicators, proper spacing

#### Traits-Specific Styling
```css
/* Trait section styling */
.trait-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: var(--card-background);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
}

.trait-section .section-title {
  color: var(--primary-color);
  border-bottom: 2px solid var(--accent-color);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

@media (max-width: 768px) {
  .two-column {
    grid-template-columns: 1fr;
  }
}
```

### Accessibility Implementation

#### ARIA Support
- **Labels**: Proper aria-label and aria-describedby for all form elements
- **Live Regions**: aria-live regions for dynamic content updates
- **Roles**: Appropriate ARIA roles for custom elements
- **States**: aria-expanded, aria-selected for interactive elements

#### Keyboard Navigation
- **Tab Order**: Logical tab order through all interactive elements
- **Focus Management**: Clear focus indicators and proper focus handling
- **Shortcuts**: Keyboard shortcuts as specified in requirements

#### Screen Reader Support
- **Announcements**: Important state changes announced
- **Structure**: Proper heading hierarchy for screen reader navigation
- **Alternative Text**: Appropriate alt text for icons and images

### Layout Structure
- **Left Panel**: 30% width on desktop, full width on mobile
- **Right Panel**: 25% width on desktop, full width on mobile  
- **Main Content**: 45% width on desktop, full width on mobile
- **Responsive Breakpoints**: 768px for mobile, 1024px for tablet

### Integration with Index Page

#### Button Addition
Add new button to `index.html` immediately after core-motivations-generator button:

```html
<a href="traits-generator.html" class="generator-card traits-generator-card">
  <div class="card-icon">🎭</div>
  <div class="card-content">
    <h3>Traits Generator</h3>
    <p>Generate comprehensive character traits based on core motivations and thematic directions.</p>
  </div>
  <div class="card-status">
    <span class="status-badge new">New</span>
  </div>
</a>
```

## Technical Implementation

### JavaScript Integration
- **Script Loading**: Include traits-generator bundle from build process
- **Controller Initialization**: Initialize TraitsGeneratorController on page load
- **Dependency Resolution**: Use dependency injection container for service resolution

### Performance Considerations
- **Lazy Loading**: Load heavy resources only when needed
- **Progressive Enhancement**: Basic functionality works without JavaScript
- **Caching**: Utilize browser caching for static assets

### Error Handling
- **Graceful Degradation**: Fallback for JavaScript failures
- **User Feedback**: Clear error messages for all failure scenarios
- **Recovery Options**: Allow users to recover from errors

## Acceptance Criteria

### Layout Requirements
- [ ] Page structure matches specification exactly
- [ ] Left panel contains direction selector and user input fields
- [ ] Right panel displays core motivations and user input summary
- [ ] Main content area handles loading, error, and results states
- [ ] Footer includes keyboard shortcuts and export information

### Functionality Requirements
- [ ] All form fields properly labeled and accessible
- [ ] Direction selector populated with eligible directions only
- [ ] User input validation feedback displayed in real-time
- [ ] All 12 trait categories have dedicated display sections
- [ ] Export functionality accessible and working
- [ ] Clear/reset functionality resets entire form state

### Styling Requirements
- [ ] Consistent with existing character-builder pages
- [ ] Responsive design works on all screen sizes
- [ ] High contrast support for accessibility
- [ ] Proper focus indicators for keyboard navigation
- [ ] Loading and error states visually distinct

### Accessibility Requirements
- [ ] WCAG 2.1 AA compliance achieved
- [ ] Screen reader navigation works properly
- [ ] Keyboard shortcuts function as specified
- [ ] All interactive elements properly labeled
- [ ] Dynamic content updates announced to screen readers

### Integration Requirements
- [ ] Button added to index.html in correct position
- [ ] Page loads and initializes without errors
- [ ] CSS integrates seamlessly with existing styles
- [ ] JavaScript bundle loads and executes properly

## Files Modified
- **NEW**: `traits-generator.html`
- **MODIFIED**: `index.html` (add navigation button)
- **REVIEW**: Existing CSS files for style integration

## Dependencies For Next Tickets
This HTML page is required for:
- TRAITSGEN-008 (Build Configuration)
- TRAITSGEN-009 (Integration Testing)

## Notes
- Use thematic-direction-generator.html as primary template
- Ensure all 12 trait categories have proper display sections
- Pay special attention to accessibility requirements
- Maintain consistent styling with other character-builder pages
- Test responsive design thoroughly on multiple screen sizes