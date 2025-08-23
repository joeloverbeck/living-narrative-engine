# TRAITSGEN-010: Create Comprehensive Unit Test Suite

## Ticket Overview
- **Epic**: Traits Generator Implementation
- **Type**: Testing/Quality Assurance
- **Priority**: High
- **Estimated Effort**: 2 days
- **Dependencies**: All component implementation tickets (TRAITSGEN-001 through TRAITSGEN-005)

## Description
Create comprehensive unit test suites for all traits generator components following established testing patterns. This ensures each component works correctly in isolation and meets quality standards with 80%+ coverage.

## Requirements

### Unit Test File Structure
Create unit tests mirroring the source code structure:

```
tests/unit/
├── characterBuilder/
│   ├── models/
│   │   └── trait.test.js
│   ├── services/
│   │   └── TraitsGenerator.test.js
│   └── prompts/
│       └── traitsGenerationPrompt.test.js
└── traitsGenerator/
    ├── controllers/
    │   └── TraitsGeneratorController.test.js
    └── services/
        └── TraitsDisplayEnhancer.test.js
```

## Test Suite Implementation

### 1. Trait Model Unit Tests

#### File: `tests/unit/characterBuilder/models/trait.test.js`
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { Trait } from '../../../../src/characterBuilder/models/trait.js';
import { TraitTestDataFactory } from '../../../common/factories/traitTestDataFactory.js';

