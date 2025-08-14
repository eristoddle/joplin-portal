/**
 * Centralized logging utility for Joplin Portal plugin
 * Provides conditional logging based on debug mode setting
 */

import { JoplinPortalSettings } from './types';

/**
 * Logger class that provides conditional logging based on debug mode
 *
 * This utility ensures that debug messages are only output when debug mode
 * is enabled in the plugin settings, keeping the console clean in production
 * while still allowing critical errors to be logged.
 */
export class Logger {
	private settings: JoplinPortalSettings;

	/**
	 * Creates a new Logger instance
	 *
	 * @param settings - The plugin settings object containing debugMode flag
	 */
	constructor(settings: JoplinPortalSettings) {
		this.settings = settings;
	}

	/**
	 * Updates the settings reference for the logger
	 * This allows the logger to respect real-time changes to debug mode
	 *
	 * @param settings - Updated plugin settings
	 */
	updateSettings(settings: JoplinPortalSettings): void {
		this.settings = settings;
	}

	/**
	 * Logs debug messages only when debug mode is enabled
	 *
	 * Debug messages are used for development and troubleshooting purposes.
	 * They provide detailed information about plugin operations but are
	 * suppressed in production to keep the console clean.
	 *
	 * @param message - The debug message to log
	 * @param args - Additional arguments to include in the log
	 */
	debug(message: string, ...args: any[]): void {
		if (this.settings.debugMode) {
			console.log(`[Joplin Portal Debug] ${message}`, ...args);
		}
	}

	/**
	 * Logs warning messages only when debug mode is enabled
	 *
	 * Warning messages indicate potential issues that don't prevent
	 * the plugin from functioning but may need attention.
	 *
	 * @param message - The warning message to log
	 * @param args - Additional arguments to include in the log
	 */
	warn(message: string, ...args: any[]): void {
		if (this.settings.debugMode) {
			console.warn(`[Joplin Portal Warning] ${message}`, ...args);
		}
	}

	/**
	 * Logs error messages with appropriate detail level based on debug mode
	 *
	 * Error messages are always logged since they indicate critical issues,
	 * but the level of detail varies based on debug mode. In debug mode,
	 * full technical details are provided. In production mode, only
	 * essential error information is logged.
	 *
	 * @param message - The error message to log
	 * @param args - Additional arguments to include in the log (only in debug mode)
	 */
	error(message: string, ...args: any[]): void {
		if (this.settings.debugMode) {
			console.error(`[Joplin Portal Error] ${message}`, ...args);
		} else {
			// In production mode, log errors but without potentially sensitive details
			console.error(`[Joplin Portal] ${message}`);
		}
	}

	/**
	 * Checks if debug mode is currently enabled
	 *
	 * This can be useful for conditional logic that goes beyond simple logging,
	 * such as enabling additional validation or detailed error reporting.
	 *
	 * @returns true if debug mode is enabled, false otherwise
	 */
	isDebugEnabled(): boolean {
		return this.settings.debugMode;
	}
}

/**
 * Creates a new Logger instance with the provided settings
 *
 * This is a convenience function for creating logger instances
 * without needing to import the Logger class directly.
 *
 * @param settings - The plugin settings object
 * @returns A new Logger instance
 */
export function createLogger(settings: JoplinPortalSettings): Logger {
	return new Logger(settings);
}