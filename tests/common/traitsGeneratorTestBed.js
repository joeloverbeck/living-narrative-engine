/**
 * @file Test bed for traits generator integration testing
 * @see src/characterBuilder/services/TraitsGenerator.js
 * @see src/characterBuilder/controllers/TraitsGeneratorController.js
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test bed for traits generator integration testing
 * Provides mocks, test data factories, and UI simulation methods
 */
export class TraitsGeneratorTestBed extends BaseTestBed {
  constructor() {
    super();

    // Initialize mock services
    this.mockLLMService = jest.fn();
    this.mockEventBus = {
      dispatch: jest.fn(),
    };
    this.mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Initialize test data containers
    this.testData = {};
    this.services = {};
    this.uiElements = {};

    // Track UI state for testing
    this.uiState = {
      loadingState: false,
      resultsVisible: false,
      exportEnabled: false,
      errorVisible: false,
      errorMessage: '',
      validationErrors: {},
      generatedTraits: null,
    };

    // Track dispatched events for verification
    this.dispatchedEvents = [];
  }

  /**
   * Setup test bed (synchronous - no async needed)
   */
  setup() {
    this.setupMocks();
    this.setupTestData();
    this.setupServices();
    this.setupUIElements();
  }

  /**
   * Setup mock services
   */
  setupMocks() {
    // Reset mocks
    this.mockLLMService = jest.fn();
    this.mockEventBus = {
      dispatch: jest.fn((event) => {
        this.dispatchedEvents.push(event);
      }),
    };

    // Mock storage service - No database mock needed per policy
    this.mockStorageService = {
      initialize: jest.fn().mockResolvedValue(true),
      getThematicDirections: jest.fn().mockResolvedValue([]),
      getAllThematicDirections: jest.fn().mockResolvedValue([]),
      getClichesByDirectionId: jest.fn().mockResolvedValue([]),
      getCoreMotivationsByDirectionId: jest.fn().mockResolvedValue([]),
    };

    // Mock character builder service
    this.mockCharacterBuilderService = {
      generateTraits: jest.fn(),
      getDirectionsWithClichesAndMotivations: jest.fn().mockResolvedValue([]),
      hasClichesForDirection: jest.fn().mockResolvedValue(true),
      hasCoreMotivationsForDirection: jest.fn().mockResolvedValue(true),
    };

    // Mock traits generator service
    this.mockTraitsGeneratorService = {
      generateTraits: jest.fn(),
    };
  }

  /**
   * Setup test data factories
   */
  setupTestData() {
    this.testData.validConcept = this.createValidConcept();
    this.testData.validDirection = this.createValidDirection();
    this.testData.validUserInputs = this.createValidUserInputs();
    this.testData.validClichés = this.createValidCliches();
    this.testData.validTraitsResponse = this.createValidTraitsResponse();
  }

  /**
   * Setup service instances with mocks
   */
  setupServices() {
    // Store service references for test access
    this.services.characterBuilderService = this.mockCharacterBuilderService;
    this.services.traitsGeneratorService = this.mockTraitsGeneratorService;
    this.services.eventBus = this.mockEventBus;
    this.services.logger = this.mockLogger;
  }

  /**
   * Setup UI elements for interaction simulation
   */
  setupUIElements() {
    // Create mock UI elements
    this.uiElements = {
      generateButton: { 
        onclick: null, 
        disabled: false,
        id: 'generateButton'
      },
      exportButton: { 
        onclick: null, 
        disabled: false,
        hidden: true,
        id: 'exportButton'
      },
      retryButton: {
        onclick: null,
        disabled: false,
        id: 'retryButton'
      },
      coreMotivation: { 
        value: '', 
        oninput: null,
        id: 'coreMotivation'
      },
      internalContradiction: { 
        value: '', 
        oninput: null,
        id: 'internalContradiction'
      },
      centralQuestion: { 
        value: '', 
        oninput: null,
        id: 'centralQuestion'
      },
      resultsContainer: {
        hidden: true,
        innerHTML: ''
      },
      errorContainer: {
        hidden: true,
        textContent: ''
      },
      loadingIndicator: {
        hidden: true
      }
    };
  }

