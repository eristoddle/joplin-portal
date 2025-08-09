import { Modal, Setting, Notice } from 'obsidian';
import JoplinPortalPlugin from '../main';
import { ImportOptions } from './types';

export class ImportOptionsModal extends Modal {
	plugin: JoplinPortalPlugin;
	private targetFolderInput: HTMLInputElement;
	private applyTemplateCheckbox: HTMLInputElement;
	private templatePathInput: HTMLInputElement;
	private conflictResolutionSelect: HTMLSelectElement;
	private onConfirm: (options: ImportOptions) => void;
	private onCancel: () => void;

	constructor(
		plugin: JoplinPortalPlugin,
		onConfirm: (options: ImportOptions) => void,
		onCancel: () => void
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Set modal title
		this.titleEl.setText('Import Options');

		// Add modal description
		const description = contentEl.createDiv('import-options-description');
		description.style.cssText = `
			margin-bottom: 20px;
			color: var(--text-muted);
			font-size: 0.9em;
		`;
		description.setText('Configure how the selected notes will be imported into your Obsidian vault.');

		// Create settings container
		const settingsContainer = contentEl.createDiv('import-options-settings');

		// Target folder setting
		new Setting(settingsContainer)
			.setName('Target folder')
			.setDesc('The folder where imported notes will be saved')
			.addText(text => {
				this.targetFolderInput = text.inputEl;
				text
					.setPlaceholder('Imported from Joplin')
					.setValue(this.plugin.settings.defaultImportFolder || 'Imported from Joplin')
					.onChange(value => {
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
			.addToggle(toggle => {
				this.applyTemplateCheckbox = toggle.toggleEl;
				toggle
					.setValue(false)
					.onChange(value => {
						this.updateTemplatePathVisibility(value);
					});
			});

		// Template path setting (initially hidden)
		const templatePathSetting = new Setting(settingsContainer)
			.setName('Template path')
			.setDesc('Path to the template file to apply to imported notes')
			.addText(text => {
				this.templatePathInput = text.inputEl;
				text
					.setPlaceholder('Templates/Note Template.md')
					.setValue('')
					.onChange(value => {
						this.validateTemplatePath(value.trim());
					});
			});

		// Hide template path setting initially
		templatePathSetting.settingEl.style.display = 'none';
		templatePathSetting.settingEl.setAttribute('data-template-path-setting', 'true');

		// Conflict resolution setting
		new Setting(settingsContainer)
			.setName('If file exists')
			.setDesc('How to handle files that already exist in the target folder')
			.addDropdown(dropdown => {
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

		// Focus the target folder input
		this.targetFolderInput.focus();
		this.targetFolderInput.select();
	}

	private createAdvancedSettingsSection(container: HTMLElement): void {
		// Advanced settings header
		const advancedHeader = container.createDiv('import-options-advanced-header');
		advancedHeader.style.cssText = `
			margin-top: 30px;
			margin-bottom: 15px;
			padding-bottom: 8px;
			border-bottom: 1px solid var(--background-modifier-border);
			display: flex;
			align-items: center;
			cursor: pointer;
		`;

		const advancedToggle = advancedHeader.createSpan('import-options-advanced-toggle');
		advancedToggle.style.cssText = `
			margin-right: 8px;
			font-size: 0.8em;
			transition: transform 0.2s;
		`;
		advancedToggle.setText('▶');

		const advancedTitle = advancedHeader.createSpan('import-options-advanced-title');
		advancedTitle.style.cssText = `
			font-weight: 600;
			font-size: 1.1em;
		`;
		advancedTitle.setText('Advanced Settings');

		// Advanced settings container (initially hidden)
		const advancedContainer = container.createDiv('import-options-advanced-container');
		advancedContainer.style.cssText = `
			display: none;
			margin-top: 15px;
			padding: 15px;
			background: var(--background-secondary);
			border-radius: 6px;
		`;

		// Toggle advanced settings visibility
		let advancedExpanded = false;
		advancedHeader.addEventListener('click', () => {
			advancedExpanded = !advancedExpanded;
			if (advancedExpanded) {
				advancedContainer.style.display = 'block';
				advancedToggle.setText('▼');
				advancedToggle.style.transform = 'rotate(90deg)';
			} else {
				advancedContainer.style.display = 'none';
				advancedToggle.setText('▶');
				advancedToggle.style.transform = 'rotate(0deg)';
			}
		});

		// Add advanced settings
		const advancedNote = advancedContainer.createDiv('import-options-advanced-note');
		advancedNote.style.cssText = `
			color: var(--text-muted);
			font-size: 0.85em;
			margin-bottom: 15px;
			font-style: italic;
		`;
		advancedNote.setText('Additional import configuration options will be available here in future updates.');

		// Placeholder for future advanced settings
		const placeholderSetting = advancedContainer.createDiv('import-options-placeholder-setting');
		placeholderSetting.style.cssText = `
			padding: 10px;
			border: 1px dashed var(--background-modifier-border);
			border-radius: 4px;
			text-align: center;
			color: var(--text-muted);
			font-size: 0.9em;
		`;
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

		// Cancel button
		const cancelButton = buttonsContainer.createEl('button', {
			text: 'Cancel',
			cls: 'mod-cancel'
		});
		cancelButton.addEventListener('click', () => {
			this.close();
			this.onCancel();
		});

		// Import button (primary action)
		const importButton = buttonsContainer.createEl('button', {
			text: 'Import Notes',
			cls: 'mod-cta'
		});
		importButton.addEventListener('click', () => {
			this.handleImportConfirm();
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

	private handleImportConfirm(): void {
		// Validate inputs
		const targetFolder = this.targetFolderInput.value.trim();
		if (!targetFolder) {
			this.showValidationError('Target folder is required');
			this.targetFolderInput.focus();
			return;
		}

		const applyTemplate = this.applyTemplateCheckbox.checked;
		const templatePath = this.templatePathInput.value.trim();

		if (applyTemplate && !templatePath) {
			this.showValidationError('Template path is required when applying template');
			this.templatePathInput.focus();
			return;
		}

		if (applyTemplate && templatePath && !templatePath.endsWith('.md')) {
			this.showValidationError('Template path must end with .md');
			this.templatePathInput.focus();
			return;
		}

		// Create import options object
		const importOptions: ImportOptions = {
			targetFolder,
			applyTemplate,
			templatePath: applyTemplate ? templatePath : undefined,
			conflictResolution: this.conflictResolutionSelect.value as 'skip' | 'overwrite' | 'rename'
		};

		// Close modal and execute callback
		this.close();
		this.onConfirm(importOptions);
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
}