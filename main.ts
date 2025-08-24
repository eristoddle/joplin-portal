import { Plugin, Notice, WorkspaceLeaf, addIcon } from 'obsidian';
import { JoplinPortalSettings, DEFAULT_SETTINGS } from './src/types';
import { JoplinPortalSettingTab } from './src/settings';
import { JoplinPortalView, VIEW_TYPE_JOPLIN_PORTAL } from './src/joplin-portal-view';
import { JoplinApiService } from './src/joplin-api-service';
import { ImportService } from './src/import-service';
import { ErrorHandler } from './src/error-handler';
import { Logger } from './src/logger';

export default class JoplinPortalPlugin extends Plugin {
	settings: JoplinPortalSettings;
	joplinService: JoplinApiService;
	importService: ImportService;
	logger: Logger;
	private onlineStatusListener: () => void;
	private offlineStatusListener: () => void;

	async onload() {
		// Register icon FIRST, before anything else
		this.registerJoplinIconEarly();

		await this.loadSettings();

		// Initialize logger with current settings
		this.logger = new Logger(this.settings);

		// Register the actual Joplin icon again after logger is ready
		this.registerJoplinIcon();

		// Initialize services
		this.joplinService = new JoplinApiService(this.settings, this.logger);
		this.importService = new ImportService(this.app, this.logger, this.settings, this.joplinService, () => {
			// Callback for when import is complete - can be used for cache invalidation
			// Note: This callback is currently not used but kept for future functionality
		});

		// Set up offline/online detection
		this.setupOfflineDetection();

		// Register the Joplin Portal view
		this.registerView(
			VIEW_TYPE_JOPLIN_PORTAL,
			(leaf: WorkspaceLeaf) => new JoplinPortalView(leaf, this)
		);

		// Ensure icon is registered before adding ribbon icon
		this.registerJoplinIcon();

		// Add ribbon icon to open the view
		this.addRibbonIcon('joplin-icon', 'Open Joplin Portal', () => {
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

		// Add command to clear search cache
		this.addCommand({
			id: 'clear-joplin-cache',
			name: 'Clear Joplin Search Cache',
			callback: () => {
				this.clearSearchCache();
			}
		});

		// Add command to show cache statistics
		this.addCommand({
			id: 'show-joplin-cache-stats',
			name: 'Show Joplin Cache Statistics',
			callback: () => {
				this.showCacheStatistics();
			}
		});

		// Add command to focus search input
		this.addCommand({
			id: 'focus-joplin-search',
			name: 'Focus Joplin Search',
			callback: () => {
				this.focusSearchInput();
			}
		});

		// Add command to select all for import
		this.addCommand({
			id: 'select-all-joplin-import',
			name: 'Select All Notes for Import',
			callback: () => {
				this.selectAllForImport();
			}
		});

		// Add command to import selected notes
		this.addCommand({
			id: 'import-selected-joplin-notes',
			name: 'Import Selected Joplin Notes',
			callback: () => {
				this.importSelectedNotes();
			}
		});

		// Add command to re-register the icon (for troubleshooting)
		this.addCommand({
			id: 'refresh-joplin-icon',
			name: 'Refresh Joplin Portal Icon',
			callback: () => {
				this.registerJoplinIcon();
				new Notice('Joplin Portal icon refreshed', 2000);
			}
		});

		// Add debug command to check icon status
		this.addCommand({
			id: 'debug-joplin-icon',
			name: 'Debug Joplin Portal Icon',
			callback: () => {
				this.debugIconStatus();
			}
		});

		// Add settings tab
		this.addSettingTab(new JoplinPortalSettingTab(this.app, this));

		// Register icon again when workspace is ready (ensures it's available after full load)
		this.app.workspace.onLayoutReady(() => {
			this.registerJoplinIcon();

			// Set up a periodic check to ensure icon stays registered
			this.setupIconPersistenceCheck();
		});

		// Register on workspace change events (less frequent than file-open)
		(this as any).registerEvent(
			this.app.workspace.on('layout-change', () => {
				// Only re-register if we have Joplin Portal tabs open
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOPLIN_PORTAL);
				if (leaves.length > 0) {
					this.registerJoplinIcon();
				}
			})
		);

		this.logger.debug('Joplin Portal plugin loaded');
	}

	async onunload() {
		// Clean up offline detection listeners
		this.cleanupOfflineDetection();

		// Clear any pending requests
		if (this.joplinService) {
			this.joplinService.clearQueue();
		}

		// Clear icon persistence check interval
		if ((this as any).iconPersistenceInterval) {
			clearInterval((this as any).iconPersistenceInterval);
		}

		this.logger.debug('Joplin Portal plugin unloaded');
	}

	async activateView() {
		// Check if plugin is properly configured before activating view
		if (!this.isPluginConfigured()) {
			new Notice('⚠️ Joplin Portal is not configured. Please check your settings first.', 5000);
			// Open settings tab - use the correct Obsidian API
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById(this.manifest.id);
			return;
		}

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
		// Update import service with new settings
		if (this.importService) {
			this.importService.updateSettings(this.settings);
		}
		// Update logger with new settings
		if (this.logger) {
			this.logger.updateSettings(this.settings);
		}
	}

	/**
	 * Set up offline/online detection
	 */
	private setupOfflineDetection(): void {
		this.onlineStatusListener = () => {
			this.logger.debug('System came online');
			new Notice('🌐 Connection restored - Joplin Portal is now available', 3000);
		};

		this.offlineStatusListener = () => {
			this.logger.debug('System went offline');
			const offlineError = ErrorHandler.createOfflineError();
			ErrorHandler.showErrorNotice(offlineError, 5000);
		};

		// Add event listeners
		window.addEventListener('online', this.onlineStatusListener);
		window.addEventListener('offline', this.offlineStatusListener);

		// Log initial status
		this.logger.debug(`Initial connection status - ${ErrorHandler.isOnline() ? 'Online' : 'Offline'}`);
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

	/**
	 * Clear the search cache
	 */
	private clearSearchCache(): void {
		if (!this.joplinService) {
			new Notice('❌ Joplin service not initialized', 3000);
			return;
		}

		const stats = this.joplinService.getCacheStats();

		if (stats.size === 0) {
			new Notice('ℹ️ Search cache is already empty', 3000);
			return;
		}

		this.joplinService.clearSearchCache();
		new Notice(`🗑️ Cleared ${stats.size} entries from search cache`, 3000);
	}

	/**
	 * Show cache statistics
	 */
	private showCacheStatistics(): void {
		if (!this.joplinService) {
			new Notice('❌ Joplin service not initialized', 3000);
			return;
		}

		const stats = this.joplinService.getCacheStats();
		const hitRatio = stats.hits + stats.misses > 0
			? Math.round((stats.hits / (stats.hits + stats.misses)) * 100)
			: 0;

		new Notice(
			`📊 Search Cache Statistics\n` +
			`📦 Entries: ${stats.size}\n` +
			`✅ Hits: ${stats.hits}\n` +
			`❌ Misses: ${stats.misses}\n` +
			`🎯 Hit Rate: ${hitRatio}%\n` +
			`🗑️ Evictions: ${stats.evictions}`,
			8000
		);
	}

	/**
	 * Register the Joplin icon early in the load process (before logger is ready)
	 */
	private registerJoplinIconEarly(): void {
		const iconSvg = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
			<path d="M38.4317,4.4944l-14.4228,0L24,9.9723h2.4787a.9962.9962,0,0,1,1,.995c.0019,3.7661.0084,17.1686.0084,21.8249,0,2.4608-1.8151,3.4321-3.7911,3.4321-2.4178,0-7.2518-1.9777-7.2518-5.5467a3.9737,3.9737,0,0,1,4.2333-4.2691,6.5168,6.5168,0,0,1,3.2954,1.0568V20.2961a14.6734,14.6734,0,0,0-4.4756-.6537c-5.8628,0-9.929,4.9033-9.929,11.1556,0,6.8972,5.2718,12.7077,14.578,12.7077,8.8284,0,14.8492-5.8107,14.8492-14.2056V4.4944Z"
				fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>`;

		try {
			// Use the correct Obsidian API - addIcon is a standalone function
			addIcon('joplin-icon', iconSvg);
			console.log('Joplin Portal: Early icon registration completed');
		} catch (error) {
			console.error('Joplin Portal: Early icon registration failed:', error);
		}
	}

	/**
	 * Register the Joplin icon - can be called multiple times safely
	 */
	registerJoplinIcon(): void {
		const iconSvg = `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
			<path d="M38.4317,4.4944l-14.4228,0L24,9.9723h2.4787a.9962.9962,0,0,1,1,.995c.0019,3.7661.0084,17.1686.0084,21.8249,0,2.4608-1.8151,3.4321-3.7911,3.4321-2.4178,0-7.2518-1.9777-7.2518-5.5467a3.9737,3.9737,0,0,1,4.2333-4.2691,6.5168,6.5168,0,0,1,3.2954,1.0568V20.2961a14.6734,14.6734,0,0,0-4.4756-.6537c-5.8628,0-9.929,4.9033-9.929,11.1556,0,6.8972,5.2718,12.7077,14.578,12.7077,8.8284,0,14.8492-5.8107,14.8492-14.2056V4.4944Z"
				fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
		</svg>`;

		// Always register/re-register the icon - this is more reliable than checking registry
		try {
			// Use the correct Obsidian API - addIcon is a standalone function
			addIcon('joplin-icon', iconSvg);
			this.logger?.debug('Registered joplin-icon successfully');
		} catch (error) {
			this.logger?.error('Failed to register joplin-icon:', error);
		}
	}



	/**
	 * Check if plugin is properly configured
	 */
	private isPluginConfigured(): boolean {
		const { serverUrl, apiToken } = this.settings;

		// Basic configuration check
		if (!serverUrl || !apiToken) {
			return false;
		}

		// Check if Joplin service is configured
		if (!this.joplinService || !this.joplinService.isConfigured()) {
			return false;
		}

		return true;
	}

	/**
	 * Get configuration validation status
	 */
	getConfigurationStatus(): {
		isConfigured: boolean;
		hasServerUrl: boolean;
		hasApiToken: boolean;
		serviceConfigured: boolean;
	} {
		const { serverUrl, apiToken } = this.settings;

		return {
			isConfigured: this.isPluginConfigured(),
			hasServerUrl: !!serverUrl,
			hasApiToken: !!apiToken,
			serviceConfigured: !!(this.joplinService && this.joplinService.isConfigured())
		};
	}

	/**
	 * Focus search input in the active Joplin Portal view
	 */
	private focusSearchInput(): void {
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOPLIN_PORTAL)[0];
		if (leaf && leaf.view instanceof JoplinPortalView) {
			leaf.view.focusSearchInput();
		} else {
			new Notice('Joplin Portal view is not open');
		}
	}

	/**
	 * Select all notes for import in the active Joplin Portal view
	 */
	private selectAllForImport(): void {
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOPLIN_PORTAL)[0];
		if (leaf && leaf.view instanceof JoplinPortalView) {
			leaf.view.selectAllForImport();
		} else {
			new Notice('Joplin Portal view is not open');
		}
	}

	/**
	 * Import selected notes in the active Joplin Portal view
	 */
	private importSelectedNotes(): void {
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOPLIN_PORTAL)[0];
		if (leaf && leaf.view instanceof JoplinPortalView) {
			leaf.view.showImportConfirmationDialog();
		} else {
			new Notice('Joplin Portal view is not open');
		}
	}

	/**
	 * Set up periodic check to ensure icon persistence
	 */
	private setupIconPersistenceCheck(): void {
		// Check every 30 seconds if we have active tabs and re-register icon if needed
		const checkInterval = setInterval(() => {
			const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOPLIN_PORTAL);
			if (leaves.length > 0) {
				// Only re-register if we have active tabs
				this.registerJoplinIcon();
			}
		}, 30000); // 30 seconds

		// Store the interval so we can clear it on unload
		(this as any).iconPersistenceInterval = checkInterval;
	}

	/**
	 * Debug icon registration status
	 */
	private debugIconStatus(): void {
		const iconRegistry = (this.app as any).iconRegistry;
		const hasIcon = iconRegistry && iconRegistry['joplin-icon'];

		let debugInfo = `Icon Registry Status:\n`;
		debugInfo += `- Icon registered: ${hasIcon ? 'YES' : 'NO'}\n`;
		debugInfo += `- Registry exists: ${iconRegistry ? 'YES' : 'NO'}\n`;

		if (hasIcon) {
			debugInfo += `- Icon content length: ${iconRegistry['joplin-icon'].length} chars\n`;
		}

		// Check for existing tabs
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_JOPLIN_PORTAL);
		debugInfo += `- Active tabs: ${leaves.length}\n`;

		leaves.forEach((leaf: WorkspaceLeaf, index: number) => {
			const iconEl = leaf.tabHeaderEl?.querySelector('.workspace-tab-header-inner-icon');
			debugInfo += `- Tab ${index + 1} icon element: ${iconEl ? 'EXISTS' : 'MISSING'}\n`;
			if (iconEl) {
				debugInfo += `  - Classes: ${iconEl.className}\n`;
				debugInfo += `  - Content: ${iconEl.innerHTML || 'EMPTY'}\n`;
			}
		});

		new Notice(debugInfo, 10000);
		console.log('Joplin Portal Icon Debug:', debugInfo);
	}
}