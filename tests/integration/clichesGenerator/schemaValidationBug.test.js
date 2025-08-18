/**
 * @file Integration test to reproduce cliches generation schema validation bug
 * @see https://github.com/joeloverbeck/living-narrative-engine/issues/xxx
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { ClicheGenerator } from '../../../src/characterBuilder/services/ClicheGenerator.js';
import { Cliche } from '../../../src/characterBuilder/models/cliche.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('Clichés Generator - Schema Validation Bug', () => {
  let testBed;
  let characterBuilderService;
  let clicheGenerator;
  let schemaValidator;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    // Initialize schema validator with required dependencies
    schemaValidator = new AjvSchemaValidator({
      logger: testBed.logger || console,
    });

    // Load cliche schema
    const schemaPath = process.cwd() + '/data/schemas/cliche.schema.json';
    const schemaContent = require('fs').readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);
    await schemaValidator.loadSchemaObject(
      'schema://living-narrative-engine/cliche.schema.json',
      schema
    );

    // Initialize services
    const { container } = testBed;
    characterBuilderService = testBed.characterBuilderService;

    // Create a simple mock for ClicheGenerator dependencies
    const mockLogger = testBed.logger || console;
    const mockLLMStrategyFactory = { getAIDecision: async () => '{}' };
    const mockLLMConfigManager = {
      getActiveConfiguration: async () => ({ configId: 'test' }),
      setActiveConfiguration: async () => true,
      loadConfiguration: async () => ({}),
    };
    const mockLLMJsonService = {
      clean: (str) => str,
      parseAndRepair: async (str) => JSON.parse(str),
    };

    clicheGenerator = new ClicheGenerator({
      logger: mockLogger,
      llmStrategyFactory: mockLLMStrategyFactory,
      llmConfigManager: mockLLMConfigManager,
      llmJsonService: mockLLMJsonService,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Schema Validation Issues', () => {
    it('should fail validation due to mismatched llmMetadata field names', async () => {
      // This test reproduces the exact issue from the error logs

      // Create mock LLM response data with the actual field names being used
      const mockGeneratedData = {
        categories: {
          names: ['Generic Warrior Name', 'Strongarm McStrong'],
          physicalDescriptions: [
            'Impossibly perfect physique',
            'Scars that make them look cool',
          ],
          personalityTraits: ['Stoic and emotionless', 'Secretly vulnerable'],
          skillsAbilities: ['Best at everything', 'Never loses a fight'],
          typicalLikes: [
            'Training alone',
            'Staring dramatically into distance',
          ],
          typicalDislikes: ['Showing weakness', 'Asking for help'],
          commonFears: ['Vulnerability', 'Being seen as weak'],
          genericGoals: ['Become the strongest', 'Prove their worth'],
          backgroundElements: ['Tragic past', 'Dead parents'],
          overusedSecrets: ['Hidden soft side', 'Secret identity'],
          speechPatterns: ['Few words', 'Dramatic one-liners'],
        },
        tropesAndStereotypes: [
          'The invincible warrior who is secretly lonely',
          'Professional competence as emotional armor',
        ],
        metadata: {
          // These are the actual field names being produced by ClicheGenerator
          modelId: 'openrouter-claude-sonnet-4-toolcalling',
          promptTokens: 1365,
          responseTokens: 1508,
          processingTime: 48241,
          promptVersion: '1.0.0',
          enhanced: false,
          qualityMetrics: null,
          validationWarnings: [],
          recommendations: [],
        },
      };

      // Try to create a Cliche instance with this data
      const cliche = new Cliche({
        directionId: 'test-direction-id',
        conceptId: 'test-concept-id',
        categories: mockGeneratedData.categories,
        tropesAndStereotypes: mockGeneratedData.tropesAndStereotypes,
        llmMetadata: mockGeneratedData.metadata, // This will have wrong field names
      });

      // Attempt to validate against schema - this should fail
      const isValid = schemaValidator.validateAgainstSchema(
        cliche.toJSON(),
        'schema://living-narrative-engine/cliche.schema.json'
      );

      // The validation should fail due to additional properties
      // The llmMetadata has wrong field names (modelId, promptTokens, etc.)
      // instead of the correct ones (model, tokens, etc.)
      expect(isValid).toBe(false);
    });

    it('should demonstrate the correct field mapping needed', async () => {
      // This test shows what the correct data structure should be

      const correctMetadata = {
        // Correct field names according to schema
        model: 'openrouter-claude-sonnet-4-toolcalling',
        tokens: 2873, // Total tokens (prompt + response)
        responseTime: 48241,
        promptVersion: '1.0.0',
        temperature: 0.7, // Optional but in schema
      };

      const cliche = new Cliche({
        directionId: 'test-direction-id',
        conceptId: 'test-concept-id',
        categories: {
          names: ['Test Name'],
          physicalDescriptions: ['Test Description'],
          personalityTraits: ['Test Trait'],
          skillsAbilities: ['Test Skill'],
          typicalLikes: ['Test Like'],
          typicalDislikes: ['Test Dislike'],
          commonFears: ['Test Fear'],
          genericGoals: ['Test Goal'],
          backgroundElements: ['Test Background'],
          overusedSecrets: ['Test Secret'],
          speechPatterns: ['Test Pattern'],
        },
        tropesAndStereotypes: ['Test Trope'],
        llmMetadata: correctMetadata,
      });

      // This should pass validation
      const isValid = schemaValidator.validateAgainstSchema(
        cliche.toJSON(),
        'schema://living-narrative-engine/cliche.schema.json'
      );

      expect(isValid).toBe(true);
    });
  });

  describe('Event Validation Issues', () => {
    it('should fail event validation due to missing conceptId', async () => {
      // This reproduces the event validation issue from the logs
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      const eventBus = testBed.container.resolve(
        tokens.IValidatedEventDispatcher
      );
      let eventDispatched = false;

      // Subscribe to capture any dispatch failures
      eventBus.subscribe('core:cliches_generation_started', () => {
        eventDispatched = true;
      });

      // This is what ClichesGeneratorController was trying to dispatch (WRONG)
      const result = await eventBus.dispatch(
        'core:cliches_generation_started',
        {
          directionId: 'test-direction-id',
          // Missing conceptId - instead it has concept object
          concept: {
            id: 'test-concept-id',
            text: 'Test concept text',
          },
          direction: {
            id: 'test-direction-id',
            title: 'Test Direction',
          },
          attempt: 1,
        }
      );

      // The dispatch should fail validation
      expect(result).toBe(false);
      expect(eventDispatched).toBe(false);
    });

    it('should dispatch event correctly with proper payload', async () => {
      const { tokens } = await import(
        '../../../src/dependencyInjection/tokens.js'
      );
      const eventBus = testBed.container.resolve(
        tokens.IValidatedEventDispatcher
      );
      let eventReceived = null;

      eventBus.subscribe('core:cliches_generation_started', (event) => {
        eventReceived = event;
      });

      // Correct payload structure
      const result = await eventBus.dispatch(
        'core:cliches_generation_started',
        {
          conceptId: 'test-concept-id', // Required field
          directionId: 'test-direction-id', // Required field
          directionTitle: 'Test Direction', // Optional field
        }
      );

      expect(result).toBe(true);
      expect(eventReceived).toBeDefined();
      expect(eventReceived.payload.conceptId).toBe('test-concept-id');
      expect(eventReceived.payload.directionId).toBe('test-direction-id');
    });
  });
});