describe('Trait Model', () => {
  let testDataFactory;

  beforeEach(() => {
    testDataFactory = new TraitTestDataFactory();
  });

  describe('Constructor', () => {
    it('should create trait with all required properties', () => {
      const traitData = testDataFactory.createValidTraitData();
      const trait = new Trait(traitData);

      expect(trait.id).toBeDefined();
      expect(trait.names).toEqual(traitData.names);
      expect(trait.physicalDescription).toEqual(traitData.physicalDescription);
      expect(trait.personality).toEqual(traitData.personality);
      expect(trait.strengths).toEqual(traitData.strengths);
      expect(trait.weaknesses).toEqual(traitData.weaknesses);
      expect(trait.likes).toEqual(traitData.likes);
      expect(trait.dislikes).toEqual(traitData.dislikes);
      expect(trait.fears).toEqual(traitData.fears);
      expect(trait.goals).toEqual(traitData.goals);
      expect(trait.notes).toEqual(traitData.notes);
      expect(trait.profile).toEqual(traitData.profile);
      expect(trait.secrets).toEqual(traitData.secrets);
      expect(trait.generatedAt).toBeDefined();
      expect(trait.metadata).toEqual(traitData.metadata || {});
    });

    it('should generate ID if not provided', () => {
      const traitData = testDataFactory.createValidTraitData();
      delete traitData.id;
      
      const trait = new Trait(traitData);
      
      expect(trait.id).toBeDefined();
      expect(trait.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should set generatedAt if not provided', () => {
      const traitData = testDataFactory.createValidTraitData();
      delete traitData.generatedAt;
      
      const trait = new Trait(traitData);
      
      expect(trait.generatedAt).toBeDefined();
      expect(new Date(trait.generatedAt)).toBeInstanceOf(Date);
    });

    it('should initialize empty metadata if not provided', () => {
      const traitData = testDataFactory.createValidTraitData();
      delete traitData.metadata;
      
      const trait = new Trait(traitData);
      
      expect(trait.metadata).toEqual({});
    });
  });

  describe('fromLLMResponse', () => {
    it('should create trait from valid LLM response', () => {
      const llmResponse = testDataFactory.createValidLLMResponse();
      const metadata = testDataFactory.createValidMetadata();
      
      const trait = Trait.fromLLMResponse(llmResponse, metadata);
      
      expect(trait).toBeInstanceOf(Trait);
      expect(trait.names).toEqual(llmResponse.names);
      expect(trait.metadata).toEqual(metadata);
    });

    it('should handle LLM response without optional fields', () => {
      const minimalResponse = testDataFactory.createMinimalLLMResponse();
      
      const trait = Trait.fromLLMResponse(minimalResponse);
      
      expect(trait).toBeInstanceOf(Trait);
      expect(trait.metadata).toEqual({});
    });

    it('should throw error for invalid LLM response', () => {
      const invalidResponse = { incomplete: true };
      
      expect(() => Trait.fromLLMResponse(invalidResponse)).toThrow('Invalid LLM response');
    });
  });

  describe('validate', () => {
    it('should validate complete trait data successfully', () => {
      const trait = new Trait(testDataFactory.createValidTraitData());
      
      const validation = trait.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate names array requirements', () => {
      const traitData = testDataFactory.createValidTraitData();
      traitData.names = []; // Empty array
      const trait = new Trait(traitData);
      
      const validation = trait.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'names',
          message: expect.stringContaining('3-5')
        })
      );
    });

    it('should validate personality array requirements', () => {
      const traitData = testDataFactory.createValidTraitData();
      traitData.personality = [
        { trait: 'Test' } // Missing explanation
      ];
      const trait = new Trait(traitData);
      
      const validation = trait.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'personality',
          message: expect.stringContaining('explanation')
        })
      );
    });

    it('should validate string length requirements', () => {
      const traitData = testDataFactory.createValidTraitData();
      traitData.physicalDescription = 'Too short'; // Below 100 char minimum
      const trait = new Trait(traitData);
      
      const validation = trait.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'physicalDescription',
          message: expect.stringContaining('100')
        })
      );
    });

    it('should validate goals structure requirements', () => {
      const traitData = testDataFactory.createValidTraitData();
      traitData.goals = { longTerm: 'Test' }; // Missing shortTerm
      const trait = new Trait(traitData);
      
      const validation = trait.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'goals',
          message: expect.stringContaining('shortTerm')
        })
      );
    });
  });

  describe('toJSON', () => {
    it('should serialize trait to clean JSON', () => {
      const trait = new Trait(testDataFactory.createValidTraitData());
      
      const json = trait.toJSON();
      
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('names');
      expect(json).toHaveProperty('physicalDescription');
      expect(json).toHaveProperty('generatedAt');
      expect(json).toHaveProperty('metadata');
      
      // Should be serializable
      expect(() => JSON.stringify(json)).not.toThrow();
    });

    it('should include all trait categories in JSON', () => {
      const trait = new Trait(testDataFactory.createCompleteTraitData());
      
      const json = trait.toJSON();
      
      const expectedCategories = [
        'names', 'physicalDescription', 'personality', 'strengths', 
        'weaknesses', 'likes', 'dislikes', 'fears', 'goals', 
        'notes', 'profile', 'secrets'
      ];
      
      expectedCategories.forEach(category => {
        expect(json).toHaveProperty(category);
      });
    });
  });

  describe('toExportText', () => {
    it('should create human-readable export text', () => {
      const trait = new Trait(testDataFactory.createValidTraitData());
      
      const exportText = trait.toExportText();
      
      expect(exportText).toContain('CHARACTER TRAITS');
      expect(exportText).toContain('NAMES');
      expect(exportText).toContain('PHYSICAL DESCRIPTION');
      expect(exportText).toContain('PERSONALITY');
      expect(exportText).toContain('Generated:');
    });

    it('should include all trait categories in export', () => {
      const trait = new Trait(testDataFactory.createCompleteTraitData());
      
      const exportText = trait.toExportText();
      
      const expectedSections = [
        'NAMES', 'PHYSICAL DESCRIPTION', 'PERSONALITY', 'STRENGTHS',
        'WEAKNESSES', 'LIKES', 'DISLIKES', 'FEARS', 'GOALS',
        'NOTES', 'PROFILE', 'SECRETS'
      ];
      
      expectedSections.forEach(section => {
        expect(exportText).toContain(section);
      });
    });

    it('should format structured data correctly', () => {
      const traitData = testDataFactory.createValidTraitData();
      traitData.names = [
        { name: 'Aria', justification: 'Subverts typical hero naming' },
        { name: 'Kai', justification: 'Avoids gender stereotypes' }
      ];
      const trait = new Trait(traitData);
      
      const exportText = trait.toExportText();
      
      expect(exportText).toContain('• Aria: Subverts typical hero naming');
      expect(exportText).toContain('• Kai: Avoids gender stereotypes');
    });
  });
});
```

### 2. TraitsGenerator Service Unit Tests

#### File: `tests/unit/characterBuilder/services/TraitsGenerator.test.js`
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TraitsGenerator } from '../../../../src/characterBuilder/services/TraitsGenerator.js';
import { TraitsGeneratorTestBed } from '../../../common/testBeds/traitsGeneratorTestBed.js';
import { TraitsGenerationError } from '../../../../src/characterBuilder/errors/TraitsGenerationError.js';

describe('TraitsGenerator Service', () => {
  let testBed;
  let traitsGenerator;

  beforeEach(async () => {
    testBed = new TraitsGeneratorTestBed();
    await testBed.setup();
    traitsGenerator = testBed.createTraitsGenerator();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should initialize with all required dependencies', () => {
      expect(traitsGenerator).toBeInstanceOf(TraitsGenerator);
      expect(() => traitsGenerator.getResponseSchema()).not.toThrow();
    });

    it('should validate required dependencies', () => {
      expect(() => new TraitsGenerator({})).toThrow('logger is required');
      expect(() => new TraitsGenerator({ logger: testBed.mockLogger })).toThrow('llmJsonService is required');
    });
  });

  describe('generateTraits', () => {
    it('should generate traits with valid inputs', async () => {
      const concept = testBed.createValidConcept();
      const direction = testBed.createValidDirection();
      const userInputs = testBed.createValidUserInputs();
      const cliches = testBed.createValidCliches();
      
      testBed.mockSuccessfulLLMResponse();

      const result = await traitsGenerator.generateTraits(concept, direction, userInputs, cliches);

      expect(result).toBeDefined();
      expect(result.names).toHaveLength(3);
      expect(result.physicalDescription).toBeTruthy();
      testBed.verifyAllTraitCategoriesPresent(result);
    });

    it('should validate concept parameter', async () => {
      await expect(traitsGenerator.generateTraits(
        null,
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )).rejects.toThrow('Concept is required');
    });

    it('should validate direction parameter', async () => {
      await expect(traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        null,
        testBed.createValidUserInputs(),
        []
      )).rejects.toThrow('Direction is required');
    });

    it('should validate user inputs structure', async () => {
      const invalidInputs = { coreMotivation: '' }; // Missing required fields
      
      await expect(traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        invalidInputs,
        []
      )).rejects.toThrow('internalContradiction is required');
    });

    it('should handle empty cliches gracefully', async () => {
      testBed.mockSuccessfulLLMResponse();

      const result = await traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        [] // Empty cliches
      );

      expect(result).toBeDefined();
    });

    it('should dispatch generation started event', async () => {
      const eventBus = testBed.getEventBusMock();
      testBed.mockSuccessfulLLMResponse();

      await traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      );

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'traits_generation_started' })
      );
    });

    it('should dispatch generation completed event', async () => {
      const eventBus = testBed.getEventBusMock();
      testBed.mockSuccessfulLLMResponse();

      await traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      );

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'traits_generation_completed' })
      );
    });

    it('should handle LLM service failures', async () => {
      const eventBus = testBed.getEventBusMock();
      testBed.mockLLMServiceFailure(new Error('Service unavailable'));

      await expect(traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )).rejects.toThrow(TraitsGenerationError);

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'traits_generation_failed' })
      );
    });

    it('should handle malformed LLM responses', async () => {
      testBed.mockMalformedLLMResponse();

      await expect(traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )).rejects.toThrow(TraitsGenerationError);
    });

    it('should validate response against schema', async () => {
      const invalidResponse = {
        names: [], // Empty array (violates schema)
        physicalDescription: 'Too short' // Violates length requirements
      };
      testBed.mockLLMResponse(invalidResponse);

      await expect(traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )).rejects.toThrow('Response validation failed');
    });
  });

  describe('getResponseSchema', () => {
    it('should return valid JSON schema', () => {
      const schema = traitsGenerator.getResponseSchema();
      
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
      
      const requiredFields = [
        'names', 'physicalDescription', 'personality', 'strengths', 
        'weaknesses', 'likes', 'dislikes', 'fears', 'goals', 
        'notes', 'profile', 'secrets'
      ];
      
      requiredFields.forEach(field => {
        expect(schema.required).toContain(field);
        expect(schema.properties).toHaveProperty(field);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw TraitsGenerationError for service failures', async () => {
      testBed.mockLLMServiceFailure(new Error('Network error'));

      await expect(traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )).rejects.toThrow(TraitsGenerationError);
    });

    it('should include context in error messages', async () => {
      const concept = testBed.createValidConcept();
      testBed.mockLLMServiceFailure(new Error('Service error'));

      try {
        await traitsGenerator.generateTraits(
          concept,
          testBed.createValidDirection(),
          testBed.createValidUserInputs(),
          []
        );
      } catch (error) {
        expect(error).toBeInstanceOf(TraitsGenerationError);
        expect(error.context).toHaveProperty('conceptId', concept.id);
      }
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should implement circuit breaker for repeated failures', async () => {
      // Mock multiple consecutive failures
      for (let i = 0; i < 5; i++) {
        testBed.mockLLMServiceFailure(new Error(`Failure ${i + 1}`));
        
        await expect(traitsGenerator.generateTraits(
          testBed.createValidConcept(),
          testBed.createValidDirection(),
          testBed.createValidUserInputs(),
          []
        )).rejects.toThrow();
      }

      // Circuit should be open - subsequent calls should fail immediately
      const startTime = Date.now();
      await expect(traitsGenerator.generateTraits(
        testBed.createValidConcept(),
        testBed.createValidDirection(),
        testBed.createValidUserInputs(),
        []
      )).rejects.toThrow('Circuit breaker is open');
      
      const elapsedTime = Date.now() - startTime;
      expect(elapsedTime).toBeLessThan(100); // Should fail immediately
    });
  });
});
```

