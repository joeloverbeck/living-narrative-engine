import { describe, it, expect, beforeEach } from '@jest/globals';
import SpeechPatternsDisplayEnhancer from '../../../src/characterBuilder/services/SpeechPatternsDisplayEnhancer.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';
import {
  createMockSpeechPatterns,
  createMockCharacterDefinition,
} from '../../common/characterBuilder/speechPatternsTestHelpers.js';

const buildComprehensivePatterns = () => {
  const base = createMockSpeechPatterns();
  const extendedPatterns = [
    ...base.speechPatterns,
    {
      pattern: 'Whispers quietly while feeling sad and afraid',
      example: 'I am so afraid of what will happen next, it makes me sad.',
      circumstances: 'When sad, quiet, and fearful during the night',
    },
    {
      pattern:
        'Projects loud sarcastic remarks whenever stressed or under pressure',
      example:
        'Oh, GREAT move! Truly brilliant (what could possibly go wrong?).',
      circumstances: 'High-pressure meetings where stress and sarcasm leak out',
    },
    {
      pattern: 'Speaks in a formal and comfortable register at academic events',
      example:
        'It is my genuine pleasure to engage in this discourse with you.',
      circumstances: 'Comfortable lectures in formal professional settings',
    },
    {
      pattern: 'Casual cheerful banter during relaxed gatherings',
      example:
        'Hey! Happy you made it, relax and grab a drink while we catch up!',
      circumstances: 'Casual hangouts when everyone feels comfortable',
    },
    {
      pattern: 'Delivers motivational speeches with detailed encouragement',
      example:
        'You are doing fantastic (truly). Keep pushing forward because success awaits persistent hearts.',
      circumstances: 'Motivational talks when team members feel stressed',
    },
    {
      pattern:
        'Shares secretive plans in hushed tones with commas and newlines',
      example:
        'Keep it quiet, stay close,\nand follow the whispered plan carefully.',
      circumstances: 'Coordinating quiet missions late at night',
    },
    {
      pattern: 'Offers simple reassurance without strong keywords',
      example: 'This is fine.',
      circumstances: null,
    },
    {
      pattern: 'Discusses joy and comfort in casual conversations',
      example:
        'I feel so happy and relaxed whenever we get comfortable together.',
      circumstances: 'Casual evenings filled with comfortable laughter',
    },
    {
      pattern:
        'Addresses formal audiences while remaining relaxed and composed',
      example:
        'Ladies and gentlemen, allow me to calmly outline the comforting plan ahead.',
      circumstances:
        'Formal presentations that should feel comfortable for everyone',
    },
  ];

  return {
    ...base,
    speechPatterns: extendedPatterns,
  };
};

const expectCategoriesPresent = (patterns, categories) => {
  const discovered = new Set();
  for (const pattern of patterns) {
    for (const category of pattern.categories) {
      discovered.add(category);
    }
  }
  categories.forEach((category) => expect(discovered).toContain(category));
};

