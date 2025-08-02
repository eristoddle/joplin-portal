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
			// This will be implemented when the API service is integrated
			// For now, show a placeholder message
			this.displayNoResults('Search functionality will be connected to Joplin API service in the next task');
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

		results.forEach((result, index) => {
			const resultItem = this.resultsContainer.createDiv('joplin-result-item');

			// Note title
			const titleEl = resultItem.createDiv('joplin-result-title');
			titleEl.setText(result.note.title);

			// Note snippet
			const snippetEl = resultItem.createDiv('joplin-result-snippet');
			snippetEl.setText(result.snippet);

			// Note metadata
			const metadataEl = resultItem.createDiv('joplin-result-metadata');
			const createdDate = new Date(result.note.created_time).toLocaleDateString();
			metadataEl.setText(`Created: ${createdDate}`);

			// Click handler for result selection
			resultItem.addEventListener('click', () => {
				this.selectResult(index);
			});

			// Add selection styling
			resultItem.addClass('joplin-result-clickable');
		});
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
		}

		// Show preview (placeholder for now)
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
}