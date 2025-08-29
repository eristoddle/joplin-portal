/**
 * TooltipManager - Controls when tooltips should appear to prevent intrusive behavior
 *
 * This class implements a minimal tooltip strategy that only shows tooltips
 * when they provide essential information not already visible, and ensures
 * they don't interfere with scrolling or content viewing.
 */

export interface TooltipConfig {
	enabled: boolean;
	showOnHover: boolean;
	autoHideDelay: number;
	essentialOnly: boolean;
}

export class TooltipManager {
	private config: TooltipConfig;
	private activeTooltips: Set<HTMLElement> = new Set();
	private hideTimers: Map<HTMLElement, NodeJS.Timeout> = new Map();
	private scrollingState: boolean = false;
	private scrollTimer: NodeJS.Timeout | null = null;
	private lastInteractionTime: number = 0;

	constructor(config: Partial<TooltipConfig> = {}) {
		this.config = {
			enabled: true,
			showOnHover: false, // Disabled by default to prevent intrusive behavior
			autoHideDelay: 2000, // 2 seconds
			essentialOnly: true,
			...config
		};
	}

	/**
	 * Determines if a tooltip should be shown based on context and content
	 * This method implements the essential-only tooltip strategy
	 */
	shouldShowTooltip(element: HTMLElement, content: string, context: string): boolean {
		// If tooltips are disabled globally, never show
		if (!this.config.enabled) {
			return false;
		}

		// If essential-only mode is enabled, be very restrictive
		if (this.config.essentialOnly) {
			// Only show tooltips for essential functionality that isn't self-explanatory
			const essentialContexts = ['error', 'warning', 'action-required', 'critical-info'];
			if (!essentialContexts.includes(context)) {
				return false;
			}
		}

		// Don't show tooltip if content is empty or too short to be useful
		if (!content || content.trim().length < 3) {
			return false;
		}

		// Don't show tooltip if the content is already fully visible in the element
		const elementText = element.textContent || '';
		if (elementText.trim() === content.trim()) {
			return false;
		}

		// Don't show tooltip if element is not truncated (content fits)
		if (this.isContentFullyVisible(element, content)) {
			return false;
		}

		// Additional check: Don't show tooltips during scrolling or rapid interactions
		if (this.isUserScrolling()) {
			return false;
		}

		return true;
	}

	/**
	 * Checks if content is fully visible in the element (not truncated)
	 */
	private isContentFullyVisible(element: HTMLElement, content: string): boolean {
		// In test environments or when elements have no dimensions,
		// use text length comparison as fallback
		const elementText = element.textContent || '';
		const elementWidth = element.offsetWidth;

		// If element has no width (test environment), use text length comparison
		if (elementWidth === 0) {
			return content.length <= elementText.length * 1.2; // Allow 20% tolerance
		}

		// Create a temporary element to measure the content
		const temp = document.createElement('span');
		temp.className = 'joplin-tooltip-temp-measure';
		temp.style.cssText = window.getComputedStyle(element).cssText;
		temp.textContent = content;

		document.body.appendChild(temp);
		const contentWidth = temp.offsetWidth;
		document.body.removeChild(temp);

		// Compare with element's available width
		// Add some tolerance for padding/margins
		return contentWidth <= elementWidth + 10;
	}

