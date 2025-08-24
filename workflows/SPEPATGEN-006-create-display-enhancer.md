# SPEPATGEN-006: Create SpeechPatternsDisplayEnhancer Service

## Ticket Overview

- **Epic**: Speech Patterns Generator Implementation
- **Phase**: 2 - Core Implementation
- **Type**: Backend Development/Service
- **Priority**: High
- **Estimated Effort**: 1.5 days
- **Dependencies**: SPEPATGEN-005 (Controller Implementation) - controller depends on this service

## Description

Create the `SpeechPatternsDisplayEnhancer` service responsible for formatting speech patterns for display and export. This service processes raw LLM responses into user-friendly formats, handles HTML escaping for security, and generates export files with proper formatting.

## Requirements

### Service File Creation

- **File**: `src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js`
- **Type**: Service class following project patterns
- **Dependencies**: Integrates with existing utility functions and logging

### Complete Service Implementation

```javascript
/**
 * @file Speech patterns display enhancement service
 * @description Formats speech patterns for display and export
 */

import { validateDependency } from '../../utils/validationUtils.js';
import {
  assertPresent,
  assertNonBlankString,
} from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Service for enhancing speech patterns display and export functionality
 * Handles formatting, HTML escaping, and file generation
 */
export class SpeechPatternsDisplayEnhancer {
  /** @private @type {ILogger} */
  #logger;

  /**
   * Create a new SpeechPatternsDisplayEnhancer instance
   * @param {object} dependencies - Service dependencies
   */
  constructor(dependencies) {
    validateDependency(dependencies.logger, 'ILogger');

    this.#logger = ensureValidLogger(dependencies.logger);
    this.#logger.debug('SpeechPatternsDisplayEnhancer initialized');
  }

  /**
   * Enhance speech patterns for display
   * @param {object} patterns - Raw patterns from LLM
   * @param {object} options - Display options
   * @returns {object} Enhanced patterns for display
   */
  enhanceForDisplay(patterns, options = {}) {
    assertPresent(patterns, 'Speech patterns data');

    try {
      this.#logger.debug('Enhancing speech patterns for display', {
        patternCount: patterns.speechPatterns?.length || 0,
        characterName: patterns.characterName,
      });

      // Validate input structure
      this.#validatePatternsStructure(patterns);

      // Process patterns with enhanced data
      const enhancedPatterns = patterns.speechPatterns.map((pattern, index) =>
        this.#enhanceSinglePattern(pattern, index, options)
      );

      // Generate display metadata
      const displayData = {
        patterns: enhancedPatterns,
        characterName: patterns.characterName || 'Character',
        totalCount: enhancedPatterns.length,
        generatedAt: patterns.generatedAt || new Date().toISOString(),
        displayOptions: options,
      };

      this.#logger.debug('Speech patterns enhanced successfully', {
        totalCount: displayData.totalCount,
      });

      return displayData;
    } catch (error) {
      this.#logger.error(
        'Failed to enhance speech patterns for display',
        error
      );
      throw new Error(`Display enhancement failed: ${error.message}`);
    }
  }

  /**
   * Format patterns for text export
   * @param {object} patterns - Generated patterns
   * @param {object} options - Export options
   * @returns {string} Formatted text for export
   */
  formatForExport(patterns, options = {}) {
    assertPresent(patterns, 'Speech patterns data');

    try {
      this.#logger.debug('Formatting speech patterns for export', {
        patternCount: patterns.speechPatterns?.length || 0,
        includeCharacterData: options.includeCharacterData || false,
      });

      // Validate input structure
      this.#validatePatternsStructure(patterns);

      const timestamp = new Date().toISOString();
      const characterName = patterns.characterName || 'Character';

      // Build export content
      let exportContent = this.#generateExportHeader(
        characterName,
        timestamp,
        patterns
      );
      exportContent += this.#generatePatternsSection(patterns);

      if (options.includeCharacterData && options.characterDefinition) {
        exportContent += this.#generateCharacterDataSection(
          options.characterDefinition
        );
      }

      exportContent += this.#generateExportFooter();

      this.#logger.debug('Export formatting completed successfully');
      return exportContent;
    } catch (error) {
      this.#logger.error('Failed to format speech patterns for export', error);
      throw new Error(`Export formatting failed: ${error.message}`);
    }
  }

  /**
   * Generate filename for export
   * @param {string} characterName - Character name
   * @param {object} options - Filename options
   * @returns {string} Export filename
   */
  generateExportFilename(characterName = 'Character', options = {}) {
    try {
      // Sanitize character name
      const sanitizedName = this.#sanitizeForFilename(characterName);

      // Generate timestamp
      const timestamp =
        options.timestamp || new Date().toISOString().slice(0, 10);

      // Build filename
      const baseFilename = `speech_patterns_${sanitizedName}_${timestamp}`;
      const extension = options.extension || 'txt';

      return `${baseFilename}.${extension}`;
    } catch (error) {
      this.#logger.error('Failed to generate export filename', error);
      return `speech_patterns_export_${Date.now()}.txt`;
    }
  }

  // Private Enhancement Methods

  /**
   * Validate patterns structure
   * @private
   * @param {object} patterns - Patterns data to validate
   */
  #validatePatternsStructure(patterns) {
    if (!patterns.speechPatterns || !Array.isArray(patterns.speechPatterns)) {
      throw new Error(
        'Invalid patterns structure: speechPatterns array required'
      );
    }

    if (patterns.speechPatterns.length === 0) {
      throw new Error('No speech patterns to process');
    }

    // Validate each pattern has required fields
    patterns.speechPatterns.forEach((pattern, index) => {
      if (!pattern.pattern || typeof pattern.pattern !== 'string') {
        throw new Error(
          `Pattern ${index + 1} missing required 'pattern' field`
        );
      }

      if (!pattern.example || typeof pattern.example !== 'string') {
        throw new Error(
          `Pattern ${index + 1} missing required 'example' field`
        );
      }
    });
  }

  /**
   * Enhance a single pattern for display
   * @private
   * @param {object} pattern - Raw pattern data
   * @param {number} index - Pattern index
   * @param {object} options - Enhancement options
   * @returns {object} Enhanced pattern
   */
  #enhanceSinglePattern(pattern, index, options) {
    const enhanced = {
      // Basic data
      id: `pattern-${index + 1}`,
      index: index + 1,
      pattern: pattern.pattern.trim(),
      example: pattern.example.trim(),
      circumstances: pattern.circumstances
        ? pattern.circumstances.trim()
        : null,

      // HTML-safe versions for display
      htmlSafePattern: this.#escapeHtml(pattern.pattern.trim()),
      htmlSafeExample: this.#escapeHtml(pattern.example.trim()),
      htmlSafeCircumstances: pattern.circumstances
        ? this.#escapeHtml(pattern.circumstances.trim())
        : null,

      // Display metadata
      patternLength: pattern.pattern.length,
      exampleLength: pattern.example.length,
      hasCircumstances: !!(
        pattern.circumstances && pattern.circumstances.trim()
      ),

      // Content analysis
      complexity: this.#analyzeComplexity(pattern),
      categories: this.#categorizePattern(pattern),
    };

    return enhanced;
  }

  /**
   * Analyze pattern complexity
   * @private
   * @param {object} pattern - Pattern data
   * @returns {object} Complexity analysis
   */
  #analyzeComplexity(pattern) {
    const textLength = pattern.pattern.length + pattern.example.length;
    const wordCount = (pattern.pattern + ' ' + pattern.example).split(
      /\s+/
    ).length;
    const hasCircumstances = !!(
      pattern.circumstances && pattern.circumstances.trim()
    );

    let complexityScore = 0;
    if (textLength > 100) complexityScore += 1;
    if (wordCount > 20) complexityScore += 1;
    if (hasCircumstances) complexityScore += 1;
    if (pattern.example.includes('(') && pattern.example.includes(')'))
      complexityScore += 1;

    return {
      score: complexityScore,
      level:
        complexityScore >= 3 ? 'high' : complexityScore >= 2 ? 'medium' : 'low',
      textLength,
      wordCount,
    };
  }

  /**
   * Categorize pattern type
   * @private
   * @param {object} pattern - Pattern data
   * @returns {Array<string>} Pattern categories
   */
  #categorizePattern(pattern) {
    const categories = [];
    const combinedText = (
      pattern.pattern +
      ' ' +
      pattern.example
    ).toLowerCase();

    // Emotional categories
    if (
      combinedText.includes('angry') ||
      combinedText.includes('rage') ||
      combinedText.includes('furious')
    ) {
      categories.push('anger');
    }
    if (
      combinedText.includes('sad') ||
      combinedText.includes('depressed') ||
      combinedText.includes('melancholy')
    ) {
      categories.push('sadness');
    }
    if (
      combinedText.includes('happy') ||
      combinedText.includes('joy') ||
      combinedText.includes('cheerful')
    ) {
      categories.push('happiness');
    }
    if (
      combinedText.includes('fear') ||
      combinedText.includes('afraid') ||
      combinedText.includes('terrified')
    ) {
      categories.push('fear');
    }

    // Situational categories
    if (
      combinedText.includes('comfortable') ||
      combinedText.includes('relaxed')
    ) {
      categories.push('comfortable');
    }
    if (
      combinedText.includes('stressed') ||
      combinedText.includes('pressure') ||
      combinedText.includes('tense')
    ) {
      categories.push('stressed');
    }
    if (
      combinedText.includes('formal') ||
      combinedText.includes('professional')
    ) {
      categories.push('formal');
    }
    if (combinedText.includes('casual') || combinedText.includes('informal')) {
      categories.push('casual');
    }

    // Speech characteristics
    if (combinedText.includes('whisper') || combinedText.includes('quiet')) {
      categories.push('quiet');
    }
    if (combinedText.includes('loud') || combinedText.includes('shout')) {
      categories.push('loud');
    }
    if (
      combinedText.includes('sarcasm') ||
      combinedText.includes('sarcastic')
    ) {
      categories.push('sarcastic');
    }

    // Default category if none found
    if (categories.length === 0) {
      categories.push('general');
    }

    return categories;
  }

  // Private Export Methods

  /**
   * Generate export header
   * @private
   * @param {string} characterName - Character name
   * @param {string} timestamp - Generation timestamp
   * @param {object} patterns - Pattern data
   * @returns {string} Export header
   */
  #generateExportHeader(characterName, timestamp, patterns) {
    const patternCount = patterns.speechPatterns.length;
    const generatedAt = new Date(timestamp).toLocaleString();

    return `SPEECH PATTERNS FOR ${characterName.toUpperCase()}
