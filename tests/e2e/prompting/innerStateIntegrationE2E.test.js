/**
 * @file End-to-end test for inner state integration content in prompt pipeline
 * This test suite verifies that the new inner_state_integration section
 * appears correctly in fully generated prompts through the complete pipeline.
 * @see specs/inner-state-integration-prompt-enhancement.md
 * @see tickets/INNSTAINTPROENH-004-e2e-tests-full-pipeline.md
 */

import {
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  test,
  expect,
} from '@jest/globals';
import { PromptGenerationTestBed } from './common/promptGenerationTestBed.js';

describe('Inner State Integration E2E', () => {
  let testBed;
  let testActors;

  beforeAll(async () => {
    testBed = new PromptGenerationTestBed();
    await testBed.initialize();
    await testBed.createTestWorld();
    testActors = await testBed.createTestActors();
    await testBed.registerTestActions();
  });

  beforeEach(() => {
    testBed.resetTestState();
  });

  afterAll(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  describe('Full Prompt Generation with Inner State Integration', () => {
    test('should include inner_state_integration XML wrapper in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - XML wrapper present
      expect(prompt).toContain('<inner_state_integration>');
      expect(prompt).toContain('</inner_state_integration>');
    }, 5000);

    test('should include INNER STATE INTEGRATION header in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - New header present
      expect(prompt).toContain(
        'INNER STATE INTEGRATION (HARD CONSTRAINT — NOT FLAVOR)'
      );

      // Assert - Old header NOT present
      expect(prompt).not.toContain('INNER STATE EXPRESSION (CRITICAL)');
    }, 5000);

    test('should include STATE INTEGRATION PROTOCOL in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - Protocol section present with key instructions
      expect(prompt).toContain('STATE INTEGRATION PROTOCOL');
      expect(prompt).toContain('Primary: strongest intensity emotion');
      expect(prompt).toContain('Secondary: second-strongest');
      expect(prompt).toContain('Modifier: one additional listed emotion');
    }, 5000);

    test('should include PER-FIELD STATE SIGNAL MINIMUMS in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - Per-field minimums present
      expect(prompt).toContain('PER-FIELD STATE SIGNAL MINIMUMS');
      expect(prompt).toContain(
        'thoughts: MUST clearly reflect Primary + Secondary'
      );
      expect(prompt).toContain('action: MUST be plausible under Primary emotion');
      expect(prompt).toContain(
        'speech: If non-empty, it MUST be colored by Primary/Secondary'
      );
    }, 5000);

    test('should include new simplified THOUGHTS COLORING in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - New simplified thoughts coloring present
      expect(prompt).toContain('THOUGHTS COLORING:');
      expect(prompt).toContain(
        'The thought MUST visibly carry the Primary/Secondary inner_state drivers (through persona), not just planning.'
      );

      // Assert - Old thoughts coloring examples NOT present
      expect(prompt).not.toContain(
        'Your internal monologue must REFLECT the listed emotions'
      );
      expect(prompt).not.toContain(
        'If feeling "fear: strong", thoughts should show anxiety'
      );
    }, 5000);

    test('should NOT include old SPEECH COLORING section in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - Old speech coloring content NOT present
      expect(prompt).not.toContain('Match emotional intensity to speech patterns:');
      expect(prompt).not.toContain(
        'High arousal emotions (anger, excitement, fear): Urgent, clipped, energetic speech'
      );
      expect(prompt).not.toContain(
        'Low arousal emotions (sadness, melancholy): Slower, quieter, more hesitant speech'
      );
    }, 5000);

    test('should include SEXUAL STATE RULE in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - Sexual state rule present
      expect(prompt).toContain(
        'SEXUAL STATE RULE (applies even if no sexual content is present):'
      );
      expect(prompt).toContain(
        'High repulsion/inhibition should suppress flirtation/intimacy'
      );
    }, 5000);

    test('should include CONFLICT RULE in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - Conflict rule present
      expect(prompt).toContain('CONFLICT RULE (persona vs state):');
      expect(prompt).toContain(
        'show that as deflection (brittle humor, contempt, procedural thinking, silence, refusal)'
      );
    }, 5000);

    test('should include fail condition statement in generated prompt', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - Fail condition present
      expect(prompt).toContain(
        'Fail condition: any turn where thoughts/action/speech could be swapped to a different inner_state with minimal edits'
      );
    }, 5000);
  });

  describe('Prompt Section Ordering E2E', () => {
    test('should place inner_state_integration content within system_constraints section', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - inner_state_integration content is within system_constraints
      const systemConstraintsStart = prompt.indexOf('<system_constraints>');
      const systemConstraintsEnd = prompt.indexOf('</system_constraints>');
      const innerStateStart = prompt.indexOf('<inner_state_integration>');
      const innerStateEnd = prompt.indexOf('</inner_state_integration>');

      expect(systemConstraintsStart).toBeGreaterThan(-1);
      expect(innerStateStart).toBeGreaterThan(systemConstraintsStart);
      expect(innerStateEnd).toBeLessThan(systemConstraintsEnd);
    }, 5000);

    test('should maintain proper section order: inner_state_integration before ACTION SELECTION', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - Ordering is correct
      const innerStatePos = prompt.indexOf('</inner_state_integration>');
      const actionSelectionPos = prompt.indexOf('ACTION SELECTION:');

      expect(innerStatePos).toBeGreaterThan(-1);
      expect(actionSelectionPos).toBeGreaterThan(-1);
      expect(innerStatePos).toBeLessThan(actionSelectionPos);
    }, 5000);

    test('should maintain proper section order: SPEECH CONTENT RULE after inner_state_integration', async () => {
      // Arrange
      const aiActor = testActors.aiActor;
      const turnContext = testBed.createTestTurnContext();
      const availableActions = testBed.createTestActionComposites();

      // Act
      const prompt = await testBed.generatePrompt(
        aiActor.id,
        turnContext,
        availableActions
      );

      // Assert - SPEECH CONTENT RULE appears after inner_state_integration close tag
      const innerStateEndPos = prompt.indexOf('</inner_state_integration>');
      const speechRulePos = prompt.indexOf('SPEECH CONTENT RULE (CRITICAL):');

      expect(innerStateEndPos).toBeGreaterThan(-1);
      expect(speechRulePos).toBeGreaterThan(-1);
      expect(innerStateEndPos).toBeLessThan(speechRulePos);
    }, 5000);
  });
});

