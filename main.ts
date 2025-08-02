import { Plugin } from 'obsidian';
import { JoplinPortalSettings, DEFAULT_SETTINGS } from './src/types';
import { JoplinPortalSettingTab } from './src/settings';
import { JoplinPortalView, VIEW_TYPE_JOPLIN_PORTAL } from './src/joplin-portal-view';
import { JoplinApiService } from './src/joplin-api-service';

export default class JoplinPortalPlugin extends Plugin {
	settings: JoplinPortalSettings;
	joplinService: JoplinApiService;

	async onload() {
		await this.loadSettings();

		// Initialize Joplin API service
		this.joplinService = new JoplinApiService(this.settings);

		// Register the Joplin Portal view
		this.registerView(
			VIEW_TYPE_JOPLIN_PORTAL,
			(leaf) => new JoplinPortalView(leaf, this)
		);

		// Add ribbon icon to open the view
		this.addRibbonIcon('search', 'Open Joplin Portal', () => {
			this.activateView();
		});

		// Add command to open the view
		this.addCommand({
			id: 'open-joplin-portal',
			name: 'Open Joplin Portal',
			callback: () => {
				this.activateView();
			}
		});

		// Add settings tab
		this.addSettingTab(new JoplinPortalSettingTab(this.app, this));

		console.log('Joplin Portal plugin loaded');
	}

	onunload() {
		console.log('Joplin Portal plugin unloaded');
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf = workspace.getLeavesOfType(VIEW_TYPE_JOPLIN_PORTAL)[0];

		if (!leaf) {
			// Create new leaf in right sidebar
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_JOPLIN_PORTAL, active: true });
		}

		// Reveal the leaf in case it's in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update API service with new settings
		if (this.joplinService) {
			this.joplinService.updateSettings(this.settings);
		}
	}
}