${'='.repeat(50 + characterName.length)}

Generated: ${generatedAt}
Total Patterns: ${patternCount}
Export Generated: ${new Date().toLocaleString()}

This document contains distinctive speech patterns and communication styles
for the character "${characterName}". Each pattern reflects their personality,
background, and emotional states.

${'='.repeat(60)}

SPEECH PATTERNS:

`;
  }

  /**
   * Generate patterns section for export
   * @private
   * @param {object} patterns - Pattern data
   * @returns {string} Formatted patterns section
   */
  #generatePatternsSection(patterns) {
    let patternsText = '';

    patterns.speechPatterns.forEach((pattern, index) => {
      const number = (index + 1).toString().padStart(2, '0');

      patternsText += `${number}. PATTERN: ${pattern.pattern}\n`;

      if (pattern.circumstances && pattern.circumstances.trim()) {
        patternsText += `    CONTEXT: ${pattern.circumstances.trim()}\n`;
      }

      patternsText += `    EXAMPLE: ${pattern.example}\n`;
      patternsText += '\n';

      // Add separator every 5 patterns for readability
      if ((index + 1) % 5 === 0 && index < patterns.speechPatterns.length - 1) {
        patternsText += `${'-'.repeat(40)}\n\n`;
      }
    });

    return patternsText;
  }

  /**
   * Generate character data section for export
   * @private
   * @param {object} characterDefinition - Character data
   * @returns {string} Character data section
   */
  #generateCharacterDataSection(characterDefinition) {
    return `