describe('SpeechPatternsDisplayEnhancer integration', () => {
  let enhancer;
  let patterns;
  let characterDefinition;

  beforeEach(() => {
    enhancer = new SpeechPatternsDisplayEnhancer({
      logger: new NoOpLogger(),
    });
    patterns = buildComprehensivePatterns();
    characterDefinition = createMockCharacterDefinition();
  });

  it('processes a rich dataset across every export surface with real collaborators', () => {
    const displayData = enhancer.enhanceForDisplay(patterns);

    expect(displayData.totalCount).toBe(patterns.speechPatterns.length);
    expect(displayData.characterName).toBe('Test Character');
    expect(displayData.patterns.every((p) => p.htmlSafePattern)).toBe(true);
    expectCategoriesPresent(displayData.patterns, [
      'anger',
      'sadness',
      'happiness',
      'fear',
      'comfortable',
      'stressed',
      'formal',
      'casual',
      'quiet',
      'loud',
      'sarcastic',
      'general',
    ]);

    const exportText = enhancer.formatForExport(patterns, {
      includeStatistics: true,
      includeCharacterData: true,
      characterDefinition,
    });
    expect(exportText).toContain('SPEECH PATTERNS FOR TEST CHARACTER');
    expect(exportText).toContain('PATTERN STATISTICS');
    expect(exportText).toContain('CHARACTER DEFINITION:');

    const markdown = enhancer.formatAsMarkdown(patterns, {
      includeCharacterData: true,
      characterDefinition,
    });
    expect(markdown).toContain('## Pattern Statistics');
    expect(markdown).toContain('## Speech Patterns by Category');
    expect(markdown).toContain('## Character Definition');

    const jsonPayload = JSON.parse(
      enhancer.formatAsJson(patterns, {
        includeCharacterData: true,
        characterDefinition,
      })
    );
    expect(jsonPayload.metadata.characterName).toBe('Test Character');
    expect(jsonPayload.metadata.totalPatterns).toBe(
      patterns.speechPatterns.length
    );
    expect(jsonPayload.characterDefinition).toEqual(characterDefinition);

    const csv = enhancer.formatAsCsv(patterns, { includeMetadata: true });
    expect(csv).toContain('Character Name,Test Character');
    expect(csv).toContain(
      'ID,Pattern,Example,Circumstances,Categories,Complexity'
    );
    expect(csv).toContain('"Keep it quiet, stay close');

    const csvWithoutMetadata = enhancer.formatAsCsv(patterns, {
      includeMetadata: false,
    });
    expect(csvWithoutMetadata.startsWith('ID,Pattern,Example')).toBe(true);
    expect(csvWithoutMetadata).not.toContain('Export Date');

    const detailedTemplate = enhancer.applyTemplate(patterns, 'detailed', {
      includeCharacterData: true,
      characterDefinition,
    });
    expect(detailedTemplate).toContain('COMPREHENSIVE SPEECH PATTERN ANALYSIS');

    const summaryTemplate = enhancer.applyTemplate(patterns, 'summary', {
      maxPatterns: 3,
    });
    expect(summaryTemplate).toContain('KEY PATTERNS (Top 3)');
    expect(summaryTemplate).toContain('... and');

    const characterSheet = enhancer.applyTemplate(patterns, 'characterSheet', {
      characterDefinition,
    });
    expect(characterSheet).toContain('CHARACTER SPEECH PROFILE');
    expect(characterSheet).toContain('SIGNATURE PATTERNS');

    const fallbackTemplate = enhancer.applyTemplate(
      patterns,
      'unknown-template',
      {}
    );
    expect(fallbackTemplate).toContain('SPEECH PATTERNS BY CATEGORY');

    const sanitizedFilename = enhancer.generateExportFilename(
      '  Dr. Élodie / "The Storm"  ',
      {
        timestamp: '2025-01-02',
        extension: 'md',
      }
    );
    expect(sanitizedFilename).toBe(
      'speech_patterns_dr_lodie_the_storm_2025-01-02.md'
    );

    const fallbackFilename = enhancer.generateExportFilename('Name', {
      timestamp: {
        toString() {
          throw new Error('boom');
        },
      },
    });
    expect(fallbackFilename.startsWith('speech_patterns_export_')).toBe(true);

    const validatedUnsupported = enhancer.validateExportOptions({
      includeCharacterData: true,
      format: 'binary',
      extension: 'bin',
      timestamp: '2025-03-17',
    });
    expect(validatedUnsupported.format).toBe('txt');
    expect(validatedUnsupported.extension).toBe('txt');
    expect(validatedUnsupported.includeCharacterData).toBe(true);

    const supportedFormats = enhancer
      .getSupportedExportFormats()
      .map((f) => f.id);
    expect(supportedFormats).toEqual(
      expect.arrayContaining(['txt', 'json', 'markdown', 'csv'])
    );

    const templates = enhancer.getAvailableTemplates().map((t) => t.id);
    expect(templates).toEqual(
      expect.arrayContaining([
        'default',
        'detailed',
        'summary',
        'characterSheet',
      ])
    );

    const statistics = enhancer.generateStatistics(patterns);
    expect(statistics.totalPatterns).toBe(patterns.speechPatterns.length);
    const complexitySum =
      statistics.complexityDistribution.low +
      statistics.complexityDistribution.medium +
      statistics.complexityDistribution.high;
    expect(complexitySum).toBe(statistics.totalPatterns);
    expect(Object.keys(statistics.categoryDistribution).length).toBeGreaterThan(
      3
    );
  });

  it('guards entry points against malformed datasets', () => {
    const invalidPatterns = { speechPatterns: [], characterName: 'Empty' };
    const missingStructure = { characterName: 'No patterns here' };

    expect(() => enhancer.enhanceForDisplay(invalidPatterns)).toThrow(
      'No speech patterns to process'
    );
    expect(() => enhancer.formatForExport(invalidPatterns)).toThrow(
      'Export formatting failed: No speech patterns to process'
    );
    expect(() => enhancer.formatAsJson(missingStructure)).toThrow(
      "JSON formatting failed: Statistics generation failed: Cannot read properties of undefined (reading 'length')"
    );
    expect(() => enhancer.formatAsMarkdown(invalidPatterns)).toThrow(
      'Markdown formatting failed: No speech patterns to process'
    );
    expect(() => enhancer.formatAsCsv(invalidPatterns)).toThrow(
      'CSV formatting failed: No speech patterns to process'
    );
    expect(() => enhancer.applyTemplate(invalidPatterns, 'summary')).toThrow(
      'Template application failed: No speech patterns to process'
    );
    expect(() => enhancer.applyTemplate(invalidPatterns, '')).toThrow(
      /Template name/
    );
  });
});
