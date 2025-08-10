/**
 * @file Default template configurations
 * @module characterBuilder/templates/config/defaultConfigs
 */

/**
 * Default configuration values for all template types
 * 
 * @type {object}
 */
export const DEFAULT_TEMPLATE_CONFIGS = {
  // Common configuration for all templates
  common: {
    accessibility: {
      enabled: true,
      ariaLive: 'polite',
      announceChanges: true,
      keyboardNavigation: true,
      focusManagement: true,
      screenReaderOptimized: false,
    },
    performance: {
      lazyLoad: true,
      cacheTimeout: 3600000, // 1 hour
      maxRenderTime: 10, // ms
      virtualScrollThreshold: 100,
      debounceDelay: 300, // ms
      throttleDelay: 100, // ms
    },
    styling: {
      theme: 'default',
      animations: true,
      transitions: true,
      responsiveBreakpoints: {
        mobile: 480,
        tablet: 768,
        desktop: 1024,
        wide: 1440,
      },
      cssVariables: {
        primaryColor: 'var(--cb-primary)',
        secondaryColor: 'var(--cb-secondary)',
        backgroundColor: 'var(--cb-background)',
        textColor: 'var(--cb-text)',
      },
    },
    validation: {
      strict: false,
      warnOnMissingData: true,
      throwOnError: false,
      validateOnRender: true,
      sanitizeInput: true,
    },
    events: {
      delegation: true,
      throttle: {
        scroll: 100,
        resize: 200,
        input: 300,
      },
      preventDefaultOn: ['submit'],
      stopPropagationOn: [],
      passive: {
        scroll: true,
        touchstart: true,
        touchmove: true,
      },
    },
    debug: {
      enabled: false,
      logLevel: 'error',
      showPerformanceMetrics: false,
      highlightUpdates: false,
    },
  },

  // Page template specific configuration
  page: {
    layout: {
      type: 'fluid', // 'fluid' | 'fixed' | 'adaptive'
      maxWidth: '1200px',
      padding: '20px',
      gap: '20px',
      centerContent: true,
    },
    header: {
      show: true,
      sticky: false,
      height: 'auto',
      showTitle: true,
      showSubtitle: true,
      showActions: true,
      backgroundColor: 'transparent',
      borderBottom: true,
    },
    footer: {
      show: true,
      sticky: false,
      showVersion: true,
      showLinks: true,
      copyrightText: '© 2025 Living Narrative Engine',
      backgroundColor: 'transparent',
      borderTop: true,
    },
    panels: {
      defaultLayout: 'dual', // 'single' | 'dual' | 'triple'
      collapsible: true,
      resizable: false,
      minWidth: '300px',
      maxWidth: '800px',
      gap: '20px',
      borderRadius: '4px',
      shadow: true,
    },
    modals: {
      backdrop: true,
      closeOnEscape: true,
      closeOnBackdropClick: false,
      animation: 'fade',
      centered: true,
      maxWidth: '600px',
      zIndex: 1000,
    },
    loading: {
      showSpinner: true,
      spinnerType: 'circular',
      message: 'Loading...',
      delay: 200, // ms before showing
    },
  },

  // Panel component configuration
  panel: {
    appearance: {
      border: true,
      shadow: true,
      borderRadius: '4px',
      backgroundColor: 'var(--panel-bg)',
      borderColor: 'var(--panel-border)',
    },
    header: {
      show: true,
      collapsible: false,
      actions: true,
      backgroundColor: 'transparent',
      padding: '15px',
      borderBottom: true,
    },
    content: {
      padding: '15px',
      scrollable: true,
      maxHeight: 'none',
      minHeight: '200px',
      overflow: 'auto',
    },
    states: {
      loading: {
        showSpinner: true,
        message: 'Loading...',
        opacity: 0.6,
      },
      empty: {
        showMessage: true,
        message: 'No content available',
        icon: true,
        centered: true,
      },
      error: {
        showMessage: true,
        allowRetry: true,
        retryText: 'Try Again',
        showDetails: false,
      },
      collapsed: {
        showHeader: true,
        animationDuration: 200,
      },
    },
  },

  // Form configuration
  form: {
    validation: {
      immediate: false,
      onBlur: true,
      onSubmit: true,
      showErrors: true,
      errorPosition: 'below', // 'below' | 'above' | 'tooltip'
      highlightErrors: true,
    },
    layout: {
      labelPosition: 'top', // 'top' | 'left' | 'inline'
      requiredIndicator: '*',
      helpPosition: 'below',
      fieldSpacing: '15px',
      groupSpacing: '25px',
    },
    submission: {
      preventDefault: true,
      disableOnSubmit: true,
      showProgress: true,
      resetOnSuccess: false,
      confirmBeforeSubmit: false,
      submitText: 'Submit',
      cancelText: 'Cancel',
    },
    fields: {
      defaultType: 'text',
      showPlaceholder: true,
      autocomplete: 'on',
      spellcheck: true,
    },
  },

  // Button configuration
  button: {
    appearance: {
      variant: 'primary', // 'primary' | 'secondary' | 'tertiary' | 'danger'
      size: 'medium', // 'small' | 'medium' | 'large'
      fullWidth: false,
      rounded: false,
      iconPosition: 'left', // 'left' | 'right'
    },
    behavior: {
      rippleEffect: true,
      preventDoubleClick: true,
      doubleClickDelay: 500, // ms
      loadingState: true,
      disabledOpacity: 0.5,
    },
    states: {
      hover: {
        darken: 10, // percentage
        scale: 1.02,
      },
      active: {
        darken: 20,
        scale: 0.98,
      },
      loading: {
        showSpinner: true,
        disableClick: true,
        text: 'Loading...',
      },
    },
  },

  // Modal configuration
  modal: {
    size: 'medium', // 'small' | 'medium' | 'large' | 'fullscreen'
    position: 'center', // 'center' | 'top' | 'bottom'
    overlay: {
      opacity: 0.5,
      blur: false,
      color: '#000000',
    },
    animation: {
      type: 'fade', // 'fade' | 'slide' | 'zoom' | 'none'
      duration: 200, // ms
      easing: 'ease-in-out',
    },
    header: {
      show: true,
      closeButton: true,
      borderBottom: true,
      padding: '20px',
    },
    body: {
      padding: '20px',
      scrollable: true,
      maxHeight: '70vh',
    },
    footer: {
      show: true,
      borderTop: true,
      padding: '20px',
      alignment: 'right', // 'left' | 'center' | 'right'
    },
    actions: {
      showClose: true,
      confirmText: 'OK',
      cancelText: 'Cancel',
      confirmVariant: 'primary',
      cancelVariant: 'secondary',
    },
  },

  // List/table configuration
  list: {
    appearance: {
      striped: false,
      bordered: true,
      hover: true,
      compact: false,
    },
    pagination: {
      enabled: true,
      pageSize: 10,
      pageSizes: [10, 25, 50, 100],
      showInfo: true,
      showJumper: false,
    },
    sorting: {
      enabled: true,
      multiColumn: false,
      defaultOrder: 'asc',
      indicators: true,
    },
    selection: {
      enabled: false,
      multiple: false,
      showCheckbox: true,
      highlightSelected: true,
    },
    virtualScroll: {
      enabled: false,
      threshold: 100,
      itemHeight: 40,
      buffer: 5,
    },
  },

  // Input field configuration
  input: {
    appearance: {
      outline: true,
      borderRadius: '4px',
      padding: '8px 12px',
      fontSize: '14px',
    },
    behavior: {
      autoFocus: false,
      selectOnFocus: false,
      clearable: false,
      showCharCount: false,
      maxLength: null,
    },
    validation: {
      showIcon: true,
      showMessage: true,
      validateOnType: false,
      debounceValidation: 500, // ms
    },
    states: {
      focus: {
        borderColor: 'var(--cb-primary)',
        shadow: true,
      },
      error: {
        borderColor: 'var(--cb-error)',
        backgroundColor: 'var(--cb-error-bg)',
      },
      success: {
        borderColor: 'var(--cb-success)',
        showIcon: true,
      },
      disabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
      },
    },
  },

  // Notification/toast configuration
  notification: {
    position: 'top-right', // 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
    duration: 5000, // ms
    dismissible: true,
    stackable: true,
    maxStack: 5,
    animation: {
      type: 'slide',
      duration: 300,
    },
    types: {
      success: {
        icon: '✓',
        backgroundColor: 'var(--cb-success)',
      },
      error: {
        icon: '✕',
        backgroundColor: 'var(--cb-error)',
      },
      warning: {
        icon: '⚠',
        backgroundColor: 'var(--cb-warning)',
      },
      info: {
        icon: 'ℹ',
        backgroundColor: 'var(--cb-info)',
      },
    },
  },
};

/**
 * Get default configuration for a specific template type
 * 
 * @param {string} templateType - Type of template
 * @returns {object} Default configuration for the template type
 */
export function getDefaultConfig(templateType) {
  return {
    ...DEFAULT_TEMPLATE_CONFIGS.common,
    ...DEFAULT_TEMPLATE_CONFIGS[templateType],
  };
}

/**
 * Merge common config with template-specific config
 * 
 * @param {string} templateType - Type of template
 * @param {object} [overrides] - Configuration overrides
 * @returns {object} Merged configuration
 */
export function mergeWithDefaults(templateType, overrides = {}) {
  const common = DEFAULT_TEMPLATE_CONFIGS.common || {};
  const specific = DEFAULT_TEMPLATE_CONFIGS[templateType] || {};
  
  return {
    ...common,
    ...specific,
    ...overrides,
  };
}