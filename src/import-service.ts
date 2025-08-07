import { App, TFile, TFolder, normalizePath, Notice } from 'obsidian';
import { JoplinNote, ImportOptions, ImageImportResult, ImageDownloadProgress, JoplinResource } from './types';
import { ErrorHandler } from './error-handler';
import { JoplinApiService } from './joplin-api-service';

export class ImportService {
	private app: App;
	private joplinApiService?: JoplinApiService;
	private onImportComplete?: (importedNotes: JoplinNote[]) => void;

	constructor(app: App, joplinApiServiceOrCallback?: JoplinApiService | ((importedNotes: JoplinNote[]) => void), onImportComplete?: (importedNotes: JoplinNote[]) => void) {
		this.app = app;

		// Handle backward compatibility - if second parameter is a function, it's the callback
		if (typeof joplinApiServiceOrCallback === 'function') {
			this.onImportComplete = joplinApiServiceOrCallback;
		} else {
			this.joplinApiService = joplinApiServiceOrCallback;
			this.onImportComplete = onImportComplete;
		}
	}

	/**
	 * Get Obsidian's configured attachments folder path
	 */
	private getAttachmentsFolder(): string {
		// Get the attachments folder setting from Obsidian
		const attachmentFolderPath = this.app.vault.getConfig('attachmentFolderPath');

		if (!attachmentFolderPath || attachmentFolderPath === '/') {
			// If no specific folder is set, use vault root
			return '';
		}

		if (attachmentFolderPath === './') {
			// If set to same folder as note, we'll use a default attachments folder
			return 'attachments';
		}

		// Return the configured path, removing leading slash if present
		return attachmentFolderPath.startsWith('/') ? attachmentFolderPath.slice(1) : attachmentFolderPath;
	}

