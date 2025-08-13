import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TooltipManager } from '../../src/tooltip-manager';

describe('TooltipManager', () => {
	let tooltipManager: TooltipManager;
	let mockElement: HTMLElement;

	beforeEach(() => {
		tooltipManager = new TooltipManager();

		// Create a mock DOM element
		mockElement = document.createElement('div');
		mockElement.textContent = 'Short text';
		document.body.appendChild(mockElement);
	});

	afterEach(() => {
		tooltipManager.destroy();
		document.body.removeChild(mockElement);
	});

	describe('shouldShowTooltip', () => {
		it('should return false when tooltips are disabled', () => {
			tooltipManager.updateConfig({ enabled: false });

			const result = tooltipManager.shouldShowTooltip(mockElement, 'Some tooltip content', 'info');

			expect(result).toBe(false);
		});

		it('should return false for non-essential contexts when essentialOnly is true', () => {
			tooltipManager.updateConfig({ essentialOnly: true });

			const result = tooltipManager.shouldShowTooltip(mockElement, 'Some tooltip content', 'info');

			expect(result).toBe(false);
		});

		it('should return true for essential contexts', () => {
			tooltipManager.updateConfig({ essentialOnly: true });

			const result = tooltipManager.shouldShowTooltip(mockElement, 'Some tooltip content', 'error');

			expect(result).toBe(true);
		});

		it('should return false for empty content', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, '', 'error');

			expect(result).toBe(false);
		});

		it('should return false for very short content', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, 'Hi', 'error');

			expect(result).toBe(false);
		});

		it('should return false when content matches element text exactly', () => {
			const result = tooltipManager.shouldShowTooltip(mockElement, 'Short text', 'error');

			expect(result).toBe(false);
		});
	});

	describe('showEssentialTooltip', () => {
		it('should set title attribute when tooltip should be shown', () => {
			tooltipManager.updateConfig({ essentialOnly: true });

			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer tooltip content that should be shown', 'error');

			expect(mockElement.getAttribute('title')).toBe('This is a much longer tooltip content that should be shown');
		});

		it('should not set title attribute when tooltip should not be shown', () => {
			tooltipManager.updateConfig({ essentialOnly: true });

			tooltipManager.showEssentialTooltip(mockElement, 'Short text', 'info');

			expect(mockElement.getAttribute('title')).toBeNull();
		});

		it('should auto-hide tooltip after delay', async () => {
			tooltipManager.updateConfig({
				essentialOnly: true,
				autoHideDelay: 100
			});

			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer tooltip content that should be shown', 'error');

			expect(mockElement.getAttribute('title')).toBe('This is a much longer tooltip content that should be shown');

			await new Promise(resolve => setTimeout(resolve, 150));
			expect(mockElement.getAttribute('title')).toBeNull();
		});
	});

	describe('hideTooltip', () => {
		it('should remove title attribute', () => {
			mockElement.setAttribute('title', 'Some tooltip');

			tooltipManager.hideTooltip(mockElement);

			expect(mockElement.getAttribute('title')).toBeNull();
		});
	});

	describe('hideAllTooltips', () => {
		it('should remove all active tooltips', () => {
			const element1 = document.createElement('div');
			const element2 = document.createElement('div');
			document.body.appendChild(element1);
			document.body.appendChild(element2);

			tooltipManager.updateConfig({ essentialOnly: true });
			tooltipManager.showEssentialTooltip(element1, 'This is a much longer tooltip content that should be shown', 'error');
			tooltipManager.showEssentialTooltip(element2, 'Another much longer tooltip content that should be shown', 'error');

			expect(element1.getAttribute('title')).toBeTruthy();
			expect(element2.getAttribute('title')).toBeTruthy();

			tooltipManager.hideAllTooltips();

			expect(element1.getAttribute('title')).toBeNull();
			expect(element2.getAttribute('title')).toBeNull();

			document.body.removeChild(element1);
			document.body.removeChild(element2);
		});
	});

	describe('updateConfig', () => {
		it('should update configuration', () => {
			tooltipManager.updateConfig({ enabled: false, autoHideDelay: 5000 });

			const config = tooltipManager.getConfig();

			expect(config.enabled).toBe(false);
			expect(config.autoHideDelay).toBe(5000);
		});

		it('should hide all tooltips when disabled', () => {
			tooltipManager.updateConfig({ essentialOnly: true });
			tooltipManager.showEssentialTooltip(mockElement, 'This is a much longer tooltip content that should be shown', 'error');

			expect(mockElement.getAttribute('title')).toBeTruthy();

			tooltipManager.updateConfig({ enabled: false });

			expect(mockElement.getAttribute('title')).toBeNull();
		});
	});
});