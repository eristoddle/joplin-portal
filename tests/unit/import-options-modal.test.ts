import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Obsidian imports first
vi.mock('obsidian', () => ({
	Modal: class MockModal {
		app: any;
		titleEl: any;
		contentEl: any;
		modalEl: any;

		constructor(app: any) {
			this.app = app;
			this.titleEl = {
				setText: vi.fn()
			};
			this.contentEl = {
				empty: vi.fn(),
				createDiv: vi.fn().mockImplementation((cls?: string) => {
					const div = {
						style: {},
						className: cls || '',
						setText: vi.fn(),
						createEl: vi.fn().mockReturnValue({
							style: {},
							setText: vi.fn(),
							addEventListener: vi.fn()
						}),
						createDiv: vi.fn().mockImplementation((cls?: string) => ({
							style: {},
							className: cls || '',
							setText: vi.fn(),
							addEventListener: vi.fn(),
							createEl: vi.fn().mockReturnValue({
								style: {},
								setText: vi.fn(),
								addEventListener: vi.fn()
							}),
							createSpan: vi.fn().mockReturnValue({
								style: {},
								setText: vi.fn(),
								addEventListener: vi.fn()
							})
						})),
						createSpan: vi.fn().mockReturnValue({
							style: {},
							setText: vi.fn(),
							addEventListener: vi.fn()
						}),
						addEventListener: vi.fn(),
						querySelector: vi.fn(),
						querySelectorAll: vi.fn().mockReturnValue([])
					};
					return div;
				}),
				createEl: vi.fn().mockReturnValue({
					style: {},
					setText: vi.fn(),
					addEventListener: vi.fn()
				}),
				createSpan: vi.fn().mockReturnValue({
					style: {},
					setText: vi.fn(),
					addEventListener: vi.fn()
				}),
				querySelector: vi.fn(),
				querySelectorAll: vi.fn().mockReturnValue([])
			};
			this.modalEl = {
				addEventListener: vi.fn(),
				querySelectorAll: vi.fn().mockReturnValue([])
			};
		}

		open() {
			this.onOpen();
		}

		close() {
			this.onClose();
		}

		onOpen() {}
		onClose() {}
	},
	Setting: class MockSetting {
		settingEl: any;

		constructor(containerEl: any) {
			this.settingEl = {
				style: {},
				setAttribute: vi.fn()
			};
		}

		setName(name: string) {
			return this;
		}

		setDesc(desc: string) {
			return this;
		}

		addText(callback: (text: any) => void) {
			const mockText = {
				inputEl: {
					value: '',
					addEventListener: vi.fn(),
					focus: vi.fn(),
					select: vi.fn()
				},
				setPlaceholder: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis()
			};
			callback(mockText);
			return this;
		}

		addToggle(callback: (toggle: any) => void) {
			const mockToggle = {
				toggleEl: {
					checked: false,
					addEventListener: vi.fn()
				},
				setValue: vi.fn().mockReturnThis(),
				onChange: vi.fn().mockReturnThis()
			};
			callback(mockToggle);
			return this;
		}

		addDropdown(callback: (dropdown: any) => void) {
			const mockDropdown = {
				selectEl: {
					value: 'skip',
					addEventListener: vi.fn()
				},
				addOption: vi.fn().mockReturnThis(),
				setValue: vi.fn().mockReturnThis()
			};
			callback(mockDropdown);
			return this;
		}
	},
	Notice: vi.fn()
}));

import { ImportOptionsModal } from '../../src/import-options-modal';
import { ImportOptions } from '../../src/types';

describe('ImportOptionsModal', () => {
	let mockPlugin: any;
	let mockApp: any;
	let onComplete: vi.Mock;
	let modal: ImportOptionsModal;

	beforeEach(() => {
		mockApp = {
			setting: {
				settingTabs: []
			}
		};

		mockPlugin = {
			app: mockApp,
			settings: {
				defaultImportFolder: 'Test Folder',
				importTemplate: '',
				searchLimit: 50
			},
			importService: {
				importNotes: vi.fn().mockResolvedValue({
					successful: [],
					failed: []
				})
			}
		};

		const mockSelectedResults = [
			{
				note: {
					id: 'test-1',
					title: 'Test Note 1',
					body: 'Test content',
					created_time: Date.now(),
					updated_time: Date.now()
				}
			}
		];

		onComplete = vi.fn();

		modal = new ImportOptionsModal(mockPlugin, mockSelectedResults, onComplete);
	});

	describe('constructor', () => {
		it('should initialize with plugin and callbacks', () => {
			expect(modal.plugin).toBe(mockPlugin);
			expect(modal['onComplete']).toBe(onComplete);
			expect(modal['selectedResults']).toBeDefined();
		});
	});

	describe('onOpen', () => {
		it('should set modal title', () => {
			modal.onOpen();
			expect(modal.titleEl.setText).toHaveBeenCalledWith('Import Options');
		});

		it('should empty content element', () => {
			modal.onOpen();
			expect(modal.contentEl.empty).toHaveBeenCalled();
		});
	});

	describe('getImportOptions', () => {
		beforeEach(() => {
			modal.onOpen();
		});

		it('should return current import options', () => {
			const options = modal.getImportOptions();

			expect(options).toEqual({
				targetFolder: 'Test Folder',
				applyTemplate: false,
				templatePath: undefined,
				conflictResolution: 'skip'
			});
		});
	});

	describe('setImportOptions', () => {
		beforeEach(() => {
			modal.onOpen();
		});

		it('should set target folder', () => {
			const options: Partial<ImportOptions> = {
				targetFolder: 'New Folder'
			};

			modal.setImportOptions(options);
			expect(modal['targetFolderInput'].value).toBe('New Folder');
		});

		it('should set apply template', () => {
			const options: Partial<ImportOptions> = {
				applyTemplate: true
			};

			modal.setImportOptions(options);
			expect(modal['applyTemplateCheckbox'].checked).toBe(true);
		});

		it('should set template path', () => {
			const options: Partial<ImportOptions> = {
				templatePath: 'Templates/Note.md'
			};

			modal.setImportOptions(options);
			expect(modal['templatePathInput'].value).toBe('Templates/Note.md');
		});

		it('should set conflict resolution', () => {
			const options: Partial<ImportOptions> = {
				conflictResolution: 'overwrite'
			};

			modal.setImportOptions(options);
			expect(modal['conflictResolutionSelect'].value).toBe('overwrite');
		});
	});

	describe('onClose', () => {
		it('should empty content element', () => {
			modal.onClose();
			expect(modal.contentEl.empty).toHaveBeenCalled();
		});
	});
});