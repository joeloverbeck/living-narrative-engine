/**
 * @file Speech patterns generator controller for character building
 * @description Manages UI for speech pattern generation based on character definitions
 * @see BaseCharacterBuilderController.js
 */

import { BaseCharacterBuilderController } from './BaseCharacterBuilderController.js';
import { DomUtils } from '../../utils/domUtils.js';
import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';

/**
 * Controller for speech patterns generator interface
 * Handles character input validation, generation workflow, and results display
 */
export class SpeechPatternsGeneratorController extends BaseCharacterBuilderController {
  // Dependencies
  /** @private @type {SpeechPatternsDisplayEnhancer|null} */
  #displayEnhancer = null;

  /** @private @type {import('../services/SpeechPatternsGenerator.js').SpeechPatternsGenerator} */
  #speechPatternsGenerator;

  // UI State
  /** @private @type {object|null} */
  #characterDefinition = null;

  /** @private @type {Array<object>|null} */
  #lastGeneratedPatterns = null;

  /** @private @type {boolean} */
  #isGenerating = false;

  /** @private @type {AbortController|null} */
  #currentGenerationController = null;

  /**
   * Create a new SpeechPatternsGeneratorController instance
   *
   * @param {object} dependencies - Service dependencies
   */
  constructor(dependencies) {
    super(dependencies);

    // SpeechPatternsDisplayEnhancer is optional (will be created in SPEPATGEN-006)
    if (dependencies.speechPatternsDisplayEnhancer) {
      validateDependency(
        dependencies.speechPatternsDisplayEnhancer,
        'SpeechPatternsDisplayEnhancer',
        dependencies.logger,
        {
          requiredMethods: [
            'enhanceForDisplay',
            'formatForExport',
            'generateExportFilename',
          ],
        }
      );
      this.#displayEnhancer = dependencies.speechPatternsDisplayEnhancer;
    }

    // Get SpeechPatternsGenerator from container
    if (dependencies.speechPatternsGenerator) {
      validateDependency(
        dependencies.speechPatternsGenerator,
        'SpeechPatternsGenerator',
        dependencies.logger,
        {
          requiredMethods: ['generateSpeechPatterns', 'getServiceInfo'],
        }
      );
      this.#speechPatternsGenerator = dependencies.speechPatternsGenerator;
    } else {
      // Try to get from container if not explicitly passed
      if (dependencies.container) {
        try {
          this.#speechPatternsGenerator = dependencies.container.resolve(
            'SpeechPatternsGenerator'
          );
        } catch (error) {
          dependencies.logger?.warn(
            'SpeechPatternsGenerator not available:',
            error.message
          );
        }
      }
    }
  }

  /**
   * Cache DOM elements specific to speech patterns generation
   *
   * @protected
   */
  _cacheElements() {
    this._cacheElementsFromMap({
      // Input elements
      characterDefinition: '#character-definition',
      characterInputError: '#character-input-error',

      // Controls
      generateBtn: '#generate-btn',
      exportBtn: '#export-btn',
      clearBtn: '#clear-all-btn',
      backBtn: '#back-btn',

      // Display elements
      speechPatternsContainer: '#speech-patterns-container',
      loadingIndicator: '#loading-indicator',
      loadingMessage: '#loading-message',
      emptyState: '#empty-state',
      patternCount: '#pattern-count',

      // Screen reader support
      screenReaderAnnouncement: {
        selector: '#screen-reader-announcement',
        required: false,
      },
    });
  }

  /**
   * Set up event listeners for speech patterns generation UI
   *
   * @protected
   */
  _setupEventListeners() {
    // Character input validation
    if (this._getElement('characterDefinition')) {
      this._addEventListener('characterDefinition', 'input', () => {
        this.#handleCharacterInput();
      });

      this._addEventListener('characterDefinition', 'blur', () => {
        this.#validateCharacterInput();
      });
    }

    // Generate button
    if (this._getElement('generateBtn')) {
      this._addEventListener('generateBtn', 'click', () => {
        this.#generateSpeechPatterns();
      });
    }

    // Export button
    if (this._getElement('exportBtn')) {
      this._addEventListener('exportBtn', 'click', () => {
        this.#exportToText();
      });
    }

    // Clear button
    if (this._getElement('clearBtn')) {
      this._addEventListener('clearBtn', 'click', () => {
        this.#clearAll();
      });
    }

    // Back button
    if (this._getElement('backBtn')) {
      this._addEventListener('backBtn', 'click', () => {
        window.location.href = 'index.html';
      });
    }

    // Keyboard shortcuts
    this.#setupKeyboardShortcuts();
  }

  /**
   * Load initial data (minimal for this generator)
   *
   * @protected
   */
  async _loadInitialData() {
    // No initial data loading required for this generator
    this.logger.debug(
      'Speech patterns generator initialized - no initial data required'
    );
  }

  /**
   * Initialize UI state
   *
   * @protected
   */
  async _initializeUIState() {
    await super._initializeUIState();

    // Set initial empty state
    this._showState('empty');
    this.#updateUIState();
  }

  // Input Handling Methods

  /**
   * Handle character input changes
   *
   * @private
   */
  #handleCharacterInput() {
    const textarea = this._getElement('characterDefinition');
    if (!textarea) return;

    const input = textarea.value.trim();

    // Clear previous errors
    this.#clearValidationError();

    // Update UI state based on input
    this.#characterDefinition = null;
    this.#updateUIState();

    // Debounced validation for better UX
    clearTimeout(this._inputDebounceTimer);
    this._inputDebounceTimer = setTimeout(() => {
      if (input.length > 10) {
        // Only validate if substantial input
        this.#validateCharacterInput();
      }
    }, 500);
  }

  /**
   * Validate character input JSON format and content
   *
   * @private
   * @returns {boolean} True if validation passes
   */
  #validateCharacterInput() {
    const textarea = this._getElement('characterDefinition');
    if (!textarea) return false;

    const input = textarea.value.trim();

    if (!input) {
      this.#characterDefinition = null;
      this.#updateUIState();
      return false;
    }

    try {
      // Parse JSON
      const parsedData = JSON.parse(input);

      // Validate structure
      const validationResult = this.#validateCharacterStructure(parsedData);

      if (validationResult.isValid) {
        this.#characterDefinition = parsedData;
        this.#clearValidationError();
        this.#updateUIState();
        return true;
      } else {
        this.#showValidationError(validationResult.errors);
        this.#characterDefinition = null;
        this.#updateUIState();
        return false;
      }
    } catch (parseError) {
      this.#showValidationError(['Invalid JSON format: ' + parseError.message]);
      this.#characterDefinition = null;
      this.#updateUIState();
      return false;
    }
  }

  /**
   * Validate character definition structure
   *
   * @private
   * @param {object} characterData - Parsed character data
   * @returns {object} Validation result with isValid flag and errors array
   */
  #validateCharacterStructure(characterData) {
    const errors = [];

    // Check if it's an object
    if (!characterData || typeof characterData !== 'object') {
      errors.push('Character definition must be a JSON object');
      return { isValid: false, errors };
    }

    // Check for basic character components
    const requiredComponents = [
      'core:name',
      'core:personality',
      'core:profile',
    ];
    const recommendedComponents = [
      'core:likes',
      'core:dislikes',
      'core:fears',
      'core:goals',
    ];

    let hasRequiredComponents = false;
    let componentCount = 0;

    for (const componentId in characterData) {
      if (componentId.includes(':')) {
        componentCount++;
        if (requiredComponents.includes(componentId)) {
          hasRequiredComponents = true;
        }
      }
    }

    if (componentCount === 0) {
      errors.push(
        'No character components found. Expected components like core:name, core:personality, etc.'
      );
    } else if (!hasRequiredComponents) {
      errors.push(
        `Missing essential components. Expected at least one of: ${requiredComponents.join(', ')}`
      );
    }

    // Check for reasonable content depth
    let hasDetailedContent = false;
    for (const componentId in characterData) {
      const component = characterData[componentId];
      if (component && typeof component === 'object') {
        const contentLength = JSON.stringify(component).length;
        if (contentLength > 100) {
          // Reasonable content threshold
          hasDetailedContent = true;
          break;
        }
      }
    }

    if (!hasDetailedContent && componentCount > 0) {
      errors.push(
        'Character components appear to lack detail. Ensure components contain substantial character information.'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      componentCount,
      hasRequiredComponents,
    };
  }

  // Generation Workflow Methods

  /**
   * Main generation orchestration method
   *
   * @private
   */
  async #generateSpeechPatterns() {
    if (this.#isGenerating || !this.#characterDefinition) {
      return;
    }

    try {
      this.#isGenerating = true;
      this.#currentGenerationController = new AbortController();

      // Update UI to loading state
      this._showState('loading');
      this.#updateUIState();
      this.#announceToScreenReader('Generating speech patterns...');

      // Generate speech patterns using service
      const processedPatterns =
        await this.#speechPatternsGenerator.generateSpeechPatterns(
          this.#characterDefinition,
          {
            abortSignal: this.#currentGenerationController?.signal,
          }
        );

      // Store results and display
      this.#lastGeneratedPatterns = processedPatterns;
      await this.#displayResults(processedPatterns);

      // Update UI state
      this._showState('results');
      this.#updateUIState();
      this.#announceToScreenReader(
        `Successfully generated ${processedPatterns.speechPatterns.length} speech patterns`
      );
    } catch (error) {
      this.logger.error('Speech pattern generation failed:', error);

      if (error.name === 'AbortError') {
        this.#announceToScreenReader('Generation cancelled');
      } else {
        this.#handleGenerationError(error);
      }
    } finally {
      this.#isGenerating = false;
      this.#currentGenerationController = null;
    }
  }

  // Results Display Methods

  /**
   * Display generated speech patterns
   *
   * @private
   * @param {object} patterns - Generated patterns
   */
  async #displayResults(patterns) {
    const container = this._getElement('speechPatternsContainer');
    if (!container) return;

    // Clear previous results
    container.innerHTML = '';

    // Enhance patterns for display or use fallback
    let displayData;
    if (this.#displayEnhancer) {
      displayData = this.#displayEnhancer.enhanceForDisplay(patterns);
    } else {
      // Fallback display logic when enhancer is not available
      displayData = this.#createFallbackDisplayData(patterns);
    }

    // Create results header
    const header = this.#createResultsHeader(displayData);
    container.appendChild(header);

    // Create results container
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'speech-patterns-results';

    // Render each pattern
    displayData.patterns.forEach((pattern, index) => {
      const patternElement = this.#renderSpeechPattern(pattern, index);
      resultsContainer.appendChild(patternElement);
    });

    container.appendChild(resultsContainer);

    // Update pattern count
    this.#updatePatternCount(displayData.totalCount);
  }

  /**
   * Create fallback display data when display enhancer is not available
   *
   * @private
   * @param {object} patterns - Raw pattern data
   * @returns {object} Display-ready data structure
   */
  #createFallbackDisplayData(patterns) {
    return {
      patterns: patterns.speechPatterns.map((pattern, index) => ({
        index: index + 1,
        htmlSafePattern: this.#escapeHtml(pattern),
        htmlSafeExample: this.#escapeHtml(pattern),
        circumstances: '',
      })),
      characterName: patterns.characterName || 'Character',
      totalCount: patterns.speechPatterns.length,
    };
  }

  /**
   * Escape HTML for safe display
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} HTML-safe text
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create results header
   *
   * @private
   * @param {object} displayData - Display data
   * @returns {HTMLElement} Header element
   */
  #createResultsHeader(displayData) {
    const header = document.createElement('div');
    header.className = 'results-header';

    header.innerHTML = `
            <h3>Speech Patterns for ${displayData.characterName}</h3>
            <p class="results-subtitle">
                Generated ${displayData.totalCount} unique speech patterns
            </p>
        `;

    return header;
  }

  /**
   * Render individual speech pattern
   *
   * @private
   * @param {object} pattern - Pattern data
   * @param {number} index - Pattern index
   * @returns {HTMLElement} Pattern element
   */
  #renderSpeechPattern(pattern, index) {
    const patternElement = document.createElement('div');
    patternElement.className = 'speech-pattern-item fade-in';
    patternElement.setAttribute('role', 'article');
    patternElement.setAttribute('aria-label', `Speech pattern ${index + 1}`);

    patternElement.innerHTML = `
            <div class="pattern-number" aria-hidden="true">${pattern.index}</div>
            <div class="pattern-description">${pattern.htmlSafePattern}</div>
            <div class="pattern-example">${pattern.htmlSafeExample}</div>
            ${pattern.circumstances ? `<div class="pattern-circumstances">${pattern.circumstances}</div>` : ''}
        `;

    return patternElement;
  }

  // Export and Utility Methods

  /**
   * Export patterns to text file
   *
   * @private
   */
  #exportToText() {
    if (!this.#lastGeneratedPatterns) {
      this.showError('No speech patterns to export');
      return;
    }

    try {
      let exportText, filename;

      if (this.#displayEnhancer) {
        // Use display enhancer for formatted export
        exportText = this.#displayEnhancer.formatForExport(
          this.#lastGeneratedPatterns,
          {
            includeCharacterData: true,
            characterDefinition: this.#characterDefinition,
          }
        );
        filename = this.#displayEnhancer.generateExportFilename(
          this.#lastGeneratedPatterns.characterName
        );
      } else {
        // Fallback export format
        exportText = this.#createFallbackExportText(
          this.#lastGeneratedPatterns
        );
        filename = this.#createFallbackExportFilename(
          this.#lastGeneratedPatterns.characterName
        );
      }

      this.#downloadTextFile(exportText, filename);

      this.#announceToScreenReader('Speech patterns exported successfully');
    } catch (error) {
      this.logger.error('Export failed:', error);
      this.showError('Failed to export speech patterns');
    }
  }

  /**
   * Create fallback export text when display enhancer is not available
   *
   * @private
   * @param {object} patterns - Pattern data
   * @returns {string} Export text
   */
  #createFallbackExportText(patterns) {
    const lines = [
      `Speech Patterns for ${patterns.characterName}`,
      `Generated: ${new Date(patterns.generatedAt).toLocaleString()}`,
      `Total Patterns: ${patterns.totalCount}`,
      '',
      '='.repeat(50),
      '',
    ];

    patterns.speechPatterns.forEach((pattern, index) => {
      lines.push(`${index + 1}. ${pattern}`);
      lines.push('');
    });

    if (this.#characterDefinition) {
      lines.push('='.repeat(50));
      lines.push('Character Definition:');
      lines.push('');
      lines.push(JSON.stringify(this.#characterDefinition, null, 2));
    }

    return lines.join('\n');
  }

  /**
   * Create fallback export filename
   *
   * @private
   * @param {string} characterName - Character name
   * @returns {string} Filename
   */
  #createFallbackExportFilename(characterName) {
    const safeName = characterName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, '');
    return `speech_patterns_${safeName}_${timestamp}.txt`;
  }

  /**
   * Download text content as file
   *
   * @private
   * @param {string} content - File content
   * @param {string} filename - File name
   */
  #downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Clear all input and results
   *
   * @private
   */
  #clearAll() {
    // Cancel any ongoing generation
    if (this.#currentGenerationController) {
      this.#currentGenerationController.abort();
    }

    // Clear input
    const textarea = this._getElement('characterDefinition');
    if (textarea) {
      textarea.value = '';
    }

    // Clear state
    this.#characterDefinition = null;
    this.#lastGeneratedPatterns = null;

    // Clear validation errors
    this.#clearValidationError();

    // Update UI
    this._showState('empty');
    this.#updateUIState();

    this.#announceToScreenReader('All content cleared');
  }

  // UI State Management Methods

  /**
   * Update UI state based on current data
   *
   * @private
   */
  #updateUIState() {
    const generateBtn = this._getElement('generateBtn');
    const exportBtn = this._getElement('exportBtn');
    const clearBtn = this._getElement('clearBtn');

    if (generateBtn) {
      generateBtn.disabled = this.#isGenerating || !this.#characterDefinition;
    }

    if (exportBtn) {
      exportBtn.disabled = !this.#lastGeneratedPatterns;
    }

    if (clearBtn) {
      const hasContent =
        this.#characterDefinition || this.#lastGeneratedPatterns;
      clearBtn.disabled = this.#isGenerating || !hasContent;
    }
  }

  /**
   * Update pattern count display
   *
   * @private
   * @param {number} count - Pattern count
   */
  #updatePatternCount(count) {
    const countElement = this._getElement('patternCount');
    if (countElement) {
      countElement.textContent = `${count} patterns generated`;
    }
  }

  // Error Handling Methods

  /**
   * Handle generation errors
   *
   * @private
   * @param {Error} error - Generation error
   */
  #handleGenerationError(error) {
    this._showState('empty');
    this.#updateUIState();

    let errorMessage = 'Failed to generate speech patterns';

    // Handle different types of service errors
    if (error.name === 'SpeechPatternsGenerationError') {
      errorMessage = 'Failed to generate speech patterns: ' + error.message;
    } else if (error.name === 'SpeechPatternsResponseProcessingError') {
      errorMessage = 'Failed to process response: ' + error.message;
    } else if (error.name === 'SpeechPatternsValidationError') {
      errorMessage = 'Generated content validation failed: ' + error.message;
    } else if (error.message.includes('unavailable')) {
      errorMessage =
        'Speech pattern service is currently unavailable. Please try again later.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Generation timed out. Please try again.';
    } else if (error.message.includes('validation')) {
      errorMessage =
        'Generated content did not meet quality standards. Please try again.';
    }

    this.showError(errorMessage);
    this.#announceToScreenReader(errorMessage);
  }

  /**
   * Show validation error for character input
   *
   * @private
   * @param {Array<string>} errors - Validation errors
   */
  #showValidationError(errors) {
    const errorContainer = this._getElement('characterInputError');
    if (!errorContainer) return;

    const errorHtml = errors.map((error) => `<p>${error}</p>`).join('');
    errorContainer.innerHTML = errorHtml;
    errorContainer.style.display = 'block';

    // Add error class to textarea
    const textarea = this._getElement('characterDefinition');
    if (textarea) {
      textarea.classList.add('error');
    }
  }

  /**
   * Clear validation error display
   *
   * @private
   */
  #clearValidationError() {
    const errorContainer = this._getElement('characterInputError');
    if (errorContainer) {
      errorContainer.style.display = 'none';
      errorContainer.innerHTML = '';
    }

    // Remove error class from textarea
    const textarea = this._getElement('characterDefinition');
    if (textarea) {
      textarea.classList.remove('error');
    }
  }

  // Keyboard Shortcuts

  /**
   * Set up keyboard shortcuts
   *
   * @private
   */
  #setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'Enter':
            event.preventDefault();
            if (!this.#isGenerating && this.#characterDefinition) {
              this.#generateSpeechPatterns();
            }
            break;

          case 'e':
            event.preventDefault();
            if (this.#lastGeneratedPatterns) {
              this.#exportToText();
            }
            break;

          case 'Delete':
            if (event.shiftKey) {
              event.preventDefault();
              this.#clearAll();
            }
            break;
        }
      } else if (event.key === 'Escape') {
        // Cancel generation or close dialogs
        if (this.#currentGenerationController) {
          this.#currentGenerationController.abort();
        }
      }
    });
  }

  // Screen Reader Support

  /**
   * Announce message to screen readers
   *
   * @private
   * @param {string} message - Message to announce
   */
  #announceToScreenReader(message) {
    const announcer = this._getElement('screenReaderAnnouncement');
    if (announcer) {
      announcer.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = '';
      }, 1000);
    }
  }
}

export default SpeechPatternsGeneratorController;
