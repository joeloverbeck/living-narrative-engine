import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraitsDisplayEnhancer } from '../../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';
import ConsoleLogger, {
  LogLevel,
} from '../../../../src/logging/consoleLogger.js';

/**
 *
 */
function createConsoleSpies() {
  return {
    debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    info: jest.spyOn(console, 'info').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
}

describe('TraitsDisplayEnhancer integration', () => {
  let consoleSpies;

  beforeEach(() => {
    consoleSpies = createConsoleSpies();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /**
   *
   */
  function createEnhancer() {
    const logger = new ConsoleLogger(LogLevel.DEBUG);
    return new TraitsDisplayEnhancer({ logger });
  }

  /**
   *
   */
  function createComprehensiveTraitsData() {
    return {
      id: 'traits-001',
      generatedAt: '2024-05-10T15:30:00.000Z',
      names: [
        { name: 'Eira Solace', justification: 'Balances warmth with mystery.' },
        {
          name: 'Lysa Thorn',
          justification: 'Carries the sting of hard lessons and resilience.',
        },
      ],
      physicalDescription: 'Tall, poised, and always scanning the horizon.',
      personality: [
        {
          trait: 'Resolute',
          explanation: 'Holds course even when morale wavers among her crew.',
        },
        {
          trait: 'Empathetic Strategist',
          explanation: 'Understands the emotional stakes of every decision.',
        },
      ],
      strengths: ['Tactical awareness', 'Adaptive leadership'],
      weaknesses: ['Sleeplessness', 'Overcommitment'],
      likes: ['Star charts', 'Quiet harbors'],
      dislikes: ['Unplanned risks', 'Rash decisions'],
      fears: ['Losing the crew', 'Repeating past mistakes'],
      goals: {
        shortTerm: ['Secure supply routes', 'Train a successor'],
        longTerm: 'Retire the fleet without a single casualty.',
      },
      notes: ['Keeps a weathered logbook', 'Trusts the first mate implicitly'],
      profile:
        'A decorated captain who masks exhaustion behind a calm authority, trusted by every sailor aboard.',
      secrets: ['Considers abandoning command after current tour'],
      metadata: {
        model: 'gpt-test',
        temperature: 0.65,
        tokens: 1825,
        responseTime: 143,
        promptVersion: 'traits-v3',
      },
    };
  }

  it('enhances comprehensive traits data for display with formatted metadata', () => {
    const enhancer = createEnhancer();
    const traitsData = createComprehensiveTraitsData();

    const result = enhancer.enhanceForDisplay(traitsData, {
      includeMetadata: true,
      expandStructuredData: true,
    });

    expect(result).toMatchObject({
      id: 'traits-001',
      metadata: {
        model: 'gpt-test',
        temperature: 0.65,
        tokenCount: 1825,
        generationTime: '143ms',
        promptVersion: 'traits-v3',
      },
    });

    const categoryOrder = result.categories.map((category) => category.id);
    expect(categoryOrder).toEqual([
      'names',
      'physical',
      'personality',
      'strengths',
      'weaknesses',
      'likes',
      'dislikes',
      'fears',
      'goals',
      'notes',
      'profile',
      'secrets',
    ]);

    const namesCategory = result.categories.find(
      (category) => category.id === 'names'
    );
    expect(namesCategory.items).toEqual([
      {
        primary: 'Eira Solace',
        secondary: 'Balances warmth with mystery.',
        type: 'name-justification',
      },
      {
        primary: 'Lysa Thorn',
        secondary: 'Carries the sting of hard lessons and resilience.',
        type: 'name-justification',
      },
    ]);

    expect(result.summary).toEqual(
      expect.objectContaining({
        totalCategories: 12,
        namesCount: 2,
        personalityCount: 2,
        hasPhysicalDescription: true,
        hasProfile: true,
        completeness: 100,
      })
    );
  });

  it('skips metadata and preserves structured arrays when options disable formatting', () => {
    const enhancer = createEnhancer();
    const traitsData = createComprehensiveTraitsData();

    const result = enhancer.enhanceForDisplay(traitsData, {
      includeMetadata: false,
      expandStructuredData: false,
    });

    expect(result.metadata).toBeUndefined();

    const namesCategory = result.categories.find(
      (category) => category.id === 'names'
    );
    expect(namesCategory.items).toBe(traitsData.names);

    const personalityCategory = result.categories.find(
      (category) => category.id === 'personality'
    );
    expect(personalityCategory.items).toBe(traitsData.personality);
  });

  it('formats traits for export with user context and metadata sections', () => {
    const enhancer = createEnhancer();
    const traitsData = createComprehensiveTraitsData();

    const exportText = enhancer.formatForExport(traitsData, {
      concept: 'Haunted Navigator',
      direction: 'Coastal Vigil',
      userInputs: {
        coreMotivation: 'Protect every soul aboard the flagship.',
        internalContradiction: 'Secretly questions her own worthiness.',
        centralQuestion: 'Can vigilance atone for past errors?',
      },
    });

    expect(exportText).toContain('CHARACTER TRAITS');
    expect(exportText).toContain('Concept: Haunted Navigator');
    expect(exportText).toContain('Thematic Direction: Coastal Vigil');
    expect(exportText).toContain('NAMES');
    expect(exportText).toContain(
      '• Eira Solace: Balances warmth with mystery.'
    );
    expect(exportText).toContain('PHYSICAL DESCRIPTION');
    expect(exportText).toContain('PERSONALITY');
    expect(exportText).toContain('LIKES');
    expect(exportText).toContain('USER INPUTS');
    expect(exportText).toContain('LLM Model: gpt-test');
    expect(exportText).toContain('Prompt Version: traits-v3');
  });

  it('handles sparse traits data, invalid timestamps, and absence of optional sections', () => {
    const enhancer = createEnhancer();
    const sparseTraitsData = {
      id: 'traits-002',
      profile: 'A mysterious figure whose story has yet to be written.',
      generatedAt: 'not-a-real-date',
    };

    const exportText = enhancer.formatForExport(sparseTraitsData, {});

    expect(exportText).toContain('Generated: Invalid date');
    expect(exportText).toContain('• No names generated');
    expect(exportText).toContain('No physical description provided');
    expect(exportText).toContain('• No personality traits generated');
    expect(exportText).toContain('• No strengths specified');
    expect(exportText).toContain('• No weaknesses specified');
    expect(exportText).toContain('• No likes specified');
    expect(exportText).toContain('• No dislikes specified');
    expect(exportText).toContain('• No fears specified');
    expect(exportText).toContain('• No goals specified');
    expect(exportText).toContain('• No additional notes');
    expect(exportText).toContain('• No secrets specified');

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining('Invalid date string: not-a-real-date')
    );
  });

  it('generates sanitized export filenames using the current timestamp', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-12-01T08:09:10.000Z'));

    const enhancer = createEnhancer();

    const filename = enhancer.generateExportFilename(
      createComprehensiveTraitsData(),
      {
        direction: 'The Dawn & Twilight Saga! 2024',
      }
    );

    const now = new Date();
    const expectedTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(
      2,
      '0'
    )}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(
      now.getSeconds()
    ).padStart(2, '0')}`;
    const expectedFilename = `traits_the-dawn-twilight-saga-2024_${expectedTimestamp}.txt`;

    expect(filename).toBe(expectedFilename);
  });

  it('logs and rethrows validation failures when traits data is missing content', () => {
    const enhancer = createEnhancer();

    expect(() => enhancer.enhanceForDisplay({}, {})).toThrow(
      'Traits data must contain at least some content'
    );

    expect(consoleSpies.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Invalid traits data provided: Traits data must contain at least some content'
      )
    );
  });
});
