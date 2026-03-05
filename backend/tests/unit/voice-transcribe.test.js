/**
 * Unit tests for Voice – transcribe.js
 * Tests Amazon Transcribe STT + Sarvam fallback.
 */

/* ---------- Mock AWS SDK ---------- */
const mockTranscribeClient = {
  send: jest.fn(),
};
const mockS3Client = {
  send: jest.fn(),
};

jest.mock('@aws-sdk/client-transcribe', () => ({
  TranscribeClient: jest.fn(() => mockTranscribeClient),
  StartTranscriptionJobCommand: jest.fn((p) => ({ ...p, _cmd: 'start' })),
  GetTranscriptionJobCommand: jest.fn((p) => ({ ...p, _cmd: 'get' })),
  DeleteTranscriptionJobCommand: jest.fn((p) => ({ ...p, _cmd: 'delete' })),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => mockS3Client),
  PutObjectCommand: jest.fn((p) => ({ ...p, _cmd: 'put' })),
  DeleteObjectCommand: jest.fn((p) => ({ ...p, _cmd: 'delObj' })),
}));

/* ---------- Mock Sarvam (fallback) ---------- */
jest.mock('../../services/sarvam', () => ({
  transcribe: jest.fn(async () => ({
    transcript: 'Sarvam fallback transcript',
    language_code: 'hi-IN',
    language_probability: 0.9,
  })),
}));

/* ---------- Mock fetch for Transcribe result URI ---------- */
const mockFetch = jest.fn();
global.fetch = mockFetch;

const transcribeService = require('../../services/transcribe');

describe('Amazon Transcribe Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTranscribeClient.send.mockReset();
    mockS3Client.send.mockReset();
    mockFetch.mockReset();
    process.env.CONTENT_BUCKET = 'test-bucket';
  });

  afterAll(() => {
    delete process.env.CONTENT_BUCKET;
  });

  describe('detectMediaFormat', () => {
    test('detects WAV from RIFF header', () => {
      const buf = Buffer.alloc(12);
      buf.write('RIFF', 0);
      buf.write('WAVE', 8);
      expect(transcribeService.detectMediaFormat(buf)).toBe('wav');
    });

    test('detects OGG from OggS header', () => {
      const buf = Buffer.alloc(4);
      buf.write('OggS', 0);
      expect(transcribeService.detectMediaFormat(buf)).toBe('ogg');
    });

    test('detects FLAC from fLaC header', () => {
      const buf = Buffer.alloc(4);
      buf.write('fLaC', 0);
      expect(transcribeService.detectMediaFormat(buf)).toBe('flac');
    });

    test('detects MP3 from ID3 header', () => {
      const buf = Buffer.alloc(4);
      buf.write('ID3', 0);
      expect(transcribeService.detectMediaFormat(buf)).toBe('mp3');
    });

    test('detects MP3 from sync word 0xFF 0xFB', () => {
      const buf = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
      expect(transcribeService.detectMediaFormat(buf)).toBe('mp3');
    });

    test('defaults to wav for unknown format', () => {
      const buf = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(transcribeService.detectMediaFormat(buf)).toBe('wav');
    });

    test('defaults to wav for empty buffer', () => {
      expect(transcribeService.detectMediaFormat(Buffer.alloc(0))).toBe('wav');
    });
  });

  describe('TRANSCRIBE_LANGUAGES', () => {
    test('includes main Indian languages', () => {
      expect(transcribeService.TRANSCRIBE_LANGUAGES).toContain('en-IN');
      expect(transcribeService.TRANSCRIBE_LANGUAGES).toContain('hi-IN');
      expect(transcribeService.TRANSCRIBE_LANGUAGES).toContain('ta-IN');
      expect(transcribeService.TRANSCRIBE_LANGUAGES).toContain('te-IN');
    });

    test('has at least 6 language codes', () => {
      expect(transcribeService.TRANSCRIBE_LANGUAGES.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('transcribe (hybrid)', () => {
    test('falls back to Sarvam when Amazon Transcribe fails', async () => {
      // Amazon Transcribe fails (S3 upload fails)
      mockS3Client.send.mockRejectedValueOnce(new Error('S3 upload failed'));

      const buf = Buffer.from('fake-audio');
      const result = await transcribeService.transcribe(buf, { languageCode: 'hi-IN' });

      expect(result.transcript).toBe('Sarvam fallback transcript');
      expect(result.provider).toBe('sarvam-stt');
    });

    test('returns Amazon result when Transcribe succeeds', async () => {
      // S3 upload succeeds
      mockS3Client.send.mockResolvedValueOnce({});

      // StartTranscriptionJob succeeds
      mockTranscribeClient.send.mockResolvedValueOnce({});

      // GetTranscriptionJob returns COMPLETED
      mockTranscribeClient.send.mockResolvedValueOnce({
        TranscriptionJob: {
          TranscriptionJobStatus: 'COMPLETED',
          LanguageCode: 'hi-IN',
          Transcript: {
            TranscriptFileUri: 'https://s3.amazonaws.com/test/result.json',
          },
        },
      });

      // Fetch transcript result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: {
            transcripts: [{ transcript: 'Meri fasal ki kya haalat hai' }],
            language_code: 'hi-IN',
          },
        }),
      });

      // Cleanup S3 + Transcribe job
      mockS3Client.send.mockResolvedValueOnce({});
      mockTranscribeClient.send.mockResolvedValueOnce({});

      const buf = Buffer.from('fake-audio');
      const result = await transcribeService.transcribe(buf, { languageCode: 'hi-IN' });

      expect(result.transcript).toBe('Meri fasal ki kya haalat hai');
      expect(result.provider).toBe('amazon-transcribe');
    });
  });
});
