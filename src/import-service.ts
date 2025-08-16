import { App, TFile, TFolder, normalizePath, requestUrl } from 'obsidian';
import { JoplinNote, ImportOptions, ImportProgress, ImageImportResult, ImageDownloadProgress, JoplinPortalSettings } from './types';
import { JoplinApiService } from './joplin-api-service';
import { ErrorHandler } from './error-handler';
import { Logger } from './logger';

export class ImportService {
	private app: App;
	private joplinApiService: JoplinApiService | null = null;
	private onImportComplete?: () => void;
	private logger: Logger;
	private settings: JoplinPortalSettings;

	constructor(
		app: App,
		logger: Logger,
		settings: JoplinPortalSettings,
		joplinApiServiceOrCallback?: JoplinApiService | (() => void),
		onImportComplete?: () => void
	) {
		this.app = app;
		this.logger = logger;
		this.settings = settings;
		if (joplinApiServiceOrCallback instanceof JoplinApiService) {
			this.joplinApiService = joplinApiServiceOrCallback;
			this.onImportComplete = onImportComplete;
		} else {
			this.onImportComplete = joplinApiServiceOrCallback;
		}
	}

	/**
	 * Update settings when they change
	 */
	updateSettings(settings: JoplinPortalSettings): void {
		this.settings = settings;
	}

