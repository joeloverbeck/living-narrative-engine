// --- Tell Jest to use Node environment ---
/**
 * @jest-environment node
 */

// --- System Under Test ---
import { describeActionDiscoverySuite } from '../../common/actions/actionDiscoveryServiceTestBed.js';

// --- Action Definitions ---
import coreGoActionDefinition from '../../../data/mods/core/actions/go.action.json';
import coreWaitActionDefinition from '../../../data/mods/core/actions/wait.action.json';

// --- Helper Mocks/Types ---
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { beforeEach, expect, it } from '@jest/globals';
import {
  EXITS_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import { createTestEntity } from '../../common/mockFactories/index.js';

// We create manual mocks instead of using jest.mock() to have finer control.

describeActionDiscoverySuite(
  'ActionDiscoveryService - Go Action (Fixed State)',
  (getBed) => {
    const HERO_INSTANCE_ID = 'hero-instance-uuid-integration-1';
    const GUILD_INSTANCE_ID = 'guild-instance-uuid-integration-1';
    const TOWN_INSTANCE_ID = 'town-instance-uuid-integration-1';

    const heroEntityInitialComponents = {
      [POSITION_COMPONENT_ID]: { locationId: GUILD_INSTANCE_ID },
    };

    const adventurersGuildComponents = {
      [EXITS_COMPONENT_ID]: [{ direction: 'out', target: TOWN_INSTANCE_ID }],
    };

    let mockHeroEntity;

    beforeEach(() => {
      const bed = getBed();

      mockHeroEntity = createTestEntity(
        HERO_INSTANCE_ID,
        heroEntityInitialComponents
      );
      const mockAdventurersGuildLocation = createTestEntity(
        GUILD_INSTANCE_ID,
        adventurersGuildComponents
      );
      const mockTownLocation = createTestEntity(TOWN_INSTANCE_ID, {});

      bed.mocks.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === HERO_INSTANCE_ID) return mockHeroEntity;
        if (id === GUILD_INSTANCE_ID) return mockAdventurersGuildLocation;
        if (id === TOWN_INSTANCE_ID) return mockTownLocation;
        return undefined;
      });

      bed.mocks.targetResolutionService.resolveTargets.mockImplementation(
        async (scopeName) => {
          if (scopeName === 'core:clear_directions') {
            return [{ type: 'entity', entityId: TOWN_INSTANCE_ID }];
          }
          if (scopeName === 'none') {
            return [{ type: 'none', entityId: null }];
          }
          return [];
        }
      );

      // FIX: Default prerequisite checks to pass for this test
      bed.mocks.prerequisiteEvaluationService.evaluate.mockReturnValue(true);

      bed.mocks.formatActionCommandFn.mockImplementation((actionDef) => {
        if (actionDef.id === 'core:wait') return { ok: true, value: 'wait' };
        if (actionDef.id === 'core:go')
          return { ok: true, value: 'go to The Town' };
        return { ok: false, error: 'invalid' };
      });

      bed.mocks.actionIndex.getCandidateActions.mockReturnValue([
        coreWaitActionDefinition,
        coreGoActionDefinition,
      ]);
    });

    it('should discover "go to The Town" action when player is in adventurers guild and scope resolves an exit', async () => {
      const bed = getBed();
      const result = await bed.service.getValidActions(mockHeroEntity, {
        jsonLogicEval: {},
      });

      expect(result.errors).toEqual([]);
      expect(result.actions).toBeDefined();

      // FIX: Corrected params for 'none' scope actions
      const waitAction = {
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Wait for a moment, doing nothing.',
        params: { targetId: null },
      };
      const goAction = {
        id: 'core:go',
        name: 'Go',
        command: 'go to The Town',
        description:
          'Moves your character to the specified location, if the way is clear.',
        params: { targetId: TOWN_INSTANCE_ID },
      };

      expect(result.actions).toHaveLength(2);
      expect(result.actions).toContainEqual(waitAction);
      expect(result.actions).toContainEqual(goAction);

      expect(
        bed.mocks.targetResolutionService.resolveTargets
      ).toHaveBeenCalledWith(
        'core:clear_directions',
        mockHeroEntity,
        expect.anything(),
        null
      );
      expect(
        bed.mocks.targetResolutionService.resolveTargets
      ).toHaveBeenCalledWith('none', mockHeroEntity, expect.anything(), null);

      const expectedGoTargetContext =
        ActionTargetContext.forEntity(TOWN_INSTANCE_ID);

      // FIX: Assert that prerequisiteEvaluationService.evaluate is called
      expect(
        bed.mocks.prerequisiteEvaluationService.evaluate
      ).toHaveBeenCalledWith(
        coreGoActionDefinition.prerequisites,
        coreGoActionDefinition,
        mockHeroEntity,
        null
      );

      expect(bed.mocks.formatActionCommandFn).toHaveBeenCalledWith(
        coreGoActionDefinition,
        expectedGoTargetContext,
        expect.any(Object),
        expect.any(Object),
        expect.any(Function)
      );
    });
  }
);
