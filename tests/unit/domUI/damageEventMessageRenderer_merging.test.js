
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DamageEventMessageRenderer } from '../../../src/domUI/damageEventMessageRenderer.js';

describe('DamageEventMessageRenderer Merging Logic', () => {
  // eslint-disable-next-line no-unused-vars
  let renderer;
  let mockLogger;
  let mockDispatcher;
  let mockNarrativeFormatter;
  let mockDomElementFactory;
  let mockListContainer;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
    };

    mockNarrativeFormatter = {
      formatDamageEvent: jest.fn().mockReturnValue('Formatted message'),
    };

    mockListContainer = {
      appendChild: jest.fn(),
      classList: { add: jest.fn() },
    };

    mockDomElementFactory = {
      create: jest.fn(), // Required for factory to be assigned by base class
      li: jest.fn().mockReturnValue({
        classList: { add: jest.fn() },
        textContent: '',
      }),
    };

    // Mock document context to return our list container
    const mockDocumentContext = {
      create: jest.fn(),
      query: jest.fn((selector) => {
        if (selector === '#message-list') return mockListContainer;
        if (selector === '#outputDiv') return {};
        return null;
      }),
    };

    renderer = new DamageEventMessageRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockDispatcher,
      domElementFactory: mockDomElementFactory,
      narrativeFormatter: mockNarrativeFormatter,
    });
  });

  it('should merge DAMAGE_APPLIED and DISMEMBERED events for the same part', async () => {
    // 1. Simulate DAMAGE_APPLIED event
    const damagePayload = {
      entityId: 'ent1',
      partId: 'part1',
      damageType: 'slashing',
      damageAmount: 25,
      entityName: 'Hero',
      partType: 'arm',
      effectsTriggered: [],
    };

    // Manually trigger the handler (since we mock subscribe)
    // We need to access the private handler bound to the event.
    // Since we can't easily access private methods, we rely on the fact that 
    // the constructor called subscribe. We can inspect the calls to subscribe 
    // to get the handlers, or just call the methods if we could.
    // Actually, simpler: we can just simulate the flow if we could trigger the subscription.
    
    // But wait, we can't invoke private handlers from outside.
    // We have to rely on the mockDispatcher.subscribe being called, capture the callback, and invoke it.
    
    const subscribeCalls = mockDispatcher.subscribe.mock.calls;
    const damageAppliedHandler = subscribeCalls.find(call => call[0] === 'anatomy:damage_applied')[1];
    const dismemberedHandler = subscribeCalls.find(call => call[0] === 'anatomy:dismembered')[1];

    // Invoke DAMAGE_APPLIED
    damageAppliedHandler({ payload: damagePayload });

    // 2. Simulate DISMEMBERED event (immediately after, same tick)
    const dismemberPayload = {
      entityId: 'ent1',
      partId: 'part1',
      damageTypeId: 'slashing', // Note: ID vs Type
      // other fields that DamageTypeEffectsService sends...
    };

    dismemberedHandler({ payload: dismemberPayload });

    // 3. Wait for microtask flush
    await Promise.resolve(); 

    // 4. Verify narrative formatter called ONCE with merged effects
    expect(mockNarrativeFormatter.formatDamageEvent).toHaveBeenCalledTimes(1);
    
    const calledPayload = mockNarrativeFormatter.formatDamageEvent.mock.calls[0][0];
    expect(calledPayload.entityId).toBe('ent1');
    expect(calledPayload.effectsTriggered).toEqual(['dismembered']);
    
    // And verify render happened
    expect(mockDomElementFactory.li).toHaveBeenCalledTimes(1);
  });
  
  it('should NOT merge events for different parts', async () => {
    const subscribeCalls = mockDispatcher.subscribe.mock.calls;
    const damageAppliedHandler = subscribeCalls.find(call => call[0] === 'anatomy:damage_applied')[1];
    
    // Part 1 damage
    damageAppliedHandler({ payload: {
      entityId: 'ent1', partId: 'part1', damageType: 'slashing', damageAmount: 10, _eventType: 'damage'
    }});
    
    // Part 2 damage
    damageAppliedHandler({ payload: {
      entityId: 'ent1', partId: 'part2', damageType: 'slashing', damageAmount: 10, _eventType: 'damage'
    }});

    await Promise.resolve();

    expect(mockNarrativeFormatter.formatDamageEvent).toHaveBeenCalledTimes(2);
  });
});
