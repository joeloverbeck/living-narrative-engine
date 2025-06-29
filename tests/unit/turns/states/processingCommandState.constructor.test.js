import { describe, test, expect, jest } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import TurnDirectiveStrategyResolver from '../../../../src/turns/strategies/turnDirectiveStrategyResolver.js';

describe('ProcessingCommandState constructor', () => {
  test('invokes validation and initialization helpers', () => {
    const deps = {
      handler: { getLogger: () => ({ debug: jest.fn() }) },
      commandProcessor: {},
      commandOutcomeInterpreter: {},
      commandString: 'cmd',
      turnAction: { actionDefinitionId: 'id', commandString: 'cmd' },
      directiveResolver: TurnDirectiveStrategyResolver,
    };

    const validateSpy = jest.spyOn(
      ProcessingCommandState.prototype,
      '_validateDependencies'
    );
    const initSpy = jest.spyOn(
      ProcessingCommandState.prototype,
      '_initializeComponents'
    );

    const state = new ProcessingCommandState(deps);
    expect(state).toBeInstanceOf(ProcessingCommandState);
    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(initSpy).toHaveBeenCalledTimes(1);

    validateSpy.mockRestore();
    initSpy.mockRestore();
  });

  test('uses provided commandProcessingWorkflowFactory', () => {
    const deps = {
      handler: { getLogger: () => ({ debug: jest.fn() }) },
      commandProcessor: {},
      commandOutcomeInterpreter: {},
      commandString: 'cmd',
      turnAction: { actionDefinitionId: 'id', commandString: 'cmd' },
      directiveResolver: TurnDirectiveStrategyResolver,
    };

    const mockWorkflow = {};
    const cpwFactory = jest.fn(() => mockWorkflow);

    const state = new ProcessingCommandState({
      ...deps,
      commandProcessingWorkflowFactory: cpwFactory,
    });

    expect(cpwFactory).toHaveBeenCalled();
    expect(state._processingWorkflow).toBe(mockWorkflow);
  });
});
