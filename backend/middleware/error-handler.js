/**
 * Centralized error handler for Fastify.
 */

function errorHandler(error, request, reply) {
    request.log.error({ err: error, url: request.url, method: request.method }, 'Request error');

    // Known business errors
    const knownErrors = {
        BUYER_ALREADY_REGISTERED: { status: 400, message: 'Already registered as buyer' },
        LISTING_NOT_AVAILABLE: { status: 400, message: 'Listing is not available' },
        GROUP_NOT_FOUND: { status: 404, message: 'Group not found' },
        GROUP_CLOSED: { status: 400, message: 'Group is no longer accepting members' },
        ALREADY_MEMBER: { status: 400, message: 'Already a member of this group' },
        GROUP_FULL: { status: 400, message: 'Group has reached maximum capacity' },
        GROUP_INACTIVE: { status: 400, message: 'Group is no longer active' },
        NOT_A_MEMBER: { status: 400, message: 'Not a member of this group' },
        USER_PROFILE_NOT_FOUND: { status: 404, message: 'User learning profile not found' },
    };

    const known = knownErrors[error.message];
    if (known) {
        return reply.status(known.status).send({ error: known.message });
    }

    // Fastify validation errors
    if (error.validation) {
        return reply.status(400).send({
            error: 'Validation error',
            details: error.validation.map(v => v.message),
        });
    }

    // Database errors
    if (error.code && error.code.startsWith('23')) {
        return reply.status(400).send({
            error: 'Database constraint violation',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
        });
    }

    // Default 500
    reply.status(error.statusCode || error.status || 500).send({
        error: error.statusCode || error.status ? error.message : 'Internal server error',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
}

module.exports = { errorHandler };
