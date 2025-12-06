import { describe, it, expect } from '@jest/globals';
import {
  PROMPT_VERSION_INFO,
  TRAITS_REWRITER_LLM_PARAMS,
  TRAITS_REWRITER_RESPONSE_SCHEMA,
  DEFAULT_TRAIT_KEYS,
  createTraitsRewriterPrompt,
  createFocusedTraitPrompt,
} from '../../../../src/characterBuilder/prompts/traitsRewriterPrompts.js';

/**
 * @file Unit tests for traitsRewriterPrompts utilities.
 */

describe('traitsRewriterPrompts', () => {
  describe('PROMPT_VERSION_INFO', () => {
    it('exposes semantic version metadata for prompt maintenance', () => {
      expect(PROMPT_VERSION_INFO.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(Array.isArray(PROMPT_VERSION_INFO.currentChanges)).toBe(true);
      expect(PROMPT_VERSION_INFO.currentChanges).not.toHaveLength(0);
    });
  });

  describe('TRAITS_REWRITER_LLM_PARAMS', () => {
    it('provides stable defaults for LLM invocation', () => {
      expect(TRAITS_REWRITER_LLM_PARAMS).toMatchObject({
        temperature: expect.any(Number),
        max_tokens: expect.any(Number),
      });
      expect(TRAITS_REWRITER_LLM_PARAMS.temperature).toBeGreaterThan(0);
      expect(TRAITS_REWRITER_LLM_PARAMS.max_tokens).toBeGreaterThan(0);
    });
  });

  describe('createTraitsRewriterPrompt', () => {
    it('embeds the serialized character definition and instruction blocks', () => {
      const characterData = {
        'core:name': { text: 'Ari' },
        traits: { 'core:likes': 'Sunrises' },
        speechPatterns: [
          { pattern: 'Gentle', example: 'I appreciate the calm dawn.' },
        ],
      };

      const prompt = createTraitsRewriterPrompt(characterData, {
        arbitrary: true,
      });

      const serialized = JSON.stringify(characterData, null, 2);
      expect(prompt).toContain('<role>');
      expect(prompt).toContain('<task_definition>');
      expect(prompt).toContain('<instructions>');
      expect(prompt).toContain('<output_format>');
      expect(prompt).toContain('<content_policy>');
      expect(prompt).toContain(serialized);
      expect(prompt).toContain('core:likes');
    });

    it('supports omitted options by applying default parameter values', () => {
      const characterData = {
        'core:name': { text: 'Nia' },
        traits: { 'core:notes': ['Prefers midnight brainstorming.'] },
      };

      const prompt = createTraitsRewriterPrompt(characterData);

      expect(prompt).toContain('Nia');
      expect(prompt).toContain('core:notes');
    });
  });

  describe('createFocusedTraitPrompt', () => {
    it('formats a focused rewrite prompt with speech patterns', () => {
      const prompt = createFocusedTraitPrompt(
        {
          'core:name': { text: 'Maris' },
          speechPatterns: [
            { pattern: 'Wry', example: 'Sure, that will definitely work.' },
            { pattern: 'Abrupt', example: 'Move.' },
          ],
        },
        'core:personality',
        'Always two steps ahead, occasionally sardonic.'
      );

      expect(prompt).toContain('Maris');
      expect(prompt).toContain('Transform this personality description');
      expect(prompt).toContain('- Wry: "Sure, that will definitely work."');
      expect(prompt).toContain('- Abrupt: "Move."');
      expect(prompt).toContain('Always two steps ahead');
      expect(prompt).toMatch(/Rewrite this in first person/i);
    });

    it('falls back to defaults when name and speech patterns are missing', () => {
      const prompt = createFocusedTraitPrompt(
        {},
        'core:motivations',
        'Wants to explore.'
      );

      expect(prompt).toContain('the character');
      expect(prompt).toContain('Transform this motivations description');
      expect(prompt).toContain('No specific speech patterns provided');
    });

    it('supports alternate name fields when core:name.text is absent', () => {
      const prompt = createFocusedTraitPrompt(
        {
          'core:name': { name: 'Zeph' },
          speechPatterns: [],
        },
        'core:profile',
        'Former pilot adjusting to civilian life.'
      );

      expect(prompt).toContain('Zeph');
      expect(prompt).toContain('profile description');
    });
  });

  describe('TRAITS_REWRITER_RESPONSE_SCHEMA', () => {
    it('declares the required schema structure for validation', () => {
      expect(TRAITS_REWRITER_RESPONSE_SCHEMA).toMatchObject({
        type: 'object',
        required: expect.arrayContaining(['characterName', 'rewrittenTraits']),
      });
      expect(
        TRAITS_REWRITER_RESPONSE_SCHEMA.properties['rewrittenTraits'].properties
      ).toHaveProperty('core:goals');
    });
  });

  describe('DEFAULT_TRAIT_KEYS', () => {
    it('lists all supported trait identifiers in processing order', () => {
      expect(DEFAULT_TRAIT_KEYS).toEqual([
        'core:likes',
        'core:dislikes',
        'core:fears',
        'core:goals',
        'core:notes',
        'core:personality',
        'core:profile',
        'core:secrets',
        'core:strengths',
        'core:weaknesses',
        'core:internal_tensions',
        'core:motivations',
        'core:dilemmas',
      ]);
    });
  });
});
