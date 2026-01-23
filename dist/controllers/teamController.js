"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelInvite = exports.updateMemberRole = exports.removeTeamMember = exports.acceptInvite = exports.inviteTeamMember = exports.getTeamMembers = void 0;
const schemas_1 = require("../models/schemas");
const crypto_1 = __importDefault(require("crypto"));
// Get all team members for a project
const getTeamMembers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const project = yield schemas_1.Project.findById(projectId).populate('team');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        // Get pending invites
        const pendingInvites = yield schemas_1.TeamInvite.find({
            projectId,
            status: 'pending'
        }).populate('invitedBy', 'name email');
        res.json({
            members: project.team,
            pendingInvites
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});
exports.getTeamMembers = getTeamMembers;
// Invite a team member
const inviteTeamMember = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, role, projectId, invitedBy } = req.body;
        // Check if user already exists
        let user = yield schemas_1.User.findOne({ email });
        if (user) {
            // Check if already in project
            const project = yield schemas_1.Project.findById(projectId);
            if (project === null || project === void 0 ? void 0 : project.team.includes(user._id)) {
                return res.status(400).json({ error: 'User is already a team member' });
            }
        }
        // Generate unique invite code
        const inviteCode = crypto_1.default.randomBytes(16).toString('hex');
        // Create invite
        const invite = yield schemas_1.TeamInvite.create({
            email,
            role,
            projectId,
            invitedBy,
            inviteCode,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });
        const populatedInvite = yield schemas_1.TeamInvite.findById(invite._id)
            .populate('invitedBy', 'name email');
        // TODO: Send email with invite code
        res.status(201).json(populatedInvite);
    }
    catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: 'Failed to invite team member' });
    }
});
exports.inviteTeamMember = inviteTeamMember;
// Accept team invitation
const acceptInvite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { inviteCode, userName } = req.body;
        const invite = yield schemas_1.TeamInvite.findOne({ inviteCode, status: 'pending' });
        if (!invite) {
            return res.status(404).json({ error: 'Invalid or expired invite code' });
        }
        // Check if expired
        if (invite.expiresAt && invite.expiresAt < new Date()) {
            invite.status = 'expired';
            yield invite.save();
            return res.status(400).json({ error: 'Invite code has expired' });
        }
        // Create or update user
        let user = yield schemas_1.User.findOne({ email: invite.email });
        if (!user) {
            user = yield schemas_1.User.create({
                name: userName || invite.email.split('@')[0],
                email: invite.email,
                role: invite.role,
                status: 'active',
                invitedBy: invite.invitedBy,
                invitedAt: invite.createdAt,
                acceptedAt: new Date(),
                avatar: invite.role === 'qa' ? '👩‍🎨' : '👨‍💻'
            });
        }
        // Add user to project team
        yield schemas_1.Project.findByIdAndUpdate(invite.projectId, {
            $addToSet: { team: user._id }
        });
        // Update invite status
        invite.status = 'accepted';
        invite.acceptedAt = new Date();
        yield invite.save();
        res.json({ user, message: 'Invitation accepted successfully' });
    }
    catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({ error: 'Failed to accept invitation' });
    }
});
exports.acceptInvite = acceptInvite;
// Remove team member
const removeTeamMember = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, projectId } = req.body;
        const project = yield schemas_1.Project.findByIdAndUpdate(projectId, { $pull: { team: userId } }, { new: true }).populate('team');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project.team);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to remove team member' });
    }
});
exports.removeTeamMember = removeTeamMember;
// Update member role
const updateMemberRole = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, role } = req.body;
        const user = yield schemas_1.User.findByIdAndUpdate(userId, { role }, { new: true });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update member role' });
    }
});
exports.updateMemberRole = updateMemberRole;
// Cancel/Revoke invitation
const cancelInvite = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { inviteId } = req.params;
        const invite = yield schemas_1.TeamInvite.findByIdAndUpdate(inviteId, { status: 'rejected' }, { new: true });
        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }
        res.json({ message: 'Invitation cancelled successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to cancel invitation' });
    }
});
exports.cancelInvite = cancelInvite;
