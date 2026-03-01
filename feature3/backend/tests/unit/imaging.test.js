/**
 * Tests for Medical Imaging (Module 2).
 */

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({})),
  PutObjectCommand: jest.fn((p) => p),
  GetObjectCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-upload-url'),
}));

const mockBedrockSend = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: mockBedrockSend })),
  InvokeModelCommand: jest.fn((p) => p),
}));

jest.mock('axios');

const { initiateUpload, getDocumentStatus, analyzeImage, getFallbackAnalysis } = require('../../lambdas/medical-imaging/imaging');

describe('Medical Imaging', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('initiateUpload', () => {
    test('should return presigned URL and document ID', async () => {
      const result = await initiateUpload('user-1', 'xray', 'Chest X-ray');
      expect(result.documentId).toBeDefined();
      expect(result.uploadUrl).toContain('presigned');
      expect(result.imagingType).toBe('xray');
      expect(result.status).toBe('pending_upload');
      expect(result.instructions).toHaveLength(3);
    });

    test('should reject invalid imaging type', async () => {
      await expect(initiateUpload('user-1', 'invalid-type', ''))
        .rejects.toEqual(expect.objectContaining({ statusCode: 400 }));
    });

    test('should accept MRI type', async () => {
      const result = await initiateUpload('user-1', 'mri', 'Brain MRI');
      expect(result.imagingType).toBe('mri');
    });

    test('should accept CT scan type', async () => {
      const result = await initiateUpload('user-1', 'ct-scan', 'Abdomen CT');
      expect(result.imagingType).toBe('ct-scan');
    });
  });

  describe('getDocumentStatus', () => {
    test('should return document status', async () => {
      const result = await getDocumentStatus('doc-123');
      expect(result.documentId).toBe('doc-123');
      expect(result.status).toBe('uploaded');
      expect(result.disclaimer).toBeDefined();
    });
  });

  describe('analyzeImage', () => {
    test('should return analysis from Bedrock', async () => {
      const mockAnalysis = {
        general_info: 'X-rays show bone structures',
        common_findings: ['Normal anatomy', 'Fractures', 'Infections'],
        next_steps: 'Consult a radiologist',
        important_note: 'Professional interpretation needed',
      };

      mockBedrockSend.mockResolvedValueOnce({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{ text: JSON.stringify(mockAnalysis) }],
        })),
      });

      const result = await analyzeImage('doc-123', 'xray');
      expect(result.analysis.general_info).toContain('bone');
      expect(result.disclaimer).toBeDefined();
    });

    test('should use fallback when Bedrock fails', async () => {
      mockBedrockSend.mockRejectedValueOnce(new Error('Bedrock unavailable'));

      const result = await analyzeImage('doc-123', 'mri');
      expect(result.analysis.general_info).toContain('MRI');
      expect(result.analysis.important_note).toContain('professional');
    });
  });

  describe('getFallbackAnalysis', () => {
    test('should return xray-specific info', () => {
      const result = getFallbackAnalysis('xray');
      expect(result.general_info).toContain('X-ray');
    });

    test('should return mri-specific info', () => {
      const result = getFallbackAnalysis('mri');
      expect(result.general_info).toContain('MRI');
    });

    test('should return ct-scan-specific info', () => {
      const result = getFallbackAnalysis('ct-scan');
      expect(result.general_info).toContain('CT');
    });

    test('should return ultrasound-specific info', () => {
      const result = getFallbackAnalysis('ultrasound');
      expect(result.general_info).toContain('Ultrasound');
    });
  });
});