### 3. Prompt Generation Unit Tests

#### File: `tests/unit/characterBuilder/prompts/traitsGenerationPrompt.test.js`
```javascript
import { describe, it, expect } from '@jest/globals';
import {
  buildTraitsGenerationPrompt,
  validateTraitsGenerationResponse,
  formatClichesForPrompt,
  TRAITS_RESPONSE_SCHEMA,
  TRAITS_LLM_PARAMS
} from '../../../../src/characterBuilder/prompts/traitsGenerationPrompt.js';
import { PromptTestDataFactory } from '../../../common/factories/promptTestDataFactory.js';

describe('Traits Generation Prompt', () => {
  let testDataFactory;

  beforeEach(() => {
    testDataFactory = new PromptTestDataFactory();
  });

  describe('buildTraitsGenerationPrompt', () => {
    it('should build complete prompt with all required elements', () => {
      const concept = testDataFactory.createValidConcept();
      const direction = testDataFactory.createValidDirection();
      const userInputs = testDataFactory.createValidUserInputs();
      const cliches = testDataFactory.createValidCliches();

      const prompt = buildTraitsGenerationPrompt(concept, direction, userInputs, cliches);

      expect(prompt).toContain('<role>');
      expect(prompt).toContain('<task_definition>');
      expect(prompt).toContain('<character_concept>');
      expect(prompt).toContain('<thematic_direction>');
      expect(prompt).toContain('<user_inputs>');
      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('<constraints>');
      expect(prompt).toContain('<response_format>');
      expect(prompt).toContain('<content_policy>');
    });

    it('should include all user input fields', () => {
      const userInputs = {
        coreMotivation: 'Test motivation',
        internalContradiction: 'Test contradiction',
        centralQuestion: 'Test question'
      };

      const prompt = buildTraitsGenerationPrompt(
        testDataFactory.createValidConcept(),
        testDataFactory.createValidDirection(),
        userInputs,
        []
      );

      expect(prompt).toContain('Core Motivation: Test motivation');
      expect(prompt).toContain('Internal Contradiction: Test contradiction');
      expect(prompt).toContain('Central Question: Test question');
    });

    it('should include concept information', () => {
      const concept = {
        id: 'test-concept',
        name: 'Test Concept',
        description: 'Test concept description'
      };

      const prompt = buildTraitsGenerationPrompt(
        concept,
        testDataFactory.createValidDirection(),
        testDataFactory.createValidUserInputs(),
        []
      );

      expect(prompt).toContain('Test Concept');
      expect(prompt).toContain('Test concept description');
    });

    it('should include thematic direction with all elements', () => {
      const direction = {
        id: 'test-direction',
        name: 'Test Direction',
        description: 'Test direction description',
        elements: ['Element 1', 'Element 2']
      };

      const prompt = buildTraitsGenerationPrompt(
        testDataFactory.createValidConcept(),
        direction,
        testDataFactory.createValidUserInputs(),
        []
      );

      expect(prompt).toContain('Test Direction');
      expect(prompt).toContain('Test direction description');
      expect(prompt).toContain('Element 1');
      expect(prompt).toContain('Element 2');
    });

    it('should include formatted clichés', () => {
      const cliches = [
        { name: 'Cliché 1', description: 'Description 1' },
        { name: 'Cliché 2', description: 'Description 2' }
      ];

      const prompt = buildTraitsGenerationPrompt(
        testDataFactory.createValidConcept(),
        testDataFactory.createValidDirection(),
        testDataFactory.createValidUserInputs(),
        cliches
      );

      expect(prompt).toContain('Cliché 1');
      expect(prompt).toContain('Description 1');
      expect(prompt).toContain('Cliché 2');
      expect(prompt).toContain('Description 2');
    });

    it('should use exact content policy text', () => {
      const prompt = buildTraitsGenerationPrompt(
        testDataFactory.createValidConcept(),
        testDataFactory.createValidDirection(),
        testDataFactory.createValidUserInputs(),
        []
      );

      expect(prompt).toContain('RATING: NC-21 (ADULTS ONLY)');
      expect(prompt).toContain('NO RESTRICTIONS: This is a mature application');
      expect(prompt).toContain('Explicit language and profanity');
      expect(prompt).toContain('Graphic violence and gore');
      expect(prompt).toContain('Sexual themes, including explicit descriptions');
    });

    it('should handle empty clichés gracefully', () => {
      const prompt = buildTraitsGenerationPrompt(
        testDataFactory.createValidConcept(),
        testDataFactory.createValidDirection(),
        testDataFactory.createValidUserInputs(),
        []
      );

      expect(prompt).toContain('<cliches_to_avoid>');
      expect(prompt).toContain('None provided');
    });

    it('should escape XML special characters', () => {
      const concept = {
        id: 'test',
        name: 'Test & Special <Characters>',
        description: 'Contains "quotes" & <tags>'
      };

      const prompt = buildTraitsGenerationPrompt(
        concept,
        testDataFactory.createValidDirection(),
        testDataFactory.createValidUserInputs(),
        []
      );

      expect(prompt).toContain('&amp;');
      expect(prompt).toContain('&lt;');
      expect(prompt).toContain('&gt;');
    });
  });

  describe('formatClichesForPrompt', () => {
    it('should format clichés as structured list', () => {
      const cliches = [
        { name: 'Cliché 1', description: 'Description 1' },
        { name: 'Cliché 2', description: 'Description 2' }
      ];

      const formatted = formatClichesForPrompt(cliches);

      expect(formatted).toContain('• Cliché 1: Description 1');
      expect(formatted).toContain('• Cliché 2: Description 2');
    });

    it('should handle empty clichés array', () => {
      const formatted = formatClichesForPrompt([]);
      expect(formatted).toBe('None provided.');
    });

    it('should handle clichés without descriptions', () => {
      const cliches = [{ name: 'Cliché without description' }];
      const formatted = formatClichesForPrompt(cliches);
      expect(formatted).toContain('• Cliché without description');
    });
  });

  describe('validateTraitsGenerationResponse', () => {
    it('should validate complete valid response', () => {
      const validResponse = testDataFactory.createValidTraitsResponse();
      
      const validation = validateTraitsGenerationResponse(validResponse);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject response missing required fields', () => {
      const invalidResponse = {
        names: [{ name: 'Test', justification: 'Test' }]
        // Missing other required fields
      };
      
      const validation = validateTraitsGenerationResponse(invalidResponse);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate names array structure', () => {
      const response = testDataFactory.createValidTraitsResponse();
      response.names = [{ name: 'Test' }]; // Missing justification
      
      const validation = validateTraitsGenerationResponse(response);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'names',
          message: expect.stringContaining('justification')
        })
      );
    });

    it('should validate personality array structure', () => {
      const response = testDataFactory.createValidTraitsResponse();
      response.personality = [{ trait: 'Test' }]; // Missing explanation
      
      const validation = validateTraitsGenerationResponse(response);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'personality',
          message: expect.stringContaining('explanation')
        })
      );
    });

    it('should validate string length constraints', () => {
      const response = testDataFactory.createValidTraitsResponse();
      response.physicalDescription = 'Too short'; // Below minimum length
      
      const validation = validateTraitsGenerationResponse(response);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'physicalDescription',
          message: expect.stringContaining('length')
        })
      );
    });

    it('should validate goals structure', () => {
      const response = testDataFactory.createValidTraitsResponse();
      response.goals = { longTerm: 'Test goal' }; // Missing shortTerm
      
      const validation = validateTraitsGenerationResponse(response);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'goals',
          message: expect.stringContaining('shortTerm')
        })
      );
    });

    it('should validate array length constraints', () => {
      const response = testDataFactory.createValidTraitsResponse();
      response.names = []; // Below minimum length
      
      const validation = validateTraitsGenerationResponse(response);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContainEqual(
        expect.objectContaining({
          field: 'names',
          message: expect.stringContaining('3')
        })
      );
    });
  });

  describe('TRAITS_RESPONSE_SCHEMA', () => {
    it('should define all required trait categories', () => {
      const requiredFields = [
        'names', 'physicalDescription', 'personality', 'strengths',
        'weaknesses', 'likes', 'dislikes', 'fears', 'goals',
        'notes', 'profile', 'secrets'
      ];

      expect(TRAITS_RESPONSE_SCHEMA.required).toEqual(
        expect.arrayContaining(requiredFields)
      );

      requiredFields.forEach(field => {
        expect(TRAITS_RESPONSE_SCHEMA.properties).toHaveProperty(field);
      });
    });

    it('should set additionalProperties to false', () => {
      expect(TRAITS_RESPONSE_SCHEMA.additionalProperties).toBe(false);
    });

    it('should define proper constraints for array fields', () => {
      const arrayFields = ['names', 'personality', 'strengths', 'weaknesses', 
                          'likes', 'dislikes', 'fears', 'notes', 'secrets'];

      arrayFields.forEach(field => {
        expect(TRAITS_RESPONSE_SCHEMA.properties[field].type).toBe('array');
        expect(TRAITS_RESPONSE_SCHEMA.properties[field]).toHaveProperty('minItems');
      });
    });
  });

  describe('TRAITS_LLM_PARAMS', () => {
    it('should define appropriate parameters', () => {
      expect(TRAITS_LLM_PARAMS).toHaveProperty('temperature');
      expect(TRAITS_LLM_PARAMS).toHaveProperty('max_tokens');
      
      expect(TRAITS_LLM_PARAMS.temperature).toBeGreaterThan(0);
      expect(TRAITS_LLM_PARAMS.max_tokens).toBeGreaterThan(1000);
    });
  });
});
```

