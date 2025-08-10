/**
 * @file Test bed for ClichesGeneratorController testing
 */

import { jest } from '@jest/globals';
import { BaseTestBed } from './baseTestBed.js';
import { ClichesGeneratorController } from '../../src/clichesGenerator/controllers/ClichesGeneratorController.js';
import { Cliche } from '../../src/characterBuilder/models/cliche.js';
import { createEventBus } from './mockFactories/eventBus.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test bed for ClichesGeneratorController
 */
export class ClichesGeneratorControllerTestBed extends BaseTestBed {
  constructor() {
    super();

    // Create mock logger
    this.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };
    this.mockLogger = this.logger; // Keep backwards compatibility

    // Mock services
    this.mockCharacterBuilderService = {
      initialize: jest.fn().mockResolvedValue(true),
      getAllThematicDirections: jest.fn(),
      getCharacterConcept: jest.fn(),
      hasClichesForDirection: jest.fn(),
      getClichesByDirectionId: jest.fn(),
      generateClichesForDirection: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      createCharacterConcept: jest.fn(),
      updateCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      generateThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
    };

    this.mockClicheGenerator = {
      generateCliches: jest.fn(),
    };

    // Use the standard event bus factory that complies with ISafeEventDispatcher
    this.mockEventBus = createEventBus();

    this.mockSchemaValidator = {
      validate: jest.fn().mockReturnValue({ valid: true }),
      getErrors: jest.fn().mockReturnValue([]),
      validateAgainstSchema: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    };

    // Create DOM structure
    this.createDOMStructure();

