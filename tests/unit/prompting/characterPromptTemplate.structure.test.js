import { describe, expect, it } from '@jest/globals';
import characterPromptTemplate, {
  CHARACTER_PROMPT_TEMPLATE,
} from '../../../src/prompting/templates/characterPromptTemplate.js';

// Expected section order following constraint-first architecture (v2.0)
// Critical formatting rules appear first, before character/world context
const EXPECTED_SEGMENT_ORDER = [
  // PHASE 1: System Constraints (constraint-first)
  '<system_constraints>',
  '{finalInstructionsContent}',
  '</system_constraints>',
  '<content_policy>',
  '{contentPolicyContent}',
  '</content_policy>',
  
  // PHASE 2: Task Definition
  '<task_definition>',
  '{taskDefinitionContent}',
  '</task_definition>',
  
  // PHASE 3: Character Identity
  '<character_persona>',
  '{characterPersonaContent}',
  '</character_persona>',
  '<portrayal_guidelines>',
  '{portrayalGuidelinesContent}',
  '</portrayal_guidelines>',
  '{goalsSection}',
  
  // PHASE 4: World State
  '<world_context>',
  '{worldContextContent}',
  '</world_context>',
  '{perceptionLogVoiceGuidance}',
  '<perception_log>',
  '{perceptionLogContent}',
  '</perception_log>',
  '{thoughtsVoiceGuidance}',
  '{thoughtsSection}',
  '{notesVoiceGuidance}',
  '{notesSection}',
  
  // PHASE 5: Execution Context
  '<available_actions_info>',
  '{availableActionsInfoContent}',
  '</available_actions_info>',
  '{assistantResponsePrefix}',
];

describe('characterPromptTemplate', () => {
  it('exports a single canonical template instance', () => {
    expect(characterPromptTemplate).toBe(CHARACTER_PROMPT_TEMPLATE);
    expect(typeof CHARACTER_PROMPT_TEMPLATE).toBe('string');
    expect(CHARACTER_PROMPT_TEMPLATE.startsWith('<system_constraints>')).toBe(true);
  });

  it('lists sections in the documented constraint-first order (v2.0)', () => {
    let lastIndex = -1;

    for (const segment of EXPECTED_SEGMENT_ORDER) {
      const currentIndex = CHARACTER_PROMPT_TEMPLATE.indexOf(segment);

      expect(currentIndex).toBeGreaterThan(-1);
      expect(currentIndex).toBeGreaterThan(lastIndex);

      lastIndex = currentIndex;
    }
  });

  it('places system constraints before character context', () => {
    const constraintsIndex = CHARACTER_PROMPT_TEMPLATE.indexOf('<system_constraints>');
    const personaIndex = CHARACTER_PROMPT_TEMPLATE.indexOf('<character_persona>');
    
    expect(constraintsIndex).toBeGreaterThan(-1);
    expect(personaIndex).toBeGreaterThan(-1);
    expect(constraintsIndex).toBeLessThan(personaIndex);
  });

  it('provides guidance placeholders with surrounding blank lines for clarity', () => {
    const newlineSeparated = CHARACTER_PROMPT_TEMPLATE.split('\n');
    
    // Test all guidance placeholders have blank line separation
    const guidancePlaceholders = [
      '{perceptionLogVoiceGuidance}',
      '{thoughtsVoiceGuidance}',
      '{notesVoiceGuidance}',
    ];

    for (const placeholder of guidancePlaceholders) {
      const index = newlineSeparated.indexOf(placeholder);
      
      expect(index).toBeGreaterThan(0);
      expect(newlineSeparated[index - 1]).toBe('');
      expect(newlineSeparated[index + 1]).toBe('');
    }

    // Test optional section placeholders have blank line separation
    const optionalSections = [
      '{thoughtsSection}',
      '{notesSection}',
      '{goalsSection}',
    ];

    for (const section of optionalSections) {
      const index = newlineSeparated.indexOf(section);

      expect(index).toBeGreaterThan(0);
      expect(newlineSeparated[index - 1]).toBe('');
      expect(newlineSeparated[index + 1]).toBe('');
    }
  });
});
