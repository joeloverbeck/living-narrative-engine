import { createLoadContext } from '../../../src/loaders/LoadContext.js';

// Mock IDataRegistry
const mockRegistry = {
  store: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  getAllSystemRules: jest.fn(),
  clear: jest.fn(),
  getContentSource: jest.fn(),
  listContentByMod: jest.fn(),
  getEntityDefinition: jest.fn(),
  getActionDefinition: jest.fn(),
  getEventDefinition: jest.fn(),
  getComponentDefinition: jest.fn(),
  getConditionDefinition: jest.fn(),
  getEntityInstanceDefinition: jest.fn(),
  getGoalDefinition: jest.fn(),
  getAllEntityDefinitions: jest.fn(),
  getAllActionDefinitions: jest.fn(),
  getAllEventDefinitions: jest.fn(),
  getAllComponentDefinitions: jest.fn(),
  getAllConditionDefinitions: jest.fn(),
  getAllEntityInstanceDefinitions: jest.fn(),
  getAllGoalDefinitions: jest.fn(),
  getStartingPlayerId: jest.fn(),
  getStartingLocationId: jest.fn(),
};

describe('createLoadContext', () => {
  it('creates a context with all parameters', () => {
    const ctx = createLoadContext({
      worldName: 'testWorld',
      requestedMods: ['modA', 'modB'],
      registry: mockRegistry,
    });
    expect(ctx).toBeDefined();
    expect(ctx.worldName).toBe('testWorld');
    expect(ctx.requestedMods).toEqual(['modA', 'modB']);
    expect(ctx.finalModOrder).toEqual([]);
    expect(ctx.registry).toBe(mockRegistry);
    expect(ctx.totals).toEqual({});
    expect(ctx.incompatibilities).toBe(0);
  });

  it('defaults requestedMods to an empty array', () => {
    const ctx = createLoadContext({
      worldName: 'testWorld',
      registry: mockRegistry,
    });
    expect(ctx.requestedMods).toEqual([]);
  });

  it('finalModOrder is always an empty array initially', () => {
    const ctx = createLoadContext({
      worldName: 'testWorld',
      registry: mockRegistry,
    });
    expect(Array.isArray(ctx.finalModOrder)).toBe(true);
    expect(ctx.finalModOrder.length).toBe(0);
  });

  it('totals is always an empty object initially', () => {
    const ctx = createLoadContext({
      worldName: 'testWorld',
      registry: mockRegistry,
    });
    expect(typeof ctx.totals).toBe('object');
    expect(ctx.totals).toEqual({});
  });

  it('incompatibilities is always 0 initially', () => {
    const ctx = createLoadContext({
      worldName: 'testWorld',
      registry: mockRegistry,
    });
    expect(ctx.incompatibilities).toBe(0);
  });

  it('throws if worldName is missing', () => {
    expect(() => createLoadContext({ registry: mockRegistry })).toThrow();
  });

  it('throws if registry is missing', () => {
    expect(() => createLoadContext({ worldName: 'testWorld' })).toThrow();
  });

  it('returns an object matching the LoadContext typedef', () => {
    const ctx = createLoadContext({
      worldName: 'testWorld',
      requestedMods: ['modA'],
      registry: mockRegistry,
    });
    expect(typeof ctx.worldName).toBe('string');
    expect(Array.isArray(ctx.requestedMods)).toBe(true);
    expect(Array.isArray(ctx.finalModOrder)).toBe(true);
    expect(typeof ctx.registry).toBe('object');
    expect(typeof ctx.totals).toBe('object');
    expect(typeof ctx.incompatibilities).toBe('number');
  });
});