### 4. Additional Test Files

Complete the unit test suite with remaining component tests:

- **TraitsGeneratorController.test.js**: Test UI controller functionality
- **TraitsDisplayEnhancer.test.js**: Test display formatting and export
- **CharacterBuilderService integration methods**: Test service integration methods

## Test Data Factories

### Create comprehensive test data factories:

#### TraitTestDataFactory
```javascript
export class TraitTestDataFactory {
  createValidTraitData() {
    return {
      names: [
        { name: 'Aria', justification: 'Subverts typical naming conventions' },
        { name: 'Kai', justification: 'Gender-neutral alternative' },
        { name: 'Zara', justification: 'Avoids cultural stereotypes' }
      ],
      physicalDescription: 'A tall figure with distinctive silver-streaked hair that catches light unusually, bearing small scars that tell stories of survival rather than heroism, and eyes that shift color based on emotional state.',
      personality: [
        { trait: 'Cautiously optimistic', explanation: 'Believes in potential while expecting disappointment' },
        { trait: 'Intellectually curious', explanation: 'Driven to understand rather than judge' },
        { trait: 'Emotionally guarded', explanation: 'Protects vulnerability through careful distance' }
      ],
      // ... continue with all trait categories
    };
  }

  createValidLLMResponse() { /* Implementation */ }
  createMinimalLLMResponse() { /* Implementation */ }
  createCompleteTraitData() { /* Implementation */ }
  createValidMetadata() { /* Implementation */ }
}
```

