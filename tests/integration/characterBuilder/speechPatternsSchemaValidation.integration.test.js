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
            type: 'Uses elaborate metaphors when explaining complex emotions',
            contexts: ['When discussing difficult personal experiences'],
            examples: [
              '"It\'s like watching a sunset through broken glass."',
              '"My heart feels like shattered glass."',
            ],
          },
          {
            type: 'Switches to technical terminology under stress',
            contexts: ['During high-pressure situations'],
            examples: [
              '"We need to optimize our approach vector immediately."',
              '"Calculating optimal trajectory now."',
            ],
          },
          {
            type: 'Employs self-deprecating humor to deflect attention',
            contexts: ['When uncomfortable with compliments'],
            examples: [
              '"Well, that was about as smooth as sandpaper on silk."',
              '"I\'m a walking disaster, really."',
            ],
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
    it('should enforce schema validation rules', async () => {
      const responseWithSchemaViolations = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            type: 'Hi', // Too short - violates minLength: 5
            contexts: ['anytime'],
            examples: ['"Character says something here"', '"More dialogue"'],
          },
          {
            type: 'Valid pattern that meets minimum requirements',
            contexts: ['various situations'],
            examples: ['Hi', 'Yo'], // Too short - violates minLength: 3
          },
        ],
        // Missing third pattern - violates minItems: 3
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result = await speechPatternsValidator.validateResponse(
        responseWithSchemaViolations
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should have errors for minLength and minItems violations
      expect(
        result.errors.some(
          (err) => err.includes('length') || err.includes('minimum')
        )
      ).toBe(true);
    });

    it('should enforce required field validation', async () => {
      const responseWithMissingFields = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            type: 'Uses descriptive language when painting scenes',
            contexts: ['When describing scenes'],
            // Missing required 'examples' field
          },
          {
            // Missing required 'type' field
            contexts: ['When demonstrating'],
            examples: [
              '"This demonstrates the speaking pattern"',
              '"More examples"',
            ],
          },
          {
            type: 'Shows empathy through careful word choice',
            contexts: ['When being empathetic'],
            examples: ['"I understand how you feel"', '"I\'m here for you"'],
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result = await speechPatternsValidator.validateResponse(
        responseWithMissingFields
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should have errors for missing required fields
      expect(
        result.errors.some(
          (err) => err.includes('required') || err.includes('field')
        )
      ).toBe(true);
    });

    it('should validate circumstances format correctly', async () => {
      const responseWithBadCircumstances = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            type: 'Uses formal language in professional settings',
            contexts: ['Usually does this in meetings'], // Bad format (should be more descriptive)
            examples: [
              '"I believe we should proceed with utmost caution."',
              '"Let us review the data carefully."',
            ],
          },
          {
            type: 'Becomes more casual with trusted friends',
            contexts: ['Sometimes with people they know'], // Bad format
            examples: [
              '"Hey, wanna grab some coffee later?"',
              '"Dude, that was awesome!"',
            ],
          },
          {
            type: 'Shows deference to authority figures',
            contexts: ['Always being respectful to bosses'], // Bad format
            examples: [
              '"Yes, ma\'am. I understand completely."',
              '"Of course, sir."',
            ],
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
            err.includes('contexts') ||
            err.includes('pattern')
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
            type: 'Uses elaborate metaphors when explaining complex emotions',
            contexts: ['When discussing difficult personal experiences'],
            examples: [
              '"It\'s like watching a sunset through broken glass."',
              '"My heart feels like shattered glass."',
            ],
          },
          {
            type: 'Switches to technical terminology under stress',
            contexts: ['During high-pressure situations'],
            examples: [
              '"We need to optimize our approach vector immediately."',
              '"Calculating optimal trajectory now."',
            ],
          },
          {
            type: 'Employs self-deprecating humor to deflect attention',
            contexts: ['When uncomfortable with compliments'],
            examples: [
              '"Well, that was about as smooth as sandpaper on silk."',
              '"I\'m a walking disaster, really."',
            ],
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
            type: 'Uses<script>alert("pattern")</script> elaborate metaphors',
            contexts: [
              'When<script>alert("circumstances")</script> discussing experiences',
            ],
            examples: [
              '"It\'s<iframe src="evil.com"></iframe> like watching a sunset."',
              '"Another <script>bad</script> example"',
            ],
          },
          {
            type: 'Switches to technical terminology under stress',
            contexts: ['During high-pressure situations'],
            examples: [
              '"We need to javascript:alert("example") optimize our approach."',
              '"Calculating <script>evil</script> trajectory"',
            ],
          },
          {
            type: 'Employs self-deprecating humor to deflect attention',
            contexts: ['When uncomfortable'],
            examples: [
              '"Well, that was <div onclick="badFunction()">smooth</div> as silk."',
              '"I\'m <script>terrible</script> at this"',
            ],
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateAndSanitizeResponse(
          maliciousResponse
        );

      expect(result.sanitizedResponse.speechPatterns[0].type).not.toContain(
        '<script>'
      );
      expect(
        result.sanitizedResponse.speechPatterns[0].examples[0]
      ).not.toContain('<iframe>');
      expect(
        result.sanitizedResponse.speechPatterns[0].contexts[0]
      ).not.toContain('<script>');
      expect(
        result.sanitizedResponse.speechPatterns[1].examples[0]
      ).not.toContain('javascript:');
      expect(
        result.sanitizedResponse.speechPatterns[2].examples[0]
      ).not.toContain('onclick=');
    });

    it('should block HTML tags and preserve text content', async () => {
      const htmlResponse = {
        characterName: 'Test Character',
        speechPatterns: [
          {
            type: 'Uses <em>emphasis</em> in important conversations',
            contexts: ['When <b>making</b> crucial points'],
            examples: [
              '"This is <strong>really</strong> important to understand."',
              '"Pay <em>attention</em> to this."',
            ],
          },
          {
            type: 'Includes <a href="link.com">references</a> frequently',
            contexts: ['When sharing information'],
            examples: [
              '"You can find more info <a href="site.com">here</a>."',
              '"Check <a>this link</a> out."',
            ],
          },
          {
            type: 'Sometimes uses <code>technical terms</code> inappropriately',
            contexts: ['During <div>technical</div> discussions'],
            examples: [
              '"The <span class="error">error</span> rate is too high."',
              '"We need <code>optimization</code> now."',
            ],
          },
        ],
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result =
        await speechPatternsValidator.validateAndSanitizeResponse(htmlResponse);

      // HTML tags should be removed but text content preserved
      expect(result.sanitizedResponse.speechPatterns[0].type).toContain(
        'emphasis'
      );
      expect(result.sanitizedResponse.speechPatterns[0].type).not.toContain(
        '<em>'
      );
      expect(result.sanitizedResponse.speechPatterns[0].examples[0]).toContain(
        'really'
      );
      expect(
        result.sanitizedResponse.speechPatterns[0].examples[0]
      ).not.toContain('<strong>');
    });
  });

  describe('Response Processor Integration', () => {
    it('should integrate validator with response processor successfully', async () => {
      const validJSONResponse = JSON.stringify({
        characterName: 'Integrated Test Character',
        speechPatterns: [
          {
            type: 'Uses technical jargon when nervous or uncertain',
            contexts: ['When facing unfamiliar or challenging situations'],
            examples: [
              '"We need to recalibrate the parameters for optimal functionality."',
              '"Let\'s optimize the workflow processes."',
            ],
          },
          {
            type: 'Becomes more personal and warm in casual settings',
            contexts: ['During relaxed conversations with trusted individuals'],
            examples: [
              '"You know, I was just thinking about that story you told me."',
              '"That reminds me of what you said."',
            ],
          },
          {
            type: 'Adopts formal speech patterns in professional contexts',
            contexts: ['In business meetings or official presentations'],
            examples: [
              '"I would be honored to present our findings to the committee."',
              '"May I direct your attention to the data."',
            ],
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
        speechPatterns: Array.from({ length: 8 }, (_, i) => ({
          type: `Complex speech pattern number ${i + 1} with detailed descriptive content that explains a unique vocal characteristic`,
          contexts: [
            `When situation ${i + 1} occurs requiring this particular speech adaptation`,
          ],
          examples: [
            `"This is example dialogue number ${i + 1} that demonstrates the specific pattern mentioned above in a realistic context."`,
            `"Another example ${i + 1} showing the same pattern."`,
          ],
        })),
        generatedAt: '2025-08-25T10:30:00Z',
        metadata: {
          processingMethod: 'json',
          patternCount: 8,
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
            type: 'Short',
            contexts: ['Anytime'],
            examples: ['"Hi"', '"Hey"'],
          },
          {
            type: 'Brief',
            contexts: ['When answering'],
            examples: ['"Yes"', '"Yep"'],
          },
          {
            type: 'Terse',
            contexts: ['When refusing'],
            examples: ['"No"', '"Nope"'],
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
        speechPatterns: Array.from({ length: 8 }, (_, i) => ({
          type: `Sophisticated speech pattern ${i + 1} demonstrating complex vocal characteristics and nuanced communication styles that reflect deep personality traits`,
          contexts: [
            `When confronted with complex scenario ${i + 1} requiring thoughtful and measured response`,
          ],
          examples: [
            `"This elaborate example dialogue ${i + 1} showcases the intricate way this character expresses themselves in various social and emotional contexts."`,
            `"Another elaborate example ${i + 1} demonstrating the same sophisticated pattern."`,
          ],
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
        speechPatterns: Array.from({ length: 9 }, (_, i) => ({
          type: `Pattern ${i + 1}`,
          contexts: [`Context ${i + 1}`],
          examples: [`"Example ${i + 1}"`, `"Example ${i + 1} again"`],
        })),
        generatedAt: '2025-08-25T10:30:00Z',
      };

      const result = await speechPatternsValidator.validateResponse(
        tooManyPatternsResponse
      );

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some(
          (err) => err.includes('maximum') || err.includes('8')
        )
      ).toBe(true);
    });
  });
});
