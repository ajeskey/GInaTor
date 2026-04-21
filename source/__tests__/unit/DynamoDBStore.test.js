'use strict';

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: mockSend })
    },
    GetCommand: jest.fn().mockImplementation((params) => ({ type: 'Get', params })),
    PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', params })),
    DeleteCommand: jest.fn().mockImplementation((params) => ({ type: 'Delete', params }))
  };
});

const DynamoDBStore = require('../../modules/session/DynamoDBStore');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

describe('DynamoDBStore', () => {
  let store;
  let mockSend;

  beforeEach(() => {
    store = new DynamoDBStore({ tableName: 'TestSessions', endpoint: 'http://localhost:8000' });
    mockSend = store.docClient.send;
    mockSend.mockReset();
  });

  describe('get', () => {
    test('returns null for non-existent session', (done) => {
      mockSend.mockResolvedValue({});

      store.get('nonexistent', (err, session) => {
        expect(err).toBeNull();
        expect(session).toBeNull();
        done();
      });
    });

    test('returns parsed session data for valid session', (done) => {
      const sessionData = { user: { id: '123' } };
      mockSend.mockResolvedValue({
        Item: {
          sessionId: 'sid-1',
          sessionData: JSON.stringify(sessionData),
          expires: Math.floor(Date.now() / 1000) + 3600
        }
      });

      store.get('sid-1', (err, session) => {
        expect(err).toBeNull();
        expect(session).toEqual(sessionData);
        done();
      });
    });

    test('returns null for expired session', (done) => {
      mockSend.mockResolvedValue({
        Item: {
          sessionId: 'sid-expired',
          sessionData: JSON.stringify({ user: 'old' }),
          expires: Math.floor(Date.now() / 1000) - 100
        }
      });

      store.get('sid-expired', (err, session) => {
        expect(err).toBeNull();
        expect(session).toBeNull();
        done();
      });
    });

    test('passes errors to callback', (done) => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      store.get('sid-err', (err) => {
        expect(err).toBeTruthy();
        expect(err.message).toBe('DynamoDB error');
        done();
      });
    });
  });

  describe('set', () => {
    test('stores session data with TTL', (done) => {
      mockSend.mockResolvedValue({});

      store.set('sid-new', { user: 'test' }, (err) => {
        expect(err).toBeNull();
        expect(mockSend).toHaveBeenCalledTimes(1);
        done();
      });
    });

    test('passes errors to callback', (done) => {
      mockSend.mockRejectedValue(new Error('Write error'));

      store.set('sid-fail', { user: 'test' }, (err) => {
        expect(err).toBeTruthy();
        done();
      });
    });
  });

  describe('destroy', () => {
    test('deletes session', (done) => {
      mockSend.mockResolvedValue({});

      store.destroy('sid-del', (err) => {
        expect(err).toBeNull();
        expect(mockSend).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });

  describe('touch', () => {
    test('refreshes session TTL', (done) => {
      mockSend.mockResolvedValue({});

      store.touch('sid-touch', { user: 'test' }, (err) => {
        expect(err).toBeNull();
        expect(mockSend).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });
});
