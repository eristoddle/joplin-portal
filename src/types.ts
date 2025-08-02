/**
 * Core TypeScript interfaces for Joplin Portal plugin
 */

export interface JoplinPortalSettings {
	serverUrl: string;
	apiToken: string;
	defaultImportFolder: string;
	importTemplate: string;
	searchLimit: number;
}

export interface JoplinNote {
	id: string;
	title: string;
	body: string;
	created_time: number;
	updated_time: number;
	parent_id: string;
	tags?: string[];
	source_url?: string;
}

export interface SearchResult {
	note: JoplinNote;
	snippet: string;
	relevance: number;
	selected: boolean;
	markedForImport: boolean;
}

export interface ImportOptions {
	targetFolder: string;
	applyTemplate: boolean;
	templatePath?: string;
	conflictResolution: 'skip' | 'overwrite' | 'rename';
}

export interface JoplinApiResponse<T> {
	items: T[];
	has_more: boolean;
}

export interface JoplinSearchResponse extends JoplinApiResponse<JoplinNote> {
	// Inherits items and has_more
}

export interface SearchOptions {
	fields?: string[];
	limit?: number;
	page?: number;
	order_by?: string;
	order_dir?: 'ASC' | 'DESC';
}

export interface JoplinApiError extends Error {
	status?: number;
	code?: string;
}

export interface UserFriendlyError {
	message: string;
	details?: string;
	action?: string;
}

export const DEFAULT_SETTINGS: JoplinPortalSettings = {
	serverUrl: 'http://localhost:41184',
	apiToken: '',
	defaultImportFolder: 'Imported from Joplin',
	importTemplate: '',
	searchLimit: 50
};