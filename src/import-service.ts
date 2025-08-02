import { App, TFile, TFolder, normalizePath, Notice } from 'obsidian';
import { JoplinNote, ImportOptions } from './types';

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
	 * Import a single Joplin note to Obsidian
	 */
	async importNote(joplinNote: JoplinNote, options: ImportOptions): Promise<TFile> {
		// Ensure target folder exists
		await this.ensureFolderExists(options.targetFolder);

		// Sanitize and prepare filename
		const baseFilename = this.sanitizeFilename(joplinNote.title);
		let filename = baseFilename;

		// Handle filename conflicts
		const fullPath = normalizePath(`${options.targetFolder}/${filename}.md`);
		const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

		if (existingFile) {
			switch (options.conflictResolution) {
				case 'skip':
					throw new Error(`File already exists: ${filename}.md`);
				case 'rename':
					filename = await this.generateUniqueFilename(options.targetFolder, baseFilename);
					break;
				case 'overwrite':
					// Will overwrite existing file
					break;
			}
		}

		// Convert markdown content
		const convertedMarkdown = this.convertJoplinToObsidianMarkdown(joplinNote);

		// Generate frontmatter
		const frontmatter = this.generateFrontmatter(joplinNote);

		// Combine frontmatter and content
		const finalContent = frontmatter + convertedMarkdown;

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

		// Preserve creation time by updating file stats if possible
		// Note: Obsidian doesn't directly support setting file creation time,
		// but we preserve it in frontmatter for reference

		return file;
	}

	/**
	 * Import multiple Joplin notes
	 */
	async importNotes(joplinNotes: JoplinNote[], options: ImportOptions): Promise<{
		successful: TFile[];
		failed: { note: JoplinNote; error: string }[];
	}> {
		const successful: TFile[] = [];
		const failed: { note: JoplinNote; error: string }[] = [];

		for (const note of joplinNotes) {
			try {
				const file = await this.importNote(note, options);
				successful.push(file);
			} catch (error) {
				failed.push({
					note,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return { successful, failed };
	}
}