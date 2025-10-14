import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { TraceAwareInstrumentation } from '../../../../../src/actions/pipeline/stages/actionFormatting/TraceAwareInstrumentation.js';
import { NoopInstrumentation } from '../../../../../src/actions/pipeline/stages/actionFormatting/NoopInstrumentation.js';
import { FormattingAccumulator } from '../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import * as CoordinatorModule from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';

const runMock = jest.fn();
let capturedOptions = null;

const createDependencies = () => {
  const logger = { warn: jest.fn(), debug: jest.fn(), info: jest.fn() };
  return {
    commandFormatter: { name: 'formatter' },
    entityManager: { name: 'entities' },
    safeEventDispatcher: { dispatch: jest.fn() },
    getEntityDisplayNameFn: jest.fn(),
    errorContextBuilder: { buildErrorContext: jest.fn() },
    logger,
  };
};

const createContext = (overrides = {}) => ({
  actor: { id: 'hero' },
  actionsWithTargets: [],
  trace: { step: jest.fn(), ...(overrides.trace ?? {}) },
  ...overrides,
});

describe('ActionFormattingStage', () => {
  let stage;
  let dependencies;
  let coordinatorSpy;

  beforeEach(() => {
    capturedOptions = null;
    runMock.mockReset();
    dependencies = createDependencies();
    coordinatorSpy = jest
      .spyOn(CoordinatorModule, 'ActionFormattingCoordinator')
      .mockImplementation((options) => {
        capturedOptions = options;
        return { run: runMock };
      });
    stage = new ActionFormattingStage(dependencies);
    jest.clearAllMocks();
  });

  afterEach(() => {
    coordinatorSpy.mockRestore();
  });

  it('delegates execution to ActionFormattingCoordinator with trace-aware instrumentation when captureActionData is present', async () => {
    const trace = { step: jest.fn(), captureActionData: jest.fn() };
    const context = createContext({ trace });
    const expectedResult = { success: true };
    runMock.mockResolvedValue(expectedResult);

    const result = await stage.executeInternal(context);

    expect(result).toBe(expectedResult);
    expect(coordinatorSpy).toHaveBeenCalledTimes(1);
    expect(capturedOptions.context).toBe(context);
    expect(capturedOptions.instrumentation).toBeInstanceOf(
      TraceAwareInstrumentation
    );
    expect(trace.step).toHaveBeenCalledWith(
      'Formatting 0 actions with their targets',
      'ActionFormattingStage.execute'
    );
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('uses noop instrumentation when trace lacks captureActionData', async () => {
    const trace = { step: jest.fn() };
    const context = createContext({ trace });
    runMock.mockResolvedValue({ success: true });

    await stage.executeInternal(context);

    expect(coordinatorSpy).toHaveBeenCalledTimes(1);
    expect(capturedOptions.instrumentation).toBeInstanceOf(NoopInstrumentation);
  });

  it('passes expected collaborators to the coordinator', async () => {
    const context = createContext({ trace: { step: jest.fn() } });
    runMock.mockResolvedValue({ success: true });

    await stage.executeInternal(context);

    expect(capturedOptions.commandFormatter).toBe(
      dependencies.commandFormatter
    );
    expect(capturedOptions.entityManager).toBe(dependencies.entityManager);
    expect(capturedOptions.safeEventDispatcher).toBe(
      dependencies.safeEventDispatcher
    );
    expect(capturedOptions.getEntityDisplayNameFn).toBe(
      dependencies.getEntityDisplayNameFn
    );
    expect(capturedOptions.logger).toBe(dependencies.logger);
    expect(typeof capturedOptions.accumulatorFactory).toBe('function');
    expect(capturedOptions.accumulatorFactory()).toBeInstanceOf(
      FormattingAccumulator
    );
  });
});
