import { Request, Response, RequestHandler } from 'express';
import { User, TeamInvite, Project, Task } from '../models/schemas';
import mongoose from 'mongoose';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';
import { io } from '../server';
import { matchTasksToRole } from '../services/geminiService';
import { assignInitialTasksToMember } from '../services/taskAssignmentService';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Get all team members for a project
export const getTeamMembers: RequestHandler = async (req, res) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }
    
    const project = await Project.findById(projectId).populate('team');
    
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    // Get pending invites
    const pendingInvites = await TeamInvite.find({
      projectId,
      status: 'pending'
    }).populate('invitedBy', 'name email');
    
    res.json({
      members: project.team,
      pendingInvites
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
};

// Invite a team member
export const inviteTeamMember: RequestHandler = async (req, res) => {
  try {
    const { email, role, projectId, invitedBy, name } = req.body;
    
    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      // Check if already in project
      const project = await Project.findById(projectId);
      if (project?.team.includes(user._id.toString())) {
        res.status(400).json({ error: 'User is already a team member' });
        return;
      }
    }
    
    // Generate unique invite code
    const inviteCode = crypto.randomBytes(16).toString('hex');
    
    // Map specific role to internal permission role + descriptive title
    const permissionRole = role.toLowerCase().includes('qa') || role.toLowerCase().includes('reviewer') ? 'qa' : 'member';
    const jobTitle = role;

    // Create invite
    const invite = await TeamInvite.create({
      email,
      name, // Save the full name
      role: permissionRole,
      title: jobTitle,
      projectId,
      invitedBy,
      inviteCode,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    });
    
    const populatedInvite = await TeamInvite.findById(invite._id)
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
            await sgMail.send(msg);
            console.log(`✓ Invite email sent to ${email} from ${fromEmail}`);
        } catch (emailError: any) {
            console.warn(`⚠ Email send failed (invite still created): ${emailError.message}`);
            // Don't throw - invite was created successfully, email is optional
        }
    } else {
        console.warn('⚠ SENDGRID_API_KEY not configured. Invite created but email not sent.');
    }
    
    res.status(201).json(populatedInvite);
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Failed to invite team member' });
  }
};

