import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipManager } from '../../src/tooltip-manager';

describe('Essential-Only Tooltip Strategy', () => {
	let tooltipManager: TooltipManager;
	let mockElement: HTMLElement;

	beforeEach(() => {
		tooltipManager = new TooltipManager({
			enabled: true,
			showOnHover: false,
			autoHideDelay: 1000,
			essentialOnly: true
		});

		// Create a mock DOM element
		mockElement = document.createElement('div');
		mockElement.textContent = 'Short text';
		document.body.appendChild(mockElement);
	});

	afterEach(() => {
		tooltipManager.destroy();
		document.body.removeChild(mockElement);
	});

	describe('shouldShowTooltip with essential-only strategy', () => {
		it('should return false for non-essential contexts', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, 'Some tooltip content', 'info');
			expect(result).toBe(false);
		});

		it('should return true for error context', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, 'This is a much longer error message that should be shown', 'error');
			expect(result).toBe(true);
		});

		it('should return true for warning context', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, 'This is a much longer warning message that should be shown', 'warning');
			expect(result).toBe(true);
		});

		it('should return true for action-required context', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, 'This is a much longer action required message that should be shown', 'action-required');
			expect(result).toBe(true);
		});

		it('should return true for critical-info context', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, 'This is a much longer critical info message that should be shown', 'critical-info');
			expect(result).toBe(true);
		});

		it('should return false during scrolling even for essential contexts', () => {
			// Mark scrolling as started
			tooltipManager.markScrollingStart();

			const result = tooltipManager.shouldShowTooltip(mockElement, 'This is a much longer error message', 'error');
			expect(result).toBe(false);
		});
	});

	describe('scrolling detection', () => {
		it('should mark scrolling state and hide tooltips', () => {
			// First show a tooltip
			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer error message that should be shown', 'error');
			expect(mockElement.getAttribute('title')).toBeTruthy();

			// Mark scrolling start
			tooltipManager.markScrollingStart();

			// Tooltip should be hidden
			expect(mockElement.getAttribute('title')).toBeNull();
		});

		it('should prevent tooltips during scrolling', () => {
			tooltipManager.markScrollingStart();

			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer error message', 'error');
			expect(mockElement.getAttribute('title')).toBeNull();
		});
	});

	describe('intentional interaction tooltips', () => {
		it('should show tooltip on click interaction', () => {
			tooltipManager.showTooltipOnIntentionalInteraction(
				mockElement,
				'This is a much longer error message that should be shown',
				'error',
				'click'
			);

			expect(mockElement.getAttribute('title')).toBe('This is a much longer error message that should be shown');
		});

		it('should not show tooltip on click during scrolling', () => {
			tooltipManager.markScrollingStart();

			tooltipManager.showTooltipOnIntentionalInteraction(
				mockElement,
				'This is a much longer error message',
				'error',
				'click'
			);

			expect(mockElement.getAttribute('title')).toBeNull();
		});

		it('should debounce rapid interactions', () => {
			// First interaction
			tooltipManager.showTooltipOnIntentionalInteraction(
				mockElement,
				'First message',
				'error',
				'click'
			);

			// Immediate second interaction (should be debounced)
			tooltipManager.showTooltipOnIntentionalInteraction(
				mockElement,
				'Second message',
				'error',
				'click'
			);

			// Should still show first message
			expect(mockElement.getAttribute('title')).toBe('First message');
		});
	});

	describe('enhanced styling', () => {
		it('should apply CSS classes and data attributes for styling', () => {
			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer error message that should be shown', 'error');

			expect(mockElement.classList.contains('joplin-tooltip-element')).toBe(true);
			expect(mockElement.getAttribute('data-tooltip-context')).toBe('essential');
			expect(mockElement.getAttribute('data-context')).toBe('error');
		});

		it('should remove styling when hiding tooltip', () => {
			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer error message that should be shown', 'error');

			// Verify styling is applied
			expect(mockElement.classList.contains('joplin-tooltip-element')).toBe(true);

			tooltipManager.hideTooltip(mockElement);

			// Verify styling is removed
			expect(mockElement.classList.contains('joplin-tooltip-element')).toBe(false);
			expect(mockElement.getAttribute('data-tooltip-context')).toBeNull();
			expect(mockElement.getAttribute('data-context')).toBeNull();
		});
	});

	describe('quick auto-hide functionality', () => {
		it('should auto-hide tooltips quickly (max 2 seconds)', (done) => {
			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer error message that should be shown', 'error');

			expect(mockElement.getAttribute('title')).toBeTruthy();

			// Should hide within 2 seconds (our max quick hide delay)
			setTimeout(() => {
				expect(mockElement.getAttribute('title')).toBeNull();
				done();
			}, 1100); // Test at 1.1 seconds (should be hidden by then)
		});
	});
});