import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipManager } from '../../src/tooltip-manager';

describe('Tooltip View Integration', () => {
	let tooltipManager: TooltipManager;
	let container: HTMLElement;

	beforeEach(() => {
		// Initialize tooltip manager with the same settings as JoplinPortalView
		tooltipManager = new TooltipManager({
			enabled: true,
			showOnHover: false, // Never show on hover to prevent intrusive behavior
			autoHideDelay: 1000, // Very quick auto-hide (1 second)
			essentialOnly: true // Only show essential tooltips for errors/warnings
		});

		// Set up DOM
		container = document.createElement('div');
		container.className = 'joplin-portal-view';
		document.body.appendChild(container);
	});

	afterEach(() => {
		tooltipManager.destroy();
		if (container.parentNode) {
			document.body.removeChild(container);
		}
	});

	it('should initialize with essential-only settings', () => {
		const config = tooltipManager.getConfig();

		expect(config.enabled).toBe(true);
		expect(config.showOnHover).toBe(false); // Prevent hover tooltips during scrolling
		expect(config.essentialOnly).toBe(true); // Only show essential tooltips
		expect(config.autoHideDelay).toBe(1000); // Very quick auto-hide
	});

	it('should not show tooltips for search result titles (non-essential context)', () => {
		const titleElement = container.appendChild(document.createElement('div'));
		titleElement.className = 'joplin-result-title';
		titleElement.textContent = 'Test Note with a Very Long Title That Would Normally Get a Tooltip';

		// Try to show tooltip with non-essential context
		tooltipManager.showEssentialTooltip(titleElement, 'Full title content', 'info');

		// Should not show because 'info' is not an essential context
		expect(titleElement.getAttribute('title')).toBeNull();
	});

	it('should not show tooltips for search result snippets (non-essential context)', () => {
		const snippetElement = container.appendChild(document.createElement('div'));
		snippetElement.className = 'joplin-result-snippet';
		snippetElement.textContent = 'This is a very long snippet that would normally get a tooltip';

		// Try to show tooltip with non-essential context
		tooltipManager.showEssentialTooltip(snippetElement, 'Full snippet content', 'info');

		// Should not show because 'info' is not an essential context
		expect(snippetElement.getAttribute('title')).toBeNull();
	});

	it('should show tooltips only for essential contexts like errors', () => {
		const errorElement = container.appendChild(document.createElement('div'));
		errorElement.className = 'joplin-error-message';
		errorElement.textContent = 'Error';

		// Show tooltip with essential context
		tooltipManager.showEssentialTooltip(errorElement, 'Detailed error message that provides important context', 'error');

		// Should show because 'error' is an essential context
		expect(errorElement.getAttribute('title')).toBe('Detailed error message that provides important context');
		expect(errorElement.classList.contains('joplin-tooltip-element')).toBe(true);
		expect(errorElement.getAttribute('data-context')).toBe('error');
	});

	it('should hide tooltips immediately when scrolling starts', () => {
		const errorElement = container.appendChild(document.createElement('div'));
		errorElement.textContent = 'Error';

		// First show a tooltip
		tooltipManager.showEssentialTooltip(errorElement, 'Detailed error message', 'error');
		expect(errorElement.getAttribute('title')).toBeTruthy();

		// Mark scrolling start (simulating scroll event)
		tooltipManager.markScrollingStart();

		// Tooltip should be hidden immediately
		expect(errorElement.getAttribute('title')).toBeNull();
		expect(errorElement.classList.contains('joplin-tooltip-element')).toBe(false);
	});

	it('should prevent tooltips during scrolling even for essential contexts', () => {
		const errorElement = container.appendChild(document.createElement('div'));
		errorElement.textContent = 'Error';

		// Mark scrolling as active
		tooltipManager.markScrollingStart();

		// Try to show tooltip during scrolling
		tooltipManager.showEssentialTooltip(errorElement, 'Detailed error message', 'error');

		// Should not show even though it's an essential context
		expect(errorElement.getAttribute('title')).toBeNull();
	});

	it('should support intentional interaction tooltips', () => {
		const buttonElement = container.appendChild(document.createElement('button'));
		buttonElement.textContent = 'Action Button';

		// Show tooltip on intentional click interaction
		tooltipManager.showTooltipOnIntentionalInteraction(
			buttonElement,
			'This action requires confirmation',
			'action-required',
			'click'
		);

		// Should show because it's an intentional interaction with essential context
		expect(buttonElement.getAttribute('title')).toBe('This action requires confirmation');
		expect(buttonElement.getAttribute('data-context')).toBe('action-required');
	});

	it('should auto-hide tooltips quickly (within 1 second)', (done) => {
		const errorElement = container.appendChild(document.createElement('div'));
		errorElement.textContent = 'Error';

		tooltipManager.showEssentialTooltip(errorElement, 'Detailed error message', 'error');
		expect(errorElement.getAttribute('title')).toBeTruthy();

		// Should hide within 1 second
		setTimeout(() => {
			expect(errorElement.getAttribute('title')).toBeNull();
			expect(errorElement.classList.contains('joplin-tooltip-element')).toBe(false);
			done();
		}, 1100); // Test at 1.1 seconds (should be hidden by then)
	});

	it('should demonstrate the CSS-based approach for text handling', () => {
		// Create elements that would normally have tooltips but now rely on CSS
		const titleEl = container.appendChild(document.createElement('div'));
		titleEl.className = 'joplin-result-title';
		titleEl.textContent = 'Very Long Title That Should Be Handled By CSS';

		const snippetEl = container.appendChild(document.createElement('div'));
		snippetEl.className = 'joplin-result-snippet';
		snippetEl.textContent = 'Very long snippet content that should be handled by CSS line clamping';

		// Verify no tooltips are used for these elements
		expect(titleEl.getAttribute('title')).toBeNull();
		expect(snippetEl.getAttribute('title')).toBeNull();

		// Verify content is still accessible
		expect(titleEl.textContent).toBeTruthy();
		expect(snippetEl.textContent).toBeTruthy();

		// Verify CSS classes are applied for proper styling
		expect(titleEl.className).toBe('joplin-result-title');
		expect(snippetEl.className).toBe('joplin-result-snippet');
	});
});