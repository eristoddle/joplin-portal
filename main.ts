import { Plugin, Notice } from 'obsidian';
import { JoplinPortalSettings, DEFAULT_SETTINGS } from './src/types';
import { JoplinPortalSettingTab } from './src/settings';
import { JoplinPortalView, VIEW_TYPE_JOPLIN_PORTAL } from './src/joplin-portal-view';
import { JoplinApiService } from './src/joplin-api-service';
import { ImportService } from './src/import-service';
import { ErrorHandler } from './src/error-handler';

export default class JoplinPortalPlugin extends Plugin {
	settings: JoplinPortalSettings;
	joplinService: JoplinApiService;
	importService: ImportService;
	private onlineStatusListener: () => void;
	private offlineStatusListener: () => void;

	async onload() {
		await this.loadSettings();

		// Initialize services
		this.joplinService = new JoplinApiService(this.settings);
		this.importService = new ImportService(this.app);

		// Set up offline/online detection
		this.setupOfflineDetection();

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

		// Add command to check connection status
		this.addCommand({
			id: 'check-joplin-connection',
			name: 'Check Joplin Connection',
			callback: () => {
				this.checkConnectionStatus();
			}
		});

		// Add command to clear request queue
		this.addCommand({
			id: 'clear-joplin-queue',
			name: 'Clear Joplin Request Queue',
			callback: () => {
				this.clearRequestQueue();
			}
		});

		// Add settings tab
		this.addSettingTab(new JoplinPortalSettingTab(this.app, this));

		console.log('Joplin Portal plugin loaded');
	}

	onunload() {
		// Clean up offline detection listeners
		this.cleanupOfflineDetection();

		// Clear any pending requests
		if (this.joplinService) {
			this.joplinService.clearQueue();
		}

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

	/**
	 * Set up offline/online detection
	 */
	private setupOfflineDetection(): void {
		this.onlineStatusListener = () => {
			console.log('Joplin Portal: System came online');
			new Notice('🌐 Connection restored - Joplin Portal is now available', 3000);
		};

		this.offlineStatusListener = () => {
			console.log('Joplin Portal: System went offline');
			const offlineError = ErrorHandler.createOfflineError();
			ErrorHandler.showErrorNotice(offlineError, 5000);
		};

		// Add event listeners
		window.addEventListener('online', this.onlineStatusListener);
		window.addEventListener('offline', this.offlineStatusListener);

		// Log initial status
		console.log(`Joplin Portal: Initial connection status - ${ErrorHandler.isOnline() ? 'Online' : 'Offline'}`);
	}

	/**
	 * Clean up offline detection listeners
	 */
	private cleanupOfflineDetection(): void {
		if (this.onlineStatusListener) {
			window.removeEventListener('online', this.onlineStatusListener);
		}
		if (this.offlineStatusListener) {
			window.removeEventListener('offline', this.offlineStatusListener);
		}
	}

	/**
	 * Check and display connection status
	 */
	private async checkConnectionStatus(): Promise<void> {
		if (!ErrorHandler.isOnline()) {
			const offlineError = ErrorHandler.createOfflineError();
			ErrorHandler.showErrorNotice(offlineError);
			return;
		}

		if (!this.joplinService.isConfigured()) {
			new Notice('❌ Joplin Portal is not configured. Please check your settings.', 5000);
			return;
		}

		new Notice('🔄 Testing connection to Joplin server...', 2000);

		try {
			const isConnected = await this.joplinService.testConnection();

			if (isConnected) {
				const queueStatus = this.joplinService.getQueueStatus();
				new Notice(
					`✅ Connected to Joplin server\n` +
					`📊 Queue: ${queueStatus.queueLength} pending, ${queueStatus.activeRequests} active\n` +
					`📈 Requests in last minute: ${queueStatus.requestsInLastMinute}`,
					5000
				);
			} else {
				new Notice('❌ Failed to connect to Joplin server. Please check your settings.', 5000);
			}
		} catch (error) {
			const userError = ErrorHandler.handleApiError(error, 'Connection test');
			ErrorHandler.showErrorNotice(userError);
		}
	}

	/**
	 * Clear the request queue
	 */
	private clearRequestQueue(): void {
		if (!this.joplinService) {
			new Notice('❌ Joplin service not initialized', 3000);
			return;
		}

		const queueStatus = this.joplinService.getQueueStatus();

		if (queueStatus.queueLength === 0) {
			new Notice('ℹ️ Request queue is already empty', 3000);
			return;
		}

		this.joplinService.clearQueue();
		new Notice(`🗑️ Cleared ${queueStatus.queueLength} pending requests from queue`, 3000);
	}
}