    // Create controller instance
    this.controller = new ClichesGeneratorController({
      logger: this.logger,
      characterBuilderService: this.mockCharacterBuilderService,
      eventBus: this.mockEventBus,
      schemaValidator: this.mockSchemaValidator,
      clicheGenerator: this.mockClicheGenerator,
    });
  }

  /**
   * Create DOM structure for testing
   */
  createDOMStructure() {
    document.body.innerHTML = `
      <div id="cliches-generator-container">
        <form id="cliches-form">
          <select id="direction-selector">
            <option value="">-- Choose a thematic direction --</option>
          </select>
          <button id="generate-btn" type="submit" disabled>Generate Clichés</button>
        </form>
        
        <div id="selected-direction-display" style="display: none">
          <div id="direction-content"></div>
          <div id="direction-meta"></div>
        </div>
        
        <div id="original-concept-display" style="display: none">
          <div id="concept-content"></div>
        </div>
        
        <div id="cliches-container" class="empty-state">
          <p>Select a thematic direction to view or generate clichés.</p>
        </div>
        <div id="status-messages"></div>
        
        <button id="back-to-menu-btn">Back to Menu</button>
      </div>
    `;
  }

  /**
   * Create mock directions data
   *
   * @param count
   */
  createMockDirections(count = 3) {
    const directions = [];
    for (let i = 0; i < count; i++) {
      directions.push({
        id: `dir-${i + 1}`,
        conceptId: `concept-${Math.floor(i / 2) + 1}`,
        title: `Direction ${i + 1}`,
        description: `Description for direction ${i + 1}`,
        coreTension: `Core tension ${i + 1}`,
        createdAt: new Date().toISOString(),
      });
    }
    return directions;
  }

  /**
   * Create a single mock direction
   *
   * @param id
   */
  createMockDirection(id = 'dir-123') {
    return {
      id,
      conceptId: 'concept-1',
      title: 'Test Direction',
      description: 'Test direction description',
      coreTension: 'Test core tension',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Create mock concept
   *
   * @param id
   */
  createMockConcept(id = 'concept-1') {
    return {
      id,
      text: 'A test character concept that describes an interesting character.',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Create mock clichés data
   */
  createMockClichesData() {
    const categories = {
      names: ['John Smith', 'Jane Doe', 'Bob Johnson'],
      physicalDescriptions: ['Tall and muscular', 'Beautiful but mysterious'],
      personalityTraits: ['Brooding', 'Sarcastic', 'Rebellious'],
      skillsAbilities: ['Master swordsman', 'Expert hacker'],
      typicalLikes: ['Being alone', 'Justice'],
      typicalDislikes: ['Authority', 'Crowds'],
      commonFears: ['Losing loved ones', 'Being powerless'],
      genericGoals: ['Save the world', 'Get revenge'],
      backgroundElements: ['Orphaned at young age', 'Trained by mentor'],
      overusedSecrets: ['Secret royal bloodline', 'Hidden powers'],
      speechPatterns: ['I work alone', "This time it's personal"],
    };

    const tropesAndStereotypes = [
      'The chosen one',
      'Reluctant hero',
      'Dark past',
    ];

    return new Cliche({
      id: uuidv4(),
      directionId: 'dir-123',
      conceptId: 'concept-1',
      categories,
      tropesAndStereotypes,
      llmMetadata: {
        model: 'test-model',
        temperature: 0.7,
        tokens: 1000,
        responseTime: 500,
      },
    });
  }

  /**
   * Get DOM elements for testing
   */
  getDirectionSelector() {
    return document.getElementById('direction-selector');
  }

  getGenerateButton() {
    return document.getElementById('generate-btn');
  }

  getDirectionDisplay() {
    return document.getElementById('selected-direction-display');
  }

  getConceptDisplay() {
    return document.getElementById('original-concept-display');
  }

  getClichesContainer() {
    return document.getElementById('cliches-container');
  }

  getStatusMessages() {
    return document.getElementById('status-messages');
  }

  /**
   * Simulate direction selection
   *
   * @param directionId
   */
  async selectDirection(directionId) {
    const selector = this.getDirectionSelector();
    selector.value = directionId;

    const event = new Event('change', { bubbles: true });
    selector.dispatchEvent(event);

    // Wait for async operations
    await this.flushPromises();
  }

  /**
   * Trigger cliché generation
   */
  async triggerGeneration() {
    const button = this.getGenerateButton();
    button.disabled = false;

    const event = new Event('click', { bubbles: true });
    button.dispatchEvent(event);

    // Wait for async operations
    await this.flushPromises();
  }

  /**
   * Get error message from status messages
   */
  getErrorMessage() {
    const messages = this.getStatusMessages();
    const errorElement = messages.querySelector('.error');
    return errorElement ? errorElement.textContent : null;
  }

  /**
   * Get success message from status messages
   */
  getSuccessMessage() {
    const messages = this.getStatusMessages();
    const successElement = messages.querySelector('.success');
    return successElement ? successElement.textContent : null;
  }

  /**
   * Setup mock for successful direction load
   */
  setupSuccessfulDirectionLoad() {
    const directions = this.createMockDirections();
    const concepts = [
      this.createMockConcept('concept-1'),
      this.createMockConcept('concept-2'),
    ];

    this.mockCharacterBuilderService.getAllThematicDirections.mockResolvedValue(
      directions
    );

    concepts.forEach((concept) => {
      this.mockCharacterBuilderService.getCharacterConcept.mockResolvedValueOnce(
        concept
      );
    });

    return { directions, concepts };
  }

  /**
   * Setup mock for successful cliché generation
   */
  setupSuccessfulClicheGeneration() {
    const cliches = this.createMockClichesData();

    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      false
    );
    this.mockCharacterBuilderService.generateClichesForDirection.mockResolvedValue(
      cliches
    );

    return cliches;
  }

  /**
   * Setup mock for existing clichés
   */
  setupExistingCliches() {
    const cliches = this.createMockClichesData();

    this.mockCharacterBuilderService.hasClichesForDirection.mockResolvedValue(
      true
    );
    this.mockCharacterBuilderService.getClichesByDirectionId.mockResolvedValue(
      cliches
    );

    return cliches;
  }

  /**
   * Utility to flush promises
   */
  async flushPromises() {
    return new Promise((resolve) => setImmediate(resolve));
  }

  /**
   * Clean up test bed
   */
  cleanup() {
    // Clear all mocks
    jest.clearAllMocks();

    // Clear DOM
    document.body.innerHTML = '';

    // Call parent cleanup
    super.cleanup();
  }
}

export default ClichesGeneratorControllerTestBed;