  // ============= UI Simulation Methods =============

  /**
   * Simulate button click
   *
   * @param {string} buttonId - Button element ID
   * @returns {Promise<any>} Result of button click handler
   */
  async simulateButtonClick(buttonId) {
    const button = this.uiElements[buttonId];
    if (button && button.onclick) {
      // Update UI state based on button
      if (buttonId === 'generateButton') {
        this.uiState.loadingState = true;
        this.uiState.errorVisible = false;
      }
      if (buttonId === 'retryButton') {
        this.uiState.loadingState = true;
        this.uiState.errorVisible = false;
      }
      return await button.onclick();
    }
    // If no onclick handler, still update state for generateButton
    if (buttonId === 'generateButton') {
      this.uiState.loadingState = true;
      this.uiState.errorVisible = false;
    }
    return null;
  }

  /**
   * Simulate input event
   *
   * @param {string} inputId - Input element ID
   */
  simulateInputEvent(inputId) {
    const input = this.uiElements[inputId];
    if (input && input.oninput) {
      input.oninput();
    }
  }

  /**
   * Simulate user input with validation trigger
   *
   * @param {string} fieldName - Field name
   * @param {string} value - Input value
   */
  simulateUserInput(fieldName, value) {
    if (this.uiElements[fieldName]) {
      this.uiElements[fieldName].value = value;
      this.simulateInputEvent(fieldName);
    }
  }

  /**
   * Set user input value
   *
   * @param {string} fieldName - Field name
   * @param {string} value - Input value
   */
  setUserInput(fieldName, value) {
    if (this.uiElements[fieldName]) {
      this.uiElements[fieldName].value = value;
    }
  }

  /**
   * Simulate page reload
   */
  simulatePageReload() {
    // Reset UI state
    this.uiState.loadingState = false;
    this.uiState.errorVisible = false;
    this.uiState.errorMessage = '';
    // Clear UI element values
    Object.keys(this.uiElements).forEach(key => {
      if (this.uiElements[key].value !== undefined) {
        this.uiElements[key].value = '';
      }
    });
  }

  /**
   * Simulate generation in progress state
   */
  simulateGenerationInProgress() {
    this.uiState.loadingState = true;
    this.uiState.resultsVisible = false;
    this.uiElements.loadingIndicator.hidden = false;
  }

  // ============= Test Data Factories =============

  /**
   * Create valid concept
   *
   * @returns {object} Valid concept data
   */
  createValidConcept() {
    return {
      id: `concept-${uuidv4()}`,
      concept: 'A battle-scarred veteran seeking redemption',
      description: 'A complex character with a troubled past'
    };
  }

  /**
   * Create valid thematic direction
   *
   * @returns {object} Valid direction data
   */
  createValidDirection() {
    return {
      id: `direction-${uuidv4()}`,
      title: 'Path to Redemption',
      theme: 'Exploring themes of guilt and forgiveness',
      description: 'A journey from darkness to light',
      coreTension: 'The struggle between past and future',
      uniqueTwist: 'Redemption through helping others'
    };
  }

  /**
   * Create valid user inputs
   *
   * @returns {object} Valid user input data
   */
  createValidUserInputs() {
    return {
      coreMotivation: 'To atone for past mistakes by protecting the innocent',
      internalContradiction: 'Believes they deserve punishment yet knows others need protection',
      centralQuestion: 'Can someone who has caused great harm ever truly be redeemed?'
    };
  }

