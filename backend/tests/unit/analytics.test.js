/**
 * Unit tests for Learning Path – analytics.js
 */

const { analyzeActivity } = require('../../lambdas/learning-path/analytics');

describe('Learning Analytics', () => {
    describe('analyzeActivity', () => {
        test('should handle empty interactions', () => {
            const result = analyzeActivity([]);

            expect(result.recentActivityCount).toBe(0);
            expect(result.currentStreak).toBe(0);
            expect(result.learningPace).toBe('not_started');
            expect(result.preferredContentType).toBeNull();
            expect(result.voiceUsagePercent).toBe(0);
            expect(result.recommendations).toContain('Start your first course to begin your learning journey!');
        });

        test('should calculate learning pace correctly', () => {
            const now = new Date();
            const interactions = [];

            // Create 7 days of interactions with 40 mins/day worth of content
            for (let d = 0; d < 7; d++) {
                const date = new Date(now - d * 24 * 60 * 60 * 1000);
                interactions.push({
                    timestamp: date.toISOString(),
                    contentType: 'module',
                    interactionType: 'complete',
                    durationSecs: 2400, // 40 minutes
                    voiceUsed: false,
                });
            }

            const result = analyzeActivity(interactions);

            expect(result.learningPace).toBe('fast'); // >30 min/day
            expect(result.recentActivityCount).toBe(7);
        });

        test('should calculate voice usage percentage', () => {
            const now = new Date().toISOString();
            const interactions = [
                { timestamp: now, contentType: 'module', durationSecs: 100, voiceUsed: true },
                { timestamp: now, contentType: 'module', durationSecs: 100, voiceUsed: true },
                { timestamp: now, contentType: 'module', durationSecs: 100, voiceUsed: false },
                { timestamp: now, contentType: 'module', durationSecs: 100, voiceUsed: false },
            ];

            const result = analyzeActivity(interactions);

            expect(result.voiceUsagePercent).toBe(50);
        });

        test('should identify preferred content type', () => {
            const now = new Date().toISOString();
            const interactions = [
                { timestamp: now, contentType: 'module', durationSecs: 100, voiceUsed: false },
                { timestamp: now, contentType: 'module', durationSecs: 100, voiceUsed: false },
                { timestamp: now, contentType: 'course', durationSecs: 100, voiceUsed: false },
                { timestamp: now, contentType: 'module', durationSecs: 100, voiceUsed: false },
            ];

            const result = analyzeActivity(interactions);

            expect(result.preferredContentType).toBe('module');
        });

        test('should calculate activity streak', () => {
            const now = new Date();
            const interactions = [];

            // 5 consecutive days of activity
            for (let d = 0; d < 5; d++) {
                const date = new Date(now - d * 24 * 60 * 60 * 1000);
                interactions.push({
                    timestamp: date.toISOString(),
                    contentType: 'module',
                    durationSecs: 300,
                    voiceUsed: false,
                });
            }

            const result = analyzeActivity(interactions);

            expect(result.currentStreak).toBe(5);
        });

        test('should recommend voice mode when voice usage is low', () => {
            const now = new Date().toISOString();
            const interactions = Array(10).fill(null).map(() => ({
                timestamp: now,
                contentType: 'module',
                durationSecs: 100,
                voiceUsed: false,
            }));

            const result = analyzeActivity(interactions);

            expect(result.recommendations).toContain(
                'Try using voice mode for a hands-free learning experience'
            );
        });
    });
});
