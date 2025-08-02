import { ItemView, WorkspaceLeaf } from 'obsidian';
import JoplinPortalPlugin from '../main';
import { SearchResult, JoplinNote } from './types';

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
		if (!this.plugin.joplinService.isConfigured()) {
			this.displayNoResults('Please configure your Joplin server connection in settings');
			return;
		}

		// Show loading state
		this.displayLoading();

		try {
			// Use actual API service to search notes
			const results = await this.plugin.joplinService.searchNotes(query, {
				limit: this.plugin.settings.searchLimit || 50
			});

			this.displayResults(results);
		} catch (error) {
			console.error('Search error:', error);
			this.displayNoResults('Search failed. Please check your connection settings.');
		}
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

	private async showPreview(result: SearchResult): Promise<void> {
		this.previewContainer.empty();

		// Preview header with note title
		const previewHeader = this.previewContainer.createDiv('joplin-preview-note-header');
		const titleEl = previewHeader.createEl('h4', { text: result.note.title });
		titleEl.setAttribute('title', result.note.title); // Tooltip for long titles

		// Show loading state
		const loadingDiv = this.previewContainer.createDiv('joplin-preview-loading');
		loadingDiv.setText('Loading note content...');

		try {
			// Get full note content from API
			const fullNote = await this.plugin.joplinService.getNote(result.note.id);

			// Remove loading indicator
			loadingDiv.remove();

			if (!fullNote) {
				this.showPreviewError('Note not found or could not be loaded');
				return;
			}

			// Preview content with rendered markdown
			const previewContent = this.previewContainer.createDiv('joplin-preview-content');
			await this.renderNoteContent(previewContent, fullNote);

			// Note metadata
			const previewMeta = this.previewContainer.createDiv('joplin-preview-metadata');
			this.renderNoteMetadata(previewMeta, fullNote);

		} catch (error) {
			// Remove loading indicator
			loadingDiv.remove();

			console.error('Failed to load note preview:', error);
			this.showPreviewError('Failed to load note content. Please check your connection.');
		}
	}

	private showPreviewError(message: string): void {
		const errorDiv = this.previewContainer.createDiv('joplin-preview-error');
		errorDiv.setText(message);
	}

	private async renderNoteContent(container: HTMLElement, note: JoplinNote): Promise<void> {
		// Create content wrapper
		const contentWrapper = container.createDiv('joplin-preview-content-wrapper');

		if (!note.body || note.body.trim() === '') {
			contentWrapper.createDiv('joplin-preview-empty').setText('This note is empty');
			return;
		}

		// Convert Joplin markdown to HTML for preview
		const htmlContent = await this.convertMarkdownToHtml(note.body);

		// Create scrollable content area
		const scrollableContent = contentWrapper.createDiv('joplin-preview-scrollable');
		scrollableContent.innerHTML = htmlContent;

		// Add click handlers for internal links (future enhancement)
		this.addLinkHandlers(scrollableContent);
	}

	private async convertMarkdownToHtml(markdown: string): Promise<string> {
		// Basic markdown to HTML conversion
		// This is a simplified implementation - in a real plugin you might want to use
		// Obsidian's markdown renderer or a more robust markdown parser

		let html = markdown;

		// Convert headers
		html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
		html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
		html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

		// Convert bold and italic
		html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
		html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

		// Convert code blocks
		html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
		html = html.replace(/`(.*?)`/g, '<code>$1</code>');

		// Convert links
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

		// Convert line breaks
		html = html.replace(/\n\n/g, '</p><p>');
		html = html.replace(/\n/g, '<br>');

		// Wrap in paragraphs
		html = '<p>' + html + '</p>';

		// Clean up empty paragraphs
		html = html.replace(/<p><\/p>/g, '');
		html = html.replace(/<p><br><\/p>/g, '');

		// Convert lists (basic implementation)
		html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
		html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

		// Convert numbered lists
		html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
		html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

		return html;
	}

	private addLinkHandlers(container: HTMLElement): void {
		// Add handlers for external links to open in browser
		const links = container.querySelectorAll('a[href]');
		links.forEach(link => {
			const href = link.getAttribute('href');
			if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
				link.addEventListener('click', (e) => {
					e.preventDefault();
					// In a real Obsidian plugin, you would use:
					// window.open(href, '_blank');
					console.log('Would open external link:', href);
				});
			}
		});
	}

	private renderNoteMetadata(container: HTMLElement, note: JoplinNote): void {
		// Clear existing content
		container.empty();

		// Create metadata grid
		const metadataGrid = container.createDiv('joplin-preview-metadata-grid');

		// Created date
		const createdDiv = metadataGrid.createDiv('joplin-metadata-item');
		createdDiv.createSpan('joplin-metadata-label').setText('Created:');
		const createdDate = new Date(note.created_time);
		createdDiv.createSpan('joplin-metadata-value').setText(
			createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString()
		);

		// Updated date (only show if different from created)
		const updatedDate = new Date(note.updated_time);
		if (Math.abs(updatedDate.getTime() - createdDate.getTime()) > 60000) { // More than 1 minute difference
			const updatedDiv = metadataGrid.createDiv('joplin-metadata-item');
			updatedDiv.createSpan('joplin-metadata-label').setText('Updated:');
			updatedDiv.createSpan('joplin-metadata-value').setText(
				updatedDate.toLocaleDateString() + ' ' + updatedDate.toLocaleTimeString()
			);
		}

		// Note ID (for debugging/reference)
		const idDiv = metadataGrid.createDiv('joplin-metadata-item');
		idDiv.createSpan('joplin-metadata-label').setText('ID:');
		const idValue = idDiv.createSpan('joplin-metadata-value');
		idValue.setText(note.id);
		idValue.addClass('joplin-metadata-id');

		// Source URL if available
		if (note.source_url) {
			const sourceDiv = metadataGrid.createDiv('joplin-metadata-item');
			sourceDiv.createSpan('joplin-metadata-label').setText('Source:');
			const sourceLink = sourceDiv.createEl('a', {
				href: note.source_url,
				text: 'View Source',
				cls: 'joplin-metadata-link'
			});
			sourceLink.setAttribute('target', '_blank');
			sourceLink.setAttribute('rel', 'noopener');
		}

		// Tags if available
		if (note.tags && note.tags.length > 0) {
			const tagsDiv = metadataGrid.createDiv('joplin-metadata-item joplin-metadata-tags');
			tagsDiv.createSpan('joplin-metadata-label').setText('Tags:');
			const tagsContainer = tagsDiv.createDiv('joplin-metadata-tags-container');

			note.tags.forEach(tag => {
				const tagEl = tagsContainer.createSpan('joplin-metadata-tag');
				tagEl.setText(`#${tag}`);
			});
		}

		// Word count
		const wordCount = this.calculateWordCount(note.body);
		if (wordCount > 0) {
			const wordCountDiv = metadataGrid.createDiv('joplin-metadata-item');
			wordCountDiv.createSpan('joplin-metadata-label').setText('Words:');
			wordCountDiv.createSpan('joplin-metadata-value').setText(wordCount.toString());
		}
	}

	private calculateWordCount(text: string): number {
		if (!text || text.trim() === '') return 0;

		// Remove markdown formatting and count words
		const cleanText = text
			.replace(/[#*_`~\[\]()]/g, '') // Remove markdown characters
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();

		return cleanText ? cleanText.split(' ').length : 0;
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