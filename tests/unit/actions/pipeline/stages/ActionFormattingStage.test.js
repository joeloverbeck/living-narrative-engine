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

const createContext = (overrides = {}) => {
  const context = {
    actor: { id: 'hero' },
    actionsWithTargets: [],
    trace: undefined,
    ...overrides,
  };

  if (!Object.prototype.hasOwnProperty.call(overrides, 'trace')) {
    context.trace = { step: jest.fn() };
  } else if (overrides.trace && typeof overrides.trace === 'object') {
    context.trace = { step: jest.fn(), ...overrides.trace };
  }

  return context;
};

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
    expect(trace.step).toHaveBeenCalledWith(
      'Formatting 0 actions with their targets',
      'ActionFormattingStage.execute'
    );
  });

  it('constructs a noop instrumentation when no trace object is provided', async () => {
    const context = createContext({ trace: undefined });
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
    expect(typeof capturedOptions.validateVisualProperties).toBe('function');
    expect(typeof capturedOptions.errorFactory?.create).toBe('function');
    expect(typeof capturedOptions.fallbackFormatter?.prepareFallback).toBe(
      'function'
    );
    expect(typeof capturedOptions.fallbackFormatter?.formatWithFallback).toBe(
      'function'
    );
    expect(typeof capturedOptions.targetNormalizationService?.normalize).toBe(
      'function'
    );
    expect(typeof capturedOptions.decider?.decide).toBe('function');
  });

  it('delegates visual validation through the coordinator configuration', async () => {
    const context = createContext({ trace: { step: jest.fn() } });
    runMock.mockResolvedValue({ success: true });

    await stage.executeInternal(context);

    const { validateVisualProperties } = capturedOptions;
    expect(typeof validateVisualProperties).toBe('function');

    dependencies.logger.warn.mockClear();
    const result = validateVisualProperties({ unknown: true }, 'action-123');

    expect(result).toBe(true);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      "Unknown visual properties for action 'action-123': unknown. These will be passed through but may not be used."
    );
  });

  it('uses the stage-managed error factory in coordinator options', async () => {
    const context = createContext({ trace: { step: jest.fn() } });
    const builtError = { message: 'built' };
    dependencies.errorContextBuilder.buildErrorContext.mockReturnValue(
      builtError
    );
    runMock.mockResolvedValue({ success: true });

    await stage.executeInternal(context);

    const errorPayload = {
      errorOrResult: new Error('boom'),
      actionDef: { id: 'test' },
      actorId: 'hero',
    };
    const value = capturedOptions.errorFactory.create(errorPayload);

    expect(value).toBe(builtError);
    expect(
      dependencies.errorContextBuilder.buildErrorContext
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        actorId: 'hero',
      })
    );
  });

  it('propagates coordinator run rejections', async () => {
    const context = createContext({ trace: { step: jest.fn() } });
    const rejection = new Error('coordinator failed');
    runMock.mockRejectedValue(rejection);

    await expect(stage.executeInternal(context)).rejects.toBe(rejection);
    expect(runMock).toHaveBeenCalledTimes(1);
  });
});
