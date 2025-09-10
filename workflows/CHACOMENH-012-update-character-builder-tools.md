# CHACOMENH-012: Update Character Builder Tools

**Phase**: Documentation & Tools  
**Priority**: Low  
**Complexity**: High  
**Dependencies**: CHACOMENH-001 through CHACOMENH-006  
**Estimated Time**: 6-8 hours

## Summary

Update the existing character builder tools to support the three new psychological components. This includes modifying the Core Motivations Generator and potentially other character creation tools to integrate with the new component system, providing UI elements for editing these components, and ensuring proper data persistence.

## Background

The Living Narrative Engine includes several character builder tools accessible from the main index. The Core Motivations Generator already exists but may need updates to align with the new standardized components. Other tools may also benefit from integration with the psychological components system.

## Technical Requirements

### Tools to Update

1. **Core Motivations Generator** (`/core-motivations-generator.html`)
   - Already generates psychological profiles
   - Needs integration with new component format
   - Should save directly to component structure

2. **Character Concepts Manager** (if exists)
   - Add UI for psychological components
   - Enable editing and preview

3. **Other Character Tools**
   - Assess which tools need updates
   - Maintain backward compatibility

### Implementation Approach

The update should:

- Add form fields for each psychological component
- Provide guided input with examples
- Include validation for component data
- Support import/export in component format
- Integrate with existing save/load functionality

## Implementation Details

### 1. Update Core Motivations Generator

#### Modify HTML Structure

Update `core-motivations-generator.html`:

```html
<!-- Add new section for component-based input -->
<div class="component-editor-section">
  <h2>Psychological Components Editor</h2>

  <!-- Motivations Component -->
  <div class="component-field">
    <label for="motivations-input">
      <h3>Core Motivations</h3>
      <p class="field-description">
        WHY does this character act? What psychological drivers explain their
        behavior? Write in first-person perspective.
      </p>
    </label>
    <textarea
      id="motivations-input"
      class="component-textarea"
      placeholder="Example: I seek power because I fear being powerless again. Every achievement is armor against vulnerability..."
      rows="6"
      maxlength="500"
    ></textarea>
    <div class="character-count">
      <span id="motivations-count">0</span>/500 characters
    </div>
  </div>

  <!-- Internal Tensions Component -->
  <div class="component-field">
    <label for="tensions-input">
      <h3>Internal Tensions</h3>
      <p class="field-description">
        What conflicting desires create complexity? Express contradictions using
        "but," "yet," or "however."
      </p>
    </label>
    <textarea
      id="tensions-input"
      class="component-textarea"
      placeholder="Example: I want to trust others, yet everyone I've trusted has betrayed me..."
      rows="5"
      maxlength="400"
    ></textarea>
    <div class="character-count">
      <span id="tensions-count">0</span>/400 characters
    </div>
  </div>

  <!-- Core Dilemmas Component -->
  <div class="component-field">
    <label for="dilemmas-input">
      <h3>Core Dilemmas</h3>
      <p class="field-description">
        What fundamental questions does this character grapple with? Must be
        phrased as questions.
      </p>
    </label>
    <textarea
      id="dilemmas-input"
      class="component-textarea"
      placeholder="Example: Can I achieve justice without becoming a monster? Is redemption possible for someone like me?"
      rows="4"
      maxlength="300"
    ></textarea>
    <div class="character-count">
      <span id="dilemmas-count">0</span>/300 characters
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="component-actions">
    <button id="generate-from-ai" class="primary-button">
      Generate with AI
    </button>
    <button id="save-components" class="secondary-button">
      Save Components
    </button>
    <button id="export-json" class="secondary-button">Export as JSON</button>
    <button id="import-json" class="secondary-button">Import JSON</button>
  </div>
</div>

<!-- Template Selector -->
<div class="template-section">
  <h3>Character Templates</h3>
  <select id="template-selector">
    <option value="">-- Select Template --</option>
    <option value="reluctant-leader">Reluctant Leader</option>
    <option value="reformed-villain">Reformed Villain</option>
    <option value="idealistic-revolutionary">Idealistic Revolutionary</option>
    <option value="tragic-hero">Tragic Hero</option>
    <option value="cynical-mentor">Cynical Mentor</option>
  </select>
  <button id="apply-template">Apply Template</button>
</div>
```