// Accept team invitation
export const acceptInvite: RequestHandler = async (req, res) => {
  try {
    const { inviteCode, userName } = req.body;
    
    let invite: any = null;
    let user: any = null;

    if (inviteCode === 'RE-SYNC') {
        console.log(`[ReSync] Manual trigger received for: ${userName}`);
        // In RE-SYNC mode, userName contains the email
        user = await User.findOne({ email: userName });
        if (!user) {
            return res.status(404).json({ error: 'User not found for re-sync' });
        }
        
        // Find the project this user belongs to
        const project = await Project.findOne({ team: user._id });
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
    } else {
        invite = await TeamInvite.findOne({ inviteCode, status: 'pending' });
        
        if (!invite) {
          res.status(404).json({ error: 'Invalid or expired invite code' });
          return;
        }
        
        // Check if expired
        if (invite.expiresAt && invite.expiresAt < new Date()) {
          invite.status = 'expired';
          await invite.save();
          res.status(400).json({ error: 'Invite code has expired' });
          return;
        }
        
        // Create or update user
        user = await User.findOne({ email: invite.email });
        
        if (!user) {
          user = await User.create({
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
        await Project.findByIdAndUpdate(invite.projectId, {
          $addToSet: { team: user._id }
        });
        
        // Update invite status
        invite.status = 'accepted';
        invite.acceptedAt = new Date();
        await invite.save();
    }
    
    // Auto-assign tasks using allocated service
    let assignedTasks: any[] = [];
    let projectTeamCount = 0;
    
    try {
        const project = await Project.findById(invite.projectId);
        if (project) {
            projectTeamCount = project.team.length;
            
            // Import dynamically or ensure it's imported at top, but for now assuming top import
            console.log(`[acceptInvite] Calling assignInitialTasksToMember for ${user.email}`);
            
            const result = await assignInitialTasksToMember({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role, 
                title: user.title
            }, invite.projectId);
            
            console.log(`[acceptInvite] Assignment result: ${result.assignedTasks?.length} tasks assigned.`);
            
            assignedTasks = result.assignedTasks;

            // Socket updates
            io.to(`project:${invite.projectId}`).emit('team-updated', {
              projectId: invite.projectId,
              newMember: user,
              teamCount: projectTeamCount,
              tasksAssigned: assignedTasks.length
            });
            
            if (assignedTasks.length > 0) {
              io.to(`project:${invite.projectId}`).emit('tasks-updated', {
                projectId: invite.projectId
              });
            }
        }
    } catch (assignError) {
        console.error("[AutoAssign] Critical skip - assignment failed:", assignError);
    }
    
    res.json({ 
      user, 
      message: 'Invitation accepted successfully', 
      tasksAssigned: assignedTasks.length,
      teamCount: projectTeamCount
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
};

// Remove team member
export const removeTeamMember: RequestHandler = async (req, res) => {
  try {
    const { userId, projectId } = req.body;

    const userToRemove = await User.findById(userId);
    
    if (userToRemove?.role === 'owner') {
      res.status(403).json({ error: 'The Project Owner role is permanent and cannot be removed.' });
      return;
    }

    if (userToRemove?.role === 'qa') {
      // Check if there are other QAs in the project
      const projectData = await Project.findById(projectId);
      const otherQAs = await User.countDocuments({ 
        _id: { $in: projectData?.team || [], $ne: userId as any }, 
        role: 'qa' 
      });

      if (otherQAs === 0) {
        res.status(403).json({ error: 'At least one active QA / Reviewer is required. Add another QA member before removing this one.' });
        return;
      }
    }
    
    // Remove user record to revoke login access
    await User.findByIdAndDelete(userId);
    
    const project = await Project.findByIdAndUpdate(
      projectId,
      { $pull: { team: userId } },
      { new: true }
    ).populate('team');
    
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    res.json(project.team);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove team member' });
  }
};

// Update member role
export const updateMemberRole: RequestHandler = async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    // Protection: Owner role is permanent
    const userToUpdate = await User.findById(userId);
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
         const project = await Project.findOne({ team: userId });
         if (project) {
            const otherQAs = await User.countDocuments({ 
                _id: { $in: project.team, $ne: userId as any }, 
                role: 'qa' 
            });
            if (otherQAs === 0) {
                res.status(403).json({ error: 'Cannot change role. At least one active QA / Reviewer is required for project validation.' });
                return;
            }
         }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        role: permissionRole,
        title: role // Use descriptive role as title
      },
      { new: true }
    );
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

// Cancel/Revoke invitation
export const cancelInvite: RequestHandler = async (req, res) => {
  try {
    const { inviteId } = req.params;
    
    const inviteToCheck = await TeamInvite.findById(inviteId);
    if (inviteToCheck?.role === 'qa') {
      // Check if there are other QAs (active in project or pending invites)
      const projectData = await Project.findById(inviteToCheck.projectId);
      const activeQAs = await User.countDocuments({ 
        _id: { $in: projectData?.team || [] }, 
        role: 'qa' 
      });
      const otherPendingQAs = await TeamInvite.countDocuments({
        projectId: inviteToCheck.projectId,
        role: 'qa',
        status: 'pending',
        _id: { $ne: inviteId as any }
      });

      if (activeQAs + otherPendingQAs === 0) {
        res.status(403).json({ error: 'At least one QA / Reviewer (active or pending) is required. Invite another QA before cancelling this invitation.' });
        return;
      }
    }

    const invite = await TeamInvite.findByIdAndUpdate(
      inviteId,
      { status: 'rejected' },
      { new: true }
    );
    
    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    
    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
};
