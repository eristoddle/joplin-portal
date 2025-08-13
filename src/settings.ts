import { App, PluginSettingTab, Setting, Notice, debounce } from 'obsidian';
import JoplinPortalPlugin from '../main';
import { JoplinPortalSettings } from './types';

interface ValidationState {
	serverUrl: {
		isValid: boolean;
		message: string;
		isValidating: boolean;
	};
	apiToken: {
		isValid: boolean;
		message: string;
		isValidating: boolean;
	};
	connection: {
		isValid: boolean;
		message: string;
		isTesting: boolean;
	};
}

export class JoplinPortalSettingTab extends PluginSettingTab {
	plugin: JoplinPortalPlugin;
	private validationState: ValidationState;
	private serverUrlSetting: any;
	private apiTokenSetting: any;
	private connectionTestSetting: any;
	private validationStatusEl: HTMLElement;
	private debouncedValidateUrl: (url: string) => void;
	private debouncedValidateToken: (token: string) => void;

	constructor(app: App, plugin: JoplinPortalPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		// Initialize validation state
		this.validationState = {
			serverUrl: { isValid: false, message: '', isValidating: false },
			apiToken: { isValid: false, message: '', isValidating: false },
			connection: { isValid: false, message: '', isTesting: false }
		};

		// Create debounced validation functions
		this.debouncedValidateUrl = debounce(this.validateServerUrl.bind(this), 500);
		this.debouncedValidateToken = debounce(this.validateApiToken.bind(this), 500);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Joplin Portal Settings' });

		// Add validation status section
		this.createValidationStatusSection(containerEl);

		// Server URL setting with real-time validation
		this.serverUrlSetting = new Setting(containerEl)
			.setName('Joplin Server URL')
			.setDesc('The URL of your Joplin server (e.g., http://localhost:41184)')
			.addText((text: any) => text
				.setPlaceholder('http://localhost:41184')
				.setValue(this.plugin.settings.serverUrl)
				.onChange(async (value: any) => {
					this.plugin.settings.serverUrl = value.trim();
					await this.plugin.saveSettings();
					this.debouncedValidateUrl(value.trim());
				}));

		// API Token setting with real-time validation
		this.apiTokenSetting = new Setting(containerEl)
			.setName('API Token')
			.setDesc('Your Joplin API token (found in Joplin > Tools > Options > Web Clipper)')
			.addText((text: any) => text
				.setPlaceholder('Enter your API token')
				.setValue(this.plugin.settings.apiToken)
				.onChange(async (value: any) => {
					this.plugin.settings.apiToken = value.trim();
					await this.plugin.saveSettings();
					this.debouncedValidateToken(value.trim());
				}));

		// Connection test button with enhanced feedback
		this.connectionTestSetting = new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Verify that your Joplin server is accessible with the provided credentials')
			.addButton((button: any) => button
				.setButtonText('Test Connection')
				.setCta()
				.onClick(async () => {
					await this.testConnection();
				}));

		// Troubleshooting section
		this.createTroubleshootingSection(containerEl);

		// Default import folder setting
		new Setting(containerEl)
			.setName('Default Import Folder')
			.setDesc('The folder where imported Joplin notes will be saved')
			.addText((text: any) => text
				.setPlaceholder('Imported from Joplin')
				.setValue(this.plugin.settings.defaultImportFolder)
				.onChange(async (value: any) => {
					this.plugin.settings.defaultImportFolder = value.trim();
					await this.plugin.saveSettings();
				}));

		// Search limit setting
		new Setting(containerEl)
			.setName('Search Results Limit')
			.setDesc('Maximum number of search results to display (1-100)')
			.addSlider((slider: any) => slider
				.setLimits(1, 100, 1)
				.setValue(this.plugin.settings.searchLimit)
				.setDynamicTooltip()
				.onChange(async (value: any) => {
					this.plugin.settings.searchLimit = value;
					await this.plugin.saveSettings();
				}));

		// Import template setting
		new Setting(containerEl)
			.setName('Import Template')
			.setDesc('Optional template to apply when importing notes (leave empty for no template)')
			.addText((text: any) => text
				.setPlaceholder('Template name (optional)')
				.setValue(this.plugin.settings.importTemplate)
				.onChange(async (value: any) => {
					this.plugin.settings.importTemplate = value.trim();
					await this.plugin.saveSettings();
				}));

		// Perform initial validation
		this.performInitialValidation();
	}

