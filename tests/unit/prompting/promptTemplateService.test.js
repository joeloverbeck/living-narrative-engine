/**
 * @file Tests for PromptTemplateService
 * @description Tests for template processing, error handling, and edge cases
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { PromptTemplateService } from '../../../src/prompting/promptTemplateService.js';

describe('PromptTemplateService - Conditional Section Template Processing', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new PromptTemplateService({ logger: mockLogger });
  });

  describe('processTemplate with conditional sections', () => {
    test('processes template with empty thoughts markup preserved', () => {
      const template = `<character_persona>
{characterPersonaContent}
</character_persona>

{thoughtsSection}

{notesSection}

{goalsSection}

<final_instructions>
{finalInstructionsContent}
</final_instructions>`;

      const data = {
        characterPersonaContent: 'Test character persona',
        thoughtsSection: '<thoughts>\n</thoughts>', // Empty section now preserved
        notesSection: '<notes>\n- Important note\n</notes>', // Non-empty section
        goalsSection: '', // Empty section - should not appear
        finalInstructionsContent: 'Test instructions',
      };

      const result = service.processTemplate(template, data);

      // Should contain the character persona and final instructions
      expect(result).toContain(
        '<character_persona>\nTest character persona\n</character_persona>'
      );
      expect(result).toContain(
        '<final_instructions>\nTest instructions\n</final_instructions>'
      );

      // Should contain the thoughts and notes sections
      expect(result).toContain('<thoughts>');
      expect(result).toContain('<notes>\n- Important note\n</notes>');

      // Should NOT contain empty goals section
      expect(result).not.toContain('<goals>');
    });

    test('processes template with all sections filled', () => {
      const template = `{thoughtsSection}

{notesSection}

{goalsSection}`;

      const data = {
        thoughtsSection:
          '<thoughts>\n- First thought\n- Second thought\n</thoughts>',
        notesSection: '<notes>\n- Important note\n</notes>',
        goalsSection: '<goals>\n- Complete quest\n</goals>',
      };

      const result = service.processTemplate(template, data);

      // Should contain all sections
      expect(result).toContain(
        '<thoughts>\n- First thought\n- Second thought\n</thoughts>'
      );
      expect(result).toContain('<notes>\n- Important note\n</notes>');
      expect(result).toContain('<goals>\n- Complete quest\n</goals>');
    });

    test('processes template with empty sections and preserved thoughts tag', () => {
      const template = `<start>
{thoughtsSection}

{notesSection}

{goalsSection}
<end>`;

      const data = {
        thoughtsSection: '<thoughts>\n</thoughts>',
        notesSection: '',
        goalsSection: '',
      };

      const result = service.processTemplate(template, data);

      // Should contain thoughts wrapper even when empty
      expect(result).toContain('<thoughts>');
      expect(result).toContain('</thoughts>');
      // Other empty sections should be omitted
      expect(result).not.toContain('<notes>');
      expect(result).not.toContain('<goals>');

      // Should still contain the start and end markers
      expect(result).toContain('<start>');
      expect(result).toContain('<end>');
    });
  });

  describe('processCharacterPrompt with conditional sections', () => {
    test('processes character template with mixed empty and filled sections', () => {
      const promptData = {
        taskDefinitionContent: 'Test task',
        characterPersonaContent: 'Test character',
        portrayalGuidelinesContent: 'Test guidelines',
        contentPolicyContent: 'Test policy',
        worldContextContent: 'Test world',
        perceptionLogContent: 'Test perception',
        thoughtsSection: '<thoughts>\n- Character thought\n</thoughts>', // Has content
        notesSection: '', // Empty
        goalsSection: '<goals>\n- Character goal\n</goals>', // Has content
        availableActionsInfoContent: 'Test actions',
        indexedChoicesContent: 'Test choices',
        userInputContent: 'Test input',
        finalInstructionsContent: 'Test instructions',
        assistantResponsePrefix: '\n',
      };

      const result = service.processCharacterPrompt(promptData);

      // Should contain filled sections
      expect(result).toContain('<thoughts>\n- Character thought\n</thoughts>');
      expect(result).toContain('<goals>\n- Character goal\n</goals>');

      // Should NOT contain empty notes section
      expect(result).not.toContain('<notes>');

      // Should contain other required sections
      expect(result).toContain(
        '<task_definition>\nTest task\n</task_definition>'
      );
      expect(result).toContain(
        '<character_persona>\nTest character\n</character_persona>'
      );
      expect(result).toContain('<world_context>\nTest world\n</world_context>');
    });

    test('processes character template with all empty conditional sections', () => {
      const promptData = {
        taskDefinitionContent: 'Test task',
        characterPersonaContent: 'Test character',
        portrayalGuidelinesContent: '',
        contentPolicyContent: '',
        worldContextContent: '',
        perceptionLogContent: '',
        thoughtsSection: '<thoughts>\n</thoughts>', // Empty but preserved
        notesSection: '', // Empty
        goalsSection: '', // Empty
        availableActionsInfoContent: '',
        indexedChoicesContent: '',
        userInputContent: '',
        finalInstructionsContent: '',
        assistantResponsePrefix: '',
      };

      const result = service.processCharacterPrompt(promptData);

      // Should contain empty thoughts wrapper and omit other sections
      expect(result).toContain('<thoughts>');
      expect(result).not.toContain('<notes>');
      expect(result).not.toContain('<goals>');

      // Should still contain required structure sections (even if empty)
      expect(result).toContain('<task_definition>');
      expect(result).toContain('<character_persona>');
    });
  });

  describe('Token efficiency validation', () => {
    test('empty sections save tokens by not generating XML tags', () => {
      const templateWithEmptySections = `{thoughtsSection}\n{notesSection}\n{goalsSection}`;

      const emptyData = {
        thoughtsSection: '<thoughts>\n</thoughts>',
        notesSection: '',
        goalsSection: '',
      };

      const filledData = {
        thoughtsSection: '<thoughts>\n- Test\n</thoughts>',
        notesSection: '<notes>\n- Test\n</notes>',
        goalsSection: '<goals>\n- Test\n</goals>',
      };

      const emptyResult = service.processTemplate(
        templateWithEmptySections,
        emptyData
      );
      const filledResult = service.processTemplate(
        templateWithEmptySections,
        filledData
      );

      // Empty result should still include the thoughts wrapper while omitting others
      expect(emptyResult).toContain('<thoughts>');
      expect(emptyResult).not.toContain('<notes>');
      expect(emptyResult).not.toContain('<goals>');

      // Filled result should contain all the XML structure
      expect(filledResult).toContain('<thoughts>');
      expect(filledResult).toContain('<notes>');
      expect(filledResult).toContain('<goals>');

      // Token counting approximation: empty should still be significantly shorter
      expect(filledResult.length).toBeGreaterThan(emptyResult.length + 50);
    });
  });

  describe('backwards compatibility', () => {
    test('still processes old content-based placeholders correctly', () => {
      const oldStyleTemplate = `<thoughts>
{thoughtsContent}
</thoughts>

<notes>
{notesContent}
</notes>`;

      const data = {
        thoughtsContent: '- Old style thought',
        notesContent: '- Old style note',
      };

      const result = service.processTemplate(oldStyleTemplate, data);

      // Should work with old-style content placeholders
      expect(result).toContain('<thoughts>\n- Old style thought\n</thoughts>');
      expect(result).toContain('<notes>\n- Old style note\n</notes>');
    });

    test('handles mix of old and new placeholder styles', () => {
      const mixedTemplate = `<thoughts>
{thoughtsContent}
</thoughts>

{notesSection}`;

      const data = {
        thoughtsContent: '- Old style thought',
        notesSection: '<notes>\n- New style note\n</notes>',
      };

      const result = service.processTemplate(mixedTemplate, data);

      expect(result).toContain('<thoughts>\n- Old style thought\n</thoughts>');
      expect(result).toContain('<notes>\n- New style note\n</notes>');
    });
  });
});

describe('PromptTemplateService - Error Handling and Edge Cases', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service = new PromptTemplateService({ logger: mockLogger });
  });

  describe('processTemplate error handling', () => {
    test('handles invalid template - null', () => {
      const result = service.processTemplate(null, { key: 'value' });

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptTemplateService.processTemplate: Invalid template provided'
      );
    });

    test('handles invalid template - undefined', () => {
      const result = service.processTemplate(undefined, { key: 'value' });

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptTemplateService.processTemplate: Invalid template provided'
      );
    });

    test('handles invalid template - empty string', () => {
      const result = service.processTemplate('', { key: 'value' });

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptTemplateService.processTemplate: Invalid template provided'
      );
    });

    test('handles invalid template - non-string', () => {
      const result = service.processTemplate(123, { key: 'value' });

      expect(result).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptTemplateService.processTemplate: Invalid template provided'
      );
    });

    test('handles invalid data - null', () => {
      const template = 'Hello {name}';
      const result = service.processTemplate(template, null);

      expect(result).toBe(template);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptTemplateService.processTemplate: Invalid data object provided'
      );
    });

    test('handles invalid data - undefined', () => {
      const template = 'Hello {name}';
      const result = service.processTemplate(template, undefined);

      expect(result).toBe(template);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptTemplateService.processTemplate: Invalid data object provided'
      );
    });

    test('handles invalid data - non-object', () => {
      const template = 'Hello {name}';
      const result = service.processTemplate(template, 'not an object');

      expect(result).toBe(template);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'PromptTemplateService.processTemplate: Invalid data object provided'
      );
    });
  });

  describe('placeholder value handling', () => {
    test('handles null values in data', () => {
      const template = 'Hello {name}, you are {age} years old';
      const data = { name: 'John', age: null };

      const result = service.processTemplate(template, data);

      expect(result).toBe('Hello John, you are  years old');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "PromptTemplateService: Placeholder 'age' is null/undefined, using empty string"
      );
    });

    test('handles undefined values in data', () => {
      const template = 'Hello {name}, you live in {city}';
      const data = { name: 'John', city: undefined };

      const result = service.processTemplate(template, data);

      expect(result).toBe('Hello John, you live in ');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "PromptTemplateService: Placeholder 'city' is null/undefined, using empty string"
      );
    });

    test('handles missing placeholders and logs warning', () => {
      const template =
        'Hello {name}, you are {age} years old and live in {city}';
      const data = { name: 'John' }; // missing age and city

      const result = service.processTemplate(template, data);

      expect(result).toBe(
        'Hello John, you are {age} years old and live in {city}'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PromptTemplateService: Missing data for placeholders: age, city'
      );
    });

    test('handles mix of found, missing, and null placeholders', () => {
      const template = 'Name: {name}, Age: {age}, City: {city}, Job: {job}';
      const data = {
        name: 'John', // found
        age: null, // null -> empty string
        // city missing    // missing -> keep placeholder
        job: undefined, // undefined -> empty string
      };

      const result = service.processTemplate(template, data);

      expect(result).toBe('Name: John, Age: , City: {city}, Job: ');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "PromptTemplateService: Placeholder 'age' is null/undefined, using empty string"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "PromptTemplateService: Placeholder 'job' is null/undefined, using empty string"
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PromptTemplateService: Missing data for placeholders: city'
      );
    });
  });

  describe('getCharacterTemplate', () => {
    test('returns character template', () => {
      const template = service.getCharacterTemplate();

      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });
  });

  describe('processCharacterPrompt', () => {
    test('processes character prompt with valid data', () => {
      const promptData = {
        taskDefinitionContent: 'Test task',
        characterPersonaContent: 'Test persona',
        assistantResponsePrefix: '\n',
      };

      const result = service.processCharacterPrompt(promptData);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PromptTemplateService: Processing character prompt template'
      );
    });

    test('processes character prompt with empty data', () => {
      const result = service.processCharacterPrompt({});

      expect(typeof result).toBe('string');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PromptTemplateService: Processing character prompt template'
      );
    });
  });

  describe('placeholder regex edge cases', () => {
    test('handles template with no placeholders', () => {
      const template = 'This is a plain text template with no variables';
      const data = { unused: 'value' };

      const result = service.processTemplate(template, data);

      expect(result).toBe(template);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PromptTemplateService: Found 0 placeholders to process'
      );
    });

    test('handles non-string values by converting to string', () => {
      const template = 'Count: {count}, Active: {active}, Rating: {rating}';
      const data = {
        count: 42,
        active: true,
        rating: 4.5,
      };

      const result = service.processTemplate(template, data);

      expect(result).toBe('Count: 42, Active: true, Rating: 4.5');
    });

    test('handles objects by converting to string', () => {
      const template = 'User: {user}';
      const data = {
        user: { name: 'John', age: 30 },
      };

      const result = service.processTemplate(template, data);

      expect(result).toBe('User: [object Object]');
    });
  });
});
