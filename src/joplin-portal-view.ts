import { ItemView, WorkspaceLeaf } from 'obsidian';
import JoplinPortalPlugin from '../main';
import { SearchResult } from './types';

export const VIEW_TYPE_JOPLIN_PORTAL = 'joplin-portal-view';

export class JoplinPortalView extends ItemView {
	plugin: JoplinPortalPlugin;
	searchInput: HTMLInputElement;
	searchButton: HTMLButtonElement;
	resultsContainer: HTMLElement;
	previewContainer: HTMLElement;
	currentResults: SearchResult[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: JoplinPortalPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_JOPLIN_PORTAL;
	}

	getDisplayText(): string {
		return 'Joplin Portal';
	}

	getIcon(): string {
		return 'search';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('joplin-portal-view');

		// Create main layout
		this.createSearchInterface(container);
		this.createResultsContainer(container);
		this.createPreviewContainer(container);
	}

	async onClose(): Promise<void> {
		// Cleanup if needed
	}

	private createSearchInterface(container: Element): void {
		const searchContainer = container.createDiv('joplin-search-container');

		// Search input
		this.searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search Joplin notes...',
			cls: 'joplin-search-input'
		});

		// Search button
		this.searchButton = searchContainer.createEl('button', {
			text: 'Search',
			cls: 'joplin-search-button mod-cta'
		});

		// Add event listeners
		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this.performSearch();
			}
		});

		this.searchButton.addEventListener('click', () => {
			this.performSearch();
		});

		// Add input debouncing for real-time search (future enhancement)
		this.searchInput.addEventListener('input', () => {
			// Placeholder for debounced search implementation
		});

		// Add keyboard navigation for results
		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowDown' && this.currentResults.length > 0) {
				e.preventDefault();
				this.navigateResults('down');
			} else if (e.key === 'ArrowUp' && this.currentResults.length > 0) {
				e.preventDefault();
				this.navigateResults('up');
			}
		});
	}

	private createResultsContainer(container: Element): void {
		const resultsSection = container.createDiv('joplin-results-section');

		// Results header
		const resultsHeader = resultsSection.createDiv('joplin-results-header');
		resultsHeader.createEl('h3', { text: 'Search Results' });

		// Results container
		this.resultsContainer = resultsSection.createDiv('joplin-results-container');
		this.resultsContainer.createDiv('joplin-no-results').setText('Enter a search query to find notes');
	}

	private createPreviewContainer(container: Element): void {
		const previewSection = container.createDiv('joplin-preview-section');

		// Preview header
		const previewHeader = previewSection.createDiv('joplin-preview-header');
		previewHeader.createEl('h3', { text: 'Preview' });

		// Preview container
		this.previewContainer = previewSection.createDiv('joplin-preview-container');
		this.previewContainer.createDiv('joplin-no-preview').setText('Select a note to preview');
	}

	private async performSearch(): Promise<void> {
		const query = this.searchInput.value.trim();

		if (!query) {
			this.displayNoResults('Please enter a search query');
			return;
		}

		// Check if API service is available and configured
		if (!this.plugin.settings.apiToken || !this.plugin.settings.serverUrl) {
			this.displayNoResults('Please configure your Joplin server connection in settings');
			return;
		}

		// Show loading state
		this.displayLoading();

		try {
			// For now, show mock results to demonstrate the search results display
			// This will be replaced with actual API integration in the next task
			const mockResults = this.createMockSearchResults(query);

			// Simulate API delay
			setTimeout(() => {
				this.displayResults(mockResults);
			}, 500);
		} catch (error) {
			console.error('Search error:', error);
			this.displayNoResults('Search failed. Please check your connection settings.');
		}
	}

	/**
	 * Create mock search results for testing the display functionality
	 * This will be removed when actual API integration is implemented
	 */
	private createMockSearchResults(query: string): SearchResult[] {
		const mockNotes: JoplinNote[] = [
			{
				id: '1',
				title: `Meeting Notes - ${query} Discussion`,
				body: `This is a detailed note about ${query} that contains important information and insights from our recent meeting. The discussion covered various aspects and considerations.`,
				created_time: Date.now() - 86400000, // 1 day ago
				updated_time: Date.now() - 3600000, // 1 hour ago
				parent_id: 'folder1',
				tags: ['meeting', 'important', 'project']
			},
			{
				id: '2',
				title: `Research on ${query}`,
				body: `Comprehensive research findings about ${query}. This document includes various sources, references, and detailed analysis of the topic.`,
				created_time: Date.now() - 172800000, // 2 days ago
				updated_time: Date.now() - 172800000, // Same as created
				parent_id: 'folder2',
				tags: ['research', 'analysis']
			},
			{
				id: '3',
				title: 'Quick Note',
				body: `A brief note mentioning ${query} in passing. Not much detail here, just a quick reminder.`,
				created_time: Date.now() - 3600000, // 1 hour ago
				updated_time: Date.now() - 1800000, // 30 minutes ago
				parent_id: 'folder1',
				tags: ['quick', 'reminder', 'todo', 'urgent', 'followup']
			}
		];

		return mockNotes.map((note, index) => ({
			note,
			snippet: note.body.substring(0, 150) + (note.body.length > 150 ? '...' : ''),
			relevance: 1 - (index * 0.1),
			selected: false
		}));
	}

	private displayLoading(): void {
		this.resultsContainer.empty();
		const loadingDiv = this.resultsContainer.createDiv('joplin-loading');
		loadingDiv.setText('Searching...');
	}

	private displayNoResults(message: string): void {
		this.resultsContainer.empty();
		const noResultsDiv = this.resultsContainer.createDiv('joplin-no-results');
		noResultsDiv.setText(message);
	}

	private displayResults(results: SearchResult[]): void {
		this.currentResults = results;
		this.resultsContainer.empty();

		if (results.length === 0) {
			this.displayNoResults('No notes found');
			return;
		}

		// Create results list container
		const resultsList = this.resultsContainer.createDiv('joplin-results-list');

		results.forEach((result, index) => {
			const resultItem = resultsList.createDiv('joplin-result-item');
			resultItem.setAttribute('data-index', index.toString());

			// Create result content wrapper
			const resultContent = resultItem.createDiv('joplin-result-content');

			// Note title with proper truncation
			const titleEl = resultContent.createDiv('joplin-result-title');
			titleEl.setText(result.note.title || 'Untitled Note');
			titleEl.setAttribute('title', result.note.title || 'Untitled Note'); // Tooltip for full title

			// Note snippet with proper formatting
			const snippetEl = resultContent.createDiv('joplin-result-snippet');
			const cleanSnippet = this.formatSnippet(result.snippet);
			snippetEl.setText(cleanSnippet);
			snippetEl.setAttribute('title', cleanSnippet); // Tooltip for full snippet

			// Note metadata with enhanced information
			const metadataEl = resultContent.createDiv('joplin-result-metadata');
			const metadataContent = this.createMetadataContent(result.note);
			metadataEl.appendChild(metadataContent);

			// Add tags if available
			if (result.note.tags && result.note.tags.length > 0) {
				const tagsEl = resultContent.createDiv('joplin-result-tags');
				result.note.tags.slice(0, 3).forEach(tag => { // Show max 3 tags
					const tagEl = tagsEl.createSpan('joplin-result-tag');
					tagEl.setText(`#${tag}`);
				});
				if (result.note.tags.length > 3) {
					const moreTagsEl = tagsEl.createSpan('joplin-result-tag-more');
					moreTagsEl.setText(`+${result.note.tags.length - 3} more`);
				}
			}

			// Add selection indicator
			const selectionIndicator = resultItem.createDiv('joplin-result-selection-indicator');

			// Click handler for result selection
			resultItem.addEventListener('click', (e) => {
				e.preventDefault();
				this.selectResult(index);
			});

			// Keyboard navigation support
			resultItem.setAttribute('tabindex', '0');
			resultItem.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this.selectResult(index);
				}
			});

			// Add hover effects and accessibility
			resultItem.addClass('joplin-result-clickable');
			resultItem.setAttribute('role', 'button');
			resultItem.setAttribute('aria-label', `Select note: ${result.note.title}`);
		});

		// Add results count indicator
		const resultsCount = this.resultsContainer.createDiv('joplin-results-count');
		resultsCount.setText(`${results.length} result${results.length !== 1 ? 's' : ''} found`);
	}

	private selectResult(index: number): void {
		// Remove previous selection
		this.resultsContainer.querySelectorAll('.joplin-result-selected').forEach(el => {
			el.removeClass('joplin-result-selected');
		});

		// Add selection to clicked item
		const resultItems = this.resultsContainer.querySelectorAll('.joplin-result-item');
		if (resultItems[index]) {
			resultItems[index].addClass('joplin-result-selected');

			// Update selection state in data
			this.currentResults.forEach((result, i) => {
				result.selected = i === index;
			});

			// Ensure selected item is visible
			resultItems[index].scrollIntoView({
				behavior: 'smooth',
				block: 'nearest'
			});
		}

		// Show preview
		const selectedResult = this.currentResults[index];
		if (selectedResult) {
			this.showPreview(selectedResult);
		}
	}

	private showPreview(result: SearchResult): void {
		this.previewContainer.empty();

		// Preview header with note title
		const previewHeader = this.previewContainer.createDiv('joplin-preview-note-header');
		previewHeader.createEl('h4', { text: result.note.title });

		// Preview content (placeholder)
		const previewContent = this.previewContainer.createDiv('joplin-preview-content');
		previewContent.setText('Note preview will be implemented when API service is integrated');

		// Note metadata
		const previewMeta = this.previewContainer.createDiv('joplin-preview-metadata');
		const createdDate = new Date(result.note.created_time).toLocaleDateString();
		const updatedDate = new Date(result.note.updated_time).toLocaleDateString();
		previewMeta.innerHTML = `
			<div>Created: ${createdDate}</div>
			<div>Updated: ${updatedDate}</div>
		`;
	}

	/**
	 * Format snippet text for display, removing excessive whitespace and ensuring proper length
	 */
	private formatSnippet(snippet: string): string {
		if (!snippet) return 'No preview available';

		// Remove excessive whitespace and normalize line breaks
		const cleaned = snippet
			.replace(/\s+/g, ' ') // Replace multiple whitespace with single space
			.replace(/\n+/g, ' ') // Replace line breaks with spaces
			.trim();

		// Truncate if too long (approximately 2 lines worth of text)
		const maxLength = 120;
		if (cleaned.length > maxLength) {
			return cleaned.substring(0, maxLength).trim() + '...';
		}

		return cleaned;
	}

	/**
	 * Handle keyboard navigation through search results
	 */
	private navigateResults(direction: 'up' | 'down'): void {
		if (this.currentResults.length === 0) return;

		const currentIndex = this.currentResults.findIndex(result => result.selected);
		let newIndex: number;

		if (currentIndex === -1) {
			// No selection, select first item
			newIndex = 0;
		} else {
			// Move selection up or down
			if (direction === 'down') {
				newIndex = Math.min(currentIndex + 1, this.currentResults.length - 1);
			} else {
				newIndex = Math.max(currentIndex - 1, 0);
			}
		}

		this.selectResult(newIndex);
	}

	/**
	 * Create metadata content element with formatted date and additional info
	 */
	private createMetadataContent(note: JoplinNote): DocumentFragment {
		const fragment = document.createDocumentFragment();

		// Format dates
		const createdDate = new Date(note.created_time);
		const updatedDate = new Date(note.updated_time);
		const now = new Date();

		// Create date elements
		const createdEl = document.createElement('span');
		createdEl.className = 'joplin-metadata-created';
		createdEl.textContent = `Created: ${this.formatRelativeDate(createdDate, now)}`;

		// Only show updated date if it's different from created date
		if (Math.abs(updatedDate.getTime() - createdDate.getTime()) > 60000) { // More than 1 minute difference
			const updatedEl = document.createElement('span');
			updatedEl.className = 'joplin-metadata-updated';
			updatedEl.textContent = ` • Updated: ${this.formatRelativeDate(updatedDate, now)}`;

			fragment.appendChild(createdEl);
			fragment.appendChild(updatedEl);
		} else {
			fragment.appendChild(createdEl);
		}

		return fragment;
	}

	/**
	 * Format date as relative time (e.g., "2 days ago") or absolute date for older items
	 */
	private formatRelativeDate(date: Date, now: Date): string {
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffMinutes < 1) {
			return 'Just now';
		} else if (diffMinutes < 60) {
			return `${diffMinutes}m ago`;
		} else if (diffHours < 24) {
			return `${diffHours}h ago`;
		} else if (diffDays < 7) {
			return `${diffDays}d ago`;
		} else {
			// For older items, show the actual date
			return date.toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
			});
		}
	}
}