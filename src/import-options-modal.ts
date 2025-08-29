import { Modal, Setting, Notice } from 'obsidian';
import JoplinPortalPlugin from '../main';
import { ImportOptions, SearchResult, ImportProgress } from './types';

export class ImportOptionsModal extends Modal {
	plugin: JoplinPortalPlugin;
	private targetFolderInput: HTMLInputElement;
	private applyTemplateCheckbox: HTMLInputElement;
	private templatePathInput: HTMLInputElement;
	private conflictResolutionSelect: HTMLSelectElement;
	private selectedResults: SearchResult[];
	private onComplete: (success: boolean) => void;
	private isImporting = false;
	private pendingOptions: Partial<ImportOptions> | null = null;

	constructor(
		plugin: JoplinPortalPlugin,
		selectedResults: SearchResult[],
		onComplete: (success: boolean) => void
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.selectedResults = selectedResults;
		this.onComplete = onComplete;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Set modal title
		this.titleEl.setText('Import Options');

		// Add modal description
		const description = contentEl.createDiv('joplin-import-options-description');
		description.setText('Configure how the selected notes will be imported into your Obsidian vault.');

		// Create settings container
		const settingsContainer = contentEl.createDiv('import-options-settings');

		// Target folder setting
		new Setting(settingsContainer)
			.setName('Target folder')
			.setDesc('The folder where imported notes will be saved')
			.addText((text: any) => {
				this.targetFolderInput = text.inputEl;
				text
					.setPlaceholder('Imported from Joplin')
					.setValue(this.plugin.settings.defaultImportFolder || 'Imported from Joplin')
					.onChange((value: string) => {
						// Auto-create folder path as user types
						if (value.trim()) {
							this.validateFolderPath(value.trim());
						}
					});
			});

		// Template application setting
		new Setting(settingsContainer)
			.setName('Apply template')
			.setDesc('Apply a template to imported notes')
			.addToggle((toggle: any) => {
				this.applyTemplateCheckbox = toggle.toggleEl;
				toggle
					.setValue(false)
					.onChange((value: boolean) => {
						this.updateTemplatePathVisibility(value);
					});
			});

		// Template path setting (initially hidden)
		const templatePathSetting = new Setting(settingsContainer)
			.setName('Template path')
			.setDesc('Path to the template file to apply to imported notes')
			.addText((text: any) => {
				this.templatePathInput = text.inputEl;
				text
					.setPlaceholder('Templates/Note Template.md')
					.setValue('')
					.onChange((value: string) => {
						this.validateTemplatePath(value.trim());
					});
			});

		// Hide template path setting initially
		templatePathSetting.settingEl.addClass('joplin-template-path-hidden');
		templatePathSetting.settingEl.setAttribute('data-template-path-setting', 'true');

		// Conflict resolution setting
		new Setting(settingsContainer)
			.setName('If file exists')
			.setDesc('How to handle files that already exist in the target folder')
			.addDropdown((dropdown: any) => {
				this.conflictResolutionSelect = dropdown.selectEl;
				dropdown
					.addOption('skip', 'Skip - Don\'t import if file exists')
					.addOption('overwrite', 'Overwrite - Replace existing file')
					.addOption('rename', 'Rename - Create new file with unique name')
					.setValue('skip');
			});

		// Advanced settings section
		this.createAdvancedSettingsSection(contentEl);

		// Action buttons
		this.createActionButtons(contentEl);

		// Set up keyboard navigation
		this.setupKeyboardNavigation();

		// Apply any pending options that were set before the modal opened
		if (this.pendingOptions) {
			this.applyOptionsToElements(this.pendingOptions);
			this.pendingOptions = null;
		}

		// Focus the target folder input
		this.targetFolderInput.focus();
		this.targetFolderInput.select();
	}

	private createAdvancedSettingsSection(container: HTMLElement): void {
		// Advanced settings header
		const advancedHeader = container.createDiv('joplin-import-options-advanced-header');

		const advancedToggle = advancedHeader.createSpan('joplin-import-options-advanced-toggle');
		advancedToggle.setText('▶');

		const advancedTitle = advancedHeader.createSpan('joplin-import-options-advanced-title');
		advancedTitle.setText('Advanced Settings');

		// Advanced settings container (initially hidden)
		const advancedContainer = container.createDiv('joplin-import-options-advanced-container');

		// Toggle advanced settings visibility
		let advancedExpanded = false;
		advancedHeader.addEventListener('click', () => {
			advancedExpanded = !advancedExpanded;
			if (advancedExpanded) {
				advancedContainer.addClass('expanded');
				advancedToggle.setText('▼');
				advancedToggle.addClass('expanded');
			} else {
				advancedContainer.removeClass('expanded');
				advancedToggle.setText('▶');
				advancedToggle.removeClass('expanded');
			}
		});

		// Add advanced settings
		const advancedNote = advancedContainer.createDiv('joplin-import-options-advanced-note');
		advancedNote.setText('Additional import configuration options will be available here in future updates.');

		// Placeholder for future advanced settings
		const placeholderSetting = advancedContainer.createDiv('joplin-import-options-placeholder-setting');
		placeholderSetting.setText('Future settings: Image processing options, metadata handling, etc.');
	}

