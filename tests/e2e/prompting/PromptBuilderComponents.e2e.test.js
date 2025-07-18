/**
 * @file E2E test for prompt builder components
 * @see reports/llm-prompt-workflow-analysis.md
 *
 * This test suite validates the core prompt building components work correctly:
 * - Element assemblers (perception log, thoughts, notes, indexed choices)
 * - Placeholder resolution
 * - Assembly order and formatting
 * 
 * Note: This is a focused test on the prompt building components without
 * requiring the full LLM configuration system.
 */

import {
  describe,
  beforeEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { aiTokens } from '../../../src/dependencyInjection/tokens/tokens-ai.js';

describe('Prompt Builder Components E2E', () => {
  let container;
  let placeholderResolver;
  let perceptionLogAssembler;
  let thoughtsAssembler;
  let notesAssembler;
  let indexedChoicesAssembler;
  let logger;

  beforeEach(async () => {
    // Create and configure container
    container = new AppContainer();
    configureContainer(container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Resolve services
    placeholderResolver = container.resolve(aiTokens.PlaceholderResolver);
    perceptionLogAssembler = container.resolve(aiTokens.PerceptionLogAssembler);
    thoughtsAssembler = container.resolve(aiTokens.ThoughtsSectionAssembler);
    notesAssembler = container.resolve(aiTokens.NotesSectionAssembler);
    indexedChoicesAssembler = container.resolve(aiTokens.IndexedChoicesAssembler);
    logger = container.resolve(tokens.ILogger);
  });

  /**
   * Test: Placeholder resolution
   * Verifies placeholders are correctly replaced in content
   */
  test('should resolve placeholders in content', () => {
    // Arrange
    const content = 'Hello {actorName}, you are in {locationName}. Your goal is {goal}.';
    const data = {
      actorName: 'Elara',
      locationName: 'The Silver Dragon Inn',
      goal: 'to find the lost artifact',
    };

    // Act
    const resolved = placeholderResolver.resolve(content, data);

    // Assert
    expect(resolved).toBe('Hello Elara, you are in The Silver Dragon Inn. Your goal is to find the lost artifact.');
  });

  /**
   * Test: Nested placeholder resolution
   * Verifies nested placeholders are resolved correctly
   */
  test('should resolve nested placeholders', () => {
    // Arrange
    const content = '{greeting}, {actor.name}! You have {actor.stats.health} HP.';
    const data = {
      greeting: 'Greetings',
      actor: {
        name: 'Sir Galahad',
        stats: {
          health: 100,
        },
      },
    };

    // Act
    const resolved = placeholderResolver.resolve(content, data);

    // Assert
    expect(resolved).toBe('Greetings, Sir Galahad! You have 100 HP.');
  });

  /**
   * Test: Missing placeholder handling
   * Verifies missing placeholders are handled gracefully
   */
  test('should handle missing placeholders gracefully', () => {
    // Arrange
    const content = 'Hello {name}, your {missingField} is ready.';
    const data = {
      name: 'Alice',
    };

    // Act
    const resolved = placeholderResolver.resolve(content, data);

    // Assert - The placeholder resolver replaces missing placeholders with empty strings
    expect(resolved).toBe('Hello Alice, your  is ready.');
  });

  /**
   * Test: Perception log assembly
   * Verifies perception log entries are correctly formatted
   */
  test('should assemble perception log with proper formatting', async () => {
    // Arrange
    const promptData = {
      perceptionLogArray: [
        { type: 'observation', content: 'The room is dimly lit.' },
        { type: 'speech', content: 'Guard: "Halt! Who goes there?"' },
        { type: 'action', content: 'The merchant counts his coins.' },
      ],
    };
    const elementConfig = {
      key: 'perception_log_wrapper',
      prefix: '<perception_log>\n',
      suffix: '\n</perception_log>',
    };
    const allPromptElementsMap = new Map([
      ['perception_log_entry', {
        key: 'perception_log_entry',
        prefix: '<entry type="{type}">\n',
        suffix: '\n</entry>\n',
      }]
    ]);

    // Act - Call with correct parameters: elementConfig, promptData, placeholderResolver, allPromptElementsMap
    const assembled = perceptionLogAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver,
      allPromptElementsMap
    );

    // Assert
    expect(assembled).toContain('<perception_log>');
    expect(assembled).toContain('</perception_log>');
    expect(assembled).toContain('<entry type="observation">');
    expect(assembled).toContain('The room is dimly lit.');
    expect(assembled).toContain('<entry type="speech">');
    expect(assembled).toContain('Guard: "Halt! Who goes there?"');
    expect(assembled).toContain('<entry type="action">');
    expect(assembled).toContain('The merchant counts his coins.');
  });

  /**
   * Test: Empty perception log handling
   * Verifies empty perception log is handled correctly
   */
  test('should handle empty perception log', async () => {
    // Arrange
    const promptData = {
      perceptionLogArray: [],
    };
    const elementConfig = {
      key: 'perception_log_wrapper',
      prefix: '<perception_log>\n',
      suffix: '\n</perception_log>',
    };
    const allPromptElementsMap = new Map();

    // Act
    const assembled = perceptionLogAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver,
      allPromptElementsMap
    );

    // Assert - The assembler returns just the wrapper when the log is empty
    expect(assembled).toBe('<perception_log>\n\n</perception_log>');
  });

  /**
   * Test: Thoughts section assembly
   * Verifies thoughts are correctly formatted
   */
  test('should assemble thoughts section with entries', async () => {
    // Arrange
    const promptData = {
      thoughtsArray: [
        'I feel uneasy about this place.',
        'The guard seems distracted.',
        'I should wait for a better opportunity.',
      ],
    };
    const elementConfig = {
      key: 'thoughts_wrapper',
      prefix: '<thoughts>\n',
      suffix: '\n</thoughts>',
    };

    // Act
    const assembled = thoughtsAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );

    // Assert
    expect(assembled).toContain('<thoughts>');
    expect(assembled).toContain('</thoughts>');
    expect(assembled).toContain('- I feel uneasy about this place.');
    expect(assembled).toContain('- The guard seems distracted.');
    expect(assembled).toContain('- I should wait for a better opportunity.');
  });

  /**
   * Test: Notes section assembly
   * Verifies notes are correctly formatted
   */
  test('should assemble notes section when notes exist', async () => {
    // Arrange
    const promptData = {
      notesArray: [
        { text: 'Remember the password is "swordfish"' },
        { text: 'Check the basement at midnight' }
      ],
    };
    const elementConfig = {
      key: 'notes_wrapper',
      prefix: '<notes>',
      suffix: '</notes>',
    };

    // Act
    const assembled = notesAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );

    // Assert
    expect(assembled).toContain('<notes>');
    expect(assembled).toContain('</notes>');
    expect(assembled).toContain('Remember the password is "swordfish"');
    expect(assembled).toContain('Check the basement at midnight');
  });

  /**
   * Test: Empty notes handling
   * Verifies empty notes return empty string
   */
  test('should return empty string for empty notes', async () => {
    // Arrange
    const promptData = {
      notesArray: [],
    };
    const elementConfig = {
      key: 'notes_wrapper',
      prefix: '<notes>\n',
      suffix: '\n</notes>',
    };

    // Act
    const assembled = notesAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );

    // Assert
    expect(assembled).toBe('');
  });

  /**
   * Test: Action indexing
   * Verifies actions are properly indexed
   */
  test('should correctly index available actions', async () => {
    // Arrange
    const promptData = {
      indexedChoicesArray: [
        { index: 1, commandString: 'Wait', description: 'Wait and observe' },
        { index: 2, commandString: 'Go North', description: 'Move to the market' },
        { index: 3, commandString: 'Talk to Innkeeper', description: 'Start a conversation' },
      ],
    };
    const elementConfig = {
      key: 'indexed_choices',
      prefix: '<actions>\n',
      suffix: '\n</actions>',
    };

    // Act
    const assembled = indexedChoicesAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );

    // Assert
    expect(assembled).toContain('<actions>');
    expect(assembled).toContain('</actions>');
    expect(assembled).toContain('index: 1 --> Wait (Wait and observe)');
    expect(assembled).toContain('index: 2 --> Go North (Move to the market)');
    expect(assembled).toContain('index: 3 --> Talk to Innkeeper (Start a conversation)');
  });

  /**
   * Test: Complex action with targets
   * Verifies actions with targets are formatted correctly
   */
  test('should format actions with targets correctly', async () => {
    // Arrange
    const promptData = {
      indexedChoicesArray: [
        { index: 1, commandString: 'Attack Goblin', description: 'Attack the goblin with your sword' },
        { index: 2, commandString: 'Cast Spell on Ally', description: 'Cast a healing spell' },
      ],
    };
    const elementConfig = {
      key: 'indexed_choices',
      prefix: '<actions>\n',
      suffix: '\n</actions>',
    };

    // Act
    const assembled = indexedChoicesAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );

    // Assert
    expect(assembled).toContain('index: 1 --> Attack Goblin (Attack the goblin with your sword)');
    expect(assembled).toContain('index: 2 --> Cast Spell on Ally (Cast a healing spell)');
  });

  /**
   * Test: Assembly with custom separators
   * Verifies custom formatting works correctly
   */
  test('should use custom formatting when provided', async () => {
    // Arrange
    const promptData = {
      indexedChoicesArray: [
        { index: 1, commandString: 'Option A', description: 'First option' },
        { index: 2, commandString: 'Option B', description: 'Second option' },
      ],
    };
    const elementConfig = {
      key: 'indexed_choices',
      prefix: '## Available Actions ##\n',
      suffix: '\n## End Actions ##',
    };

    // Act
    const assembled = indexedChoicesAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );

    // Assert
    expect(assembled).toContain('## Available Actions ##');
    expect(assembled).toContain('## End Actions ##');
    expect(assembled).toContain('index: 1 --> Option A (First option)');
    expect(assembled).toContain('index: 2 --> Option B (Second option)');
  });

  /**
   * Test: Placeholder resolution in assemblers
   * Verifies assemblers can use placeholder resolution
   */
  test('should resolve placeholders in assembled content', async () => {
    // Arrange
    const promptData = {
      actorName: 'Elara the Bard',
      thoughtsArray: [
        'As {actorName}, I should be careful here.',
      ],
    };
    const elementConfig = {
      key: 'thoughts_wrapper',
      prefix: '<thoughts of="{actorName}">\n',
      suffix: '\n</thoughts>',
    };

    // Act
    const assembled = thoughtsAssembler.assemble(
      elementConfig,
      promptData,
      placeholderResolver
    );

    // Assert
    expect(assembled).toContain('<thoughts of="Elara the Bard">');
    // Note: The thoughts assembler doesn't resolve placeholders in the content itself
    expect(assembled).toContain('- As {actorName}, I should be careful here.');
  });
});