  /**
   * Create valid clichés
   *
   * @returns {Array} Valid clichés array
   */
  createValidCliches() {
    return [
      { id: 'cliche-1', text: 'Brooding antihero with dark past' },
      { id: 'cliche-2', text: 'Reluctant mentor figure' },
      { id: 'cliche-3', text: 'Sacrificial hero complex' }
    ];
  }

  /**
   * Create valid traits response (all 12 categories)
   *
   * @returns {object} Valid traits response
   */
  createValidTraitsResponse() {
    return {
      names: [
        {
          name: 'Alaric Ironward',
          justification: 'A strong name suggesting nobility and military prowess'
        },
        {
          name: 'Marcus Thornfield',
          justification: 'Classic warrior name with grounded surname'
        },
        {
          name: 'Gareth Soulstone',
          justification: 'Evokes strength and weight of past experiences'
        }
      ],
      physicalDescription: 'A weathered man in his early forties with silver-streaked dark hair...',
      personality: [
        {
          trait: 'Protective Instinct',
          explanation: 'Driven to shield others from harm',
          behavioral_examples: ['Always positions himself between danger and innocents']
        }
      ],
      strengths: [
        {
          strength: 'Combat Experience',
          explanation: 'Years of battle have honed skills',
          application_examples: ['Can assess threats instantly']
        }
      ],
      weaknesses: [
        {
          weakness: 'Self-Punishment',
          explanation: 'Believes deserves suffering',
          manifestation_examples: ['Refuses comfort']
        }
      ],
      likes: ['Quiet moments', 'Helping others', 'Simple pleasures'],
      dislikes: ['Unnecessary violence', 'Arrogance', 'Waste'],
      fears: [
        {
          fear: 'Repeating past mistakes',
          root_cause: 'Traumatic event',
          behavioral_impact: 'Overly cautious'
        }
      ],
      goals: [
        {
          goal: 'Find redemption',
          motivation: 'Guilt over past',
          obstacles: ['Self-doubt', 'Past enemies']
        }
      ],
      notes: 'Additional character notes and background details',
      profile: 'Character profile summary combining all traits',
      secrets: [
        {
          secret: 'Hidden past identity',
          reason_for_hiding: 'Protect loved ones',
          consequences_if_revealed: 'Endangers allies'
        }
      ]
    };
  }

  /**
   * Create complete traits data for export testing
   *
   * @returns {object} Complete traits data
   */
  createCompleteTraitsData() {
    return this.createValidTraitsResponse();
  }

  // ============= Mock Response Methods =============

  /**
   * Mock successful LLM response
   *
   * @param {object} response - Response data
   */
  mockLLMResponse(response) {
    this.mockLLMService.mockResolvedValue(response);
    this.mockTraitsGeneratorService.generateTraits.mockResolvedValue(response);
    this.mockCharacterBuilderService.generateTraits.mockResolvedValue(response);
  }

  /**
   * Mock LLM service timeout
   */
  mockLLMTimeout() {
    const timeoutError = new Error('Request timeout');
    timeoutError.code = 'TIMEOUT';
    this.mockLLMService.mockRejectedValue(timeoutError);
    this.mockTraitsGeneratorService.generateTraits.mockRejectedValue(timeoutError);
    this.mockCharacterBuilderService.generateTraits.mockRejectedValue(timeoutError);
  }

  /**
   * Mock file download
   *
   * @returns {jest.Mock} Download spy
   */
  mockFileDownload() {
    const downloadSpy = jest.fn();
    global.document = {
      createElement: jest.fn(() => ({
        click: downloadSpy,
        href: '',
        download: ''
      }))
    };
    return downloadSpy;
  }

  // ============= State Getter Methods =============

  /**
   * Get loading state
   *
   * @returns {boolean} Loading state
   */
  getLoadingState() {
    return this.uiState.loadingState;
  }

  /**
   * Get results visibility
   *
   * @returns {boolean} Results visible
   */
  getResultsVisible() {
    return this.uiState.resultsVisible;
  }

