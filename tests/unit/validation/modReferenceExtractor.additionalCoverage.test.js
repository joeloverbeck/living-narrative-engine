import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ModReferenceExtractor from '../../../cli/validation/modReferenceExtractor.js';
import fs from 'fs/promises';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

jest.mock('../../../src/scopeDsl/scopeDefinitionParser.js', () => ({
  parseScopeDefinitions: jest.fn(),
}));

describe('ModReferenceExtractor additional coverage', () => {
  let extractor;
  let logger;
  let ajvValidator;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    ajvValidator = { validate: jest.fn() };
    extractor = new ModReferenceExtractor({
      logger,
      ajvValidator,
    });
    fs.readFile.mockReset();
    fs.readdir.mockReset();
    parseScopeDefinitions.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs and rethrows errors during contextual extraction', async () => {
    const failure = new Error('context-failure');
    jest.spyOn(extractor, 'extractReferences').mockRejectedValueOnce(failure);

    await expect(
      extractor.extractReferencesWithFileContext('/mods/sample')
    ).rejects.toThrow(failure);

    expect(logger.error).toHaveBeenCalledWith(
      'Failed to extract contextual references from /mods/sample',
      failure
    );
  });

  it('logs unknown scope AST node types', () => {
    extractor._extractFromScopeExpression({ type: 'CustomNode' }, new Map());

    expect(logger.debug).toHaveBeenCalledWith(
      'Processing AST node type: CustomNode'
    );
  });

  it('falls back to regex extraction when scope parsing fails', async () => {
    const scopeContent = `intimacy:close := actor.components.intimacy:bond\ncore:skip := actor.components.core:ignored`;
    fs.readFile.mockResolvedValue(scopeContent);
    parseScopeDefinitions.mockImplementation(() => {
      throw new Error('parse error');
    });

    const references = new Map();
    await extractor._extractFromScopeFile('/mods/test.scope', references);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse scope file test.scope')
    );
    expect(references.get('intimacy')).toEqual(new Set(['close', 'bond']));
    expect(references.has('core')).toBe(false);
  });

  it('extracts references from strings with extended patterns', () => {
    const references = new Map();
    const value =
      'alpha:primary := rule\n beta:component.field usage with core:ignored';

    extractor._extractModReferencesFromString(
      value,
      references,
      'test_context'
    );

    expect(references.get('alpha')).toEqual(new Set(['primary']));
    expect(references.get('beta')).toEqual(new Set(['component']));
    expect(logger.debug).toHaveBeenCalledWith(
      'Found reference alpha:primary in test_context'
    );
  });

  it('handles diverse JSON logic operand shapes', () => {
    const references = new Map();
    const logic = {
      has_component: ['entity', 'gamma:component'],
      custom: 'delta:node',
      and: [
        { get_component_value: ['entity', 'epsilon:value'] },
        'zeta:direct',
        { nested: 'eta:deep' },
      ],
      nestedObject: { innerKey: 'theta:branch' },
    };

    extractor._extractFromJsonLogic(logic, references);

    expect(references.get('gamma')).toEqual(new Set(['component']));
    expect(references.get('delta')).toEqual(new Set(['node']));
    expect(references.get('epsilon')).toEqual(new Set(['value']));
    expect(references.get('zeta')).toEqual(new Set(['direct']));
    expect(references.get('eta')).toEqual(new Set(['deep']));
    expect(references.get('theta')).toEqual(new Set(['branch']));
  });

  it('handles skip conditions and non-string inputs', () => {
    const references = new Map();
    logger.debug.mockReset();

    extractor._addScopeReference('core', 'ignored', references);
    extractor._extractModReferencesFromString(null, references);

    expect(references.size).toBe(0);
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('extracts operations and conditions from action files', () => {
    const references = new Map();
    const actionData = {
      operations: [{ component: 'omega:operator' }],
      condition: {
        has_component: ['entity', 'psi:check'],
      },
    };

    extractor._extractFromActionFile(actionData, references);

    expect(references.get('omega')).toEqual(new Set(['operator']));
    expect(references.get('psi')).toEqual(new Set(['check']));
  });

  it('handles comprehensive rule extraction cases', () => {
    const references = new Map();

    extractor._extractFromRuleFile(
      {
        condition_ref: 'alpha:primary',
        actions: [{ componentId: 'delta:action' }],
        operations: { component: 'epsilon:operation' },
        metadata: { info: 'zeta:metadata' },
      },
      references
    );
    extractor._extractFromRuleFile(
      { condition: { condition_ref: 'beta:secondary' } },
      references
    );
    extractor._extractFromRuleFile(
      { condition: { add_component: ['entity', 'gamma:logic'] } },
      references
    );
    extractor._extractFromRuleFile({ condition: 'eta:direct' }, references);

    expect(references.get('alpha')).toEqual(new Set(['primary']));
    expect(references.get('beta')).toEqual(new Set(['secondary']));
    expect(references.get('gamma')).toEqual(new Set(['logic']));
    expect(references.get('delta')).toEqual(new Set(['action']));
    expect(references.get('epsilon')).toEqual(new Set(['operation']));
    expect(references.get('zeta')).toEqual(new Set(['metadata']));
    expect(references.get('eta')).toEqual(new Set(['direct']));
  });

  it('captures blueprint and recipe references', () => {
    const references = new Map();

    extractor._extractFromBlueprintFile(
      { structure: 'iota:blueprint' },
      references
    );
    extractor._extractFromRecipeFile(
      { ingredients: 'kappa:ingredient' },
      references
    );

    expect(references.get('iota')).toEqual(new Set(['blueprint']));
    expect(references.get('kappa')).toEqual(new Set(['ingredient']));
  });

  it('returns early for invalid json logic payloads', () => {
    const references = new Map();

    extractor._extractFromJsonLogic(null, references);

    expect(references.size).toBe(0);
  });

  it('merges references from complex operation handlers', () => {
    const references = new Map();
    const operations = [
      {
        component: 'theta:alpha',
        componentId: 'iota:beta',
        target: 'kappa:scope',
        component_type: 'lambda:type',
        parameters: {
          nested: 'mu:gamma',
        },
        metadata: 'nu:delta',
      },
    ];

    extractor._extractFromOperationHandlers(operations, references);
    extractor._extractFromOperationHandlers(
      { component: 'xi:omega' },
      references
    );

    expect(references.get('theta')).toEqual(new Set(['alpha']));
    expect(references.get('iota')).toEqual(new Set(['beta']));
    expect(references.get('kappa')).toEqual(new Set(['scope']));
    expect(references.get('lambda')).toEqual(new Set(['type']));
    expect(references.get('mu')).toEqual(new Set(['gamma']));
    expect(references.get('nu')).toEqual(new Set(['delta']));
    expect(references.get('xi')).toEqual(new Set(['omega']));
  });

  it('captures references from component definition sections', () => {
    const references = new Map();
    const componentData = {
      dataSchema: { ref: 'omicron:shape' },
      defaultData: { value: 'pi:default' },
      validation: { rule: 'rho:validation' },
    };

    extractor._extractFromComponentFile(componentData, references);

    expect(references.get('omicron')).toEqual(new Set(['shape']));
    expect(references.get('pi')).toEqual(new Set(['default']));
    expect(references.get('rho')).toEqual(new Set(['validation']));
  });

  it('captures references from event definitions', () => {
    const references = new Map();
    const eventData = {
      payloadSchema: { schemaRef: 'sigma:payload' },
      handlers: [{ component: 'tau:handler' }],
      metadata: 'upsilon:meta',
    };

    extractor._extractFromEventFile(eventData, references);

    expect(references.get('sigma')).toEqual(new Set(['payload']));
    expect(references.get('tau')).toEqual(new Set(['handler']));
    expect(references.get('upsilon')).toEqual(new Set(['meta']));
  });

  it('falls back to generic traversal for unknown JSON file types', async () => {
    const references = new Map();
    fs.readFile.mockResolvedValue('{"misc": "phi:item"}');

    await extractor._extractFromJsonFile(
      '/mods/unknown.config.json',
      references
    );

    expect(references.get('phi')).toEqual(new Set(['item']));
  });

  it('returns empty contexts when directory scanning fails', async () => {
    const failure = new Error('scan failure');
    jest
      .spyOn(extractor, '_scanDirectoryForContext')
      .mockRejectedValueOnce(failure);

    const contexts = await extractor._findReferenceContexts(
      '/mods/sample',
      'chi',
      'psi'
    );

    expect(contexts).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to find contexts for chi:psi: scan failure'
    );
  });

  it('creates contextual metadata and handles read errors', async () => {
    const filePath = '/mods/sample/action.action.json';
    const content = [
      'prefix_data_that_is_extremely_long "required_components": ["alpha:need"] suffix_data_that_is_also_long',
      '"forbidden_components": ["beta:avoid"]',
      '"handlers": ["gamma:handle"]',
      '"condition_ref": "theta:condition"',
      '"description": "delta:label"',
    ].join('\n');

    fs.readFile
      .mockResolvedValueOnce(content)
      .mockResolvedValueOnce(content)
      .mockResolvedValueOnce(content)
      .mockResolvedValueOnce(content)
      .mockResolvedValueOnce(content)
      .mockRejectedValueOnce(new Error('read failure'));

    const contexts = [];
    await extractor._extractContextFromFile(
      filePath,
      'alpha:need',
      contexts,
      '/mods/sample'
    );

    expect(contexts[0]).toMatchObject({
      file: 'action.action.json',
      type: 'action',
      isBlocking: true,
      isOptional: false,
      isUserFacing: true,
    });
    expect(contexts[0].snippet.startsWith('...')).toBe(true);
    expect(contexts[0].snippet.endsWith('...')).toBe(true);

    const optionalContexts = [];
    await extractor._extractContextFromFile(
      filePath,
      'beta:avoid',
      optionalContexts,
      '/mods/sample'
    );

    expect(optionalContexts[0]).toMatchObject({
      isBlocking: false,
      isOptional: true,
      isUserFacing: true,
    });

    const handlerContexts = [];
    await extractor._extractContextFromFile(
      filePath,
      'gamma:handle',
      handlerContexts,
      '/mods/sample'
    );
    expect(handlerContexts[0].isOptional).toBe(true);

    const descriptionContexts = [];
    await extractor._extractContextFromFile(
      filePath,
      'delta:label',
      descriptionContexts,
      '/mods/sample'
    );
    expect(descriptionContexts[0].isUserFacing).toBe(true);

    const conditionContexts = [];
    await extractor._extractContextFromFile(
      filePath,
      'theta:condition',
      conditionContexts,
      '/mods/sample'
    );
    expect(conditionContexts[0].isBlocking).toBe(true);

    const contextsAfterError = [];
    await extractor._extractContextFromFile(
      filePath,
      'zeta:missing',
      contextsAfterError,
      '/mods/sample'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to process action.action.json for context: read failure'
    );
  });

  it('performs regex extraction across all fallback patterns', () => {
    const references = new Map();
    const content = [
      'modA:scopeA := source',
      'actor.components.modB:compB',
      '"modC:compC" inside json',
      'list includes modD:compD and none:self',
    ].join('\n');

    extractor._extractScopeReferencesWithRegex(content, references);

    expect(references.get('modA')).toEqual(new Set(['scopeA']));
    expect(references.get('modB')).toEqual(new Set(['compB']));
    expect(references.get('modC')).toEqual(new Set(['compC']));
    expect(references.get('modD')).toEqual(new Set(['compD']));
    expect(references.has('none')).toBe(false);
  });
});
