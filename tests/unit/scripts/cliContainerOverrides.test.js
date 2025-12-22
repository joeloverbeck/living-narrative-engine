import { describe, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { overrideContainerToken } from '../../../scripts/utils/cliContainerOverrides.js';

describe('cliContainerOverrides', () => {
  it('uses overrides to avoid duplicate registration warnings', () => {
    const container = new AppContainer();
    container.register(tokens.IDataFetcher, () => ({ id: 'default' }));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    overrideContainerToken(container, tokens.IDataFetcher, () => ({ id: 'cli' }));

    const resolved = container.resolve(tokens.IDataFetcher);

    expect(resolved).toEqual({ id: 'cli' });
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
