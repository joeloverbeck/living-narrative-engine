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
import { tokens } from '../../dependencyInjection/tokens.js';
import { EnhancedSpeechPatternsValidator } from '../validators/EnhancedSpeechPatternsValidator.js';

/**
 * @description Format a time estimate into a human readable string for display in the UI.
 * @param {{ remaining: number, confidence: number }} timeEstimate - Time estimate data
 * @returns {string} Formatted time string
 */
export function formatTimeEstimateText(timeEstimate) {
  if (!timeEstimate || timeEstimate.remaining < 1000) {
    return '';
  }

  const seconds = Math.ceil(timeEstimate.remaining / 1000);
  const confidence = timeEstimate.confidence || 0.5;

  if (seconds < 60) {
    const range = Math.round(seconds * 0.2);
    const low = Math.max(1, seconds - range);
    const high = seconds + range;

    if (confidence > 0.8) {
      return `About ${seconds} seconds remaining`;
    }

    return `${low}-${high} seconds remaining`;
  }

  const minutes = Math.ceil(seconds / 60);
  if (confidence > 0.8) {
    return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  }

  return `${minutes}-${minutes + 1} minutes remaining`;
}

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

  /** @private @type {EnhancedSpeechPatternsValidator|null} */
  #enhancedValidator = null;

  // UI State
  /** @private @type {object|null} */
  #characterDefinition = null;

  /** @private @type {Array<object>|null} */
  #lastGeneratedPatterns = null;

  /** @private @type {boolean} */
  #isGenerating = false;

  /** @private @type {AbortController|null} */
  #currentGenerationController = null;

  /** @private @type {Function|null} */
  #debouncedValidation = null;

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
            tokens.SpeechPatternsGenerator
          );
        } catch (error) {
          dependencies.logger?.warn(
            'SpeechPatternsGenerator not available:',
            error.message
          );
        }
      }
    }

    // Initialize enhanced validator if available
    if (dependencies.schemaValidator) {
      try {
        this.#enhancedValidator = new EnhancedSpeechPatternsValidator({
          schemaValidator: dependencies.schemaValidator,
          logger: dependencies.logger,
        });
        dependencies.logger?.debug(
          'EnhancedSpeechPatternsValidator initialized'
        );
      } catch (error) {
        dependencies.logger?.warn(
          'Failed to initialize enhanced validator:',
          error.message
        );
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

      // UI State Management Elements (required by BaseCharacterBuilderController)
      loadingState: '#loading-state',
      resultsState: '#results-state',
      errorState: '#error-state',

      // Display elements
      speechPatternsContainer: '#speech-patterns-container',
      loadingIndicator: '#loading-indicator',
      loadingMessage: '#loading-message',
      emptyState: '#empty-state',
      patternCount: '#pattern-count',

      // Progress elements (optional - will be created dynamically)
      progressContainer: {
        selector: '#progress-container',
        required: false,
      },
      progressBar: {
        selector: '#progress-bar',
        required: false,
      },
      timeEstimate: {
        selector: '#time-estimate',
        required: false,
      },

      // Error handling elements in error state
      errorMessage: {
        selector: '#error-message',
        required: false,
      },
      retryBtn: {
        selector: '#retry-btn',
        required: false,
      },

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
    // Choose validation strategy based on enhanced validator availability
    const validationHandler = this.#enhancedValidator
      ? () => this.#validateCharacterInputEnhanced()
      : () => this.#validateCharacterInput();

    // Create debounced validation function with faster response time
    this.#debouncedValidation = this._debounce(
      validationHandler,
      300, // Reduced from 500ms to 300ms for better responsiveness
      { trailing: true }
    );

    // Character input validation
    if (this._getElement('characterDefinition')) {
      this._addEventListener('characterDefinition', 'input', () => {
        this.#handleCharacterInput();
      });

      this._addEventListener('characterDefinition', 'blur', validationHandler);
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
        this.#exportToFile();
      });
    }

    // Format selector change handler
    if (this._getElement('exportFormat')) {
      this._addEventListener('exportFormat', 'change', () => {
        this.#updateTemplateVisibility();
      });
    }

    // Initialize export controls
    this.#initializeExportControls();

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

    // Retry button (in error state)
    if (this._getElement('retryBtn')) {
      this._addEventListener('retryBtn', 'click', () => {
        this.#retryGeneration();
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

  /**
   * @description Disable enhanced validation support so the controller falls back to basic validation logic.
   * @protected
   * @returns {void}
   */
  _disableEnhancedValidation() {
    this.#enhancedValidator = null;
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

    // Use proper debounced validation
    if (input.length > 10 && this.#debouncedValidation) {
      // Only validate if substantial input
      this.#debouncedValidation();
    }
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
      this.#showValidationError([
        'JSON Syntax Error: ' + parseError.message,
      ]);
      this.#characterDefinition = null;
      this.#updateUIState();
      return false;
    }
  }

  /**
   * Enhanced validation with multi-layer feedback and suggestions
   *
   * @private
   * @returns {boolean} True if validation passes
   */
  async #validateCharacterInputEnhanced() {
    const textarea = this._getElement('characterDefinition');
    if (!textarea) return false;

    const input = textarea.value.trim();

    if (!input) {
      this.#characterDefinition = null;
      this.#updateUIState();
      this.#clearEnhancedValidationDisplay();
      return false;
    }

    if (!this.#enhancedValidator) {
      return this.#validateCharacterInput();
    }

    // Show validation progress indicator
    this.#showValidationProgress(true);

    try {
      let parsedData;
      try {
        parsedData = JSON.parse(input);
      } catch (parseError) {
        // Handle JSON syntax errors with enhanced feedback
        const result = {
          isValid: false,
          errors: [`JSON Syntax Error: ${parseError.message}`],
          warnings: [],
          suggestions: [
            'Use a JSON validator to check your syntax',
            'Common issues: missing quotes around keys, trailing commas, unmatched brackets',
          ],
        };
        this.#displayEnhancedValidationResults(result);
        this.#showValidationProgress(false);
        return false;
      }

      // Use enhanced validator when available
      const validationResult = await this.#enhancedValidator.validateInput(
        parsedData,
        {
          includeQualityAssessment: true,
          includeSuggestions: true,
        }
      );

      // Update UI based on validation results
      this.#displayEnhancedValidationResults(validationResult);

      if (validationResult.isValid || validationResult.errors.length === 0) {
        this.#characterDefinition = parsedData;
        this.#updateUIState();
        this.#showValidationProgress(false);
        return true;
      } else {
        this.#characterDefinition = null;
        this.#updateUIState();
        this.#showValidationProgress(false);
        return false;
      }
    } catch (error) {
      this.logger.error('Enhanced validation failed:', error);
      const fallbackResult = {
        isValid: false,
        errors: [`Validation system error: ${error.message}`],
        warnings: [],
        suggestions: ['Try refreshing the page if the problem persists'],
      };
      this.#displayEnhancedValidationResults(fallbackResult);
      this.#showValidationProgress(false);
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

    // Support both formats:
    // 1. New format: { "components": { "core:name": {...} } }
    // 2. Legacy format: { "core:name": {...} }
    const componentsToCheck = characterData.components || characterData;

    for (const componentId in componentsToCheck) {
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

    // Validate core:name component if present
    const nameComponent = componentsToCheck['core:name'];
    if (nameComponent) {
      const characterName = this.#extractCharacterName(nameComponent);
      if (!characterName) {
        errors.push(
          'Character name component exists but does not contain a valid name. Expected text, name, or value field.'
        );
      }
    }

    // Check for reasonable content depth
    let hasDetailedContent = false;
    for (const componentId in componentsToCheck) {
      const component = componentsToCheck[componentId];
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
      characterName: nameComponent
        ? this.#extractCharacterName(nameComponent)
        : null,
    };
  }

  /**
   * Extract character name from core:name component
   *
   * @private
   * @param {object} nameComponent - The core:name component data
   * @returns {string|null} Extracted character name or null if not found
   */
  #extractCharacterName(nameComponent) {
    if (!nameComponent || typeof nameComponent !== 'object') {
      return null;
    }

    // Try different common field names
    if (nameComponent.text && typeof nameComponent.text === 'string') {
      return nameComponent.text.trim();
    }

    if (nameComponent.name && typeof nameComponent.name === 'string') {
      return nameComponent.name.trim();
    }

    if (nameComponent.value && typeof nameComponent.value === 'string') {
      return nameComponent.value.trim();
    }

    // Check for nested structures
    if (nameComponent.personal && nameComponent.personal.firstName) {
      const firstName = nameComponent.personal.firstName;
      const lastName = nameComponent.personal.lastName || '';
      return `${firstName} ${lastName}`.trim();
    }

    // If none of the expected fields are found, return null
    return null;
  }

  // Enhanced Progress Tracking Methods

  /**
   * Update loading progress with stage information and time estimates
   *
   * @private
   * @param {string} stage - Current stage name
   * @param {number} progress - Progress percentage (0-100)
   * @param {object} [timeEstimate] - Time estimate data
   */
  #updateLoadingProgress(stage, progress, timeEstimate = null) {
    const loadingMessage = this._getElement('loadingMessage');
    const progressContainer = this._getElement('progressContainer');
    const progressBar = this._getElement('progressBar');
    const timeEstimateElement = this._getElement('timeEstimate');

    // Update loading message with stage and progress
    if (loadingMessage) {
      const message = this.#getStageMessage(stage, progress);
      loadingMessage.textContent = message;
    }

    // Update progress bar
    if (progressBar) {
      this.#updateProgressBar(progress, timeEstimate);
    }

    // Update time estimate display
    if (timeEstimateElement && timeEstimate) {
      const formattedTime = this.#formatTimeEstimate(timeEstimate);
      timeEstimateElement.textContent = formattedTime;
      timeEstimateElement.style.display = formattedTime ? 'block' : 'none';
    }

    // Enhanced screen reader announcement
    this.#announceProgressToScreenReader(stage, progress, timeEstimate);

    // Show progress container if hidden
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }
  }

  /**
   * Calculate time estimate based on current stage and performance data
   *
   * @private
   * @param {string} currentStage - Current stage name
   * @param {number} startTime - Generation start time
   * @param {number} progress - Current progress (0-100)
   * @returns {object} Time estimate data
   */
  #calculateTimeEstimate(currentStage, startTime, progress = 0) {
    const currentTime = performance.now();
    const elapsedTime = currentTime - startTime;

    // Stage-based time estimation (based on existing performance data)
    const stageWeights = {
      validation: { weight: 0.15, baseTime: 1000 }, // 15% - Fast validation
      processing: { weight: 0.55, baseTime: 15000 }, // 55% - Main AI processing
      response: { weight: 0.2, baseTime: 3000 }, // 20% - Response processing
      rendering: { weight: 0.1, baseTime: 1000 }, // 10% - Display rendering
    };

    const stageInfo = stageWeights[currentStage] || stageWeights['processing'];

    // Calculate estimated total time based on progress
    let estimatedTotal;
    if (progress > 5) {
      // Use actual progress for better estimate
      estimatedTotal = elapsedTime / (progress / 100);
    } else {
      // Use stage-based estimate for early stages
      estimatedTotal = stageInfo.baseTime / stageInfo.weight;
    }

    const remaining = Math.max(0, estimatedTotal - elapsedTime);

    // Confidence decreases with estimation uncertainty
    let confidence = 0.7; // Base confidence
    if (progress > 20) confidence = 0.85;
    if (progress > 50) confidence = 0.95;

    return {
      elapsed: Math.round(elapsedTime),
      remaining: Math.round(remaining),
      total: Math.round(estimatedTotal),
      confidence: confidence,
    };
  }

  /**
   * Get stage-specific loading message
   *
   * @private
   * @param {string} stage - Stage name
   * @param {number} progress - Progress percentage
   * @returns {string} Stage message
   */
  #getStageMessage(stage, progress) {
    const roundedProgress = Math.round(progress);

    const stageMessages = {
      validation: `Stage 1 of 4: Validating character definition (${roundedProgress}% complete)`,
      processing: `Stage 2 of 4: AI analyzing character traits and generating patterns (${roundedProgress}% complete)`,
      response: `Stage 3 of 4: Processing and validating generated content (${roundedProgress}% complete)`,
      rendering: `Stage 4 of 4: Preparing results for display (${roundedProgress}% complete)`,
    };

    return (
      stageMessages[stage] ||
      `Generating speech patterns (${roundedProgress}% complete)`
    );
  }

  /**
   * Update progress bar visual display
   *
   * @private
   * @param {number} progress - Progress percentage (0-100)
   * @param {object} [timeEstimate] - Time estimate data
   */
  #updateProgressBar(progress, timeEstimate = null) {
    const progressBar = this._getElement('progressBar');
    if (!progressBar) return;

    const clampedProgress = Math.max(0, Math.min(100, progress));

    // Use requestAnimationFrame for smooth animation
    this._requestAnimationFrame(() => {
      progressBar.style.width = `${clampedProgress}%`;

      // Add confidence-based styling
      if (timeEstimate && timeEstimate.confidence) {
        const confidence = timeEstimate.confidence;
        if (confidence > 0.9) {
          progressBar.classList.add('high-confidence');
        } else if (confidence > 0.7) {
          progressBar.classList.add('medium-confidence');
        } else {
          progressBar.classList.add('low-confidence');
        }
      }
    });
  }

  /**
   * Format time estimate for display
   *
   * @private
   * @param {object} timeEstimate - Time estimate data
   * @returns {string} Formatted time string
   */
  #formatTimeEstimate(timeEstimate) {
    return formatTimeEstimateText(timeEstimate);
  }

  /**
   * Enhanced screen reader progress announcement
   *
   * @private
   * @param {string} stage - Current stage
   * @param {number} progress - Progress percentage
   * @param {object} [timeEstimate] - Time estimate data
   */
  #announceProgressToScreenReader(stage, progress, timeEstimate = null) {
    const stageNames = {
      validation: 'input validation',
      processing: 'AI processing',
      response: 'response processing',
      rendering: 'display rendering',
    };

    const stageName = stageNames[stage] || 'processing';
    const roundedProgress = Math.round(progress);

    let announcement = `${stageName} ${roundedProgress}% complete`;

    if (timeEstimate && timeEstimate.remaining > 5000) {
      const timeText = this.#formatTimeEstimate(timeEstimate);
      if (timeText) {
        announcement += `. ${timeText}`;
      }
    }

    // Only announce significant progress changes to avoid spam
    if (
      this.#lastAnnouncedProgress === undefined ||
      Math.abs(this.#lastAnnouncedProgress - roundedProgress) >= 10
    ) {
      this.#announceToScreenReader(announcement);
      this.#lastAnnouncedProgress = roundedProgress;
    }
  }

  /** @private @type {number|undefined} */
  #lastAnnouncedProgress = undefined;

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

    // Performance monitoring
    this._performanceMark('speech-patterns-generation-start');
    const generationStartTime = performance.now();

    try {
      this.#isGenerating = true;
      this.#currentGenerationController = new AbortController();

      // Stage 1: Initial UI Update and Validation (0-15%)
      this._performanceMark('speech-patterns-ui-update-start');
      this._showState('loading');
      this.#updateUIState();

      // Show initial progress
      let timeEstimate = this.#calculateTimeEstimate(
        'validation',
        generationStartTime,
        5
      );
      this.#updateLoadingProgress('validation', 5, timeEstimate);

      this._performanceMeasure(
        'speech-patterns-ui-update',
        'speech-patterns-ui-update-start'
      );

      // Brief pause for UI update (simulates validation time)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Update validation progress
      timeEstimate = this.#calculateTimeEstimate(
        'validation',
        generationStartTime,
        15
      );
      this.#updateLoadingProgress('validation', 15, timeEstimate);

      // Stage 2: AI Processing (15-70%)
      this._performanceMark('speech-patterns-llm-request-start');

      // Update to processing stage
      timeEstimate = this.#calculateTimeEstimate(
        'processing',
        generationStartTime,
        20
      );
      this.#updateLoadingProgress('processing', 20, timeEstimate);

      // Create progress callback for LLM processing
      const progressCallback = (progress) => {
        const adjustedProgress = 20 + progress * 0.5; // 20% to 70%
        const currentTimeEstimate = this.#calculateTimeEstimate(
          'processing',
          generationStartTime,
          adjustedProgress
        );
        this.#updateLoadingProgress(
          'processing',
          adjustedProgress,
          currentTimeEstimate
        );
      };

      const processedPatterns =
        await this.#speechPatternsGenerator.generateSpeechPatterns(
          this.#characterDefinition,
          {
            abortSignal: this.#currentGenerationController?.signal,
            progressCallback, // Add progress callback if service supports it
          }
        );

      this._performanceMeasure(
        'speech-patterns-llm-request',
        'speech-patterns-llm-request-start'
      );

      // Stage 3: Response Processing (70-90%)
      timeEstimate = this.#calculateTimeEstimate(
        'response',
        generationStartTime,
        75
      );
      this.#updateLoadingProgress('response', 75, timeEstimate);

      await new Promise((resolve) => setTimeout(resolve, 100)); // Brief pause for processing

      timeEstimate = this.#calculateTimeEstimate(
        'response',
        generationStartTime,
        90
      );
      this.#updateLoadingProgress('response', 90, timeEstimate);

      // Store results and display
      this.#lastGeneratedPatterns = processedPatterns;

      // Stage 4: Display Rendering (90-100%)
      this._performanceMark('speech-patterns-display-start');
      timeEstimate = this.#calculateTimeEstimate(
        'rendering',
        generationStartTime,
        95
      );
      this.#updateLoadingProgress('rendering', 95, timeEstimate);

      await this.#displayResults(processedPatterns);

      // Final progress update
      timeEstimate = this.#calculateTimeEstimate(
        'rendering',
        generationStartTime,
        100
      );
      this.#updateLoadingProgress('rendering', 100, timeEstimate);

      this._performanceMeasure(
        'speech-patterns-display',
        'speech-patterns-display-start'
      );

      // Update UI state
      this._showState('results');
      this.#updateUIState();
      this.#announceResults(processedPatterns);

      // Measure total generation time
      const totalDuration = this._performanceMeasure(
        'speech-patterns-generation',
        'speech-patterns-generation-start'
      );

      // Log performance summary
      this.logger.info('Speech patterns generation completed', {
        totalDuration: `${totalDuration?.toFixed(2)}ms`,
        patternCount: processedPatterns.speechPatterns?.length,
      });
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

    // Use requestAnimationFrame for smooth rendering
    await new Promise((resolve) => {
      this._requestAnimationFrame(() => {
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

        // Create DocumentFragment for batch DOM operations
        const fragment = document.createDocumentFragment();

        // Create results header
        const header = this.#createResultsHeader(displayData);
        fragment.appendChild(header);

        // Create results container
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'speech-patterns-results';

        // Add CSS containment for optimized rendering
        resultsContainer.style.contain = 'layout style';

        // Create another fragment for pattern elements
        const patternsFragment = document.createDocumentFragment();

        // Render each pattern to the fragment
        displayData.patterns.forEach((pattern, index) => {
          const patternElement = this.#renderSpeechPattern(pattern, index);
          patternsFragment.appendChild(patternElement);
        });

        // Append all patterns at once
        resultsContainer.appendChild(patternsFragment);
        fragment.appendChild(resultsContainer);

        // Single DOM update
        container.appendChild(fragment);

        // Set first pattern as focusable for keyboard navigation
        const firstPattern = resultsContainer.querySelector(
          '.speech-pattern-item'
        );
        if (firstPattern) {
          firstPattern.setAttribute('tabindex', '0');
        }

        // Update pattern count
        this.#updatePatternCount(displayData.totalCount);

        resolve();
      });
    });
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
        htmlSafePattern: this.#escapeHtml(pattern.pattern || ''),
        htmlSafeExample: this.#escapeHtml(pattern.example || ''),
        circumstances: pattern.circumstances ? this.#escapeHtml(pattern.circumstances) : '',
      })),
      characterName: patterns.characterName || 'Character',
      totalCount: patterns.speechPatterns.length,
    };
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
   * Render individual speech pattern with enhanced accessibility
   *
   * @private
   * @param {object} pattern - Pattern data
   * @param {number} index - Pattern index
   * @returns {HTMLElement} Pattern element
   */
  #renderSpeechPattern(pattern, index) {
    const patternElement = document.createElement('article');
    patternElement.className = 'speech-pattern-item fade-in';

    // Performance optimizations: GPU acceleration and layer promotion
    patternElement.style.willChange = 'transform, opacity';
    patternElement.style.transform = 'translateZ(0)'; // Force GPU layer

    // Remove will-change after animation completes
    patternElement.addEventListener(
      'animationend',
      () => {
        patternElement.style.willChange = 'auto';
      },
      { once: true }
    );

    // Enhanced ARIA attributes for accessibility
    patternElement.setAttribute('tabindex', '-1');
    patternElement.setAttribute('role', 'article');
    patternElement.setAttribute('aria-labelledby', `pattern-${index}-title`);
    patternElement.setAttribute('aria-describedby', `pattern-${index}-content`);

    patternElement.innerHTML = `
            <div class="pattern-number" aria-hidden="true">${pattern.index}</div>
            
            <!-- Screen reader title -->
            <h3 id="pattern-${index}-title" class="screen-reader-only">
                Speech Pattern ${pattern.index}
            </h3>
            
            <div id="pattern-${index}-content" class="pattern-content">
                <div class="pattern-description" role="definition">
                    <!-- Screen reader context labels -->
                    <span class="screen-reader-only">Pattern description: </span>
                    ${pattern.htmlSafePattern}
                </div>
                <div class="pattern-example" role="example">
                    <span class="screen-reader-only">Example dialogue: </span>
                    ${pattern.htmlSafeExample}
                </div>
                ${
                  pattern.circumstances
                    ? `
                    <div class="pattern-circumstances" role="note">
                        <span class="screen-reader-only">Context: </span>
                        ${pattern.circumstances}
                    </div>
                `
                    : ''
                }
            </div>
            
            <!-- Navigation instructions for screen readers -->
            <div class="screen-reader-only">
                Pattern ${pattern.index} of ${this.#lastGeneratedPatterns?.speechPatterns?.length || 'unknown total'}.
                Use arrow keys or J/K to navigate between patterns.
            </div>
        `;

    return patternElement;
  }

  // Export and Utility Methods

  /**
   * Export patterns to text file
   *
   * @private
   */
  #exportToFile() {
    if (!this.#lastGeneratedPatterns) {
      this.#displayErrorInState('No speech patterns to export');
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

      const formatSelector = this._getElement('exportFormat');
      const templateSelector = this._getElement('exportTemplate');
      const format = formatSelector?.value || 'txt';
      const template = templateSelector?.value || 'default';

      let exportContent, mimeType;

      if (!this.#displayEnhancer) {
        // Fallback for text only
        exportContent = exportText;
        mimeType = 'text/plain';
      } else {
        const exportOptions = {
          includeCharacterData: true,
          characterDefinition: this.#characterDefinition,
        };

        // Get format info
        const formats = this.#displayEnhancer.getSupportedExportFormats();
        const formatInfo = formats.find((f) => f.id === format) || formats[0];

        // Generate content based on format
        switch (format) {
          case 'json':
            exportContent = this.#displayEnhancer.formatAsJson(
              this.#lastGeneratedPatterns,
              exportOptions
            );
            break;
          case 'markdown':
            exportContent = this.#displayEnhancer.formatAsMarkdown(
              this.#lastGeneratedPatterns,
              exportOptions
            );
            break;
          case 'csv':
            exportContent = this.#displayEnhancer.formatAsCsv(
              this.#lastGeneratedPatterns,
              exportOptions
            );
            break;
          case 'txt':
          default:
            // Apply template for text format
            if (template !== 'default') {
              exportContent = this.#displayEnhancer.applyTemplate(
                this.#lastGeneratedPatterns,
                template,
                exportOptions
              );
            } else {
              exportContent = exportText;
            }
            break;
        }

        filename = this.#displayEnhancer.generateExportFilename(
          this.#lastGeneratedPatterns.characterName,
          { extension: formatInfo.extension }
        );
        mimeType = formatInfo.mimeType;
      }

      this.#downloadFile(exportContent || exportText, filename, mimeType);
      this.#announceToScreenReader(
        `Speech patterns exported as ${format?.toUpperCase() || 'TXT'}`
      );
    } catch (error) {
      this.logger.error('Export failed:', error);
      this.#displayErrorInState('Failed to export speech patterns');
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
      `Total Patterns: ${patterns.speechPatterns?.length || 0}`,
      '',
      '='.repeat(50),
      '',
    ];

    patterns.speechPatterns.forEach((pattern, index) => {
      lines.push(`${index + 1}. ${pattern.pattern || 'Speech Pattern'}`);
      if (pattern.example) {
        lines.push(`   Example: "${pattern.example}"`);
      }
      if (pattern.circumstances) {
        lines.push(`   Context: ${pattern.circumstances}`);
      }
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
    const rawName =
      typeof characterName === 'string' ? characterName.trim() : '';
    const safeSource = rawName || 'character';
    const safeName = safeSource.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, '');
    return `speech_patterns_${safeName}_${timestamp}.txt`;
  }

  /**
   * Download content as file
   *
   * @private
   * @param {string} content - File content
   * @param {string} filename - File name
   * @param {string} mimeType - MIME type for file
   */
  #downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
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
    this._showState('error');
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

    // Display error in the error state container
    this.#displayErrorInState(errorMessage);
    this.#announceToScreenReader(errorMessage);
  }

  /**
   * Display error message in the error state container
   *
   * @private
   * @param {string} message - Error message to display
   */
  #displayErrorInState(message) {
    const errorMessageElement = this._getElement('errorMessage');
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
    }
  }

  /**
   * Retry the last generation attempt
   *
   * @private
   */
  #retryGeneration() {
    if (this.#characterDefinition && !this.#isGenerating) {
      this.#generateSpeechPatterns();
    }
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

  /**
   * Display enhanced validation results with categorized feedback
   *
   * @private
   * @param {object} validationResult - Enhanced validation result
   */
  #displayEnhancedValidationResults(validationResult) {
    const errorContainer = this._getElement('characterInputError');
    const textarea = this._getElement('characterDefinition');

    if (!errorContainer) return;

    // Clear previous state
    this.#clearEnhancedValidationDisplay();

    const { errors, warnings, suggestions, quality } = validationResult;

    if (
      errors.length === 0 &&
      warnings.length === 0 &&
      suggestions.length === 0
    ) {
      // All good - show success state
      if (quality && quality.overallScore >= 0.8) {
        this.#showValidationSuccess('Excellent character definition!');
      } else if (quality && quality.overallScore >= 0.6) {
        this.#showValidationSuccess('Good character definition');
      } else {
        errorContainer.style.display = 'none';
      }

      if (textarea) {
        textarea.classList.remove('error', 'warning');
        textarea.classList.add('success');
      }
      return;
    }

    // Build enhanced feedback HTML
    let html = '<div class="enhanced-validation-results">';

    // Errors section (blocking issues)
    if (errors.length > 0) {
      html += '<div class="validation-section validation-errors">';
      html += '<h4 class="validation-section-title">';
      html += '<span class="validation-icon error-icon">❌</span>';
      html += `Errors (${errors.length}) - Must be fixed`;
      html += '</h4>';
      html += '<ul class="validation-list">';
      errors.forEach((error) => {
        html += `<li class="validation-item error-item">${this.#escapeHtml(error)}</li>`;
      });
      html += '</ul>';
      html += '</div>';
    }

    // Warnings section (recommended fixes)
    if (warnings.length > 0) {
      html += '<div class="validation-section validation-warnings">';
      html += '<h4 class="validation-section-title">';
      html += '<span class="validation-icon warning-icon">⚠️</span>';
      html += `Warnings (${warnings.length}) - Recommended fixes`;
      html += '</h4>';
      html += '<ul class="validation-list">';
      warnings.forEach((warning) => {
        html += `<li class="validation-item warning-item">${this.#escapeHtml(warning)}</li>`;
      });
      html += '</ul>';
      html += '</div>';
    }

    // Suggestions section (improvements)
    if (suggestions.length > 0) {
      html += '<div class="validation-section validation-suggestions">';
      html += '<h4 class="validation-section-title">';
      html += '<span class="validation-icon suggestion-icon">💡</span>';
      html += `Suggestions (${suggestions.length}) - Improvements`;
      html += '</h4>';
      html += '<ul class="validation-list">';
      suggestions.forEach((suggestion) => {
        html += `<li class="validation-item suggestion-item">${this.#escapeHtml(suggestion)}</li>`;
      });
      html += '</ul>';
      html += '</div>';
    }

    // Quality score section
    if (quality && typeof quality.overallScore === 'number') {
      const score = Math.round(quality.overallScore * 100);
      const level = this.#getQualityDisplayLevel(quality.overallScore);

      html += '<div class="validation-section validation-quality">';
      html += '<h4 class="validation-section-title">';
      html += '<span class="validation-icon quality-icon">📊</span>';
      html += 'Character Quality Score';
      html += '</h4>';
      html += '<div class="quality-display">';
      html += `<div class="quality-score ${level.class}">${score}%</div>`;
      html += `<div class="quality-level">${level.text}</div>`;
      html += '<div class="quality-bar">';
      html += `<div class="quality-progress ${level.class}" style="width: ${score}%"></div>`;
      html += '</div>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';

    // Display the enhanced feedback
    errorContainer.innerHTML = html;
    errorContainer.style.display = 'block';

    // Update textarea styling
    if (textarea) {
      textarea.classList.remove('error', 'warning', 'success');

      if (errors.length > 0) {
        textarea.classList.add('error');
      } else if (warnings.length > 0) {
        textarea.classList.add('warning');
      }
    }

    // Add expandable behavior to sections
    this.#setupValidationSectionToggling();
  }

  /**
   * Clear enhanced validation display
   *
   * @private
   */
  #clearEnhancedValidationDisplay() {
    const errorContainer = this._getElement('characterInputError');
    if (errorContainer) {
      errorContainer.style.display = 'none';
      errorContainer.innerHTML = '';
    }

    const textarea = this._getElement('characterDefinition');
    if (textarea) {
      textarea.classList.remove('error', 'warning', 'success');
    }
  }

  /**
   * Show validation success message
   *
   * @private
   * @param {string} message - Success message
   */
  #showValidationSuccess(message) {
    const errorContainer = this._getElement('characterInputError');
    if (!errorContainer) return;

    const html = `
      <div class="validation-success">
        <span class="validation-icon success-icon">✅</span>
        <span class="success-message">${this.#escapeHtml(message)}</span>
      </div>
    `;

    errorContainer.innerHTML = html;
    errorContainer.style.display = 'block';

    // Auto-hide success message after 3 seconds
    setTimeout(() => {
      if (errorContainer.querySelector('.validation-success')) {
        errorContainer.style.display = 'none';
      }
    }, 3000);
  }

  /**
   * Show/hide validation progress indicator
   *
   * @private
   * @param {boolean} show - Whether to show progress
   */
  #showValidationProgress(show) {
    const errorContainer = this._getElement('characterInputError');
    if (!errorContainer) return;

    if (show) {
      const html = `
        <div class="validation-progress">
          <div class="validation-spinner"></div>
          <span class="progress-text">Validating character definition...</span>
        </div>
      `;
      errorContainer.innerHTML = html;
      errorContainer.style.display = 'block';
    } else {
      // Progress will be replaced by validation results or cleared
    }
  }

  /**
   * Setup expandable behavior for validation sections
   *
   * @private
   */
  #setupValidationSectionToggling() {
    const sections = document.querySelectorAll('.validation-section');

    sections.forEach((section) => {
      const title = section.querySelector('.validation-section-title');
      const content = section.querySelector('.validation-list');

      if (title && content) {
        // Make sections collapsible for warnings and suggestions
        if (
          section.classList.contains('validation-warnings') ||
          section.classList.contains('validation-suggestions')
        ) {
          title.style.cursor = 'pointer';
          title.setAttribute('tabindex', '0');
          title.setAttribute('role', 'button');
          title.setAttribute('aria-expanded', 'true');

          const toggleSection = () => {
            const isExpanded = content.style.display !== 'none';
            content.style.display = isExpanded ? 'none' : 'block';
            title.setAttribute('aria-expanded', !isExpanded);
            title.classList.toggle('collapsed', isExpanded);
          };

          title.addEventListener('click', toggleSection);
          title.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleSection();
            }
          });
        }
      }
    });
  }

  /**
   * Get quality display level information
   *
   * @private
   * @param {number} score - Quality score (0-1)
   * @returns {object} Display level info
   */
  #getQualityDisplayLevel(score) {
    if (score >= 0.8) {
      return { class: 'excellent', text: 'Excellent' };
    } else if (score >= 0.6) {
      return { class: 'good', text: 'Good' };
    } else if (score >= 0.4) {
      return { class: 'fair', text: 'Fair' };
    } else if (score >= 0.2) {
      return { class: 'poor', text: 'Needs Work' };
    } else {
      return { class: 'inadequate', text: 'Inadequate' };
    }
  }

  /**
   * Escape HTML for safe display
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} HTML-safe text
   */
  #escapeHtml(text) {
    if (typeof text !== 'string') return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
              this.#exportToFile();
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

    // Arrow key navigation for pattern results
    document.addEventListener('keydown', (event) => {
      const focusedPattern = event.target.closest('.speech-pattern-item');
      if (focusedPattern) {
        this.#handlePatternNavigation(event, focusedPattern);
      }
    });
  }

  /**
   * Handle arrow key navigation through pattern results
   *
   * @private
   * @param {KeyboardEvent} event - Keyboard event
   * @param {HTMLElement} currentPattern - Currently focused pattern
   */
  #handlePatternNavigation(event, currentPattern) {
    let nextPattern = null;

    switch (event.key) {
      case 'ArrowDown':
      case 'j': // Vim-style navigation
        event.preventDefault();
        nextPattern = currentPattern.nextElementSibling;
        break;
      case 'ArrowUp':
      case 'k': // Vim-style navigation
        event.preventDefault();
        nextPattern = currentPattern.previousElementSibling;
        break;
      case 'Home':
        event.preventDefault();
        nextPattern = currentPattern.parentElement.firstElementChild;
        break;
      case 'End':
        event.preventDefault();
        nextPattern = currentPattern.parentElement.lastElementChild;
        break;
    }

    if (nextPattern && nextPattern.classList.contains('speech-pattern-item')) {
      currentPattern.setAttribute('tabindex', '-1');
      nextPattern.setAttribute('tabindex', '0');
      nextPattern.focus();

      // Announce to screen readers
      const patternNumber =
        nextPattern.querySelector('.pattern-number')?.textContent;
      if (patternNumber) {
        this.#announceToScreenReader(`Pattern ${patternNumber} focused`);
      }
    }
  }

  /**
   * Enhanced result announcement with navigation instructions
   *
   * @private
   * @param {object} result - Generated patterns result
   */
  #announceResults(result) {
    const count = result.speechPatterns.length;
    const characterName = result.characterName || 'your character';

    // More detailed screen reader announcement
    const message =
      `Generated ${count} speech patterns for ${characterName}. ` +
      `Patterns are now displayed. Use Tab to navigate to first pattern, ` +
      `then use arrow keys or J/K to move between patterns.`;

    this.#announceToScreenReader(message);
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

  /**
   * Initialize export controls
   *
   * @private
   */
  #initializeExportControls() {
    const formatSelector = this._getElement('exportFormat');
    const templateSelector = this._getElement('exportTemplate');

    if (formatSelector && this.#displayEnhancer) {
      // Populate format options
      const formats = this.#displayEnhancer.getSupportedExportFormats();
      formatSelector.innerHTML = formats
        .map(
          (format) =>
            `<option value="${format.id}" title="${format.description}">${format.name}</option>`
        )
        .join('');
    }

    if (templateSelector && this.#displayEnhancer) {
      // Populate template options
      const templates = this.#displayEnhancer.getAvailableTemplates();
      templateSelector.innerHTML = templates
        .map(
          (template) =>
            `<option value="${template.id}" title="${template.description}">${template.name}</option>`
        )
        .join('');
    }

    // Set initial visibility
    this.#updateTemplateVisibility();
  }

  /**
   * Update template selector visibility based on format
   *
   * @private
   */
  #updateTemplateVisibility() {
    const formatSelector = this._getElement('exportFormat');
    const templateGroup = this._getElement('templateGroup');

    if (formatSelector && templateGroup) {
      // Only show template selector for text format
      const showTemplates = formatSelector.value === 'txt';
      templateGroup.style.display = showTemplates ? 'flex' : 'none';
    }
  }
}

export default SpeechPatternsGeneratorController;