	/**
	 * Show an essential tooltip with auto-hide functionality
	 * Only shows tooltips on intentional user interaction, not during scrolling
	 */
	showEssentialTooltip(element: HTMLElement, content: string, context: string = 'info'): void {
		if (!this.shouldShowTooltip(element, content, context)) {
			return;
		}

		// Record this as an intentional interaction
		this.lastInteractionTime = Date.now();

		// Set the tooltip with enhanced styling for less intrusion
		element.setAttribute('title', content);
		this.activeTooltips.add(element);

		// Apply less intrusive styling if possible
		this.applyTooltipStyling(element, context);

		// Set up quick auto-hide for essential tooltips
		if (this.config.autoHideDelay > 0) {
			// Clear any existing timer for this element
			const existingTimer = this.hideTimers.get(element);
			if (existingTimer) {
				clearTimeout(existingTimer);
			}

			// Set new timer with shorter delay for essential tooltips
			const quickHideDelay = Math.min(this.config.autoHideDelay, 2000); // Max 2 seconds
			const timer = setTimeout(() => {
				this.hideTooltip(element);
			}, quickHideDelay);

			this.hideTimers.set(element, timer);
		}
	}



	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<TooltipConfig>): void {
		this.config = { ...this.config, ...newConfig };

		// If tooltips are disabled, hide all active ones
		if (!this.config.enabled) {
			this.hideAllTooltips();
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): TooltipConfig {
		return { ...this.config };
	}

	/**
	 * Check if user is currently scrolling (to prevent intrusive tooltips)
	 */
	private isUserScrolling(): boolean {
		return this.scrollingState;
	}

	/**
	 * Mark that scrolling has started (call this from scroll event listeners)
	 */
	markScrollingStart(): void {
		this.scrollingState = true;

		// Clear any existing scroll timer
		if (this.scrollTimer) {
			clearTimeout(this.scrollTimer);
		}

		// Hide all tooltips immediately when scrolling starts
		this.hideAllTooltips();

		// Set timer to mark scrolling as ended after a delay
		this.scrollTimer = setTimeout(() => {
			this.scrollingState = false;
		}, 150); // 150ms delay after scrolling stops
	}

	/**
	 * Show tooltip only on intentional user interaction (not hover during scrolling)
	 */
	showTooltipOnIntentionalInteraction(element: HTMLElement, content: string, context: string = 'info', interactionType: 'click' | 'focus' | 'keypress' = 'click'): void {
		// Only show if this is an intentional interaction and not during scrolling
		if (this.isUserScrolling()) {
			return;
		}

		// Require a minimum time between interactions to prevent rapid-fire tooltips
		const now = Date.now();
		if (now - this.lastInteractionTime < 100) { // 100ms debounce
			return;
		}

		// For click and focus interactions, show the tooltip
		if (interactionType === 'click' || interactionType === 'focus' || interactionType === 'keypress') {
			this.showEssentialTooltip(element, content, context);
		}
	}

	/**
	 * Apply less intrusive styling to tooltip elements
	 */
	private applyTooltipStyling(element: HTMLElement, context: string = 'info'): void {
		// Add a CSS class for less intrusive tooltip styling
		element.classList.add('joplin-tooltip-element');

		// Set data attributes for CSS styling
		element.setAttribute('data-tooltip-context', 'essential');
		element.setAttribute('data-context', context);
	}

	/**
	 * Remove tooltip styling from element
	 */
	private removeTooltipStyling(element: HTMLElement): void {
		element.classList.remove('joplin-tooltip-element');
		element.removeAttribute('data-tooltip-context');
		element.removeAttribute('data-context');
	}

	/**
	 * Enhanced hide tooltip that also removes styling
	 */
	hideTooltip(element: HTMLElement): void {
		element.removeAttribute('title');
		this.removeTooltipStyling(element);
		this.activeTooltips.delete(element);

		// Clear timer if exists
		const timer = this.hideTimers.get(element);
		if (timer) {
			clearTimeout(timer);
			this.hideTimers.delete(element);
		}
	}

	/**
	 * Enhanced hide all tooltips that also removes styling
	 */
	hideAllTooltips(): void {
		this.activeTooltips.forEach(element => {
			element.removeAttribute('title');
			this.removeTooltipStyling(element);
		});
		this.activeTooltips.clear();

		// Clear all timers
		this.hideTimers.forEach(timer => clearTimeout(timer));
		this.hideTimers.clear();
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.hideAllTooltips();

		// Clear scroll timer
		if (this.scrollTimer) {
			clearTimeout(this.scrollTimer);
			this.scrollTimer = null;
		}
	}
}