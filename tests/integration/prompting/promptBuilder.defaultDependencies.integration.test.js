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

    expect(prompt).toContain('<task_definition>\nIntegrate the core prompt pipeline.\n</task_definition>');
    expect(prompt).toContain('<character_persona>\nAn AI assistant focused on precision.\n</character_persona>');
    expect(prompt).toContain('<portrayal_guidelines>\nStay factual and structured.\n</portrayal_guidelines>');
    expect(prompt).toContain('<world_context>\nOperating within a simulated world.\n</world_context>');
    expect(prompt).toContain('<available_actions_info>\nRespond with detailed explanations.\n</available_actions_info>');
    expect(prompt).toContain('<system_constraints>\nSummarise the reasoning before the answer.\n</system_constraints>');

    expect(prompt).toContain(
      '<perception_log>\nConsole displays system boot sequence.\nCooling fans ramp to operational speed.\n</perception_log>'
    );
    expect(prompt).toContain(
      '<thoughts>\nRecent thoughts (avoid repeating or barely rephrasing these):\n- Maintain deterministic processing.\n\n-----\nGenerate a fresh, unique thought that builds upon your mental state. Your thought should reflect what you\'re thinking RIGHT BEFORE taking your chosen action - focus on your intentions, motivations, or reasoning, NOT on anticipated outcomes or results.\n</thoughts>'
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
