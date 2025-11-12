/**
 * @file Integration test for character concept save workflow
 * @description Tests the complete flow from character creation to storage, focusing on the character limit issue
 * @see /src/characterBuilder/services/characterBuilderService.js
 * @see /src/characterBuilder/services/characterStorageService.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { BaseTestBed } from '../../common/baseTestBed.js';
import { CharacterBuilderService } from '../../../src/characterBuilder/services/characterBuilderService.js';
import { CharacterStorageService } from '../../../src/characterBuilder/services/characterStorageService.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

describe('Character Concept Save Workflow - Integration Test', () => {
  let testBed;
  let characterBuilderService;
  let characterStorageService;
  let schemaValidator;
  let mockDatabase;
  let mockLogger;
  let mockDirectionGenerator;
  let mockEventBus;

  beforeEach(async () => {
    testBed = new BaseTestBed();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Create mock database
    mockDatabase = {
      initialize: jest.fn().mockResolvedValue(true),
      saveCharacterConcept: jest.fn().mockImplementation((concept) => {
        // Mock successful storage
        return Promise.resolve({
          ...concept,
          id: concept.id,
        });
      }),
      getCharacterConcept: jest.fn(),
      getAllCharacterConcepts: jest.fn(),
      deleteCharacterConcept: jest.fn(),
      saveThematicDirections: jest.fn(),
      getThematicDirectionsByConceptId: jest.fn(),
      close: jest.fn(),
    };

    // Create mock direction generator
    mockDirectionGenerator = {
      generateDirections: jest.fn().mockResolvedValue([
        { id: 'dir1', direction: 'Test Direction 1' },
        { id: 'dir2', direction: 'Test Direction 2' },
      ]),
    };

    // Create mock event bus
    mockEventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };

    // Create real schema validator (to test actual schema validation)
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load required schemas
    const thematicSchemaPath = path.join(
      process.cwd(),
      'data/schemas/thematic-direction.schema.json'
    );
    const thematicSchemaData = JSON.parse(
      fs.readFileSync(thematicSchemaPath, 'utf8')
    );
    await schemaValidator.addSchema(thematicSchemaData, thematicSchemaData.$id);

    const conceptSchemaPath = path.join(
      process.cwd(),
      'data/schemas/character-concept.schema.json'
    );
    const conceptSchemaData = JSON.parse(
      fs.readFileSync(conceptSchemaPath, 'utf8')
    );
    await schemaValidator.addSchema(conceptSchemaData, conceptSchemaData.$id);

    // Create storage service
    characterStorageService = new CharacterStorageService({
      logger: mockLogger,
      database: mockDatabase,
      schemaValidator,
    });

    // Initialize the storage service
    await characterStorageService.initialize();

    // Create builder service
    characterBuilderService = new CharacterBuilderService({
      logger: mockLogger,
      storageService: characterStorageService,
      directionGenerator: mockDirectionGenerator,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('concept save workflow with character limits', () => {
    it('should successfully save concept with 1200 characters (reproduces original error)', async () => {
      // This test reproduces the exact scenario from the error logs
      const conceptText = 'a'.repeat(1200); // Over old 1000 limit, under new 6000 limit

      const result = await characterBuilderService.createCharacterConcept(
        conceptText,
        { autoSave: true }
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.concept).toBe(conceptText);
      expect(result.status).toBe('draft');
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalled();
    });

    it('should successfully save concept with 2500 characters', async () => {
      const conceptText = 'a'.repeat(2500); // Well within new 6000 limit

      const result = await characterBuilderService.createCharacterConcept(
        conceptText,
        { autoSave: true }
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.concept).toBe(conceptText);
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalled();
    });

    it('should successfully save concept with exactly 6000 characters', async () => {
      const conceptText = 'a'.repeat(6000); // At new maximum limit

      const result = await characterBuilderService.createCharacterConcept(
        conceptText,
        { autoSave: true }
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.concept).toBe(conceptText);
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalled();
    });

    it('should fail to save concept with 6001 characters', async () => {
      const conceptText = 'a'.repeat(6001); // Over new maximum limit

      await expect(
        characterBuilderService.createCharacterConcept(conceptText, {
          autoSave: true,
        })
      ).rejects.toThrow('concept must be no more than 6000 characters long');

      expect(mockDatabase.saveCharacterConcept).not.toHaveBeenCalled();
    });

    it('should save the exact failing concept from error logs', async () => {
      // This is the exact concept that was failing in the error logs
      const errorLogConcept =
        "a 20-year-old young woman with a shapely, athletic figure and a gorgeous ass. She lives in Donostia, in the north of Spain. She is studying business in college, but she thinks she'll have a great career as an Instagram model, where she has about a hundred thousand subscribers. The young woman goes to the gym five days a week to maintain her figure, and particularly to shape her gorgeous, bubbly ass further. She was blessed with an ass that makes every man turn their heads, and that makes her Instagram followers drool online. Her ass is her main pride. The young woman has many suitors, but she doesn't want to settle down given her many options. She's attracted to older men, in their late thirties or forties, who are manly and tough. She loves to be manhandled in bed by such older, strong men whom she can call daddy. She loves to tease men with her gorgeous ass; she gets a kick of knowing that men want to fuck her. The young woman can be a bit of a brat at times, but she does it almost as a test to see what man is tough enough to check her. She usually wears tight clothing, like yoga pants, that highlight her crotch and her sexy ass, as well as the rest of her toned figure.";

      expect(errorLogConcept.length).toBe(1190); // Verify length from logs

      const result = await characterBuilderService.createCharacterConcept(
        errorLogConcept,
        { autoSave: true }
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.concept).toBe(errorLogConcept);
      expect(result.status).toBe('draft');
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalled();
    });
  });

  describe('storage service schema validation integration', () => {
    it('should pass schema validation for 1500 character concept', async () => {
      const conceptText = 'a'.repeat(1500);

      const result = await characterBuilderService.createCharacterConcept(
        conceptText,
        { autoSave: true }
      );

      expect(result).toBeDefined();
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledWith(
        expect.objectContaining({
          concept: conceptText,
          id: expect.any(String),
          status: 'draft',
        })
      );
    });

    it('should handle multiple retry attempts gracefully for valid concepts', async () => {
      const conceptText = 'a'.repeat(1800);

      // Mock database to fail first two attempts, succeed on third
      mockDatabase.saveCharacterConcept
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          id: expect.any(String),
          concept: conceptText,
          status: 'draft',
        });

      const result = await characterBuilderService.createCharacterConcept(
        conceptText,
        { autoSave: true }
      );

      expect(result).toBeDefined();
      expect(mockDatabase.saveCharacterConcept).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling and reporting', () => {
    it('should provide clear error messages for over-limit concepts', async () => {
      const conceptText = 'a'.repeat(6100);

      await expect(
        characterBuilderService.createCharacterConcept(conceptText, {
          autoSave: true,
        })
      ).rejects.toThrow(/concept must be no more than 6000 characters long/);
    });

    it('should provide clear error messages for under-limit concepts', async () => {
      const conceptText = 'short'; // Only 5 characters

      await expect(
        characterBuilderService.createCharacterConcept(conceptText, {
          autoSave: true,
        })
      ).rejects.toThrow(/concept must be at least 10 characters long/);
    });
  });
});
