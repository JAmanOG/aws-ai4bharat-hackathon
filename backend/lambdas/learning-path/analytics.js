/**
 * Learning Path Lambda – analytics.js
 * Learning outcome tracking, progress analytics, and adjustment triggers.
 * Satisfies Requirement 7.6: Track learning outcomes and adjust recommendations.
 */

const { dynamoDB, TABLE_NAMES, query } = require('../../utils/db');
const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

/**
 * Get comprehensive learning progress summary for a user.
 */
async function getProgressSummary(userId) {
    // Get enrollment stats from Aurora
    const enrollmentStats = await query(`
    SELECT
      COUNT(*) as total_enrollments,
      COUNT(*) FILTER (WHERE status = 'active') as active_courses,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_courses,
      COUNT(*) FILTER (WHERE status = 'paused') as paused_courses,
      COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - enrolled_at)) / 3600), 0) as avg_completion_hours
    FROM enrollments
    WHERE user_id = $1
  `, [userId]);

    // Get module-level progress
    const moduleStats = await query(`
    SELECT
      COUNT(*) as total_modules_attempted,
      COUNT(*) FILTER (WHERE mp.status = 'completed') as modules_completed,
      COALESCE(AVG(mp.score), 0) as avg_score,
      COALESCE(SUM(mp.time_spent_secs), 0) as total_time_secs
    FROM module_progress mp
    JOIN enrollments e ON e.id = mp.enrollment_id
    WHERE e.user_id = $1
  `, [userId]);

    // Get category breakdown
    const categoryBreakdown = await query(`
    SELECT c.category,
      COUNT(DISTINCT e.id) as courses_enrolled,
      COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed') as courses_completed,
      COALESCE(AVG(mp.score), 0) as avg_score
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    LEFT JOIN module_progress mp ON mp.enrollment_id = e.id
    WHERE e.user_id = $1
    GROUP BY c.category
    ORDER BY courses_enrolled DESC
  `, [userId]);

    // Get recent interactions from DynamoDB
    const interactions = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.CONTENT_INTERACTIONS,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: 50,
    }));

    const interactionItems = interactions.Items || [];

    // Calculate activity streaks and patterns
    const activityAnalysis = analyzeActivity(interactionItems);

    const stats = enrollmentStats.rows[0] || {};
    const modStats = moduleStats.rows[0] || {};

    return {
        userId,
        overview: {
            totalEnrollments: parseInt(stats.total_enrollments || 0),
            activeCourses: parseInt(stats.active_courses || 0),
            completedCourses: parseInt(stats.completed_courses || 0),
            pausedCourses: parseInt(stats.paused_courses || 0),
            avgCompletionHours: parseFloat(stats.avg_completion_hours || 0).toFixed(1),
        },
        moduleProgress: {
            totalAttempted: parseInt(modStats.total_modules_attempted || 0),
            completed: parseInt(modStats.modules_completed || 0),
            avgScore: parseFloat(modStats.avg_score || 0).toFixed(1),
            totalTimeMins: Math.round(parseInt(modStats.total_time_secs || 0) / 60),
        },
        categoryBreakdown: categoryBreakdown.rows,
        activity: activityAnalysis,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Analyze user activity patterns for adaptive recommendations.
 */
function analyzeActivity(interactions) {
    if (interactions.length === 0) {
        return {
            recentActivityCount: 0,
            currentStreak: 0,
            learningPace: 'not_started',
            preferredContentType: null,
            voiceUsagePercent: 0,
            recommendations: ['Start your first course to begin your learning journey!'],
        };
    }

    // Activity in last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentActivity = interactions.filter(i => new Date(i.timestamp).getTime() > sevenDaysAgo);

    // Calculate streak (consecutive days with activity)
    const activityDays = new Set(
        interactions.map(i => new Date(i.timestamp).toISOString().split('T')[0])
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
        const date = new Date(today - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        if (activityDays.has(date)) streak++;
        else if (i > 0) break;
    }

    // Learning pace
    const avgDailyMins = recentActivity.reduce((sum, i) => sum + (i.durationSecs || 0), 0) / 60 / 7;
    let learningPace = 'slow';
    if (avgDailyMins > 30) learningPace = 'fast';
    else if (avgDailyMins > 10) learningPace = 'moderate';

    // Content type preference
    const typeCounts = {};
    interactions.forEach(i => {
        typeCounts[i.contentType] = (typeCounts[i.contentType] || 0) + 1;
    });
    const preferredType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Voice usage
    const voiceCount = interactions.filter(i => i.voiceUsed).length;
    const voicePercent = Math.round((voiceCount / interactions.length) * 100);

    // Generate adaptive recommendations
    const recommendations = [];
    if (learningPace === 'slow') {
        recommendations.push('Try setting a daily learning goal of 15 minutes');
    }
    if (learningPace === 'fast') {
        recommendations.push('Great pace! Consider exploring advanced courses');
    }
    if (streak > 5) {
        recommendations.push(`Amazing ${streak}-day streak! Keep it up!`);
    }
    if (voicePercent < 30) {
        recommendations.push('Try using voice mode for a hands-free learning experience');
    }

    return {
        recentActivityCount: recentActivity.length,
        currentStreak: streak,
        learningPace,
        avgDailyMins: parseFloat(avgDailyMins.toFixed(1)),
        preferredContentType: preferredType,
        voiceUsagePercent: voicePercent,
        recommendations,
    };
}

/**
 * Check if recommendations should be refreshed based on learning activity changes.
 */
async function shouldRefreshRecommendations(userId) {
    const latestRec = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.LEARNING_RECOMMENDATIONS,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: 1,
    }));

    if (!latestRec.Items?.length) return true;

    const lastGen = new Date(latestRec.Items[0].generatedAt).getTime();
    const now = Date.now();

    // Refresh if: older than 24h, or user completed a course since last generation
    if (now - lastGen > 24 * 60 * 60 * 1000) return true;

    // Check for course completions after last recommendation
    const completions = await query(
        `SELECT COUNT(*) as recent FROM enrollments WHERE user_id = $1 AND completed_at > $2`,
        [userId, latestRec.Items[0].generatedAt]
    );

    return parseInt(completions.rows[0]?.recent || 0) > 0;
}

module.exports = { getProgressSummary, analyzeActivity, shouldRefreshRecommendations };
