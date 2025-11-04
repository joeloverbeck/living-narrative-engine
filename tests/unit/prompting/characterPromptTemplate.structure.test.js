import { describe, expect, it } from '@jest/globals';
import characterPromptTemplate, {
  CHARACTER_PROMPT_TEMPLATE,
} from '../../../src/prompting/templates/characterPromptTemplate.js';

const EXPECTED_SEGMENT_ORDER = [
  '<task_definition>',
  '{taskDefinitionContent}',
  '</task_definition>',
  '<character_persona>',
  '{characterPersonaContent}',
  '</character_persona>',
  '<portrayal_guidelines>',
  '{portrayalGuidelinesContent}',
  '</portrayal_guidelines>',
  '<world_context>',
  '{worldContextContent}',
  '</world_context>',
  '<perception_log>',
  '{perceptionLogContent}',
  '</perception_log>',
  '{thoughtsVoiceGuidance}',
  '{thoughtsSection}',
  '{notesVoiceGuidance}',
  '{notesSection}',
  '{goalsSection}',
  '<available_actions_info>',
  '{availableActionsInfoContent}',
  '</available_actions_info>',
  '<final_instructions>',
  '{finalInstructionsContent}',
  '</final_instructions>',
  '<content_policy>',
  '{contentPolicyContent}',
  '</content_policy>',
  '{assistantResponsePrefix}',
];

describe('characterPromptTemplate', () => {
  it('exports a single canonical template instance', () => {
    expect(characterPromptTemplate).toBe(CHARACTER_PROMPT_TEMPLATE);
    expect(typeof CHARACTER_PROMPT_TEMPLATE).toBe('string');
    expect(CHARACTER_PROMPT_TEMPLATE.startsWith('<task_definition>')).toBe(true);
  });

  it('lists sections in the documented order', () => {
    let lastIndex = -1;

    for (const segment of EXPECTED_SEGMENT_ORDER) {
      const currentIndex = CHARACTER_PROMPT_TEMPLATE.indexOf(segment);

      expect(currentIndex).toBeGreaterThan(-1);
      expect(currentIndex).toBeGreaterThan(lastIndex);

      lastIndex = currentIndex;
    }
  });

  it('provides guidance placeholders with surrounding blank lines for clarity', () => {
    const newlineSeparated = CHARACTER_PROMPT_TEMPLATE.split('\n');
    const guidanceIndex = newlineSeparated.indexOf('{thoughtsVoiceGuidance}');

    expect(guidanceIndex).toBeGreaterThan(0);
    expect(newlineSeparated[guidanceIndex - 1]).toBe('');
    expect(newlineSeparated[guidanceIndex + 1]).toBe('');

    const optionalSections = [
      '{thoughtsSection}',
      '{notesVoiceGuidance}',
      '{notesSection}',
      '{goalsSection}',
    ];

    for (const section of optionalSections) {
      const index = newlineSeparated.indexOf(section);

      expect(index).toBeGreaterThan(guidanceIndex);
      expect(newlineSeparated[index - 1]).toBe('');
      expect(newlineSeparated[index + 1]).toBe('');
    }
  });
});
