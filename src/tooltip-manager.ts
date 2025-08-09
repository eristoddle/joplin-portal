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
	 */
	shouldShowTooltip(element: HTMLElement, content: string, context: string): boolean {
		// If tooltips are disabled globally, never show
		if (!this.config.enabled) {
			return false;
		}

		// If essential-only mode is enabled, be very restrictive
		if (this.config.essentialOnly) {
			// Only show tooltips for essential functionality that isn't self-explanatory
			const essentialContexts = ['error', 'warning', 'action-required'];
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
		temp.style.cssText = window.getComputedStyle(element).cssText;
		temp.style.position = 'absolute';
		temp.style.visibility = 'hidden';
		temp.style.width = 'auto';
		temp.style.height = 'auto';
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
	 */
	showEssentialTooltip(element: HTMLElement, content: string, context: string = 'info'): void {
		if (!this.shouldShowTooltip(element, content, context)) {
			return;
		}

		// Set the tooltip
		element.setAttribute('title', content);
		this.activeTooltips.add(element);

		// Set up auto-hide if configured
		if (this.config.autoHideDelay > 0) {
			// Clear any existing timer for this element
			const existingTimer = this.hideTimers.get(element);
			if (existingTimer) {
				clearTimeout(existingTimer);
			}

			// Set new timer
			const timer = setTimeout(() => {
				this.hideTooltip(element);
			}, this.config.autoHideDelay);

			this.hideTimers.set(element, timer);
		}
	}

	/**
	 * Hide tooltip from an element
	 */
	hideTooltip(element: HTMLElement): void {
		element.removeAttribute('title');
		this.activeTooltips.delete(element);

		// Clear timer if exists
		const timer = this.hideTimers.get(element);
		if (timer) {
			clearTimeout(timer);
			this.hideTimers.delete(element);
		}
	}

	/**
	 * Hide all active tooltips
	 */
	hideAllTooltips(): void {
		this.activeTooltips.forEach(element => {
			element.removeAttribute('title');
		});
		this.activeTooltips.clear();

		// Clear all timers
		this.hideTimers.forEach(timer => clearTimeout(timer));
		this.hideTimers.clear();
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
	 * Clean up resources
	 */
	destroy(): void {
		this.hideAllTooltips();
	}
}