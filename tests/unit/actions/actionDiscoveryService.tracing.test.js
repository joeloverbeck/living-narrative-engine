import { beforeEach, expect, it, jest } from '@jest/globals';
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';

jest.mock('../../../src/actions/tracing/traceContext.js', () => ({
  TraceContext: jest
    .fn()
    .mockImplementation(() => ({ addLog: jest.fn(), logs: [] })),
}));

describeActionDiscoverySuite(
  'ActionDiscoveryService Tracing',
  (getBed) => {
    let actorEntity;
    let context;

    const actionDefPrereq = {
      id: 'action1',
      name: 'With Prereqs',
      prerequisites: [{ op: 'test' }],
      scope: 'someScope',
    };
    const actionDefScope = {
      id: 'action2',
      name: 'With Scope',
      scope: 'someScope',
    };
    const actionDefSimple = { id: 'action3', name: 'Simple', scope: 'none' };

    beforeEach(() => {
      jest.clearAllMocks();
      const bed = getBed();
      actorEntity = { id: 'player' };
      context = { a: 1 };
      bed.mocks.getActorLocationFn.mockReturnValue('location1');
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([]);
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);
      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        async (scopeName) => {
          if (scopeName === 'someScope') {
            return [
              { type: 'entity', entityId: 'target1' },
              { type: 'entity', entityId: 'target2' },
            ];
          }
          if (scopeName === 'none') return [{ type: 'none', entityId: null }];
          if (scopeName === 'self')
            return [{ type: 'entity', entityId: actorEntity.id }];
          return [];
        }
      );
      bed.mocks.formatActionCommandFn.mockReturnValue({
        ok: true,
        value: 'do action',
      });
    });

    describe('getValidActions({ trace: true })', () => {
      it('should create a new TraceContext and log the start of the trace', async () => {
        const bed = getBed();
        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );

        expect(TraceContext).toHaveBeenCalledTimes(1);
        expect(trace.addLog).toHaveBeenCalledWith(
          'info',
          `Starting action discovery for actor '${actorEntity.id}'.`,
          'getValidActions',
          { withTrace: true }
        );
      });

      it('should call getCandidateActions with the actor and the trace object', async () => {
        const bed = getBed();
        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );

        expect(bed.mocks.actionIndex.getCandidateActions).toHaveBeenCalledWith(
          actorEntity,
          trace
        );
      });

      it('should log each candidate action being processed', async () => {
        const bed = getBed();
        bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
          actionDefSimple,
          actionDefScope,
        ]);

        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );

        expect(trace.addLog).toHaveBeenCalledWith(
          'step',
          `Processing candidate action: '${actionDefSimple.id}'`,
          'ActionDiscoveryService.#processCandidateAction'
        );
        expect(trace.addLog).toHaveBeenCalledWith(
          'step',
          `Processing candidate action: '${actionDefScope.id}'`,
          'ActionDiscoveryService.#processCandidateAction'
        );
      });

      it('should pass the trace object to the prerequisite check', async () => {
        const bed = getBed();
        bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
          actionDefPrereq,
        ]);
        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );

        expect(
          bed.mocks.prerequisiteEvaluationService.evaluate
        ).toHaveBeenCalledWith(
          actionDefPrereq.prerequisites,
          actionDefPrereq,
          actorEntity,
          trace
        );
      });

      it('should log when prerequisites pass', async () => {
        const bed = getBed();
        bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
          actionDefPrereq,
        ]);
        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );

        expect(trace.addLog).toHaveBeenCalledWith(
          'success',
          `Action '${actionDefPrereq.id}' passed actor prerequisite check.`,
          'ActionDiscoveryService.#processCandidateAction'
        );
      });

      it('should log and discard action when prerequisites fail', async () => {
        const bed = getBed();
        bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
          actionDefPrereq,
        ]);
        bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(false);

        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );

        expect(trace.addLog).toHaveBeenCalledWith(
          'failure',
          `Action '${actionDefPrereq.id}' discarded due to failed actor prerequisites.`,
          'ActionDiscoveryService.#processCandidateAction'
        );
        expect(
          bed.mocks.targetResolutionService.resolveTargets
        ).not.toHaveBeenCalled();
      });

      it('should pass the trace object to the scope resolution', async () => {
        const bed = getBed();
        bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
          actionDefScope,
        ]);
        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );

        expect(
          bed.mocks.targetResolutionService.resolveTargets
        ).toHaveBeenCalledWith(
          actionDefScope.scope,
          actorEntity,
          expect.anything(),
          trace
        );
      });

      it('should orchestrate a full trace, logging multiple steps in order', async () => {
        const bed = getBed();
        bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
          actionDefPrereq,
          actionDefScope,
        ]);
        bed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
          (_, actionDef) => actionDef.id !== actionDefPrereq.id
        );

        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );
        const calls = trace.addLog.mock.calls;

        expect(calls[0][1]).toContain('Starting action discovery');
        expect(calls[1][1]).toContain(
          `Processing candidate action: '${actionDefPrereq.id}'`
        );
        expect(calls[2][1]).toContain(
          'discarded due to failed actor prerequisites'
        );
        expect(calls[3][1]).toContain(
          `Processing candidate action: '${actionDefScope.id}'`
        );
        expect(calls[4][1]).toContain('passed actor prerequisite check');
        const finalLogCall = calls.find((call) =>
          call[1].includes('Finished discovery')
        );
        expect(finalLogCall).toBeDefined();
        expect(finalLogCall[1]).toContain(
          'Finished discovery. Found 2 valid actions'
        );
      });

      it('should return the populated trace object in the result', async () => {
        const bed = getBed();
        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: true }
        );
        expect(trace).not.toBeNull();
        expect(trace).toBeInstanceOf(Object);
        expect(trace.addLog).toBeDefined();
      });

      it('should return a null trace when tracing is disabled', async () => {
        const bed = getBed();
        const { trace } = await bed.service.getValidActions(
          actorEntity,
          context,
          { trace: false }
        );
        expect(trace).toBeNull();
        expect(TraceContext).not.toHaveBeenCalled();
      });
    });
  },
  { traceContextFactory: () => new TraceContext() }
);
