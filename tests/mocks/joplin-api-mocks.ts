import { JoplinNote, JoplinApiResponse } from '../../src/types';

export const mockJoplinNote: JoplinNote = {
  id: 'test-note-1',
  title: 'Test Note',
  body: '# Test Note\n\nThis is a test note with some content.',
  created_time: 1640995200000, // 2022-01-01
  updated_time: 1640995200000,
  parent_id: 'test-folder-1',
  tags: ['test', 'sample'],
  source_url: 'https://example.com'
};

export const mockJoplinNotes: JoplinNote[] = [
  mockJoplinNote,
  {
    id: 'test-note-2',
    title: 'Another Test Note',
    body: '# Another Test Note\n\nThis is another test note.',
    created_time: 1641081600000, // 2022-01-02
    updated_time: 1641081600000,
    parent_id: 'test-folder-1',
    tags: ['test'],
  },
  {
    id: 'test-note-3',
    title: 'Note with Special Characters',
    body: '# Note with Special Characters\n\nThis note has **bold** and *italic* text.',
    created_time: 1641168000000, // 2022-01-03
    updated_time: 1641168000000,
    parent_id: 'test-folder-2',
  }
];

export const mockSearchResponse: JoplinApiResponse<JoplinNote> = {
  items: mockJoplinNotes,
  has_more: false
};

export const mockEmptySearchResponse: JoplinApiResponse<JoplinNote> = {
  items: [],
  has_more: false
};

export const mockPaginatedSearchResponse: JoplinApiResponse<JoplinNote> = {
  items: [mockJoplinNote],
  has_more: true
};

export const mockApiError = {
  message: 'API Error',
  status: 500,
  statusText: 'Internal Server Error'
};

export const mockNetworkError = {
  message: 'Network Error',
  code: 'NETWORK_ERROR'
};

export const mockAuthError = {
  message: 'Unauthorized',
  status: 401,
  statusText: 'Unauthorized'
};