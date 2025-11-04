/**
 * @file Body descriptor constants and metadata
 * Centralized definitions for body-level descriptors used across the anatomy system
 */

/**
 * Valid body build types
 */
export const BODY_BUILD_TYPES = {
  SKINNY: 'skinny',
  SLIM: 'slim',
  LISSOM: 'lissom',
  TONED: 'toned',
  ATHLETIC: 'athletic',
  SHAPELY: 'shapely',
  HOURGLASS: 'hourglass',
  THICK: 'thick',
  MUSCULAR: 'muscular',
  HULKING: 'hulking',
  STOCKY: 'stocky',
};

/**
 * Valid body hair density levels
 */
export const BODY_HAIR_DENSITY = {
  HAIRLESS: 'hairless',
  SPARSE: 'sparse',
  LIGHT: 'light',
  MODERATE: 'moderate',
  HAIRY: 'hairy',
  VERY_HAIRY: 'very-hairy',
};

/**
 * Valid body composition types
 */
export const BODY_COMPOSITION_TYPES = {
  UNDERWEIGHT: 'underweight',
  LEAN: 'lean',
  AVERAGE: 'average',
  SOFT: 'soft',
  CHUBBY: 'chubby',
  OVERWEIGHT: 'overweight',
  OBESE: 'obese',
};

/**
 * Valid height categories
 */
export const HEIGHT_CATEGORIES = {
  GIGANTIC: 'gigantic',
  VERY_TALL: 'very-tall',
  TALL: 'tall',
  AVERAGE: 'average',
  SHORT: 'short',
  PETITE: 'petite',
  TINY: 'tiny',
};

/**
 * Descriptor metadata including display labels and validation info
 */
export const DESCRIPTOR_METADATA = {
  build: {
    label: 'Build',
    validValues: Object.values(BODY_BUILD_TYPES),
    description: 'Body build type',
  },
  hairDensity: {
    label: 'Hair density',
    validValues: Object.values(BODY_HAIR_DENSITY),
    description: 'Body hair density level',
  },
  composition: {
    label: 'Body composition',
    validValues: Object.values(BODY_COMPOSITION_TYPES),
    description: 'Body composition type',
  },
  skinColor: {
    label: 'Skin color',
    validValues: null, // Free-form string
    description: 'Skin color descriptor',
  },
  smell: {
    label: 'Smell',
    validValues: null, // Free-form string
    description: 'Body smell descriptor',
  },
  height: {
    label: 'Height',
    validValues: Object.values(HEIGHT_CATEGORIES),
    description: 'Height category',
  },
};

/**
 * All supported descriptor property names
 */
export const SUPPORTED_DESCRIPTOR_PROPERTIES = Object.keys(DESCRIPTOR_METADATA);
