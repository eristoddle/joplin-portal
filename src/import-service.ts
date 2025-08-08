import { App, TFile, TFolder, normalizePath, requestUrl } from 'obsidian';
import { JoplinNote, ImportOptions, ImportProgress, ImageImportResult, ImageDownloadProgress } from './types';
import { JoplinApiService } from './joplin-api-service';
import { ErrorHandler } from './error-handler';

export class ImportService {
	private app: App;
	private joplinApiService: JoplinApiService | null = null;
	private onImportComplete?: () => void;

	constructor(
		app: App,
		joplinApiServiceOrCallback?: JoplinApiService | (() => void),
		onImportComplete?: () => void
	) {
		this.app = app;
		if (joplinApiServiceOrCallback instanceof JoplinApiService) {
			this.joplinApiService = joplinApiServiceOrCallback;
			this.onImportComplete = onImportComplete;
		} else {
			this.onImportComplete = joplinApiServiceOrCallback;
		}
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
			console.warn('Joplin Portal: Failed to get attachments folder config, using default:', error);
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

		// Extract from markdown format: ![alt](:/resource_id)
		const markdownMatches = noteBody.matchAll(/!\[([^\]]*)\]\(:\/([a-f0-9]{32})\)/g);
		for (const match of markdownMatches) {
			const resourceId = match[2];
			if (!resourceIds.includes(resourceId)) {
				resourceIds.push(resourceId);
			}
		}

		// Extract from HTML format: <img src="joplin-id:resource_id" ... />
		const htmlMatches = noteBody.matchAll(/<img[^>]*src=["']joplin-id:([a-f0-9]{32})["'][^>]*>/g);
		for (const match of htmlMatches) {
			const resourceId = match[1];
			if (!resourceIds.includes(resourceId)) {
				resourceIds.push(resourceId);
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

		console.log(`Joplin Portal: Found ${resourceIds.length} image resources for import`);

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
				console.log(`Joplin Portal: Downloaded image ${resourceId} -> ${uniqueFilename}`);

			} catch (error) {
				// Track failed download
				const errorMessage = error instanceof Error ? error.message : String(error);
				imageResults.push({
					resourceId,
					originalFilename: `${resourceId}.jpg`,
					localFilename: '',
					localPath: '',
					success: false,
					error: errorMessage
				});

				progress.failed++;
				console.warn(`Joplin Portal: Failed to download image ${resourceId}:`, errorMessage);
			}
		}

		// Replace image references in note body
		processedBody = this.replaceImageReferences(processedBody, imageResults);

		console.log(`Joplin Portal: Image processing complete. Downloaded: ${progress.downloaded}, Failed: ${progress.failed}`);

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

				// Replace HTML format: <img src="joplin-id:resource_id" ... /> -> <img src="local_filename" ... />
				const htmlRegex = new RegExp(`(<img[^>]*src=["'])joplin-id:${result.resourceId}(["'][^>]*>)`, 'g');
				processedBody = processedBody.replace(htmlRegex, `$1${result.localFilename}$2`);
			} else {
				// Replace failed images with placeholder text
				const markdownRegex = new RegExp(`!\\[([^\\]]*)\\]\\(:\/${result.resourceId}\\)`, 'g');
				processedBody = processedBody.replace(markdownRegex, `[Image failed to download: $1 (${result.resourceId})]`);

				const htmlRegex = new RegExp(`<img[^>]*src=["']joplin-id:${result.resourceId}["'][^>]*>`, 'g');
				processedBody = processedBody.replace(htmlRegex, `<!-- Image failed to download: ${result.resourceId} -->`);
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
		markdown = markdown.replace(/!\[\]\(:\/([a-f0-9]+)\)/g, '[Joplin Resource: $1]');
		markdown = markdown.replace(/!\[([^\]]*)\]\(:\/([a-f0-9]+)\)/g, '[Joplin Resource: $1 ($2)]');

		// Convert Joplin internal links to Obsidian format if needed
		// This is a placeholder for future enhancement

		return markdown;
	}

	/**
	 * Generate frontmatter for imported note
	 */
	generateFrontmatter(joplinNote: JoplinNote): string {
		let frontmatter = '---\n';
		frontmatter += `joplin-id: ${joplinNote.id}\n`;
		frontmatter += `created: ${new Date(joplinNote.created_time).toISOString()}\n`;
		frontmatter += `updated: ${new Date(joplinNote.updated_time).toISOString()}\n`;

		if (joplinNote.source_url) {
			frontmatter += `source-url: ${joplinNote.source_url}\n`;
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
			throw error;
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
				console.log(`Joplin Portal: Skipping existing file: ${filePath}`);
				return { shouldProceed: false };

			case 'overwrite':
				console.log(`Joplin Portal: Overwriting existing file: ${filePath}`);
				return { shouldProceed: true, finalPath: filePath, existingFile };

			case 'rename':
			default:
				// Generate new filename with counter
				const folder = existingFile.parent;
				if (!folder) {
					throw new Error('Could not determine parent folder for conflict resolution');
				}

				const baseFilename = existingFile.basename + '.md';
				const uniqueFilename = await this.generateUniqueNoteFilename(baseFilename, folder);
				const uniquePath = normalizePath(`${folder.path}/${uniqueFilename}`);

				console.log(`Joplin Portal: Renaming to avoid conflict: ${filePath} -> ${uniquePath}`);
				return { shouldProceed: true, finalPath: uniquePath };
		}
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

				console.log(`Joplin Portal: Processed ${imageResults.length} images for note "${joplinNote.title}"`);

			} catch (imageError) {
				// Log image processing error but continue with import
				ErrorHandler.logDetailedError(imageError, 'Image processing failed during import', {
					noteId: joplinNote.id,
					noteTitle: joplinNote.title,
					targetFolder: options.targetFolder
				});

				// Add warning comment to note about image processing failure
				const warningComment = `<!-- Warning: Image processing failed during import: ${imageError instanceof Error ? imageError.message : String(imageError)} -->\n\n`;
				processedNoteBody = warningComment + joplinNote.body;

				console.warn(`Joplin Portal: Image processing failed for note "${joplinNote.title}", continuing with original content`);
			}

			// Report progress: Converting markdown
			if (onProgress) {
				onProgress({ stage: 'Converting markdown...' });
			}

			// Convert markdown content using the processed body (with local image references)
			const noteWithProcessedImages = { ...joplinNote, body: processedNoteBody };
			const convertedMarkdown = this.convertJoplinToObsidianMarkdown(noteWithProcessedImages);

			// Generate frontmatter
			const frontmatter = this.generateFrontmatter(joplinNote);

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

			console.log(`Joplin Portal: Successfully imported note "${joplinNote.title}" to ${finalPath}`);

			// Call completion callback if provided
			if (this.onImportComplete) {
				this.onImportComplete();
			}

			return { success: true, filePath: finalPath };

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error(`Joplin Portal: Failed to import note "${joplinNote.title}":`, error);

			ErrorHandler.logDetailedError(error, 'Note import failed', {
				noteId: joplinNote.id,
				noteTitle: joplinNote.title,
				targetFolder: options.targetFolder
			});

			return { success: false, error: errorMessage };
		}
	}
}