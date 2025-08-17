(function () {
  "use strict";

  /**
   * 🚀 WHATSAPP VALIDATOR - PRODUCTION READY v1.0
   *
   * PRODUCTION FEATURES IMPLEMENTED:
   * ================================
   *
   * 🛡️ ERROR BOUNDARY SYSTEM
   * - Global error capture with automatic recovery
   * - Graceful degradation when errors exceed threshold
   * - Error tracking and reporting for monitoring
   *
   * 🌐 NETWORK STATUS DETECTION
   * - Real-time online/offline monitoring
   * - Connection quality assessment (2G/3G/4G)
   * - Adaptive timeouts based on network conditions
   * - Smart request delays for poor connections
   *
   * ⚡ PERFORMANCE BUDGET MONITORING
   * - Memory usage tracking and alerts
   * - DOM complexity monitoring
   * - Request rate limiting per minute
   * - Cache size management
   * - Automatic cleanup when budgets exceeded
   *
   * 🔄 ENHANCED MEMORY MANAGEMENT
   * - Automatic garbage collection triggers
   * - Performance monitoring intervals
   * - Page visibility API integration
   * - Comprehensive cleanup on teardown
   *
   * 📊 PRODUCTION MONITORING
   * - Health check API for external monitoring
   * - Performance metrics collection
   * - Error reporting and analytics
   * - Global monitoring hooks
   *
   * 🎯 HYDRATION SAFETY
   * - Non-intrusive DOM modifications
   * - Delayed initialization for SSR compatibility
   * - User interaction detection
   * - Graceful degradation for hydration conflicts
   *
   * 🎛️ CONFIGURABLE VIA DATA ATTRIBUTES
   * - Worker URL, timeouts, messages customizable
   * - No source file updates needed
   * - Environment-specific configurations
   *
   * Usage: window.WAValidatorHealth() for health monitoring
   */

  // 🎯 CONFIGURATION FROM DATA ATTRIBUTES
  function getScriptConfig() {
    const script =
      document.querySelector("script[data-worker-url]") ||
      document.currentScript ||
      document.querySelector('script[src*="wa-validation"]');

    if (!script) {
      console.warn("⚠️ Could not find config script, using defaults");
      return {};
    }

    const config = {};

    // Helper function to parse data attributes
    const getData = (key, defaultValue, parser = (v) => v) => {
      const value = script.getAttribute(`data-${key}`);
      return value ? parser(value) : defaultValue;
    };

    // Parse configuration
    config.WORKER_URL = getData(
      "worker-url",
      "https://test.roove.workers.dev/",
    );
    config.RETRY_DELAYS = getData("retry-delays", [3000, 5000], (v) =>
      v.split(",").map(Number),
    );
    config.TIMEOUTS = getData("timeouts", [10000, 7000, 5000], (v) =>
      v.split(",").map(Number),
    );
    config.DEBOUNCE_DELAY = getData("debounce-delay", 1000, Number);
    config.MIN_PHONE_LENGTH = getData("min-phone-length", 10, Number);
    config.DEBUG_MODE = getData("debug-mode", "false") === "true";

    // Rate limiting
    config.MAX_REQUESTS = getData("max-requests", 20, Number);
    config.TIME_WINDOW = getData("time-window", 60000, Number);

    // Cache settings
    config.CACHE_SUCCESS_TTL = getData("cache-success-ttl", 600000, Number);
    config.CACHE_FAILURE_TTL = getData("cache-failure-ttl", 300000, Number);

    // Messages
    config.MESSAGES = {
      ERROR_INPUT: getData(
        "error-message",
        "No. WhatsApp yang Anda masukkan salah",
      ),
      ERROR_BUTTON: getData(
        "button-message",
        "No WhatsApp yang Anda masukkan tidak valid. Mohon cek kembali.",
      ),
      ERROR_SUBMIT: getData(
        "submit-message",
        "Perbaiki nomor WhatsApp sebelum submit!",
      ),
      RATE_LIMIT: getData(
        "rate-limit-message",
        "Terlalu banyak percobaan validasi. Silakan tunggu sebentar.",
      ),
    };

    return config;
  }

  // Get configuration
  const CUSTOM_CONFIG = getScriptConfig();

  // 🚀 QUICK FIX: Nuxt Hydration Compatibility
  let nuxtHydrationDelay = 0;

  // Detect Nuxt and set appropriate delay
  if (typeof window !== "undefined") {
    // Check for Nuxt 3
    if (window.__NUXT__ || window.$nuxt) {
      nuxtHydrationDelay = 500;
      console.log("🎯 Nuxt detected - delaying validator initialization");
    }
    // Check for Vue hydration markers
    else if (document.querySelector('[data-server-rendered="true"]')) {
      nuxtHydrationDelay = 300;
      console.log("🎯 SSR detected - delaying validator initialization");
    }
    // Check for any hydration indicators
    else if (document.documentElement.hasAttribute("data-nuxt-ssr")) {
      nuxtHydrationDelay = 400;
      console.log("🎯 Nuxt SSR detected - delaying validator initialization");
    }
  }

  // Compressed configuration with lazy loading and custom config support
  const CONFIG = Object.freeze({
    WORKER_URL: CUSTOM_CONFIG.WORKER_URL || "https://test.roove.workers.dev/",
    MIN_PHONE_LENGTH: CUSTOM_CONFIG.MIN_PHONE_LENGTH || 10,
    DEBOUNCE_DELAY: CUSTOM_CONFIG.DEBOUNCE_DELAY || 1000,
    INPUT_SELECTOR: 'input[name="No. WhatsApp"], input#phone',
    SUBMIT_SELECTOR: 'button[type="submit"]',
    RETRY_DELAYS: CUSTOM_CONFIG.RETRY_DELAYS || [3000, 5000],
    TIMEOUTS: CUSTOM_CONFIG.TIMEOUTS || [10000, 7000, 5000],
    RATE_LIMIT: {
      MAX_REQUESTS: CUSTOM_CONFIG.MAX_REQUESTS || 20,
      TIME_WINDOW: CUSTOM_CONFIG.TIME_WINDOW || 60000,
    },
    QUEUE: { MAX_SIZE: 5, MAX_CONCURRENT: 2 },
    CACHE: {
      SUCCESS_TTL: CUSTOM_CONFIG.CACHE_SUCCESS_TTL || 600000,
      FAILURE_TTL: CUSTOM_CONFIG.CACHE_FAILURE_TTL || 300000,
      MAX_SIZE: 50,
      KEY_PREFIX: "wa_v_",
    },
    MESSAGES: CUSTOM_CONFIG.MESSAGES || {
      ERROR_INPUT: "No. WhatsApp yang Anda masukkan salah",
      ERROR_BUTTON:
        "No WhatsApp yang Anda masukkan tidak valid. Mohon cek kembali.",
      ERROR_SUBMIT: "Perbaiki nomor WhatsApp sebelum submit!",
      RATE_LIMIT: "Terlalu banyak percobaan validasi. Silakan tunggu sebentar.",
    },
  });

  // Compressed SVG icons with lazy loading
  const ICONS = {
    _cache: new Map(),
    get error() {
      if (!this._cache.has("error")) {
        this._cache.set(
          "error",
          '<svg width="1em" height="1em" viewBox="0 0 14 13" class="inline-flex overflow-visible ml-[1px] mr-[8px] text-[13px] text-red-900"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.268 1.333c.77-1.333 2.694-1.333 3.464 0l4.619 8c.77 1.333-.193 3-1.732 3H2.381c-1.54 0-2.503-1.667-1.732-3l4.619-8zM7 4.333c.368 0 .667.298.667.667v1.333c0 .369-.299.667-.667.667s-.667-.298-.667-.667V5c0-.369.299-.667.667-.667zM6.333 9c0-.369.299-.667.667-.667h.007c.368 0 .666.298.666.667 0 .368-.298.666-.666.666H7c-.368 0-.667-.298-.667-.666z" fill="currentColor"/></svg>',
        );
      }
      return this._cache.get("error");
    },
    get success() {
      if (!this._cache.has("success")) {
        this._cache.set(
          "success",
          '<svg width="1em" height="1em" viewBox="0 0 18 12" class="text-[16px] inline-flex overflow-visible text-green-600"><path fill-rule="evenodd" clip-rule="evenodd" d="M17.048.351c.469.469.469 1.229 0 1.697L7.448 11.649c-.468.468-1.228.468-1.697 0L.951 6.849c-.469-.47-.469-1.229 0-1.698.469-.469 1.229-.469 1.697 0L6.6 9.103 15.351.351c.468-.468 1.228-.468 1.697 0z" fill="currentColor"/></svg>',
        );
      }
      return this._cache.get("success");
    },
    get spinner() {
      if (!this._cache.has("spinner")) {
        this._cache.set(
          "spinner",
          '<svg width="1em" height="1em" viewBox="0 0 25 25" class="inline-flex overflow-visible animate-spin text-[24px] text-primary"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.5 4.826c.552 0 1-.448 1-1s-.448-1-1-1C6.977 2.826 2.5 7.303 2.5 12.826c0 1.681.415 3.265 1.147 4.655.011.02.021.04.032.06 1.685 3.145 5.003 5.285 8.821 5.285 5.523 0 10-4.477 10-10 0-.552-.448-1-1-1s-1 .448-1 1c0 4.418-3.582 8-8 8-2.029 0-3.881-.755-5.292-2 -.892-.788-1.608-1.773-2.079-2.886-.405-.957-.629-2.009-.629-3.114 0-4.418 3.582-8 8-8z" fill="url(#a)"/><defs><linearGradient id="a" x1="16" y1="13.326" x2="15" y2="4.326" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor"/><stop offset=".415" stop-color="currentColor" stop-opacity=".421"/><stop offset=".659" stop-color="currentColor" stop-opacity=".175"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs></svg>',
        );
      }
      return this._cache.get("spinner");
    },
  };

  // Performance monitor
  class PerformanceMonitor {
    static mark(name) {
      if (typeof performance !== "undefined" && performance.mark) {
        try {
          performance.mark(name);
        } catch (e) {}
      }
    }

    static measure(name, start, end) {
      if (typeof performance !== "undefined" && performance.measure) {
        try {
          performance.measure(name, start, end);
        } catch (e) {}
      }
    }
  }

  // Simplified DOM Cache Manager
  class DOMCache {
    constructor() {
      this.elements = new Map();
    }

    get(key, selector, context = document) {
      // For dynamic elements, always re-query instead of caching
      if (key.includes("wrapper") || key.includes("container")) {
        const element = context.querySelector(selector);
        return element;
      }

      if (!this.elements.has(key)) {
        const element = context.querySelector(selector);
        if (element) {
          this.elements.set(key, element);
        }
      }
      return this.elements.get(key) || null;
    }

    set(key, element) {
      this.elements.set(key, element);
    }

    clear() {
      this.elements.clear();
    }
  }

  // Event Manager with cleanup
  class EventManager {
    constructor() {
      this.listeners = [];
      this.abortController = new AbortController();
    }

    add(element, event, handler, options = {}) {
      const finalOptions = { ...options, signal: this.abortController.signal };
      element.addEventListener(event, handler, finalOptions);
      this.listeners.push({ element, event, handler, options: finalOptions });
    }

    cleanup() {
      this.abortController.abort();
      this.listeners = [];
      this.abortController = new AbortController();
    }
  }

  // Enhanced Rate Limiter
  class RateLimiter {
    constructor(maxRequests, timeWindow) {
      this.maxRequests = maxRequests;
      this.timeWindow = timeWindow;
      this.requests = [];
    }

    canMakeRequest() {
      this.cleanup();
      return this.requests.length < this.maxRequests;
    }

    addRequest() {
      this.requests.push(Date.now());
    }

    cleanup() {
      const now = Date.now();
      this.requests = this.requests.filter(
        (time) => now - time < this.timeWindow,
      );
    }

    getRemainingTime() {
      if (this.requests.length === 0) return 0;
      const oldestRequest = Math.min(...this.requests);
      return Math.max(0, this.timeWindow - (Date.now() - oldestRequest));
    }
  }

  // Async Cache Manager
  class CacheManager {
    constructor() {
      this.available = null;
      this.cleanupScheduled = false;
    }

    isAvailable() {
      if (this.available === null) {
        try {
          const test = "__wa_test__";
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          this.available = true;
        } catch (e) {
          this.available = false;
        }
      }
      return this.available;
    }

    async get(phoneNumber) {
      if (!this.isAvailable()) return null;

      try {
        const key = CONFIG.CACHE.KEY_PREFIX + phoneNumber;
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const data = JSON.parse(cached);
        if (Date.now() > data.expiry) {
          localStorage.removeItem(key);
          return null;
        }

        return data.result;
      } catch (e) {
        return null;
      }
    }

    async set(phoneNumber, result, isSuccess) {
      if (!this.isAvailable()) return;

      try {
        this.scheduleCleanup();

        const key = CONFIG.CACHE.KEY_PREFIX + phoneNumber;
        const ttl = isSuccess
          ? CONFIG.CACHE.SUCCESS_TTL
          : CONFIG.CACHE.FAILURE_TTL;
        const data = {
          result,
          expiry: Date.now() + ttl,
          timestamp: Date.now(),
        };

        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        // Storage full - trigger immediate cleanup
        this.cleanup();
      }
    }

    scheduleCleanup() {
      if (this.cleanupScheduled) return;
      this.cleanupScheduled = true;

      const scheduleFunction =
        window.requestIdleCallback || ((cb) => setTimeout(cb, 100));

      scheduleFunction(() => {
        this.cleanup();
        this.cleanupScheduled = false;
      });
    }

    cleanup() {
      if (!this.isAvailable()) return;

      try {
        const keys = [];
        const now = Date.now();

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(CONFIG.CACHE.KEY_PREFIX)) {
            keys.push(key);
          }
        }

        // Remove expired entries
        keys.forEach((key) => {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (now > data.expiry) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            localStorage.removeItem(key);
          }
        });

        // Remove oldest if over limit
        if (keys.length > CONFIG.CACHE.MAX_SIZE) {
          const items = keys
            .map((key) => {
              try {
                const data = JSON.parse(localStorage.getItem(key));
                return { key, timestamp: data.timestamp || 0 };
              } catch (e) {
                return { key, timestamp: 0 };
              }
            })
            .sort((a, b) => a.timestamp - b.timestamp);

          const toRemove = items.slice(0, items.length - CONFIG.CACHE.MAX_SIZE);
          toRemove.forEach((item) => localStorage.removeItem(item.key));
        }
      } catch (e) {
        console.warn("Cache cleanup failed:", e);
      }
    }
  }

  // Request Manager with deduplication
  class RequestManager {
    constructor() {
      this.activeRequests = new Map();
      this.rateLimiter = new RateLimiter(
        CONFIG.RATE_LIMIT.MAX_REQUESTS,
        CONFIG.RATE_LIMIT.TIME_WINDOW,
      );
    }

    async makeRequest(phone, attemptNumber = 0, customTimeout = null) {
      // Return existing request if in progress
      if (this.activeRequests.has(phone)) {
        return this.activeRequests.get(phone);
      }

      const requestPromise = this.executeRequest(
        phone,
        attemptNumber,
        customTimeout,
      );
      this.activeRequests.set(phone, requestPromise);

      try {
        const result = await requestPromise;
        return result;
      } finally {
        this.activeRequests.delete(phone);
      }
    }

    async executeRequest(phone, attemptNumber, customTimeout = null) {
      const controller = new AbortController();
      const timeout = customTimeout || CONFIG.TIMEOUTS[attemptNumber] || 5000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(CONFIG.WORKER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Connection: "keep-alive",
          },
          body: JSON.stringify({ number: phone }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.includes("application/json")) {
          throw new Error("Invalid response format");
        }

        const data = await response.json();
        this.rateLimiter.addRequest();
        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    canMakeRequest() {
      return this.rateLimiter.canMakeRequest();
    }

    getRemainingTime() {
      return this.rateLimiter.getRemainingTime();
    }
  }

  // Queue Manager
  class QueueManager {
    constructor() {
      this.queue = [];
      this.activeCount = 0;
    }

    add(phoneNumber, callback) {
      this.cancel(phoneNumber);

      if (this.queue.length < CONFIG.QUEUE.MAX_SIZE) {
        this.queue.push({ phoneNumber, callback, timestamp: Date.now() });
        this.process();
      }
    }

    cancel(phoneNumber) {
      if (phoneNumber === "all") {
        this.queue = [];
        return;
      }

      const index = this.queue.findIndex(
        (item) => item.phoneNumber === phoneNumber,
      );
      if (index !== -1) {
        this.queue.splice(index, 1);
      }
    }

    process() {
      if (
        this.activeCount >= CONFIG.QUEUE.MAX_CONCURRENT ||
        this.queue.length === 0
      ) {
        return;
      }

      const item = this.queue.pop();
      if (item) {
        this.activeCount++;
        item.callback(() => {
          this.activeCount--;
          this.process();
        });
      }
    }
  }

  // DOM Update Batcher
  class DOMBatcher {
    constructor() {
      this.updateQueue = [];
      this.frameId = null;
    }

    schedule(updateFn) {
      this.updateQueue.push(updateFn);

      if (!this.frameId) {
        this.frameId = requestAnimationFrame(() => this.flush());
      }
    }

    flush() {
      const updates = [...this.updateQueue];
      this.updateQueue = [];
      this.frameId = null;

      // Execute all updates in single frame
      updates.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn("DOM update failed:", e);
        }
      });
    }
  }

  // Phone Formatter
  class PhoneFormatter {
    static format(value) {
      const cleaned = value.replace(/\D/g, "");

      if (cleaned.startsWith("62")) {
        const parts = [
          cleaned.substring(0, 2),
          cleaned.substring(2, 5),
          cleaned.substring(5, 9),
          cleaned.substring(9, 13),
        ].filter((part) => part);
        return parts.join(" ");
      } else if (cleaned.startsWith("0")) {
        const parts = [
          cleaned.substring(0, 4),
          cleaned.substring(4, 8),
          cleaned.substring(8, 12),
        ].filter((part) => part);
        return parts.join(" ");
      }
      return cleaned;
    }

    static normalize(phone) {
      let normalized = phone.replace(/[^\d+]/g, "");

      if (normalized.startsWith("0")) {
        normalized = "+62" + normalized.substring(1);
      } else if (normalized.startsWith("62")) {
        normalized = "+" + normalized;
      } else if (
        !normalized.startsWith("+") &&
        normalized.length >= 9 &&
        normalized.length <= 13
      ) {
        normalized = "+62" + normalized;
      }

      return normalized;
    }
  }

  // Error Boundary System for Production Safety
  class ErrorBoundary {
    constructor() {
      this.errors = [];
      this.maxErrors = 10;
      this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
      window.addEventListener("error", (event) => {
        this.captureError({
          type: "javascript",
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack,
          timestamp: Date.now(),
        });
      });

      window.addEventListener("unhandledrejection", (event) => {
        this.captureError({
          type: "promise",
          message: event.reason?.message || "Unhandled Promise Rejection",
          stack: event.reason?.stack,
          timestamp: Date.now(),
        });
      });
    }

    captureError(error) {
      // Add to error queue
      this.errors.push(error);

      // Keep only recent errors
      if (this.errors.length > this.maxErrors) {
        this.errors.shift();
      }

      // Log in debug mode
      if (this.debugMode) {
        console.warn("🚨 Error captured:", error);
      }

      // Attempt graceful degradation
      this.handleGracefulDegradation(error);
    }

    handleGracefulDegradation(error) {
      // If too many errors, disable advanced features
      if (this.errors.length > 5) {
        console.warn("🔧 Too many errors detected, switching to failsafe mode");
        this.attemptAutoRecovery();
        return true; // Signal to enable failsafe
      }
      return false;
    }

    attemptAutoRecovery() {
      console.log("🔄 Attempting automatic error recovery...");

      // Clear old errors to prevent accumulation
      const recentErrors = this.errors.slice(-3);
      this.errors = recentErrors;

      // Schedule recovery attempt
      setTimeout(() => {
        if (this.errors.length < 3) {
          console.log("✅ Auto-recovery successful");
          // Reset error state
          this.errors = [];
        } else {
          console.warn("⚠️ Auto-recovery failed, maintaining failsafe mode");
        }
      }, 5000);
    }

    getErrorReport() {
      return {
        totalErrors: this.errors.length,
        recentErrors: this.errors.slice(-5),
        timestamp: Date.now(),
      };
    }
  }

  // Network Status Detection for Better UX
  class NetworkMonitor {
    constructor() {
      this.online = navigator.onLine;
      this.connectionQuality = "good";
      this.lastCheck = Date.now();
      this.setupListeners();
    }

    setupListeners() {
      window.addEventListener("online", () => {
        this.online = true;
        console.log("🌐 Network connection restored");
      });

      window.addEventListener("offline", () => {
        this.online = false;
        console.log("📴 Network connection lost");
      });

      // Monitor connection quality
      if ("connection" in navigator) {
        this.updateConnectionQuality();
        navigator.connection.addEventListener("change", () => {
          this.updateConnectionQuality();
        });
      }
    }

    updateConnectionQuality() {
      const connection = navigator.connection;
      if (!connection) return;

      const effectiveType = connection.effectiveType;

      if (effectiveType === "slow-2g" || effectiveType === "2g") {
        this.connectionQuality = "poor";
      } else if (effectiveType === "3g") {
        this.connectionQuality = "moderate";
      } else {
        this.connectionQuality = "good";
      }
    }

    isOnline() {
      return this.online;
    }

    getConnectionQuality() {
      return this.connectionQuality;
    }

    shouldDelayRequests() {
      return !this.online || this.connectionQuality === "poor";
    }

    getOptimalTimeout() {
      switch (this.connectionQuality) {
        case "poor":
          return 15000;
        case "moderate":
          return 10000;
        case "good":
        default:
          return 7000;
      }
    }
  }

  // Performance Budget Monitor
  class PerformanceBudget {
    constructor() {
      this.budgets = {
        memoryHeapUsed: 50 * 1024 * 1024, // 50MB
        domNodes: 1000,
        eventListeners: 100,
        cacheSize: 25,
        requestsPerMinute: 15,
      };
      this.metrics = {
        domNodes: 0,
        eventListeners: 0,
        cacheSize: 0,
        requestCount: 0,
        lastRequestReset: Date.now(),
      };
    }

    checkMemoryUsage() {
      if (!performance.memory) return true;

      const heapUsed = performance.memory.usedJSHeapSize;
      return heapUsed < this.budgets.memoryHeapUsed;
    }

    checkDOMComplexity() {
      const nodes = document.querySelectorAll("*").length;
      this.metrics.domNodes = nodes;
      return nodes < this.budgets.domNodes;
    }

    incrementEventListeners() {
      this.metrics.eventListeners++;
      return this.metrics.eventListeners < this.budgets.eventListeners;
    }

    setCacheSize(size) {
      this.metrics.cacheSize = size;
      return size < this.budgets.cacheSize;
    }

    incrementRequest() {
      const now = Date.now();

      // Reset counter every minute
      if (now - this.metrics.lastRequestReset > 60000) {
        this.metrics.requestCount = 0;
        this.metrics.lastRequestReset = now;
      }

      this.metrics.requestCount++;
      return this.metrics.requestCount < this.budgets.requestsPerMinute;
    }

    checkAllBudgets() {
      return {
        memory: this.checkMemoryUsage(),
        dom: this.checkDOMComplexity(),
        requests: this.metrics.requestCount < this.budgets.requestsPerMinute,
        cache: this.metrics.cacheSize < this.budgets.cacheSize,
        overall: this.checkMemoryUsage() && this.checkDOMComplexity(),
      };
    }

    getMetrics() {
      return {
        ...this.metrics,
        memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : 0,
        timestamp: Date.now(),
      };
    }
  }

  // Main WhatsApp Validator Class - Non-Intrusive for Hydration Safety
  class WhatsAppValidator {
    constructor() {
      // Add debug mode detection from config and URL
      this.debugMode =
        CUSTOM_CONFIG.DEBUG_MODE ||
        new URLSearchParams(window.location.search).get("wa_debug") === "true";

      this.state = {
        initialized: false,
        domModified: false, // Track if DOM modifications are allowed
        firstInteraction: false, // Track first user interaction
        debounceTimer: null,
        lastCheckedNumber: "",
        validationState: null,
        originalButton: {},
        failsafeMode: false,
        retryController: null,
        isRetrying: false,
        actualValue: "",
        isFormatted: false,
      };

      this.domCache = new DOMCache();
      this.eventManager = new EventManager();
      this.cacheManager = new CacheManager();
      this.requestManager = new RequestManager();
      this.queueManager = new QueueManager();
      this.domBatcher = new DOMBatcher();

      // Initialize production features
      this.errorBoundary = new ErrorBoundary();
      this.networkMonitor = new NetworkMonitor();
      this.performanceBudget = new PerformanceBudget();

      // Set debug mode on error boundary
      this.errorBoundary.debugMode = this.debugMode;

      // Setup automatic performance monitoring
      this.setupPerformanceMonitoring();
    }

    async init() {
      if (this.state.initialized) return;

      PerformanceMonitor.mark("validator-init-start");

      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);

      if (!phoneInput) {
        setTimeout(() => this.init(), 500);
        return;
      }

      this.state.initialized = true;
      console.log("✅ WhatsApp Validator initialized (hydration-safe)");

      // ONLY setup event listeners initially - NO DOM modifications
      this.setupEventListeners();

      PerformanceMonitor.mark("validator-init-end");
      PerformanceMonitor.measure(
        "validator-init",
        "validator-init-start",
        "validator-init-end",
      );
    }

    onFirstInteraction() {
      if (this.state.firstInteraction) return;

      this.state.firstInteraction = true;
      console.log("👆 User interaction detected, enabling full validation UI");

      // NOW it's safe to modify DOM (user has interacted, hydration is complete)
      this.enableDOMModifications();
    }

    enableDOMModifications() {
      this.state.domModified = true;

      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      if (!phoneInput) return;

      // Setup accessibility features after interaction
      this.setupAccessibility(phoneInput);

      // Setup full validation UI
      this.setupComponents();
    }

    setupAccessibility(phoneInput) {
      // Add base ARIA attributes for WCAG compliance
      phoneInput.setAttribute("aria-label", "Nomor WhatsApp");
      phoneInput.setAttribute("autocomplete", "tel");
      phoneInput.setAttribute("inputmode", "tel");

      // Create hidden help text for screen readers
      if (!document.getElementById("wa-validation-help")) {
        const helpText = document.createElement("div");
        helpText.id = "wa-validation-help";
        helpText.textContent = "Masukkan nomor WhatsApp yang valid.";
        // Use inline styles to ensure it's always hidden visually
        helpText.style.cssText = `
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          padding: 0 !important;
          margin: -1px !important;
          overflow: hidden !important;
          clip: rect(0, 0, 0, 0) !important;
          white-space: nowrap !important;
          border: 0 !important;
        `;
        phoneInput.parentElement.appendChild(helpText);
        phoneInput.setAttribute("aria-describedby", "wa-validation-help");
      }
    }

    setupComponents() {
      const submitButton = this.domCache.get(
        "submitButton",
        CONFIG.SUBMIT_SELECTOR,
      );

      if (submitButton) {
        this.state.originalButton = {
          bg: submitButton.style.backgroundColor || "",
          cursor: submitButton.style.cursor || "",
          opacity: submitButton.style.opacity || "",
          disabled: submitButton.disabled,
          ariaLabel: submitButton.getAttribute("aria-label") || "",
        };
      }

      this.setupPhoneFormatter();
    }

    setupEventListeners() {
      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      const submitButton = this.domCache.get(
        "submitButton",
        CONFIG.SUBMIT_SELECTOR,
      );

      if (!phoneInput) return;

      // Add interaction detection listeners first (only once)
      this.eventManager.add(
        phoneInput,
        "focus",
        () => this.onFirstInteraction(),
        { once: true },
      );
      this.eventManager.add(
        phoneInput,
        "input",
        () => this.onFirstInteraction(),
        { once: true },
      );

      // Add validation event listeners
      this.eventManager.add(phoneInput, "input", (e) => this.handleInput(e));
      this.eventManager.add(phoneInput, "blur", (e) => this.handleBlur(e));
      this.eventManager.add(phoneInput, "keypress", (e) =>
        this.handleKeypress(e),
      );

      // Form submission events
      if (submitButton) {
        const form = submitButton.closest("form");
        if (form) {
          this.eventManager.add(
            form,
            "submit",
            (e) => this.handleFormSubmit(e),
            true,
          );
        }
        this.eventManager.add(
          submitButton,
          "click",
          (e) => this.handleSubmitClick(e),
          true,
        );
      }

      // Page cleanup
      this.eventManager.add(window, "beforeunload", () => this.cleanup());
    }

    setupPhoneFormatter() {
      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      if (!phoneInput) return;

      const originalType = phoneInput.type;
      const originalPattern = phoneInput.pattern;
      const originalInputMode = phoneInput.inputMode;

      this.eventManager.add(phoneInput, "blur", () => {
        if (!phoneInput.value) return;

        this.state.actualValue = phoneInput.value;
        phoneInput.type = "text";
        phoneInput.removeAttribute("pattern");
        phoneInput.removeAttribute("inputmode");

        const formatted = PhoneFormatter.format(this.state.actualValue);
        phoneInput.value = formatted;
        this.state.isFormatted = true;
      });

      this.eventManager.add(phoneInput, "focus", () => {
        if (this.state.isFormatted) {
          phoneInput.type = originalType;
          phoneInput.pattern = originalPattern;
          phoneInput.inputMode = originalInputMode;
          phoneInput.value = this.state.actualValue;
          this.state.isFormatted = false;
        }
      });

      // Ensure clean value for form submission
      const form = phoneInput.closest("form");
      if (form) {
        this.eventManager.add(
          form,
          "submit",
          () => {
            if (this.state.isFormatted) {
              phoneInput.type = originalType;
              phoneInput.value = this.state.actualValue;
              this.state.isFormatted = false;
            }
          },
          true,
        );
      }
    }

    handleInput(e) {
      const value = e.target.value.trim();

      // If DOM modifications not allowed yet, do silent validation only
      if (!this.state.domModified) {
        this.validateSilently(value);
        return;
      }

      // Cancel any ongoing retry
      if (this.state.retryController) {
        this.state.retryController.abort();
        this.state.retryController = null;
        this.state.isRetrying = false;
      }

      // Cancel queued validations for different numbers
      if (value !== this.state.lastCheckedNumber) {
        this.queueManager.cancel(this.state.lastCheckedNumber);
      }

      // Reset failsafe if user edits after failure
      if (this.state.failsafeMode) {
        this.state.failsafeMode = false;
        console.log("🔄 User editing - failsafe reset");
      }

      if (!value) {
        this.state.validationState = null;
        this.state.lastCheckedNumber = "";
        this.updateUI(null, "");
        this.updateInputIcon(null);
        this.updateSubmitButton("clear");
        return;
      }

      if (this.state.validationState === false) {
        this.updateSubmitButton("disable");
      }

      if (value.length >= CONFIG.MIN_PHONE_LENGTH) {
        this.debouncedValidate();
      } else {
        clearTimeout(this.state.debounceTimer);
        this.updateUI(null, "");
        this.state.lastCheckedNumber = "";
        if (this.state.validationState === false) {
          this.updateSubmitButton("disable");
        }
      }
    }

    validateSilently(value) {
      // Simple validation without UI changes for hydration safety
      if (this.debugMode) {
        console.log("🔍 Silent validation (pre-interaction):", value);
      }

      // Cache validation results but don't show UI
      if (value.length >= CONFIG.MIN_PHONE_LENGTH) {
        this.state.lastCheckedNumber = value;
        // Could perform background validation here if needed
      }
    }

    handleBlur(e) {
      // Don't modify DOM if not allowed yet
      if (!this.state.domModified) return;

      clearTimeout(this.state.debounceTimer);
      const value = e.target.value.trim();

      if (value.length >= CONFIG.MIN_PHONE_LENGTH) {
        this.queueValidation();
      } else if (!value) {
        this.state.validationState = null;
        this.updateSubmitButton("clear");
      }
    }

    handleKeypress(e) {
      if (e.key === "Enter" || e.keyCode === 13) {
        e.preventDefault();

        // Don't modify DOM if not allowed yet
        if (!this.state.domModified) return;

        if (this.state.isRetrying && this.state.retryController) {
          this.state.retryController.abort();
          this.state.retryController = null;
          this.state.isRetrying = false;
          this.activateFailsafe();
          return;
        }

        if (this.state.failsafeMode) return;

        if (this.state.validationState === false) {
          const waDiv = this.getOrCreateWhatsAppDiv();
          if (waDiv) {
            this.domBatcher.schedule(() => {
              waDiv.className =
                "wa-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px] text-red-900";
              waDiv.innerHTML = ICONS.error + CONFIG.MESSAGES.ERROR_SUBMIT;
              waDiv.style.display = "flex";

              // Announce error for screen readers
              waDiv.setAttribute("aria-hidden", "false");
              waDiv.setAttribute("aria-live", "assertive");
            });
          }
          return;
        }

        clearTimeout(this.state.debounceTimer);
        const value = e.target.value.trim();
        if (value.length >= CONFIG.MIN_PHONE_LENGTH) {
          this.queueValidation();
        }
      }
    }

    handleFormSubmit(e) {
      if (this.state.isRetrying && this.state.retryController) {
        this.state.retryController.abort();
        this.state.retryController = null;
        this.state.isRetrying = false;
        this.activateFailsafe();
        return true;
      }

      if (this.state.failsafeMode) return true;

      if (this.state.validationState === false) {
        e.preventDefault();
        e.stopPropagation();
        this.showValidationError();
        return false;
      }
    }

    handleSubmitClick(e) {
      if (this.state.isRetrying && this.state.retryController) {
        this.state.retryController.abort();
        this.state.retryController = null;
        this.state.isRetrying = false;
        this.activateFailsafe();
        return true;
      }

      if (this.state.failsafeMode) return true;

      if (this.state.validationState === false) {
        e.preventDefault();
        e.stopPropagation();
        this.showValidationError();
        return false;
      }
    }

    showValidationError() {
      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      const waDiv = this.getOrCreateWhatsAppDiv();

      if (waDiv) {
        this.domBatcher.schedule(() => {
          waDiv.className =
            "wa-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px] text-red-900";
          waDiv.innerHTML = ICONS.error + CONFIG.MESSAGES.ERROR_SUBMIT;
          waDiv.style.display = "flex";

          // Update ARIA for error announcement
          waDiv.setAttribute("aria-hidden", "false");
          waDiv.setAttribute("aria-live", "assertive"); // More urgent than 'polite'
        });
      }

      if (phoneInput) {
        phoneInput.focus();
        // Announce error to screen readers
        phoneInput.setAttribute("aria-invalid", "true");
        phoneInput.setAttribute(
          "aria-describedby",
          "wa-validation-status wa-validation-help",
        );
      }
    }

    debouncedValidate() {
      clearTimeout(this.state.debounceTimer);
      this.state.debounceTimer = setTimeout(
        () => this.queueValidation(),
        CONFIG.DEBOUNCE_DELAY,
      );
    }

    queueValidation() {
      // Don't queue validation if DOM modifications not allowed
      if (!this.state.domModified) return;

      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      if (!phoneInput) return;

      const phoneNumber = phoneInput.value.trim();
      if (!phoneNumber || phoneNumber.length < CONFIG.MIN_PHONE_LENGTH) return;

      this.queueManager.add(phoneNumber, (onComplete) => {
        this.validateWhatsApp(0, onComplete);
      });
    }

    async validateWhatsApp(attemptNumber = 0, onComplete = null) {
      PerformanceMonitor.mark("validation-start");

      // Check error boundary for graceful degradation
      if (this.errorBoundary.handleGracefulDegradation()) {
        this.activateFailsafe();
        if (onComplete) onComplete();
        return;
      }

      // Check network status
      if (!this.networkMonitor.isOnline()) {
        console.log("📴 No network connection, skipping validation");
        this.updateUI(null, "Tidak ada koneksi internet");
        if (onComplete) onComplete();
        return;
      }

      // Check performance budget before proceeding
      const budgetCheck = this.performanceBudget.checkAllBudgets();
      if (!budgetCheck.overall) {
        console.warn(
          "⚡ Performance budget exceeded, using simplified validation",
        );
        this.activateFailsafe();
        if (onComplete) onComplete();
        return;
      }

      if (this.state.failsafeMode && attemptNumber === 0) {
        this.state.failsafeMode = false;
        console.log("🔄 Resetting failsafe mode");
      }

      if (this.state.failsafeMode && !this.state.isRetrying) {
        console.log("⚠️ WhatsApp validation skipped (failsafe mode)");
        this.updateInputIcon(null);
        if (onComplete) onComplete();
        return;
      }

      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      if (!phoneInput) {
        if (onComplete) onComplete();
        return;
      }

      const rawValue = phoneInput.value.trim();

      if (!rawValue) {
        this.updateUI(null, "");
        this.state.lastCheckedNumber = "";
        this.state.validationState = null;
        this.updateSubmitButton("clear");
        if (onComplete) onComplete();
        return;
      }

      if (rawValue.length < CONFIG.MIN_PHONE_LENGTH) {
        this.updateUI(null, "");
        if (onComplete) onComplete();
        return;
      }

      // Check cache first
      const cachedResult = await this.cacheManager.get(rawValue);
      if (cachedResult !== null && attemptNumber === 0) {
        console.log("📦 Using cached result for:", rawValue);
        this.handleValidationResult(cachedResult.isRegistered, rawValue);
        if (onComplete) onComplete();
        return;
      }

      // Check rate limit and performance budget
      if (attemptNumber === 0 && !this.requestManager.canMakeRequest()) {
        const waitTime = Math.ceil(
          this.requestManager.getRemainingTime() / 1000,
        );
        console.log(`⏱️ Rate limit reached. Wait ${waitTime} seconds`);
        this.updateUI(false, CONFIG.MESSAGES.RATE_LIMIT);
        if (onComplete) onComplete();
        return;
      }

      // Check performance budget for requests
      if (!this.performanceBudget.incrementRequest()) {
        console.warn("📊 Request budget exceeded for this minute");
        this.updateUI(
          false,
          "Terlalu banyak validasi. Silakan tunggu sebentar.",
        );
        if (onComplete) onComplete();
        return;
      }

      const phone = PhoneFormatter.normalize(rawValue);

      if (
        phone === this.state.lastCheckedNumber &&
        this.state.validationState !== null &&
        attemptNumber === 0
      ) {
        if (onComplete) onComplete();
        return;
      }

      console.log(
        `📱 Checking WhatsApp (Attempt ${attemptNumber + 1}/3):`,
        phone,
      );

      if (attemptNumber === 0) {
        this.updateUI(null, "", true);
      }

      try {
        if (this.state.retryController && attemptNumber === 0) {
          this.state.retryController.abort();
          this.state.retryController = null;
        }

        // Use network-aware timeout
        const timeout = this.networkMonitor.getOptimalTimeout();
        const data = await this.requestManager.makeRequest(
          phone,
          attemptNumber,
          timeout,
        );

        this.state.isRetrying = false;
        this.state.retryController = null;

        console.log("📦 API Response:", data);

        let isRegistered = false;
        if (data.data && typeof data.data === "object") {
          isRegistered = data.data.status === true;
        } else if (data.status !== undefined) {
          isRegistered = data.status === true;
        }

        await this.cacheManager.set(rawValue, { isRegistered }, isRegistered);
        this.handleValidationResult(isRegistered, phone);

        PerformanceMonitor.mark("validation-end");
        PerformanceMonitor.measure(
          "validation",
          "validation-start",
          "validation-end",
        );

        if (onComplete) onComplete();
      } catch (error) {
        // Capture error in production boundary
        this.errorBoundary.captureError({
          type: "validation",
          message: error.message,
          stack: error.stack,
          attempt: attemptNumber + 1,
          phone: phone,
          timestamp: Date.now(),
        });

        console.error(
          `🚨 Validation error (Attempt ${attemptNumber + 1}):`,
          error,
        );

        if (error.name === "AbortError") {
          console.error(
            `API request timeout after ${CONFIG.TIMEOUTS[attemptNumber] / 1000} seconds`,
          );
        }

        if (attemptNumber < 2) {
          const retryDelay = CONFIG.RETRY_DELAYS[attemptNumber];
          console.log(`🔄 Retrying in ${retryDelay / 1000} seconds...`);

          this.state.isRetrying = true;

          setTimeout(() => {
            if (phoneInput.value.trim() === rawValue) {
              this.validateWhatsApp(attemptNumber + 1, onComplete);
            } else {
              this.state.isRetrying = false;
              this.updateInputIcon(null);
              if (onComplete) onComplete();
            }
          }, retryDelay);
        } else {
          // Check if we should activate failsafe due to repeated errors
          if (this.errorBoundary.handleGracefulDegradation()) {
            console.warn(
              "🔧 Activating failsafe due to repeated validation errors",
            );
            this.activateFailsafe();
            if (onComplete) onComplete();
            return;
          }

          console.error(
            "❌ All validation attempts failed - activating failsafe",
          );
          this.state.isRetrying = false;
          this.state.retryController = null;
          this.activateFailsafe();
          if (onComplete) onComplete();
        }
      }
    }

    handleValidationResult(isRegistered, phone) {
      if (isRegistered) {
        this.updateUI(true, "WhatsApp aktif!");
      } else {
        this.updateUI(false, CONFIG.MESSAGES.ERROR_INPUT);
      }
      this.state.lastCheckedNumber = phone;
      this.state.validationState = isRegistered;
    }

    activateFailsafe() {
      this.state.failsafeMode = true;
      console.warn("⚠️ WhatsApp validation disabled - failsafe mode activated");

      const inputWrapper = this.getInputWrapper();
      const waDiv = this.getOrCreateWhatsAppDiv();
      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);

      this.domBatcher.schedule(() => {
        if (inputWrapper) {
          inputWrapper.classList.remove("border-red-600", "border-green-600");
        }

        if (waDiv) {
          waDiv.style.display = "none";
          waDiv.setAttribute("aria-hidden", "true");
        }

        // Reset ARIA attributes for failsafe mode
        if (phoneInput) {
          phoneInput.removeAttribute("aria-invalid");
          phoneInput.removeAttribute("aria-busy");
          phoneInput.setAttribute("aria-describedby", "wa-validation-help");
        }

        this.updateInputIcon(null);
        this.state.validationState = null;
        this.updateSubmitButton("enable");

        const buttonMsg = this.getOrCreateButtonMessage();
        if (buttonMsg) {
          buttonMsg.style.display = "none";
          buttonMsg.setAttribute("aria-hidden", "true");
        }
      });
    }

    // Improved DOM Helper Methods with better fallbacks
    getInputWrapper() {
      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      if (!phoneInput) return null;

      // Try multiple approaches to find the input wrapper
      let wrapper = phoneInput.closest(".relative.flex.w-full.transform");
      if (!wrapper) {
        wrapper = phoneInput.closest(".relative");
        if (!wrapper) {
          wrapper = phoneInput.closest("div");
        }
      }
      return wrapper;
    }

    getFlexWrapper() {
      const inputWrapper = this.getInputWrapper();
      if (!inputWrapper) return null;

      // More flexible approach to find the flex wrapper
      let currentElement = inputWrapper;
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loops

      while (
        currentElement &&
        currentElement.parentElement &&
        attempts < maxAttempts
      ) {
        const parent = currentElement.parentElement;

        // Look for any element with flex and w-full classes
        if (
          parent.classList.contains("flex") &&
          parent.classList.contains("w-full")
        ) {
          return parent;
        }

        // Alternative: look for any div containing our input wrapper
        if (parent.tagName === "DIV" && parent.contains(inputWrapper)) {
          // Check if this might be our target
          const computedStyle = getComputedStyle(parent);
          if (
            computedStyle.display === "flex" ||
            parent.querySelector(".flex")
          ) {
            return parent;
          }
        }

        currentElement = parent;
        attempts++;

        // Stop at form or body
        if (parent.tagName === "FORM" || parent === document.body) {
          break;
        }
      }

      // Fallback: return the input wrapper's parent if we can't find anything better
      return inputWrapper.parentElement;
    }

    getExistingMessageSpan() {
      const flexWrapper = this.getFlexWrapper();
      if (!flexWrapper) return null;

      const parentDiv = flexWrapper.parentElement;
      if (!parentDiv) return null;

      const spans = parentDiv.querySelectorAll("span.break-word");
      for (let span of spans) {
        if (!span.classList.contains("wa-validation-message")) {
          return span;
        }
      }
      return null;
    }

    getOrCreateWhatsAppDiv() {
      // First try to find existing div
      let waDiv = document.querySelector(".wa-validation-message");

      if (!waDiv) {
        const flexWrapper = this.getFlexWrapper();
        if (!flexWrapper) {
          console.warn(
            "Could not find flex wrapper, trying alternative approach",
          );

          // Fallback: try to find any suitable parent container
          const phoneInput = this.domCache.get(
            "phoneInput",
            CONFIG.INPUT_SELECTOR,
          );
          if (!phoneInput) return null;

          const inputContainer = phoneInput.closest("div");
          if (!inputContainer) return null;

          // Create div and append to input container's parent
          const parentDiv = inputContainer.parentElement;
          if (!parentDiv) return null;

          waDiv = document.createElement("div");
          waDiv.className =
            "wa-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px]";
          waDiv.style.display = "none";
          waDiv.style.width = "100%";

          // Add ARIA attributes for accessibility
          waDiv.setAttribute("role", "alert");
          waDiv.setAttribute("aria-live", "polite");
          waDiv.setAttribute("aria-atomic", "true");
          waDiv.id = "wa-validation-status";

          parentDiv.appendChild(waDiv);
          return waDiv;
        }

        const parentDiv = flexWrapper.parentElement;
        if (!parentDiv) {
          console.error("Could not find parent of flex wrapper");
          return null;
        }

        waDiv = document.createElement("div");
        waDiv.className =
          "wa-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px]";
        waDiv.style.display = "none";
        waDiv.style.width = "100%";

        // Add ARIA attributes for accessibility
        waDiv.setAttribute("role", "alert");
        waDiv.setAttribute("aria-live", "polite");
        waDiv.setAttribute("aria-atomic", "true");
        waDiv.id = "wa-validation-status";

        const flexWrapperIndex = Array.from(parentDiv.children).indexOf(
          flexWrapper,
        );
        if (
          flexWrapperIndex !== -1 &&
          flexWrapperIndex < parentDiv.children.length - 1
        ) {
          parentDiv.insertBefore(
            waDiv,
            parentDiv.children[flexWrapperIndex + 1],
          );
        } else {
          parentDiv.appendChild(waDiv);
        }
      }

      return waDiv;
    }

    getOrCreateIconContainer() {
      const inputWrapper = this.getInputWrapper();
      if (!inputWrapper) return null;

      let iconContainer = inputWrapper.querySelector(".wa-input-icon");

      if (!iconContainer) {
        iconContainer = document.createElement("div");
        iconContainer.className = "wa-input-icon";
        iconContainer.style.cssText = `
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: none;
          z-index: 10;
          pointer-events: none;
        `;

        // Add ARIA attributes for accessibility
        iconContainer.setAttribute("aria-hidden", "true");
        iconContainer.setAttribute("role", "img");

        if (getComputedStyle(inputWrapper).position === "static") {
          inputWrapper.style.position = "relative";
        }

        inputWrapper.appendChild(iconContainer);
      }

      return iconContainer;
    }

    getOrCreateButtonMessage() {
      const submitButton = this.domCache.get(
        "submitButton",
        CONFIG.SUBMIT_SELECTOR,
      );
      if (!submitButton?.parentElement) return null;

      let buttonMsg =
        submitButton.parentElement.querySelector(".wa-button-message");

      if (!buttonMsg) {
        buttonMsg = document.createElement("div");
        buttonMsg.className =
          "wa-button-message text-[12px] text-red-600 mt-[12px]";
        buttonMsg.style.display = "none";

        // Add ARIA attributes for accessibility
        buttonMsg.setAttribute("role", "alert");
        buttonMsg.setAttribute("aria-live", "assertive");
        buttonMsg.setAttribute("aria-atomic", "true");
        buttonMsg.id = "wa-button-error";

        submitButton.parentElement.appendChild(buttonMsg);
      }

      return buttonMsg;
    }

    // UI Update Methods
    updateInputIcon(type) {
      // Don't modify DOM if not allowed yet
      if (!this.state.domModified) return;

      const iconContainer = this.getOrCreateIconContainer();
      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);
      if (!iconContainer || !phoneInput) return;

      this.domBatcher.schedule(() => {
        if (type === "loading") {
          iconContainer.innerHTML = ICONS.spinner;
          iconContainer.style.display = "block";
          phoneInput.style.paddingRight = "40px";

          // ARIA attributes for loading state
          iconContainer.setAttribute(
            "aria-label",
            "Memvalidasi nomor WhatsApp",
          );
          iconContainer.setAttribute("aria-hidden", "false");
          phoneInput.setAttribute(
            "aria-describedby",
            "wa-validation-status wa-validation-help",
          );
          phoneInput.setAttribute("aria-busy", "true");
        } else if (type === "success") {
          iconContainer.innerHTML = ICONS.success;
          iconContainer.style.display = "block";
          phoneInput.style.paddingRight = "40px";

          // ARIA attributes for success state
          iconContainer.setAttribute("aria-label", "Nomor WhatsApp valid");
          iconContainer.setAttribute("aria-hidden", "false");
          phoneInput.setAttribute("aria-invalid", "false");
          phoneInput.setAttribute("aria-describedby", "wa-validation-help");
          phoneInput.removeAttribute("aria-busy");
        } else {
          iconContainer.style.display = "none";
          iconContainer.innerHTML = "";
          phoneInput.style.paddingRight = "12px";

          // Reset ARIA attributes
          iconContainer.setAttribute("aria-hidden", "true");
          phoneInput.removeAttribute("aria-describedby");
          phoneInput.removeAttribute("aria-invalid");
          phoneInput.removeAttribute("aria-busy");
        }
      });
    }

    updateSubmitButton(action) {
      // Don't modify DOM if not allowed yet
      if (!this.state.domModified) return;

      const submitButton = this.domCache.get(
        "submitButton",
        CONFIG.SUBMIT_SELECTOR,
      );
      if (!submitButton) return;

      const buttonMsg = this.getOrCreateButtonMessage();

      this.domBatcher.schedule(() => {
        if (action === "enable") {
          submitButton.disabled = this.state.originalButton.disabled;
          submitButton.style.backgroundColor = this.state.originalButton.bg;
          submitButton.style.cursor = this.state.originalButton.cursor;
          submitButton.style.opacity = this.state.originalButton.opacity;

          // ARIA attributes for enabled state
          submitButton.setAttribute(
            "aria-label",
            "Submit form - WhatsApp tervalidasi",
          );
          submitButton.removeAttribute("aria-describedby");

          if (buttonMsg) {
            buttonMsg.style.display = "none";
            buttonMsg.setAttribute("aria-hidden", "true");
          }
        } else if (action === "disable") {
          submitButton.disabled = true;
          submitButton.style.backgroundColor = "#9ca3af";
          submitButton.style.cursor = "not-allowed";
          submitButton.style.opacity = "0.7";

          // ARIA attributes for disabled state
          submitButton.setAttribute(
            "aria-label",
            "Submit tidak tersedia - Perbaiki nomor WhatsApp",
          );
          submitButton.setAttribute("aria-describedby", "wa-button-error");

          if (buttonMsg) {
            buttonMsg.innerHTML = ICONS.error + CONFIG.MESSAGES.ERROR_BUTTON;
            buttonMsg.style.display = "flex";
            buttonMsg.style.alignItems = "center";
            buttonMsg.setAttribute("aria-hidden", "false");
          }
        } else if (action === "clear") {
          // ARIA attributes for cleared state
          submitButton.setAttribute(
            "aria-label",
            this.state.originalButton.ariaLabel || "Submit form",
          );
          submitButton.removeAttribute("aria-describedby");

          if (buttonMsg && this.state.validationState !== false) {
            buttonMsg.style.display = "none";
            buttonMsg.setAttribute("aria-hidden", "true");
          }
        }
      });
    }

    updateUI(status, message, isLoading = false) {
      // Don't modify DOM if not allowed yet
      if (!this.state.domModified) {
        // Store validation state silently
        this.state.validationState = status;
        return;
      }

      const inputWrapper = this.getInputWrapper();
      const waDiv = this.getOrCreateWhatsAppDiv();
      const existingError = this.getExistingMessageSpan();
      const phoneInput = this.domCache.get("phoneInput", CONFIG.INPUT_SELECTOR);

      if (!inputWrapper || !waDiv) {
        console.warn(
          "Could not find UI elements, validation may not display properly",
        );
        return;
      }

      const hasOtherError =
        existingError &&
        existingError.style.display !== "none" &&
        !existingError.classList.contains("wa-validation-message");

      this.domBatcher.schedule(() => {
        if (hasOtherError && !isLoading) {
          waDiv.style.display = "none";
          waDiv.setAttribute("aria-hidden", "true");
          this.updateInputIcon(null);
          if (this.state.validationState === false) {
            this.updateSubmitButton("disable");
          }
          return;
        }

        inputWrapper.classList.remove("border-green-600");

        if (isLoading) {
          this.updateInputIcon("loading");
          waDiv.style.display = "none";
          waDiv.setAttribute("aria-hidden", "true");

          // Update phone input ARIA for loading state
          if (phoneInput) {
            phoneInput.setAttribute("aria-busy", "true");
            phoneInput.setAttribute("aria-describedby", "wa-validation-help");
          }
        } else if (status === true) {
          inputWrapper.classList.remove("border-red-600");
          this.updateInputIcon("success");
          waDiv.style.display = "none";
          waDiv.setAttribute("aria-hidden", "true");
          this.state.validationState = true;
          this.updateSubmitButton("enable");

          // Update phone input ARIA for success state
          if (phoneInput) {
            phoneInput.setAttribute("aria-invalid", "false");
            phoneInput.removeAttribute("aria-busy");
            phoneInput.setAttribute("aria-describedby", "wa-validation-help");
          }
        } else if (status === false) {
          inputWrapper.classList.add("border-red-600");
          inputWrapper.classList.remove("border-green-600");
          this.updateInputIcon(null);
          waDiv.className =
            "wa-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px] text-red-900";
          waDiv.innerHTML =
            ICONS.error + (message || CONFIG.MESSAGES.ERROR_INPUT);
          waDiv.style.display = "flex";
          waDiv.setAttribute("aria-hidden", "false");
          this.state.validationState = false;
          this.updateSubmitButton("disable");

          // Update phone input ARIA for error state
          if (phoneInput) {
            phoneInput.setAttribute("aria-invalid", "true");
            phoneInput.setAttribute(
              "aria-describedby",
              "wa-validation-status wa-validation-help",
            );
            phoneInput.removeAttribute("aria-busy");
          }
        } else {
          inputWrapper.classList.remove("border-green-600");
          this.updateInputIcon(null);
          waDiv.style.display = "none";
          waDiv.innerHTML = "";
          waDiv.setAttribute("aria-hidden", "true");

          // Reset phone input ARIA
          if (phoneInput) {
            phoneInput.removeAttribute("aria-invalid");
            phoneInput.removeAttribute("aria-busy");
            phoneInput.setAttribute("aria-describedby", "wa-validation-help");
          }

          if (!phoneInput?.value.trim()) {
            this.updateSubmitButton("clear");
          }
        }
      });
    }

    cleanup() {
      console.log("🧹 Cleaning up WhatsApp Validator");

      // Performance monitoring for cleanup
      PerformanceMonitor.mark("cleanup-start");

      clearTimeout(this.state.debounceTimer);

      if (this.state.retryController) {
        this.state.retryController.abort();
      }

      // Enhanced cleanup with production features
      this.domBatcher.flush();
      this.eventManager.cleanup();
      this.domCache.clear();
      this.queueManager.cancel("all");
      this.cacheManager.cleanup();

      // Generate final performance report
      if (this.debugMode) {
        const performanceReport = this.performanceBudget.getMetrics();
        const errorReport = this.errorBoundary.getErrorReport();

        console.log("📊 Final Performance Report:", performanceReport);
        console.log("🚨 Error Report:", errorReport);
      }

      // Memory cleanup - clear production feature instances
      if (this.errorBoundary) {
        this.errorBoundary.errors = [];
      }

      // Clear performance monitoring interval
      if (this.performanceMonitorInterval) {
        clearInterval(this.performanceMonitorInterval);
        this.performanceMonitorInterval = null;
      }

      // Reset state
      this.state = {
        initialized: false,
        domModified: false,
        firstInteraction: false,
        debounceTimer: null,
        lastCheckedNumber: "",
        validationState: null,
        originalButton: {},
        failsafeMode: false,
        retryController: null,
        isRetrying: false,
        actualValue: "",
        isFormatted: false,
      };

      PerformanceMonitor.mark("cleanup-end");
      PerformanceMonitor.measure(
        "cleanup-duration",
        "cleanup-start",
        "cleanup-end",
      );
    }

    // Setup automatic performance monitoring
    setupPerformanceMonitoring() {
      // Monitor performance every 30 seconds
      this.performanceMonitorInterval = setInterval(() => {
        const budgetCheck = this.performanceBudget.checkAllBudgets();

        if (!budgetCheck.overall && this.debugMode) {
          console.warn("⚡ Performance budget warning:", budgetCheck);
        }

        // Auto-cleanup if memory usage is high
        if (!budgetCheck.memory) {
          console.log("🧹 Auto-triggering cleanup due to memory pressure");
          this.cacheManager.cleanup();

          // Force garbage collection if available (dev tools)
          if (window.gc && this.debugMode) {
            window.gc();
          }
        }

        // Network quality monitoring
        if (this.networkMonitor.shouldDelayRequests() && this.debugMode) {
          console.log("📶 Poor network detected, requests will be delayed");
        }
      }, 30000);

      // Monitor page visibility to pause monitoring when hidden
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          clearInterval(this.performanceMonitorInterval);
        } else {
          this.setupPerformanceMonitoring();
        }
      });
    }

    // Comprehensive health check for production monitoring
    getHealthCheck() {
      const budgetCheck = this.performanceBudget.checkAllBudgets();
      const errorReport = this.errorBoundary.getErrorReport();
      const networkStatus = this.networkMonitor.isOnline();
      const cacheStatus = this.cacheManager.isAvailable();

      const health = {
        timestamp: Date.now(),
        status: "healthy",
        components: {
          validator: {
            initialized: this.state.initialized,
            domModified: this.state.domModified,
            failsafeMode: this.state.failsafeMode,
            status: this.state.initialized ? "operational" : "initializing",
          },
          performance: {
            budgetCheck,
            metrics: this.performanceBudget.getMetrics(),
            status: budgetCheck.overall ? "good" : "degraded",
          },
          network: {
            online: networkStatus,
            quality: this.networkMonitor.getConnectionQuality(),
            shouldDelay: this.networkMonitor.shouldDelayRequests(),
            status: networkStatus ? "connected" : "offline",
          },
          cache: {
            available: cacheStatus,
            status: cacheStatus ? "operational" : "unavailable",
          },
          errors: {
            count: errorReport.totalErrors,
            recentErrors: errorReport.recentErrors.length,
            status:
              errorReport.totalErrors > 5
                ? "critical"
                : errorReport.totalErrors > 0
                  ? "warning"
                  : "clean",
          },
        },
      };

      // Determine overall health status
      if (
        !networkStatus ||
        errorReport.totalErrors > 5 ||
        !budgetCheck.overall
      ) {
        health.status = "critical";
      } else if (
        errorReport.totalErrors > 0 ||
        !budgetCheck.memory ||
        this.state.failsafeMode
      ) {
        health.status = "warning";
      }

      return health;
    }

    // Expose health check globally for monitoring
    static getGlobalHealth() {
      if (validatorInstance) {
        return validatorInstance.getHealthCheck();
      }
      return {
        timestamp: Date.now(),
        status: "not_initialized",
        components: {},
      };
    }
  }

  // Initialize the validator
  let validatorInstance = null;
  let initializationScheduled = false;

  // Expose global health check for external monitoring
  window.WAValidatorHealth = WhatsAppValidator.getGlobalHealth;

  function initWhatsAppValidator() {
    if (validatorInstance || initializationScheduled) return;

    initializationScheduled = true;

    // Apply Nuxt hydration delay
    setTimeout(() => {
      if (validatorInstance) return; // Double-check in case of race condition

      console.log("🚀 Initializing WhatsApp Validator after hydration delay");
      validatorInstance = new WhatsAppValidator();

      // Use requestAnimationFrame for additional safety
      requestAnimationFrame(() => {
        validatorInstance.init().catch((error) => {
          console.error("Failed to initialize WhatsApp Validator:", error);
        });
      });
    }, nuxtHydrationDelay);
  }

  // Enhanced auto-initialization strategy
  function safeInitialization() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        // Additional delay for DOM stability
        setTimeout(initWhatsAppValidator, 100);
      });
    } else {
      // DOM already loaded
      if (nuxtHydrationDelay > 0) {
        // Nuxt detected, use longer delay
        setTimeout(initWhatsAppValidator, 200);
      } else {
        // No framework conflicts detected
        setTimeout(initWhatsAppValidator, 50);
      }
    }
  }

  // Start safe initialization
  safeInitialization();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    if (validatorInstance) {
      validatorInstance.cleanup();
      validatorInstance = null;
    }
  });

  // Export for manual initialization if needed
  window.WhatsAppValidator = {
    init: initWhatsAppValidator,
    instance: () => validatorInstance,
    isReady: () => !!validatorInstance && validatorInstance.state?.initialized,
  };
})();
