import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from 'obsidian';
import JoplinPortalPlugin from '../main';
import { SearchResult, JoplinNote, ImportOptions, ImageProcessingOptions } from './types';
import { ErrorHandler } from './error-handler';

export const VIEW_TYPE_JOPLIN_PORTAL = 'joplin-portal-view';

export class JoplinPortalView extends ItemView {
	plugin: JoplinPortalPlugin;
	searchInput: HTMLInputElement;
	searchButton: HTMLButtonElement;
	tagSearchInput: HTMLInputElement;
	searchTypeSelect: HTMLSelectElement;
	resultsContainer: HTMLElement;
	previewContainer: HTMLElement;
	importOptionsPanel: HTMLElement;
	currentResults: SearchResult[] = [];
	importFolderInput: HTMLInputElement;
	applyTemplateCheckbox: HTMLInputElement;
	templatePathInput: HTMLInputElement;
	conflictResolutionSelect: HTMLSelectElement;
	private searchDebounceTimer: NodeJS.Timeout | null = null;
	private lastSearchQuery = '';
	private isSearching = false;
	private resizeObserver: ResizeObserver | null = null;
	private globalKeydownHandler: (e: KeyboardEvent) => void;
	private currentFocusIndex = -1;

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

		// Add ARIA attributes for accessibility
		container.setAttribute('role', 'application');
		container.setAttribute('aria-label', 'Joplin Portal - Search and import notes from Joplin');

		// Create main container with proper structure
		const mainContainer = container.createDiv('joplin-portal-container');

		// Create main layout
		this.createSearchInterface(mainContainer);
		this.createResultsContainer(mainContainer);
		this.createImportOptionsPanel(mainContainer);
		this.createPreviewContainer(mainContainer);

		// Set up global keyboard shortcuts
		this.setupGlobalKeyboardShortcuts();

