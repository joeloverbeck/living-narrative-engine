import { describe, it, expect } from '@jest/globals';
import { Trait } from '../../../src/characterBuilder/models/trait.js';

/**
 * Builds a fully valid trait data object for use in integration tests.
 *
 * @param {Partial<import('../../../src/characterBuilder/models/trait.js').TraitData>} overrides
 * @returns {import('../../../src/characterBuilder/models/trait.js').TraitData}
 */
function buildValidTraitData(overrides = {}) {
  const physicalDescription =
    'Tall and observant, with a collection of carefully kept notebooks tucked into a weathered satchel. ' +
    'Always moving with intentional calmness that suggests years spent cataloging secrets.';

  const profile =
    'Dr. Elara Quinn is a seasoned xenobiologist who catalogues uncharted ecosystems. ' +
    'Her detailed journals read more like poetry than research papers, and her colleagues trust her sense of curiosity. ' +
    'She tends to form quick emotional bonds with the worlds she studies, which makes leaving them behind difficult. ' +
    'Despite that, she keeps pushing forward in search of discoveries that can unite fractured cultures.';

  return {
    id: 'trait-001',
    names: [
      { name: 'Elara Quinn', justification: 'Reflects her poetic academic background' },
      { name: 'Mara Vell', justification: 'Evokes an explorer with mythic undertones' },
      { name: 'Tess Avari', justification: 'Suggests a patient strategist' },
    ],
    physicalDescription,
    personality: [
      { trait: 'Observant', explanation: 'Notices micro-reactions in every negotiation' },
      { trait: 'Empathetic', explanation: 'Absorbs the emotional cadence of a room' },
      { trait: 'Methodical', explanation: 'Catalogues every find with ritual precision' },
    ],
    strengths: ['Analytical courage', 'Diplomatic patience', 'Inventive problem solving'],
    weaknesses: ['Overextends herself', 'Keeps secrets for too long', 'Struggles to delegate'],
    likes: ['Field sketching', 'Quiet archives', 'Deep conversations'],
    dislikes: ['Sensationalism', 'Rash decisions', 'Atmospheric pollution'],
    fears: ['Losing her findings'],
    goals: {
      shortTerm: ['Broker peace between rival expeditions'],
      longTerm: 'Document ecosystems that prove cooperation is possible',
    },
    notes: ['Keeps letters from former students', 'Collects stories about first encounters'],
    profile,
    secrets: ['Protects a hidden sanctuary'],
    generatedAt: '2024-01-01T00:00:00.000Z',
    metadata: {
      model: 'gpt-5',
      temperature: 0.65,
      tokens: 2048,
      responseTime: 900,
      promptVersion: 'v3',
      generationPrompt: 'Create a nuanced character trait profile',
    },
    ...overrides,
  };
}

