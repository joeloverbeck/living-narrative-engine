// tests/turns/aigamestateprovider.availableActions.test.js
import {
    jest,
    describe,
    it,
    expect,
    beforeEach,
} from '@jest/globals';

import {AIGameStateProvider} from
        '../../../src/turns/services/AIGameStateProvider.js';

import {POSITION_COMPONENT_ID} from
        '../../../src/constants/componentIds.js';

describe('_getAvailableActions – location ID handling', () => {
    const LOCATION_ID = 'loc-123';

    /** Minimal mock actor with a position component */
    const makeMockActor = () => {
        const entries = new Map([
            [POSITION_COMPONENT_ID, {locationId: LOCATION_ID}],
        ]);
        return {
            id: 'actor-1',
            componentEntries: entries,
            getComponentData: (cid) =>
                cid === POSITION_COMPONENT_ID ? {locationId: LOCATION_ID} : undefined,
            hasComponent: () => false,
        };
    };

    /** Reusable no-op logger */
    const mkLogger = () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    });

    let capturedCtx;
    const mockADS = {
        getValidActions: jest.fn((actor, ctx) => {
            capturedCtx = ctx;               // capture the ActionContext
            return Promise.resolve([]);      // nothing else matters
        }),
    };

    const mockTurnContext = {
        getEntityManager: () => null,      // not needed for this test
        getActionDiscoverySystem: () => mockADS,
        game: {},
    };

    beforeEach(() => {
        mockADS.getValidActions.mockClear();
        capturedCtx = undefined;
    });

    it('passes a plain string ID (not an object) to ActionDiscoverySystem',
        async () => {
            const provider = new AIGameStateProvider();
            await provider._getAvailableActions(
                makeMockActor(),
                mockTurnContext,
                null,
                mkLogger()
            );

            expect(mockADS.getValidActions).toHaveBeenCalledTimes(1);
            // The bug-proof assertion:
            expect(typeof capturedCtx.currentLocation).toBe('string');
            expect(capturedCtx.currentLocation).toBe(LOCATION_ID);
        });
});