${'='.repeat(60)}

CHARACTER DEFINITION:

The speech patterns above were generated based on the following character
definition. This data was used to inform the personality, background, and
communication style reflected in each pattern.

${JSON.stringify(characterDefinition, null, 2)}

`;
  }

  /**
   * Generate export footer
   * @private
   * @returns {string} Export footer
   */
  #generateExportFooter() {
    return `
${'='.repeat(60)}

USAGE NOTES:

- These speech patterns are designed to reflect the character's complete persona
- Each pattern can be used in different contexts and emotional states
- Circumstances provided indicate when each pattern is most likely to appear
- Patterns can be adapted and modified to fit specific narrative needs

Generated by Speech Patterns Generator
Living Narrative Engine Character Builder Tool

${'='.repeat(60)}
`;
  }

  // Utility Methods

  /**
   * Escape HTML for safe display
   * @private
   * @param {string} text - Text to escape
   * @returns {string} HTML-escaped text
   */
  #escapeHtml(text) {
    if (typeof text !== 'string') return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sanitize string for filename
   * @private
   * @param {string} name - Name to sanitize
   * @returns {string} Filename-safe string
   */
  #sanitizeForFilename(name) {
    if (typeof name !== 'string') return 'character';

    return (
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s_-]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_+/g, '_') // Collapse multiple underscores
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .substring(0, 50) || // Limit length
      'character'
    ); // Fallback if empty
  }

  // Public Utility Methods

  /**
   * Get supported export formats
   * @returns {Array<object>} Available export formats
   */
  getSupportedExportFormats() {
    return [
      {
        id: 'txt',
        name: 'Plain Text',
        extension: 'txt',
        mimeType: 'text/plain',
        description: 'Human-readable text format',
      },
      {
        id: 'json',
        name: 'JSON Data',
        extension: 'json',
        mimeType: 'application/json',
        description: 'Machine-readable JSON format',
      },
    ];
  }

  /**
   * Format patterns as JSON for export
   * @param {object} patterns - Pattern data
   * @param {object} options - Export options
   * @returns {string} JSON formatted data
   */
  formatAsJson(patterns, options = {}) {
    assertPresent(patterns, 'Speech patterns data');

    try {
      const exportData = {
        metadata: {
          characterName: patterns.characterName || 'Character',
          generatedAt: patterns.generatedAt || new Date().toISOString(),
          exportedAt: new Date().toISOString(),
          totalPatterns: patterns.speechPatterns.length,
          version: '1.0.0',
        },
        speechPatterns: patterns.speechPatterns.map((pattern, index) => ({
          id: index + 1,
          pattern: pattern.pattern,
          example: pattern.example,
          circumstances: pattern.circumstances || null,
          metadata: {
            categories: this.#categorizePattern(pattern),
            complexity: this.#analyzeComplexity(pattern),
          },
        })),
      };

      if (options.includeCharacterData && options.characterDefinition) {
        exportData.characterDefinition = options.characterDefinition;
      }

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      this.#logger.error('Failed to format patterns as JSON', error);
      throw new Error(`JSON formatting failed: ${error.message}`);
    }
  }

  /**
   * Validate export options
   * @param {object} options - Export options to validate
   * @returns {object} Validated and normalized options
   */
  validateExportOptions(options = {}) {
    const validatedOptions = {
      includeCharacterData: Boolean(options.includeCharacterData),
      format: options.format || 'txt',
      timestamp: options.timestamp || new Date().toISOString().slice(0, 10),
      extension: options.extension || 'txt',
    };

    // Validate format
    const supportedFormats = this.getSupportedExportFormats();
    const formatExists = supportedFormats.some(
      (format) => format.id === validatedOptions.format
    );

    if (!formatExists) {
      this.#logger.warn(
        `Unsupported export format: ${validatedOptions.format}, defaulting to txt`
      );
      validatedOptions.format = 'txt';
      validatedOptions.extension = 'txt';
    }

    return validatedOptions;
  }

  /**
   * Generate pattern statistics
   * @param {object} patterns - Pattern data
   * @returns {object} Pattern statistics
   */
  generateStatistics(patterns) {
    assertPresent(patterns, 'Speech patterns data');

    try {
      const stats = {
        totalPatterns: patterns.speechPatterns.length,
        averagePatternLength: 0,
        averageExampleLength: 0,
        patternsWithCircumstances: 0,
        complexityDistribution: { low: 0, medium: 0, high: 0 },
        categoryDistribution: {},
        totalTextLength: 0,
      };

      let totalPatternLength = 0;
      let totalExampleLength = 0;
      let totalTextLength = 0;

      patterns.speechPatterns.forEach((pattern) => {
        // Length calculations
        const patternLen = pattern.pattern.length;
        const exampleLen = pattern.example.length;
        totalPatternLength += patternLen;
        totalExampleLength += exampleLen;
        totalTextLength += patternLen + exampleLen;

        // Circumstances count
        if (pattern.circumstances && pattern.circumstances.trim()) {
          stats.patternsWithCircumstances++;
        }

        // Complexity analysis
        const complexity = this.#analyzeComplexity(pattern);
        stats.complexityDistribution[complexity.level]++;

        // Category analysis
        const categories = this.#categorizePattern(pattern);
        categories.forEach((category) => {
          stats.categoryDistribution[category] =
            (stats.categoryDistribution[category] || 0) + 1;
        });
      });

      // Calculate averages
      stats.averagePatternLength = Math.round(
        totalPatternLength / patterns.speechPatterns.length
      );
      stats.averageExampleLength = Math.round(
        totalExampleLength / patterns.speechPatterns.length
      );
      stats.totalTextLength = totalTextLength;

      return stats;
    } catch (error) {
      this.#logger.error('Failed to generate pattern statistics', error);
      throw new Error(`Statistics generation failed: ${error.message}`);
    }
  }
}

export default SpeechPatternsDisplayEnhancer;
```

