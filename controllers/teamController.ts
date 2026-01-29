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

export const inviteTeamMember: RequestHandler = async (req, res) => {
  try {
    const { email, role, projectId, invitedBy, name } = req.body;
    
    let user = await User.findOne({ email });
    
    if (user) {
      const project = await Project.findById(projectId);
      if (project?.team.includes(user._id.toString())) {
        res.status(400).json({ error: 'User is already a team member' });
        return;
      }
    }
    
    const inviteCode = crypto.randomBytes(16).toString('hex');
    
    const permissionRole = role.toLowerCase().includes('qa') || role.toLowerCase().includes('reviewer') ? 'qa' : 'member';
    const jobTitle = role;

    const invite = await TeamInvite.create({
      email,
      name, 
      role: permissionRole,
      title: jobTitle,
      projectId,
      invitedBy,
      inviteCode,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
    });
    
    const populatedInvite = await TeamInvite.findById(invite._id)
      .populate('invitedBy', 'name email');
    
    if (process.env.SENDGRID_API_KEY) {
        try {
            const FRONTEND_URL = process.env.FRONTEND_URL || 'https://octo-ops.vercel.app';
            const inviteLink = `${FRONTEND_URL}/login?mode=member&code=${inviteCode}`;
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

export const acceptInvite: RequestHandler = async (req, res) => {
  try {
    const { inviteCode, userName } = req.body;
    
    let invite: any = null;
    let user: any = null;

    if (inviteCode === 'RE-SYNC') {
        console.log(`[ReSync] Manual trigger received for: ${userName}`);
        user = await User.findOne({ email: userName });
        if (!user) {
            return res.status(404).json({ error: 'User not found for re-sync' });
        }
        
        const project = await Project.findOne({ team: user._id });
        if (!project) {
            return res.status(404).json({ error: 'Project context not found for re-sync' });
        }

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
        
        if (invite.expiresAt && invite.expiresAt < new Date()) {
          invite.status = 'expired';
          await invite.save();
          res.status(400).json({ error: 'Invite code has expired' });
          return;
        }
        
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
        
        await Project.findByIdAndUpdate(invite.projectId, {
          $addToSet: { team: user._id }
        });
        
        invite.status = 'accepted';
        invite.acceptedAt = new Date();
        await invite.save();
    }
    
    let assignedTasks: any[] = [];
    let projectTeamCount = 0;
    
    try {
        const project = await Project.findById(invite.projectId);
        if (project) {
            projectTeamCount = project.team.length;
            
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

export const removeTeamMember: RequestHandler = async (req, res) => {
  try {
    const { userId, projectId } = req.body;

    const userToRemove = await User.findById(userId);
    
    if (userToRemove?.role === 'owner') {
      res.status(403).json({ error: 'The Project Owner role is permanent and cannot be removed.' });
      return;
    }

    if (userToRemove?.role === 'qa') {
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

export const updateMemberRole: RequestHandler = async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
        res.status(404).json({ error: 'User not found' });
        return;
    }

    if (userToUpdate.role === 'owner') {
         res.status(403).json({ error: 'The Project Owner role cannot be changed.' });
         return;
    }

    const permissionRole = (role || '').toLowerCase().includes('qa') ? 'qa' : 'member';
    
    if (userToUpdate.role === 'qa' && permissionRole !== 'qa') {
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
        title: role 
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

export const cancelInvite: RequestHandler = async (req, res) => {
  try {
    const { inviteId } = req.params;
    
    const inviteToCheck = await TeamInvite.findById(inviteId);
    if (inviteToCheck?.role === 'qa') {
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
