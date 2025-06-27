/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */

import coreWaitActionDefinition from '../../../data/mods/core/actions/wait.action.json';

// --- System Under Test ---
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// --- Core Dependencies to Mock ---

// --- Helper Mocks/Types ---
import Entity from '../../../src/entities/entity.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import { beforeEach, expect, it } from '@jest/globals';
/** @typedef {import('../../../src/logging/consoleLogger.js').default} ILogger */

// No explicit jest.mock calls needed; mocks are provided by the test bed

// --- Test Suite ---
describeActionDiscoverySuite(
  'ActionDiscoveryService - Wait Action Tests',
  (getBed) => {
    const ACTOR_INSTANCE_ID = 'actor1-instance-wait';
    const DUMMY_DEFINITION_ID = 'def:dummy-wait-test';

    const createTestEntity = (instanceId, definitionId) => {
      const definition = new EntityDefinition(definitionId, {});
      const instanceData = new EntityInstanceData(instanceId, definition, {});
      return new Entity(instanceData);
    };

    let mockActorEntity;

    beforeEach(() => {
      const bed = getBed();

      mockActorEntity = createTestEntity(
        ACTOR_INSTANCE_ID,
        DUMMY_DEFINITION_ID
      );

      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);

      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        async (scopeName) => {
          if (scopeName === 'none') return [{ type: 'none', entityId: null }];
          if (scopeName === 'self')
            return [{ type: 'entity', entityId: mockActorEntity.id }];
          return [];
        }
      );

      bed.mocks.formatActionCommandFn.mockImplementation((actionDef) => {
        if (actionDef.id === 'core:wait') {
          return { ok: true, value: 'wait' };
        }
        return { ok: false, error: 'invalid' };
      });

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        coreWaitActionDefinition,
      ]);
    });

    it('should return structured action info [{id, name, command, description, params}] when core:wait is available and valid', async () => {
      const bed = getBed();
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        coreWaitActionDefinition,
      ]);
      const result = await bed.service.getValidActions(mockActorEntity, {});

      expect(result.actions).toEqual([
        {
          id: 'core:wait',
          name: 'Wait',
          command: 'wait',
          description: 'Wait for a moment, doing nothing.',
          params: { targetId: null },
        },
      ]);

      expect(bed.mocks.actionIndex.getCandidateActions).toHaveBeenCalledTimes(
        1
      );
      // FIX: The `wait` action has no prerequisites, so evaluate should NOT be called.
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).not.toHaveBeenCalled();
      expect(bed.mocks.formatActionCommandFn).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if core:wait action prerequisites fail', async () => {
      const bed = getBed();
      const waitActionWithPrereqs = {
        ...coreWaitActionDefinition,
        prerequisites: [{ logic: { some_condition: true } }],
      };
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        waitActionWithPrereqs,
      ]);
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(false);

      const result = await bed.service.getValidActions(mockActorEntity, {});

      // FIX: Now that `evaluate` is called and returns false, the actions array should be empty.
      expect(result.actions).toEqual([]);
      expect(bed.mocks.formatActionCommandFn).not.toHaveBeenCalled();
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if core:wait action definition is not provided', async () => {
      const bed = getBed();
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([]);

      const result = await bed.service.getValidActions(mockActorEntity, {});

      expect(result.actions).toEqual([]);
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).not.toHaveBeenCalled();
      expect(bed.mocks.formatActionCommandFn).not.toHaveBeenCalled();
    });

    it('should return structured info for core:wait even if other invalid actions are present', async () => {
      const bed = getBed();
      const invalidActionDef = {
        id: 'other:action',
        name: 'Other',
        scope: 'none',
        prerequisites: [{ logic: { '==': [1, 2] } }], // A failing prereq
      };
      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        coreWaitActionDefinition, // This has no prereqs
        invalidActionDef, // This has prereqs
      ]);

      bed.mocks.prerequisiteEvaluationService.evaluate.mockImplementation(
        (prereqs, actionDef) => actionDef.id !== 'other:action'
      );

      const result = await bed.service.getValidActions(mockActorEntity, {});

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].id).toBe('core:wait');
      // FIX: `evaluate` is only called for the one action that HAS prerequisites.
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).toHaveBeenCalledTimes(1);
      expect(bed.mocks.formatActionCommandFn).toHaveBeenCalledTimes(1);
    });
  }
);