describe('Backward Compatibility E2E', () => {
  let testBed;
  let testActors;

  beforeAll(async () => {
    testBed = new PromptGenerationTestBed();
    await testBed.initialize();
    await testBed.createTestWorld();
    testActors = await testBed.createTestActors();
    await testBed.registerTestActions();
  });

  beforeEach(() => {
    testBed.resetTestState();
  });

  afterAll(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  test('should maintain CRITICAL DISTINCTION section in generated prompt', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Critical distinction unchanged
    expect(prompt).toContain('CRITICAL DISTINCTION - THOUGHTS vs SPEECH:');
    expect(prompt).toContain(
      "MANDATORY RULE: The 'thoughts' and 'speech' fields MUST contain meaningfully different content"
    );
  }, 5000);

  test('should maintain NOTES RULES section in generated prompt', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Notes rules unchanged
    expect(prompt).toContain('NOTES RULES');
    expect(prompt).toContain('Only record brand-new, critical facts');
  }, 5000);

  test('should maintain NOTE SUBJECT TYPES section in generated prompt', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Note subject types unchanged
    expect(prompt).toContain('NOTE SUBJECT TYPES (Select ONE per note):');
    expect(prompt).toContain('1. entity');
    expect(prompt).toContain('2. event');
    expect(prompt).toContain('3. plan');
    expect(prompt).toContain('4. knowledge');
    expect(prompt).toContain('5. state');
    expect(prompt).toContain('6. other');
  }, 5000);

  test('should maintain ACTION SELECTION section in generated prompt', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Action selection unchanged
    expect(prompt).toContain('ACTION SELECTION:');
    expect(prompt).toContain(
      'Let emotions guide which action "feels right" in character'
    );
  }, 5000);

  test('should maintain INTENSITY SCALING section in generated prompt', async () => {
    // Arrange
    const aiActor = testActors.aiActor;
    const turnContext = testBed.createTestTurnContext();
    const availableActions = testBed.createTestActionComposites();

    // Act
    const prompt = await testBed.generatePrompt(
      aiActor.id,
      turnContext,
      availableActions
    );

    // Assert - Intensity scaling unchanged
    expect(prompt).toContain(
      'INTENSITY SCALING (use emotional intensity labels as guides):'
    );
    expect(prompt).toContain('"faint/slight"');
    expect(prompt).toContain('"intense/powerful/overwhelming"');
  }, 5000);
});
