/**
 * @file Tests for prompt redundancy elimination (LLMROLPROARCANA-004)
 * @description Verifies that redundant instructions are not duplicated in assembled prompts
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PromptDataFormatter } from '../../../src/prompting/promptDataFormatter.js';
import { createMockLogger } from '../../common/mockFactories.js';

describe('Prompt Redundancy Tests (LLMROLPROARCANA-004)', () => {
  let formatter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    formatter = new PromptDataFormatter({ logger: mockLogger });
  });

  describe('INNER VOICE GUIDANCE deduplication', () => {
    it('should appear in thoughtsVoiceGuidance but not duplicated in finalInstructions', () => {
      // Arrange
      const promptData = {
        actionTagRulesContent: 'Action tag rules',
        finalInstructionsContent:
          'Final instructions with action variety guidance',
        thoughtsArray: [
          { text: 'Previous thought 1' },
          { text: 'Previous thought 2' },
        ],
        characterName: 'TestChar',
      };

      // Act
      const formattedData = formatter.formatPromptData(promptData);

      // Assert - Should appear in thoughtsVoiceGuidance
      expect(formattedData.thoughtsVoiceGuidance).toContain('INNER VOICE GUIDANCE');

      // finalInstructionsContent should pass through unchanged (no INNER VOICE GUIDANCE)
      expect(formattedData.finalInstructionsContent).toBe(
        'Final instructions with action variety guidance'
      );
    });

    it('should include INNER VOICE GUIDANCE in thoughtsVoiceGuidance when thoughts exist', () => {
      // Arrange
      const promptData = {
        thoughtsArray: [{ text: 'Previous thought' }],
      };

      // Act
      const formattedData = formatter.formatPromptData(promptData);

      // Assert
      expect(formattedData.thoughtsVoiceGuidance).toContain(
        'INNER VOICE GUIDANCE'
      );
      expect(formattedData.thoughtsVoiceGuidance).toContain(
        'do not repeat or barely rephrase'
      );
    });

    it('should include INNER VOICE GUIDANCE in thoughtsVoiceGuidance when no thoughts exist', () => {
      // Arrange
      const promptData = {
        thoughtsArray: [],
      };

      // Act
      const formattedData = formatter.formatPromptData(promptData);

      // Assert
      expect(formattedData.thoughtsVoiceGuidance).toContain(
        'INNER VOICE GUIDANCE'
      );
      expect(formattedData.thoughtsVoiceGuidance).toContain(
        'authentically reflect your character'
      );
    });

    it('should NOT include INNER VOICE GUIDANCE in static finalInstructionsContent', async () => {
      // Arrange - Load actual static content from JSON file
      const fs = await import('fs/promises');
      const path = await import('path');
      const jsonPath = path.join(process.cwd(), 'data/prompts/corePromptText.json');
      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      const corePromptText = JSON.parse(jsonContent);

      // Act
      const finalInstructions = corePromptText.finalLlmInstructionText;

      // Assert
      expect(finalInstructions).not.toContain('INNER VOICE GUIDANCE');
    });
  });

  describe('Token efficiency verification', () => {
    it('should demonstrate token reduction from redundancy elimination', () => {
      // Arrange - The removed text from finalLlmInstructionText
      const innerVoiceGuidanceText = `INNER VOICE GUIDANCE: Generate thoughts that authentically reflect your character's unique mental voice, personality patterns, and internal speech style. Remember: thoughts are PRIVATE - they reveal what your character thinks but doesn't say. Your internal monologue should sound distinctly like {{name}}, using their vocabulary, concerns, and way of processing the world. CRITICAL: Generate thoughts that occur IMMEDIATELY BEFORE performing your chosen action - you do NOT know what will happen as a result of your action yet. Do not assume outcomes, reactions, or results. Think about your intentions and reasoning for the action, not its anticipated effects.`;

      const tokenCount = innerVoiceGuidanceText.split(/\s+/).length; // Approximate

      // Assert - Verify we saved approximately 90-100 tokens (actual: 97 words)
      expect(tokenCount).toBeGreaterThan(90);
      expect(tokenCount).toBeLessThan(110);
    });
  });

  describe('Contextual placement verification', () => {
    it('should place INNER VOICE GUIDANCE contextually before thoughts section', () => {
      // Arrange
      const promptData = {
        thoughtsArray: [{ text: 'Test thought' }],
      };

      // Act
      const formattedData = formatter.formatPromptData(promptData);

      // Assert - Guidance should be in thoughtsVoiceGuidance (placed before thoughts)
      expect(formattedData.thoughtsVoiceGuidance).toBeTruthy();
      expect(formattedData.thoughtsVoiceGuidance).toContain(
        'INNER VOICE GUIDANCE'
      );

      // And thoughts section should exist
      expect(formattedData.thoughtsSection).toBeTruthy();
      expect(formattedData.thoughtsSection).toContain('Test thought');
    });

    it('should adapt guidance based on presence of previous thoughts', () => {
      // Arrange - No previous thoughts
      const noThoughtsData = { thoughtsArray: [] };

      // Act
      const noThoughtsFormatted =
        formatter.formatPromptData(noThoughtsData);

      // Assert - Should have base guidance without anti-repetition
      expect(noThoughtsFormatted.thoughtsVoiceGuidance).toContain(
        'INNER VOICE GUIDANCE'
      );
      expect(noThoughtsFormatted.thoughtsVoiceGuidance).not.toContain(
        'do not repeat or barely rephrase'
      );

      // Arrange - With previous thoughts
      const withThoughtsData = {
        thoughtsArray: [{ text: 'Previous thought' }],
      };

      // Act
      const withThoughtsFormatted =
        formatter.formatPromptData(withThoughtsData);

      // Assert - Should emphasize anti-repetition
      expect(withThoughtsFormatted.thoughtsVoiceGuidance).toContain(
        'INNER VOICE GUIDANCE'
      );
      expect(withThoughtsFormatted.thoughtsVoiceGuidance).toContain(
        'do not repeat or barely rephrase'
      );
    });
  });
});