## Coverage Requirements

### Target Coverage Metrics
- **Line Coverage**: 85%+
- **Branch Coverage**: 80%+
- **Function Coverage**: 90%+
- **Statement Coverage**: 85%+

### Coverage Validation
```javascript
// In jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/characterBuilder/models/trait.js',
    'src/characterBuilder/services/TraitsGenerator.js',
    'src/characterBuilder/prompts/traitsGenerationPrompt.js',
    'src/traitsGenerator/controllers/TraitsGeneratorController.js',
    'src/traitsGenerator/services/TraitsDisplayEnhancer.js'
  ],
  coverageThreshold: {
    global: {
      lines: 85,
      branches: 80,
      functions: 90,
      statements: 85
    }
  }
};
```

## Acceptance Criteria

### Test Implementation Requirements
- [ ] All component unit tests implemented following established patterns
- [ ] Test data factories provide comprehensive test data generation
- [ ] Each test suite covers success scenarios, edge cases, and error conditions
- [ ] Tests follow AAA pattern (Arrange, Act, Assert) consistently

### Coverage Requirements
- [ ] Line coverage ≥85% for all traits generator components
- [ ] Branch coverage ≥80% for all conditional logic
- [ ] Function coverage ≥90% for all public methods
- [ ] Statement coverage ≥85% for all executable code

