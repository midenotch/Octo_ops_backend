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
const mail_1 = __importDefault(require("@sendgrid/mail"));
const server_1 = require("../server");
const taskAssignmentService_1 = require("../services/taskAssignmentService");
if (process.env.SENDGRID_API_KEY) {
    mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
}
// Get all team members for a project
const getTeamMembers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }
        const project = yield schemas_1.Project.findById(projectId).populate('team');
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
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
        const { email, role, projectId, invitedBy, name } = req.body;
        // Check if user already exists
        let user = yield schemas_1.User.findOne({ email });
        if (user) {
            // Check if already in project
            const project = yield schemas_1.Project.findById(projectId);
            if (project === null || project === void 0 ? void 0 : project.team.includes(user._id.toString())) {
                res.status(400).json({ error: 'User is already a team member' });
                return;
            }
        }
        // Generate unique invite code
        const inviteCode = crypto_1.default.randomBytes(16).toString('hex');
        // Map specific role to internal permission role + descriptive title
        const permissionRole = role.toLowerCase().includes('qa') || role.toLowerCase().includes('reviewer') ? 'qa' : 'member';
        const jobTitle = role;
        // Create invite
        const invite = yield schemas_1.TeamInvite.create({
            email,
            name, // Save the full name
            role: permissionRole,
            title: jobTitle,
            projectId,
            invitedBy,
            inviteCode,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        const populatedInvite = yield schemas_1.TeamInvite.findById(invite._id)
            .populate('invitedBy', 'name email');
        // Send Email via SendGrid (optional - don't fail invite if email fails)
        if (process.env.SENDGRID_API_KEY) {
            try {
                const inviteLink = `http://localhost:3000/login?mode=member&code=${inviteCode}` || `https://octo-ops.vercel.app/login?mode=member&code=${inviteCode}`;
                const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@octoops.ai';
                const msg = {
                    to: email,
                    from: fromEmail,
                    subject: `You've been invited to join ${name || 'a project'} on OctoOps`,
                    html: `
                <div style="font-family: sans-serif; padding: 20px; background: #0A0E27; color: #E8F0FF;">
                  <h1 style="color: #00F0FF;">Welcome to the Mission</h1>
                  <p>You have been selected to join the team as a <strong>${role}</strong>.</p>
                  <p>Your expertise is required for immediate deployment.</p>
                  <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #00FF88; color: #0A0E27; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 10px;">Accept Mission & Login</a>
                  <p style="margin-top: 20px; font-size: 12px; color: #8B9DC3;">Invite Code: ${inviteCode}</p>
                </div>
              `,
                };
                yield mail_1.default.send(msg);
                console.log(`✓ Invite email sent to ${email} from ${fromEmail}`);
            }
            catch (emailError) {
                console.warn(`⚠ Email send failed (invite still created): ${emailError.message}`);
                // Don't throw - invite was created successfully, email is optional
            }
        }
        else {
            console.warn('⚠ SENDGRID_API_KEY not configured. Invite created but email not sent.');
        }
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
    var _a;
    try {
        const { inviteCode, userName } = req.body;
        let invite = null;
        let user = null;
        if (inviteCode === 'RE-SYNC') {
            console.log(`[ReSync] Manual trigger received for: ${userName}`);
            // In RE-SYNC mode, userName contains the email
            user = yield schemas_1.User.findOne({ email: userName });
            if (!user) {
                return res.status(404).json({ error: 'User not found for re-sync' });
            }
            // Find the project this user belongs to
            const project = yield schemas_1.Project.findOne({ team: user._id });
            if (!project) {
                return res.status(404).json({ error: 'Project context not found for re-sync' });
            }
            // Create a mock invite object for the logic below to reuse
            invite = {
                projectId: project._id,
                role: user.role,
                title: user.title,
                email: user.email,
                status: 'accepted'
            };
        }
        else {
            invite = yield schemas_1.TeamInvite.findOne({ inviteCode, status: 'pending' });
            if (!invite) {
                res.status(404).json({ error: 'Invalid or expired invite code' });
                return;
            }
            // Check if expired
            if (invite.expiresAt && invite.expiresAt < new Date()) {
                invite.status = 'expired';
                yield invite.save();
                res.status(400).json({ error: 'Invite code has expired' });
                return;
            }
            // Create or update user
            user = yield schemas_1.User.findOne({ email: invite.email });
            if (!user) {
                user = yield schemas_1.User.create({
                    name: invite.name || userName || invite.email.split('@')[0],
                    email: invite.email,
                    role: invite.role,
                    title: invite.title,
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
        }
        // Auto-assign tasks using allocated service
        let assignedTasks = [];
        let projectTeamCount = 0;
        try {
            const project = yield schemas_1.Project.findById(invite.projectId);
            if (project) {
                projectTeamCount = project.team.length;
                // Import dynamically or ensure it's imported at top, but for now assuming top import
                console.log(`[acceptInvite] Calling assignInitialTasksToMember for ${user.email}`);
                const result = yield (0, taskAssignmentService_1.assignInitialTasksToMember)({
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    title: user.title
                }, invite.projectId);
                console.log(`[acceptInvite] Assignment result: ${(_a = result.assignedTasks) === null || _a === void 0 ? void 0 : _a.length} tasks assigned.`);
                assignedTasks = result.assignedTasks;
                // Socket updates
                server_1.io.to(`project:${invite.projectId}`).emit('team-updated', {
                    projectId: invite.projectId,
                    newMember: user,
                    teamCount: projectTeamCount,
                    tasksAssigned: assignedTasks.length
                });
                if (assignedTasks.length > 0) {
                    server_1.io.to(`project:${invite.projectId}`).emit('tasks-updated', {
                        projectId: invite.projectId
                    });
                }
            }
        }
        catch (assignError) {
            console.error("[AutoAssign] Critical skip - assignment failed:", assignError);
        }
        res.json({
            user,
            message: 'Invitation accepted successfully',
            tasksAssigned: assignedTasks.length,
            teamCount: projectTeamCount
        });
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
        const userToRemove = yield schemas_1.User.findById(userId);
        if ((userToRemove === null || userToRemove === void 0 ? void 0 : userToRemove.role) === 'owner') {
            res.status(403).json({ error: 'The Project Owner role is permanent and cannot be removed.' });
            return;
        }
        if ((userToRemove === null || userToRemove === void 0 ? void 0 : userToRemove.role) === 'qa') {
            // Check if there are other QAs in the project
            const projectData = yield schemas_1.Project.findById(projectId);
            const otherQAs = yield schemas_1.User.countDocuments({
                _id: { $in: (projectData === null || projectData === void 0 ? void 0 : projectData.team) || [], $ne: userId },
                role: 'qa'
            });
            if (otherQAs === 0) {
                res.status(403).json({ error: 'At least one active QA / Reviewer is required. Add another QA member before removing this one.' });
                return;
            }
        }
        // Remove user record to revoke login access
        yield schemas_1.User.findByIdAndDelete(userId);
        const project = yield schemas_1.Project.findByIdAndUpdate(projectId, { $pull: { team: userId } }, { new: true }).populate('team');
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
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
        // Protection: Owner role is permanent
        const userToUpdate = yield schemas_1.User.findById(userId);
        if (!userToUpdate) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        if (userToUpdate.role === 'owner') {
            res.status(403).json({ error: 'The Project Owner role cannot be changed.' });
            return;
        }
        // Map descriptive role to permission role
        const permissionRole = (role || '').toLowerCase().includes('qa') ? 'qa' : 'member';
        // Protection: If changing a QA user to something else, ensure another QA exists
        if (userToUpdate.role === 'qa' && permissionRole !== 'qa') {
            // Find all projects where this user is a team member
            const project = yield schemas_1.Project.findOne({ team: userId });
            if (project) {
                const otherQAs = yield schemas_1.User.countDocuments({
                    _id: { $in: project.team, $ne: userId },
                    role: 'qa'
                });
                if (otherQAs === 0) {
                    res.status(403).json({ error: 'Cannot change role. At least one active QA / Reviewer is required for project validation.' });
                    return;
                }
            }
        }
        const user = yield schemas_1.User.findByIdAndUpdate(userId, {
            role: permissionRole,
            title: role // Use descriptive role as title
        }, { new: true });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
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
        const inviteToCheck = yield schemas_1.TeamInvite.findById(inviteId);
        if ((inviteToCheck === null || inviteToCheck === void 0 ? void 0 : inviteToCheck.role) === 'qa') {
            // Check if there are other QAs (active in project or pending invites)
            const projectData = yield schemas_1.Project.findById(inviteToCheck.projectId);
            const activeQAs = yield schemas_1.User.countDocuments({
                _id: { $in: (projectData === null || projectData === void 0 ? void 0 : projectData.team) || [] },
                role: 'qa'
            });
            const otherPendingQAs = yield schemas_1.TeamInvite.countDocuments({
                projectId: inviteToCheck.projectId,
                role: 'qa',
                status: 'pending',
                _id: { $ne: inviteId }
            });
            if (activeQAs + otherPendingQAs === 0) {
                res.status(403).json({ error: 'At least one QA / Reviewer (active or pending) is required. Invite another QA before cancelling this invitation.' });
                return;
            }
        }
        const invite = yield schemas_1.TeamInvite.findByIdAndUpdate(inviteId, { status: 'rejected' }, { new: true });
        if (!invite) {
            res.status(404).json({ error: 'Invite not found' });
            return;
        }
        res.json({ message: 'Invitation cancelled successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to cancel invitation' });
    }
});
exports.cancelInvite = cancelInvite;
