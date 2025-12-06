/**
 * @file Speech patterns display enhancement service
 * @description Formats speech patterns for display and export
 */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
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
   *
   * @param {object} dependencies - Service dependencies
   */
  constructor(dependencies) {
    validateDependency(dependencies.logger, 'ILogger', null, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = ensureValidLogger(dependencies.logger);
    this.#logger.debug('SpeechPatternsDisplayEnhancer initialized');
  }

  /**
   * Enhance speech patterns for display
   *
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
   * Format patterns for text export with enhanced formatting
   *
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
        includeStatistics: options.includeStatistics ?? true,
      });

      // Validate input structure
      this.#validatePatternsStructure(patterns);

      const timestamp = new Date().toISOString();
      const characterName = patterns.characterName || 'Character';

      // Build export content with enhanced sections
      let exportContent = this.#generateExportHeader(
        characterName,
        timestamp,
        patterns
      );

      // Add statistics section if requested
      if (options.includeStatistics !== false) {
        exportContent += this.#generateStatisticsSection(patterns);
      }

      // Add patterns grouped by category
      exportContent += this.#generateCategorizedPatternsSection(patterns);

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
   *
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
   *
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

    // Validate each pattern has required fields (support both old and new schema formats)
    patterns.speechPatterns.forEach((pattern, index) => {
      // New schema format (v3.0.0): type and examples[]
      const hasNewFormat = pattern.type && Array.isArray(pattern.examples);
      // Old schema format (v2.0.0): pattern and example
      const hasOldFormat = pattern.pattern && pattern.example;

      if (!hasNewFormat && !hasOldFormat) {
        throw new Error(
          `Pattern ${index + 1} missing required fields (expected 'type' and 'examples[]' OR 'pattern' and 'example')`
        );
      }

      // Additional validation for new format
      if (hasNewFormat) {
        if (typeof pattern.type !== 'string') {
          throw new Error(
            `Pattern ${index + 1}: 'type' field must be a string`
          );
        }
        if (pattern.examples.length < 2) {
          throw new Error(
            `Pattern ${index + 1}: 'examples' must have at least 2 items`
          );
        }
      }
    });
  }

  /**
   * Enhance a single pattern for display
   *
   * @private
   * @param {object} pattern - Raw pattern data
   * @param {number} index - Pattern index
   * @param {object} _options - Enhancement options (unused)
   * @returns {object} Enhanced pattern
   */
  #enhanceSinglePattern(pattern, index, _options) {
    // Support both old and new schema formats
    const patternText = pattern.type || pattern.pattern;

    // Get all examples as array
    const examplesArray = Array.isArray(pattern.examples)
      ? pattern.examples
      : pattern.example
        ? [pattern.example]
        : [];

    // Get all contexts as array
    const contextsArray = Array.isArray(pattern.contexts)
      ? pattern.contexts
      : pattern.circumstances
        ? [pattern.circumstances]
        : [];

    // First example for backward compatibility
    const exampleText = examplesArray[0] || '';

    // Validate that extracted values are strings
    if (typeof patternText !== 'string' || typeof exampleText !== 'string') {
      throw new Error(
        `Pattern ${index + 1} has invalid field types (expected strings)`
      );
    }

    const enhanced = {
      // Basic data (unified format for both schemas)
      id: `pattern-${index + 1}`,
      index: index + 1,
      pattern: patternText.trim(),
      example: exampleText.trim(),
      circumstances: contextsArray[0] ? contextsArray[0].trim() : null,

      // HTML-safe versions for display (legacy field names for backward compatibility)
      htmlSafePattern: this.#escapeHtml(patternText.trim()),
      htmlSafeExample: this.#escapeHtml(exampleText.trim()),
      htmlSafeCircumstances: contextsArray[0]
        ? this.#escapeHtml(contextsArray[0].trim())
        : null,

      // New field names expected by the controller
      htmlSafeType: this.#escapeHtml(patternText.trim()),
      htmlSafeExamples: examplesArray.map((ex) =>
        this.#escapeHtml(typeof ex === 'string' ? ex.trim() : '')
      ),
      htmlSafeContexts: contextsArray.map((ctx) =>
        this.#escapeHtml(typeof ctx === 'string' ? ctx.trim() : '')
      ),

      // Display metadata
      patternLength: patternText.length,
      exampleLength: exampleText.length,
      hasCircumstances: contextsArray.length > 0 && !!contextsArray[0]?.trim(),

      // Content analysis
      complexity: this.#analyzeComplexity(pattern),
      categories: this.#categorizePattern(pattern),
    };

    return enhanced;
  }

  /**
   * Analyze pattern complexity
   *
   * @private
   * @param {object} pattern - Pattern data
   * @returns {object} Complexity analysis
   */
  #analyzeComplexity(pattern) {
    // Support both old and new schema formats
    const patternText = pattern.type || pattern.pattern;
    const exampleText = Array.isArray(pattern.examples)
      ? pattern.examples[0]
      : pattern.example;
    const contextText = pattern.contexts
      ? pattern.contexts[0]
      : pattern.circumstances;

    const textLength = patternText.length + exampleText.length;
    const wordCount = (patternText + ' ' + exampleText).split(/\s+/).length;
    const hasCircumstances = !!(contextText && contextText.trim());

    let complexityScore = 0;
    if (textLength > 100) complexityScore += 1;
    if (wordCount > 20) complexityScore += 1;
    if (hasCircumstances) complexityScore += 1;
    if (exampleText.includes('(') && exampleText.includes(')'))
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
   *
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
   *
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
   * Generate categorized patterns section
   *
   * @private
   * @param {object} patterns - Pattern data
   * @returns {string} Patterns grouped by category
   */
  #generateCategorizedPatternsSection(patterns) {
    // Create category groups
    const categorizedPatterns = {};
    patterns.speechPatterns.forEach((pattern, index) => {
      const categories = this.#categorizePattern(pattern);
      const primaryCategory = categories[0] || 'general';

      if (!categorizedPatterns[primaryCategory]) {
        categorizedPatterns[primaryCategory] = [];
      }

      // Extract fields with support for both schema formats
      const patternText = pattern.type || pattern.pattern;
      const exampleText = Array.isArray(pattern.examples)
        ? pattern.examples[0]
        : pattern.example;
      const contextText = pattern.contexts
        ? pattern.contexts[0]
        : pattern.circumstances;

      categorizedPatterns[primaryCategory].push({
        index: index + 1,
        pattern: patternText,
        example: exampleText,
        circumstances: contextText,
      });
    });

    let sectionText = 'SPEECH PATTERNS BY CATEGORY:\n\n';

    // Generate sections for each category
    Object.entries(categorizedPatterns).forEach(
      ([category, categoryPatterns]) => {
        const categoryTitle =
          category.charAt(0).toUpperCase() + category.slice(1);
        sectionText += `\n${categoryTitle} Patterns (${categoryPatterns.length})\n`;
        sectionText += `${'-'.repeat(categoryTitle.length + 20)}\n\n`;

        categoryPatterns.forEach((pattern) => {
          const number = pattern.index.toString().padStart(2, '0');
          sectionText += `${number}. PATTERN: ${pattern.pattern}\n`;

          if (pattern.circumstances && pattern.circumstances.trim()) {
            sectionText += `    CONTEXT: ${pattern.circumstances.trim()}\n`;
          }

          sectionText += `    EXAMPLE: ${pattern.example}\n\n`;
        });
      }
    );

    return sectionText;
  }

  /**
   * Generate statistics section
   *
   * @private
   * @param {object} patterns - Pattern data
   * @returns {string} Statistics section
   */
  #generateStatisticsSection(patterns) {
    const stats = this.generateStatistics(patterns);

    let statsText = '\nPATTERN STATISTICS:\n';
    statsText += `${'='.repeat(60)}\n\n`;

    statsText += `Total Patterns: ${stats.totalPatterns}\n`;
    statsText += `Average Pattern Length: ${stats.averagePatternLength} characters\n`;
    statsText += `Average Example Length: ${stats.averageExampleLength} characters\n`;
    statsText += `Patterns with Circumstances: ${stats.patternsWithCircumstances} (${Math.round(
      (stats.patternsWithCircumstances / stats.totalPatterns) * 100
    )}%)\n\n`;

    statsText += 'Complexity Distribution:\n';
    Object.entries(stats.complexityDistribution).forEach(([level, count]) => {
      const percentage = Math.round((count / stats.totalPatterns) * 100);
      statsText += `  - ${level.charAt(0).toUpperCase() + level.slice(1)}: ${count} (${percentage}%)\n`;
    });

    statsText += '\nCategory Distribution:\n';
    const sortedCategories = Object.entries(stats.categoryDistribution).sort(
      (a, b) => b[1] - a[1]
    );
    sortedCategories.forEach(([category, count]) => {
      statsText += `  - ${category.charAt(0).toUpperCase() + category.slice(1)}: ${count}\n`;
    });

    statsText += `\n${'='.repeat(60)}\n\n`;

    return statsText;
  }

  /**
   * Generate character data section for export
   *
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
   *
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
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} HTML-escaped text
   */
  #escapeHtml(text) {
    if (typeof text !== 'string') return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Sanitize string for filename
   *
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
   *
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
      {
        id: 'markdown',
        name: 'Markdown',
        extension: 'md',
        mimeType: 'text/markdown',
        description: 'GitHub-flavored markdown format',
      },
      {
        id: 'csv',
        name: 'CSV',
        extension: 'csv',
        mimeType: 'text/csv',
        description: 'Spreadsheet-compatible CSV format',
      },
    ];
  }

  /**
   * Format patterns as JSON for export with enhanced metadata
   *
   * @param {object} patterns - Pattern data
   * @param {object} options - Export options
   * @returns {string} JSON formatted data
   */
  formatAsJson(patterns, options = {}) {
    assertPresent(patterns, 'Speech patterns data');

    try {
      const stats = this.generateStatistics(patterns);
      const exportData = {
        metadata: {
          characterName: patterns.characterName || 'Character',
          generatedAt: patterns.generatedAt || new Date().toISOString(),
          exportedAt: new Date().toISOString(),
          totalPatterns: patterns.speechPatterns.length,
          version: '2.0.0',
          schemaVersion: '1.0.0',
        },
        statistics: {
          averagePatternLength: stats.averagePatternLength,
          averageExampleLength: stats.averageExampleLength,
          patternsWithCircumstances: stats.patternsWithCircumstances,
          complexityDistribution: stats.complexityDistribution,
          categoryDistribution: stats.categoryDistribution,
        },
        speechPatterns: patterns.speechPatterns.map((pattern, index) => {
          // Extract fields with support for both schema formats
          const patternText = pattern.type || pattern.pattern;
          const exampleText = Array.isArray(pattern.examples)
            ? pattern.examples[0]
            : pattern.example;
          const contextText = pattern.contexts
            ? pattern.contexts[0]
            : pattern.circumstances;

          return {
            id: index + 1,
            pattern: patternText,
            example: exampleText,
            circumstances: contextText || null,
            metadata: {
              categories: this.#categorizePattern(pattern),
              complexity: this.#analyzeComplexity(pattern),
            },
          };
        }),
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
   *
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
   * Format patterns as Markdown
   *
   * @param {object} patterns - Pattern data
   * @param {object} options - Export options
   * @returns {string} Markdown formatted data
   */
  formatAsMarkdown(patterns, options = {}) {
    assertPresent(patterns, 'Speech patterns data');

    try {
      this.#logger.debug('Formatting speech patterns as Markdown');
      this.#validatePatternsStructure(patterns);

      const characterName = patterns.characterName || 'Character';
      const timestamp = new Date().toISOString();
      const stats = this.generateStatistics(patterns);

      let markdown = `# Speech Patterns for ${characterName}\n\n`;
      markdown += `> Generated: ${new Date(timestamp).toLocaleString()}\n`;
      markdown += `> Total Patterns: ${patterns.speechPatterns.length}\n\n`;

      // Table of Contents
      markdown += '## Table of Contents\n\n';
      markdown += '1. [Pattern Statistics](#pattern-statistics)\n';
      markdown +=
        '2. [Speech Patterns by Category](#speech-patterns-by-category)\n';
      markdown += '3. [Complete Pattern List](#complete-pattern-list)\n';
      if (options.includeCharacterData) {
        markdown += '4. [Character Definition](#character-definition)\n';
      }
      markdown += '\n';

      // Statistics Section
      markdown += '## Pattern Statistics\n\n';
      markdown += '### Overview\n\n';
      markdown += '| Metric | Value |\n';
      markdown += '|--------|-------|\n';
      markdown += `| Total Patterns | ${stats.totalPatterns} |\n`;
      markdown += `| Average Pattern Length | ${stats.averagePatternLength} chars |\n`;
      markdown += `| Average Example Length | ${stats.averageExampleLength} chars |\n`;
      markdown += `| Patterns with Circumstances | ${stats.patternsWithCircumstances} (${Math.round(
        (stats.patternsWithCircumstances / stats.totalPatterns) * 100
      )}%) |\n\n`;

      markdown += '### Complexity Distribution\n\n';
      markdown += '| Level | Count | Percentage |\n';
      markdown += '|-------|-------|------------|\n';
      Object.entries(stats.complexityDistribution).forEach(([level, count]) => {
        const percentage = Math.round((count / stats.totalPatterns) * 100);
        markdown += `| ${level.charAt(0).toUpperCase() + level.slice(1)} | ${count} | ${percentage}% |\n`;
      });
      markdown += '\n';

      // Patterns by Category
      markdown += '## Speech Patterns by Category\n\n';
      const categorizedPatterns = this.#groupPatternsByCategory(patterns);
      Object.entries(categorizedPatterns).forEach(
        ([category, categoryPatterns]) => {
          markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${categoryPatterns.length})\n\n`;

          categoryPatterns.forEach((pattern) => {
            markdown += `#### Pattern ${pattern.index}\n\n`;
            markdown += `**Pattern:** ${pattern.pattern}\n\n`;
            if (pattern.circumstances) {
              markdown += `**Context:** ${pattern.circumstances}\n\n`;
            }
            markdown += `**Example:** "${pattern.example}"\n\n`;
            markdown += '---\n\n';
          });
        }
      );

      // Complete Pattern List
      markdown += '## Complete Pattern List\n\n';
      markdown += '| # | Pattern | Example | Circumstances |\n';
      markdown += '|---|---------|---------|---------------|\n';
      patterns.speechPatterns.forEach((pattern, index) => {
        const num = index + 1;
        const circumstances = pattern.circumstances || 'Any';
        markdown += `| ${num} | ${this.#escapeMarkdownTableCell(pattern.pattern)} | ${this.#escapeMarkdownTableCell(
          pattern.example
        )} | ${this.#escapeMarkdownTableCell(circumstances)} |\n`;
      });
      markdown += '\n';

      // Character Definition
      if (options.includeCharacterData && options.characterDefinition) {
        markdown += '## Character Definition\n\n';
        markdown += '```json\n';
        markdown += JSON.stringify(options.characterDefinition, null, 2);
        markdown += '\n```\n\n';
      }

      markdown += '---\n\n';
      markdown +=
        '*Generated by Speech Patterns Generator - Living Narrative Engine*\n';

      return markdown;
    } catch (error) {
      this.#logger.error('Failed to format patterns as Markdown', error);
      throw new Error(`Markdown formatting failed: ${error.message}`);
    }
  }

  /**
   * Format patterns as CSV
   *
   * @param {object} patterns - Pattern data
   * @param {object} options - Export options
   * @returns {string} CSV formatted data
   */
  formatAsCsv(patterns, options = {}) {
    assertPresent(patterns, 'Speech patterns data');

    try {
      this.#logger.debug('Formatting speech patterns as CSV');
      this.#validatePatternsStructure(patterns);

      const characterName = patterns.characterName || 'Character';
      const rows = [];

      // Header row
      rows.push([
        'ID',
        'Pattern',
        'Example',
        'Circumstances',
        'Categories',
        'Complexity',
        'Pattern Length',
        'Example Length',
      ]);

      // Data rows
      patterns.speechPatterns.forEach((pattern, index) => {
        // Extract fields with support for both schema formats
        const patternText = pattern.type || pattern.pattern;
        const exampleText = Array.isArray(pattern.examples)
          ? pattern.examples[0]
          : pattern.example;
        const contextText = pattern.contexts
          ? pattern.contexts[0]
          : pattern.circumstances;

        const categories = this.#categorizePattern(pattern);
        const complexity = this.#analyzeComplexity(pattern);

        rows.push([
          index + 1,
          this.#escapeCsvCell(patternText),
          this.#escapeCsvCell(exampleText),
          this.#escapeCsvCell(contextText || ''),
          categories.join('; '),
          complexity.level,
          patternText.length,
          exampleText.length,
        ]);
      });

      // Add metadata rows if requested
      if (options.includeMetadata !== false) {
        rows.unshift([]);
        rows.unshift(['Character Name', characterName]);
        rows.unshift([
          'Generated At',
          patterns.generatedAt || new Date().toISOString(),
        ]);
        rows.unshift(['Export Date', new Date().toISOString()]);
        rows.unshift([]);
      }

      // Convert rows to CSV string
      const csvContent = rows
        .map((row) => row.map((cell) => String(cell)).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      this.#logger.error('Failed to format patterns as CSV', error);
      throw new Error(`CSV formatting failed: ${error.message}`);
    }
  }

  /**
   * Apply template to patterns
   *
   * @param {object} patterns - Pattern data
   * @param {string} templateName - Template to use
   * @param {object} options - Template options
   * @returns {string} Templated output
   */
  applyTemplate(patterns, templateName = 'default', options = {}) {
    assertPresent(patterns, 'Speech patterns data');
    assertNonBlankString(
      templateName,
      'Template name',
      'applyTemplate',
      this.#logger
    );

    try {
      this.#logger.debug(`Applying template: ${templateName}`);
      this.#validatePatternsStructure(patterns);

      const templates = {
        default: () => this.formatForExport(patterns, options || {}),
        detailed: () => this.#generateDetailedTemplate(patterns, options || {}),
        summary: () => this.#generateSummaryTemplate(patterns, options || {}),
        charactersheet: () =>
          this.#generateCharacterSheetTemplate(patterns, options || {}),
      };

      const templateFunction = templates[templateName.toLowerCase()];
      if (!templateFunction) {
        this.#logger.warn(`Unknown template: ${templateName}, using default`);
        return templates.default();
      }

      return templateFunction();
    } catch (error) {
      this.#logger.error(`Failed to apply template ${templateName}`, error);
      throw new Error(`Template application failed: ${error.message}`);
    }
  }

  /**
   * Get available templates
   *
   * @returns {Array<object>} Available templates
   */
  getAvailableTemplates() {
    return [
      {
        id: 'default',
        name: 'Default',
        description: 'Standard formatted export with all patterns',
      },
      {
        id: 'detailed',
        name: 'Detailed Analysis',
        description: 'Comprehensive export with full statistics and analysis',
      },
      {
        id: 'summary',
        name: 'Quick Summary',
        description: 'Condensed overview with key patterns only',
      },
      {
        id: 'characterSheet',
        name: 'Character Sheet',
        description: 'Formatted character profile with speech patterns',
      },
    ];
  }

  // Private Template Methods

  /**
   * Generate detailed template
   *
   * @private
   * @param {object} patterns - Pattern data
   * @param {object} options - Template options
   * @returns {string} Detailed template output
   */
  #generateDetailedTemplate(patterns, options) {
    const characterName = patterns.characterName || 'Character';
    const stats = this.generateStatistics(patterns);

    let output = `COMPREHENSIVE SPEECH PATTERN ANALYSIS\n`;
    output += `${'='.repeat(70)}\n\n`;
    output += `Character: ${characterName}\n`;
    output += `Analysis Date: ${new Date().toLocaleString()}\n\n`;

    // Executive Summary
    output += 'EXECUTIVE SUMMARY\n';
    output += `${'-'.repeat(40)}\n`;
    output += `This analysis covers ${stats.totalPatterns} unique speech patterns generated\n`;
    output += `for the character "${characterName}". The patterns demonstrate\n`;
    output += `varying complexity levels and contextual applications.\n\n`;

    // Full statistics
    output += this.#generateStatisticsSection(patterns);

    // Detailed pattern analysis by category
    output += this.#generateCategorizedPatternsSection(patterns);

    // Character definition if available
    if (options.includeCharacterData && options.characterDefinition) {
      output += this.#generateCharacterDataSection(options.characterDefinition);
    }

    output += this.#generateExportFooter();

    return output;
  }

  /**
   * Generate summary template
   *
   * @private
   * @param {object} patterns - Pattern data
   * @param {object} _options - Template options (unused)
   * @returns {string} Summary template output
   */
  #generateSummaryTemplate(patterns, _options) {
    const characterName = patterns.characterName || 'Character';
    const maxPatterns = _options?.maxPatterns || 10;

    let output = `SPEECH PATTERN SUMMARY: ${characterName.toUpperCase()}\n`;
    output += `${'='.repeat(50)}\n\n`;

    // Quick stats
    const stats = this.generateStatistics(patterns);
    output += `Total Patterns: ${stats.totalPatterns}\n`;
    output += `Complexity: `;
    const dominantComplexity = Object.entries(
      stats.complexityDistribution
    ).sort((a, b) => b[1] - a[1])[0];
    output += `Primarily ${dominantComplexity[0]}\n\n`;

    // Top patterns only
    output += `KEY PATTERNS (Top ${Math.min(maxPatterns, patterns.speechPatterns.length)}):\n`;
    output += `${'-'.repeat(40)}\n\n`;

    patterns.speechPatterns.slice(0, maxPatterns).forEach((pattern, index) => {
      output += `${index + 1}. ${pattern.pattern}\n`;
      output += `   Example: "${pattern.example}"\n\n`;
    });

    if (patterns.speechPatterns.length > maxPatterns) {
      output += `... and ${patterns.speechPatterns.length - maxPatterns} more patterns\n`;
    }

    return output;
  }

  /**
   * Generate character sheet template
   *
   * @private
   * @param {object} patterns - Pattern data
   * @param {object} _options - Template options (unused)
   * @returns {string} Character sheet output
   */
  #generateCharacterSheetTemplate(patterns, _options) {
    const characterName = patterns.characterName || 'Character';
    const stats = this.generateStatistics(patterns);

    let output = `╔${'═'.repeat(68)}╗\n`;
    output += `║${' '.repeat(20)}CHARACTER SPEECH PROFILE${' '.repeat(24)}║\n`;
    output += `╠${'═'.repeat(68)}╣\n`;

    // Character Name
    const nameLabel = `║ Character: ${characterName}`;
    output += nameLabel + ' '.repeat(70 - nameLabel.length) + '║\n';

    // Generation Date
    const dateLabel = `║ Generated: ${new Date(patterns.generatedAt || Date.now()).toLocaleDateString()}`;
    output += dateLabel + ' '.repeat(70 - dateLabel.length) + '║\n';

    output += `╠${'═'.repeat(68)}╣\n`;
    output += `║ SPEECH CHARACTERISTICS${' '.repeat(45)}║\n`;
    output += `╠${'═'.repeat(68)}╣\n`;

    // Key characteristics
    const topCategories = Object.entries(stats.categoryDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    topCategories.forEach(([category]) => {
      const catLabel = `║ • ${category.charAt(0).toUpperCase() + category.slice(1)} speech patterns`;
      output += catLabel + ' '.repeat(70 - catLabel.length) + '║\n';
    });

    output += `╠${'═'.repeat(68)}╣\n`;
    output += `║ SIGNATURE PATTERNS${' '.repeat(49)}║\n`;
    output += `╠${'═'.repeat(68)}╣\n`;

    // Select diverse patterns
    const signaturePatterns = this.#selectSignaturePatterns(patterns, 5);
    signaturePatterns.forEach((pattern, index) => {
      const patternLines = this.#wrapText(pattern.pattern, 64);
      patternLines.forEach((line) => {
        output += `║ ${line}${' '.repeat(67 - line.length)}║\n`;
      });

      const exampleLabel = `  → "${pattern.example}"`;
      const exampleLines = this.#wrapText(exampleLabel, 64);
      exampleLines.forEach((line) => {
        output += `║ ${line}${' '.repeat(67 - line.length)}║\n`;
      });

      if (index < signaturePatterns.length - 1) {
        output += `║${' '.repeat(68)}║\n`;
      }
    });

    output += `╚${'═'.repeat(68)}╝\n`;

    return output;
  }

  // Private Helper Methods

  /**
   * Group patterns by category
   *
   * @private
   * @param {object} patterns - Pattern data
   * @returns {object} Patterns grouped by category
   */
  #groupPatternsByCategory(patterns) {
    const categorizedPatterns = {};

    patterns.speechPatterns.forEach((pattern, index) => {
      const categories = this.#categorizePattern(pattern);
      const primaryCategory = categories[0] || 'general';

      if (!categorizedPatterns[primaryCategory]) {
        categorizedPatterns[primaryCategory] = [];
      }

      // Extract fields with support for both schema formats
      const patternText = pattern.type || pattern.pattern;
      const exampleText = Array.isArray(pattern.examples)
        ? pattern.examples[0]
        : pattern.example;
      const contextText = pattern.contexts
        ? pattern.contexts[0]
        : pattern.circumstances;

      categorizedPatterns[primaryCategory].push({
        index: index + 1,
        pattern: patternText,
        example: exampleText,
        circumstances: contextText,
      });
    });

    return categorizedPatterns;
  }

  /**
   * Select signature patterns for character sheet
   *
   * @private
   * @param {object} patterns - Pattern data
   * @param {number} count - Number of patterns to select
   * @returns {Array} Selected patterns
   */
  #selectSignaturePatterns(patterns, count) {
    // Select patterns with different complexity levels and categories
    const selected = [];
    const usedCategories = new Set();

    patterns.speechPatterns.forEach((pattern) => {
      if (selected.length >= count) return;

      const categories = this.#categorizePattern(pattern);
      const primaryCategory = categories[0];

      if (!usedCategories.has(primaryCategory)) {
        // Extract fields with support for both schema formats
        const patternText = pattern.type || pattern.pattern;
        const exampleText = Array.isArray(pattern.examples)
          ? pattern.examples[0]
          : pattern.example;
        const contextText = pattern.contexts
          ? pattern.contexts[0]
          : pattern.circumstances;

        selected.push({
          pattern: patternText,
          example: exampleText,
          circumstances: contextText,
        });
        usedCategories.add(primaryCategory);
      }
    });

    // Fill remaining slots with any patterns
    if (selected.length < count) {
      patterns.speechPatterns.forEach((pattern) => {
        if (selected.length >= count) return;

        // Check if already selected by comparing pattern text
        const patternText = pattern.type || pattern.pattern;
        const alreadySelected = selected.some((s) => s.pattern === patternText);

        if (!alreadySelected) {
          const exampleText = Array.isArray(pattern.examples)
            ? pattern.examples[0]
            : pattern.example;
          const contextText = pattern.contexts
            ? pattern.contexts[0]
            : pattern.circumstances;

          selected.push({
            pattern: patternText,
            example: exampleText,
            circumstances: contextText,
          });
        }
      });
    }

    return selected.slice(0, count);
  }

  /**
   * Wrap text to specified width
   *
   * @private
   * @param {string} text - Text to wrap
   * @param {number} width - Maximum width
   * @returns {Array<string>} Wrapped lines
   */
  #wrapText(text, width) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /**
   * Escape special characters for Markdown table cells
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  #escapeMarkdownTableCell(text) {
    if (!text) return '';
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '');
  }

  /**
   * Escape special characters for CSV cells
   *
   * @private
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  #escapeCsvCell(text) {
    if (!text) return '';
    // If text contains comma, newline, or quotes, wrap in quotes
    if (text.includes(',') || text.includes('\n') || text.includes('"')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  /**
   * Generate pattern statistics
   *
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
        // Support both old and new schema formats
        const patternText = pattern.type || pattern.pattern;
        const exampleText = Array.isArray(pattern.examples)
          ? pattern.examples[0]
          : pattern.example;
        const contextText = pattern.contexts
          ? pattern.contexts[0]
          : pattern.circumstances;

        // Length calculations
        const patternLen = patternText.length;
        const exampleLen = exampleText.length;
        totalPatternLength += patternLen;
        totalExampleLength += exampleLen;
        totalTextLength += patternLen + exampleLen;

        // Circumstances count
        if (contextText && contextText.trim()) {
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