	/**
	 * Generate unique filename for attachments to handle conflicts
	 */
	async generateUniqueFilename(baseName: string, extension: string, targetPath: string): Promise<string> {
		const normalizedTargetPath = normalizePath(targetPath);
		let filename = `${baseName}${extension}`;
		let counter = 1;

		while (true) {
			const fullPath = normalizePath(`${normalizedTargetPath}/${filename}`);
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
		const markdownImageRegex = /!\[([^\]]*)\]\(:\/([a-f0-9]{32})\)/g;
		let match;

		while ((match = markdownImageRegex.exec(noteBody)) !== null) {
			const resourceId = match[2];
			if (!resourceIds.includes(resourceId)) {
				resourceIds.push(resourceId);
			}
		}

		// Extract from HTML format: <img src="joplin-id:resource_id" ... />
		const htmlImageRegex = /<img[^>]*src=["']joplin-id:([a-f0-9]{32})["'][^>]*>/g;

		while ((match = htmlImageRegex.exec(noteBody)) !== null) {
			const resourceId = match[1];
			if (!resourceIds.includes(resourceId)) {
				resourceIds.push(resourceId);
			}
		}

		return resourceIds;
	}

	/**
	 * Extract HTML attributes from an img tag while preserving various quote styles
	 * @param htmlTag - The complete HTML img tag
	 * @returns Record<string, string> - Object containing all attributes except src
	 */
	private extractHtmlImageAttributes(htmlTag: string): Record<string, string> {
		const attributes: Record<string, string> = {};

		// Enhanced regex to match HTML attributes with various quote styles and edge cases
		// Matches: attribute="value", attribute='value', attribute=value (no quotes), and boolean attributes
		const attributeRegex = /\s+(\w+)(?:=(?:["']([^"']*)["']|([^\s>]+)))?/g;
		let match;

		while ((match = attributeRegex.exec(htmlTag)) !== null) {
			const [, attributeName, quotedValue, unquotedValue] = match;

			// Skip the src attribute as we'll replace it, and skip tag names
			if (attributeName.toLowerCase() === 'src' || attributeName.toLowerCase() === 'img') {
				continue;
			}

			// Handle different attribute value formats
			if (quotedValue !== undefined) {
				// Quoted value (single or double quotes)
				attributes[attributeName] = quotedValue;
			} else if (unquotedValue !== undefined) {
				// Unquoted value
				attributes[attributeName] = unquotedValue;
			} else {
				// Boolean attribute (no value)
				attributes[attributeName] = attributeName;
			}
		}

		return attributes;
	}

	/**
	 * Reconstruct HTML img tag with local file reference while preserving all attributes
	 * @param localFilename - The local filename to use as the src attribute
	 * @param attributes - Object containing all HTML attributes to preserve
	 * @returns string - Reconstructed HTML img tag
	 */
	private reconstructHtmlImageTag(localFilename: string, attributes: Record<string, string>): string {
		// Create new attributes object with local filename as src
		const reconstructedAttributes = {
			src: localFilename,
			...attributes
		};

		// Build attribute string with proper escaping
		const attributeString = Object.entries(reconstructedAttributes)
			.map(([key, value]) => {
				// Escape quotes in attribute values
				const escapedValue = value.replace(/"/g, '&quot;');
				return `${key}="${escapedValue}"`;
			})
			.join(' ');

		return `<img ${attributeString}/>`;
	}

	/**
	 * Download and store images for import functionality
	 */
	async downloadAndStoreImages(
		noteBody: string,
		attachmentsPath: string,
		onProgress?: (progress: ImageDownloadProgress) => void
	): Promise<{ processedBody: string; imageResults: ImageImportResult[] }> {
		const resourceIds = this.extractImageResourceIds(noteBody);
		const imageResults: ImageImportResult[] = [];
		let processedBody = noteBody;

		// Count markdown and HTML images for comprehensive logging
		const markdownImageCount = (noteBody.match(/!\[([^\]]*)\]\(:\/([a-f0-9]{32})\)/g) || []).length;
		const htmlImageCount = (noteBody.match(/<img[^>]*src=["']joplin-id:([a-f0-9]{32})["'][^>]*>/g) || []).length;

		console.log(`Joplin Portal: Found ${resourceIds.length} total image resources for import (${markdownImageCount} markdown, ${htmlImageCount} HTML)`);

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

		for (let i = 0; i < resourceIds.length; i++) {
			const resourceId = resourceIds[i];
			progress.current = resourceId;

			if (onProgress) {
				onProgress(progress);
			}

			try {
				// Get resource metadata to determine filename and MIME type
				const metadata = await this.joplinApiService.getResourceMetadata(resourceId);

				if (!metadata) {
					throw new Error(`Resource metadata not found for ${resourceId}`);
				}

				// Verify it's an image
				if (!metadata.mime.startsWith('image/')) {
					console.warn(`Skipping non-image resource: ${resourceId} (${metadata.mime})`);
					continue;
				}

				// Download the image data
				const imageData = await this.joplinApiService.getResourceFile(resourceId);

				if (!imageData) {
					throw new Error(`Failed to download image data for ${resourceId}`);
				}

				// Generate filename from metadata
				let baseName = metadata.title || `joplin-image-${resourceId.slice(0, 8)}`;
				let extension = metadata.file_extension || this.getExtensionFromMimeType(metadata.mime);

				// Sanitize filename
				baseName = this.sanitizeFilename(baseName);

				// Ensure extension starts with dot
				if (extension && !extension.startsWith('.')) {
					extension = '.' + extension;
				}

				// Generate unique filename to avoid conflicts
				const uniqueFilename = await this.generateUniqueFilename(baseName, extension, attachmentsPath);
				const localPath = normalizePath(`${attachmentsPath}/${uniqueFilename}`);

				// Create the file in Obsidian vault
				const uint8Array = new Uint8Array(imageData);
				await this.app.vault.createBinary(localPath, uint8Array);

				// Record successful import
				const importResult: ImageImportResult = {
					resourceId,
					originalFilename: metadata.filename || `${metadata.title}${extension}`,
					localFilename: uniqueFilename,
					localPath,
					success: true
				};
				imageResults.push(importResult);

				// Replace the Joplin resource link with local file reference (markdown format)
				const joplinLinkRegex = new RegExp(`!\\[([^\\]]*)\\]\\(:\/${resourceId}\\)`, 'g');
				processedBody = processedBody.replace(joplinLinkRegex, `![$1](${uniqueFilename})`);

				// Replace HTML img tags with joplin-id URLs with local file references
				const htmlImageRegex = new RegExp(`<img[^>]*src=["']joplin-id:${resourceId}["'][^>]*>`, 'g');
				processedBody = processedBody.replace(htmlImageRegex, (match) => {
					// Extract attributes from the original HTML tag
					const attributes = this.extractHtmlImageAttributes(match);

					// Reconstruct HTML tag with local filename while preserving attributes
					const reconstructedTag = this.reconstructHtmlImageTag(uniqueFilename, attributes);

					console.log(`Joplin Portal: Converted HTML image tag for resource ${resourceId} to local reference: ${uniqueFilename}`);
					return reconstructedTag;
				});

				progress.downloaded++;
				console.log(`Downloaded image: ${uniqueFilename} (${resourceId})`);

			} catch (error) {
				progress.failed++;

				const importResult: ImageImportResult = {
					resourceId,
					originalFilename: `unknown-${resourceId}`,
					localFilename: '',
					localPath: '',
					success: false,
					error: error instanceof Error ? error.message : String(error)
				};
				imageResults.push(importResult);

				// Log error but continue with other images
				ErrorHandler.logDetailedError(error, `Failed to download image ${resourceId}`, {
					resourceId,
					noteBodyLength: noteBody.length,
					attachmentsPath
				});

				// Add warning comment to the note for markdown images
				const joplinLinkRegex = new RegExp(`!\\[([^\\]]*)\\]\\(:\/${resourceId}\\)`, 'g');
				processedBody = processedBody.replace(
					joplinLinkRegex,
					`<!-- Warning: Failed to download image ${resourceId}: ${importResult.error} -->\n![Image failed to download](:/${resourceId})`
				);

				// Add warning comment and preserve HTML img tags for failed HTML images
				const htmlImageRegex = new RegExp(`<img[^>]*src=["']joplin-id:${resourceId}["'][^>]*>`, 'g');
				processedBody = processedBody.replace(htmlImageRegex, (match) => {
					// Extract attributes from the original HTML tag
					const attributes = this.extractHtmlImageAttributes(match);

					// Create a placeholder with preserved attributes and error information
					const placeholderAttributes = {
						...attributes,
						alt: attributes.alt || 'Image failed to download',
						title: `Failed to download image resource ${resourceId}. Error: ${importResult.error}`
					};

					// Use a broken image data URI as placeholder
					const brokenImageDataUri = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBzdHJva2U9IiM5OTk5OTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';
					const placeholderTag = this.reconstructHtmlImageTag(brokenImageDataUri, placeholderAttributes);
					const errorComment = `<!-- Warning: Failed to download HTML image ${resourceId}: ${importResult.error} -->`;

					console.log(`Joplin Portal: Created placeholder for failed HTML image resource ${resourceId}`);
					return `${errorComment}\n${placeholderTag}`;
				});
			}
		}

		if (onProgress) {
			onProgress(progress);
		}

		// Log comprehensive summary including HTML image processing
		const finalMarkdownImageCount = (processedBody.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
		const finalHtmlImageCount = (processedBody.match(/<img[^>]*src="[^"]*"[^>]*>/g) || []).length;

		console.log(`Joplin Portal: Image download completed: ${progress.downloaded} successful, ${progress.failed} failed`);
		console.log(`Joplin Portal: Final processed note contains ${finalMarkdownImageCount} markdown images and ${finalHtmlImageCount} HTML images`);

		return { processedBody, imageResults };
	}

	/**
	 * Get file extension from MIME type
	 */
	private getExtensionFromMimeType(mimeType: string): string {
		const mimeToExt: { [key: string]: string } = {
			'image/jpeg': '.jpg',
			'image/jpg': '.jpg',
			'image/png': '.png',
			'image/gif': '.gif',
			'image/webp': '.webp',
			'image/svg+xml': '.svg',
			'image/bmp': '.bmp',
			'image/tiff': '.tiff',
			'image/ico': '.ico'
		};

		return mimeToExt[mimeType.toLowerCase()] || '.jpg';
	}

	/**
	 * Generate filename from Joplin note (for backward compatibility with tests)
	 */
	generateFileName(joplinNote: JoplinNote): string {
		return this.sanitizeFilename(joplinNote.title) + '.md';
	}

	/**
	 * Convert Joplin markdown to Obsidian-compatible format
	 */
	convertJoplinToObsidianMarkdown(joplinNote: JoplinNote): string {
		let markdown = joplinNote.body;

		// Convert Joplin-specific syntax to Obsidian format

		// 1. Convert Joplin internal links [title](:/noteId) to plain text references
		markdown = markdown.replace(/\[([^\]]+)\]\(:\/([a-f0-9]+)\)/g, '[[Joplin Note: $1]]');

		// 2. Convert remaining Joplin resource links ![](:/resourceId) to placeholder text
		// Note: downloadAndStoreImages should have already converted most image resources to local files
		markdown = markdown.replace(/!\[\]\(:\/([a-f0-9]+)\)/g, '[Joplin Resource: $1]');

		// 3. Convert remaining Joplin resource links with alt text ![alt](:/resourceId)
		// Note: downloadAndStoreImages should have already converted most image resources to local files
		markdown = markdown.replace(/!\[([^\]]*)\]\(:\/([a-f0-9]+)\)/g, '[Joplin Resource: $1 ($2)]');

		// 4. Handle Joplin checkboxes - they should already be compatible
		// Joplin uses - [ ] and - [x] which is standard markdown

		// 5. Clean up any remaining Joplin-specific protocols (non-image resources)
		markdown = markdown.replace(/:\/([a-f0-9]+)/g, 'joplin-id:$1');

		return markdown;
	}

	/**
	 * Generate frontmatter for imported note
	 */
	generateFrontmatter(joplinNote: JoplinNote): string {
		const createdDate = new Date(joplinNote.created_time).toISOString();
		const updatedDate = new Date(joplinNote.updated_time).toISOString();

		let frontmatter = '---\n';
		frontmatter += `joplin-id: ${joplinNote.id}\n`;
		frontmatter += `created: ${createdDate}\n`;
		frontmatter += `updated: ${updatedDate}\n`;

		if (joplinNote.tags && joplinNote.tags.length > 0) {
			frontmatter += `tags:\n`;
			joplinNote.tags.forEach(tag => {
				frontmatter += `  - ${tag}\n`;
			});
		}

		if (joplinNote.source_url) {
			frontmatter += `source-url: ${joplinNote.source_url}\n`;
		}

		frontmatter += '---\n\n';

		return frontmatter;
	}

	/**
	 * Sanitize filename for Obsidian
	 */
	sanitizeFilename(title: string): string {
		// Remove or replace characters that are invalid in filenames
		let filename = title
			.replace(/[<>:"/\\|?*]/g, '-') // Replace invalid chars with dash
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();

		// Ensure filename isn't empty
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
	 * Ensure target folder exists, create if necessary
	 */
	async ensureFolderExists(folderPath: string): Promise<TFolder> {
		const normalizedPath = normalizePath(folderPath);

		// Check if folder already exists
		const existingFolder = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (existingFolder instanceof TFolder) {
			return existingFolder;
		}

		// Create folder if it doesn't exist
		try {
			const folder = await this.app.vault.createFolder(normalizedPath);
			return folder;
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
	 * Generate unique filename for notes if file already exists
	 */
	async generateUniqueNoteFilename(folderPath: string, baseFilename: string): Promise<string> {
		const normalizedFolderPath = normalizePath(folderPath);
		let filename = baseFilename;
		let counter = 1;

		while (true) {
			const fullPath = normalizePath(`${normalizedFolderPath}/${filename}.md`);
			const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

			if (!existingFile) {
				return filename;
			}

			// Generate new filename with counter
			filename = `${baseFilename} ${counter}`;
			counter++;
		}
	}

	/**
	 * Check if a file would conflict during import
	 */
	checkForConflict(joplinNote: JoplinNote, targetFolder: string): {
		hasConflict: boolean;
		conflictPath?: string;
		existingFile?: TFile;
	} {
		const baseFilename = this.sanitizeFilename(joplinNote.title);
		const fullPath = normalizePath(`${targetFolder}/${baseFilename}.md`);
		const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

		if (existingFile instanceof TFile) {
			return {
				hasConflict: true,
				conflictPath: fullPath,
				existingFile
			};
		}

		return { hasConflict: false };
	}

	/**
	 * Import a single Joplin note to Obsidian with comprehensive error handling and image processing
	 */
	async importNoteWithOptions(
		joplinNote: JoplinNote,
		options: ImportOptions,
		onProgress?: (progress: { stage: string; imageProgress?: ImageDownloadProgress }) => void
	): Promise<{
		file: TFile;
		action: 'created' | 'overwritten' | 'renamed';
		originalFilename: string;
		finalFilename: string;
		imageResults?: ImageImportResult[];
	}> {
		try {
			// Ensure target folder exists
			await this.ensureFolderExists(options.targetFolder);

			// Sanitize and prepare filename
			const baseFilename = this.sanitizeFilename(joplinNote.title);
			let filename = baseFilename;
			let action: 'created' | 'overwritten' | 'renamed' = 'created';

			// Handle filename conflicts
			const fullPath = normalizePath(`${options.targetFolder}/${filename}.md`);
			const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

			if (existingFile) {
				switch (options.conflictResolution) {
					case 'skip':
						throw new Error(`File already exists: ${filename}.md`);
					case 'rename':
						filename = await this.generateUniqueNoteFilename(options.targetFolder, baseFilename);
						action = 'renamed';
						break;
					case 'overwrite':
						action = 'overwritten';
						break;
				}
			}

			// Report progress: Starting image processing
			if (onProgress) {
				onProgress({ stage: 'Processing images...' });
			}

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

			// Validate content length (prevent extremely large files)
			if (finalContent.length > 10 * 1024 * 1024) { // 10MB limit
				throw new Error('Note content is too large to import (>10MB)');
			}

			// Report progress: Creating file
			if (onProgress) {
				onProgress({ stage: 'Creating file...' });
			}

			// Create the file
			const finalPath = normalizePath(`${options.targetFolder}/${filename}.md`);

			let file: TFile;
			if (existingFile instanceof TFile && options.conflictResolution === 'overwrite') {
				// Overwrite existing file
				await this.app.vault.modify(existingFile, finalContent);
				file = existingFile;
			} else {
				// Create new file
				file = await this.app.vault.create(finalPath, finalContent);
			}

			// Report progress: Complete
			if (onProgress) {
				onProgress({ stage: 'Import complete' });
			}

			return {
				file,
				action,
				originalFilename: baseFilename,
				finalFilename: filename,
				imageResults
			};
		} catch (error) {
			// Enhanced error handling with context
			ErrorHandler.logDetailedError(error, 'Import note failed', {
				noteId: joplinNote.id,
				noteTitle: joplinNote.title,
				targetFolder: options.targetFolder,
				conflictResolution: options.conflictResolution
			});

			// Re-throw with enhanced error information
			if (error instanceof Error) {
				throw error;
			} else {
				throw new Error(`Failed to import note "${joplinNote.title}": ${String(error)}`);
			}
		}
	}

	/**
	 * Check for conflicts across multiple notes before import
	 */
	checkForConflicts(joplinNotes: JoplinNote[], targetFolder: string): {
		conflicts: {
			note: JoplinNote;
			conflictPath: string;
			existingFile: TFile;
		}[];
		noConflicts: JoplinNote[];
	} {
		const conflicts: {
			note: JoplinNote;
			conflictPath: string;
			existingFile: TFile;
		}[] = [];
		const noConflicts: JoplinNote[] = [];

		for (const note of joplinNotes) {
			const conflictCheck = this.checkForConflict(note, targetFolder);
			if (conflictCheck.hasConflict) {
				conflicts.push({
					note,
					conflictPath: conflictCheck.conflictPath!,
					existingFile: conflictCheck.existingFile!
				});
			} else {
				noConflicts.push(note);
			}
		}

		return { conflicts, noConflicts };
	}

	/**
	 * Import multiple Joplin notes with enhanced error handling and progress tracking
	 */
	async importNotes(
		joplinNotes: JoplinNote[],
		options: ImportOptions,
		onProgress?: (progress: {
			noteIndex: number;
			totalNotes: number;
			currentNote: string;
			stage: string;
			imageProgress?: ImageDownloadProgress;
		}) => void
	): Promise<{
		successful: {
			file: TFile;
			note: JoplinNote;
			action: 'created' | 'overwritten' | 'renamed';
			originalFilename: string;
			finalFilename: string;
			imageResults?: ImageImportResult[];
		}[];
		failed: { note: JoplinNote; error: string }[];
	}> {
		const successful: {
			file: TFile;
			note: JoplinNote;
			action: 'created' | 'overwritten' | 'renamed';
			originalFilename: string;
			finalFilename: string;
			imageResults?: ImageImportResult[];
		}[] = [];
		const failed: { note: JoplinNote; error: string }[] = [];

		console.log(`Joplin Portal: Starting import of ${joplinNotes.length} notes`);

		for (let i = 0; i < joplinNotes.length; i++) {
			const note = joplinNotes[i];

			try {
				console.log(`Joplin Portal: Importing note ${i + 1}/${joplinNotes.length}: ${note.title}`);

				// Report overall progress
				if (onProgress) {
					onProgress({
						noteIndex: i + 1,
						totalNotes: joplinNotes.length,
						currentNote: note.title,
						stage: 'Starting import...'
					});
				}

				const result = await this.importNoteWithOptions(
					note,
					options,
					onProgress ? (noteProgress) => {
						onProgress({
							noteIndex: i + 1,
							totalNotes: joplinNotes.length,
							currentNote: note.title,
							stage: noteProgress.stage,
							imageProgress: noteProgress.imageProgress
						});
					} : undefined
				);

				successful.push({
					...result,
					note
				});

				// Small delay between imports to prevent overwhelming the system
				if (i < joplinNotes.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			} catch (error) {
				const userError = ErrorHandler.handleImportError(error, note.title);

				failed.push({
					note,
					error: userError.message
				});

				// Log detailed error for debugging
				ErrorHandler.logDetailedError(error, `Import failed for note ${i + 1}/${joplinNotes.length}`, {
					noteId: note.id,
					noteTitle: note.title,
					importIndex: i + 1,
					totalNotes: joplinNotes.length
				});
			}
		}

		// Log final results
		console.log(`Joplin Portal: Import completed. ${successful.length} successful, ${failed.length} failed`);

		// Log image processing summary
		const totalImages = successful.reduce((sum, result) => sum + (result.imageResults?.length || 0), 0);
		const successfulImages = successful.reduce((sum, result) =>
			sum + (result.imageResults?.filter(img => img.success).length || 0), 0);
		const failedImages = totalImages - successfulImages;

		if (totalImages > 0) {
			console.log(`Joplin Portal: Image processing summary: ${successfulImages} successful, ${failedImages} failed out of ${totalImages} total images`);
		}

		// Invalidate search cache for imported notes
		if (successful.length > 0 && this.onImportComplete) {
			const importedNotes = successful.map(result => result.note);
			this.onImportComplete(importedNotes);
		}

		// Show summary notice with image information
		if (successful.length > 0 && failed.length === 0) {
			let message = `✅ Successfully imported ${successful.length} note${successful.length !== 1 ? 's' : ''}`;
			if (totalImages > 0) {
				message += ` with ${successfulImages} image${successfulImages !== 1 ? 's' : ''}`;
				if (failedImages > 0) {
					message += ` (${failedImages} image${failedImages !== 1 ? 's' : ''} failed)`;
				}
			}
			new Notice(message);
		} else if (successful.length > 0 && failed.length > 0) {
			let message = `⚠️ Imported ${successful.length} note${successful.length !== 1 ? 's' : ''}, ${failed.length} failed`;
			if (totalImages > 0) {
				message += ` (${successfulImages}/${totalImages} images)`;
			}
			new Notice(message);
		} else if (failed.length > 0) {
			new Notice(`❌ Failed to import ${failed.length} note${failed.length !== 1 ? 's' : ''}`);
		}

		return { successful, failed };
	}

	/**
	 * Import a single note (backward compatibility method for tests)
	 */
	async importNote(joplinNote: JoplinNote, targetFolder: string, conflictResolution: 'skip' | 'overwrite' | 'rename' = 'rename'): Promise<{
		success: boolean;
		filePath?: string;
		error?: string;
	}> {
		try {
			const options: ImportOptions = {
				targetFolder,
				applyTemplate: false,
				conflictResolution
			};

			const result = await this.importNoteWithOptions(joplinNote, options);

			return {
				success: true,
				filePath: result.file.path
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Import multiple notes (backward compatibility method for tests)
	 */
	async importMultipleNotes(
		joplinNotes: JoplinNote[],
		targetFolder: string,
		progressCallback?: (progress: { current: number; total: number }) => void
	): Promise<{ successful: any[]; failed: any[] }> {
		const options: ImportOptions = {
			targetFolder,
			applyTemplate: false,
			conflictResolution: 'rename'
		};

		const result = await this.importNotes(
			joplinNotes,
			options,
			progressCallback ? (progress) => {
				progressCallback({ current: progress.noteIndex, total: progress.totalNotes });
			} : undefined
		);

		// Convert to expected format for tests
		return {
			successful: result.successful.map(item => ({
				note: item.note,
				filePath: item.file.path
			})),
			failed: result.failed.map(item => ({
				note: item.note,
				error: item.error
			}))
		};
	}
}