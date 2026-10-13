// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Debug-gated logging. Console output is OFF by default so that scanned
// prompt text and detected PII values never reach the browser console
// unless the user explicitly enables the "debug" setting.
let debugEnabled = false;

function sanitizeFinding(f) {
  if (debugEnabled) {
    return '{' + f.type + ': "' + (f.value || 'detected') + '"}';
  }
  return '{' + f.type + ': "REDACTED"}';
}
function stringify(arg) {
  if (arg === null || arg === undefined) return String(arg);
  if (typeof arg === 'string' && !debugEnabled && arg.length > 300) {
    return arg.slice(0, 300) + '…[truncated]';
  }
  if (typeof arg === 'object') {
    try {
      // For arrays of findings, show summary (values redacted unless debugging)
      if (Array.isArray(arg) && arg.length > 0 && arg[0].type) {
        return arg.map(sanitizeFinding).join(', ');
      }
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return arg;
}

/**
 * Logger utility for consistent, debug-gated logging
 */
export const Logger = {
  /**
   * Enable or disable debug logging. Default is OFF.
   * @param {boolean} enabled
   */
  setDebugEnabled(enabled) {
    debugEnabled = enabled === true;
  },

  /**
   * Configure the logger from extension settings.
   * Reads settings.behavior.debug (default false).
   * @param {Object} settings - Extension settings object
   */
  configure(settings) {
    this.setDebugEnabled(!!(settings && settings.behavior && settings.behavior.debug === true));
  },

  /**
   * Log a verbose diagnostic message — only when debug mode is enabled.
   * Even in debug mode, never pass raw prompt text; log lengths/counts/types.
   */
  debug: (msg, ...args) => {
    if (!debugEnabled) return;
    console.log('[PrivacyWall] ' + msg, ...args.map(stringify));
  },
  /**
   * Log informational message — only when debug mode is enabled.
   */
  info: (msg, ...args) => {
    if (!debugEnabled) return;
    console.log(`[PrivacyWall] ${msg}`, ...args.map(stringify));
  },

  /**
   * Log warning message — only when debug mode is enabled.
   */
  warn: (msg, ...args) => {
    if (!debugEnabled) return;
    console.warn(`[PrivacyWall] ${msg}`, ...args.map(stringify));
  },

  /**
   * Log error message — always logs, but finding values are redacted
   * unless debug mode is enabled.
   */
  error: (msg, ...args) => {
    console.error(`[PrivacyWall] ${msg}`, ...args.map(stringify));
  },
};

/**
 * Debounce function to limit how often a function can fire
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Cleanup manager for handling multiple cleanup tasks
 */
export class CleanupManager {
  constructor() {
    this.cleanupTasks = [];
  }

  /**
   * Register a cleanup task
   * @param {Function} task - Cleanup function to register
   */
  register(task) {
    this.cleanupTasks.push(task);
  }

  /**
   * Execute all registered cleanup tasks
   */
  execute() {
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        Logger.error('Cleanup task failed:', error);
      }
    });
    this.cleanupTasks = [];
  }
}
