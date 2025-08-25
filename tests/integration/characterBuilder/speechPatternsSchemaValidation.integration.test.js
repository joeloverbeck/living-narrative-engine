/**
 * @file Integration tests for speech patterns schema validation workflow
 *
 * Tests the complete integration of:
 * - Schema loading and validation service integration
 * - SpeechPatternsSchemaValidator with real AjvSchemaValidator
 * - SpeechPatternsResponseProcessor integration
 * - End-to-end validation workflow
 * - Schema compliance with actual JSON Schema Draft 07
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import SpeechPatternsSchemaValidator from '../../../src/characterBuilder/validators/SpeechPatternsSchemaValidator.js';
import SpeechPatternsResponseProcessor from '../../../src/characterBuilder/services/SpeechPatternsResponseProcessor.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import path from 'path';
import { readFileSync } from 'fs';

describe('Speech Patterns Schema Validation Integration', () => {
  let testBed;
  let mockLogger;
  let schemaValidator;
  let speechPatternsValidator;
  let responseProcessor;
  let mockLlmJsonService;

  beforeEach(async () => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Create real AJV schema validator
    schemaValidator = new AjvSchemaValidator({ logger: mockLogger });

    // Load the speech patterns response schema
    const schemaPath = path.join(
      process.cwd(),
      'data/schemas/speech-patterns-response.schema.json'
    );
    const schemaContent = JSON.parse(readFileSync(schemaPath, 'utf8'));

    // Add schema to validator
    await schemaValidator.addSchema(schemaContent, schemaContent.$id);

    // Create speech patterns validator
    speechPatternsValidator = new SpeechPatternsSchemaValidator({
      schemaValidator,
      logger: mockLogger,
    });

    // Create mock LLM JSON service
    mockLlmJsonService = testBed.createMock('LlmJsonService', [
      'clean',
      'parseAndRepair',
    ]);

    // Create response processor
    responseProcessor = new SpeechPatternsResponseProcessor({
      logger: mockLogger,
      llmJsonService: mockLlmJsonService,
      schemaValidator,
    });
  });

  describe('Schema Loading and Integration', () => {
    it('should load schema successfully in validation service', async () => {
      const schemaId =
        'schema://living-narrative-engine/speech-patterns-response.schema.json';

      expect(schemaValidator.isSchemaLoaded(schemaId)).toBe(true);
    });

    it('should validate against loaded schema successfully', async () => {
      const validResponse = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern:
              'Uses elaborate metaphors when explaining complex emotions',
            example: '"It\'s like watching a sunset through broken glass."',
            circumstances: 'When discussing difficult personal experiences',
          },
          {
            pattern: 'Switches to technical terminology under stress',
            example: '"We need to optimize our approach vector immediately."',
            circumstances: 'During high-pressure situations',
          },
          {
            pattern: 'Employs self-deprecating humor to deflect attention',
            example: '"Well, that was about as smooth as sandpaper on silk."',
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateResponse(validResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid response structure', async () => {
      const invalidResponse = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Too short', // Below minimum length
            example: 'No quotes', // No quoted dialogue
          },
        ],
        // Missing required patterns (need minimum 3)
      };

      const result =
        await speechPatternsValidator.validateResponse(invalidResponse);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Content Quality Validation Integration', () => {
    it('should enforce pattern quality rules', async () => {
      const responseWithGenericPatterns = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'says things loudly', // Generic pattern
            example: '"Character says something here"', // Placeholder text
            circumstances: null,
          },
          {
            pattern: 'talks about stuff', // Generic pattern
            example: '"They say things"', // Placeholder text
            circumstances: null,
          },
          {
            pattern: 'speaks with words', // Generic pattern
            example: '"Example dialogue"', // Placeholder text
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result = await speechPatternsValidator.validateResponse(
        responseWithGenericPatterns
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(
          (err) =>
            err.includes('specific') ||
            err.includes('generic') ||
            err.includes('placeholder')
        )
      ).toBe(true);
    });

    it('should enforce example dialogue requirements', async () => {
      const responseWithoutDialogue = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses descriptive language when painting scenes',
            example: 'Character describes things beautifully', // No quotes
            circumstances: null,
          },
          {
            pattern: 'Becomes concise during emergencies',
            example: 'Speaks briefly in crisis', // No quotes
            circumstances: null,
          },
          {
            pattern: 'Shows empathy through careful word choice',
            example: 'Chooses words that show understanding', // No quotes
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result = await speechPatternsValidator.validateResponse(
        responseWithoutDialogue
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(
          (err) => err.includes('quoted speech') || err.includes('dialogue')
        )
      ).toBe(true);
    });

    it('should validate circumstances format correctly', async () => {
      const responseWithBadCircumstances = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses formal language in professional settings',
            example: '"I believe we should proceed with utmost caution."',
            circumstances: 'Usually does this in meetings', // Bad format
          },
          {
            pattern: 'Becomes more casual with trusted friends',
            example: '"Hey, wanna grab some coffee later?"',
            circumstances: 'Sometimes with people they know', // Bad format
          },
          {
            pattern: 'Shows deference to authority figures',
            example: '"Yes, ma\'am. I understand completely."',
            circumstances: 'Always being respectful to bosses', // Bad format
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result = await speechPatternsValidator.validateResponse(
        responseWithBadCircumstances
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(
          (err) =>
            err.includes('temporal') ||
            err.includes('conditional') ||
            err.includes('circumstances')
        )
      ).toBe(true);
    });
  });

  describe('Security Validation Integration', () => {
    it('should prevent XSS attacks in character names', async () => {
      const maliciousResponse = {
        characterName: 'Evil<script>alert("xss")</script>Character',
        speechPatterns: [
          {
            pattern:
              'Uses elaborate metaphors when explaining complex emotions',
            example: '"It\'s like watching a sunset through broken glass."',
            circumstances: 'When discussing difficult personal experiences',
          },
          {
            pattern: 'Switches to technical terminology under stress',
            example: '"We need to optimize our approach vector immediately."',
            circumstances: 'During high-pressure situations',
          },
          {
            pattern: 'Employs self-deprecating humor to deflect attention',
            example: '"Well, that was about as smooth as sandpaper on silk."',
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateAndSanitizeResponse(
          maliciousResponse
        );

      expect(result.sanitizedResponse.characterName).not.toContain('<script>');
      expect(result.sanitizedResponse.characterName).not.toContain('alert');
      expect(result.sanitizedResponse.characterName).toBe('EvilCharacter');
    });

    it('should sanitize malicious content in speech patterns', async () => {
      const maliciousResponse = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern:
              'Uses<script>alert("pattern")</script> elaborate metaphors',
            example:
              '"It\'s<iframe src="evil.com"></iframe> like watching a sunset."',
            circumstances:
              'When<script>alert("circumstances")</script> discussing experiences',
          },
          {
            pattern: 'Switches to technical terminology under stress',
            example:
              '"We need to javascript:alert("example") optimize our approach."',
            circumstances: 'During high-pressure situations',
          },
          {
            pattern: 'Employs self-deprecating humor to deflect attention',
            example:
              '"Well, that was <div onclick="badFunction()">smooth</div> as silk."',
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateAndSanitizeResponse(
          maliciousResponse
        );

      expect(result.sanitizedResponse.speechPatterns[0].pattern).not.toContain(
        '<script>'
      );
      expect(result.sanitizedResponse.speechPatterns[0].example).not.toContain(
        '<iframe>'
      );
      expect(
        result.sanitizedResponse.speechPatterns[0].circumstances
      ).not.toContain('<script>');
      expect(result.sanitizedResponse.speechPatterns[1].example).not.toContain(
        'javascript:'
      );
      expect(result.sanitizedResponse.speechPatterns[2].example).not.toContain(
        'onclick='
      );
    });

    it('should block HTML tags and preserve text content', async () => {
      const htmlResponse = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            pattern: 'Uses <em>emphasis</em> in important conversations',
            example:
              '"This is <strong>really</strong> important to understand."',
            circumstances: 'When <b>making</b> crucial points',
          },
          {
            pattern: 'Includes <a href="link.com">references</a> frequently',
            example: '"You can find more info <a href="site.com">here</a>."',
            circumstances: null,
          },
          {
            pattern:
              'Sometimes uses <code>technical terms</code> inappropriately',
            example: '"The <span class="error">error</span> rate is too high."',
            circumstances: 'During <div>technical</div> discussions',
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateAndSanitizeResponse(htmlResponse);

      // HTML tags should be removed but text content preserved
      expect(result.sanitizedResponse.speechPatterns[0].pattern).toContain(
        'emphasis'
      );
      expect(result.sanitizedResponse.speechPatterns[0].pattern).not.toContain(
        '<em>'
      );
      expect(result.sanitizedResponse.speechPatterns[0].example).toContain(
        'really'
      );
      expect(result.sanitizedResponse.speechPatterns[0].example).not.toContain(
        '<strong>'
      );
    });
  });

  describe('Response Processor Integration', () => {
    it('should integrate validator with response processor successfully', async () => {
      const validJSONResponse = JSON.stringify({
        characterName: 'Integrated Test Character',
        speechPatterns: [
          {
            pattern: 'Uses technical jargon when nervous or uncertain',
            example:
              '"We need to recalibrate the parameters for optimal functionality."',
            circumstances: 'When facing unfamiliar or challenging situations',
          },
          {
            pattern: 'Becomes more personal and warm in casual settings',
            example:
              '"You know, I was just thinking about that story you told me."',
            circumstances:
              'During relaxed conversations with trusted individuals',
          },
          {
            pattern: 'Adopts formal speech patterns in professional contexts',
            example:
              '"I would be honored to present our findings to the committee."',
            circumstances: 'In business meetings or official presentations',
          },
        ],
      });

      mockLlmJsonService.clean.mockReturnValue(validJSONResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(validJSONResponse)
      );

      const result = await responseProcessor.processResponse(
        validJSONResponse,
        {
          characterName: 'Integrated Test Character',
        }
      );

      expect(result.characterName).toBe('Integrated Test Character');
      expect(result.speechPatterns).toHaveLength(3);
      expect(result.metadata.processingMethod).toBe('json');
      expect(result.generatedAt).toBeDefined();
    });

    it('should handle validation failures in response processor', async () => {
      const invalidJSONResponse = JSON.stringify({
        characterName: '', // Invalid
        speechPatterns: [
          {
            pattern: 'Bad', // Too short
            example: 'No quotes', // Invalid format
          },
        ],
        // Too few patterns
      });

      mockLlmJsonService.clean.mockReturnValue(invalidJSONResponse);
      mockLlmJsonService.parseAndRepair.mockResolvedValue(
        JSON.parse(invalidJSONResponse)
      );

      await expect(
        responseProcessor.processResponse(invalidJSONResponse)
      ).rejects.toThrow();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large valid responses efficiently', async () => {
      const largeResponse = {
        characterName: 'Performance Test Character',
        speechPatterns: Array.from({ length: 25 }, (_, i) => ({
          pattern: `Complex speech pattern number ${i + 1} with detailed descriptive content that explains a unique vocal characteristic`,
          example: `"This is example dialogue number ${i + 1} that demonstrates the specific pattern mentioned above in a realistic context."`,
          circumstances: `When situation ${i + 1} occurs requiring this particular speech adaptation`,
        })),
        generatedAt: '2025-08-25T10:30:00Z',
        metadata: {
          processingMethod: 'json',
          patternCount: 25,
          qualityScore: 0.95,
        },
      };

      const startTime = Date.now();
      const result =
        await speechPatternsValidator.validateResponse(largeResponse);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle minimum boundary cases correctly', async () => {
      const minimumResponse = {
        characterName: 'Min',
        speechPatterns: [
          {
            pattern: 'Short',
            example: '"Hi"',
            circumstances: null,
          },
          {
            pattern: 'Brief',
            example: '"Yes"',
            circumstances: null,
          },
          {
            pattern: 'Terse',
            example: '"No"',
            circumstances: null,
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateResponse(minimumResponse);

      // Should fail due to content quality rules
      expect(result.isValid).toBe(false);
    });

    it('should handle maximum boundary cases correctly', async () => {
      const maximumResponse = {
        characterName: 'Maximum Test Character',
        speechPatterns: Array.from({ length: 30 }, (_, i) => ({
          pattern: `Sophisticated speech pattern ${i + 1} demonstrating complex vocal characteristics and nuanced communication styles that reflect deep personality traits`,
          example: `"This elaborate example dialogue ${i + 1} showcases the intricate way this character expresses themselves in various social and emotional contexts."`,
          circumstances: `When confronted with complex scenario ${i + 1} requiring thoughtful and measured response`,
        })),
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateResponse(maximumResponse);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject responses exceeding maximum patterns', async () => {
      const tooManyPatternsResponse = {
        characterName: 'Over Limit Character',
        speechPatterns: Array.from({ length: 35 }, (_, i) => ({
          pattern: `Pattern ${i + 1}`,
          example: `"Example ${i + 1}"`,
          circumstances: null,
        })),
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result = await speechPatternsValidator.validateResponse(
        tooManyPatternsResponse
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(
          (err) => err.includes('maximum') || err.includes('30')
        )
      ).toBe(true);
    });
  });
});
