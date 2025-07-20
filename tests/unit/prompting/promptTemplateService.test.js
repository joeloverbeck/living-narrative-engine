/**
 * @file Tests for PromptTemplateService
 * @description Tests for template processing with conditional sections
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
    test('processes template with empty section placeholders correctly', () => {
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
        thoughtsSection: '', // Empty section - should not appear
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

      // Should contain the notes section
      expect(result).toContain('<notes>\n- Important note\n</notes>');

      // Should NOT contain empty thoughts or goals sections
      expect(result).not.toContain('<thoughts>');
      expect(result).not.toContain('<goals>');

      // Empty sections should result in just newlines where placeholders were
      expect(result).toMatch(/\n\n\n\n<notes>/); // thoughtsSection is empty, so 4 newlines before notes
      expect(result).toMatch(/<\/notes>\n\n\n\n<final_instructions>/); // goalsSection is empty, resulting in 4 newlines between notes and final
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

    test('processes template with all sections empty', () => {
      const template = `<start>
{thoughtsSection}

{notesSection}

{goalsSection}
<end>`;

      const data = {
        thoughtsSection: '',
        notesSection: '',
        goalsSection: '',
      };

      const result = service.processTemplate(template, data);

      // Should not contain any XML section tags
      expect(result).not.toContain('<thoughts>');
      expect(result).not.toContain('<notes>');
      expect(result).not.toContain('<goals>');

      // Should only contain the start and end markers with empty lines where sections would be
      expect(result).toContain('<start>');
      expect(result).toContain('<end>');

      // Verify the structure is clean without empty XML blocks
      const lines = result.split('\n');
      const nonEmptyLines = lines.filter((line) => line.trim() !== '');
      expect(nonEmptyLines).toEqual(['<start>', '<end>']);
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
        thoughtsSection: '', // Empty
        notesSection: '', // Empty
        goalsSection: '', // Empty
        availableActionsInfoContent: '',
        indexedChoicesContent: '',
        userInputContent: '',
        finalInstructionsContent: '',
        assistantResponsePrefix: '',
      };

      const result = service.processCharacterPrompt(promptData);

      // Should NOT contain any conditional section XML tags
      expect(result).not.toContain('<thoughts>');
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
        thoughtsSection: '',
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

      // Empty result should be much shorter (just newlines)
      expect(emptyResult.trim()).toBe('');

      // Filled result should contain all the XML structure
      expect(filledResult).toContain('<thoughts>');
      expect(filledResult).toContain('<notes>');
      expect(filledResult).toContain('<goals>');

      // Token counting approximation: empty should save ~18-24 tokens
      // (3 sections × 6-8 tokens each for XML tags + content)
      const tokenSavingsApprox = filledResult.length - emptyResult.length;
      expect(tokenSavingsApprox).toBeGreaterThan(50); // Significant savings
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
