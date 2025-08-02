import { App, TFile, TFolder, normalizePath, Notice } from 'obsidian';
import { JoplinNote, ImportOptions } from './types';
import { ErrorHandler } from './error-handler';

export class ImportService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Convert Joplin markdown to Obsidian-compatible format
	 */
	convertJoplinToObsidianMarkdown(joplinNote: JoplinNote): string {
		let markdown = joplinNote.body;

		// Convert Joplin-specific syntax to Obsidian format

		// 1. Convert Joplin internal links [title](:/noteId) to plain text references
		markdown = markdown.replace(/\[([^\]]+)\]\(:\/([a-f0-9]+)\)/g, '[[Joplin Note: $1]]');

		// 2. Convert Joplin resource links ![](:/resourceId) to placeholder text
		markdown = markdown.replace(/!\[\]\(:\/([a-f0-9]+)\)/g, '[Joplin Resource: $1]');

		// 3. Convert Joplin resource links with alt text ![alt](:/resourceId)
		markdown = markdown.replace(/!\[([^\]]*)\]\(:\/([a-f0-9]+)\)/g, '[Joplin Resource: $1 ($2)]');

		// 4. Handle Joplin checkboxes - they should already be compatible
		// Joplin uses - [ ] and - [x] which is standard markdown

		// 5. Clean up any remaining Joplin-specific protocols
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
	 * Generate unique filename if file already exists
	 */
	async generateUniqueFilename(folderPath: string, baseFilename: string): Promise<string> {
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
	 * Import a single Joplin note to Obsidian with comprehensive error handling
	 */
	async importNote(joplinNote: JoplinNote, options: ImportOptions): Promise<{
		file: TFile;
		action: 'created' | 'overwritten' | 'renamed';
		originalFilename: string;
		finalFilename: string;
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
						filename = await this.generateUniqueFilename(options.targetFolder, baseFilename);
						action = 'renamed';
						break;
					case 'overwrite':
						action = 'overwritten';
						break;
				}
			}

			// Convert markdown content
			const convertedMarkdown = this.convertJoplinToObsidianMarkdown(joplinNote);

			// Generate frontmatter
			const frontmatter = this.generateFrontmatter(joplinNote);

			// Combine frontmatter and content
			const finalContent = frontmatter + convertedMarkdown;

			// Validate content length (prevent extremely large files)
			if (finalContent.length > 10 * 1024 * 1024) { // 10MB limit
				throw new Error('Note content is too large to import (>10MB)');
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

			return {
				file,
				action,
				originalFilename: baseFilename,
				finalFilename: filename
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
	async importNotes(joplinNotes: JoplinNote[], options: ImportOptions): Promise<{
		successful: {
			file: TFile;
			note: JoplinNote;
			action: 'created' | 'overwritten' | 'renamed';
			originalFilename: string;
			finalFilename: string;
		}[];
		failed: { note: JoplinNote; error: string }[];
	}> {
		const successful: {
			file: TFile;
			note: JoplinNote;
			action: 'created' | 'overwritten' | 'renamed';
			originalFilename: string;
			finalFilename: string;
		}[] = [];
		const failed: { note: JoplinNote; error: string }[] = [];

		console.log(`Joplin Portal: Starting import of ${joplinNotes.length} notes`);

		for (let i = 0; i < joplinNotes.length; i++) {
			const note = joplinNotes[i];

			try {
				console.log(`Joplin Portal: Importing note ${i + 1}/${joplinNotes.length}: ${note.title}`);

				const result = await this.importNote(note, options);
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

		// Show summary notice
		if (successful.length > 0 && failed.length === 0) {
			new Notice(`✅ Successfully imported ${successful.length} note${successful.length !== 1 ? 's' : ''}`);
		} else if (successful.length > 0 && failed.length > 0) {
			new Notice(`⚠️ Imported ${successful.length} note${successful.length !== 1 ? 's' : ''}, ${failed.length} failed`);
		} else if (failed.length > 0) {
			new Notice(`❌ Failed to import ${failed.length} note${failed.length !== 1 ? 's' : ''}`);
		}

		return { successful, failed };
	}
}