#### Update JavaScript Logic

Modify `src/core-motivations-generator-main.js`:

```javascript
// Component management class
class PsychologicalComponentManager {
  constructor() {
    this.components = {
      motivations: '',
      internalTensions: '',
      coreDilemmas: '',
    };
    this.initializeEventListeners();
    this.loadSavedComponents();
  }

  initializeEventListeners() {
    // Character count updates
    document
      .getElementById('motivations-input')
      .addEventListener('input', (e) => {
        this.updateCharacterCount('motivations', e.target.value);
        this.components.motivations = e.target.value;
      });

    document.getElementById('tensions-input').addEventListener('input', (e) => {
      this.updateCharacterCount('tensions', e.target.value);
      this.components.internalTensions = e.target.value;
    });

    document.getElementById('dilemmas-input').addEventListener('input', (e) => {
      this.updateCharacterCount('dilemmas', e.target.value);
      this.components.coreDilemmas = e.target.value;
    });

    // Action buttons
    document
      .getElementById('generate-from-ai')
      .addEventListener('click', () => {
        this.generateWithAI();
      });

    document.getElementById('save-components').addEventListener('click', () => {
      this.saveComponents();
    });

    document.getElementById('export-json').addEventListener('click', () => {
      this.exportAsJSON();
    });

    document.getElementById('import-json').addEventListener('click', () => {
      this.importFromJSON();
    });

    // Template selector
    document.getElementById('apply-template').addEventListener('click', () => {
      this.applyTemplate();
    });
  }

  updateCharacterCount(field, value) {
    const countElement = document.getElementById(`${field}-count`);
    countElement.textContent = value.length;

    // Add warning class if near limit
    const maxLength = this.getMaxLength(field);
    if (value.length > maxLength * 0.9) {
      countElement.classList.add('warning');
    } else {
      countElement.classList.remove('warning');
    }
  }

  getMaxLength(field) {
    const maxLengths = {
      motivations: 500,
      tensions: 400,
      dilemmas: 300,
    };
    return maxLengths[field] || 500;
  }

  async generateWithAI() {
    // Get context from other fields if available
    const context = this.gatherContext();

    try {
      const response = await this.callAIService(context);
      this.populateComponents(response);
    } catch (error) {
      console.error('AI generation failed:', error);
      this.showError('Failed to generate components. Please try again.');
    }
  }

  gatherContext() {
    // Collect any existing character data for context
    return {
      name: document.getElementById('character-name')?.value || '',
      description:
        document.getElementById('character-description')?.value || '',
      background: document.getElementById('character-background')?.value || '',
      // Add other relevant fields
    };
  }

  async callAIService(context) {
    // Call to LLM proxy service
    const prompt = this.buildPrompt(context);

    const response = await fetch('/llm-proxy/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error('AI service error');
    }

    return response.json();
  }

  buildPrompt(context) {
    return `Generate psychological components for a character with the following context:
    ${JSON.stringify(context, null, 2)}
    
    Provide:
    1. Core Motivations (first-person, explaining WHY they act)
    2. Internal Tensions (conflicting desires with "but" or "yet")
    3. Core Dilemmas (fundamental questions they face)
    
    Format as JSON with keys: motivations, internalTensions, coreDilemmas`;
  }

  populateComponents(aiResponse) {
    if (aiResponse.motivations) {
      document.getElementById('motivations-input').value =
        aiResponse.motivations;
      this.components.motivations = aiResponse.motivations;
      this.updateCharacterCount('motivations', aiResponse.motivations);
    }

    if (aiResponse.internalTensions) {
      document.getElementById('tensions-input').value =
        aiResponse.internalTensions;
      this.components.internalTensions = aiResponse.internalTensions;
      this.updateCharacterCount('tensions', aiResponse.internalTensions);
    }

    if (aiResponse.coreDilemmas) {
      document.getElementById('dilemmas-input').value = aiResponse.coreDilemmas;
      this.components.coreDilemmas = aiResponse.coreDilemmas;
      this.updateCharacterCount('dilemmas', aiResponse.coreDilemmas);
    }
  }

  saveComponents() {
    // Save to localStorage
    localStorage.setItem(
      'psychological-components',
      JSON.stringify(this.components)
    );

    // Also save to character data if character system is active
    if (window.characterManager) {
      window.characterManager.updatePsychologicalComponents(this.components);
    }

    this.showSuccess('Components saved successfully!');
  }

  exportAsJSON() {
    const exportData = {
      components: {
        'core:motivations': { text: this.components.motivations },
        'core:internal_tensions': { text: this.components.internalTensions },
        'core:core_dilemmas': { text: this.components.coreDilemmas },
      },
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psychological-components-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.components) {
          this.importComponents(data.components);
        }
      } catch (error) {
        console.error('Import failed:', error);
        this.showError('Failed to import JSON. Please check the file format.');
      }
    };

    input.click();
  }

  importComponents(components) {
    if (components['core:motivations']?.text) {
      this.components.motivations = components['core:motivations'].text;
      document.getElementById('motivations-input').value =
        this.components.motivations;
      this.updateCharacterCount('motivations', this.components.motivations);
    }

    if (components['core:internal_tensions']?.text) {
      this.components.internalTensions =
        components['core:internal_tensions'].text;
      document.getElementById('tensions-input').value =
        this.components.internalTensions;
      this.updateCharacterCount('tensions', this.components.internalTensions);
    }

    if (components['core:core_dilemmas']?.text) {
      this.components.coreDilemmas = components['core:core_dilemmas'].text;
      document.getElementById('dilemmas-input').value =
        this.components.coreDilemmas;
      this.updateCharacterCount('dilemmas', this.components.coreDilemmas);
    }

    this.showSuccess('Components imported successfully!');
  }

  applyTemplate() {
    const templateId = document.getElementById('template-selector').value;
    if (!templateId) return;

    const template = this.getTemplate(templateId);
    if (template) {
      this.populateComponents(template);
      this.showSuccess(`Template "${templateId}" applied!`);
    }
  }

  getTemplate(templateId) {
    const templates = {
      'reluctant-leader': {
        motivations:
          "I never wanted power, but I've seen what happens when the wrong people wield it. I lead not from ambition but from a crushing sense of responsibility.",
        internalTensions:
          'I want to inspire others, yet I doubt every decision I make. I project confidence while drowning in uncertainty.',
        coreDilemmas:
          'Do people follow me or the image I present? If leadership requires deception, am I still worthy of trust?',
      },
      'reformed-villain': {
        motivations:
          "Every good deed is penance for the monster I was. I save others because I couldn't save myself from becoming what I hated.",
        internalTensions:
          "I want redemption but believe I don't deserve it. I help others while hating myself for needing their gratitude.",
        coreDilemmas:
          'Can evil acts ever truly be atoned for? Am I doing good for others or just to ease my own guilt?',
      },
      // Add more templates...
    };

    return templates[templateId];
  }

  loadSavedComponents() {
    const saved = localStorage.getItem('psychological-components');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.components = data;
        this.populateComponents(data);
      } catch (error) {
        console.error('Failed to load saved components:', error);
      }
    }
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  window.psychComponentManager = new PsychologicalComponentManager();
});
```