	/**
	 * Get the configured attachments folder path
	 */
	private getAttachmentsFolder(): string {
		try {
			// Get Obsidian's attachment folder setting
			const attachmentFolderPath = (this.app.vault as any).config?.attachmentFolderPath;

			if (!attachmentFolderPath) {
				// If no specific folder is set, use vault root
				return '';
			}

			if (attachmentFolderPath === './') {
				// If set to same folder as note, we'll use a default attachments folder
				return 'attachments';
			}

			// Return the configured path, removing leading slash if present
			return attachmentFolderPath.replace(/^\//, '');
		} catch (error) {
			this.logger.warn('Failed to get attachments folder config, using default:', error);
			return 'attachments';
		}
	}

	/**
	 * Generate a unique filename to avoid conflicts
	 */
	private async generateUniqueFilename(baseName: string, extension: string, folderPath: string): Promise<string> {
		let filename = `${baseName}${extension}`;
		let counter = 1;

		while (true) {
			const fullPath = normalizePath(`${folderPath}/${filename}`);
			const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

			if (!existingFile) {
				return filename;
			}

			// Generate new filename with counter
			filename = `${baseName}-${counter}${extension}`;
			counter++;
		}
	}

	/**
	 * Extract image resource IDs from note body (both markdown and HTML formats)
	 */
	private extractImageResourceIds(noteBody: string): string[] {
    const resourceIds: string[] = [];

    // Matches Markdown: ![alt](:/id)
    const markdownMatches = noteBody.matchAll(/!\[[^\]]*\]\(:\/([a-f0-9]+)\)/gi);
    for (const match of markdownMatches) {
        if (!resourceIds.includes(match[1])) {
            resourceIds.push(match[1]);
        }
    }

    // Matches HTML: <img src=":/id" ...>
    const htmlColonMatches = noteBody.matchAll(/<img[^>]+src=["']:\/*([a-f0-9]+)["'][^>]*>/gi);
    for (const match of htmlColonMatches) {
        if (!resourceIds.includes(match[1])) {
            resourceIds.push(match[1]);
        }
    }

    // Matches HTML: <img src="joplin-id:id" ...>
    const htmlJoplinIdMatches = noteBody.matchAll(/<img[^>]+src=["']joplin-id:([a-f0-9]+)["'][^>]*>/gi);
    for (const match of htmlJoplinIdMatches) {
        if (!resourceIds.includes(match[1])) {
            resourceIds.push(match[1]);
        }
		}

    return resourceIds;
}

	/**
	 * Download and store images for import functionality
	 * This method downloads images and saves them as local files, then updates the note body
	 * to reference the local files instead of Joplin resource IDs
	 */
	async downloadAndStoreImages(
		noteBody: string,
		attachmentsPath: string,
		onProgress?: (progress: ImageDownloadProgress) => void
	): Promise<{ processedBody: string; imageResults: ImageImportResult[] }> {
		const resourceIds = this.extractImageResourceIds(noteBody);
		const imageResults: ImageImportResult[] = [];
		let processedBody = noteBody;

		this.logger.debug(`Found ${resourceIds.length} image resources for import`);

		if (resourceIds.length === 0) {
			return { processedBody, imageResults };
		}

		// Check if Joplin API service is available
		if (!this.joplinApiService) {
			throw new Error('Joplin API service is not available for image downloads');
		}

		// Ensure attachments folder exists
		await this.ensureFolderExists(attachmentsPath);

		const progress: ImageDownloadProgress = {
			total: resourceIds.length,
			downloaded: 0,
			failed: 0
		};

		// Download each image and create local file
		for (let i = 0; i < resourceIds.length; i++) {
			const resourceId = resourceIds[i];
			progress.current = resourceId;

			if (onProgress) {
				onProgress(progress);
			}

			try {
				// Get the resource URL from Joplin API
				const resourceUrl = this.joplinApiService.getResourceUrl(resourceId);

				if (!resourceUrl) {
					throw new Error(`Could not generate resource URL for ${resourceId}`);
				}

				// Download the image data
				const response = await requestUrl({ url: resourceUrl });

				if (response.status !== 200) {
					throw new Error(`Failed to download image: HTTP ${response.status}`);
				}

				// Generate filename - use resource ID as base name with appropriate extension
				const contentType = response.headers['content-type'] || 'image/jpeg';
				const extension = this.getExtensionFromMimeType(contentType);
				const baseName = `joplin-image-${resourceId.slice(0, 8)}`;

				// Generate unique filename to avoid conflicts
				const uniqueFilename = await this.generateUniqueFilename(baseName, extension, attachmentsPath);
				const localPath = normalizePath(`${attachmentsPath}/${uniqueFilename}`);

				// Create the file in Obsidian vault
				await this.app.vault.createBinary(localPath, response.arrayBuffer);

				// Track successful download
				imageResults.push({
					resourceId,
					originalFilename: `${resourceId}${extension}`,
					localFilename: uniqueFilename,
					localPath,
					success: true
				});

				progress.downloaded++;
				this.logger.debug(`Downloaded image ${resourceId} -> ${uniqueFilename}`);

			} catch (error) {
				// Track failed download with enhanced error message
				const enhancedErrorMessage = this.buildImageDownloadErrorMessage(error, resourceId);
				imageResults.push({
					resourceId,
					originalFilename: `${resourceId}.jpg`,
					localFilename: '',
					localPath: '',
					success: false,
					error: enhancedErrorMessage
				});

				progress.failed++;
				this.logger.warn(`Failed to download image ${resourceId}:`, enhancedErrorMessage);
			}
		}

		// Replace image references in note body
		processedBody = this.replaceImageReferences(processedBody, imageResults);

		this.logger.debug(`Image processing complete. Downloaded: ${progress.downloaded}, Failed: ${progress.failed}`);

		return { processedBody, imageResults };
	}

	/**
	 * Replace image references in note body with local file references
	 */
	private replaceImageReferences(noteBody: string, imageResults: ImageImportResult[]): string {
		let processedBody = noteBody;

		for (const result of imageResults) {
			if (result.success) {
				// Replace markdown format: ![alt](:/resource_id) -> ![alt](local_filename)
				const markdownRegex = new RegExp(`!\\[([^\\]]*)\\]\\(:\/${result.resourceId}\\)`, 'g');
				processedBody = processedBody.replace(markdownRegex, `![$1](${result.localFilename})`);

				// Replace HTML format with :/ prefix: <img src=":/resource_id" ... /> -> <img src="local_filename" ... />
				const htmlColonRegex = new RegExp(`(<img[^>]*src=["']):\/*${result.resourceId}(["'][^>]*>)`, 'g');
				processedBody = processedBody.replace(htmlColonRegex, `$1${result.localFilename}$2`);

				// Replace HTML format with joplin-id prefix: <img src="joplin-id:resource_id" ... /> -> <img src="local_filename" ... />
				const htmlJoplinIdRegex = new RegExp(`(<img[^>]*src=["'])joplin-id:${result.resourceId}(["'][^>]*>)`, 'g');
				processedBody = processedBody.replace(htmlJoplinIdRegex, `$1${result.localFilename}$2`);
			} else {
				// Replace failed images with placeholder text
				const markdownRegex = new RegExp(`!\\[([^\\]]*)\\]\\(:\/${result.resourceId}\\)`, 'g');
				processedBody = processedBody.replace(markdownRegex, `[Image failed to download: $1 (${result.resourceId})]`);

				// Replace failed HTML images with :/ prefix
				const htmlColonRegex = new RegExp(`<img[^>]*src=["']:\/*${result.resourceId}["'][^>]*>`, 'g');
				processedBody = processedBody.replace(htmlColonRegex, `<!-- Image failed to download: ${result.resourceId} -->`);

				// Replace failed HTML images with joplin-id prefix
				const htmlJoplinIdRegex = new RegExp(`<img[^>]*src=["']joplin-id:${result.resourceId}["'][^>]*>`, 'g');
				processedBody = processedBody.replace(htmlJoplinIdRegex, `<!-- Image failed to download: ${result.resourceId} -->`);
			}
		}

		return processedBody;
	}

	/**
	 * Get file extension from MIME type
	 */
	private getExtensionFromMimeType(mimeType: string): string {
		const mimeToExt: Record<string, string> = {
			'image/jpeg': '.jpg',
			'image/jpg': '.jpg',
			'image/png': '.png',
			'image/gif': '.gif',
			'image/webp': '.webp',
			'image/svg+xml': '.svg',
			'image/bmp': '.bmp',
			'image/tiff': '.tiff'
		};

		return mimeToExt[mimeType.toLowerCase()] || '.jpg';
	}

	/**
	 * Generate filename from Joplin note
	 */
	generateFileName(joplinNote: JoplinNote): string {
		return this.sanitizeFilename(joplinNote.title) + '.md';
	}

	/**
	 * Convert Joplin markdown to Obsidian-compatible markdown
	 */
	convertJoplinToObsidianMarkdown(joplinNote: JoplinNote): string {
		let markdown = joplinNote.body;

		// Convert remaining Joplin resource links to placeholder text
		// Note: downloadAndStoreImages should have already converted most image resources to local files
		markdown = markdown.replace(/!\[\]\(:\/([a-zA-Z0-9-]+)\)/g, '[Joplin Resource: $1]');
		markdown = markdown.replace(/!\[([^\]]*)\]\(:\/([a-zA-Z0-9-]+)\)/g, '[Joplin Resource: $1 ($2)]');

		// Convert Joplin internal links to Obsidian format if needed
		// This is a placeholder for future enhancement

		return markdown;
	}

	/**
	 * Generate frontmatter for imported note
	 */
	generateFrontmatter(joplinNote: JoplinNote, includeMetadata: boolean = true): string {
		if (!includeMetadata) {
			return '';
		}

		let frontmatter = '---\n';
		frontmatter += `joplin-id: ${joplinNote.id}\n`;
		frontmatter += `created: ${new Date(joplinNote.created_time).toISOString()}\n`;
		frontmatter += `updated: ${new Date(joplinNote.updated_time).toISOString()}\n`;

		if (joplinNote.source_url) {
			// Escape the URL value to ensure proper YAML formatting
			const escapedUrl = joplinNote.source_url.replace(/"/g, '\\"');
			frontmatter += `source: "${escapedUrl}"\n`;
		}

		frontmatter += '---\n\n';

		return frontmatter;
	}

	/**
	 * Sanitize filename for filesystem compatibility
	 */
	private sanitizeFilename(filename: string): string {
		// Remove or replace invalid characters
		filename = filename.replace(/[<>:"/\\|?*]/g, '-');
		filename = filename.replace(/\s+/g, ' ').trim();

		if (!filename) {
			filename = 'Untitled Note';
		}

		// Limit length to avoid filesystem issues
		if (filename.length > 200) {
			filename = filename.substring(0, 200).trim();
		}

		return filename;
	}

	/**
	 * Ensure folder exists, create if necessary
	 */
	private async ensureFolderExists(folderPath: string): Promise<TFolder> {
		if (!folderPath) {
			return this.app.vault.getRoot();
		}

		const normalizedPath = normalizePath(folderPath);
		const existingFolder = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (existingFolder instanceof TFolder) {
			return existingFolder;
		}

		// Create folder if it doesn't exist
		try {
			const folder = await this.app.vault.createFolder(normalizedPath);
			if (folder instanceof TFolder) {
				return folder;
			}
			throw new Error('Created folder is not a TFolder instance');
		} catch (error) {
			// Folder might have been created by another process
			const folder = this.app.vault.getAbstractFileByPath(normalizedPath);
			if (folder instanceof TFolder) {
				return folder;
			}

			// Enhance error message for folder creation failures
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes('permission') || errorMessage.includes('EACCES')) {
				throw new Error(`Permission denied creating folder "${normalizedPath}". Check that Obsidian has write permissions to the parent directory.`);
			}
			if (errorMessage.includes('ENOSPC')) {
				throw new Error(`Insufficient disk space to create folder "${normalizedPath}". Free up storage space and try again.`);
			}
			if (errorMessage.includes('invalid') || errorMessage.includes('illegal')) {
				throw new Error(`Invalid folder name "${normalizedPath}". The folder name contains invalid characters for the file system.`);
			}

			throw new Error(`Failed to create folder "${normalizedPath}": ${errorMessage}. Check folder permissions and available disk space.`);
		}
	}

	/**
	 * Generate unique note filename to avoid conflicts
	 */
	private async generateUniqueNoteFilename(baseFilename: string, targetFolder: TFolder): Promise<string> {
		let filename = baseFilename;
		let counter = 1;

		while (true) {
			const fullPath = normalizePath(`${targetFolder.path}/${filename}`);
			const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

			if (!existingFile) {
				return filename;
			}

			// Generate new filename with counter
			const nameWithoutExt = baseFilename.replace(/\.md$/, '');
			filename = `${nameWithoutExt} ${counter}.md`;
			counter++;
		}
	}

	/**
	 * Check if file already exists and handle conflicts
	 */
	private async handleFileConflict(filePath: string, options: ImportOptions): Promise<{ shouldProceed: boolean; finalPath?: string; existingFile?: TFile }> {
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (!existingFile || !(existingFile instanceof TFile)) {
			return { shouldProceed: true, finalPath: filePath };
		}

		// File exists - handle based on conflict resolution strategy
		switch (options.conflictResolution) {
			case 'skip':
				this.logger.debug(`Skipping existing file: ${filePath}`);
				return { shouldProceed: false };

			case 'overwrite':
				this.logger.debug(`Overwriting existing file: ${filePath}`);
				return { shouldProceed: true, finalPath: filePath, existingFile };

			case 'rename':
			default:
				// Generate new filename with counter
				const folder = (existingFile as any).parent;
				if (!folder) {
					throw new Error('Could not determine parent folder for conflict resolution');
				}

				const baseFilename = (existingFile as any).basename + '.md';
				const uniqueFilename = await this.generateUniqueNoteFilename(baseFilename, folder);
				const uniquePath = normalizePath(`${folder.path}/${uniqueFilename}`);

				this.logger.debug(`Renaming to avoid conflict: ${filePath} -> ${uniquePath}`);
				return { shouldProceed: true, finalPath: uniquePath };
		}
	}

	/**
	 * Check for potential conflicts when importing notes
	 */
	checkForConflicts(notes: JoplinNote[], targetFolder: string = ''): { conflicts: Array<{ note: JoplinNote; existingPath: string }> } {
		const conflicts: Array<{ note: JoplinNote; existingPath: string }> = [];

		for (const note of notes) {
			const filename = this.generateFileName(note);
			const folderPath = targetFolder ? normalizePath(targetFolder) : '';
			const fullPath = folderPath ? normalizePath(`${folderPath}/${filename}`) : filename;

			const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
			if (existingFile instanceof TFile) {
				conflicts.push({
					note,
					existingPath: fullPath
				});
			}
		}

		return { conflicts };
	}

	/**
	 * Import multiple Joplin notes to Obsidian
	 */
	async importNotes(
		notes: JoplinNote[],
		options: ImportOptions,
		onProgress?: (progress: ImportProgress) => void
	): Promise<{
		successful: Array<{
			file: any;
			note: JoplinNote;
			action: 'created' | 'overwritten' | 'renamed';
			originalFilename: string;
			finalFilename: string;
			imageResults?: ImageImportResult[];
		}>;
		failed: Array<{ note: JoplinNote; error: string }>;
	}> {
		const successful: Array<{
			file: any;
			note: JoplinNote;
			action: 'created' | 'overwritten' | 'renamed';
			originalFilename: string;
			finalFilename: string;
			imageResults?: ImageImportResult[];
		}> = [];
		const failed: Array<{ note: JoplinNote; error: string }> = [];

		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];

			// Report overall progress
			if (onProgress) {
				onProgress({
					stage: `Importing note ${i + 1} of ${notes.length}: ${note.title}`,
					current: i + 1,
					total: notes.length
				});
			}

			try {
				const result = await this.importNote(note, options, onProgress);
				if (result.success && result.filePath) {
					const originalFilename = this.generateFileName(note);
					const finalFilename = result.filePath.split('/').pop() || originalFilename;

					successful.push({
						file: null, // We don't have the actual file object here
						note,
						action: 'created', // For now, assume all are created (could be enhanced)
						originalFilename,
						finalFilename,
						imageResults: [] // Could be enhanced to track image results
					});
				} else {
					const enhancedError = this.buildImportErrorMessage(result.error || 'Unknown error', note, 'import_failure');
					failed.push({
						note,
						error: enhancedError
					});
				}
			} catch (error) {
				const enhancedError = this.buildImportErrorMessage(error, note, 'import_exception');
				this.logger.error(`Failed to import note "${note.title}":`, error);

				failed.push({
					note,
					error: enhancedError
				});
			}
		}

		return { successful, failed };
	}

	/**
	 * Build enhanced error message with context and suggestions for import failures
	 */
	private buildImportErrorMessage(error: unknown, note: JoplinNote, context: string): string {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const noteTitle = note.title || 'Untitled Note';

		// Categorize the error and provide specific guidance
		// Check permission errors first as they can be more specific
		if (this.isPermissionError(error)) {
			return this.buildPermissionErrorMessage(errorMessage, noteTitle, context);
		}

		if (this.isNetworkError(error)) {
			return this.buildNetworkErrorMessage(errorMessage, noteTitle, context);
		}

		if (this.isImageProcessingError(error)) {
			return this.buildImageProcessingErrorMessage(errorMessage, noteTitle, context);
		}

		if (this.isContentProcessingError(error)) {
			return this.buildContentProcessingErrorMessage(errorMessage, noteTitle, context);
		}

		if (this.isFileSystemError(error)) {
			return this.buildFileSystemErrorMessage(errorMessage, noteTitle, context);
		}

		// Generic error with context
		return this.buildGenericImportErrorMessage(errorMessage, noteTitle, context);
	}

	/**
	 * Check if error is related to file system operations
	 */
	private isFileSystemError(error: unknown): boolean {
		if (!(error instanceof Error)) return false;
		const message = error.message.toLowerCase();
		// Exclude permission errors as they are handled separately
		if (this.isPermissionError(error)) return false;

		return message.includes('already exists') ||
			   message.includes('enospc') ||
			   message.includes('disk space') ||
			   message.includes('file system') ||
			   message.includes('invalid filename') ||
			   message.includes('path too long');
	}

	/**
	 * Check if error is network-related
	 */
	private isNetworkError(error: unknown): boolean {
		if (!(error instanceof Error)) return false;
		const message = error.message.toLowerCase();
		return message.includes('network') ||
			   message.includes('connection') ||
			   message.includes('timeout') ||
			   message.includes('dns') ||
			   message.includes('enotfound') ||
			   message.includes('econnrefused');
	}

	/**
	 * Check if error is related to image processing
	 */
	private isImageProcessingError(error: unknown): boolean {
		if (!(error instanceof Error)) return false;
		const message = error.message.toLowerCase();
		return message.includes('image') ||
			   message.includes('resource') ||
			   message.includes('download') ||
			   message.includes('attachment');
	}

	/**
	 * Check if error is related to content processing
	 */
	private isContentProcessingError(error: unknown): boolean {
		if (!(error instanceof Error)) return false;
		const message = error.message.toLowerCase();
		return message.includes('markdown') ||
			   message.includes('frontmatter') ||
			   message.includes('content') ||
			   message.includes('encoding') ||
			   message.includes('parse');
	}

	/**
	 * Check if error is permission-related
	 */
	private isPermissionError(error: unknown): boolean {
		if (!(error instanceof Error)) return false;
		const message = error.message.toLowerCase();
		return message.includes('permission') ||
			   message.includes('eacces') ||
			   message.includes('access denied') ||
			   message.includes('unauthorized');
	}

	/**
	 * Build file system error message with specific guidance
	 */
	private buildFileSystemErrorMessage(errorMessage: string, noteTitle: string, context: string): string {
		if (errorMessage.toLowerCase().includes('already exists')) {
			return `Import skipped for "${noteTitle}": File already exists. Try changing the conflict resolution setting to "overwrite" or "rename" in import options.`;
		}

		if (errorMessage.toLowerCase().includes('enospc') || errorMessage.toLowerCase().includes('disk space')) {
			return `Import failed for "${noteTitle}": Insufficient disk space. Free up storage space and try importing again.`;
		}

		if (errorMessage.toLowerCase().includes('invalid filename') || errorMessage.toLowerCase().includes('path too long')) {
			return `Import failed for "${noteTitle}": Invalid filename or path too long. The note title may contain invalid characters or be too long for the file system.`;
		}

		return `Import failed for "${noteTitle}": File system error (${errorMessage}). Check that the target folder is writable and has sufficient space.`;
	}

	/**
	 * Build network error message with specific guidance
	 */
	private buildNetworkErrorMessage(errorMessage: string, noteTitle: string, context: string): string {
		if (context === 'image_download') {
			return `Import partially failed for "${noteTitle}": Could not download images due to network error (${errorMessage}). The note was imported but images may be missing. Check your connection to the Joplin server.`;
		}

		return `Import failed for "${noteTitle}": Network error while accessing Joplin server (${errorMessage}). Check your server URL and ensure Joplin is running with Web Clipper enabled.`;
	}

	/**
	 * Build image processing error message with specific guidance
	 */
	private buildImageProcessingErrorMessage(errorMessage: string, noteTitle: string, context: string): string {
		return `Import completed for "${noteTitle}" but image processing failed: ${errorMessage}. The note was imported but some images may not display correctly. Check that the Joplin server is accessible and images exist.`;
	}

	/**
	 * Build content processing error message with specific guidance
	 */
	private buildContentProcessingErrorMessage(errorMessage: string, noteTitle: string, context: string): string {
		return `Import failed for "${noteTitle}": Content processing error (${errorMessage}). The note content may contain unsupported formatting or characters. Try importing the note again or check the original note in Joplin.`;
	}

	/**
	 * Build permission error message with specific guidance
	 */
	private buildPermissionErrorMessage(errorMessage: string, noteTitle: string, context: string): string {
		return `Import failed for "${noteTitle}": Permission denied (${errorMessage}). Check that Obsidian has write permissions to the target folder, or try selecting a different import folder.`;
	}

	/**
	 * Build generic error message with context
	 */
	private buildGenericImportErrorMessage(errorMessage: string, noteTitle: string, context: string): string {
		const contextDescriptions: Record<string, string> = {
			'import_failure': 'during import process',
			'import_exception': 'during import execution',
			'single_import_failure': 'while importing individual note',
			'file_creation': 'while creating file',
			'content_processing': 'while processing content',
			'image_download': 'while downloading images'
		};

		const contextDesc = contextDescriptions[context] || 'during import';
		return `Import failed for "${noteTitle}": Error occurred ${contextDesc} (${errorMessage}). Please try importing the note again, or check the note content in Joplin for any issues.`;
	}

	/**
	 * Build enhanced error message for image download failures
	 */
	private buildImageDownloadErrorMessage(error: unknown, resourceId: string): string {
		const errorMessage = error instanceof Error ? error.message : String(error);

		if (errorMessage.includes('404') || errorMessage.includes('not found')) {
			return `Image ${resourceId} not found on Joplin server. The image may have been deleted or moved.`;
		}

		if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('unauthorized')) {
			return `Access denied for image ${resourceId}. Check your API token permissions.`;
		}

		if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
			return `Network timeout downloading image ${resourceId}. Check your connection to the Joplin server.`;
		}

		if (errorMessage.includes('500') || errorMessage.includes('server error')) {
			return `Joplin server error downloading image ${resourceId}. The server may be experiencing issues.`;
		}

		if (errorMessage.includes('disk space') || errorMessage.includes('enospc')) {
			return `Insufficient disk space to save image ${resourceId}. Free up storage space and try again.`;
		}

		return `Failed to download image ${resourceId}: ${errorMessage}. Check that the image exists in Joplin and the server is accessible.`;
	}

	/**
	 * Import a single Joplin note to Obsidian
	 */
	async importNote(
		joplinNote: JoplinNote,
		options: ImportOptions,
		onProgress?: (progress: ImportProgress) => void
	): Promise<{ success: boolean; filePath?: string; error?: string }> {
		try {
			// Report progress: Starting import
			if (onProgress) {
				onProgress({ stage: 'Starting import...' });
			}

			// Determine target folder
			const targetFolder = await this.ensureFolderExists(options.targetFolder || '');

			// Generate filename
			const filename = this.generateFileName(joplinNote);
			const filePath = normalizePath(`${targetFolder.path}/${filename}`);

			// Handle file conflicts
			const conflictResult = await this.handleFileConflict(filePath, options);
			if (!conflictResult.shouldProceed) {
				return { success: false, error: 'File skipped due to conflict' };
			}

			const finalPath = conflictResult.finalPath || filePath;

			// Process images before converting markdown
			let processedNoteBody = joplinNote.body;
			let imageResults: ImageImportResult[] = [];

			try {
				// Get attachments folder path
				const attachmentsPath = this.getAttachmentsFolder();

				// Download and store images, replacing Joplin resource links with local file references
				const imageProcessingResult = await this.downloadAndStoreImages(
					joplinNote.body,
					attachmentsPath,
					onProgress ? (imageProgress) => {
						onProgress({
							stage: `Downloading images... ${imageProgress.downloaded}/${imageProgress.total}`,
							imageProgress
						});
					} : undefined
				);

				processedNoteBody = imageProcessingResult.processedBody;
				imageResults = imageProcessingResult.imageResults;

				this.logger.debug(`Processed ${imageResults.length} images for note "${joplinNote.title}"`);

			} catch (imageError) {
				// Log image processing error but continue with import
				ErrorHandler.logDetailedError(imageError, 'Image processing failed during import', {
					noteId: joplinNote.id,
					noteTitle: joplinNote.title,
					targetFolder: options.targetFolder
				}, this.logger);

				// Build enhanced error message for image processing failure
				const enhancedImageError = this.buildImportErrorMessage(imageError, joplinNote, 'image_download');

				// Add warning comment to note about image processing failure with specific guidance
				const warningComment = `<!-- Warning: ${enhancedImageError} -->\n\n`;
				processedNoteBody = warningComment + joplinNote.body;

				this.logger.warn(`Image processing failed for note "${joplinNote.title}", continuing with original content`);
			}

			// Report progress: Converting markdown
			if (onProgress) {
				onProgress({ stage: 'Converting markdown...' });
			}

			// Convert markdown content using the processed body (with local image references)
			const noteWithProcessedImages = { ...joplinNote, body: processedNoteBody };
			const convertedMarkdown = this.convertJoplinToObsidianMarkdown(noteWithProcessedImages);

			// Generate frontmatter
			const frontmatter = this.generateFrontmatter(joplinNote, this.settings.includeMetadataInFrontmatter);

			// Combine frontmatter and content
			const finalContent = frontmatter + convertedMarkdown;

			// Report progress: Creating file
			if (onProgress) {
				onProgress({ stage: 'Creating file...' });
			}

			// Create or update the file
			if (conflictResult.existingFile) {
				// Overwrite existing file
				await this.app.vault.modify(conflictResult.existingFile, finalContent);
			} else {
				// Create new file
				await this.app.vault.create(finalPath, finalContent);
			}

			this.logger.debug(`Successfully imported note "${joplinNote.title}" to ${finalPath}`);

			// Note: onImportComplete callback removed to avoid issues with undefined data
			// The UI will handle completion through the return value

			return { success: true, filePath: finalPath };

		} catch (error) {
			const enhancedError = this.buildImportErrorMessage(error, joplinNote, 'single_import_failure');
			this.logger.error(`Failed to import note "${joplinNote.title}":`, error);

			ErrorHandler.logDetailedError(error, 'Note import failed', {
				noteId: joplinNote.id,
				noteTitle: joplinNote.title,
				targetFolder: options.targetFolder
			}, this.logger);

			return { success: false, error: enhancedError };
		}
	}
}