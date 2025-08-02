import { Plugin } from 'obsidian';
import { JoplinPortalSettings, DEFAULT_SETTINGS } from './src/types';
import { JoplinPortalSettingTab } from './src/settings';

export default class JoplinPortalPlugin extends Plugin {
	settings: JoplinPortalSettings;

	async onload() {
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new JoplinPortalSettingTab(this.app, this));

		// Plugin initialization will be implemented in subsequent tasks
		console.log('Joplin Portal plugin loaded');
	}

	onunload() {
		console.log('Joplin Portal plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}