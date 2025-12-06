import { describe, expect, it } from '@jest/globals';
import { AnatomyDataError } from '../../../src/errors/anatomyDataError.js';
import { AnatomyVisualizationError } from '../../../src/errors/anatomyVisualizationError.js';

const collectSuggestions = (...args) =>
  AnatomyDataError._getSuggestions(...args);

describe('AnatomyDataError', () => {
  it('decorates the base anatomy visualization error with contextual details', () => {
    const error = new AnatomyDataError('Unable to build anatomy tree', {
      entityId: 'entity-42',
      dataType: 'anatomy:part',
      invalidData: { part: 'leg', missing: ['knee'] },
      validationError: 'required field missing',
      metadata: { attempt: 3 },
      recoverable: false,
    });

    expect(error).toBeInstanceOf(AnatomyDataError);
    expect(error).toBeInstanceOf(AnatomyVisualizationError);
    expect(error.name).toBe('AnatomyDataError');
    expect(error.code).toBe('ANATOMY_DATA_ERROR');
    expect(error.severity).toBe('HIGH');
    expect(error.recoverable).toBe(false);
    expect(error.context).toMatchObject({
      context: 'Anatomy data processing for entity: entity-42',
      code: 'ANATOMY_DATA_ERROR',
      severity: 'HIGH',
      recoverable: false,
    });
    expect(error.userMessage).toBe(
      'Some anatomy parts could not be loaded properly.'
    );
    expect(error.entityId).toBe('entity-42');
    expect(error.dataType).toBe('anatomy:part');
    expect(error.invalidData).toEqual({ part: 'leg', missing: ['knee'] });
    expect(error.validationError).toBe('required field missing');
    expect(error.metadata).toEqual({ attempt: 3 });

    expect(error.suggestions).toEqual([
      'Check that all required anatomy fields are present',
      'Verify all anatomy parts are properly defined',
      'Check for missing part references',
    ]);
  });

  it('provides helper constructors for common anatomy data failures', () => {
    const missingData = AnatomyDataError.missingAnatomyData(
      'entity-5',
      'anatomy:body'
    );
    expect(missingData.message).toBe(
      'No anatomy:body component found for entity: entity-5'
    );
    expect(missingData.code).toBe('MISSING_ANATOMY_DATA');
    expect(missingData.recoverable).toBe(true);
    expect(missingData.suggestions).toEqual([
      'Try selecting a different entity',
      'Ensure the entity has anatomy components defined',
      'Check if the entity definition includes anatomy data',
    ]);

    const invalidStructure = AnatomyDataError.invalidAnatomyStructure(
      'entity-9',
      { body: {} },
      'missing root node'
    );
    expect(invalidStructure.message).toBe(
      'Invalid anatomy structure for entity entity-9: missing root node'
    );
    expect(invalidStructure.code).toBe('INVALID_ANATOMY_STRUCTURE');
    expect(invalidStructure.recoverable).toBe(false);

    const missingParts = AnatomyDataError.missingAnatomyParts('entity-10', [
      'left-arm',
      'right-leg',
    ]);
    expect(missingParts.metadata).toEqual({
      missingPartIds: ['left-arm', 'right-leg'],
    });
    expect(missingParts.suggestions).toEqual([
      'The visualization will show available parts only',
      'Try refreshing to reload anatomy data',
      'Some parts may be loading in the background',
    ]);

    const circular = AnatomyDataError.circularAnatomyReference('entity-11', [
      'torso',
      'arm',
      'torso',
    ]);
    expect(circular.message).toBe(
      'Circular reference detected in anatomy data for entity entity-11: torso -> arm -> torso'
    );
    expect(circular.metadata).toEqual({ cyclePath: ['torso', 'arm', 'torso'] });
    expect(circular.suggestions).toEqual([
      'Try selecting a different entity',
      "This entity's anatomy data needs to be corrected",
      'Contact support to report this data issue',
    ]);
  });

  it('maps user messages based on data type with graceful fallbacks', () => {
    expect(AnatomyDataError._getUserMessage(undefined, undefined)).toBe(
      'Could not process anatomy data.'
    );
    expect(AnatomyDataError._getUserMessage('anatomy:body', 'entity-12')).toBe(
      'Could not load the main anatomy structure for this entity.'
    );
    expect(AnatomyDataError._getUserMessage('anatomy:part', 'entity-12')).toBe(
      'Some anatomy parts could not be loaded properly.'
    );
    expect(AnatomyDataError._getUserMessage('anatomy:joint', 'entity-12')).toBe(
      'Anatomy joint connections could not be processed.'
    );
    expect(AnatomyDataError._getUserMessage('custom:data', 'entity-12')).toBe(
      'Could not process custom:data data for anatomy visualization.'
    );
  });

  it('builds recovery suggestions from validation hints and data type', () => {
    expect(collectSuggestions('anatomy:body', 'required part missing')).toEqual(
      [
        'Check that all required anatomy fields are present',
        'Ensure the entity has a valid anatomy:body component',
        'Check that the root anatomy part is defined',
      ]
    );

    expect(collectSuggestions('anatomy:joint', 'format error')).toEqual([
      'Verify anatomy data follows the correct format',
      'Ensure joint connections are valid',
      'Verify joint references point to existing parts',
    ]);

    expect(collectSuggestions(undefined, undefined)).toEqual([
      'Try selecting a different entity',
      'Wait a moment and try again',
    ]);
  });
});
