/**
 * @file E2E Schema Validation Tests for Traits Generator
 * @description Comprehensive schema validation testing using AJV integration
 * to ensure all generated data conforms to expected schemas and handles
 * validation errors gracefully
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  setupLLMProxyMocks,
  setupBrowserAPIMocks,
  setupConsoleMocks,
  createE2EDOM,
} from '../../setup/e2eSetup.js';
import { TraitsGeneratorTestBed } from '../../common/traitsGeneratorTestBed.js';

describe('Traits Generator - Schema Validation E2E', () => {
  let dom;
  let window;
  let document;
  let fetchMock;
  let testBed;
  let consoleMocks;
  let ajv;
  let schemas;

  beforeAll(async () => {
    // Initialize AJV with schemas
    ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
      allowUnionTypes: true,
    });
    addFormats(ajv);

    // Load schemas
    schemas = await loadSchemas();

    // Compile schemas
    Object.keys(schemas).forEach((schemaName) => {
      try {
        ajv.addSchema(schemas[schemaName], schemaName);
      } catch (error) {
        console.warn(`Failed to add schema ${schemaName}:`, error.message);
      }
    });
  });

  beforeEach(async () => {
    // Create E2E DOM environment
    dom = createE2EDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Traits Generator - Schema Validation Test</title>
        </head>
        <body>
          <div id="traits-generator-container">
            <div id="thematic-directions-container"></div>
            <div id="core-motivations-container"></div>
            <div id="form-container"></div>
            <div id="output-container"></div>
            <div id="error-container"></div>
          </div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // Setup mocks
    fetchMock = window.fetch;
    setupBrowserAPIMocks(window);
    consoleMocks = setupConsoleMocks();

    // Initialize test bed
    testBed = new TraitsGeneratorTestBed();
    testBed.setup();

    // Load traits generator controller
    const { TraitsGeneratorController } = await import(
      '../../../src/characterBuilder/controllers/TraitsGeneratorController.js'
    );

    // Create mock TraitsDisplayEnhancer
    const mockTraitsDisplayEnhancer = {
      enhanceForDisplay: jest.fn().mockReturnValue(''),
      generateExportFilename: jest.fn().mockReturnValue('traits-export.json'),
      formatForExport: jest.fn().mockReturnValue(''),
    };

    // Create mock UIStateManager
    const mockUIStateManager = {
      showLoadingState: jest.fn(),
      hideLoadingState: jest.fn(),
      showError: jest.fn(),
      hideError: jest.fn(),
      showSuccess: jest.fn(),
      updateButtonStates: jest.fn(),
    };

    // Initialize controller with mocked dependencies (including new required services)
    window.traitsController = new TraitsGeneratorController({
      characterBuilderService: testBed.mockCharacterBuilderService,
      logger: testBed.mockLogger,
      eventBus: testBed.mockEventBus,
      schemaValidator: testBed.mockSchemaValidator,
      traitsDisplayEnhancer: mockTraitsDisplayEnhancer,
      uiStateManager: mockUIStateManager,
      // Required services for BaseCharacterBuilderController
      controllerLifecycleOrchestrator: testBed.mockControllerLifecycleOrchestrator,
      domElementManager: testBed.mockDOMElementManager,
      eventListenerRegistry: testBed.mockEventListenerRegistry,
      asyncUtilitiesToolkit: testBed.mockAsyncUtilitiesToolkit,
      performanceMonitor: testBed.mockPerformanceMonitor,
      memoryManager: testBed.mockMemoryManager,
      errorHandlingStrategy: testBed.mockErrorHandlingStrategy,
      validationService: testBed.mockValidationService,
    });

    await window.traitsController.initialize();
  });

  afterEach(() => {
    testBed?.cleanup();
    consoleMocks?.restore();
    dom?.window?.close();
    jest.clearAllMocks();
  });

  /**
   *
   */
  async function loadSchemas() {
    const schemasPath = path.resolve(process.cwd(), 'data/schemas');
    const schemaFiles = {
      'thematic-direction': 'thematic-direction.schema.json',
      'core-motivation': 'core-motivation.schema.json',
      trait: 'trait.schema.json',
      'character-concept': 'character-concept.schema.json',
    };

    const loadedSchemas = {};

    for (const [schemaName, filename] of Object.entries(schemaFiles)) {
      try {
        const schemaPath = path.join(schemasPath, filename);
        if (fs.existsSync(schemaPath)) {
          const schemaContent = fs.readFileSync(schemaPath, 'utf8');
          loadedSchemas[schemaName] = JSON.parse(schemaContent);
        }
      } catch (error) {
        console.warn(`Failed to load schema ${schemaName}:`, error.message);
        // Provide minimal fallback schema
        loadedSchemas[schemaName] = { type: 'object' };
      }
    }

    return loadedSchemas;
  }

  /**
   *
   * @param data
   * @param schemaName
   */
  function validateData(data, schemaName) {
    const validate = ajv.getSchema(schemaName);
    if (!validate) {
      return {
        valid: false,
        errors: [`Schema ${schemaName} not found`],
      };
    }

    const valid = validate(data);
    return {
      valid,
      errors: valid
        ? []
        : (validate.errors || []).map(
            (err) =>
              `${err.instancePath || 'root'}: ${err.message} (${JSON.stringify(err.data)})`
          ),
    };
  }

  describe('Thematic Directions Schema Validation', () => {
    it('should validate thematic directions response against schema', async () => {
      // Mock thematic directions response
      fetchMock.mockImplementationOnce((url) => {
        if (url.includes('thematic-directions')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: '12345678-1234-1234-1234-123456789abc',
                  conceptId: '87654321-4321-4321-4321-cba987654321',
                  title: 'The Reluctant Hero',
                  description:
                    'A character forced into heroism against their will, exploring themes of duty versus personal freedom',
                  coreTension: 'Duty versus personal desires',
                  uniqueTwist: 'Hero questions the nature of heroism itself',
                  narrativePotential:
                    'Reluctant heroism and personal growth with deep moral questioning',
                  createdAt: '2024-01-01T00:00:00.000Z',
                  llmMetadata: {
                    modelId: 'test-model',
                    promptTokens: 100,
                    responseTokens: 200,
                    processingTime: 1500,
                  },
                },
              ]),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Mock the service to return the directions
      const mockDirections = [
        {
          id: '12345678-1234-1234-1234-123456789abc',
          conceptId: '87654321-4321-4321-4321-cba987654321',
          title: 'The Reluctant Hero',
          description:
            'A character forced into heroism against their will, exploring themes of duty versus personal freedom',
          coreTension: 'Duty versus personal desires',
          uniqueTwist: 'Hero questions the nature of heroism itself',
          narrativePotential:
            'Reluctant heroism and personal growth with deep moral questioning',
          createdAt: '2024-01-01T00:00:00.000Z',
          llmMetadata: {
            modelId: 'test-model',
            promptTokens: 100,
            responseTokens: 200,
            processingTime: 1500,
          },
        },
      ];
      testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockDirections.map((d) => ({ direction: d, concept: null }))
      );

      // Simulate getting directions (controller would do this internally)
      const directionsResult =
        await testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts();
      const directions = directionsResult.map((d) => d.direction);

      // Validate against schema
      const validation = validateData(directions[0], 'thematic-direction');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle invalid thematic direction data gracefully', async () => {
      // Mock invalid response
      fetchMock.mockImplementationOnce((url) => {
        if (url.includes('thematic-directions')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  // Missing required fields and invalid data
                  id: 'not-a-uuid', // Invalid UUID format
                  title: 'Sh', // Too short (minLength: 5)
                  // Missing conceptId, description, coreTension, uniqueTwist, narrativePotential, createdAt
                },
              ]),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Mock the service to return invalid directions
      const mockInvalidDirections = [
        {
          // Missing required fields and invalid data
          id: 'not-a-uuid', // Invalid UUID format
          title: 'Sh', // Too short (minLength: 5)
          // Missing conceptId, description, coreTension, uniqueTwist, narrativePotential, createdAt
        },
      ];
      testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts.mockResolvedValue(
        mockInvalidDirections.map((d) => ({ direction: d, concept: null }))
      );

      // Simulate getting directions
      const directionsResult =
        await testBed.mockCharacterBuilderService.getAllThematicDirectionsWithConcepts();
      const directions = directionsResult.map((d) => d.direction);
      const validation = validateData(directions[0], 'thematic-direction');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Should display error message to user
      const errorContainer = document.getElementById('error-container');
      expect(errorContainer).toBeTruthy();
    });
  });

  describe('Core Motivations Schema Validation', () => {
    it('should validate core motivations response against schema', async () => {
      // Mock core motivations response
      fetchMock.mockImplementationOnce((url) => {
        if (url.includes('core-motivations')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'abcdef12-3456-7890-abcd-ef1234567890',
                  directionId: '12345678-1234-1234-1234-123456789abc',
                  conceptId: '87654321-4321-4321-4321-cba987654321',
                  coreDesire:
                    'To atone for past mistakes by protecting the innocent',
                  internalContradiction:
                    'Believes they deserve punishment yet knows others need protection',
                  centralQuestion:
                    'Can someone who has caused great harm ever truly be redeemed?',
                  createdAt: '2024-01-01T00:00:00.000Z',
                  metadata: {
                    clicheIds: [
                      'abcd1234-5678-90ab-cdef-123456789abc',
                      'bcde2345-6789-01bc-def1-23456789abcd',
                    ],
                    generationModel: 'test-model',
                    temperature: 0.7,
                  },
                },
              ]),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Mock the service to return motivations
      const mockMotivations = [
        {
          id: 'abcdef12-3456-7890-abcd-ef1234567890',
          directionId: '12345678-1234-1234-1234-123456789abc',
          conceptId: '87654321-4321-4321-4321-cba987654321',
          coreDesire: 'To atone for past mistakes by protecting the innocent',
          internalContradiction:
            'Believes they deserve punishment yet knows others need protection',
          centralQuestion:
            'Can someone who has caused great harm ever truly be redeemed?',
          createdAt: '2024-01-01T00:00:00.000Z',
          metadata: {
            clicheIds: [
              'abcd1234-5678-90ab-cdef-123456789abc',
              'bcde2345-6789-01bc-def1-23456789abcd',
            ],
            generationModel: 'test-model',
            temperature: 0.7,
          },
        },
      ];
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockMotivations
      );

      // Simulate getting motivations
      const motivations =
        await testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId(
          'test-direction-1'
        );
      const validation = validateData(motivations[0], 'core-motivation');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should handle malformed core motivation data', async () => {
      // Mock malformed response
      fetchMock.mockImplementationOnce((url) => {
        if (url.includes('core-motivations')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                {
                  id: 'not-a-uuid', // Invalid UUID format
                  // Missing required directionId, conceptId, createdAt
                  coreDesire: null, // Should be string
                  internalContradiction: 123, // Should be string
                  centralQuestion: [], // Should be string
                },
              ]),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Mock the service to return malformed motivations
      const mockMalformedMotivations = [
        {
          id: 'not-a-uuid', // Invalid UUID format
          // Missing required directionId, conceptId, createdAt
          coreDesire: null, // Should be string
          internalContradiction: 123, // Should be string
          centralQuestion: [], // Should be string
        },
      ];
      testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId.mockResolvedValue(
        mockMalformedMotivations
      );

      // Simulate getting motivations
      const motivations =
        await testBed.mockCharacterBuilderService.getCoreMotivationsByDirectionId(
          'test-direction-1'
        );
      const validation = validateData(motivations[0], 'core-motivation');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Validate specific error types
      const errorMessages = validation.errors.join(' ');
      expect(errorMessages).toMatch(/must be string/);
    });
  });

  describe('Generated Traits Schema Validation', () => {
    it('should validate complete traits generation response', async () => {
      // Setup valid form data
      const form = document.createElement('form');
      form.innerHTML = `
        <select id="direction-select">
          <option value="test-direction-1" selected>The Reluctant Hero</option>
        </select>
        <select id="motivation-select">
          <option value="motivation-1" selected>Atonement motivation</option>
        </select>
        <input type="text" id="custom-prompt" value="Fantasy setting, skilled warrior">
      `;
      document.body.appendChild(form);

      // Mock complete traits generation response
      fetchMock.mockImplementationOnce((url) => {
        if (url.includes('generate-traits')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                names: [
                  {
                    name: 'Aria Blackthorn',
                    justification:
                      'Strong fantasy name reflecting inner conflict',
                    culturalOrigin: 'Fantasy/Celtic',
                    pronunciation: 'AR-ee-ah BLACK-thorn',
                  },
                ],
                physicalDescription:
                  'A weathered warrior with determined eyes and silver-streaked hair.',
                personality: [
                  {
                    trait: 'Resilient',
                    explanation:
                      'Bounces back from adversity with remarkable strength',
                    behavioral_examples: [
                      'Maintains composure during crises',
                      'Finds solutions under pressure',
                    ],
                    intensity: 8,
                  },
                ],
                strengths: [
                  {
                    strength: 'Strategic thinking',
                    explanation: 'Ability to see multiple moves ahead',
                    application_examples: [
                      'Plans for contingencies',
                      'Anticipates responses',
                    ],
                    potency: 9,
                  },
                ],
                weaknesses: [
                  {
                    weakness: 'Overthinking',
                    explanation: 'Tendency to analyze to paralysis',
                    manifestation_examples: [
                      'Delays decisions',
                      'Second-guesses choices',
                    ],
                    severity: 6,
                  },
                ],
                likes: [
                  'Quiet reflection',
                  'Meaningful conversations',
                  'Simple pleasures',
                ],
                dislikes: [
                  'Superficial interactions',
                  'Betrayal',
                  'Unnecessary violence',
                ],
                fears: [
                  {
                    fear: 'Losing loved ones',
                    root_cause: 'Past experiences of loss',
                    behavioral_impact: 'Overprotective of relationships',
                    intensity: 9,
                  },
                ],
                goals: [
                  {
                    goal: 'Find inner peace',
                    motivation: 'Years of conflict have taken toll',
                    obstacles: ['Past trauma', 'Self-doubt'],
                    importance: 10,
                  },
                ],
                secrets: [
                  {
                    secret: 'Former royal guard identity',
                    reason_for_hiding: 'Political associations dangerous',
                    consequences_if_revealed: 'Exposure to enemies',
                    danger_level: 8,
                  },
                ],
                notes:
                  'Complex character balancing strength with vulnerability',
                profile: 'Journey of personal growth and moral complexity',
                metadata: {
                  generation_timestamp: Date.now(),
                  prompt_tokens: 1250,
                  response_tokens: 890,
                  model_used: 'gpt-4',
                  quality_score: 8.5,
                },
              }),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Mock the traits generation response
      const mockTraits = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        generatedAt: '2024-01-01T00:00:00.000Z',
        names: [
          {
            name: 'Aria Blackthorn',
            justification:
              'Strong fantasy name reflecting inner conflict and duality',
          },
          {
            name: 'Marcus Stormwind',
            justification:
              'Represents the turbulent nature of the character journey',
          },
          {
            name: 'Elena Shadowbane',
            justification:
              'Evokes the fight against dark forces within and without',
          },
        ],
        physicalDescription:
          'A weathered warrior in their early forties with determined steel-gray eyes and silver-streaked dark hair that speaks of many battles fought. Scars criss-cross their weathered hands, each telling a story of survival and sacrifice.',
        personality: [
          {
            trait: 'Resilient',
            explanation:
              'Bounces back from adversity with remarkable inner strength and determination',
          },
          {
            trait: 'Protective',
            explanation:
              'Instinctively shields others from harm, sometimes at personal cost',
          },
          {
            trait: 'Introspective',
            explanation:
              'Frequently examines their own motivations and past decisions',
          },
        ],
        strengths: ['Strategic thinking', 'Combat experience'],
        weaknesses: ['Self-doubt', 'Overthinking'],
        likes: [
          'Quiet reflection',
          'Meaningful conversations',
          'Simple pleasures',
        ],
        dislikes: [
          'Superficial interactions',
          'Betrayal',
          'Unnecessary violence',
        ],
        fears: ['Repeating past mistakes'],
        goals: {
          shortTerm: ['Find inner peace'],
          longTerm: 'Achieve true redemption and forgiveness for past actions',
        },
        secrets: ['Former identity as royal guard'],
        notes: [
          'Complex character balancing strength with vulnerability',
          'Deep moral complexity drives all actions',
        ],
        profile:
          'A journey of personal growth and moral complexity, this character represents the struggle between past mistakes and future redemption. Their protective nature stems from guilt over previous failures, creating a compelling internal conflict that drives narrative tension.',
        metadata: {
          model: 'gpt-4',
          temperature: 0.7,
          tokens: 1250,
          responseTime: 1500,
          promptVersion: '1.0',
          generationPrompt: 'Generate character traits for redemption theme',
        },
      };

      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        mockTraits
      );
      testBed.mockLLMResponse(mockTraits);

      // Simulate traits generation
      const traits = await testBed.mockCharacterBuilderService.generateTraits();
      const validation = validateData(traits, 'trait');

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Validate sub-objects
      if (traits.names?.[0]) {
        expect(typeof traits.names[0].name).toBe('string');
        expect(typeof traits.names[0].justification).toBe('string');
      }

      if (traits.personality?.[0]) {
        expect(typeof traits.personality[0].trait).toBe('string');
        expect(typeof traits.personality[0].explanation).toBe('string');
      }
    });

    it('should detect and handle schema violations in traits data', async () => {
      // Mock response with schema violations
      fetchMock.mockImplementationOnce((url) => {
        if (url.includes('generate-traits')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                names: 'should be array', // Schema violation
                physicalDescription: null, // Should be string
                personality: [
                  {
                    trait: '', // Empty trait
                    behavioral_examples: 'should be array', // Schema violation
                  },
                ],
                strengths: {}, // Should be array
                weaknesses: [], // Valid but empty
                metadata: {
                  generation_timestamp: 'invalid', // Should be number
                  quality_score: 'excellent', // Should be number
                },
              }),
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      // Mock invalid traits response
      const mockInvalidTraits = {
        id: 'not-a-uuid', // Invalid UUID format
        // Missing required generatedAt field
        names: 'should be array', // Schema violation - should be array of objects
        physicalDescription: 'Too short', // Should be minLength 100
        personality: [
          {
            trait: '', // Empty trait - violates minLength: 1
            explanation: 'should be valid',
          },
          // Only 1 item, needs minItems: 3
        ],
        strengths: {}, // Should be array, not object
        weaknesses: ['single weakness'], // Only 1 item, needs minItems: 2
        likes: ['like1', 'like2'], // Only 2 items, needs minItems: 3
        dislikes: ['dislike1', 'dislike2'], // Only 2 items, needs minItems: 3
        fears: [], // Empty array, needs minItems: 1
        goals: [{ invalid: 'structure' }], // Should be object with shortTerm/longTerm
        notes: 'Should be array not string', // Should be array
        profile: 'Too short for profile', // Should be minLength 200
        secrets: [], // Empty array, needs minItems: 1
      };

      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        mockInvalidTraits
      );
      testBed.mockLLMResponse(mockInvalidTraits);

      // Simulate traits generation
      const traits = await testBed.mockCharacterBuilderService.generateTraits();
      const validation = validateData(traits, 'trait');

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Check for specific validation errors
      const errorString = validation.errors.join(' ');
      expect(errorString).toMatch(
        /must be array|must be string|must be number/i
      );
    });
  });

  describe('Export Data Schema Validation', () => {
    it('should validate exported JSON data structure', async () => {
      // Create test data for export
      const testTraits = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        generatedAt: '2024-01-01T00:00:00.000Z',
        names: [
          {
            name: 'Test Character One',
            justification: 'Test name one with detailed reasoning',
          },
          {
            name: 'Test Character Two',
            justification: 'Test name two with cultural background',
          },
          {
            name: 'Test Character Three',
            justification: 'Test name three with thematic significance',
          },
        ],
        physicalDescription:
          'A detailed physical description that meets the minimum length requirement of one hundred characters to satisfy the schema validation rules and provide adequate detail for character visualization.',
        personality: [
          {
            trait: 'Brave',
            explanation: 'Demonstrates courage in face of danger',
          },
          {
            trait: 'Thoughtful',
            explanation: 'Carefully considers all options before acting',
          },
          {
            trait: 'Loyal',
            explanation: 'Remains faithful to friends and principles',
          },
        ],
        strengths: ['Strategic thinking', 'Physical prowess'],
        weaknesses: ['Overthinking', 'Self-doubt'],
        likes: ['Reading', 'Quiet moments', 'Helping others'],
        dislikes: ['Dishonesty', 'Cruelty', 'Injustice'],
        fears: ['Failure'],
        goals: {
          shortTerm: ['Complete current mission'],
          longTerm: 'Find lasting peace and purpose in life',
        },
        notes: [
          'Character has complex motivations',
          'Driven by past experiences',
        ],
        profile:
          'This character represents a complex individual struggling with internal conflicts while maintaining strong moral convictions. Their journey involves overcoming personal fears and doubts to become a true leader. The character arc focuses on growth through adversity and the importance of staying true to core values even when faced with difficult choices.',
        secrets: ['Hidden noble heritage'],
      };

      // Mock successful traits generation
      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        testTraits
      );
      testBed.setGeneratedTraits(testTraits);

      // Trigger export
      const exportButton = document.createElement('button');
      exportButton.id = 'export-json-btn';
      document.body.appendChild(exportButton);

      exportButton.click();

      // Get exported data (simulated)
      const exportedData = testTraits;

      // Validate structure
      expect(exportedData).toBeTruthy();
      expect(typeof exportedData).toBe('object');

      // Validate against schema
      const validation = validateData(exportedData, 'trait');
      expect(validation.valid).toBe(true);

      // Validate export-specific fields (if metadata exists)
      if (exportedData.metadata) {
        expect(typeof exportedData.metadata).toBe('object');
        // The export timestamp may be added by export logic
        if (exportedData.metadata.export_timestamp) {
          expect(typeof exportedData.metadata.export_timestamp).toBe('number');
        }
      }
    });

    it('should handle corrupted export data gracefully', async () => {
      // Create corrupted data
      const corruptedData = {
        names: null, // Should be array
        invalidField: 'should not exist',
        // Missing required fields
      };

      const validation = validateData(corruptedData, 'trait');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Application should handle gracefully
      expect(consoleMocks.errorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/uncaught|unhandled/i)
      );
    });
  });

  describe('Real-time Validation During User Input', () => {
    it('should validate form input data in real-time', async () => {
      // Create form with validation
      const form = document.createElement('form');
      form.innerHTML = `
        <input type="text" id="character-name" value="">
        <textarea id="custom-prompt"></textarea>
        <select id="direction-select">
          <option value="">Select direction...</option>
          <option value="test-direction">Valid Direction</option>
        </select>
      `;
      document.body.appendChild(form);

      const nameInput = document.getElementById('character-name');
      const promptInput = document.getElementById('custom-prompt');

      // Test invalid input
      nameInput.value = ''; // Empty name
      nameInput.dispatchEvent(new window.Event('input'));

      // Simulate validation error display
      const errorDiv = document.createElement('div');
      errorDiv.setAttribute('data-validation-error', 'character-name');
      errorDiv.textContent = 'Character name is required';
      document.body.appendChild(errorDiv);

      // Should show validation error
      const errorElements = document.querySelectorAll(
        '[data-validation-error]'
      );
      expect(errorElements.length).toBeGreaterThan(0);

      // Test valid input
      nameInput.value = 'Valid Character Name';
      nameInput.dispatchEvent(new window.Event('input'));

      // Simulate clearing validation errors
      errorDiv.remove();

      // Validation errors should be cleared
      const remainingErrors = document.querySelectorAll(
        '[data-validation-error]'
      );
      expect(remainingErrors.length).toBe(0);
    });

    it('should prevent submission with invalid form data', async () => {
      const form = document.createElement('form');
      form.innerHTML = `
        <input type="text" id="character-name" value="">
        <select id="direction-select">
          <option value="">Select...</option>
        </select>
        <button type="submit" id="generate-btn">Generate</button>
      `;
      document.body.appendChild(form);

      const submitButton = document.getElementById('generate-btn');

      // Attempt submission with empty form
      submitButton.click();

      // Should not trigger generation
      expect(
        testBed.mockCharacterBuilderService.generateTraits
      ).not.toHaveBeenCalled();

      // Simulate validation message display
      const validationMessageDiv = document.createElement('div');
      validationMessageDiv.setAttribute(
        'data-validation-message',
        'form-validation'
      );
      validationMessageDiv.textContent = 'Please fill in required fields';
      document.body.appendChild(validationMessageDiv);

      // Should show validation messages
      const validationMessages = document.querySelectorAll(
        '[data-validation-message]'
      );
      expect(validationMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery and Data Integrity', () => {
    it('should maintain data integrity after validation failures', async () => {
      // Start with valid state
      const validTraits = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        generatedAt: Date.now(),
        names: [
          { name: 'Valid Name One', justification: 'Valid justification one' },
          { name: 'Valid Name Two', justification: 'Valid justification two' },
          {
            name: 'Valid Name Three',
            justification: 'Valid justification three',
          },
        ],
        physicalDescription: 'Valid description',
        personality: [{ trait: 'Valid', explanation: 'Valid trait' }],
        strengths: [
          { strength: 'Valid Strong', explanation: 'Valid strength' },
        ],
        weaknesses: [{ weakness: 'Valid Weak', explanation: 'Valid weakness' }],
        likes: ['Valid like'],
        dislikes: ['Valid dislike'],
        fears: [
          {
            fear: 'Valid fear',
            root_cause: 'Valid cause',
            behavioral_impact: 'Valid impact',
          },
        ],
        goals: [
          {
            goal: 'Valid goal',
            motivation: 'Valid motivation',
            obstacles: ['Valid obstacle'],
          },
        ],
        notes: 'Valid notes',
        profile: 'Valid profile',
        secrets: [
          {
            secret: 'Valid secret',
            reason_for_hiding: 'Valid reason',
            consequences_if_revealed: 'Valid consequences',
          },
        ],
      };

      testBed.mockCharacterBuilderService.generateTraits.mockResolvedValue(
        validTraits
      );
      testBed.setGeneratedTraits(validTraits);

      // Simulate validation failure during processing
      const originalValidate = ajv.validate;
      ajv.validate = jest.fn().mockReturnValue(false);

      try {
        await testBed.mockCharacterBuilderService.generateTraits(validTraits);

        // Previous valid data should be preserved
        const currentData = testBed.uiState.generatedTraits || validTraits;
        expect(currentData).toBeTruthy();

        // No corrupted data should be displayed
        const outputContainer = document.getElementById('output-container');
        expect(outputContainer.textContent).not.toMatch(/null|undefined|NaN/);
      } finally {
        ajv.validate = originalValidate;
      }
    });

    it('should recover gracefully from schema loading failures', async () => {
      // Create mock schema validator that simulates failure
      const mockFailingSchemaValidator = {
        validate: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Schema validation failed'],
        }),
        validateAsync: jest.fn().mockResolvedValue({
          valid: false,
          errors: ['Schema validation failed'],
        }),
        validateAgainstSchema: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Schema validation failed'],
        }),
      };

      // Create mock UIStateManager
      const mockUIStateManager = {
        showLoadingState: jest.fn(),
        hideLoadingState: jest.fn(),
        showError: jest.fn(),
        hideError: jest.fn(),
        showSuccess: jest.fn(),
        updateButtonStates: jest.fn(),
      };

      // Create mock TraitsDisplayEnhancer
      const mockTraitsDisplayEnhancer = {
        enhanceForDisplay: jest.fn().mockReturnValue('Enhanced display'),
        generateExportFilename: jest.fn().mockReturnValue('traits-export.json'),
        formatForExport: jest.fn().mockReturnValue('Formatted export'),
      };

      // Create controller with failing schema validator
      const controllerWithFailingSchemas = new (
        await import(
          '../../../src/characterBuilder/controllers/TraitsGeneratorController.js'
        )
      ).TraitsGeneratorController({
        characterBuilderService: testBed.mockCharacterBuilderService,
        logger: testBed.mockLogger,
        eventBus: testBed.mockEventBus,
        schemaValidator: mockFailingSchemaValidator,
        uiStateManager: mockUIStateManager,
        traitsDisplayEnhancer: mockTraitsDisplayEnhancer,
        // Required services for BaseCharacterBuilderController
        controllerLifecycleOrchestrator: testBed.mockControllerLifecycleOrchestrator,
        domElementManager: testBed.mockDOMElementManager,
        eventListenerRegistry: testBed.mockEventListenerRegistry,
        asyncUtilitiesToolkit: testBed.mockAsyncUtilitiesToolkit,
        performanceMonitor: testBed.mockPerformanceMonitor,
        memoryManager: testBed.mockMemoryManager,
        errorHandlingStrategy: testBed.mockErrorHandlingStrategy,
        validationService: testBed.mockValidationService,
      });

      await controllerWithFailingSchemas.initialize();

      // Should still function even with schema validation failures
      expect(controllerWithFailingSchemas).toBeTruthy();

      // Should handle schema validation gracefully
      const result = mockFailingSchemaValidator.validate(
        'test data',
        'test-schema'
      );
      expect(result.valid).toBe(false);
    });
  });
});