### Quality Requirements
- [ ] Tests are deterministic and reliable
- [ ] Test naming clearly describes scenarios being tested
- [ ] Error scenarios properly tested with expected error types
- [ ] Mock usage appropriate and not over-mocking

### Integration with CI/CD
- [ ] All unit tests pass in CI/CD pipeline
- [ ] Coverage thresholds enforced in build process
- [ ] Test performance acceptable for development workflow
- [ ] Tests provide clear failure messages for debugging

## Files Modified
- **NEW**: `tests/unit/characterBuilder/models/trait.test.js`
- **NEW**: `tests/unit/characterBuilder/services/TraitsGenerator.test.js`
- **NEW**: `tests/unit/characterBuilder/prompts/traitsGenerationPrompt.test.js`
- **NEW**: `tests/unit/traitsGenerator/controllers/TraitsGeneratorController.test.js`
- **NEW**: `tests/unit/traitsGenerator/services/TraitsDisplayEnhancer.test.js`
- **NEW**: `tests/common/factories/traitTestDataFactory.js`
- **NEW**: `tests/common/factories/promptTestDataFactory.js`
- **NEW**: `tests/common/testBeds/traitsGeneratorTestBed.js`

## Dependencies For Next Tickets
This comprehensive unit testing is required for:
- TRAITSGEN-011 (Quality Assurance Review)
- TRAITSGEN-012 (End-to-End Testing)

## Notes
- Follow established testing patterns from existing character-builder components
- Focus on testing business logic and edge cases thoroughly
- Ensure proper mocking of external dependencies (LLM services, database, etc.)
- Pay special attention to storage policy compliance testing
- Consider performance implications of test suite execution