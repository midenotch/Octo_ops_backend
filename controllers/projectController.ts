import { Request, Response } from 'express';
import { Project, User, Task, Settings } from '../models/schemas';

// Create Project (Onboarding)
export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description, deadline, totalMilestones, ownerId, invites } = req.body;

    const project = await Project.create({
        name,
        description,
        totalMilestones: totalMilestones || 0,
        deadline,
        ownerId,
        team: [ownerId] // Owner is first member
    });

    // Create default settings for project
    await Settings.create({ projectId: project._id });

    // Process Invites (Create placeholder users)
    if (invites && invites.length > 0) {
        for (const invite of invites) {
            if (invite.email) {
                // Check if user exists, else create placeholder
                let invitee = await User.findOne({ email: invite.email });
                if (!invitee) {
                    invitee = await User.create({
                        name: invite.email.split('@')[0],
                        email: invite.email,
                        role: invite.role,
                        status: 'invited',
                        invitedBy: ownerId,
                        invitedAt: new Date(),
                        avatar: '👤'
                    });
                }
                project.team.push(invitee._id);
            }
        }
        await project.save();
    }

    const populatedProject = await Project.findById(project._id).populate('team');
    res.status(201).json(populatedProject);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

// Get Project Details
export const getProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    
    let project;
    if (projectId) {
      project = await Project.findById(projectId).populate('team');
    } else {
      // Get latest project for MVP
      project = await Project.findOne().populate('team').sort({ createdAt: -1 });
    }
    
    if (!project) {
      return res.status(404).json({ error: 'No project found' });
    }
    
    // Calculate progress and milestones based on tasks
    const tasks = await Task.find({ projectId: project._id });
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    
    // Calculate completed milestones
    const uniqueMilestones = [...new Set(tasks.map(t => t.milestone).filter(Boolean))];
    let milestonesDone = 0;
    uniqueMilestones.forEach(m => {
        const milestoneTasks = tasks.filter(t => t.milestone === m);
        if (milestoneTasks.every(t => t.status === 'done')) {
            milestonesDone++;
        }
    });

    project.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    project.milestonesCompleted = milestonesDone;
    project.totalMilestones = uniqueMilestones.length || project.totalMilestones;
    await project.save();
    
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// Update Project
export const updateProject = async (req: Request, res: Response) => {
  try {
    const { projectId, ...updates } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const project = await Project.findByIdAndUpdate(
      projectId,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).populate('team');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

// Get all projects for a user
export const getUserProjects = async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const projects = await Project.find({
      $or: [
        { ownerId: userId },
        { team: userId }
      ]
    }).populate('team').sort({ createdAt: -1 });
    
    res.json(projects);
  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};
