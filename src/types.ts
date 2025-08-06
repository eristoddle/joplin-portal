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

export interface ConflictInfo {
	note: JoplinNote;
	conflictPath: string;
	existingFile: any; // TFile from Obsidian
}

export interface ConflictResolution {
	action: 'skip' | 'overwrite' | 'rename';
	applyToAll?: boolean;
}

export interface ImportResult {
	successful: string[];
	failed: { noteTitle: string; error: string }[];
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
	tags?: string[];
	searchType?: 'text' | 'tag' | 'combined';
}

export interface JoplinApiError extends Error {
	status?: number;
	code?: string;
	retryable?: boolean;
	retryAfter?: number;
}

export interface UserFriendlyError {
	message: string;
	details?: string;
	action?: string;
	severity?: 'info' | 'warning' | 'error' | 'critical';
}

export interface RetryConfig {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
	backoffMultiplier: number;
}

export interface RateLimitConfig {
	maxRequestsPerMinute: number;
	maxConcurrentRequests: number;
}

export interface RequestQueueItem {
	id: string;
	request: () => Promise<any>;
	resolve: (value: any) => void;
	reject: (error: any) => void;
	timestamp: number;
	retryCount: number;
}

export interface SearchValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	normalizedQuery?: string;
}

export interface TagSearchOptions {
	tags: string[];
	operator: 'AND' | 'OR';
	includeText?: boolean;
	textQuery?: string;
}

export interface JoplinResource {
	id: string;
	title: string;
	mime: string;
	filename: string;
	created_time: number;
	updated_time: number;
	user_created_time: number;
	user_updated_time: number;
	file_extension: string;
	encryption_cipher_text: string;
	encryption_applied: number;
	encryption_blob_encrypted: number;
	size: number;
}

export interface ImageProcessingResult {
	originalLink: string;
	processedLink: string;
	success: boolean;
	error?: string;
	resourceId?: string;
	mimeType?: string;
	retryCount?: number;
	isPlaceholder?: boolean;
}

export const DEFAULT_SETTINGS: JoplinPortalSettings = {
	serverUrl: 'http://localhost:41184',
	apiToken: '',
	defaultImportFolder: 'Imported from Joplin',
	importTemplate: '',
	searchLimit: 50
};