# SPEPATGEN-008: Create Response Validation Schema

## Ticket Overview

- **Epic**: Speech Patterns Generator Implementation
- **Phase**: 2 - Core Implementation
- **Type**: Data Validation/Schema
- **Priority**: High
- **Estimated Effort**: 1 day
- **Dependencies**: SPEPATGEN-007 (LLM Integration) - defines response structure

## Description

Create a comprehensive JSON Schema for validating LLM responses from the Speech Patterns Generator. This schema ensures response quality, data integrity, and security by validating the structure, content, and constraints of generated speech patterns.

## Requirements

### Schema File Creation

- **File**: `data/schemas/speech-patterns-response.schema.json`
- **Type**: JSON Schema Draft 07 specification
- **Purpose**: Validate LLM responses for speech patterns generation

### Complete Schema Implementation

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "schema://living-narrative-engine/speech-patterns-response.schema.json",
  "title": "Speech Patterns Response Schema",
  "description": "Validates the response from LLM for speech patterns generation, ensuring quality and structure compliance",
  "type": "object",

  "properties": {
    "speechPatterns": {
      "type": "array",
      "description": "Array of generated speech patterns for the character",
      "minItems": 5,
      "maxItems": 30,
      "items": {
        "$ref": "#/definitions/SpeechPattern"
      }
    },

    "characterName": {
      "type": "string",
      "description": "Name of the character these patterns are for",
      "minLength": 1,
      "maxLength": 100,
      "pattern": "^[^<>\"'&]*$"
    },

    "generatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of when patterns were generated"
    },

    "metadata": {
      "type": "object",
      "description": "Optional metadata about the generation process",
      "properties": {
        "processingMethod": {
          "type": "string",
          "enum": ["json", "text_parsing", "hybrid"],
          "description": "Method used to process the LLM response"
        },
        "patternCount": {
          "type": "integer",
          "minimum": 0,
          "description": "Total number of patterns generated"
        },
        "averagePatternLength": {
          "type": "integer",
          "minimum": 0,
          "description": "Average length of pattern descriptions"
        },
        "averageExampleLength": {
          "type": "integer",
          "minimum": 0,
          "description": "Average length of pattern examples"
        },
        "patternsWithCircumstances": {
          "type": "integer",
          "minimum": 0,
          "description": "Number of patterns that include circumstances"
        },
        "qualityScore": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Quality score for the generated patterns (0-1)"
        }
      },
      "additionalProperties": false
    }
  },

  "required": ["speechPatterns"],
  "additionalProperties": false,

  "definitions": {
    "SpeechPattern": {
      "type": "object",
      "description": "Individual speech pattern with example and context",
      "properties": {
        "pattern": {
          "type": "string",
          "description": "Description of the speech pattern or characteristic",
          "minLength": 5,
          "maxLength": 500,
          "pattern": "^[^<>]*$"
        },

        "example": {
          "type": "string",
          "description": "Example of character's voice demonstrating this pattern",
          "minLength": 3,
          "maxLength": 1000,
          "pattern": "^[^<>]*$"
        },

        "circumstances": {
          "type": ["string", "null"],
          "description": "When or where this pattern typically appears",
          "maxLength": 200,
          "pattern": "^[^<>]*$"
        },

        "emotionalContext": {
          "type": "array",
          "description": "Emotional states associated with this pattern",
          "items": {
            "type": "string",
            "enum": [
              "angry",
              "sad",
              "happy",
              "afraid",
              "surprised",
              "disgusted",
              "calm",
              "excited",
              "frustrated",
              "content",
              "anxious",
              "confident",
              "vulnerable",
              "defensive",
              "playful",
              "serious",
              "intimate",
              "formal",
              "casual",
              "stressed",
              "relaxed",
              "curious",
              "bored",
              "passionate",
              "withdrawn",
              "outgoing",
              "neutral"
            ]
          },
          "maxItems": 5,
          "uniqueItems": true
        },

        "socialContext": {
          "type": "array",
          "description": "Social situations where this pattern appears",
          "items": {
            "type": "string",
            "enum": [
              "authority_figure",
              "peer",
              "subordinate",
              "stranger",
              "intimate",
              "family",
              "professional",
              "casual",
              "conflict",
              "cooperation",
              "public",
              "private",
              "group",
              "one_on_one",
              "formal_setting",
              "informal_setting",
              "high_stakes",
              "low_stakes"
            ]
          },
          "maxItems": 5,
          "uniqueItems": true
        },

        "linguisticFeatures": {
          "type": "object",
          "description": "Linguistic characteristics of this pattern",
          "properties": {
            "formality": {
              "type": "string",
              "enum": [
                "very_formal",
                "formal",
                "neutral",
                "informal",
                "very_informal"
              ],
              "description": "Level of formality in the speech pattern"
            },

            "complexity": {
              "type": "string",
              "enum": ["simple", "moderate", "complex"],
              "description": "Linguistic complexity of the pattern"
            },

            "directness": {
              "type": "string",
              "enum": [
                "very_direct",
                "direct",
                "neutral",
                "indirect",
                "very_indirect"
              ],
              "description": "How directly the character communicates"
            },

            "emotionalIntensity": {
              "type": "string",
              "enum": ["very_low", "low", "moderate", "high", "very_high"],
              "description": "Emotional intensity of the speech pattern"
            },

            "verbalTics": {
              "type": "array",
              "description": "Recurring verbal habits or tics",
              "items": {
                "type": "string",
                "maxLength": 50
              },
              "maxItems": 3
            },

            "vocabularyLevel": {
              "type": "string",
              "enum": [
                "basic",
                "everyday",
                "advanced",
                "specialized",
                "academic"
              ],
              "description": "Vocabulary sophistication level"
            }
          },
          "additionalProperties": false
        },

        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Confidence score for this pattern's accuracy (0-1)"
        },

        "tags": {
          "type": "array",
          "description": "Descriptive tags for this pattern",
          "items": {
            "type": "string",
            "minLength": 2,
            "maxLength": 30,
            "pattern": "^[a-zA-Z0-9_-]+$"
          },
          "maxItems": 10,
          "uniqueItems": true
        }
      },

      "required": ["pattern", "example"],
      "additionalProperties": false,

      "allOf": [
        {
          "if": {
            "properties": {
              "circumstances": {
                "type": "string",
                "minLength": 1
              }
            }
          },
          "then": {
            "properties": {
              "circumstances": {
                "minLength": 5,
                "description": "Circumstances must be descriptive if provided"
              }
            }
          }
        }
      ]
    }
  },

  "allOf": [
    {
      "if": {
        "properties": {
          "speechPatterns": {
            "type": "array",
            "minItems": 1
          }
        }
      },
      "then": {
        "properties": {
          "speechPatterns": {
            "contains": {
              "type": "object",
              "properties": {
                "pattern": {
                  "minLength": 10
                },
                "example": {
                  "minLength": 10
                }
              },
              "required": ["pattern", "example"]
            }
          }
        }
      }
    }
  ],

  "examples": [
    {
      "speechPatterns": [
        {
          "pattern": "Uses elaborate metaphors when explaining complex emotions",
          "example": "(Speaking about heartbreak) 'It's like... imagine your favorite song being played backwards on a broken record player.'",
          "circumstances": "When trying to articulate deep emotional pain",
          "emotionalContext": ["vulnerable", "sad"],
          "socialContext": ["intimate", "one_on_one"],
          "linguisticFeatures": {
            "formality": "informal",
            "complexity": "complex",
            "directness": "indirect",
            "emotionalIntensity": "high",
            "vocabularyLevel": "advanced"
          },
          "confidence": 0.9,
          "tags": ["metaphorical", "emotional", "creative"]
        },

        {
          "pattern": "Switches to clipped, military-style speech under pressure",
          "example": "(During a crisis) 'Copy that. Moving to position. ETA two minutes.'",
          "circumstances": "High-stress situations requiring quick decisions",
          "emotionalContext": ["stressed", "focused"],
          "socialContext": ["high_stakes", "professional"],
          "linguisticFeatures": {
            "formality": "formal",
            "complexity": "simple",
            "directness": "very_direct",
            "emotionalIntensity": "moderate",
            "verbalTics": ["copy that", "ETA"],
            "vocabularyLevel": "specialized"
          },
          "confidence": 0.85,
          "tags": ["military", "concise", "professional"]
        }
      ],

      "characterName": "Sarah Mitchell",
      "generatedAt": "2025-08-24T10:30:00Z",
      "metadata": {
        "processingMethod": "json",
        "patternCount": 2,
        "averagePatternLength": 65,
        "averageExampleLength": 85,
        "patternsWithCircumstances": 2,
        "qualityScore": 0.87
      }
    }
  ]
}
```

### Advanced Schema Validation Rules

#### Content Quality Validation

```json
{
  "definitions": {
    "ContentQualityRules": {
      "description": "Advanced validation rules for content quality",

      "patternQuality": {
        "allOf": [
          {
            "description": "Pattern must be descriptive and specific",
            "properties": {
              "pattern": {
                "not": {
                  "pattern": "^(says|talks|speaks|has a way of speaking)\\b"
                },
                "description": "Pattern descriptions should be more specific than generic terms"
              }
            }
          },

          {
            "description": "Pattern should not just describe an accent",
            "properties": {
              "pattern": {
                "not": {
                  "pattern": "\\b(accent|pronunciation|pronounce)\\b"
                },
                "description": "Focus on speech characteristics beyond accents"
              }
            }
          }
        ]
      },

      "exampleQuality": {
        "allOf": [
          {
            "description": "Example should contain actual dialogue",
            "properties": {
              "example": {
                "anyOf": [
                  { "pattern": "['\"].*['\"]" },
                  { "pattern": "\\(.*\\).*['\"].*['\"]" }
                ],
                "description": "Example should contain quoted speech"
              }
            }
          },

          {
            "description": "Example should not be generic placeholder text",
            "properties": {
              "example": {
                "not": {
                  "pattern": "\\b(character says|they say|example|sample|placeholder)\\b"
                },
                "description": "Example should contain specific character dialogue"
              }
            }
          }
        ]
      },

      "circumstancesQuality": {
        "if": {
          "properties": {
            "circumstances": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "then": {
          "properties": {
            "circumstances": {
              "pattern": "^(When|During|In|While|After|Before|If)\\b",
              "description": "Circumstances should start with appropriate temporal/conditional words"
            }
          }
        }
      }
    }
  }
}
```

### Security and Sanitization Rules

#### XSS Prevention Schema Extensions

```json
{
  "definitions": {
    "SecurityRules": {
      "description": "Security-focused validation rules",

      "xssPreventionPattern": "^[^<>\"'&]*$",
      "description": "Prevent potential XSS vectors in text content",

      "scriptTagPrevention": {
        "not": {
          "pattern": "(?i)<script|javascript:|on\\w+\\s*=",
          "description": "Reject content with script tags or event handlers"
        }
      },

      "htmlTagPrevention": {
        "not": {
          "pattern": "(?i)<\\/?[a-z][a-z0-9]*\\b[^<>]*>",
          "description": "Reject content with HTML tags"
        }
      },

      "safeLengthLimits": {
        "description": "Reasonable length limits to prevent DoS",
        "patternMaxLength": 500,
        "exampleMaxLength": 1000,
        "circumstancesMaxLength": 200,
        "characterNameMaxLength": 100
      }
    }
  }
}
```

### Schema Integration with Validation Service

#### Validation Service Integration

```javascript
/**
 * @file Schema validation integration for speech patterns
 */

import { validateDependency } from '../../utils/validationUtils.js';

/**
 * Speech patterns schema validator
 */
export class SpeechPatternsSchemaValidator {
  /** @private @type {ISchemaValidator} */
  #schemaValidator;

  /** @private @type {ILogger} */
  #logger;

  /** @private @type {string} */
  #schemaId = 'speech-patterns-response.schema.json';

  constructor(dependencies) {
    validateDependency(dependencies.schemaValidator, 'ISchemaValidator');
    validateDependency(dependencies.logger, 'ILogger');

    this.#schemaValidator = dependencies.schemaValidator;
    this.#logger = dependencies.logger;
  }

  /**
   * Validate speech patterns response
   * @param {object} response - Response to validate
   * @returns {Promise<object>} Validation result
   */
  async validateResponse(response) {
    try {
      this.#logger.debug('Validating speech patterns response', {
        patternCount: response.speechPatterns?.length || 0,
      });

      const result = await this.#schemaValidator.validate(
        response,
        this.#schemaId
      );

      if (result.isValid) {
        this.#logger.debug('Speech patterns response validation successful');
        return { isValid: true, errors: [] };
      } else {
        this.#logger.warn('Speech patterns response validation failed', {
          errors: result.errors,
        });
        return {
          isValid: false,
          errors: this.#formatValidationErrors(result.errors),
        };
      }
    } catch (error) {
      this.#logger.error('Schema validation error', error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
      };
    }
  }

  /**
   * Validate individual speech pattern
   * @param {object} pattern - Pattern to validate
   * @returns {Promise<object>} Validation result
   */
  async validatePattern(pattern) {
    try {
      // Create a minimal response structure for validation
      const testResponse = {
        speechPatterns: [pattern],
      };

      const result = await this.validateResponse(testResponse);

      if (result.isValid) {
        return { isValid: true, errors: [] };
      } else {
        // Filter errors to only those related to the pattern
        const patternErrors = result.errors.filter(
          (error) =>
            error.includes('speechPatterns[0]') ||
            error.includes('pattern') ||
            error.includes('example')
        );

        return {
          isValid: patternErrors.length === 0,
          errors: patternErrors,
        };
      }
    } catch (error) {
      this.#logger.error('Pattern validation error', error);
      return {
        isValid: false,
        errors: [`Pattern validation error: ${error.message}`],
      };
    }
  }

  /**
   * Format validation errors for user display
   * @private
   * @param {Array} errors - Raw validation errors
   * @returns {Array<string>} Formatted error messages
   */
  #formatValidationErrors(errors) {
    return errors.map((error) => {
      // Convert technical schema errors to user-friendly messages
      if (error.includes('minItems')) {
        return 'Not enough speech patterns generated (minimum 5 required)';
      } else if (error.includes('maxItems')) {
        return 'Too many speech patterns generated (maximum 30 allowed)';
      } else if (error.includes('minLength')) {
        return 'Some pattern descriptions or examples are too short';
      } else if (error.includes('maxLength')) {
        return 'Some pattern descriptions or examples are too long';
      } else if (error.includes('pattern') && error.includes('required')) {
        return 'Missing required pattern description';
      } else if (error.includes('example') && error.includes('required')) {
        return 'Missing required pattern example';
      } else if (error.includes('format')) {
        return 'Invalid data format in response';
      } else {
        // Return original error for unhandled cases
        return error;
      }
    });
  }

  /**
   * Get schema version and metadata
   * @returns {object} Schema information
   */
  getSchemaInfo() {
    return {
      schemaId: this.#schemaId,
      version: '1.0.0',
      description: 'Speech Patterns Response Validation Schema',
      minPatterns: 5,
      maxPatterns: 30,
      supportedEmotions: [
        'angry',
        'sad',
        'happy',
        'afraid',
        'surprised',
        'disgusted',
        'calm',
        'excited',
        'frustrated',
        'content',
        'anxious',
        'confident',
        'vulnerable',
        'defensive',
        'playful',
        'serious',
        'intimate',
        'formal',
        'casual',
        'stressed',
        'relaxed',
        'curious',
        'bored',
        'passionate',
        'withdrawn',
        'outgoing',
        'neutral',
      ],
      supportedSocialContexts: [
        'authority_figure',
        'peer',
        'subordinate',
        'stranger',
        'intimate',
        'family',
        'professional',
        'casual',
        'conflict',
        'cooperation',
        'public',
        'private',
        'group',
        'one_on_one',
        'formal_setting',
        'informal_setting',
        'high_stakes',
        'low_stakes',
      ],
    };
  }
}

