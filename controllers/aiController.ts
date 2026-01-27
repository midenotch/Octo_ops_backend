import { Request, Response } from 'express';
import { extractProjectFromImage, analyzeProjectHealth, generateTaskRecommendations, generateTeamAssembly, generateInitialTasks } from '../services/geminiService';
import { deleteUploadedFile } from '../middleware/upload';
import { Task, Risk, Project } from '../models/schemas';

// Extract project details from uploaded image
export const analyzeProjectImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    const imagePath = req.file.path;
    
    // Extract project information using Gemini AI
    const projectData = await extractProjectFromImage(imagePath);
    
    // Clean up uploaded file
    deleteUploadedFile(imagePath);
    
    res.json(projectData);
  } catch (error) {
    console.error('Image analysis error:', error);
    
    // Clean up file on error
    if (req.file) {
      deleteUploadedFile(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to analyze image' });
  }
};

// Calculate and update project health score
export const calculateHealthScore = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Fetch project data
    const project = await Project.findById(projectId).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const tasks = await Task.find({ projectId });
    const risks = await Risk.find({ projectId, resolved: false });
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
    const activeRisks = risks.length;
    
    // Calculate days to deadline
    let daysToDeadline = null;
    if (project.deadline) {
      const now = new Date();
      const deadline = new Date(project.deadline);
      daysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    const projectData = {
      name: project.name,
      totalTasks,
      completedTasks,
      blockedTasks,
      activeRisks,
      teamSize: project.team.length,
      daysToDeadline
    };
    
    // Use AI to analyze health
    const healthAnalysis = await analyzeProjectHealth(projectData);
    
    // Update project health score
    project.healthScore = healthAnalysis.healthScore;
    await project.save();
    
    res.json({
      ...healthAnalysis,
      project: {
        id: project._id,
        name: project.name,
        healthScore: project.healthScore
      }
    });
  } catch (error) {
    console.error('Health score calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate health score' });
  }
};

export const getTaskRecommendations = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const tasks = await Task.find({ projectId });
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    
    const projectData = {
      name: project.name,
      description: project.description,
      currentTasks: tasks.map(t => ({
        title: t.title,
        status: t.status,
        priority: t.priority
      })),
      completedTasks
    };
    
    const recommendations = await generateTaskRecommendations(projectData);
    
    res.json(recommendations);
  } catch (error) {
    console.error('Task recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate task recommendations' });
  }
};

// Generate AI-powered team assembly recommendations
export const getTeamAssemblyRecommendations = async (req: Request, res: Response) => {
  try {
    const { name, description, features, extractedText } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ error: 'Project name and description are required' });
    }
    
    const projectData = {
      name,
      description,
      features: features || [],
      extractedText: extractedText || ''
    };
    
    const recommendations = await generateTeamAssembly(projectData);
    
    res.json(recommendations);
  } catch (error) {
    console.error('Team assembly error:', error);
    res.status(500).json({ error: 'Failed to generate team recommendations' });
  }
};

// Generate initial tasks for project launch
export const generateProjectTasks = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const project = await Project.findById(projectId).populate('team');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get milestones from project settings or use defaults
    const milestones = [
      { name: 'Planning', description: 'Project setup and planning' },
      { name: 'Development', description: 'Core development phase' },
      { name: 'Testing', description: 'QA and testing' },
      { name: 'Deployment', description: 'Launch and deployment' }
    ];
    
    const projectData = {
      name: project.name,
      description: project.description || '',
      milestones,
      teamMembers: project.team || []
    };
    
    const aiTasks = await generateInitialTasks(projectData);
    
    // SAVE AND ASSIGN TASKS
    const createdTasks: any[] = [];
    
    // Find Project Owner
    const team = project.team as any[];
    const owner = team.find((m: any) => m.role === 'owner' || m.role === 'lead') || 
                  team.find((m: any) => m._id.toString() === project.ownerId?.toString()) ||
                  team[0];

    for (const aiTask of aiTasks) {
        // Try to match role (case insensitive)
        const suggestedRole = (aiTask.suggestedRole || '').toLowerCase();
        let assignee = team.find((m: any) => 
            m.role && (m.role.toLowerCase().includes(suggestedRole) || 
            suggestedRole.includes(m.role.toLowerCase()))
        );

        // Fallback to Owner if no role match
        if (!assignee) {
            assignee = owner;
        }

        const task = await Task.create({
            projectId: project._id,
            title: aiTask.title,
            description: aiTask.description,
            status: 'todo',
            priority: aiTask.priority || 'medium',
            milestone: aiTask.milestone,
            assignee: assignee?._id,
            assigneeName: assignee?.name,
            assigneeEmail: assignee?.email,
            deadline: new Date(Date.now() + (aiTask.estimatedDays || 3) * 24 * 60 * 60 * 1000),
            updatedAt: new Date()
        });
        createdTasks.push(task);
    }
    
    res.json(createdTasks);
  } catch (error) {
    console.error('Task generation error:', error);
    res.status(500).json({ error: 'Failed to generate and assign tasks' });
  }
};
