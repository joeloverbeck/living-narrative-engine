/**
 * @file Service for filtering and searching cliché data
 */

/**
 * Handles filtering and searching of cliché display data
 */
export class ClicheFilterService {
  /**
   * Search through all cliché data
   *
   * @param {object} data - The display data
   * @param {string} searchTerm - The search term
   * @returns {object} Filtered display data
   */
  search(data, searchTerm) {
    if (!data || !searchTerm) return data;

    const term = searchTerm.toLowerCase().trim();
    if (!term) return data;

    const filteredCategories = data.categories
      ? data.categories
          .map((category) => {
            if (
              !category ||
              !category.items ||
              !Array.isArray(category.items)
            ) {
              return null;
            }

            const filteredItems = category.items.filter(
              (item) => item && item.toLowerCase().includes(term)
            );

            return {
              ...category,
              items: filteredItems,
              count: filteredItems.length,
            };
          })
          .filter((category) => category && category.items.length > 0)
      : [];

    // Also search in tropes
    const filteredTropes = data.tropesAndStereotypes
      ? data.tropesAndStereotypes.filter((trope) =>
          trope.toLowerCase().includes(term)
        )
      : [];

    return {
      ...data,
      categories: filteredCategories,
      tropesAndStereotypes: filteredTropes,
    };
  }

  /**
   * Filter by active categories
   *
   * @param {object} data - The display data
   * @param {string[]} activeCategories - Array of active category IDs
   * @returns {object} Filtered display data
   */
  filterByCategories(data, activeCategories) {
    if (!data || !activeCategories) return data;

    const filteredCategories = data.categories.filter((category) =>
      activeCategories.includes(category.id)
    );

    return {
      ...data,
      categories: filteredCategories,
    };
  }

  /**
   * Combine search and category filters
   *
   * @param {object} data - The display data
   * @param {string} searchTerm - The search term
   * @param {string[]} activeCategories - Array of active category IDs
   * @returns {object} Filtered display data
   */
  applyFilters(data, searchTerm, activeCategories) {
    let result = data;

    if (activeCategories && activeCategories.length > 0) {
      result = this.filterByCategories(result, activeCategories);
    }

    if (searchTerm) {
      result = this.search(result, searchTerm);
    }

    return result;
  }

  /**
   * Get statistics about the filtered results
   *
   * @param {object} filteredData - The filtered display data
   * @returns {object} Statistics about the results
   */
  getStatistics(filteredData) {
    if (!filteredData) {
      return {
        totalCategories: 0,
        totalItems: 0,
        totalTropes: 0,
      };
    }

    const totalItems = filteredData.categories.reduce(
      (sum, category) => sum + category.items.length,
      0
    );

    return {
      totalCategories: filteredData.categories.length,
      totalItems,
      totalTropes: filteredData.tropesAndStereotypes?.length || 0,
    };
  }

  /**
   * Highlight search terms in text
   *
   * @param {string} text - The text to highlight in
   * @param {string} searchTerm - The term to highlight
   * @returns {string} HTML with highlighted terms
   */
  highlightTerm(text, searchTerm) {
    if (!text || !searchTerm) return text;

    // Escape special regex characters
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}

export default ClicheFilterService;
