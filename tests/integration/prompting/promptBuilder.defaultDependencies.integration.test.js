/* eslint-env node */
/* eslint jest/expect-expect: ["error", { "assertFunctionNames": ["expect"] }] */

import { describe, test, expect, jest } from '@jest/globals';
import { PromptBuilder } from '../../../src/prompting/promptBuilder.js';

const LLM_ID = 'integration-llm';

const MINIMAL_LLM_CONFIG = {
  configId: 'integration-config',
  displayName: 'Integration Test LLM',
  modelIdentifier: 'integration-model',
  endpointUrl: 'https://integration.llm',
  apiType: 'integration',
  jsonOutputStrategy: { method: 'integration' },
};

const SAMPLE_PROMPT_DATA = {
  actionTagRulesContent: '',
  taskDefinitionContent: 'Integrate the core prompt pipeline.',
  characterPersonaContent: 'An AI assistant focused on precision.',
  portrayalGuidelinesContent: 'Stay factual and structured.',
  contentPolicyContent: 'No disallowed content.',
  worldContextContent: 'Operating within a simulated world.',
  availableActionsInfoContent: 'Respond with detailed explanations.',
  finalInstructionsContent: 'Summarise the reasoning before the answer.',
  assistantResponsePrefix: '\n',
  characterName: 'Integration Agent',
  perceptionLogArray: [
    { type: 'visual', content: 'Console displays system boot sequence.' },
    { type: 'audio', content: 'Cooling fans ramp to operational speed.' },
  ],
  thoughtsArray: [
    { text: 'Maintain deterministic processing.', timestamp: '2024-05-01T00:00:00Z' },
  ],
  notesArray: [
    { text: 'Primary objective: clarify architecture.', timestamp: '2024-05-01T00:00:00Z' },
  ],
  goalsArray: [
    { text: 'Deliver concise implementation guidance.', timestamp: '2024-05-01T00:00:00Z' },
  ],
};

const THOUGHTS_GUIDANCE_TEXT = `INNER VOICE GUIDANCE: Generate thoughts in your character's authentic mental voice (their habits of mind, personality patterns, and inner speech style). Build on your current mental state with a fresh thought that does not repeat or barely rephrase the "Recent thoughts" above.\n\nTIMING: The thought must occur in the instant IMMEDIATELY BEFORE you perform your chosen action.\n\nANTICIPATION (ALLOWED): You may anticipate likely outcomes, risks, fears, hopes, and contingencies as possibilities (this is normal human/character planning).\n\nEPISTEMIC RULE (CRITICAL): You do NOT yet know the result of your action. Do not describe outcomes, reactions, success/failure, or consequences as facts or as already happened.\n\nSTYLE RULE: Use intent- and possibility-language ("I'm going to...", "I want to...", "maybe...", "might...", "if...", "hopefully..."). Avoid past-tense or certainty about effects ("That hurt them." "They fall." "It worked.").`;

const buildThoughtsSection = (content = '') => {
  const list = content ? `${content}\n\n` : '\n';
  return `<thoughts>\nRecent thoughts (avoid repeating or barely rephrasing these):\n${list}-----\n${THOUGHTS_GUIDANCE_TEXT}\n</thoughts>`;
};

describe('PromptBuilder default dependency integration', () => {
  test('falls back to concrete template and formatter implementations', async () => {
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    const llmConfigService = {
      loadConfiguration: jest.fn(async (id) =>
        id === LLM_ID ? MINIMAL_LLM_CONFIG : null
      ),
    };

    const builder = new PromptBuilder({ logger, llmConfigService });

    const prompt = await builder.build(LLM_ID, SAMPLE_PROMPT_DATA);

    expect(llmConfigService.loadConfiguration).toHaveBeenCalledWith(LLM_ID);

    // Check sections with processing hints where applicable
    expect(prompt).toContain('<task_definition>');
    expect(prompt).toContain('<!-- *** CRITICAL: Your core task - all output stems from this -->');
    expect(prompt).toContain('Integrate the core prompt pipeline.');
    expect(prompt).toContain('</task_definition>');
    expect(prompt).toContain('<character_persona>\nAn AI assistant focused on precision.\n</character_persona>');
    expect(prompt).toContain('<portrayal_guidelines>\nStay factual and structured.\n</portrayal_guidelines>');
    expect(prompt).toContain('<world_context>');
    expect(prompt).toContain('<!-- REFERENCE: Environmental context for decision-making -->');
    expect(prompt).toContain('Operating within a simulated world.');
    expect(prompt).toContain('</world_context>');
    expect(prompt).toContain('<available_actions_info>');
    expect(prompt).toContain('<!-- REFERENCE: Choose based on character state, goals, and recent events -->');
    expect(prompt).toContain('Respond with detailed explanations.');
    expect(prompt).toContain('</available_actions_info>');
    // System constraints now includes action tag rules (empty) and final instructions
    expect(prompt).toContain('<system_constraints>');
    expect(prompt).toContain('Summarise the reasoning before the answer.');
    expect(prompt).toContain('</system_constraints>');

    expect(prompt).toContain(
      '<perception_log>\nConsole displays system boot sequence.\nCooling fans ramp to operational speed.\n</perception_log>'
    );
    expect(prompt).toContain(
      buildThoughtsSection('- Maintain deterministic processing.')
    );
    expect(prompt).toContain(
      "NOTES WRITING GUIDANCE: The notes must be concise, but written in Integration Agent's own voice. Focus each note on critical facts while preserving Integration Agent's perspective. Avoid generic or neutral phrasing. Keep any new notes distinct from the existing entries listed below."
    );
    expect(prompt).toContain(
      '<notes>\n## Other\n### General\n- Primary objective: clarify architecture.\n</notes>'
    );
    expect(prompt).toContain('<goals>\n- Deliver concise implementation guidance.\n</goals>');

    expect(prompt).toEndWith('\n');

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('PromptBuilder (template-based) initialised')
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('defaults to console logging when custom logger is omitted', async () => {
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const llmConfigService = {
      loadConfiguration: jest.fn(async () => MINIMAL_LLM_CONFIG),
    };

    try {
      const builder = new PromptBuilder({ llmConfigService });

      const prompt = await builder.build(LLM_ID, SAMPLE_PROMPT_DATA);

      expect(prompt).toContain('Integrate the core prompt pipeline.');
      expect(llmConfigService.loadConfiguration).toHaveBeenCalledWith(LLM_ID);
      expect(debugSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      debugSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });
});
