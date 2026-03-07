/**
 * Peer Grouping Lambda – groups.js
 * Peer group CRUD and membership management.
 */

const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

function isMissingTableError(err) {
    return err?.name === 'ResourceNotFoundException' || /non-existent table|not found/i.test(String(err?.message || ''));
}

/**
 * Create a new peer group.
 */
async function createGroup({ name, description, goals, category, language, location, creatorUserId }) {
    const groupId = uuidv4();
    const now = new Date().toISOString();

    const group = {
        groupId,
        name,
        description,
        goals: goals || [],
        category: category || 'general',
        language: language || 'hi',
        location: location || {},
        members: [{
            userId: creatorUserId,
            displayName: 'Creator',
            role: 'admin',
            joinedAt: now,
        }],
        maxMembers: 20,
        activityScore: 50,
        clusteringReason: 'Manually created',
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.PEER_GROUPS,
        Item: group,
    }));

    return group;
}

/**
 * Create a group from AI clustering results.
 */
async function createGroupFromClustering(clusterData, creatorUserId) {
    const groupId = uuidv4();
    const now = new Date().toISOString();

    const members = (clusterData.memberUserIds || []).map(uid => ({
        userId: uid,
        displayName: '',
        role: uid === creatorUserId ? 'admin' : 'member',
        joinedAt: now,
    }));

    // Ensure creator is in the group
    if (!members.find(m => m.userId === creatorUserId)) {
        members.unshift({
            userId: creatorUserId,
            displayName: '',
            role: 'admin',
            joinedAt: now,
        });
    }

    const group = {
        groupId,
        name: clusterData.name || 'Learning Group',
        description: clusterData.description || '',
        goals: clusterData.goals || [],
        category: clusterData.goals?.[0] || 'general',
        language: 'hi',
        location: {},
        members,
        maxMembers: 20,
        activityScore: Math.round((clusterData.matchScore || 0.5) * 100),
        clusteringReason: clusterData.reason || 'AI-generated group',
        isActive: true,
        createdAt: now,
        updatedAt: now,
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.PEER_GROUPS,
        Item: group,
    }));

    return group;
}

/**
 * Get group by ID.
 */
async function getGroupById(groupId) {
    try {
        const result = await dynamoDB.send(new GetCommand({
            TableName: TABLE_NAMES.PEER_GROUPS,
            Key: { groupId },
        }));
        return result.Item || null;
    } catch (err) {
        if (isMissingTableError(err)) return null;
        throw err;
    }
}

/**
 * Get all groups a user belongs to.
 */
async function getUserGroups(userId) {
    try {
        // Since members is a list attribute, we need to scan
        // In production, use a separate UserGroups table or GSI
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAMES.PEER_GROUPS,
            FilterExpression: 'isActive = :active',
            ExpressionAttributeValues: { ':active': true },
        }));

        const userGroups = (result.Items || []).filter(group =>
            group.members?.some(m => m.userId === userId)
        );

        return userGroups;
    } catch (err) {
        if (isMissingTableError(err)) return [];
        throw err;
    }
}

/**
 * List all active groups for discovery.
 */
async function listGroups() {
    try {
        const result = await dynamoDB.send(new ScanCommand({
            TableName: TABLE_NAMES.PEER_GROUPS,
            FilterExpression: 'isActive = :active',
            ExpressionAttributeValues: { ':active': true },
        }));

        return (result.Items || [])
            .map(group => ({
                ...group,
                member_count: Array.isArray(group.members) ? group.members.length : Number(group.member_count || 0),
            }))
            .sort((a, b) => {
                const scoreDiff = Number(b.activityScore || 0) - Number(a.activityScore || 0);
                if (scoreDiff !== 0) return scoreDiff;
                return Number(b.member_count || 0) - Number(a.member_count || 0);
            });
    } catch (err) {
        if (isMissingTableError(err)) return [];
        throw err;
    }
}

/**
 * Join an existing group.
 */
async function joinGroup(groupId, userId, displayName = '') {
    const group = await getGroupById(groupId);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    if (!group.isActive) throw new Error('GROUP_INACTIVE');

    const isMember = group.members?.some(m => m.userId === userId);
    if (isMember) throw new Error('ALREADY_MEMBER');

    if ((group.members?.length || 0) >= group.maxMembers) {
        throw new Error('GROUP_FULL');
    }

    const newMember = {
        userId,
        displayName,
        role: 'member',
        joinedAt: new Date().toISOString(),
    };

    await dynamoDB.send(new UpdateCommand({
        TableName: TABLE_NAMES.PEER_GROUPS,
        Key: { groupId },
        UpdateExpression: 'SET members = list_append(members, :newMember), updatedAt = :now',
        ExpressionAttributeValues: {
            ':newMember': [newMember],
            ':now': new Date().toISOString(),
        },
    }));

    return { ...group, members: [...(group.members || []), newMember] };
}

/**
 * Leave a group.
 */
async function leaveGroup(groupId, userId) {
    const group = await getGroupById(groupId);
    if (!group) throw new Error('GROUP_NOT_FOUND');

    const memberIndex = group.members?.findIndex(m => m.userId === userId);
    if (memberIndex === -1 || memberIndex === undefined) {
        throw new Error('NOT_A_MEMBER');
    }

    await dynamoDB.send(new UpdateCommand({
        TableName: TABLE_NAMES.PEER_GROUPS,
        Key: { groupId },
        UpdateExpression: `REMOVE members[${memberIndex}] SET updatedAt = :now`,
        ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));

    return { success: true, groupId };
}

module.exports = {
    createGroup,
    createGroupFromClustering,
    getGroupById,
    listGroups,
    getUserGroups,
    joinGroup,
    leaveGroup,
};
