import {jest, describe, it, expect, beforeEach} from '@jest/globals';
import CommandProcessor from '../../core/commandProcessor.js';
import Entity from '../../entities/entity.js';

// ---------- minimal mocks ---------- //
const mockParser = {parse: jest.fn()};
const mockExecutor = {executeAction: jest.fn()};
const mockVED = {dispatchValidated: jest.fn().mockResolvedValue(true)};
const mockLogger = {info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn()};
const mockWorld = {getLocationOfEntity: jest.fn()};
const mockEM = {getEntityInstance: jest.fn(), addComponent: jest.fn()};
const mockRepo = {getActionDefinition: jest.fn()};

// ---------- helpers ---------- //
const buildProcessor = () => new CommandProcessor({
    commandParser: mockParser,
    actionExecutor: mockExecutor,
    logger: mockLogger,
    validatedEventDispatcher: mockVED,
    worldContext: mockWorld,
    entityManager: mockEM,
    gameDataRepository: mockRepo
});

describe('CommandProcessor - action context integrity', () => {
    let processor;
    let actor;

    beforeEach(() => {
        jest.clearAllMocks();
        processor = buildProcessor();

        actor = new Entity('isekai:hero');
        mockWorld.getLocationOfEntity.mockReturnValue(new Entity('isekai:adventurers_guild'));

        mockParser.parse.mockReturnValue({
            actionId: 'core:wait',
            originalInput: 'wait',
            directObjectPhrase: null,
            preposition: null,
            indirectObjectPhrase: null,
            error: null
        });

        // succeed fast – we only care about the context argument
        mockExecutor.executeAction.mockResolvedValue({success: true, endsTurn: true});
    });

    it('builds ActionContext with playerEntity and a working eventBus', async () => {
        await processor.processCommand(actor, 'wait');

        // first arg is actionId, second is context
        const ctx = mockExecutor.executeAction.mock.calls[0][1];

        expect(ctx).toHaveProperty('actingEntity', actor);
        expect(ctx).toHaveProperty('eventBus');
        expect(typeof ctx.eventBus.dispatch).toBe('function');

        // make sure the shim really forwards to VED
        await ctx.eventBus.dispatch('textUI:display_message', {text: 'hi'});
        expect(mockVED.dispatchValidated)
            .toHaveBeenCalledWith('textUI:display_message', {text: 'hi'});
    });
});