	/**
	 * Create validation status section to show real-time feedback
	 */
	private createValidationStatusSection(containerEl: HTMLElement): void {
		const statusContainer = containerEl.createDiv('joplin-portal-validation-status');
		statusContainer.createEl('h3', { text: 'Configuration Status' });

		this.validationStatusEl = statusContainer.createDiv('validation-status-content');
		this.updateValidationDisplay();
	}

	/**
	 * Create troubleshooting section with guidance
	 */
	private createTroubleshootingSection(containerEl: HTMLElement): void {
		const troubleshootingContainer = containerEl.createDiv('joplin-portal-troubleshooting');
		troubleshootingContainer.createEl('h3', { text: 'Troubleshooting' });

		const troubleshootingContent = troubleshootingContainer.createDiv('troubleshooting-content');

		troubleshootingContent.createEl('h4', { text: 'Common Issues' });

		const issuesList = troubleshootingContent.createEl('ul');

		issuesList.createEl('li').innerHTML =
			'<strong>Connection Failed:</strong> Ensure Joplin is running and Web Clipper service is enabled (Tools → Options → Web Clipper)';

		issuesList.createEl('li').innerHTML =
			'<strong>Invalid API Token:</strong> Copy the token from Joplin (Tools → Options → Web Clipper → Advanced options)';

		issuesList.createEl('li').innerHTML =
			'<strong>Server Not Found:</strong> Check if the server URL is correct (default: http://localhost:41184)';

		issuesList.createEl('li').innerHTML =
			'<strong>Firewall Issues:</strong> Ensure port 41184 is not blocked by firewall or antivirus software';

		issuesList.createEl('li').innerHTML =
			'<strong>HTTPS Issues:</strong> If using HTTPS, ensure the certificate is valid and trusted';

		troubleshootingContent.createEl('h4', { text: 'Setup Steps' });

		const setupList = troubleshootingContent.createEl('ol');

		setupList.createEl('li').innerHTML =
			'Open Joplin and go to <strong>Tools → Options → Web Clipper</strong>';

		setupList.createEl('li').innerHTML =
			'Enable the Web Clipper service if not already enabled';

		setupList.createEl('li').innerHTML =
			'Copy the API token from the <strong>Advanced options</strong> section';

		setupList.createEl('li').innerHTML =
			'Note the server URL (usually http://localhost:41184)';

		setupList.createEl('li').innerHTML =
			'Paste both values in the settings above and test the connection';
	}

	/**
	 * Perform initial validation when settings are displayed
	 */
	private async performInitialValidation(): Promise<void> {
		const { serverUrl, apiToken } = this.plugin.settings;

		if (serverUrl) {
			await this.validateServerUrl(serverUrl);
		}

		if (apiToken) {
			await this.validateApiToken(apiToken);
		}

		this.updateValidationDisplay();
	}

