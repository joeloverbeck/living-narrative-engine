import { describe, expect, it } from '@jest/globals';

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('configureMinimalContainer', () => {
  it('registers the emotion calculator service for minimal containers', async () => {
    const container = new AppContainer();

    await configureMinimalContainer(container);

    expect(container.isRegistered(tokens.IEmotionCalculatorService)).toBe(true);
    const emotionCalculator = container.resolve(
      tokens.IEmotionCalculatorService
    );
    expect(emotionCalculator).toBeDefined();
    expect(typeof emotionCalculator.calculateEmotions).toBe('function');
  });
});