## Technical Specifications

### Service Architecture

1. **Display Enhancement**
   - HTML escaping for security
   - Pattern metadata generation
   - Content analysis and categorization

2. **Export Functionality**
   - Multiple export formats (TXT, JSON)
   - Comprehensive text formatting
   - Filename generation and sanitization

3. **Data Processing**
   - Pattern complexity analysis
   - Category classification
   - Statistical analysis

### Integration Points

1. **Controller Integration**: Used by `SpeechPatternsGeneratorController`
2. **Validation System**: Validates pattern structure and content
3. **Logging System**: Comprehensive error and debug logging
4. **Utility Functions**: Uses existing validation and logging utilities

### Security Considerations

1. **HTML Escaping**: All user content properly escaped for display
2. **Filename Sanitization**: Safe filename generation
3. **Input Validation**: Comprehensive input validation
4. **Error Handling**: Secure error messages without information leakage

## Acceptance Criteria

### Display Enhancement Requirements

- [ ] Raw patterns enhanced with HTML-safe versions
- [ ] Pattern metadata generated (complexity, categories)
- [ ] Display formatting preserves content integrity
- [ ] Enhancement process handles edge cases gracefully

### Export Functionality Requirements

- [ ] Text export generates human-readable format
- [ ] JSON export provides machine-readable structure
- [ ] Export files include comprehensive metadata
- [ ] Filename generation creates safe, descriptive names

### Content Analysis Requirements

- [ ] Pattern complexity analysis works accurately
- [ ] Category classification identifies speech characteristics
- [ ] Statistical analysis provides meaningful insights
- [ ] Content processing handles various pattern types

### Security Requirements

- [ ] HTML escaping prevents XSS vulnerabilities
- [ ] Filename sanitization prevents directory traversal
- [ ] Input validation rejects malicious content
- [ ] Error handling doesn't leak sensitive information

### Performance Requirements

- [ ] Enhancement process completes within reasonable time
- [ ] Export generation handles large pattern sets efficiently
- [ ] Content analysis algorithms perform optimally
- [ ] Memory usage remains controlled during processing

## Files Modified

- **NEW**: `src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js`

## Dependencies For Next Tickets

This display service is required for:

- SPEPATGEN-005 (Controller) - controller depends on this service
- SPEPATGEN-013 (Export Functionality) - enhanced export features
- SPEPATGEN-011 (Testing) - service needs comprehensive test coverage

## Notes

- Service provides comprehensive content analysis beyond basic display
- Export functionality supports multiple formats for different use cases
- Security measures implemented throughout for safe content handling
- Statistical analysis provides insights for future feature development
- Error handling ensures graceful degradation in all scenarios