	/**
	 * Validate server URL format and reachability
	 */
	private async validateServerUrl(url: string): Promise<void> {
		if (this.validationState.serverUrl.isValidating) {
			return;
		}

		this.validationState.serverUrl.isValidating = true;
		this.updateValidationDisplay();

		try {
			// Basic URL format validation
			if (!url) {
				this.validationState.serverUrl = {
					isValid: false,
					message: 'Server URL is required',
					isValidating: false
				};
				this.updateValidationDisplay();
				return;
			}

			let normalizedUrl: URL;
			try {
				normalizedUrl = new URL(url);
			} catch {
				this.validationState.serverUrl = {
					isValid: false,
					message: 'Invalid URL format. Use format: http://localhost:41184',
					isValidating: false
				};
				this.updateValidationDisplay();
				return;
			}

			// Check protocol
			if (!['http:', 'https:'].includes(normalizedUrl.protocol)) {
				this.validationState.serverUrl = {
					isValid: false,
					message: 'URL must use HTTP or HTTPS protocol',
					isValidating: false
				};
				this.updateValidationDisplay();
				return;
			}

			// Check if it looks like a Joplin server URL
			if (normalizedUrl.pathname !== '/' && normalizedUrl.pathname !== '') {
				this.validationState.serverUrl = {
					isValid: false,
					message: 'URL should not include a path (e.g., use http://localhost:41184, not http://localhost:41184/api)',
					isValidating: false
				};
				this.updateValidationDisplay();
				return;
			}

			// Try to reach the server (basic connectivity test)
			try {
				const testUrl = `${url.replace(/\/$/, '')}/ping`;
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 5000);

				const response = await fetch(testUrl, {
					method: 'GET',
					signal: controller.signal,
					headers: { 'Accept': 'text/plain' }
				});

				clearTimeout(timeoutId);

				if (response.status === 401) {
					// 401 means server is reachable but needs authentication
					this.validationState.serverUrl = {
						isValid: true,
						message: 'Server is reachable (authentication required)',
						isValidating: false
					};
				} else if (response.status === 200) {
					// Server responded successfully
					this.validationState.serverUrl = {
						isValid: true,
						message: 'Server is reachable',
						isValidating: false
					};
				} else {
					this.validationState.serverUrl = {
						isValid: false,
						message: `Server responded with status ${response.status}. Check if Joplin Web Clipper is enabled.`,
						isValidating: false
					};
				}
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') {
					this.validationState.serverUrl = {
						isValid: false,
						message: 'Connection timeout. Check if Joplin is running and the URL is correct.',
						isValidating: false
					};
				} else {
					this.validationState.serverUrl = {
						isValid: false,
						message: 'Cannot reach server. Ensure Joplin is running and Web Clipper is enabled.',
						isValidating: false
					};
				}
			}
		} finally {
			this.validationState.serverUrl.isValidating = false;
			this.updateValidationDisplay();
		}
	}

	/**
	 * Validate API token format
	 */
	private async validateApiToken(token: string): Promise<void> {
		if (this.validationState.apiToken.isValidating) {
			return;
		}

		this.validationState.apiToken.isValidating = true;
		this.updateValidationDisplay();

		try {
			if (!token) {
				this.validationState.apiToken = {
					isValid: false,
					message: 'API token is required',
					isValidating: false
				};
				this.updateValidationDisplay();
				return;
			}

			// Basic token format validation
			if (token.length < 10) {
				this.validationState.apiToken = {
					isValid: false,
					message: 'API token appears too short. Check if you copied the complete token.',
					isValidating: false
				};
				this.updateValidationDisplay();
				return;
			}

			// Check for common token format patterns
			if (!/^[a-zA-Z0-9]+$/.test(token)) {
				this.validationState.apiToken = {
					isValid: false,
					message: 'API token contains invalid characters. It should only contain letters and numbers.',
					isValidating: false
				};
				this.updateValidationDisplay();
				return;
			}

			// Token format looks valid
			this.validationState.apiToken = {
				isValid: true,
				message: 'Token format is valid',
				isValidating: false
			};
		} finally {
			this.validationState.apiToken.isValidating = false;
			this.updateValidationDisplay();
		}
	}

	/**
	 * Update the validation display with current state
	 */
	private updateValidationDisplay(): void {
		if (!this.validationStatusEl) {
			return;
		}

		this.validationStatusEl.empty();

		// Server URL status
		const urlStatus = this.validationStatusEl.createDiv('validation-item');
		const urlIcon = this.getValidationIcon(this.validationState.serverUrl);
		urlStatus.innerHTML = `${urlIcon} <strong>Server URL:</strong> ${this.validationState.serverUrl.message || 'Not validated'}`;

		// API Token status
		const tokenStatus = this.validationStatusEl.createDiv('validation-item');
		const tokenIcon = this.getValidationIcon(this.validationState.apiToken);
		tokenStatus.innerHTML = `${tokenIcon} <strong>API Token:</strong> ${this.validationState.apiToken.message || 'Not validated'}`;

		// Connection status
		const connectionStatus = this.validationStatusEl.createDiv('validation-item');
		const connectionIcon = this.getValidationIcon(this.validationState.connection);
		connectionStatus.innerHTML = `${connectionIcon} <strong>Connection:</strong> ${this.validationState.connection.message || 'Not tested'}`;

		// Overall status
		const isFullyValid = this.isConfigurationValid();
		const overallStatus = this.validationStatusEl.createDiv('validation-overall');
		const overallIcon = isFullyValid ? '✅' : '❌';
		const overallMessage = isFullyValid
			? 'Configuration is valid and ready to use'
			: 'Configuration needs attention before plugin can be used';

		overallStatus.innerHTML = `${overallIcon} <strong>${overallMessage}</strong>`;
		overallStatus.addClass(isFullyValid ? 'validation-success' : 'validation-error');

		// Update connection test button state
		this.updateConnectionTestButton();
	}

	/**
	 * Get appropriate icon for validation state
	 */
	private getValidationIcon(state: { isValid: boolean; isValidating?: boolean; isTesting?: boolean }): string {
		if (state.isValidating || state.isTesting) {
			return '🔄';
		}
		return state.isValid ? '✅' : '❌';
	}

	/**
	 * Check if the overall configuration is valid
	 */
	private isConfigurationValid(): boolean {
		return this.validationState.serverUrl.isValid &&
			   this.validationState.apiToken.isValid;
	}

	/**
	 * Update connection test button based on validation state
	 */
	private updateConnectionTestButton(): void {
		if (!this.connectionTestSetting) {
			return;
		}

		const button = this.connectionTestSetting.controlEl.querySelector('button');
		if (!button) {
			return;
		}

		const isValid = this.isConfigurationValid();
		const isTesting = this.validationState.connection.isTesting;

		button.disabled = !isValid || isTesting;
		button.textContent = isTesting ? 'Testing...' : 'Test Connection';

		if (!isValid) {
			button.title = 'Please fix server URL and API token validation errors first';
		} else {
			button.title = 'Test connection to Joplin server';
		}
	}

	/**
	 * Enhanced connection test with detailed feedback
	 */
	private async testConnection(): Promise<void> {
		const { serverUrl, apiToken } = this.plugin.settings;

		// Pre-validation check
		if (!this.isConfigurationValid()) {
			new Notice('❌ Please fix configuration errors before testing connection.', 5000);
			return;
		}

		// Update connection state
		this.validationState.connection.isTesting = true;
		this.validationState.connection.message = 'Testing connection...';
		this.updateValidationDisplay();

		try {
			// Use the JoplinApiService for consistent testing
			const isConnected = await this.plugin.joplinService.testConnection();

			if (isConnected) {
				this.validationState.connection = {
					isValid: true,
					message: 'Connection successful! Plugin is ready to use.',
					isTesting: false
				};
				new Notice('✅ Connection successful! Joplin Portal is ready to use.', 5000);
			} else {
				this.validationState.connection = {
					isValid: false,
					message: 'Connection failed. Check troubleshooting section below.',
					isTesting: false
				};
				new Notice('❌ Connection failed. Please check the troubleshooting section for help.', 8000);
			}
		} catch (error) {
			this.validationState.connection = {
				isValid: false,
				message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				isTesting: false
			};

			let errorMessage = '❌ Connection failed: ';
			if (error instanceof TypeError && error.message.includes('fetch')) {
				errorMessage += 'Cannot reach server. Check if Joplin is running and Web Clipper is enabled.';
			} else if (error instanceof Error) {
				errorMessage += error.message;
			} else {
				errorMessage += 'Unknown error occurred.';
			}

			new Notice(errorMessage, 8000);
			console.error('Joplin connection test failed:', error);
		} finally {
			this.updateValidationDisplay();
		}
	}

	/**
	 * Check if plugin functionality should be enabled
	 */
	isPluginFunctionalityEnabled(): boolean {
		return this.isConfigurationValid() && this.validationState.connection.isValid;
	}
}