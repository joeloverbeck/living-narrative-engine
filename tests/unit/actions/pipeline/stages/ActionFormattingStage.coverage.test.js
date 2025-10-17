import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { TraceAwareInstrumentation } from '../../../../../src/actions/pipeline/stages/actionFormatting/TraceAwareInstrumentation.js';
import { NoopInstrumentation } from '../../../../../src/actions/pipeline/stages/actionFormatting/NoopInstrumentation.js';
import * as CoordinatorModule from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';

const runMock = jest.fn();
let capturedOptions = null;

const createDependencies = () => {
  const logger = { warn: jest.fn(), debug: jest.fn() };
  return {
    commandFormatter: { name: 'formatter' },
    entityManager: { name: 'entities' },
    safeEventDispatcher: { dispatch: jest.fn() },
    getEntityDisplayNameFn: jest.fn(),
    errorContextBuilder: { buildErrorContext: jest.fn() },
    logger,
  };
};

describe('ActionFormattingStage.validateVisualProperties', () => {
  let stage;
  let dependencies;
  let validate;
  let coordinatorSpy;

  beforeEach(async () => {
    capturedOptions = null;
    runMock.mockResolvedValue({ success: true });
    dependencies = createDependencies();
    coordinatorSpy = jest
      .spyOn(CoordinatorModule, 'ActionFormattingCoordinator')
      .mockImplementation((options) => {
        capturedOptions = options;
        return { run: runMock };
      });
    stage = new ActionFormattingStage(dependencies);

    await stage.executeInternal({
      actor: { id: 'hero' },
      actionsWithTargets: [],
      trace: { step: jest.fn(), captureActionData: jest.fn() },
    });

    validate = capturedOptions.validateVisualProperties;
    jest.clearAllMocks();
  });

  afterEach(() => {
    coordinatorSpy.mockRestore();
  });

  it('returns true without logging when visual is null', () => {
    const result = validate(null, 'action:visual');

    expect(result).toBe(true);
    expect(dependencies.logger.warn).not.toHaveBeenCalled();
  });

  it('warns when visual is not an object', () => {
    const result = validate('invalid', 'action:visual');

    expect(result).toBe(true);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      "Invalid visual property structure for action 'action:visual': expected object, got string. Visual properties will be passed through."
    );
  });

  it('warns about unknown properties and invalid types', () => {
    const visual = {
      backgroundColor: 123,
      customProperty: 'value',
    };

    const result = validate(visual, 'action:visual');

    expect(result).toBe(true);
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      "Unknown visual properties for action 'action:visual': customProperty. These will be passed through but may not be used."
    );
    expect(dependencies.logger.warn).toHaveBeenCalledWith(
      "Visual property 'backgroundColor' for action 'action:visual' should be a string, got number. Property will be passed through."
    );
  });
});

describe('ActionFormattingStage instrumentation coverage', () => {
  let stage;
  let coordinatorSpy;

  beforeEach(() => {
    runMock.mockReset();
    capturedOptions = null;
    coordinatorSpy = jest
      .spyOn(CoordinatorModule, 'ActionFormattingCoordinator')
      .mockImplementation((options) => {
        capturedOptions = options;
        return { run: runMock };
      });
    stage = new ActionFormattingStage(createDependencies());
  });

  afterEach(() => {
    coordinatorSpy.mockRestore();
  });

  it('creates trace-aware instrumentation when trace supports captureActionData', async () => {
    const trace = { step: jest.fn(), captureActionData: jest.fn() };
    runMock.mockResolvedValue({ success: true });

    await stage.executeInternal({
      actor: { id: 'hero' },
      actionsWithTargets: [],
      trace,
    });

    expect(capturedOptions.instrumentation).toBeInstanceOf(
      TraceAwareInstrumentation
    );
  });

  it('creates noop instrumentation when trace lacks captureActionData', async () => {
    const trace = { step: jest.fn() };
    runMock.mockResolvedValue({ success: true });

    await stage.executeInternal({
      actor: { id: 'hero' },
      actionsWithTargets: [],
      trace,
    });

    expect(capturedOptions.instrumentation).toBeInstanceOf(NoopInstrumentation);
  });
});