### 2. Add Validation System

```javascript
class ComponentValidator {
  validateMotivations(text) {
    const errors = [];

    if (!text || text.trim().length === 0) {
      errors.push('Motivations cannot be empty');
    }

    if (text && text.length > 500) {
      errors.push('Motivations must be under 500 characters');
    }

    if (text && !this.isFirstPerson(text)) {
      errors.push('Motivations should be written in first person (I, me, my)');
    }

    return errors;
  }

  validateInternalTensions(text) {
    const errors = [];

    if (!text || text.trim().length === 0) {
      errors.push('Internal tensions cannot be empty');
    }

    if (text && !this.hasConflictWords(text)) {
      errors.push(
        'Internal tensions should express conflict (use "but", "yet", "however")'
      );
    }

    return errors;
  }

  validateCoreDilemmas(text) {
    const errors = [];

    if (!text || text.trim().length === 0) {
      errors.push('Core dilemmas cannot be empty');
    }

    if (text && !text.includes('?')) {
      errors.push('Core dilemmas must be phrased as questions');
    }

    return errors;
  }

  isFirstPerson(text) {
    const firstPersonWords = ['I', 'me', 'my', 'myself', "I've", "I'm", "I'll"];
    return firstPersonWords.some(
      (word) =>
        text.includes(word) || text.toLowerCase().includes(word.toLowerCase())
    );
  }

  hasConflictWords(text) {
    const conflictWords = [
      'but',
      'yet',
      'however',
      'although',
      'while',
      'despite',
    ];
    return conflictWords.some((word) => text.toLowerCase().includes(word));
  }
}
```

