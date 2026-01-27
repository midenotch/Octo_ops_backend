import { Request, Response } from 'express';
import { Project, User, Task, Settings, Risk } from '../models/schemas';
import { io } from '../server';

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
                project.team.push(invitee._id.toString());
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
      res.status(404).json({ error: 'No project found' });
      return;
    }
    
    // Calculate progress and milestones based on tasks
    const tasks = await Task.find({ projectId: project._id });
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    
    // Calculate completed milestones
    const uniqueMilestones = Array.from(new Set(tasks.map(t => t.milestone).filter(Boolean)));
    let milestonesDone = 0;
    uniqueMilestones.forEach(m => {
        const milestoneTasks = tasks.filter(t => t.milestone === m);
        if (milestoneTasks.every(t => t.status === 'done')) {
            milestonesDone++;
        }
    });

    // AUTO-RISK AGENT LOGIC
    const autoRisks: any[] = [];
    const now = new Date();
    
    tasks.forEach(task => {
        if (!task.deadline) return;

        const deadline = new Date(task.deadline as any);
        const diffMs = deadline.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (task.status !== 'done') {
            if (diffMs < 0) {
                autoRisks.push({
                    id: `risk-overdue-${task._id}`,
                    title: `Overdue Task: ${task.title}`,
                    description: `Critical delay detected. Milestone integrity compromised.`,
                    severity: 'critical',
                    predictedImpact: 'Delayed project delivery',
                    detectedBy: 'ai',
                    resolved: false
                });
            } else if (diffHours < 24 && task.status === 'todo') {
                autoRisks.push({
                    id: `risk-deadline-${task._id}`,
                    title: `Immediate Deadline: ${task.title}`,
                    description: `Task in 'TODO' with less than 24h remaining.`,
                    severity: 'high',
                    predictedImpact: 'Increased pressure on QA window',
                    detectedBy: 'ai',
                    resolved: false
                });
            }
        }

        if (!task.assignee && task.priority === 'high') {
            autoRisks.push({
                id: `risk-unassigned-${task._id}`,
                title: 'High Priority Unassignment',
                description: `Critical mission unit '${task.title}' has no specialist assigned.`,
                severity: 'high',
                detectedBy: 'ai',
                resolved: false
            });
        }
    });

    // REAL HEALTH SCORE ALGORITHM
    let score = 100;
    const activeTasks = tasks.filter(t => t.status !== 'done').length;
    const overdueTasks = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < now.getTime()).length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
    
    // Impact of lack of progress (max -20)
    if (totalTasks > 0) {
        score -= (activeTasks / totalTasks) * 20;
    }
    
    // Impact of delays
    score -= (overdueTasks * 5);
    score -= (blockedTasks * 3);
    
    // Impact of risks (from manual risks)
    // autoRisks are calculated on the fly, but we should use DB risks too
    const dbRisks = await Risk.find({ projectId: project._id, resolved: false });
    dbRisks.forEach(r => {
        if (r.severity === 'critical') score -= 10;
        else if (r.severity === 'high') score -= 5;
        else if (r.severity === 'medium') score -= 2;
    });

    // Derived (On-the-fly) stats for the response
    const projectObj = (project.toObject ? project.toObject() : project) as any;
    projectObj.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    projectObj.milestonesCompleted = milestonesDone;
    projectObj.autoRisks = autoRisks;
    projectObj.healthScore = project.healthScore; // Use last persisted score
    
    res.json(projectObj);
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
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }
    
    const project = await Project.findByIdAndUpdate(
      projectId,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).populate('team');
    
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
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
      res.status(400).json({ error: 'User ID is required' });
      return;
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
// Archive/Complete Project
export const archiveProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }
    
    const project = await Project.findByIdAndUpdate(
      projectId,
      { status: 'archived', updatedAt: new Date() },
      { new: true }
    );
    
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    
    res.json(project);
  } catch (error) {
    console.error('Archive project error:', error);
    res.status(500).json({ error: 'Failed to archive project' });
  }
};
