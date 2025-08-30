/**
 * Core TypeScript interfaces for Joplin Portal plugin
 */

import { TFile } from 'obsidian';

export interface JoplinPortalSettings {
	serverUrl: string;
	apiToken: string;
	defaultImportFolder: string;
	importTemplate: string;
	searchLimit: number;
	debugMode: boolean;
	includeMetadataInFrontmatter: boolean;
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
	existingFile: TFile;
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
	request: () => Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
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

export interface ImageImportResult {
	resourceId: string;
	originalFilename: string;
	localFilename: string;
	localPath: string;
	success: boolean;
	error?: string;
}

export interface ImageDownloadProgress {
	total: number;
	downloaded: number;
	failed: number;
	current?: string;
}

export interface ImportProgress {
	stage: string;
	current?: number;
	total?: number;
	noteIndex?: number;
	totalNotes?: number;
	currentNote?: string;
	imageProgress?: ImageDownloadProgress;
}

export const DEFAULT_SETTINGS: JoplinPortalSettings = {
	serverUrl: 'http://localhost:41184',
	apiToken: '',
	defaultImportFolder: 'Imported from Joplin',
	importTemplate: '',
	searchLimit: 50,
	debugMode: false,
	includeMetadataInFrontmatter: true
};