### 3. Add CSS Styling

```css
/* Component Editor Styles */
.component-editor-section {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.component-field {
  margin-bottom: 2rem;
}

.component-field h3 {
  color: #333;
  margin-bottom: 0.5rem;
}

.field-description {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.component-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
  resize: vertical;
}

.component-textarea:focus {
  outline: none;
  border-color: #4caf50;
}

.character-count {
  text-align: right;
  font-size: 0.85rem;
  color: #666;
  margin-top: 0.25rem;
}

.character-count .warning {
  color: #ff9800;
  font-weight: bold;
}

.component-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.primary-button {
  background: #4caf50;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.primary-button:hover {
  background: #45a049;
}

.secondary-button {
  background: #2196f3;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

.secondary-button:hover {
  background: #1976d2;
}

.template-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #ddd;
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 4px;
  color: white;
  font-weight: bold;
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

.notification.success {
  background: #4caf50;
}

.notification.error {
  background: #f44336;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Responsive Design */
@media (max-width: 768px) {
  .component-actions {
    flex-direction: column;
  }

  .component-editor-section {
    padding: 1rem;
  }
}
```

## Testing Requirements

### Functional Tests

- [ ] All three components can be entered manually
- [ ] Character counts update correctly
- [ ] Validation provides helpful feedback
- [ ] AI generation produces valid content
- [ ] Templates apply correctly
- [ ] Import/export works with proper format
- [ ] Save/load persistence functions

### Integration Tests

- [ ] Generated components match required format
- [ ] Exported JSON compatible with game engine
- [ ] Character builder integrates with main game
- [ ] Components appear in character prompts

### Accessibility Tests

- [ ] All form fields have proper labels
- [ ] Keyboard navigation works
- [ ] Screen readers can navigate
- [ ] Color contrast meets WCAG AA
- [ ] Error messages are announced

## Acceptance Criteria

- [ ] UI elements for all three components added
- [ ] Input validation implemented
- [ ] Character counting functional
- [ ] AI generation integrated
- [ ] Template system working
- [ ] Import/export functionality complete
- [ ] Save/load persistence working
- [ ] Responsive design implemented
- [ ] Accessibility standards met
- [ ] Documentation updated

## Rollback Plan

If issues arise:

1. Revert UI changes
2. Restore original generator files
3. Remove new dependencies
4. Clear localStorage data
5. Communicate changes to users

## Future Enhancements

Consider for future iterations:

- Rich text editing for formatting
- Component relationship visualization
- Collaborative editing features
- Version history tracking
- Advanced AI suggestions
- Component analytics
- Multi-language support

## Notes

- Maintain backward compatibility with existing tools
- Focus on user-friendly interface
- Provide clear guidance and examples
- Consider progressive enhancement approach
- Test with actual content creators

---

_Ticket created from character-components-analysis.md report_