		// Add resize observer for responsive behavior
		this.setupResizeObserver(container);
	}

	async onClose(): Promise<void> {
		// Cleanup debounce timer
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
			this.searchDebounceTimer = null;
		}

		// Cleanup resize observer
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}

		// Remove global keyboard listeners
		this.cleanupGlobalKeyboardShortcuts();
	}

	private createSearchInterface(container: Element): void {
		const searchContainer = container.createDiv('joplin-search-container');
		searchContainer.setAttribute('role', 'search');
		searchContainer.setAttribute('aria-label', 'Search Joplin notes');

		// Search type selector
		const searchTypeContainer = searchContainer.createDiv('joplin-search-type-container');
		const searchTypeLabel = searchTypeContainer.createEl('label', { text: 'Search type:' });
		searchTypeLabel.setAttribute('for', 'joplin-search-type-select');

		this.searchTypeSelect = searchTypeContainer.createEl('select', {
			cls: 'joplin-search-type-select'
		});
		this.searchTypeSelect.id = 'joplin-search-type-select';
		this.searchTypeSelect.setAttribute('aria-describedby', 'search-type-help');

		this.searchTypeSelect.createEl('option', { value: 'text', text: 'Text Search' });
		this.searchTypeSelect.createEl('option', { value: 'tag', text: 'Tag Search' });
		this.searchTypeSelect.createEl('option', { value: 'combined', text: 'Combined' });

		// Add help text for screen readers
		const helpText = searchContainer.createDiv('sr-only');
		helpText.id = 'search-type-help';
		helpText.textContent = 'Choose between text search, tag search, or combined search modes';

		// Search inputs container
		const searchInputsContainer = searchContainer.createDiv('joplin-search-inputs');

		// Main search input
		this.searchInput = searchInputsContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search Joplin notes...',
			cls: 'joplin-search-input'
		});
		this.searchInput.setAttribute('aria-label', 'Search text in Joplin notes');
		this.searchInput.setAttribute('aria-describedby', 'search-help');

		// Tag search input (initially hidden)
		this.tagSearchInput = searchInputsContainer.createEl('input', {
			type: 'text',
			placeholder: 'Enter tags separated by commas (e.g., work, project)',
			cls: 'joplin-tag-search-input'
		});
		this.tagSearchInput.style.display = 'none';
		this.tagSearchInput.setAttribute('aria-label', 'Search by tags in Joplin notes');
		this.tagSearchInput.setAttribute('aria-describedby', 'tag-search-help');

		// Search button
		this.searchButton = searchInputsContainer.createEl('button', {
			text: 'Search',
			cls: 'joplin-search-button mod-cta'
		});
		this.searchButton.setAttribute('aria-describedby', 'search-shortcuts-help');

		// Add help text for keyboard shortcuts
		const shortcutsHelp = searchContainer.createDiv('sr-only');
		shortcutsHelp.id = 'search-shortcuts-help';
		shortcutsHelp.textContent = 'Keyboard shortcuts: Ctrl+F to focus search, Enter to search, Escape to clear';

		const searchHelp = searchContainer.createDiv('sr-only');
		searchHelp.id = 'search-help';
		searchHelp.textContent = 'Enter text to search in note titles and content';

		const tagSearchHelp = searchContainer.createDiv('sr-only');
		tagSearchHelp.id = 'tag-search-help';
		tagSearchHelp.textContent = 'Enter comma-separated tags to search for notes with specific tags';

		// Cache status indicator
		const cacheStatus = searchContainer.createDiv('joplin-cache-status');
		cacheStatus.style.fontSize = '0.8em';
		cacheStatus.style.color = 'var(--text-muted)';
		cacheStatus.style.marginTop = '4px';

		// Add event listeners
		this.searchTypeSelect.addEventListener('change', () => {
			this.updateSearchInterface();
		});

		this.searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this.performSearch();
			}
		});

		this.tagSearchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				this.performSearch();
			}
		});

		this.searchButton.addEventListener('click', () => {
			this.performSearch();
		});

		// Add debounced search on input
		this.searchInput.addEventListener('input', () => {
			this.debouncedSearch();
		});

		this.tagSearchInput.addEventListener('input', () => {
			this.debouncedSearch();
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

		// Update interface based on initial selection
		this.updateSearchInterface();
	}

	private createResultsContainer(container: Element): void {
		const resultsSection = container.createDiv('joplin-results-section');

		// Results header
		const resultsHeader = resultsSection.createDiv('joplin-results-header');
		const resultsTitle = resultsHeader.createEl('h3', { text: 'Search Results' });
		resultsTitle.id = 'search-results-title';

		// Results container
		this.resultsContainer = resultsSection.createDiv('joplin-results-container');
		this.resultsContainer.setAttribute('role', 'listbox');
		this.resultsContainer.setAttribute('aria-labelledby', 'search-results-title');
		this.resultsContainer.setAttribute('aria-describedby', 'results-help');

		// Add help text for keyboard navigation
		const resultsHelp = resultsSection.createDiv('sr-only');
		resultsHelp.id = 'results-help';
		resultsHelp.textContent = 'Use arrow keys to navigate results, Enter to select, Space to toggle import selection';

		this.resultsContainer.createDiv('joplin-no-results').setText('Enter a search query to find notes');
	}

	private createImportOptionsPanel(container: Element): void {
		const importSection = container.createDiv('joplin-import-section');
		importSection.style.display = 'none'; // Initially hidden

		// Import header
		const importHeader = importSection.createDiv('joplin-import-header');
		importHeader.createEl('h3', { text: 'Import Options' });

		// Import options container
		this.importOptionsPanel = importSection.createDiv('joplin-import-options');

		// Selected notes count
		const selectedCountDiv = this.importOptionsPanel.createDiv('joplin-selected-count');
		selectedCountDiv.createSpan('joplin-selected-count-text').setText('0 notes selected for import');

		// Import folder selection
		const folderDiv = this.importOptionsPanel.createDiv('joplin-import-folder');
		folderDiv.createEl('label', { text: 'Import to folder:' });
		this.importFolderInput = folderDiv.createEl('input', {
			type: 'text',
			placeholder: 'Enter folder path (e.g., "Imported from Joplin")',
			cls: 'joplin-import-folder-input'
		});
		this.importFolderInput.value = this.plugin.settings.defaultImportFolder || 'Imported from Joplin';

		// Template options
		const templateDiv = this.importOptionsPanel.createDiv('joplin-import-template');
		const templateCheckboxDiv = templateDiv.createDiv('joplin-template-checkbox-div');
		this.applyTemplateCheckbox = templateCheckboxDiv.createEl('input', {
			type: 'checkbox',
			cls: 'joplin-apply-template-checkbox'
		});
		templateCheckboxDiv.createEl('label', { text: 'Apply template' });

		const templatePathDiv = templateDiv.createDiv('joplin-template-path-div');
		templatePathDiv.style.display = 'none'; // Initially hidden
		templatePathDiv.createEl('label', { text: 'Template path:' });
		this.templatePathInput = templatePathDiv.createEl('input', {
			type: 'text',
			placeholder: 'Path to template file (optional)',
			cls: 'joplin-template-path-input'
		});

		// Conflict resolution
		const conflictDiv = this.importOptionsPanel.createDiv('joplin-import-conflict');
		conflictDiv.createEl('label', { text: 'If file exists:' });
		this.conflictResolutionSelect = conflictDiv.createEl('select', {
			cls: 'joplin-conflict-resolution-select'
		});
		this.conflictResolutionSelect.createEl('option', { value: 'skip', text: 'Skip' });
		this.conflictResolutionSelect.createEl('option', { value: 'overwrite', text: 'Overwrite' });
		this.conflictResolutionSelect.createEl('option', { value: 'rename', text: 'Rename' });
		this.conflictResolutionSelect.value = 'skip';

		// Import buttons
		const buttonsDiv = this.importOptionsPanel.createDiv('joplin-import-buttons');
		const selectAllBtn = buttonsDiv.createEl('button', {
			text: 'Select All',
			cls: 'joplin-select-all-btn'
		});
		const clearSelectionBtn = buttonsDiv.createEl('button', {
			text: 'Clear Selection',
			cls: 'joplin-clear-selection-btn'
		});
		const importBtn = buttonsDiv.createEl('button', {
			text: 'Import Selected',
			cls: 'joplin-import-btn mod-cta'
		});

		// Event listeners
		this.applyTemplateCheckbox.addEventListener('change', () => {
			templatePathDiv.style.display = this.applyTemplateCheckbox.checked ? 'block' : 'none';
		});

		selectAllBtn.addEventListener('click', () => {
			this.selectAllForImport();
		});

		clearSelectionBtn.addEventListener('click', () => {
			this.clearImportSelection();
		});

		importBtn.addEventListener('click', () => {
			this.showImportConfirmationDialog();
		});
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

	/**
	 * Update search interface based on selected search type
	 */
	private updateSearchInterface(): void {
		const searchType = this.searchTypeSelect.value;

		switch (searchType) {
			case 'text':
				this.searchInput.style.display = 'block';
				this.tagSearchInput.style.display = 'none';
				this.searchInput.placeholder = 'Search Joplin notes...';
				break;
			case 'tag':
				this.searchInput.style.display = 'none';
				this.tagSearchInput.style.display = 'block';
				break;
			case 'combined':
				this.searchInput.style.display = 'block';
				this.tagSearchInput.style.display = 'block';
				this.searchInput.placeholder = 'Search text in notes...';
				break;
		}
	}

	/**
	 * Debounced search to prevent excessive API calls
	 */
	private debouncedSearch(): void {
		// Clear existing timer
		if (this.searchDebounceTimer) {
			clearTimeout(this.searchDebounceTimer);
		}

		// Don't search if already searching
		if (this.isSearching) {
			return;
		}

		// Set new timer for 500ms delay
		this.searchDebounceTimer = setTimeout(() => {
			this.performSearch();
		}, 500);
	}

	/**
	 * Update cache status display
	 */
	private updateCacheStatus(): void {
		const cacheStatus = this.containerEl.querySelector('.joplin-cache-status');
		if (cacheStatus) {
			const stats = this.plugin.joplinService.getCacheStats();
			const hitRatio = stats.hits + stats.misses > 0
				? Math.round((stats.hits / (stats.hits + stats.misses)) * 100)
				: 0;

			cacheStatus.textContent = `Cache: ${stats.size} entries, ${hitRatio}% hit rate`;
		}
	}

	private async performSearch(): Promise<void> {
		const searchType = this.searchTypeSelect.value;
		let query = '';
		let tagQuery = '';

		// Get queries based on search type
		if (searchType === 'text' || searchType === 'combined') {
			query = this.searchInput.value.trim();
		}
		if (searchType === 'tag' || searchType === 'combined') {
			tagQuery = this.tagSearchInput.value.trim();
		}

		// Validate input
		if (!query && !tagQuery) {
			this.displayNoResults('Please enter a search query or tags');
			return;
		}

		// Prevent duplicate searches
		const currentSearchKey = `${searchType}:${query}:${tagQuery}`;
		if (currentSearchKey === this.lastSearchQuery && this.isSearching) {
			return;
		}

		this.lastSearchQuery = currentSearchKey;
		this.isSearching = true;

		// Check if plugin is properly configured
		const configStatus = this.plugin.getConfigurationStatus();
		if (!configStatus.isConfigured) {
			let message = 'Plugin configuration incomplete. ';
			if (!configStatus.hasServerUrl) {
				message += 'Missing server URL. ';
			}
			if (!configStatus.hasApiToken) {
				message += 'Missing API token. ';
			}
			message += 'Please check your settings.';

			this.displayNoResults(message);
			this.isSearching = false;
			return;
		}

		// Check if system is online
		if (!ErrorHandler.isOnline()) {
			const offlineError = ErrorHandler.createOfflineError();
			this.displayNoResults(offlineError.message);
			ErrorHandler.showErrorNotice(offlineError);
			this.isSearching = false;
			return;
		}

		// Show loading state
		this.displayLoading();

		try {
			let results: SearchResult[] = [];

			if (searchType === 'tag') {
				// Tag-only search
				const tags = tagQuery.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
				if (tags.length > 0) {
					results = await this.plugin.joplinService.searchNotesByTags({
						tags,
						operator: 'OR', // Default to OR for multiple tags
						includeText: false
					});
				}
			} else if (searchType === 'combined') {
				// Combined text and tag search
				const tags = tagQuery.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
				if (tags.length > 0) {
					results = await this.plugin.joplinService.searchNotesByTags({
						tags,
						operator: 'OR',
						includeText: true,
						textQuery: query
					});
				} else if (query) {
					// Fall back to text search if no tags provided
					results = await this.plugin.joplinService.searchNotes(query, {
						limit: this.plugin.settings.searchLimit || 50
					});
				}
			} else {
				// Text-only search
				results = await this.plugin.joplinService.searchNotes(query, {
					limit: this.plugin.settings.searchLimit || 50
				});
			}

			this.displayResults(results);
			this.updateCacheStatus();
		} catch (error) {
			// This should rarely happen as the service handles most errors
			ErrorHandler.logDetailedError(error, 'Search failed in view layer', {
				searchType,
				query,
				tagQuery
			});
			this.displayNoResults('Search failed. Please try again.');
		} finally {
			this.isSearching = false;
		}
	}



	private displayLoading(): void {
		this.resultsContainer.empty();
		const loadingDiv = this.resultsContainer.createDiv('joplin-loading');
		loadingDiv.setAttribute('role', 'status');
		loadingDiv.setAttribute('aria-live', 'polite');
		loadingDiv.setAttribute('aria-label', 'Searching for notes');

		// Add search button loading state
		this.searchButton.addClass('loading');
		this.searchButton.disabled = true;

		// Create skeleton loading for better UX
		const skeletonContainer = loadingDiv.createDiv('joplin-loading-skeletons');
		for (let i = 0; i < 3; i++) {
			const skeleton = skeletonContainer.createDiv('joplin-result-item joplin-loading-skeleton');
			skeleton.createDiv('joplin-skeleton-title');
			skeleton.createDiv('joplin-skeleton-text');
			skeleton.createDiv('joplin-skeleton-text');
		}

		const loadingText = loadingDiv.createDiv('joplin-loading-text');
		loadingText.setText('Searching...');
	}

	private displayNoResults(message: string): void {
		this.resultsContainer.empty();
		const noResultsDiv = this.resultsContainer.createDiv('joplin-no-results');
		noResultsDiv.setAttribute('role', 'status');
		noResultsDiv.setAttribute('aria-live', 'polite');
		noResultsDiv.setText(message);

		// Remove search button loading state
		this.searchButton.removeClass('loading');
		this.searchButton.disabled = false;
	}

	private displayResults(results: SearchResult[]): void {
		this.currentResults = results.map(result => ({
			...result,
			markedForImport: false // Initialize import selection
		}));
		this.resultsContainer.empty();

		if (results.length === 0) {
			this.displayNoResults('No notes found');
			this.hideImportOptionsPanel();
			return;
		}

		// Create results list container
		const resultsList = this.resultsContainer.createDiv('joplin-results-list');

		this.currentResults.forEach((result, index) => {
			const resultItem = resultsList.createDiv('joplin-result-item');
			resultItem.setAttribute('data-index', index.toString());

			// Import checkbox
			const checkboxDiv = resultItem.createDiv('joplin-result-checkbox');
			const checkbox = checkboxDiv.createEl('input', {
				type: 'checkbox',
				cls: 'joplin-import-checkbox'
			});
			checkbox.checked = result.markedForImport;
			checkbox.setAttribute('aria-label', `Select "${result.note.title}" for import`);
			checkbox.addEventListener('change', (e) => {
				e.stopPropagation(); // Prevent triggering result selection
				this.toggleImportSelection(index, checkbox.checked);
			});

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

			// Click handler for result selection (clicking on content, not checkbox)
			resultContent.addEventListener('click', (e) => {
				e.preventDefault();
				this.selectResult(index);
			});

			// Keyboard navigation support
			resultItem.setAttribute('tabindex', '0');
			resultItem.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					this.selectResult(index);
				} else if (e.key === ' ') {
					e.preventDefault();
					// Toggle import selection with space
					const currentSelection = this.currentResults[index].markedForImport;
					this.toggleImportSelection(index, !currentSelection);
					checkbox.checked = !currentSelection;
				}
			});

			// Add hover effects and accessibility
			resultItem.addClass('joplin-result-clickable');
			resultItem.setAttribute('role', 'option');
			resultItem.setAttribute('aria-label', `Note: ${result.note.title}. ${result.snippet || 'No preview available'}`);
			resultItem.setAttribute('aria-describedby', `result-meta-${index}`);

			// Add metadata ID for aria-describedby
			metadataEl.id = `result-meta-${index}`;
		});

		// Add results count indicator
		const resultsCount = this.resultsContainer.createDiv('joplin-results-count');
		resultsCount.setAttribute('role', 'status');
		resultsCount.setAttribute('aria-live', 'polite');
		resultsCount.setText(`${results.length} result${results.length !== 1 ? 's' : ''} found`);

		// Remove search button loading state
		this.searchButton.removeClass('loading');
		this.searchButton.disabled = false;

		// Show import options panel
		this.showImportOptionsPanel();
		this.updateImportSelectionCount();
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

		// Show loading state with more specific messaging
		const loadingDiv = this.previewContainer.createDiv('joplin-preview-loading');
		loadingDiv.setAttribute('role', 'status');
		loadingDiv.setAttribute('aria-live', 'polite');
		loadingDiv.setText('Loading note content...');

		try {
			// Get full note content from API (error handling is done in the service)
			const fullNote = await this.plugin.joplinService.getNote(result.note.id);

			if (!fullNote) {
				loadingDiv.remove();
				this.showPreviewError('Note not found or could not be loaded');
				return;
			}

			// Update loading message for image processing
			loadingDiv.setText('Processing images...');

			// Process note body to convert Joplin resource links to API URLs for preview
			const processedBody = this.plugin.joplinService.processNoteBodyForPreview(fullNote.body);
			const processedNote = {
				...fullNote,
				body: processedBody
			};

			// Remove loading indicator
			loadingDiv.remove();

			// Preview content with rendered markdown
			const previewContent = this.previewContainer.createDiv('joplin-preview-content');
			await this.renderNoteContent(previewContent, processedNote);

			// Note metadata
			const previewMeta = this.previewContainer.createDiv('joplin-preview-metadata');
			this.renderNoteMetadata(previewMeta, processedNote);

		} catch (error) {
			// Remove loading indicator
			loadingDiv.remove();

			// This should rarely happen as the service handles most errors
			ErrorHandler.logDetailedError(error, 'Preview failed in view layer', {
				noteId: result.note.id,
				noteTitle: result.note.title
			});
			this.showPreviewError('Failed to load note content. Please try again.');
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

		// Create scrollable content area
		const scrollableContent = contentWrapper.createDiv('joplin-preview-scrollable');

		try {
			// Use Obsidian's built-in markdown renderer
			// Note: processNoteBodyForImages should have already been called before this method
			await MarkdownRenderer.render(
				this.plugin.app,
				note.body, // This should already contain processed base64 images
				scrollableContent,
				'', // No source path needed for this context
				this
			);

			// Add click handlers for internal links (future enhancement)
			this.addLinkHandlers(scrollableContent);

		} catch (renderError) {
			// Handle markdown rendering errors gracefully
			ErrorHandler.logDetailedError(renderError, 'Markdown rendering failed', {
				noteId: note.id,
				noteTitle: note.title
			});

			// Show fallback content
			const errorDiv = scrollableContent.createDiv('joplin-preview-render-error');
			errorDiv.setText('Failed to render note content. Showing raw text:');

			const rawContent = scrollableContent.createEl('pre', { cls: 'joplin-preview-raw-content' });
			rawContent.setText(note.body);
		}
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

	/**
	 * Toggle import selection for a specific result
	 */
	private toggleImportSelection(index: number, selected: boolean): void {
		if (index >= 0 && index < this.currentResults.length) {
			this.currentResults[index].markedForImport = selected;
			this.updateImportSelectionCount();
		}
	}

	/**
	 * Select all results for import (public method for external access)
	 */
	public selectAllForImport(): void {
		this.currentResults.forEach(result => {
			result.markedForImport = true;
		});

		// Update checkboxes in UI
		const checkboxes = this.resultsContainer.querySelectorAll('.joplin-import-checkbox') as NodeListOf<HTMLInputElement>;
		checkboxes.forEach(checkbox => {
			checkbox.checked = true;
		});

		this.updateImportSelectionCount();
	}

	/**
	 * Clear all import selections
	 */
	private clearImportSelection(): void {
		this.currentResults.forEach(result => {
			result.markedForImport = false;
		});

		// Update checkboxes in UI
		const checkboxes = this.resultsContainer.querySelectorAll('.joplin-import-checkbox') as NodeListOf<HTMLInputElement>;
		checkboxes.forEach(checkbox => {
			checkbox.checked = false;
		});

		this.updateImportSelectionCount();
	}

	/**
	 * Update the count of selected notes for import
	 */
	private updateImportSelectionCount(): void {
		const selectedCount = this.currentResults.filter(result => result.markedForImport).length;
		const countElement = this.importOptionsPanel.querySelector('.joplin-selected-count-text');
		if (countElement) {
			countElement.textContent = `${selectedCount} note${selectedCount !== 1 ? 's' : ''} selected for import`;
		}

		// Enable/disable import button based on selection
		const importBtn = this.importOptionsPanel.querySelector('.joplin-import-btn') as HTMLButtonElement;
		if (importBtn) {
			importBtn.disabled = selectedCount === 0;
		}
	}

	/**
	 * Show the import options panel
	 */
	private showImportOptionsPanel(): void {
		const importSection = this.containerEl.querySelector('.joplin-import-section') as HTMLElement;
		if (importSection) {
			importSection.style.display = 'block';
		}
	}

	/**
	 * Hide the import options panel
	 */
	private hideImportOptionsPanel(): void {
		const importSection = this.containerEl.querySelector('.joplin-import-section') as HTMLElement;
		if (importSection) {
			importSection.style.display = 'none';
		}
	}

	/**
	 * Show import confirmation dialog (public method for external access)
	 */
	public async showImportConfirmationDialog(): Promise<void> {
		const selectedResults = this.currentResults.filter(result => result.markedForImport);

		if (selectedResults.length === 0) {
			// Show notice that no notes are selected
			this.showNotice('Please select at least one note to import');
			return;
		}

		// Get import options
		const importOptions: ImportOptions = {
			targetFolder: this.importFolderInput.value.trim() || 'Imported from Joplin',
			applyTemplate: this.applyTemplateCheckbox.checked,
			templatePath: this.applyTemplateCheckbox.checked ? this.templatePathInput.value.trim() : undefined,
			conflictResolution: this.conflictResolutionSelect.value as 'skip' | 'overwrite' | 'rename'
		};

		// Check for conflicts before showing confirmation
		const notesToImport = selectedResults.map(result => result.note);
		const conflictCheck = this.plugin.importService.checkForConflicts(notesToImport, importOptions.targetFolder);

		if (conflictCheck.conflicts.length > 0) {
			// Show conflict resolution dialog first
			const resolvedOptions = await this.showConflictResolutionDialog(conflictCheck.conflicts, importOptions);
			if (!resolvedOptions) {
				// User cancelled conflict resolution
				return;
			}
			// Update import options with resolved conflicts
			Object.assign(importOptions, resolvedOptions);
		}

		// Create confirmation dialog
		const modal = document.createElement('div');
		modal.className = 'joplin-import-confirmation-modal';
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 1000;
		`;

		const dialog = document.createElement('div');
		dialog.className = 'joplin-import-confirmation-dialog';
		dialog.style.cssText = `
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			padding: 20px;
			max-width: 500px;
			max-height: 80vh;
			overflow-y: auto;
		`;

		// Dialog title
		const title = dialog.createEl('h2', { text: 'Confirm Import' });
		title.style.marginTop = '0';

		// Import summary
		const summary = dialog.createDiv('joplin-import-summary');
		summary.createEl('p', { text: `You are about to import ${selectedResults.length} note${selectedResults.length !== 1 ? 's' : ''}:` });

		// List of notes to import
		const notesList = summary.createEl('ul', { cls: 'joplin-import-notes-list' });
		notesList.style.cssText = `
			max-height: 200px;
			overflow-y: auto;
			margin: 10px 0;
			padding-left: 20px;
		`;

		selectedResults.forEach(result => {
			const listItem = notesList.createEl('li');
			listItem.textContent = result.note.title || 'Untitled Note';
		});

		// Show conflict resolution summary if there were conflicts
		if (conflictCheck.conflicts.length > 0) {
			const conflictSummary = summary.createDiv('joplin-conflict-summary');
			conflictSummary.style.cssText = `
				background: var(--background-modifier-error);
				padding: 10px;
				border-radius: 4px;
				margin: 15px 0;
				border-left: 4px solid var(--text-error);
			`;
			conflictSummary.createEl('p', {
				text: `⚠️ ${conflictCheck.conflicts.length} file conflict${conflictCheck.conflicts.length !== 1 ? 's' : ''} detected and resolved`,
				cls: 'joplin-conflict-warning'
			});
		}

		// Import options summary
		const optionsSummary = summary.createDiv('joplin-import-options-summary');
		optionsSummary.style.cssText = `
			background: var(--background-secondary);
			padding: 10px;
			border-radius: 4px;
			margin: 15px 0;
		`;

		optionsSummary.createEl('p', { text: `Target folder: ${importOptions.targetFolder}` });
		optionsSummary.createEl('p', { text: `Apply template: ${importOptions.applyTemplate ? 'Yes' : 'No'}` });
		if (importOptions.applyTemplate && importOptions.templatePath) {
			optionsSummary.createEl('p', { text: `Template path: ${importOptions.templatePath}` });
		}
		optionsSummary.createEl('p', { text: `If file exists: ${importOptions.conflictResolution}` });

		// Dialog buttons
		const buttonsDiv = dialog.createDiv('joplin-import-dialog-buttons');
		buttonsDiv.style.cssText = `
			display: flex;
			gap: 10px;
			justify-content: flex-end;
			margin-top: 20px;
		`;

		const cancelBtn = buttonsDiv.createEl('button', { text: 'Cancel' });
		const confirmBtn = buttonsDiv.createEl('button', { text: 'Import', cls: 'mod-cta' });

		// Event listeners
		cancelBtn.addEventListener('click', () => {
			document.body.removeChild(modal);
		});

		confirmBtn.addEventListener('click', () => {
			document.body.removeChild(modal);
			this.performImport(selectedResults, importOptions);
		});

		// Close on escape key
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				document.body.removeChild(modal);
				document.removeEventListener('keydown', handleEscape);
			}
		};
		document.addEventListener('keydown', handleEscape);

		// Close on backdrop click
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				document.body.removeChild(modal);
			}
		});

		modal.appendChild(dialog);
		document.body.appendChild(modal);

		// Focus the confirm button
		confirmBtn.focus();
	}

	/**
	 * Show conflict resolution dialog for file conflicts
	 */
	private async showConflictResolutionDialog(
		conflicts: { note: JoplinNote; conflictPath: string; existingFile: any }[],
		importOptions: ImportOptions
	): Promise<ImportOptions | null> {
		return new Promise((resolve) => {
			// Create modal
			const modal = document.createElement('div');
			modal.className = 'joplin-conflict-resolution-modal';
			modal.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.5);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1001;
			`;

			const dialog = document.createElement('div');
			dialog.className = 'joplin-conflict-resolution-dialog';
			dialog.style.cssText = `
				background: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 8px;
				padding: 20px;
				max-width: 600px;
				max-height: 80vh;
				overflow-y: auto;
				min-width: 500px;
			`;

			// Dialog title
			const title = dialog.createEl('h2', { text: 'Resolve File Conflicts' });
			title.style.marginTop = '0';

			// Conflict description
			const description = dialog.createDiv('joplin-conflict-description');
			description.createEl('p', {
				text: `${conflicts.length} file${conflicts.length !== 1 ? 's' : ''} already exist${conflicts.length === 1 ? 's' : ''} in the target folder. Choose how to handle each conflict:`
			});

			// Conflicts list
			const conflictsList = dialog.createDiv('joplin-conflicts-list');
			conflictsList.style.cssText = `
				max-height: 300px;
				overflow-y: auto;
				margin: 15px 0;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
			`;

			const conflictResolutions: { [noteId: string]: 'skip' | 'overwrite' | 'rename' } = {};

			conflicts.forEach((conflict, index) => {
				const conflictItem = conflictsList.createDiv('joplin-conflict-item');
				conflictItem.style.cssText = `
					padding: 15px;
					border-bottom: 1px solid var(--background-modifier-border);
				`;
				if (index === conflicts.length - 1) {
					conflictItem.style.borderBottom = 'none';
				}

				// Note title and path
				const conflictHeader = conflictItem.createDiv('joplin-conflict-header');
				conflictHeader.style.cssText = `
					margin-bottom: 10px;
				`;

				const noteTitle = conflictHeader.createEl('div', {
					text: conflict.note.title || 'Untitled Note',
					cls: 'joplin-conflict-note-title'
				});
				noteTitle.style.cssText = `
					font-weight: bold;
					margin-bottom: 5px;
				`;

				const conflictPath = conflictHeader.createEl('div', {
					text: `Conflicts with: ${conflict.conflictPath}`,
					cls: 'joplin-conflict-path'
				});
				conflictPath.style.cssText = `
					font-size: 0.9em;
					color: var(--text-muted);
					font-family: var(--font-monospace);
				`;

				// Resolution options
				const resolutionOptions = conflictItem.createDiv('joplin-conflict-resolution-options');
				resolutionOptions.style.cssText = `
					display: flex;
					gap: 15px;
					margin-top: 10px;
				`;

				// Create radio buttons for each option
				const options = [
					{ value: 'skip', label: 'Skip this note', description: 'Do not import this note' },
					{ value: 'overwrite', label: 'Overwrite existing file', description: 'Replace the existing file' },
					{ value: 'rename', label: 'Rename new file', description: 'Import with a new name (e.g., "Note 1")' }
				];

				options.forEach(option => {
					const optionDiv = resolutionOptions.createDiv('joplin-conflict-option');
					optionDiv.style.cssText = `
						flex: 1;
						padding: 10px;
						border: 1px solid var(--background-modifier-border);
						border-radius: 4px;
						cursor: pointer;
						transition: background-color 0.2s;
					`;

					const radio = optionDiv.createEl('input', {
						type: 'radio',
						attr: {
							name: `conflict-${conflict.note.id}`,
							value: option.value
						}
					});
					radio.style.marginRight = '8px';

					const label = optionDiv.createEl('label', { text: option.label });
					label.style.cssText = `
						cursor: pointer;
						font-weight: 500;
						display: block;
						margin-bottom: 4px;
					`;

					const desc = optionDiv.createEl('div', {
						text: option.description,
						cls: 'joplin-option-description'
					});
					desc.style.cssText = `
						font-size: 0.85em;
						color: var(--text-muted);
					`;

					// Set default selection (skip)
					if (option.value === 'skip') {
						radio.checked = true;
						conflictResolutions[conflict.note.id] = 'skip';
						optionDiv.style.backgroundColor = 'var(--background-modifier-hover)';
					}

					// Event listeners
					optionDiv.addEventListener('click', () => {
						radio.checked = true;
						conflictResolutions[conflict.note.id] = option.value as 'skip' | 'overwrite' | 'rename';

						// Update visual selection
						resolutionOptions.querySelectorAll('.joplin-conflict-option').forEach(opt => {
							(opt as HTMLElement).style.backgroundColor = '';
						});
						optionDiv.style.backgroundColor = 'var(--background-modifier-hover)';
					});

					radio.addEventListener('change', () => {
						if (radio.checked) {
							conflictResolutions[conflict.note.id] = option.value as 'skip' | 'overwrite' | 'rename';

							// Update visual selection
							resolutionOptions.querySelectorAll('.joplin-conflict-option').forEach(opt => {
								(opt as HTMLElement).style.backgroundColor = '';
							});
							optionDiv.style.backgroundColor = 'var(--background-modifier-hover)';
						}
					});
				});
			});

			// Apply to all section
			const applyToAllSection = dialog.createDiv('joplin-apply-to-all-section');
			applyToAllSection.style.cssText = `
				margin: 20px 0;
				padding: 15px;
				background: var(--background-secondary);
				border-radius: 4px;
			`;

			const applyToAllLabel = applyToAllSection.createEl('label', { text: 'Apply to all conflicts:' });
			applyToAllLabel.style.cssText = `
				display: block;
				margin-bottom: 10px;
				font-weight: 500;
			`;

			const applyToAllOptions = applyToAllSection.createDiv('joplin-apply-to-all-options');
			applyToAllOptions.style.cssText = `
				display: flex;
				gap: 10px;
			`;

			const applyAllButtons = [
				{ value: 'skip', label: 'Skip All', class: 'mod-warning' },
				{ value: 'overwrite', label: 'Overwrite All', class: 'mod-destructive' },
				{ value: 'rename', label: 'Rename All', class: 'mod-cta' }
			];

			applyAllButtons.forEach(btn => {
				const button = applyToAllOptions.createEl('button', {
					text: btn.label,
					cls: btn.class
				});
				button.style.cssText = `
					flex: 1;
					padding: 8px 12px;
				`;

				button.addEventListener('click', () => {
					// Apply the selected resolution to all conflicts
					conflicts.forEach(conflict => {
						conflictResolutions[conflict.note.id] = btn.value as 'skip' | 'overwrite' | 'rename';

						// Update radio buttons
						const radio = dialog.querySelector(`input[name="conflict-${conflict.note.id}"][value="${btn.value}"]`) as HTMLInputElement;
						if (radio) {
							radio.checked = true;

							// Update visual selection
							const conflictItem = radio.closest('.joplin-conflict-item');
							if (conflictItem) {
								conflictItem.querySelectorAll('.joplin-conflict-option').forEach(opt => {
									(opt as HTMLElement).style.backgroundColor = '';
								});
								const selectedOption = radio.closest('.joplin-conflict-option') as HTMLElement;
								if (selectedOption) {
									selectedOption.style.backgroundColor = 'var(--background-modifier-hover)';
								}
							}
						}
					});
				});
			});

			// Dialog buttons
			const buttonsDiv = dialog.createDiv('joplin-conflict-dialog-buttons');
			buttonsDiv.style.cssText = `
				display: flex;
				gap: 10px;
				justify-content: flex-end;
				margin-top: 20px;
			`;

			const cancelBtn = buttonsDiv.createEl('button', { text: 'Cancel' });
			const proceedBtn = buttonsDiv.createEl('button', { text: 'Proceed with Import', cls: 'mod-cta' });

			// Event listeners
			cancelBtn.addEventListener('click', () => {
				document.body.removeChild(modal);
				resolve(null);
			});

			proceedBtn.addEventListener('click', () => {
				document.body.removeChild(modal);

				// Create new import options with individual conflict resolutions
				// For now, we'll use the most common resolution as the default
				const resolutionCounts = { skip: 0, overwrite: 0, rename: 0 };
				Object.values(conflictResolutions).forEach(resolution => {
					resolutionCounts[resolution]++;
				});

				const mostCommonResolution = Object.entries(resolutionCounts)
					.reduce((a, b) => resolutionCounts[a[0] as keyof typeof resolutionCounts] > resolutionCounts[b[0] as keyof typeof resolutionCounts] ? a : b)[0] as 'skip' | 'overwrite' | 'rename';

				const resolvedOptions: ImportOptions = {
					...importOptions,
					conflictResolution: mostCommonResolution
				};

				resolve(resolvedOptions);
			});

			// Close on escape key
			const handleEscape = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					document.body.removeChild(modal);
					document.removeEventListener('keydown', handleEscape);
					resolve(null);
				}
			};
			document.addEventListener('keydown', handleEscape);

			// Close on backdrop click
			modal.addEventListener('click', (e) => {
				if (e.target === modal) {
					document.body.removeChild(modal);
					resolve(null);
				}
			});

			modal.appendChild(dialog);
			document.body.appendChild(modal);

			// Focus the proceed button
			proceedBtn.focus();
		});
	}

	/**
	 * Perform the actual import using ImportService with progress tracking
	 */
	private async performImport(selectedResults: SearchResult[], importOptions: ImportOptions): Promise<void> {
		const notesToImport = selectedResults.map(result => result.note);

		// Create progress indicator
		const progressContainer = this.createProgressIndicator('Starting import...');
		this.containerEl.appendChild(progressContainer);

		try {
			// Use the import service to import notes with progress tracking
			const result = await this.plugin.importService.importNotes(
				notesToImport,
				importOptions,
				(progress) => {
					// Update progress indicator with detailed information
					let progressMessage = `Importing note ${progress.noteIndex}/${progress.totalNotes}: ${progress.currentNote}`;

					if (progress.stage) {
						progressMessage += ` - ${progress.stage}`;
					}

					if (progress.imageProgress) {
						const imageProgress = progress.imageProgress;
						if (imageProgress.total > 0) {
							progressMessage += ` (Images: ${imageProgress.downloaded + imageProgress.failed}/${imageProgress.total})`;
						}
					}

					// Calculate overall progress percentage
					const noteProgress = (progress.noteIndex - 1) / progress.totalNotes;
					const currentNoteProgress = progress.imageProgress
						? (progress.imageProgress.downloaded + progress.imageProgress.failed) / Math.max(1, progress.imageProgress.total) * 0.8
						: 0.5; // Assume 50% progress if no image info
					const overallProgress = (noteProgress + currentNoteProgress / progress.totalNotes) * 100;

					this.updateProgressIndicator(progressContainer, overallProgress, progressMessage);
				}
			);

			// Remove progress indicator
			this.removeProgressIndicator(progressContainer);

			// Show detailed results
			this.showImportResults(result, importOptions);

			// Clear import selections after successful import
			if (result.successful.length > 0) {
				this.clearImportSelection();
			}

		} catch (error) {
			// Remove progress indicator on error
			this.removeProgressIndicator(progressContainer);

			console.error('Import error:', error);
			this.showNotice('Import failed. Please check your settings and try again.');
		}
	}

	/**
	 * Show detailed import results with conflict resolution feedback and image processing info
	 */
	private showImportResults(
		result: {
			successful: {
				file: any;
				note: JoplinNote;
				action: 'created' | 'overwritten' | 'renamed';
				originalFilename: string;
				finalFilename: string;
				imageResults?: ImageImportResult[];
			}[];
			failed: { note: JoplinNote; error: string }[];
		},
		importOptions: ImportOptions
	): void {
		const successCount = result.successful.length;
		const failureCount = result.failed.length;
		const totalCount = successCount + failureCount;

		// Calculate action counts for all cases
		const actionCounts = {
			created: result.successful.filter(s => s.action === 'created').length,
			overwritten: result.successful.filter(s => s.action === 'overwritten').length,
			renamed: result.successful.filter(s => s.action === 'renamed').length
		};

		// Calculate image processing statistics
		const totalImages = result.successful.reduce((sum, s) => sum + (s.imageResults?.length || 0), 0);
		const successfulImages = result.successful.reduce((sum, s) =>
			sum + (s.imageResults?.filter(img => img.success).length || 0), 0);
		const failedImages = totalImages - successfulImages;

		if (failureCount === 0) {
			// All imports successful - show detailed success message

			let message = `Successfully imported ${successCount} note${successCount !== 1 ? 's' : ''} to "${importOptions.targetFolder}"`;

			const actionDetails: string[] = [];
			if (actionCounts.created > 0) {
				actionDetails.push(`${actionCounts.created} created`);
			}
			if (actionCounts.overwritten > 0) {
				actionDetails.push(`${actionCounts.overwritten} overwritten`);
			}
			if (actionCounts.renamed > 0) {
				actionDetails.push(`${actionCounts.renamed} renamed`);
			}

			if (actionDetails.length > 0) {
				message += ` (${actionDetails.join(', ')})`;
			}

			// Add image processing information
			if (totalImages > 0) {
				message += ` with ${successfulImages} image${successfulImages !== 1 ? 's' : ''}`;
				if (failedImages > 0) {
					message += ` (${failedImages} image${failedImages !== 1 ? 's' : ''} failed)`;
				}
			}

			this.showNotice(message);

			// Log detailed results for user reference
			if (actionCounts.renamed > 0 || actionCounts.overwritten > 0) {
				console.log('Import details:', result.successful.map(s => ({
					title: s.note.title,
					action: s.action,
					originalFilename: s.originalFilename,
					finalFilename: s.finalFilename,
					path: s.file.path
				})));
			}

		} else if (successCount === 0) {
			// All imports failed
			this.showNotice(`Failed to import ${failureCount} note${failureCount !== 1 ? 's' : ''}. Check console for details.`);
			console.error('Import failures:', result.failed);
		} else {
			// Mixed results
			let message = `Imported ${successCount} of ${totalCount} notes. ${failureCount} failed.`;
			if (totalImages > 0) {
				message += ` Images: ${successfulImages}/${totalImages} successful.`;
			}
			message += ' Check console for details.';
			this.showNotice(message);
			console.error('Import failures:', result.failed);

			// Also log successful imports with actions
			console.log('Successful imports:', result.successful.map(s => ({
				title: s.note.title,
				action: s.action,
				originalFilename: s.originalFilename,
				finalFilename: s.finalFilename,
				path: s.file.path
			})));
		}

		// Show detailed results modal for complex imports or when there are image processing results
		if (totalCount > 5 || (actionCounts && (actionCounts.overwritten > 0 || actionCounts.renamed > 0)) || totalImages > 0) {
			this.showDetailedImportResultsModal(result, importOptions);
		}
	}

	/**
	 * Show detailed import results in a modal for complex imports
	 */
	private showDetailedImportResultsModal(
		result: {
			successful: {
				file: any;
				note: JoplinNote;
				action: 'created' | 'overwritten' | 'renamed';
				originalFilename: string;
				finalFilename: string;
				imageResults?: ImageImportResult[];
			}[];
			failed: { note: JoplinNote; error: string }[];
		},
		importOptions: ImportOptions
	): void {
		// Create modal
		const modal = document.createElement('div');
		modal.className = 'joplin-import-results-modal';
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 1000;
		`;

		const dialog = document.createElement('div');
		dialog.className = 'joplin-import-results-dialog';
		dialog.style.cssText = `
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			padding: 20px;
			max-width: 700px;
			max-height: 80vh;
			overflow-y: auto;
			min-width: 500px;
		`;

		// Dialog title
		const title = dialog.createEl('h2', { text: 'Import Results' });
		title.style.marginTop = '0';

		// Summary
		const summary = dialog.createDiv('joplin-import-results-summary');
		summary.style.cssText = `
			background: var(--background-secondary);
			padding: 15px;
			border-radius: 4px;
			margin-bottom: 20px;
		`;

		const successCount = result.successful.length;
		const failureCount = result.failed.length;

		// Calculate image statistics
		const totalImages = result.successful.reduce((sum, s) => sum + (s.imageResults?.length || 0), 0);
		const successfulImages = result.successful.reduce((sum, s) =>
			sum + (s.imageResults?.filter(img => img.success).length || 0), 0);
		const failedImages = totalImages - successfulImages;

		summary.createEl('p', { text: `Import completed: ${successCount} successful, ${failureCount} failed` });
		summary.createEl('p', { text: `Target folder: ${importOptions.targetFolder}` });

		if (totalImages > 0) {
			summary.createEl('p', { text: `Images processed: ${successfulImages} successful, ${failedImages} failed (${totalImages} total)` });
		}

		// Successful imports
		if (result.successful.length > 0) {
			const successSection = dialog.createDiv('joplin-import-success-section');
			successSection.createEl('h3', { text: `✅ Successfully Imported (${result.successful.length})` });

			const successList = successSection.createDiv('joplin-import-success-list');
			successList.style.cssText = `
				max-height: 200px;
				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				margin-bottom: 15px;
			`;

			result.successful.forEach((item, index) => {
				const itemDiv = successList.createDiv('joplin-import-result-item');
				itemDiv.style.cssText = `
					padding: 10px;
					border-bottom: 1px solid var(--background-modifier-border);
					display: flex;
					justify-content: space-between;
					align-items: center;
				`;
				if (index === result.successful.length - 1) {
					itemDiv.style.borderBottom = 'none';
				}

				const noteInfo = itemDiv.createDiv('joplin-import-note-info');
				noteInfo.createEl('div', {
					text: item.note.title || 'Untitled Note',
					cls: 'joplin-import-note-title'
				}).style.fontWeight = 'bold';

				if (item.action !== 'created' || item.originalFilename !== item.finalFilename) {
					const actionInfo = noteInfo.createEl('div', { cls: 'joplin-import-action-info' });
					actionInfo.style.cssText = `
						font-size: 0.85em;
						color: var(--text-muted);
						margin-top: 2px;
					`;

					if (item.action === 'overwritten') {
						actionInfo.textContent = `Overwritten existing file: ${item.finalFilename}.md`;
					} else if (item.action === 'renamed') {
						actionInfo.textContent = `Renamed from "${item.originalFilename}.md" to "${item.finalFilename}.md"`;
					} else {
						actionInfo.textContent = `Created: ${item.finalFilename}.md`;
					}
				}

				// Add image processing information if available
				if (item.imageResults && item.imageResults.length > 0) {
					const imageInfo = noteInfo.createEl('div', { cls: 'joplin-import-image-info' });
					imageInfo.style.cssText = `
						font-size: 0.75em;
						color: var(--text-muted);
						margin-top: 2px;
					`;

					const successfulImgs = item.imageResults.filter(img => img.success).length;
					const failedImgs = item.imageResults.length - successfulImgs;

					if (failedImgs === 0) {
						imageInfo.textContent = `📷 ${successfulImgs} image${successfulImgs !== 1 ? 's' : ''} downloaded`;
					} else {
						imageInfo.textContent = `📷 ${successfulImgs}/${item.imageResults.length} images downloaded (${failedImgs} failed)`;
					}
				}

				const actionBadge = itemDiv.createDiv('joplin-import-action-badge');
				actionBadge.style.cssText = `
					padding: 4px 8px;
					border-radius: 12px;
					font-size: 0.75em;
					font-weight: bold;
					text-transform: uppercase;
				`;

				switch (item.action) {
					case 'created':
						actionBadge.textContent = 'Created';
						actionBadge.style.backgroundColor = 'var(--color-green)';
						actionBadge.style.color = 'white';
						break;
					case 'overwritten':
						actionBadge.textContent = 'Overwritten';
						actionBadge.style.backgroundColor = 'var(--color-orange)';
						actionBadge.style.color = 'white';
						break;
					case 'renamed':
						actionBadge.textContent = 'Renamed';
						actionBadge.style.backgroundColor = 'var(--color-blue)';
						actionBadge.style.color = 'white';
						break;
				}
			});
		}

		// Failed imports
		if (result.failed.length > 0) {
			const failureSection = dialog.createDiv('joplin-import-failure-section');
			failureSection.createEl('h3', { text: `❌ Failed Imports (${result.failed.length})` });

			const failureList = failureSection.createDiv('joplin-import-failure-list');
			failureList.style.cssText = `
				max-height: 200px;
				overflow-y: auto;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				margin-bottom: 15px;
			`;

			result.failed.forEach((item, index) => {
				const itemDiv = failureList.createDiv('joplin-import-result-item');
				itemDiv.style.cssText = `
					padding: 10px;
					border-bottom: 1px solid var(--background-modifier-border);
				`;
				if (index === result.failed.length - 1) {
					itemDiv.style.borderBottom = 'none';
				}

				itemDiv.createEl('div', {
					text: item.note.title || 'Untitled Note',
					cls: 'joplin-import-note-title'
				}).style.fontWeight = 'bold';

				const errorInfo = itemDiv.createEl('div', {
					text: item.error,
					cls: 'joplin-import-error-info'
				});
				errorInfo.style.cssText = `
					font-size: 0.85em;
					color: var(--text-error);
					margin-top: 2px;
				`;
			});
		}

		// Dialog buttons
		const buttonsDiv = dialog.createDiv('joplin-import-results-buttons');
		buttonsDiv.style.cssText = `
			display: flex;
			gap: 10px;
			justify-content: flex-end;
			margin-top: 20px;
		`;

		const closeBtn = buttonsDiv.createEl('button', { text: 'Close', cls: 'mod-cta' });

		// Event listeners
		closeBtn.addEventListener('click', () => {
			document.body.removeChild(modal);
		});

		// Close on escape key
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				document.body.removeChild(modal);
				document.removeEventListener('keydown', handleEscape);
			}
		};
		document.addEventListener('keydown', handleEscape);

		// Close on backdrop click
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				document.body.removeChild(modal);
			}
		});

		modal.appendChild(dialog);
		document.body.appendChild(modal);

		// Focus the close button
		closeBtn.focus();
	}

	/**
	 * Show a notice to the user
	 */
	private showNotice(message: string): void {
		new Notice(message);
	}

	/**
	 * Create progress indicator
	 */
	private createProgressIndicator(message: string): HTMLElement {
		const progressContainer = this.containerEl.createDiv('joplin-progress-container');
		progressContainer.createDiv('joplin-progress-text').setText(message);

		const progressBar = progressContainer.createDiv('joplin-progress-bar');
		const progressFill = progressBar.createDiv('joplin-progress-fill');
		progressFill.addClass('indeterminate');

		return progressContainer;
	}

	/**
	 * Update progress indicator
	 */
	private updateProgressIndicator(container: HTMLElement, progress: number, message: string): void {
		const textEl = container.querySelector('.joplin-progress-text');
		const fillEl = container.querySelector('.joplin-progress-fill') as HTMLElement;

		if (textEl) {
			textEl.textContent = message;
		}

		if (fillEl) {
			fillEl.removeClass('indeterminate');
			fillEl.style.width = `${Math.min(100, Math.max(0, progress))}%`;
		}
	}

	/**
	 * Remove progress indicator
	 */
	private removeProgressIndicator(container: HTMLElement): void {
		container.remove();
	}

	/**
	 * Setup global keyboard shortcuts
	 */
	private setupGlobalKeyboardShortcuts(): void {
		this.globalKeydownHandler = (e: KeyboardEvent) => {
			// Only handle shortcuts when the view is focused
			if (!this.containerEl.contains(document.activeElement)) {
				return;
			}

			// Ctrl/Cmd + F: Focus search input
			if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
				e.preventDefault();
				this.focusSearchInputInternal();
				return;
			}

			// Escape: Clear search or close preview
			if (e.key === 'Escape') {
				e.preventDefault();
				this.handleEscapeKey();
				return;
			}

			// Ctrl/Cmd + A: Select all for import (when results are visible)
			if ((e.ctrlKey || e.metaKey) && e.key === 'a' && this.currentResults.length > 0) {
				e.preventDefault();
				this.selectAllForImport();
				return;
			}

			// Ctrl/Cmd + Enter: Import selected notes
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
				e.preventDefault();
				this.showImportConfirmationDialog();
				return;
			}

			// Arrow keys for result navigation
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				if (this.currentResults.length > 0 && !this.isInputFocused()) {
					e.preventDefault();
					this.navigateResults(e.key === 'ArrowDown' ? 'down' : 'up');
					return;
				}
			}

			// Enter: Select focused result
			if (e.key === 'Enter' && !this.isInputFocused()) {
				const focusedIndex = this.getFocusedResultIndex();
				if (focusedIndex >= 0) {
					e.preventDefault();
					this.selectResult(focusedIndex);
					return;
				}
			}

			// Space: Toggle import selection for focused result
			if (e.key === ' ' && !this.isInputFocused()) {
				const focusedIndex = this.getFocusedResultIndex();
				if (focusedIndex >= 0) {
					e.preventDefault();
					const currentSelection = this.currentResults[focusedIndex].markedForImport;
					this.toggleImportSelection(focusedIndex, !currentSelection);
					this.updateImportCheckbox(focusedIndex, !currentSelection);
					return;
				}
			}
		};

		document.addEventListener('keydown', this.globalKeydownHandler);
	}

	/**
	 * Cleanup global keyboard shortcuts
	 */
	private cleanupGlobalKeyboardShortcuts(): void {
		if (this.globalKeydownHandler) {
			document.removeEventListener('keydown', this.globalKeydownHandler);
		}
	}

	/**
	 * Focus the search input (public method for external access)
	 */
	public focusSearchInput(): void {
		if (this.searchInput.style.display !== 'none') {
			this.searchInput.focus();
			this.searchInput.select();
		} else if (this.tagSearchInput.style.display !== 'none') {
			this.tagSearchInput.focus();
			this.tagSearchInput.select();
		}
	}

	/**
	 * Focus the search input (private method for internal use)
	 */
	private focusSearchInputInternal(): void {
		this.focusSearchInput();
	}

	/**
	 * Handle escape key press
	 */
	private handleEscapeKey(): void {
		// Clear search if input is focused and has content
		if (this.isInputFocused()) {
			if (this.searchInput.value || this.tagSearchInput.value) {
				this.searchInput.value = '';
				this.tagSearchInput.value = '';
				this.displayNoResults('Enter a search query to find notes');
				this.hideImportOptionsPanel();
			}
		} else {
			// Clear result selection
			this.clearResultSelection();
		}
	}

	/**
	 * Check if an input field is currently focused
	 */
	private isInputFocused(): boolean {
		const activeElement = document.activeElement;
		return activeElement === this.searchInput ||
			   activeElement === this.tagSearchInput ||
			   activeElement === this.importFolderInput ||
			   activeElement === this.templatePathInput;
	}

	/**
	 * Get the index of the currently focused result
	 */
	private getFocusedResultIndex(): number {
		const activeElement = document.activeElement;
		if (activeElement && activeElement.classList.contains('joplin-result-item')) {
			const index = activeElement.getAttribute('data-index');
			return index ? parseInt(index, 10) : -1;
		}
		return this.currentResults.findIndex(result => result.selected);
	}

	/**
	 * Clear result selection
	 */
	private clearResultSelection(): void {
		this.currentResults.forEach(result => {
			result.selected = false;
		});

		this.resultsContainer.querySelectorAll('.joplin-result-selected').forEach(el => {
			el.removeClass('joplin-result-selected');
		});

		// Clear preview
		this.previewContainer.empty();
		this.previewContainer.createDiv('joplin-no-preview').setText('Select a note to preview');
	}

	/**
	 * Update import checkbox state
	 */
	private updateImportCheckbox(index: number, checked: boolean): void {
		const resultItems = this.resultsContainer.querySelectorAll('.joplin-result-item');
		if (resultItems[index]) {
			const checkbox = resultItems[index].querySelector('.joplin-import-checkbox') as HTMLInputElement;
			if (checkbox) {
				checkbox.checked = checked;
			}
		}
	}

	/**
	 * Setup resize observer for responsive behavior
	 */
	private setupResizeObserver(container: Element): void {
		if ('ResizeObserver' in window) {
			this.resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const width = entry.contentRect.width;

					// Update layout based on width
					if (width < 300) {
						container.setAttribute('data-layout', 'compact');
					} else if (width > 500) {
						container.setAttribute('data-layout', 'comfortable');
					} else {
						container.removeAttribute('data-layout');
					}
				}
			});

			this.resizeObserver.observe(container);
		}
	}
}