describe('Trait model integration', () => {
  it('creates an immutable trait instance and exports consistent JSON snapshots', () => {
    const trait = new Trait(buildValidTraitData());

    expect(Object.isFrozen(trait)).toBe(true);
    expect(Object.isFrozen(trait.names)).toBe(true);
    expect(Object.isFrozen(trait.personality)).toBe(true);
    expect(Object.isFrozen(trait.strengths)).toBe(true);
    expect(Object.isFrozen(trait.weaknesses)).toBe(true);
    expect(Object.isFrozen(trait.likes)).toBe(true);
    expect(Object.isFrozen(trait.dislikes)).toBe(true);
    expect(Object.isFrozen(trait.fears)).toBe(true);
    expect(Object.isFrozen(trait.goals)).toBe(true);
    expect(Object.isFrozen(trait.goals.shortTerm)).toBe(true);
    expect(Object.isFrozen(trait.notes)).toBe(true);
    expect(Object.isFrozen(trait.secrets)).toBe(true);
    expect(Object.isFrozen(trait.metadata)).toBe(true);

    const json = trait.toJSON();
    expect(json).toMatchObject({
      id: 'trait-001',
      generatedAt: '2024-01-01T00:00:00.000Z',
      profile: expect.stringContaining('Dr. Elara Quinn'),
      metadata: expect.objectContaining({ model: 'gpt-5' }),
    });
    expect(json.names).not.toBe(trait.names);
    expect(json.personality).not.toBe(trait.personality);
    expect(json.goals).not.toBe(trait.goals);
    expect(json.goals.shortTerm).not.toBe(trait.goals.shortTerm);
    expect(json.metadata).not.toBe(trait.metadata);

    const restored = Trait.fromRawData(json);
    expect(restored.toJSON()).toEqual(json);
  });

  it('transforms raw LLM responses into validated traits', () => {
    const metadata = {
      model: 'gpt-neo',
      temperature: 0.4,
      tokens: 1024,
      responseTime: 450,
      promptVersion: 'v5',
      generationPrompt: 'Summarize in profile',
    };

    const rawResponse = {
      names: [
        { name: 'Jonah Slate', justification: 'His resolve feels carved from stone' },
        { name: 'Iris Lumen', justification: 'Radiates insight wherever she stands' },
        { name: 'Sera Vale', justification: 'Soft voice hiding a fierce tactician' },
      ],
      physical: 'Wrapped in adaptable fabrics, always carrying modular scouting gear perfect for harsh climates.'.repeat(
        2
      ),
      personality: [
        { trait: 'Tactical', explanation: 'Reads social cues like maps' },
        { trait: 'Resilient', explanation: 'Keeps moving during storms' },
        { trait: 'Curious', explanation: 'Catalogues alien flora for fun' },
      ],
      strengths: ['Rapid prototyping', 'Diplomatic listening'],
      weaknesses: ['Sleeps too little', 'Collects grudges'],
      likes: ['Uncharted maps', 'New dialects', 'Field kitchens'],
      dislikes: ['Unnecessary violence', 'Static routines', 'Wastefulness'],
      fears: ['Losing the mission report'],
      goals: {
        shortTerm: ['Unite survey teams', 'Map the converging storms'],
        longTerm: 'Publish coordinates that keep colonists safe',
      },
      notes: ['Speaks five trade creoles', 'Uses coded sketches to share intel'],
      summary: 'An envoy who bridges pragmatic engineers and idealistic diplomats with poetic reconnaissance briefs.'.repeat(
        2
      ),
      secrets: ['Shields a defecting pilot'],
    };

    const trait = Trait.fromLLMResponse(rawResponse, metadata);
    const validation = trait.validate();

    expect(trait.physicalDescription).toContain('modular scouting gear');
    expect(trait.profile).toContain('envoy who bridges');
    expect(trait.metadata).toEqual(metadata);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings).toEqual([]);
  });

  it('reports detailed validation errors when content does not meet quality standards', () => {
    const trait = new Trait({
      names: [{ name: '', justification: '' }],
      physicalDescription: 'Too short',
      personality: [{ trait: '', explanation: '' }],
      strengths: [''],
      weaknesses: [''],
      likes: [''],
      dislikes: [''],
      fears: [],
      goals: { shortTerm: [], longTerm: '' },
      notes: [''],
      profile: 'Brief bio',
      secrets: [],
    });

    const validation = trait.validate();

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        'Names must be an array with 3-5 items',
        'Physical description is too short (min 100 characters)',
        'Personality must be an array with 3-8 items',
        'Strengths must be an array with 2-6 items',
        'Weaknesses must be an array with 2-6 items',
        'Likes must be an array with 3-8 items',
        'Dislikes must be an array with 3-8 items',
        'Fears must be an array with 1-2 items',
        'Goals.shortTerm must be an array with 1-3 items',
        'Goals.longTerm is required and must be a non-empty string',
        'Notes must be an array with 2-6 items',
        'Profile is too short (min 200 characters)',
        'Secrets must be an array with 1-2 items',
      ])
    );
  });

  it('produces readable exports, concise summaries, and searchable content', () => {
    const trait = new Trait(
      buildValidTraitData({
        likes: ['Field sketching', 'Quiet archives', 'Deep conversations', 'Experimental cuisine'],
        dislikes: ['Sensationalism', 'Rash decisions', 'Atmospheric pollution', 'False reports'],
      })
    );

    const exportText = trait.toExportText();
    expect(exportText).toContain('CHARACTER NAMES:');
    expect(exportText).toContain('PHYSICAL DESCRIPTION:');
    expect(exportText).toContain('PERSONALITY TRAITS:');
    expect(exportText).toContain('GOALS:');
    expect(exportText).toContain('Long-term: Document ecosystems that prove cooperation is possible');
    expect(exportText).toContain('SECRETS:');

    const summary = trait.getSummary(50);
    expect(summary.physicalDescription.endsWith('...')).toBe(true);
    expect(summary.profile.endsWith('...')).toBe(true);
    expect(summary.names).toContain('Elara Quinn');
    expect(summary.names).toContain('Mara Vell');
    expect(summary.personalityCount).toBe(3);
    expect(summary.strengthsCount).toBe(3);
    expect(summary.weaknessesCount).toBe(3);

    expect(trait.matchesSearch('satchel')).toBe(true); // physical description
    expect(trait.matchesSearch('ritual precision')).toBe(true); // personality explanation
    expect(trait.matchesSearch('atmospheric pollution')).toBe(true); // dislikes
    expect(trait.matchesSearch('non-existent term')).toBe(false);
  });

  it('clones data for safe reuse while keeping structures immutable', () => {
    const trait = new Trait(buildValidTraitData({ id: 'original-id' }));
    const cloned = trait.clone();

    expect(cloned).not.toBe(trait);
    expect(cloned.id).toBe('original-id');
    expect(cloned.toJSON()).toEqual(trait.toJSON());
    expect(Object.isFrozen(cloned)).toBe(true);

    const stored = trait.toJSON();
    stored.names.push({ name: 'Extra', justification: 'Added after serialization' });
    const restored = Trait.fromRawData(stored);
    expect(restored.names).toHaveLength(4);
    expect(restored.matchesSearch('Added after serialization')).toBe(true);
  });
});
