/**
 * @file Integration tests for traits generator eligibility detection
 * @description Tests the proper detection of thematic directions with core motivations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CharacterDatabase } from '../../../src/characterBuilder/storage/characterDatabase.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { TraitsGeneratorController } from '../../../src/characterBuilder/controllers/TraitsGeneratorController.js';
import { CoreMotivation } from '../../../src/characterBuilder/models/coreMotivation.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import { createEventBus } from '../../common/mockFactories/eventBus.js';
import { v4 as uuidv4 } from 'uuid';

describe('TraitsGeneratorController - Eligibility Detection', () => {
  let database;
  let characterBuilderService;
  let controller;
  let logger;
  let eventBus;
  let container;

  beforeEach(async () => {
    logger = createMockLogger();
    eventBus = createEventBus();
    
    // Set up database
    database = new CharacterDatabase({ logger });
    await database.initialize();
    
    // Create mock dependencies
    const storageService = {
      initialize: jest.fn(),
      storeCharacterConcept: jest.fn(),
      listCharacterConcepts: jest.fn(),
      getCharacterConcept: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      storeThematicDirections: jest.fn(),
      getThematicDirections: jest.fn(),
      getAllThematicDirections: jest.fn().mockResolvedValue([]),
    };
    
    const directionGenerator = {
      generateDirections: jest.fn(),
    };
    
    const schemaValidator = {
      validateAgainstSchema: jest.fn().mockReturnValue({ valid: true }),
    };
    
    const clicheGenerator = {
      generate: jest.fn(),
    };
    
    const traitsGenerator = {
      generate: jest.fn(),
    };
    
    // Create character builder service
    characterBuilderService = new CharacterBuilderService({
      logger,
      storageService,
      directionGenerator,
      eventBus,
      database,
      schemaValidator,
      clicheGenerator,
      traitsGenerator,
    });
    
    // Create test data
    await setupTestData();
  });

  afterEach(async () => {
    // Clean up database
    if (database) {
      await database.close();
    }
  });

  /**
   *
   */
  async function setupTestData() {
    // Create a test concept
    const conceptId = uuidv4();
    const concept = {
      id: conceptId,
      concept: 'Test concept for eligibility',
      createdAt: new Date().toISOString(),
    };
    await database.saveCharacterConcept(concept);
    
    // Create a test thematic direction
    const directionId = uuidv4();
    const direction = {
      id: directionId,
      conceptId: conceptId,
      concept: 'Test concept',
      title: 'Virginity and Innocence Lost',
      description: 'A thematic direction about loss of innocence',
      createdAt: new Date().toISOString(),
    };
    await database.saveThematicDirections([direction]);
    
    // Create test clichés
    const cliche = {
      id: uuidv4(),
      directionId: directionId,
      conceptId: conceptId,
      categories: {
        personalConflicts: ['Test cliché 1', 'Test cliché 2']
      },
      createdAt: new Date().toISOString(),
    };
    await database.saveCliche(cliche);
    
    // Create test core motivations with correct field names
    const motivations = [
      {
        id: uuidv4(),
        directionId: directionId,
        conceptId: conceptId,
        coreDesire: 'To find true meaning and purpose in life',
        internalContradiction: 'Seeks meaning but fears the responsibility it brings',
        centralQuestion: 'What makes a life worth living?',
        createdAt: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        directionId: directionId,
        conceptId: conceptId,
        coreDesire: 'To protect innocence while exploring the unknown',
        internalContradiction: 'Wants to preserve purity but is drawn to corruption',
        centralQuestion: 'Can innocence survive in a corrupt world?',
        createdAt: new Date().toISOString(),
      },
    ];
    await database.saveCoreMotivations(motivations);
  }

  describe('Field Name Compatibility', () => {
    it('should correctly retrieve core motivations with coreDesire field', async () => {
      // Get all directions from database directly
      const directions = await database.getAllThematicDirections();
      expect(directions).toHaveLength(1);
      
      const direction = directions[0];
      
      // Get core motivations for the direction
      const motivations = await characterBuilderService.getCoreMotivationsByDirectionId(direction.id);
      expect(motivations).toHaveLength(2);
      
      // Check that the CoreMotivation model has coreDesire field
      const motivation = motivations[0];
      expect(motivation.coreDesire).toBeDefined();
      
      // Check that at least one motivation has the expected value
      const hasExpectedMotivation = motivations.some(m => 
        m.coreDesire === 'To find true meaning and purpose in life'
      );
      expect(hasExpectedMotivation).toBe(true);
      
      // The coreMotivation getter provides backward compatibility
      expect(motivation.coreMotivation).toBeDefined();
      expect(motivation.coreMotivation).toBe(motivation.coreDesire);
    });

    it('should fail to display core motivations in UI due to field mismatch', () => {
      // Simulate what TraitsGeneratorController does
      const mockMotivation = new CoreMotivation({
        directionId: 'test-dir',
        conceptId: 'test-concept',
        coreDesire: 'Test desire',
        internalContradiction: 'Test contradiction',
        centralQuestion: 'Test question?',
      });
      
      // The coreMotivation getter provides backward compatibility
      const displayValue = mockMotivation.coreMotivation;
      expect(displayValue).toBe('Test desire'); // Works due to compatibility getter
      
      // The correct field name
      const correctValue = mockMotivation.coreDesire;
      expect(correctValue).toBe('Test desire');
    });
  });

  describe('Direction Eligibility', () => {
    it('should correctly identify directions with both clichés and core motivations as eligible', async () => {
      const directions = await database.getAllThematicDirections();
      const direction = directions[0];
      
      // Check if direction has clichés
      const cliche = await characterBuilderService.getClichesByDirectionId(direction.id);
      expect(cliche).toBeDefined();
      expect(cliche).not.toBeNull();
      
      // Check if direction has core motivations
      const motivations = await characterBuilderService.getCoreMotivationsByDirectionId(direction.id);
      expect(motivations).toBeDefined();
      expect(motivations.length).toBeGreaterThan(0);
      
      // Direction should be eligible
      const hasCliches = cliche !== null && cliche !== undefined;
      const hasMotivations = motivations && motivations.length > 0;
      const isEligible = hasCliches && hasMotivations;
      
      expect(isEligible).toBe(true);
    });

    it('should not mark directions without core motivations as eligible', async () => {
      // Create a direction with only clichés, no core motivations
      const directionId = uuidv4();
      const direction = {
        id: directionId,
        conceptId: uuidv4(),
        concept: 'Test concept without motivations',
        title: 'Direction without motivations',
        description: 'This direction has clichés but no core motivations',
        createdAt: new Date().toISOString(),
      };
      await database.saveThematicDirections([direction]);
      
      // Add clichés
      const testCliche = {
        id: uuidv4(),
        directionId: directionId,
        conceptId: direction.conceptId,
        categories: {
          personalConflicts: ['Cliché without motivation']
        },
        createdAt: new Date().toISOString(),
      };
      await database.saveCliche(testCliche);
      
      // Check eligibility
      const cliche = await characterBuilderService.getClichesByDirectionId(directionId);
      const motivations = await characterBuilderService.getCoreMotivationsByDirectionId(directionId);
      
      const hasCliches = cliche !== null && cliche !== undefined;
      const hasMotivations = motivations && motivations.length > 0;
      const isEligible = hasCliches && hasMotivations;
      
      expect(hasCliches).toBe(true);
      expect(hasMotivations).toBe(false);
      expect(isEligible).toBe(false);
    });
  });

  describe('CoreMotivation Model Compatibility', () => {
    it('should handle both coreDesire and coreMotivation field names in fromLLMResponse', () => {
      // Test with coreDesire (internal field name)
      const motivation1 = CoreMotivation.fromLLMResponse({
        directionId: 'dir1',
        conceptId: 'concept1',
        rawMotivation: {
          coreDesire: 'Desire text',
          internalContradiction: 'Contradiction text',
          centralQuestion: 'Question text?',
        },
      });
      expect(motivation1.coreDesire).toBe('Desire text');
      
      // Test with coreMotivation (UI field name)
      const motivation2 = CoreMotivation.fromLLMResponse({
        directionId: 'dir2',
        conceptId: 'concept2',
        rawMotivation: {
          coreMotivation: 'Motivation text',
          internalContradiction: 'Another contradiction',
          centralQuestion: 'Another question?',
        },
      });
      expect(motivation2.coreDesire).toBe('Motivation text');
      
      // Test with motivation (fallback field name)
      const motivation3 = CoreMotivation.fromLLMResponse({
        directionId: 'dir3',
        conceptId: 'concept3',
        rawMotivation: {
          motivation: 'Fallback text',
          contradiction: 'Fallback contradiction',
          question: 'Fallback question?',
        },
      });
      expect(motivation3.coreDesire).toBe('Fallback text');
    });
  });
});