	private createActionButtons(container: HTMLElement): void {
		const buttonsContainer = container.createDiv('import-options-buttons');
		buttonsContainer.style.cssText = `
			display: flex;
			gap: 10px;
			justify-content: flex-end;
			margin-top: 30px;
			padding-top: 20px;
			border-top: 1px solid var(--background-modifier-border);
		`;

		// Cancel button (secondary action)
		const cancelButton = buttonsContainer.createEl('button', {
			text: 'Cancel',
			cls: 'mod-cancel'
		});
		cancelButton.addEventListener('click', () => {
			if (this.isImporting) {
				// Don't allow cancellation during import
				return;
			}
			this.close();
			this.onComplete(false);
		});

		// Import button (primary action)
		const importButton = buttonsContainer.createEl('button', {
			text: `Import ${this.selectedResults.length} Note${this.selectedResults.length !== 1 ? 's' : ''}`,
			cls: 'mod-cta'
		});
		importButton.addEventListener('click', () => {
			this.executeImport();
		});

		// Store button references for keyboard navigation
		this.cancelButton = cancelButton;
		this.importButton = importButton;
	}

	private cancelButton: HTMLButtonElement;
	private importButton: HTMLButtonElement;

	private setupKeyboardNavigation(): void {
		// Handle Enter key on import button
		this.importButton.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.handleImportConfirm();
			}
		});

		// Handle Escape key
		this.modalEl.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				this.close();
				this.onCancel();
			}
		});

		// Handle Tab navigation to ensure proper focus flow
		const focusableElements = this.modalEl.querySelectorAll(
			'input, select, button, [tabindex]:not([tabindex="-1"])'
		);

		if (focusableElements.length > 0) {
			const firstElement = focusableElements[0] as HTMLElement;
			const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

			this.modalEl.addEventListener('keydown', (e) => {
				if (e.key === 'Tab') {
					if (e.shiftKey) {
						// Shift+Tab: move backwards
						if (document.activeElement === firstElement) {
							e.preventDefault();
							lastElement.focus();
						}
					} else {
						// Tab: move forwards
						if (document.activeElement === lastElement) {
							e.preventDefault();
							firstElement.focus();
						}
					}
				}
			});
		}
	}

	private updateTemplatePathVisibility(applyTemplate: boolean): void {
		const templatePathSetting = this.contentEl.querySelector('[data-template-path-setting="true"]') as HTMLElement;
		if (templatePathSetting) {
			templatePathSetting.style.display = applyTemplate ? 'block' : 'none';
		}
	}

	private validateFolderPath(path: string): void {
		// Basic validation - check for invalid characters
		const invalidChars = /[<>:"|?*]/;
		if (invalidChars.test(path)) {
			this.showValidationError('Folder path contains invalid characters');
			return;
		}

		// Clear any previous validation errors
		this.clearValidationErrors();
	}

	private validateTemplatePath(path: string): void {
		if (!path) return;

		// Check if path ends with .md
		if (!path.endsWith('.md')) {
			this.showValidationError('Template path must end with .md');
			return;
		}

		// Clear any previous validation errors
		this.clearValidationErrors();
	}

	private showValidationError(message: string): void {
		// Remove any existing error messages
		this.clearValidationErrors();

		// Create error message element
		const errorEl = this.contentEl.createDiv('import-options-validation-error');
		errorEl.style.cssText = `
			color: var(--text-error);
			font-size: 0.85em;
			margin-top: 10px;
			padding: 8px 12px;
			background: var(--background-modifier-error);
			border-radius: 4px;
			border-left: 3px solid var(--text-error);
		`;
		errorEl.setText(message);

		// Auto-remove after 5 seconds
		setTimeout(() => {
			if (errorEl.parentNode) {
				errorEl.remove();
			}
		}, 5000);
	}

	private clearValidationErrors(): void {
		const existingErrors = this.contentEl.querySelectorAll('.import-options-validation-error');
		existingErrors.forEach(error => error.remove());
	}

	private async executeImport(): Promise<void> {
		// Validate inputs first
		const importOptions = this.validateAndGetImportOptions();
		if (!importOptions) {
			return; // Validation failed, error already shown
		}

		// Prevent multiple simultaneous imports
		if (this.isImporting) {
			return;
		}

		this.isImporting = true;

		try {
			// Update UI to show import in progress
			this.showImportProgress();

			// Get notes to import
			const notesToImport = this.selectedResults.map(result => result.note);

			// Execute the import with progress feedback
			const importResult = await this.plugin.importService.importNotes(
				notesToImport,
				importOptions,
				(progress: ImportProgress) => {
					this.updateImportProgress(progress);
				}
			);

			// Show import results
			this.showImportResults(importResult);

			// Close modal after a brief delay to show results
			setTimeout(() => {
				this.close();
				this.onComplete(true);
			}, 2000);

		} catch (error) {
			this.plugin.logger?.error('Import failed:', error);
			this.showImportError(error instanceof Error ? error.message : String(error));
			this.isImporting = false;
		}
	}

	private validateAndGetImportOptions(): ImportOptions | null {
		// Validate inputs
		const targetFolder = this.targetFolderInput.value.trim();
		if (!targetFolder) {
			this.showValidationError('Target folder is required');
			this.targetFolderInput.focus();
			return null;
		}

		const applyTemplate = this.applyTemplateCheckbox.checked;
		const templatePath = this.templatePathInput.value.trim();

		if (applyTemplate && !templatePath) {
			this.showValidationError('Template path is required when applying template');
			this.templatePathInput.focus();
			return null;
		}

		if (applyTemplate && templatePath && !templatePath.endsWith('.md')) {
			this.showValidationError('Template path must end with .md');
			this.templatePathInput.focus();
			return null;
		}

		// Create import options object
		return {
			targetFolder,
			applyTemplate,
			templatePath: applyTemplate ? templatePath : undefined,
			conflictResolution: this.conflictResolutionSelect.value as 'skip' | 'overwrite' | 'rename'
		};
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Public method to get current import options without closing modal
	 * Useful for validation or preview purposes
	 */
	public getImportOptions(): ImportOptions {
		return {
			targetFolder: this.targetFolderInput.value.trim() || 'Imported from Joplin',
			applyTemplate: this.applyTemplateCheckbox.checked,
			templatePath: this.applyTemplateCheckbox.checked ? this.templatePathInput.value.trim() : undefined,
			conflictResolution: this.conflictResolutionSelect.value as 'skip' | 'overwrite' | 'rename'
		};
	}

	/**
	 * Public method to set import options (useful for pre-populating the modal)
	 */
	public setImportOptions(options: Partial<ImportOptions>): void {
		// If modal elements aren't created yet, store options for later
		if (!this.targetFolderInput) {
			this.pendingOptions = options;
			return;
		}

		// Apply options to DOM elements
		this.applyOptionsToElements(options);
	}

	private applyOptionsToElements(options: Partial<ImportOptions>): void {
		if (options.targetFolder !== undefined) {
			this.targetFolderInput.value = options.targetFolder;
		}
		if (options.applyTemplate !== undefined) {
			this.applyTemplateCheckbox.checked = options.applyTemplate;
			this.updateTemplatePathVisibility(options.applyTemplate);
		}
		if (options.templatePath !== undefined) {
			this.templatePathInput.value = options.templatePath;
		}
		if (options.conflictResolution !== undefined) {
			this.conflictResolutionSelect.value = options.conflictResolution;
		}
	}

	private showImportProgress(): void {
		// Clear any existing validation errors
		this.clearValidationErrors();

		// Disable form inputs during import
		this.targetFolderInput.disabled = true;
		this.applyTemplateCheckbox.disabled = true;
		this.templatePathInput.disabled = true;
		this.conflictResolutionSelect.disabled = true;

		// Update button states
		this.cancelButton.disabled = true;
		this.importButton.disabled = true;
		this.importButton.setText('Importing...');
		this.importButton.addClass('loading');

		// Create progress container
		const progressContainer = this.contentEl.createDiv('import-progress-container');
		progressContainer.style.cssText = `
			margin-top: 20px;
			padding: 15px;
			background: var(--background-secondary);
			border-radius: 6px;
			border-left: 3px solid var(--interactive-accent);
		`;

		const progressTitle = progressContainer.createEl('h4', { text: 'Import Progress' });
		progressTitle.style.cssText = `
			margin: 0 0 10px 0;
			color: var(--interactive-accent);
		`;

		const progressStatus = progressContainer.createDiv('import-progress-status');
		progressStatus.style.cssText = `
			font-size: 0.9em;
			color: var(--text-muted);
			margin-bottom: 10px;
		`;
		progressStatus.setText('Starting import...');

		// Progress bar
		const progressBarContainer = progressContainer.createDiv('import-progress-bar-container');
		progressBarContainer.style.cssText = `
			width: 100%;
			height: 8px;
			background: var(--background-modifier-border);
			border-radius: 4px;
			overflow: hidden;
		`;

		const progressBar = progressBarContainer.createDiv('import-progress-bar');
		progressBar.style.cssText = `
			height: 100%;
			background: var(--interactive-accent);
			width: 0%;
			transition: width 0.3s ease;
		`;

		// Store references for updates
		this.progressStatus = progressStatus;
		this.progressBar = progressBar;
	}

	private progressStatus: HTMLElement;
	private progressBar: HTMLElement;

	private updateImportProgress(progress: ImportProgress): void {
		if (!this.progressStatus || !this.progressBar) {
			return;
		}

		// Update status text
		this.progressStatus.setText(progress.stage || 'Processing...');

		// Update progress bar if we have current/total info
		if (progress.current !== undefined && progress.total !== undefined) {
			const percentage = Math.round((progress.current / progress.total) * 100);
			this.progressBar.style.width = `${percentage}%`;
		}
	}

	private showImportResults(result: { successful: unknown[]; failed: unknown[] }): void {
		if (!this.progressStatus) {
			return;
		}

		// Update progress to show completion
		if (this.progressBar) {
			this.progressBar.style.width = '100%';
		}

		// Show results summary
		const successCount = result.successful.length;
		const failedCount = result.failed.length;
		const totalCount = successCount + failedCount;

		if (failedCount === 0) {
			// All successful
			this.progressStatus.style.color = 'var(--text-success)';
			this.progressStatus.setText(`✅ Successfully imported ${successCount} of ${totalCount} notes`);
		} else if (successCount === 0) {
			// All failed
			this.progressStatus.style.color = 'var(--text-error)';
			this.progressStatus.setText(`❌ Failed to import ${failedCount} notes`);
		} else {
			// Mixed results
			this.progressStatus.style.color = 'var(--text-warning)';
			this.progressStatus.setText(`⚠️ Imported ${successCount} of ${totalCount} notes (${failedCount} failed)`);
		}

		// Update button text
		this.importButton.setText('Import Complete');
		this.importButton.removeClass('loading');

		// Show detailed results if there were failures
		if (failedCount > 0) {
				this.showFailureDetails(result.failed as { note: unknown; error: string }[]);
		}

		// Show success notice
		if (successCount > 0) {
			new Notice(`Successfully imported ${successCount} note${successCount !== 1 ? 's' : ''} to Obsidian`);
		}
	}

	private showImportError(errorMessage: string): void {
		if (this.progressStatus) {
			this.progressStatus.style.color = 'var(--text-error)';
			this.progressStatus.setText(`❌ Import failed: ${errorMessage}`);
		}

		// Re-enable form
		this.targetFolderInput.disabled = false;
		this.applyTemplateCheckbox.disabled = false;
		this.templatePathInput.disabled = false;
		this.conflictResolutionSelect.disabled = false;
		this.cancelButton.disabled = false;
		this.importButton.disabled = false;
		this.importButton.setText(`Import ${this.selectedResults.length} Note${this.selectedResults.length !== 1 ? 's' : ''}`);
		this.importButton.removeClass('loading');

		// Show error notice
		new Notice(`Import failed: ${errorMessage}`, 5000);
	}

	private showFailureDetails(failures: Array<{ note: unknown; error: string }>): void {
		const progressContainer = this.contentEl.querySelector('.import-progress-container');
		if (!progressContainer) {
			return;
		}

		const failuresContainer = progressContainer.createDiv('import-failures-container');

		const failuresTitle = failuresContainer.createEl('h5', { text: 'Failed Imports:' });

		const failuresList = failuresContainer.createEl('ul');

		failures.forEach(failure => {
			const listItem = failuresList.createEl('li');
			listItem.setText(`${(failure.note as any)?.title || 'Untitled'}: ${failure.error}`);
		});
	}

	private handleImportConfirm(): void {
		// This method is called when the import is confirmed
		// The actual import logic is handled by the import button click handler
		this.importButton.click();
	}

	private onCancel(): void {
		// This method is called when the modal is cancelled
		// The modal is already closed by the time this is called
		this.plugin.logger?.debug('Import options modal cancelled');
	}
}