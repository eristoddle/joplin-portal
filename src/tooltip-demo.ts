/**
 * Demonstration of the Essential-Only Tooltip Strategy
 *
 * This file shows how the enhanced TooltipManager should be used
 * in the JoplinPortalView to implement the essential-only tooltip strategy.
 */

import { TooltipManager } from './tooltip-manager';

export class TooltipDemo {
	private tooltipManager: TooltipManager;

	constructor() {
		// Initialize with essential-only settings (same as JoplinPortalView)
		this.tooltipManager = new TooltipManager({
			enabled: true,
			showOnHover: false, // Never show on hover to prevent intrusive behavior
			autoHideDelay: 1000, // Very quick auto-hide (1 second)
			essentialOnly: true // Only show essential tooltips for errors/warnings
		});
	}

	/**
	 * Example: How to handle search result rendering without intrusive tooltips
	 */
	renderSearchResult(container: HTMLElement, title: string, snippet: string): void {
		// Create title element - NO tooltip because it's not essential
		const titleEl = container.createDiv('joplin-result-title');
		titleEl.setText(title);
		// OLD WAY (removed): titleEl.setAttribute('title', title); // This was intrusive!
		// NEW WAY: Let CSS handle truncation with ellipsis, no tooltip needed

		// Create snippet element - NO tooltip because it's not essential
		const snippetEl = container.createDiv('joplin-result-snippet');
		snippetEl.setText(snippet);
		// OLD WAY (removed): snippetEl.setAttribute('title', snippet); // This was intrusive!
		// NEW WAY: Let CSS handle line clamping, no tooltip needed
	}

	/**
	 * Example: How to show tooltips ONLY for essential error/warning cases
	 */
	showConnectionError(container: HTMLElement, errorMessage: string): void {
		const errorEl = container.createDiv('joplin-connection-error');
		errorEl.setText('Connection failed');

		// This IS appropriate for a tooltip because it's an error (essential context)
		this.tooltipManager.showEssentialTooltip(
			errorEl,
			errorMessage,
			'error' // Essential context
		);
	}

	/**
	 * Example: How to show tooltips only on intentional user interaction
	 */
	setupActionButton(container: HTMLElement): void {
		const button = container.createEl('button', { text: 'Import Selected' });

		// Show tooltip only when user intentionally clicks (not on hover)
		button.addEventListener('click', () => {
			if (this.hasNoSelectedNotes()) {
				this.tooltipManager.showTooltipOnIntentionalInteraction(
					button,
					'Please select at least one note to import',
					'action-required', // Essential context
					'click'
				);
			}
		});
	}

	/**
	 * Example: How to handle scrolling to prevent intrusive tooltips
	 */
	setupScrollListeners(container: HTMLElement): void {
		// Listen for scroll events and mark scrolling state
		container.addEventListener('scroll', () => {
			// This immediately hides all tooltips and prevents new ones during scrolling
			this.tooltipManager.markScrollingStart();
		}, { passive: true });

		// Also listen for wheel events to catch scrolling that might not trigger scroll events
		container.addEventListener('wheel', () => {
			this.tooltipManager.markScrollingStart();
		}, { passive: true });
	}

	/**
	 * Example: What NOT to do (these would be rejected by the essential-only strategy)
	 */
	demonstrateWhatNotToDo(container: HTMLElement): void {
		const titleEl = container.createDiv('joplin-result-title');
		titleEl.setText('Some Note Title');

		// ❌ DON'T DO THIS - will be rejected because 'info' is not essential
		this.tooltipManager.showEssentialTooltip(titleEl, 'Full title text', 'info');

		// ❌ DON'T DO THIS - will be rejected because 'hover' is not essential
		this.tooltipManager.showEssentialTooltip(titleEl, 'Full title text', 'hover');

		// ❌ DON'T DO THIS - old intrusive way
		// titleEl.setAttribute('title', 'Full title text');

		// ✅ DO THIS INSTEAD - let CSS handle it
		// Use CSS classes like .joplin-result-title with proper text-overflow: ellipsis
	}

	/**
	 * Example: Proper cleanup
	 */
	destroy(): void {
		this.tooltipManager.destroy();
	}

	private hasNoSelectedNotes(): boolean {
		// Mock implementation
		return true;
	}
}

/**
 * Key principles of the Essential-Only Tooltip Strategy:
 *
 * 1. ONLY show tooltips for essential contexts:
 *    - 'error': Error messages that need explanation
 *    - 'warning': Warning messages that need clarification
 *    - 'action-required': Actions that need user attention
 *    - 'critical-info': Critical information not visible elsewhere
 *
 * 2. NEVER show tooltips for:
 *    - Regular content that can be handled by CSS (titles, snippets)
 *    - Hover interactions during scrolling
 *    - Non-essential informational content
 *
 * 3. ALWAYS:
 *    - Hide tooltips immediately when scrolling starts
 *    - Use quick auto-hide (max 1-2 seconds)
 *    - Prefer intentional interactions over hover
 *    - Let CSS handle text truncation and overflow
 *
 * 4. STYLING:
 *    - Use .joplin-tooltip-element class for custom styling
 *    - Apply data-context attributes for context-specific styling
 *    - Make tooltips less visually intrusive
 *    - Ensure tooltips don't interfere with reading
 */