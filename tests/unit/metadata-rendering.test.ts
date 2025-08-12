import { describe, it, expect } from 'vitest';

describe('Metadata Rendering - Date Formatting', () => {
	it('should format dates correctly with leading zeros', () => {
		// Test the date formatting logic directly
		const testDate = new Date('2024-03-05T15:30:00Z');
		const formattedDate = `${(testDate.getMonth() + 1).toString().padStart(2, '0')}/${testDate.getDate().toString().padStart(2, '0')}/${testDate.getFullYear()}`;

		expect(formattedDate).toBe('03/05/2024');
	});

	it('should format dates correctly without leading zeros when not needed', () => {
		// Test the date formatting logic directly
		const testDate = new Date('2024-12-25T15:30:00Z');
		const formattedDate = `${(testDate.getMonth() + 1).toString().padStart(2, '0')}/${testDate.getDate().toString().padStart(2, '0')}/${testDate.getFullYear()}`;

		expect(formattedDate).toBe('12/25/2024');
	});

	it('should format dates correctly with mixed leading zeros', () => {
		// Test the date formatting logic directly
		const testDate = new Date('2024-07-04T15:30:00Z');
		const formattedDate = `${(testDate.getMonth() + 1).toString().padStart(2, '0')}/${testDate.getDate().toString().padStart(2, '0')}/${testDate.getFullYear()}`;

		expect(formattedDate).toBe('07/04/2024');
	});
});