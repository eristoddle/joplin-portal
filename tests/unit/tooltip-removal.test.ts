import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JoplinPortalView } from '../../src/joplin-portal-view';
import { SearchResult, JoplinNote } from '../../src/types';

// Mock Obsidian classes
vi.mock('obsidian', () => ({
	ItemView: class MockItemView {
		containerEl = {
			children: [null, document.createElement('div')]
		};
		leaf = {};
		app = {};
	},
	Notice: vi.fn(),
	MarkdownRenderer: {
		render: vi.fn().mockResolvedValue(undefined)
	}
}));

// Mock the plugin
const mockPlugin = {
	settings: {
		searchLimit: 50,
		defaultImportFolder: 'Imported from Joplin'
	},
	joplinService: {
		searchNotes: vi.fn(),
		searchNotesByTags: vi.fn(),
		getNote: vi.fn(),
		processNoteBodyForPreview: vi.fn().mockReturnValue('processed body'),
		getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0, size: 0 })
	},
	importService: {
		checkForConflicts: vi.fn().mockReturnValue({ conflicts: [] })
	},
	getConfigurationStatus: vi.fn().mockReturnValue({
		isConfigured: true,
		hasServerUrl: true,
		hasApiToken: true
	})
};

describe('Tooltip Removal in JoplinPortalView', () => {
	let view: JoplinPortalView;
	let container: HTMLElement;

	beforeEach(() => {
		// Create a mock leaf
		const mockLeaf = {} as any;

		view = new JoplinPortalView(mockLeaf, mockPlugin as any);

		// Set up DOM
		container = document.createElement('div');
		document.body.appendChild(container);

		// Mock the containerEl
		view.containerEl = {
			children: [null, container]
		} as any;
	});

	afterEach(() => {
		if (container.parentNode) {
			document.body.removeChild(container);
		}
		view.onClose();
	});

	it('should not add title attributes to search result titles', async () => {
		await view.onOpen();

		// Create mock search results
		const mockResults: SearchResult[] = [
			{
				note: {
					id: '1',
					title: 'Test Note with a Very Long Title That Would Normally Get a Tooltip',
					body: 'Test body',
					created_time: Date.now(),
					updated_time: Date.now(),
					parent_id: 'parent1'
				},
				snippet: 'Test snippet',
				relevance: 1,
				selected: false,
				markedForImport: false
			}
		];

		// Simulate displaying results
		(view as any).displayResults(mockResults);

		// Check that no title attributes are set on result titles
		const titleElements = container.querySelectorAll('.joplin-result-title');
		titleElements.forEach(titleEl => {
			expect(titleEl.getAttribute('title')).toBeNull();
		});
	});

	it('should not add title attributes to search result snippets', async () => {
		await view.onOpen();

		// Create mock search results
		const mockResults: SearchResult[] = [
			{
				note: {
					id: '1',
					title: 'Test Note',
					body: 'Test body',
					created_time: Date.now(),
					updated_time: Date.now(),
					parent_id: 'parent1'
				},
				snippet: 'This is a very long snippet that would normally get a tooltip to show the full content when truncated',
				relevance: 1,
				selected: false,
				markedForImport: false
			}
		];

		// Simulate displaying results
		(view as any).displayResults(mockResults);

		// Check that no title attributes are set on snippets
		const snippetElements = container.querySelectorAll('.joplin-result-snippet');
		snippetElements.forEach(snippetEl => {
			expect(snippetEl.getAttribute('title')).toBeNull();
		});
	});

	it('should not add title attributes to preview headers', async () => {
		await view.onOpen();

		const mockResult: SearchResult = {
			note: {
				id: '1',
				title: 'Test Note with a Very Long Title That Would Normally Get a Tooltip in Preview',
				body: 'Test body content',
				created_time: Date.now(),
				updated_time: Date.now(),
				parent_id: 'parent1'
			},
			snippet: 'Test snippet',
			relevance: 1,
			selected: false,
			markedForImport: false
		};

		// Mock the getNote method to return the full note
		mockPlugin.joplinService.getNote.mockResolvedValue(mockResult.note);

		// Simulate showing preview
		await (view as any).showPreview(mockResult);

		// Check that no title attributes are set on preview headers
		const previewHeaders = container.querySelectorAll('.joplin-preview-note-header h4');
		previewHeaders.forEach(headerEl => {
			expect(headerEl.getAttribute('title')).toBeNull();
		});
	});

	it('should hide tooltips when scrolling', async () => {
		await view.onOpen();

		// Get the tooltip manager
		const tooltipManager = (view as any).tooltipManager;

		// Spy on hideAllTooltips method
		const hideAllTooltipsSpy = vi.spyOn(tooltipManager, 'hideAllTooltips');

		// Simulate scroll event on results container
		const resultsContainer = container.querySelector('.joplin-results-container');
		if (resultsContainer) {
			const scrollEvent = new Event('scroll');
			resultsContainer.dispatchEvent(scrollEvent);
		}

		expect(hideAllTooltipsSpy).toHaveBeenCalled();
	});

	it('should initialize tooltip manager with minimal intrusive settings', async () => {
		await view.onOpen();

		const tooltipManager = (view as any).tooltipManager;
		const config = tooltipManager.getConfig();

		expect(config.enabled).toBe(true);
		expect(config.showOnHover).toBe(false); // Prevent hover tooltips during scrolling
		expect(config.essentialOnly).toBe(true); // Only show essential tooltips
		expect(config.autoHideDelay).toBe(1500); // Quick auto-hide
	});
});