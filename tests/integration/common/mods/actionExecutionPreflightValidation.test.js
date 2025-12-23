import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';

describe('Action Execution Validation Integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Use stand_up action which requires kneeling_before component
    // Note: Actual action requirements verified against data/mods/positioning/actions/
    testFixture = await ModTestFixture.forAction(
      'deference',
      'deference:stand_up',
      null,
      null
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should catch missing required component before execution', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      // Missing deference-states:kneeling_before component (required by stand_up)
      .build();

    testFixture.reset([room, actor]);

    // First check: should throw ActionValidationError
    await expect(async () => {
      await testFixture.executeAction('actor1', null);
    }).rejects.toThrow(ActionValidationError);

    // Second check: validate error message content
    let errorMessage = '';
    try {
      await testFixture.executeAction('actor1', null);
    } catch (err) {
      errorMessage = err.message;
    }

    expect(errorMessage).toContain('missing required component');
    expect(errorMessage).toContain('deference-states:kneeling_before');
    expect(errorMessage).toContain('💡 Suggestion');
  });

  it('should allow execution if validation passes', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
    const target = new ModEntityBuilder('target1')
      .withName('Bob')
      .atLocation('room1')
      .asActor()
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('deference-states:kneeling_before', {
        target_id: 'target1',
      })
      .build();

    testFixture.reset([room, target, actor]);

    // Should not throw - all validation passes
    await expect(
      testFixture.executeAction('actor1', null)
    ).resolves.not.toThrow();
  });

  it('should provide clear error when entity does not exist', async () => {
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    testFixture.reset([room]);

    // Validate it throws ActionValidationError
    await expect(async () => {
      await testFixture.executeAction('nonexistent_actor', null);
    }).rejects.toThrow(ActionValidationError);

    // Validate error message content
    let caughtError = null;
    try {
      await testFixture.executeAction('nonexistent_actor', null);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ActionValidationError);
    expect(caughtError.message).toContain('does not exist');
    expect(caughtError.message).toContain('nonexistent_actor');
    expect(caughtError.message).toContain('CRITICAL ERRORS');
  });

  it('should allow skipping validation if needed', async () => {
    // In some advanced test scenarios, may want to skip validation
    const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

    testFixture.reset([room]);

    // When validation is skipped, the old defensive checks still run
    // and return a result object with blocked: true instead of throwing
    const result = await testFixture.executeAction('nonexistent_actor', null, {
      skipValidation: true,
    });

    expect(result).toMatchObject({
      blocked: true,
      reason: expect.stringContaining('does not exist'),
    });
  });
});
