import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  setupDIContainerStage,
  resolveLoggerStage,
} from '../../../src/bootstrapper/stages/containerStages.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import StageError from '../../../src/bootstrapper/StageError.js';

/**
 *
 */
function createUiReferences() {
  document.body.innerHTML = '';
  const outputDiv = document.createElement('div');
  outputDiv.id = 'outputDiv';
  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-output';
  const titleElement = document.createElement('h1');
  const inputElement = document.createElement('input');
  document.body.append(outputDiv, errorDiv, titleElement, inputElement);

  return { outputDiv, errorDiv, titleElement, inputElement, document };
}

describe('containerStages integration with real container wiring', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('configures the AppContainer with Registrar and resolves ILogger successfully', async () => {
    const uiRefs = createUiReferences();
    const stageResult = await setupDIContainerStage(
      uiRefs,
      async (container, references) => {
        // Ensure the stage forwards UI references for real configuration code.
        expect(references).toMatchObject({
          outputDiv: uiRefs.outputDiv,
          errorDiv: uiRefs.errorDiv,
          titleElement: uiRefs.titleElement,
          inputElement: uiRefs.inputElement,
        });

        const registrar = new Registrar(container);
        registrar.instance(tokens.ILogger, new ConsoleLogger(LogLevel.DEBUG));
      },
      { createAppContainer: () => new AppContainer() }
    );

    expect(stageResult.success).toBe(true);
    const container = stageResult.payload;
    expect(container).toBeInstanceOf(AppContainer);

    const resolvedLogger = container.resolve(tokens.ILogger);
    expect(typeof resolvedLogger.debug).toBe('function');

    const resolveResult = await resolveLoggerStage(container, tokens);
    expect(resolveResult.success).toBe(true);
    expect(resolveResult.payload.logger).toBe(resolvedLogger);

    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      'Bootstrap Stage: Resolving logger service...'
    );
    expect(consoleDebugSpy).toHaveBeenCalledWith(
      'Bootstrap Stage: Resolving logger service... DONE. Logger resolved successfully.'
    );
  });

  it('returns a StageError result when container configuration fails', async () => {
    const stageResult = await setupDIContainerStage(
      createUiReferences(),
      async () => {
        throw new Error('registration exploded');
      },
      { createAppContainer: () => new AppContainer() }
    );

    expect(stageResult.success).toBe(false);
    expect(stageResult.error).toBeInstanceOf(StageError);
    expect(stageResult.error.phase).toBe('DI Container Setup');
    expect(stageResult.error.message).toContain('Fatal Error during service registration');
    expect(stageResult.error.cause?.message).toBe('registration exploded');
  });

  it('returns a StageError when ILogger token has no registration', async () => {
    const emptyContainer = new AppContainer();
    const stageResult = await resolveLoggerStage(emptyContainer, tokens);

    expect(stageResult.success).toBe(false);
    expect(stageResult.error).toBeInstanceOf(StageError);
    expect(stageResult.error.phase).toBe('Core Services Resolution');
    expect(stageResult.error.message).toContain('Could not resolve essential ILogger service');
  });

  it('returns a StageError when ILogger resolves to an invalid object', async () => {
    const container = new AppContainer();
    const registrar = new Registrar(container);
    registrar.value(tokens.ILogger, null);

    const stageResult = await resolveLoggerStage(container, tokens);

    expect(stageResult.success).toBe(false);
    expect(stageResult.error).toBeInstanceOf(StageError);
    expect(stageResult.error.message).toContain('ILogger resolved to an invalid object');
  });
});
