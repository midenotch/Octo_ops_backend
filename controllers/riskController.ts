import { Request, Response } from 'express';
import { Risk, Project } from '../models/schemas';
import { detectProjectRisks } from '../services/geminiService';
import { io } from '../server';
import { updateProjectStats } from '../utils/projectUtils';

// Get all risks for a project
export const getRisks = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    
    const query = projectId ? { projectId } : {};
    const risks = await Risk.find(query)
      .populate('affectedTasks')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(risks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch risks' });
  }
};

// Create a new risk
export const createRisk = async (req: Request, res: Response) => {
  try {
    const risk = await Risk.create(req.body);
    const populatedRisk = await Risk.findById(risk._id)
      .populate('affectedTasks')
      .populate('resolvedBy', 'name email');
    
    if (risk.projectId) {
        await updateProjectStats(risk.projectId.toString());
    }
    
    res.status(201).json(populatedRisk);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create risk' });
  }
};

// Update a risk
export const updateRisk = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const risk = await Risk.findByIdAndUpdate(id, req.body, { new: true })
      .populate('affectedTasks')
      .populate('resolvedBy', 'name email');
    
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    
    res.json(risk);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update risk' });
  }
};

// Resolve a risk
export const resolveRisk = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    // Handle AI-detected risks which have custom string IDs
    if (typeof id === 'string' && id.startsWith('risk-')) {
      // Find the project to get the ID
      const project = await Project.findOne(); // MVP fallback
      if (project) {
          // Create a permanent record of this resolved AI risk
          await Risk.create({
              title: id.includes('overdue') ? 'Overdue Task Resolution' : 'AI Risk Mitigated',
              description: `Resolved AI-detected risk: ${id}`,
              severity: 'low',
              resolved: true,
              resolvedAt: new Date(),
              resolvedBy: userId,
              projectId: project._id,
              detectedBy: 'ai'
          });
          await updateProjectStats(project._id.toString());
      }

      return res.json({ 
        id, 
        resolved: true, 
        message: 'AI-detected risk resolved and persisted.' 
      });
    }
    
    const risk = await Risk.findByIdAndUpdate(
      id,
      {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId
      },
      { new: true }
    ).populate('affectedTasks').populate('resolvedBy', 'name email');
    
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    
    // Emit WebSocket event for real-time risk update
    if (risk.projectId) {
      io.to(`project:${risk.projectId}`).emit('risk-resolved', {
        projectId: risk.projectId,
        riskId: risk._id,
        risk: risk
      });
      await updateProjectStats(risk.projectId.toString());
    }
    
    res.json(risk);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve risk' });
  }
};

// AI-powered risk analysis
export const analyzeRisks = async (req: Request, res: Response) => {
  try {
    const { projectData } = req.body;
    
    const detectedRisks = await detectProjectRisks(projectData);
    
    // Save detected risks to database
    const savedRisks = [];
    for (const riskData of detectedRisks) {
      const risk = await Risk.create({
        ...riskData,
        projectId: projectData.projectId,
        detectedBy: 'ai'
      });
      savedRisks.push(risk);
    }
    
    if (projectData.projectId) {
        await updateProjectStats(projectData.projectId);
    }
    
    res.json(savedRisks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze risks' });
  }
};

// Delete a risk
export const deleteRisk = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const risk = await Risk.findByIdAndDelete(id);
    
    if (!risk) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    
    if (risk.projectId) {
        await updateProjectStats(risk.projectId.toString());
    }
    
    res.json({ message: 'Risk deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete risk' });
  }
};
