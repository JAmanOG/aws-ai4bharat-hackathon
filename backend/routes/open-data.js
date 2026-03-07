/**
 * Open Data Export routes – personal data portability (JSON / CSV)
 */

const aggregator    = require('../lambdas/open-data/aggregator');
const adapters      = require('../lambdas/open-data/adapters');
const csvFormatter  = require('../lambdas/open-data/csv-formatter');
const { EXPORT_FORMATS } = require('../utils/constants');

async function openDataRoutes(fastify) {
    /**
     * GET /open-data/export/:userId
     * Query: ?format=json|csv  (default: json)
     *
     * Returns the user's aggregated data for portability/transparency.
     */
    fastify.get('/open-data/export/:userId', async (req, reply) => {
        const targetUserId = req.params.userId;
        const format = (req.query.format || 'json').toLowerCase();

        if (!EXPORT_FORMATS.includes(format)) {
            throw { statusCode: 400, message: `Invalid format. Allowed: ${EXPORT_FORMATS.join(', ')}` };
        }

        // Only allow users to export their own data (or admins in future)
        if (req.userId !== targetUserId) {
            throw { statusCode: 403, message: 'You can only export your own data' };
        }

        const raw = await aggregator.aggregateUserData(targetUserId);

        // Apply adapters to normalise shapes
        const adapted = {
            profile: adapters.adaptProfile(raw.profile),
            communityPosts: adapters.adaptCommunityPosts(raw.communityPosts),
            businesses: adapters.adaptBusinesses(raw.businesses),
            complaints: adapters.adaptComplaints(raw.complaints),
        };

        if (format === 'csv') {
            const csv = csvFormatter.toCSV(adapted);
            reply.header('Content-Type', 'text/csv');
            reply.header('Content-Disposition', `attachment; filename="export-${targetUserId}.csv"`);
            return csv;
        }

        return { exportedAt: new Date().toISOString(), data: adapted };
    });
}

module.exports = openDataRoutes;