  /**
   * Get export button enabled state
   *
   * @returns {boolean} Export enabled
   */
  getExportButtonEnabled() {
    return this.uiState.exportEnabled;
  }

  /**
   * Get error message
   *
   * @returns {string} Error message
   */
  getErrorMessage() {
    return this.uiState.errorMessage;
  }

  /**
   * Get validation error for field
   *
   * @param {string} fieldName - Field name
   * @returns {string|null} Validation error
   */
  getValidationError(fieldName) {
    return this.uiState.validationErrors[fieldName] || null;
  }

  /**
   * Get results container
   *
   * @returns {object} Results container element
   */
  getResultsContainer() {
    return this.uiElements.resultsContainer;
  }

  /**
   * Get export button
   *
   * @returns {object} Export button element
   */
  getExportButton() {
    return this.uiElements.exportButton;
  }

  /**
   * Get error container
   *
   * @returns {object} Error container element
   */
  getErrorContainer() {
    return this.uiElements.errorContainer;
  }

  /**
   * Get retry button
   *
   * @returns {object} Retry button element
   */
  getRetryButton() {
    return this.uiElements.retryButton;
  }

  // ============= Service Getter Methods =============

  /**
   * Get character builder service
   *
   * @returns {object} Character builder service mock
   */
  getCharacterBuilderService() {
    return this.services.characterBuilderService;
  }

  /**
   * Get traits generator service
   *
   * @returns {object} Traits generator service mock
   */
  getTraitsGeneratorService() {
    return this.services.traitsGeneratorService;
  }

  /**
   * Get controller
   *
   * @returns {object} Controller mock
   */
  getController() {
    // Return a mock controller with UI interaction methods
    return {
      initialize: jest.fn(),
      generateTraits: jest.fn()
    };
  }

  /**
   * Get event bus mock
   *
   * @returns {object} Event bus mock
   */
  getEventBusMock() {
    return this.mockEventBus;
  }

  // ============= Test Setup Methods =============

  /**
   * Setup valid UI state
   */
  setupValidUIState() {
    this.simulateUserInput('coreMotivation', 'Test motivation');
    this.simulateUserInput('internalContradiction', 'Test contradiction');
    this.simulateUserInput('centralQuestion', 'Test question?');
    this.uiState.errorVisible = false;
    this.uiState.loadingState = false;
  }

  /**
   * Setup generated traits in UI
   */
  setupGeneratedTraitsInUI() {
    this.uiState.generatedTraits = this.createValidTraitsResponse();
    this.uiState.resultsVisible = true;
    this.uiState.exportEnabled = true;
    this.uiElements.resultsContainer.hidden = false;
    this.uiElements.exportButton.hidden = false;
  }

  /**
   * Set generated traits
   *
   * @param {object} traits - Traits data
   */
  setGeneratedTraits(traits) {
    this.uiState.generatedTraits = traits;
  }

  /**
   * Setup directions with mixed requirements
   */
  setupDirectionsWithMixedRequirements() {
    const directions = [
      {
        direction: { id: 'dir-1', title: 'Direction with both' },
        hasClichés: true,
        hasMotivations: true
      },
      {
        direction: { id: 'dir-2', title: 'Direction with clichés only' },
        hasClichés: true,
        hasMotivations: false
      },
      {
        direction: { id: 'dir-3', title: 'Direction with motivations only' },
        hasClichés: false,
        hasMotivations: true
      }
    ];

    // Setup mock responses
    directions.forEach(dir => {
      this.mockCharacterBuilderService.hasClichesForDirection
        .mockImplementation(id => id === 'dir-1' || id === 'dir-2');
      this.mockCharacterBuilderService.hasCoreMotivationsForDirection
        .mockImplementation(id => id === 'dir-1' || id === 'dir-3');
    });

    // Only dir-1 should be eligible (has both)
    this.mockCharacterBuilderService.getDirectionsWithClichesAndMotivations
      .mockResolvedValue([directions[0]]);
  }

