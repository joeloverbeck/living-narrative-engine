import ActionExecutor from '../../actions/actionExecutor.js';
import {describe, expect, jest, test} from "@jest/globals";

// Dumb-as-rocks logger stub
const makeLogger = () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
});

describe('ActionExecutor – fetchActionDefinition wiring', () => {
    const mockActionDef = {id: 'core:wait', target_domain: 'none'};

    const buildExecutor = () => {
        const deps = {
            gameDataRepository: {getActionDefinition: jest.fn().mockReturnValue(mockActionDef)},
            targetResolutionService: {
                resolveActionTarget: jest.fn().mockResolvedValue({
                    status: 'FOUND_UNIQUE',
                    targetType: 'none'
                })
            },
            actionValidationService: {isValid: jest.fn().mockReturnValue(true)},
            payloadValueResolverService: {resolveValue: jest.fn()},
            validatedEventDispatcher: {dispatchValidated: jest.fn().mockResolvedValue(true)},
            eventBus: {dispatch: jest.fn()},
            logger: makeLogger()
        };
        return {executor: new ActionExecutor(deps), deps};
    };

    test('uses gameDataRepository.getActionDefinition', async () => {
        const {executor, deps} = buildExecutor();

        const ctx = {
            playerEntity: {id: 'isekai:hero', getComponentData: jest.fn(), hasComponent: jest.fn()},
            currentLocation: null,
            parsedCommand: null
        };

        const result = await executor.executeAction('core:wait', ctx);

        expect(deps.gameDataRepository.getActionDefinition).toHaveBeenCalledWith('core:wait');
        expect(result.success).toBe(true);
    });

    test('gracefully fails when definition is missing', async () => {
        const {executor, deps} = buildExecutor();
        deps.gameDataRepository.getActionDefinition.mockReturnValue(undefined);

        const ctx = {
            playerEntity: {id: 'isekai:hero', getComponentData: jest.fn(), hasComponent: jest.fn()},
            currentLocation: null,
            parsedCommand: null
        };

        const result = await executor.executeAction('core:wait', ctx);

        expect(result.success).toBe(false);
        expect(result.messages[0].text).toMatch(/not defined/i);
    });
});