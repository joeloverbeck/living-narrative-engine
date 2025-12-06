import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
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

describe('ActionFormattingStage - Visual Handling', () => {
  let stage;
  let dependencies;
  let coordinatorSpy;

  beforeEach(() => {
    capturedOptions = null;
    dependencies = createDependencies();
    coordinatorSpy = jest
      .spyOn(CoordinatorModule, 'ActionFormattingCoordinator')
      .mockImplementation((options) => {
        capturedOptions = options;
        return { run: runMock };
      });
    stage = new ActionFormattingStage(dependencies);
  });

  afterEach(() => {
    coordinatorSpy.mockRestore();
    runMock.mockReset();
  });

  it('returns actions with visual metadata provided by the coordinator result', async () => {
    const expected = {
      success: true,
      actions: [
        {
          id: 'test:action',
          visual: {
            backgroundColor: '#123456',
            textColor: '#abcdef',
          },
        },
      ],
      errors: [],
    };
    runMock.mockResolvedValue(expected);

    const context = {
      actor: { id: 'hero' },
      actionsWithTargets: [],
      trace: { step: jest.fn() },
    };

    const result = await stage.executeInternal(context);

    expect(result).toBe(expected);
    expect(result.actions[0].visual).toEqual(expected.actions[0].visual);
    expect(coordinatorSpy).toHaveBeenCalledTimes(1);
  });

  it('forwards validateVisualProperties helper to the coordinator', async () => {
    runMock.mockResolvedValue({ success: true, actions: [], errors: [] });

    await stage.executeInternal({
      actor: { id: 'hero' },
      actionsWithTargets: [],
      trace: { step: jest.fn() },
    });

    expect(typeof capturedOptions.validateVisualProperties).toBe('function');
    const visual = {
      backgroundColor: '#ff0000',
      textColor: '#00ff00',
    };
    const result = capturedOptions.validateVisualProperties(
      visual,
      'action:visual'
    );
    expect(result).toBe(true);
  });
});