export default SpeechPatternsSchemaValidator;
```

## Technical Specifications

### Schema Features

1. **Comprehensive Validation**
   - Required field validation
   - Type and format validation
   - Length constraints
   - Pattern matching for security

2. **Content Quality Rules**
   - Descriptive pattern requirements
   - Dialogue example validation
   - Circumstance format validation
   - Content sophistication checks

3. **Security Measures**
   - XSS prevention patterns
   - HTML tag rejection
   - Script injection prevention
   - Safe length limits

4. **Extensibility**
   - Metadata support for future features
   - Optional enhanced properties
   - Version compatibility
   - Example documentation

### Validation Integration

1. **Service Integration**: Works with existing schema validation service
2. **Error Formatting**: User-friendly error message translation
3. **Pattern-Level Validation**: Individual pattern validation support
4. **Performance Optimization**: Efficient validation with minimal overhead

## Acceptance Criteria

### Schema Structure Requirements

- [ ] Complete JSON Schema Draft 07 compliance
- [ ] Required fields properly defined and validated
- [ ] Optional fields support enhancement metadata
- [ ] Example data provided for documentation

### Content Validation Requirements

- [ ] Pattern descriptions require specific, descriptive content
- [ ] Examples must contain actual dialogue/speech
- [ ] Circumstances follow proper formatting when provided
- [ ] Character names validated with reasonable constraints

### Security Requirements

- [ ] XSS prevention patterns implemented
- [ ] HTML tag injection blocked
- [ ] Script injection prevention active
- [ ] Safe length limits prevent DoS attacks

### Quality Assurance Requirements

- [ ] Minimum pattern count enforced (5+)
- [ ] Maximum pattern count limited (30)
- [ ] Content quality rules prevent generic responses
- [ ] Validation errors provide actionable feedback

### Integration Requirements

- [ ] Schema loads correctly in validation service
- [ ] Validation service integration functions properly
- [ ] Error messages are user-friendly
- [ ] Performance impact is minimal

## Files Modified

- **NEW**: `data/schemas/speech-patterns-response.schema.json`
- **NEW**: `src/characterBuilder/validation/SpeechPatternsSchemaValidator.js`

## Dependencies For Next Tickets

This schema is required for:

- SPEPATGEN-007 (LLM Integration) - provides response validation
- SPEPATGEN-005 (Controller) - ensures data quality in controller
- SPEPATGEN-011 (Testing) - schema needs test coverage

## Notes

- Schema includes advanced content quality rules beyond basic structure
- Security measures prevent common web vulnerabilities
- Extensible design supports future feature enhancements
- Integration with existing validation infrastructure
- Comprehensive error handling with user-friendly messages
- Performance-optimized for real-time validation
