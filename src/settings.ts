import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import JoplinPortalPlugin from '../main';
import { JoplinPortalSettings } from './types';

export class JoplinPortalSettingTab extends PluginSettingTab {
	plugin: JoplinPortalPlugin;

	constructor(app: App, plugin: JoplinPortalPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Joplin Portal Settings' });

		// Server URL setting
		new Setting(containerEl)
			.setName('Joplin Server URL')
			.setDesc('The URL of your Joplin server (e.g., http://localhost:41184)')
			.addText(text => text
				.setPlaceholder('http://localhost:41184')
				.setValue(this.plugin.settings.serverUrl)
				.onChange(async (value) => {
					this.plugin.settings.serverUrl = value.trim();
					await this.plugin.saveSettings();
				}));

		// API Token setting
		new Setting(containerEl)
			.setName('API Token')
			.setDesc('Your Joplin API token (found in Joplin > Tools > Options > Web Clipper)')
			.addText(text => text
				.setPlaceholder('Enter your API token')
				.setValue(this.plugin.settings.apiToken)
				.onChange(async (value) => {
					this.plugin.settings.apiToken = value.trim();
					await this.plugin.saveSettings();
				}));

		// Connection test button
		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Verify that your Joplin server is accessible with the provided credentials')
			.addButton(button => button
				.setButtonText('Test Connection')
				.setCta()
				.onClick(async () => {
					await this.testConnection();
				}));

		// Default import folder setting
		new Setting(containerEl)
			.setName('Default Import Folder')
			.setDesc('The folder where imported Joplin notes will be saved')
			.addText(text => text
				.setPlaceholder('Imported from Joplin')
				.setValue(this.plugin.settings.defaultImportFolder)
				.onChange(async (value) => {
					this.plugin.settings.defaultImportFolder = value.trim();
					await this.plugin.saveSettings();
				}));

		// Search limit setting
		new Setting(containerEl)
			.setName('Search Results Limit')
			.setDesc('Maximum number of search results to display (1-100)')
			.addSlider(slider => slider
				.setLimits(1, 100, 1)
				.setValue(this.plugin.settings.searchLimit)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.searchLimit = value;
					await this.plugin.saveSettings();
				}));

		// Import template setting
		new Setting(containerEl)
			.setName('Import Template')
			.setDesc('Optional template to apply when importing notes (leave empty for no template)')
			.addText(text => text
				.setPlaceholder('Template name (optional)')
				.setValue(this.plugin.settings.importTemplate)
				.onChange(async (value) => {
					this.plugin.settings.importTemplate = value.trim();
					await this.plugin.saveSettings();
				}));
	}

	private async testConnection(): Promise<void> {
		const { serverUrl, apiToken } = this.plugin.settings;

		// Validate required fields
		if (!serverUrl || !apiToken) {
			new Notice('Please enter both server URL and API token before testing connection.');
			return;
		}

		// Show loading notice
		const loadingNotice = new Notice('Testing connection to Joplin server...', 0);

		try {
			// Construct the ping URL
			const pingUrl = `${serverUrl.replace(/\/$/, '')}/ping?token=${encodeURIComponent(apiToken)}`;

			// Make the request
			const response = await fetch(pingUrl, {
				method: 'GET',
				headers: {
					'Accept': 'application/json',
				},
			});

			loadingNotice.hide();

			if (response.ok) {
				const data = await response.text();
				if (data === 'JoplinClipperServer') {
					new Notice('✅ Connection successful! Joplin server is accessible.', 5000);
				} else {
					new Notice('⚠️ Connection established but unexpected response. Please verify your server URL.', 5000);
				}
			} else {
				let errorMessage = `❌ Connection failed (${response.status})`;

				if (response.status === 401) {
					errorMessage += ': Invalid API token. Please check your token in Joplin settings.';
				} else if (response.status === 404) {
					errorMessage += ': Server not found. Please verify your server URL.';
				} else {
					errorMessage += ': Please check your server URL and API token.';
				}

				new Notice(errorMessage, 8000);
			}
		} catch (error) {
			loadingNotice.hide();

			let errorMessage = '❌ Connection failed: ';

			if (error instanceof TypeError && error.message.includes('fetch')) {
				errorMessage += 'Cannot reach server. Please check if Joplin is running and the URL is correct.';
			} else {
				errorMessage += `${error.message}`;
			}

			new Notice(errorMessage, 8000);
			console.error('Joplin connection test failed:', error);
		}
	}
}