import { Plugin } from 'obsidian';
import { JoplinPortalSettings, DEFAULT_SETTINGS } from './src/types';

export default class JoplinPortalPlugin extends Plugin {
	settings: JoplinPortalSettings;

	async onload() {
		await this.loadSettings();

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