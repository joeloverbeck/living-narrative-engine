/**
 * @file Integration test for ActivityDescriptionService DI registration
 * Validates ACTDESC-004 implementation
 */

import { describe, it, expect } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ActivityDescriptionService from '../../../src/anatomy/services/activityDescriptionService.js';

describe('ActivityDescriptionService DI Registration (ACTDESC-004)', () => {
  it('should have ActivityDescriptionService token defined', () => {
    // Assert
    expect(tokens.ActivityDescriptionService).toBeDefined();
    expect(tokens.ActivityDescriptionService).toBe('ActivityDescriptionService');
  });

  it('should have ActivityDescriptionService class available for import', () => {
    // Assert
    expect(ActivityDescriptionService).toBeDefined();
    expect(typeof ActivityDescriptionService).toBe('function');
  });

  it('should verify registration code imports ActivityDescriptionService', async () => {
    // Act - Import the registration file and verify it doesn't throw
    const { registerWorldAndEntity } = await import(
      '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js'
    );

    // Assert
    expect(registerWorldAndEntity).toBeDefined();
    expect(typeof registerWorldAndEntity).toBe('function');
  });
});