  // ============= Verification Methods =============

  /**
   * Verify traits structure
   *
   * @param {object} traits - Traits to verify
   */
  verifyTraitsStructure(traits) {
    expect(traits).toHaveProperty('names');
    expect(traits).toHaveProperty('physicalDescription');
    expect(traits).toHaveProperty('personality');
    expect(traits).toHaveProperty('strengths');
    expect(traits).toHaveProperty('weaknesses');
    expect(traits).toHaveProperty('likes');
    expect(traits).toHaveProperty('dislikes');
    expect(traits).toHaveProperty('fears');
    expect(traits).toHaveProperty('goals');
    expect(traits).toHaveProperty('notes');
    expect(traits).toHaveProperty('profile');
    expect(traits).toHaveProperty('secrets');
  }

  /**
   * Verify all trait categories present
   *
   * @param {object} result - Result to verify
   */
  verifyAllTraitCategoriesPresent(result) {
    this.verifyTraitsStructure(result);
  }

  /**
   * Verify LLM called with correct prompt
   */
  verifyLLMCalledWithCorrectPrompt() {
    expect(this.mockLLMService).toHaveBeenCalled();
    const calls = this.mockLLMService.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // Verify prompt contains expected elements
    const lastCall = calls[calls.length - 1];
    if (lastCall && lastCall[0]) {
      expect(lastCall[0]).toContain('traits');
    }
  }

  /**
   * Verify results display
   */
  verifyResultsDisplay() {
    expect(this.uiElements.resultsContainer.hidden).toBe(false);
    expect(this.uiState.resultsVisible).toBe(true);
  }

  /**
   * Verify enhanced results displayed
   */
  verifyEnhancedResultsDisplayed() {
    this.verifyResultsDisplay();
    expect(this.uiElements.resultsContainer.innerHTML).toBeTruthy();
  }

  /**
   * Get exported text
   *
   * @returns {string} Exported text
   */
  getExportedText() {
    if (!this.uiState.generatedTraits) return '';
    
    // Simulate export formatting
    let text = '=== CHARACTER TRAITS ===\n\n';
    
    text += 'NAMES:\n';
    this.uiState.generatedTraits.names?.forEach(n => {
      text += `- ${n.name}\n`;
    });
    
    text += '\nPHYSICAL DESCRIPTION:\n';
    text += this.uiState.generatedTraits.physicalDescription + '\n';
    
    text += '\nPERSONALITY:\n';
    text += '\nSTRENGTHS:\n';
    text += '\nWEAKNESSES:\n';
    text += '\nLIKES:\n';
    text += '\nDISLIKES:\n';
    text += '\nFEARS:\n';
    text += '\nGOALS:\n';
    text += '\nNOTES:\n';
    text += '\nPROFILE:\n';
    text += '\nSECRETS:\n';
    text += '\nUSER INPUTS:\n';
    
    return text;
  }

  /**
   * Execute traits generation
   *
   * @param {object} concept - Concept data
   * @param {object} direction - Direction data
   * @param {object} userInputs - User inputs
   * @param {Array} clichés - Clichés array
   * @returns {Promise<object>} Generation result
   */
  async executeTraitsGeneration(concept, direction, userInputs, clichés) {
    // Simulate the generation process
    this.mockLLMResponse(this.createValidTraitsResponse());
    
    const params = {
      concept,
      direction,
      userInputs,
      cliches: clichés
    };
    
    return await this.mockCharacterBuilderService.generateTraits(params);
  }

  /**
   * Cleanup test bed
   */
  cleanup() {
    jest.clearAllMocks();
    this.dispatchedEvents = [];
    this.uiState = {
      loadingState: false,
      resultsVisible: false,
      exportEnabled: false,
      errorVisible: false,
      errorMessage: '',
      validationErrors: {},
      generatedTraits: null,
    };
  }
}