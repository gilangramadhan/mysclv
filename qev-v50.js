(function () {
  "use strict";

  // Configuration for QuickEmailVerification via Cloudflare Worker
  const CONFIG = Object.freeze({
    // Replace with your deployed Cloudflare Worker URL
    API_URL: "https://test.scalev.workers.dev",
    DEBOUNCE_DELAY: 800,
    INPUT_SELECTOR: "#email",
    SUBMIT_SELECTOR: 'button[type="submit"]',
    QUEUE: { MAX_SIZE: 5, MAX_CONCURRENT: 2 },
    CACHE: {
      SUCCESS_TTL: 600000,
      FAILURE_TTL: 300000,
      MAX_SIZE: 50,
      KEY_PREFIX: "email_v_",
    },
    MESSAGES: {
      ERROR_INPUT: "Email yang Anda masukkan salah",
      ERROR_BUTTON:
        "Email yang Anda masukkan tidak valid. Mohon cek kembali.",
      ERROR_SUBMIT: "Perbaiki email sebelum submit!",
      RATE_LIMIT: "Terlalu banyak percobaan validasi. Silakan tunggu sebentar.",
      DISPOSABLE: "Gunakan alamat email utama Anda, bukan email sekali pakai.",
    },
  });

  // SVG icons reused from WhatsApp validator
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
          '<svg width="1em" height="1em" viewBox="0 0 25 25" class="inline-flex overflow-visible animate-spin text-[24px] text-primary"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.5 4.826c.552 0 1-.448 1-1s-.448-1-1-1C6.977 2.826 2.5 7.303 2.5 12.826c0 1.681.415 3.265 1.147 4.655.011.02.021.04.032.06 1.685 3.145 5.003 5.285 8.821 5.285 5.523 0 10-4.477 10-10 0-.552-.448-1-1-1s-1 .448-1 1c0 4.418-3.582 8-8 8-2.029 0-3.881-.755-5.292-2-.892-.788-1.608-1.773-2.079-2.886-.405-.957-.629-2.009-.629-3.114 0-4.418 3.582-8 8-8z" fill="url(#a)"/><defs><linearGradient id="a" x1="16" y1="13.326" x2="15" y2="4.326" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor"/><stop offset=".415" stop-color="currentColor" stop-opacity=".421"/><stop offset=".659" stop-color="currentColor" stop-opacity=".175"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs></svg>',
        );
      }
      return this._cache.get("spinner");
    },
  };

  // Simple DOM cache
  class DOMCache {
    constructor() {
      this.elements = new Map();
    }
    get(key, selector, context = document) {
      if (!this.elements.has(key)) {
        const el = context.querySelector(selector);
        if (el) this.elements.set(key, el);
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

  // Event manager
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

  // Cache manager using localStorage
  class CacheManager {
    constructor() {
      this.available = null;
    }
    isAvailable() {
      if (this.available === null) {
        try {
          const test = "__email_test__";
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          this.available = true;
        } catch (e) {
          this.available = false;
        }
      }
      return this.available;
    }
    async get(email) {
      if (!this.isAvailable()) return null;
      try {
        const key = CONFIG.CACHE.KEY_PREFIX + email;
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
    async set(email, result, isSuccess) {
      if (!this.isAvailable()) return;
      try {
        const key = CONFIG.CACHE.KEY_PREFIX + email;
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
        // ignore
      }
    }
  }

  // Simple queue manager
  class QueueManager {
    constructor() {
      this.queue = [];
      this.activeCount = 0;
    }
    add(email, callback) {
      this.cancel(email);
      if (this.queue.length < CONFIG.QUEUE.MAX_SIZE) {
        this.queue.push({ email, callback });
        this.process();
      }
    }
    cancel(email) {
      if (email === "all") {
        this.queue = [];
        return;
      }
      const index = this.queue.findIndex((i) => i.email === email);
      if (index !== -1) this.queue.splice(index, 1);
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

  // DOM update batcher
  class DOMBatcher {
    constructor() {
      this.queue = [];
      this.frameId = null;
    }
    schedule(fn) {
      this.queue.push(fn);
      if (!this.frameId) {
        this.frameId = requestAnimationFrame(() => this.flush());
      }
    }
    flush() {
      const list = [...this.queue];
      this.queue = [];
      this.frameId = null;
      list.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.warn("DOM update failed", e);
        }
      });
    }
  }

  class EmailValidator {
    constructor() {
      this.domCache = new DOMCache();
      this.eventManager = new EventManager();
      this.cacheManager = new CacheManager();
      this.queueManager = new QueueManager();
      this.domBatcher = new DOMBatcher();
      this.state = {
        initialized: false,
        validationState: null,
        debounceTimer: null,
        originalButton: null,
        lastValidatedEmail: "",
        isValidating: false,
        activeEmail: null,
        invalidEdited: false,
      };
    }

    init() {
      const emailInput = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (!emailInput) return;

      this.eventManager.add(emailInput, "input", () => this.handleInput());
      this.eventManager.add(emailInput, "blur", () => this.handleBlur());

      const submitBtn = this.domCache.get(
        "submitButton",
        CONFIG.SUBMIT_SELECTOR,
      );
      if (submitBtn) {
        this.state.originalButton = {
          bg: submitBtn.style.backgroundColor || "",
          cursor: submitBtn.style.cursor || "",
          opacity: submitBtn.style.opacity || "",
          disabled: submitBtn.disabled,
          ariaLabel: submitBtn.getAttribute("aria-label") || "",
        };
        this.eventManager.add(submitBtn, "click", (e) =>
          this.handleSubmitClick(e),
        );
      }

      const form = emailInput.closest("form");
      if (form) {
        this.eventManager.add(form, "submit", (e) => this.handleSubmit(e));
      }

      this.state.initialized = true;
    }

    cleanup() {
      this.eventManager.cleanup();
      this.domCache.clear();
    }

    handleInput() {
      const emailInput = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (emailInput) {
        const value = emailInput.value.trim();
        if (this.state.validationState === false) {
          this.state.invalidEdited = value !== this.state.lastValidatedEmail;
        } else {
          this.state.invalidEdited = false;
        }
        if (value && emailInput.checkValidity()) {
          this.debouncedValidate();
        } else {
          clearTimeout(this.state.debounceTimer);
          this.updateUI(null, "");
          if (!value) {
            this.state.validationState = null;
            this.updateSubmitButton("clear");
          } else if (this.state.validationState === false) {
            this.updateSubmitButton("disable");
          } else {
            this.updateSubmitButton("clear");
          }
        }
      }
    }

    handleBlur() {
      const emailInput = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (
        this.state.validationState === false &&
        this.state.invalidEdited &&
        emailInput &&
        emailInput.value.trim() &&
        emailInput.checkValidity()
      ) {
        this.queueValidation();
        this.state.invalidEdited = false;
      }
    }

    handleSubmit(e) {
      if (this.state.validationState === false) {
        e.preventDefault();
        e.stopPropagation();
        this.showValidationError();
        return false;
      }
    }

    handleSubmitClick(e) {
      if (this.state.validationState === false) {
        e.preventDefault();
        e.stopPropagation();
        this.showValidationError();
        return false;
      }
    }

    showValidationError() {
      const emailInput = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      const span = this.getOrCreateStatusSpan();
      if (span) {
        this.domBatcher.schedule(() => {
          span.className =
            "email-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px] text-red-900";
          span.innerHTML = ICONS.error + CONFIG.MESSAGES.ERROR_SUBMIT;
          span.style.display = "flex";
          span.setAttribute("aria-hidden", "false");
          span.setAttribute("aria-live", "assertive");
        });
      }
      if (emailInput) {
        emailInput.focus();
        const inputWrapper = emailInput.parentElement;
        if (inputWrapper) {
          inputWrapper.classList.add("border-red-600");
          inputWrapper.classList.remove("border-green-600");
        }
        this.updateInputIcon(null);
        emailInput.setAttribute("aria-invalid", "true");
        emailInput.setAttribute(
          "aria-describedby",
          "email-validation-status email-validation-help",
        );
      }
      this.updateSubmitButton("disable");
    }

    debouncedValidate() {
      clearTimeout(this.state.debounceTimer);
      this.state.debounceTimer = setTimeout(
        () => this.queueValidation(),
        CONFIG.DEBOUNCE_DELAY,
      );
    }

    queueValidation() {
      const emailInput = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (!emailInput) return;
      const email = emailInput.value.trim();
      if (!email || !emailInput.checkValidity()) {
        this.updateUI(null, "");
        return;
      }
      if (
        (this.state.isValidating && this.state.activeEmail === email) ||
        (this.state.validationState === true &&
          this.state.lastValidatedEmail === email)
      ) {
        return;
      }
      this.queueManager.add(email, (done) => {
        this.validateEmail(email).finally(done);
      });
    }

    async validateEmail(email) {
      this.state.isValidating = true;
      this.state.activeEmail = email;
      this.state.invalidEdited = false;
      const emailInput = this.domCache.get(
        "emailInput",
        CONFIG.INPUT_SELECTOR,
      );
      try {
        const cached = await this.cacheManager.get(email);
        if (cached === true) {
          this.updateUI(true);
          this.state.validationState = true;
          this.state.lastValidatedEmail = email;
          return true;
        }

        this.updateUI(null, "", true);

        const attempts = 3;
        let data = null;
        for (let i = 0; i < attempts; i++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(
              `${CONFIG.API_URL}?email=${encodeURIComponent(email)}`,
              { headers: { Accept: "application/json" }, signal: controller.signal },
            );
            clearTimeout(timeoutId);
            data = await response.json();
          } catch (e) {
            console.warn("Email validation failed", e);
            this.updateUI(null, "Error validating email");
            this.state.validationState = null;
            return null;
          }

          if (emailInput?.value.trim() !== email) {
            this.updateUI(null, "");
            this.state.validationState = null;
            return null;
          }

          if (data.result !== "unknown") break;

          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, 1500));
            if (emailInput?.value.trim() !== email) {
              this.updateUI(null, "");
              this.state.validationState = null;
              return null;
            }
          }
        }

        if (!data || data.result === "unknown") {
          this.updateUI(null, "");
          this.state.validationState = null;
          return null;
        }

        if (data.result === "valid") {
          await this.cacheManager.set(email, true, true);
          this.updateUI(true);
          this.state.validationState = true;
          this.state.lastValidatedEmail = email;
          return true;
        }

        if (data.result === "invalid" && data.did_you_mean) {
          const suggestion = data.did_you_mean;
          const msg = `Maksud Anda: <button type="button" class="email-suggestion underline" style="background:none;border:0;padding:0;margin:0;">${suggestion}</button>?`;
          this.updateUI(false, msg);
          this.attachSuggestionHandler(suggestion);
          this.state.validationState = false;
          this.state.lastValidatedEmail = email;
          return false;
        }

        if (data.result === "invalid") {
          this.updateUI(false);
          this.state.validationState = false;
          this.state.lastValidatedEmail = email;
          return false;
        }

        this.updateUI(null, "Error validating email");
        this.state.validationState = null;
        return null;
      } finally {
        this.state.isValidating = false;
        this.state.activeEmail = null;
      }
    }

    getOrCreateButtonMessage() {
      const submitButton = this.domCache.get(
        "submitButton",
        CONFIG.SUBMIT_SELECTOR,
      );
      if (!submitButton?.parentElement) return null;

      let buttonMsg =
        submitButton.parentElement.querySelector(".email-button-message");

      if (!buttonMsg) {
        buttonMsg = document.createElement("div");
        buttonMsg.className =
          "email-button-message text-[12px] text-red-600 mt-[12px]";
        buttonMsg.style.display = "none";
        buttonMsg.setAttribute("role", "alert");
        buttonMsg.setAttribute("aria-live", "assertive");
        buttonMsg.setAttribute("aria-atomic", "true");
        buttonMsg.id = "email-button-error";

        submitButton.parentElement.appendChild(buttonMsg);
      }

      return buttonMsg;
    }

    updateSubmitButton(action) {
      const submitButton = this.domCache.get(
        "submitButton",
        CONFIG.SUBMIT_SELECTOR,
      );
      if (!submitButton) return;
      const buttonMsg = this.getOrCreateButtonMessage();

      this.domBatcher.schedule(() => {
        if (action === "enable") {
          submitButton.disabled = this.state.originalButton?.disabled ?? false;
          submitButton.style.backgroundColor =
            this.state.originalButton?.bg || "";
          submitButton.style.cursor =
            this.state.originalButton?.cursor || "";
          submitButton.style.opacity =
            this.state.originalButton?.opacity || "";
          submitButton.setAttribute(
            "aria-label",
            this.state.originalButton?.ariaLabel || "Submit form",
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
          submitButton.setAttribute(
            "aria-label",
            "Submit tidak tersedia - Perbaiki email",
          );
          submitButton.setAttribute(
            "aria-describedby",
            "email-button-error",
          );
          if (buttonMsg) {
            buttonMsg.innerHTML =
              ICONS.error + CONFIG.MESSAGES.ERROR_BUTTON;
            buttonMsg.style.display = "flex";
            buttonMsg.style.alignItems = "center";
            buttonMsg.setAttribute("aria-hidden", "false");
          }
        } else if (action === "clear") {
          submitButton.disabled = this.state.originalButton?.disabled ?? false;
          submitButton.style.backgroundColor =
            this.state.originalButton?.bg || "";
          submitButton.style.cursor =
            this.state.originalButton?.cursor || "";
          submitButton.style.opacity =
            this.state.originalButton?.opacity || "";
          submitButton.setAttribute(
            "aria-label",
            this.state.originalButton?.ariaLabel || "Submit form",
          );
          submitButton.removeAttribute("aria-describedby");
          if (buttonMsg) {
            buttonMsg.style.display = "none";
            buttonMsg.setAttribute("aria-hidden", "true");
          }
        }
      });
    }

    getOrCreateStatusSpan() {
      const input = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (!input) return null;

      // Find the outer flex wrapper to place the span after
      let flexWrapper = input.closest("div.flex.w-full");
      if (!flexWrapper) return null;
      if (
        flexWrapper.parentElement &&
        flexWrapper.parentElement.classList.contains("flex") &&
        flexWrapper.parentElement.classList.contains("w-full")
      ) {
        flexWrapper = flexWrapper.parentElement;
      }

      let span = this.domCache.get("emailSpan", "#email-validation-status");
      if (span && span.tagName !== "SPAN") {
        span.remove();
        span = null;
      }
      if (!span) {
        span = document.createElement("span");
        span.id = "email-validation-status";
        span.className =
          "email-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px]";
        span.style.display = "none";
        span.setAttribute("aria-hidden", "true");
        span.setAttribute("aria-live", "polite");
        this.domCache.set("emailSpan", span);
      }

      if (span.previousElementSibling !== flexWrapper) {
        flexWrapper.insertAdjacentElement("afterend", span);
      }

      return span;
    }

    getOrCreateIconContainer() {
      const input = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (!input) return null;

      let container = this.domCache.get("iconContainer", "#email-validation-icon");
      if (!container) {
        container = document.createElement("div");
        container.id = "email-validation-icon";
        container.className = "email-input-icon";
        container.style.cssText = `
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: none;
          z-index: 10;
          pointer-events: none;
        `;
        container.setAttribute("aria-hidden", "true");
        container.setAttribute("role", "img");

        const parent = input.parentElement;
        if (!parent) return null;
        if (getComputedStyle(parent).position === "static") {
          parent.style.position = "relative";
        }
        parent.appendChild(container);
        this.domCache.set("iconContainer", container);
      }

      return container;
    }

    updateInputIcon(type) {
      const container = this.getOrCreateIconContainer();
      const input = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (!container || !input) return;

      this.domBatcher.schedule(() => {
        if (type === "loading") {
          container.innerHTML = ICONS.spinner;
          container.style.display = "block";
          input.style.paddingRight = "40px";
          container.setAttribute("aria-hidden", "false");
          input.setAttribute("aria-busy", "true");
        } else if (type === "success") {
          container.innerHTML = ICONS.success;
          container.style.display = "block";
          input.style.paddingRight = "40px";
          container.setAttribute("aria-hidden", "false");
          input.setAttribute("aria-invalid", "false");
          input.removeAttribute("aria-busy");
        } else if (type === "error") {
          container.innerHTML = ICONS.error;
          container.style.display = "block";
          input.style.paddingRight = "40px";
          container.setAttribute("aria-hidden", "false");
          input.setAttribute("aria-invalid", "true");
          input.removeAttribute("aria-busy");
        } else {
          container.style.display = "none";
          container.innerHTML = "";
          input.style.paddingRight = "12px";
          container.setAttribute("aria-hidden", "true");
          input.removeAttribute("aria-invalid");
          input.removeAttribute("aria-busy");
        }
      });
    }

    attachSuggestionHandler(suggestion) {
      this.domBatcher.schedule(() => {
        const span = this.getOrCreateStatusSpan();
        const input = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
        const btn = span?.querySelector(".email-suggestion");
        if (!btn || !input) return;
        this.eventManager.add(btn, "click", () => {
          input.value = suggestion;
          input.focus();
          this.queueValidation();
        });
      });
    }

    updateUI(isValid, message = "", isLoading = false) {
      const span = this.getOrCreateStatusSpan();
      const input = this.domCache.get("emailInput", CONFIG.INPUT_SELECTOR);
      if (!span || !input) return;
      const inputWrapper = input.parentElement;

      this.domBatcher.schedule(() => {
        if (isLoading) {
          this.updateInputIcon("loading");
          span.style.display = "none";
          span.setAttribute("aria-hidden", "true");
          if (inputWrapper)
            inputWrapper.classList.remove(
              "border-red-600",
              "border-green-600",
            );
          this.updateSubmitButton("clear");
        } else if (isValid === true) {
          this.updateInputIcon("success");
          span.style.display = "none";
          span.setAttribute("aria-hidden", "true");
          input.setAttribute("aria-invalid", "false");
          if (inputWrapper) {
            inputWrapper.classList.add("border-green-600");
            inputWrapper.classList.remove("border-red-600");
          }
          this.updateSubmitButton("enable");
        } else if (isValid === false) {
          this.updateInputIcon(null);
          span.className =
            "email-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px] text-red-900";
          span.innerHTML = ICONS.error + (message || CONFIG.MESSAGES.ERROR_INPUT);
          span.style.display = "flex";
          span.setAttribute("aria-hidden", "false");
          input.setAttribute("aria-invalid", "true");
          if (inputWrapper) {
            inputWrapper.classList.add("border-red-600");
            inputWrapper.classList.remove("border-green-600");
          }
          this.updateSubmitButton("disable");
        } else {
          this.updateInputIcon(null);
          if (message) {
            span.className =
              "email-validation-message break-word mb-[5px] mt-[5px] flex items-center text-[12px]";
            span.textContent = message;
            span.style.display = "flex";
            span.setAttribute("aria-hidden", "false");
          } else {
            span.style.display = "none";
            span.setAttribute("aria-hidden", "true");
          }
          input.removeAttribute("aria-invalid");
          if (inputWrapper)
            inputWrapper.classList.remove(
              "border-red-600",
              "border-green-600",
            );
          if (!input.value.trim()) {
            this.updateSubmitButton("clear");
          }
        }
      });
    }

    getHealthCheck() {
      return {
        timestamp: Date.now(),
        initialized: this.state.initialized,
        validationState: this.state.validationState,
        cacheAvailable: this.cacheManager.isAvailable(),
        queueSize: this.queueManager.queue.length,
      };
    }

    static getGlobalHealth() {
      if (validatorInstance) {
        return validatorInstance.getHealthCheck();
      }
      return { timestamp: Date.now(), status: "not_initialized" };
    }
  }

  let validatorInstance = null;
  function initEmailValidator() {
    if (validatorInstance) return;
    validatorInstance = new EmailValidator();
    validatorInstance.init();
  }

  function safeInitialization() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initEmailValidator);
    } else {
      initEmailValidator();
    }
  }

  safeInitialization();

  window.EmailValidator = {
    init: initEmailValidator,
    instance: () => validatorInstance,
    isReady: () => !!validatorInstance && validatorInstance.state?.initialized,
    health: EmailValidator.getGlobalHealth,
  };
})();
