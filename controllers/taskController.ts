import { Request, Response } from 'express';
import { Task, Project, User, Risk } from '../models/schemas';
import { io } from '../server';
import { updateProjectStats } from '../utils/projectUtils';

// Get All Tasks
export const getTasks = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    
    const query = projectId ? { projectId } : {};
    const tasks = await Task.find(query)
      .populate('assignee', 'name email avatar role')
      .populate('createdBy', 'name email')
      .populate('dependencies')
      .sort({ createdAt: -1 });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// Create Task
export const createTask = async (req: Request, res: Response) => {
  try {
    const taskData = req.body;
    
    // Get assignee name if assignee ID is provided
    if (taskData.assignee) {
      const assignee = await User.findById(taskData.assignee);
      if (assignee) {
        taskData.assigneeName = assignee.name;
      }
    }
    
    const task = await Task.create({
      ...taskData,
      updatedAt: new Date()
    });
    
    const populatedTask = await Task.findById(task._id)
      .populate('assignee', 'name email avatar role')
      .populate('createdBy', 'name email')
      .populate('dependencies');
    
    if (task.projectId) {
        await updateProjectStats(task.projectId.toString());
    }
    
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

// Update Task (Status/Assignee)
export const updateTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Update assignee name if assignee is being updated
    if (updates.assignee) {
      const assignee = await User.findById(updates.assignee);
      if (assignee) {
        updates.assigneeName = assignee.name;
      }
    }
    
    const existingTask = await Task.findById(id);
    if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
    }

    // Set timer if status changes to in-progress
    if (updates.status === 'in-progress' && existingTask.status !== 'in-progress' && !existingTask.timerStartedAt) {
        updates.timerStartedAt = new Date();
    }

    const task = await Task.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    )
      .populate('assignee', 'name email avatar role')
      .populate('createdBy', 'name email')
      .populate('reviewedBy', 'name email')
      .populate('dependencies');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (task.projectId) {
      io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
      await updateProjectStats(task.projectId.toString());
    }
    
    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

// Submit for Review
export const submitTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, description, attachments } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      id,
      { 
        status: status || 'in-review', 
        description,
        attachments,
        rejectionNote: null, // Clear on resubmission
        rejectionAttachments: [], // Clear on resubmission
        updatedAt: new Date() 
      },
      { new: true }
    )
      .populate('assignee', 'name email avatar role')
      .populate('createdBy', 'name email');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (task.projectId) {
      io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
      await updateProjectStats(task.projectId.toString());
    }
    
    res.json(task);
  } catch (error) {
    console.error('Submit task error:', error);
    res.status(500).json({ error: 'Failed to submit task' });
  }
};

// Approve Task
export const approveTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      id,
      { 
        status: 'done', 
        reviewedBy: userId,
        updatedAt: new Date() 
      },
      { new: true }
    )
      .populate('assignee', 'name email avatar role')
      .populate('createdBy', 'name email')
      .populate('reviewedBy', 'name email');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (task.projectId) {
      io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
      
      await Risk.updateMany(
        { affectedTasks: id, resolved: false },
        { resolved: true, resolvedAt: new Date(), resolvedBy: userId }
      );
      io.to(`project:${task.projectId}`).emit('risks-updated', { projectId: task.projectId });
      await updateProjectStats(task.projectId.toString());
    }
    
    res.json(task);
  } catch (error) {
    console.error('Approve task error:', error);
    res.status(500).json({ error: 'Failed to approve task' });
  }
};

// Reject Task
export const rejectTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rejectionNote, rejectionAttachments } = req.body;
    
    const task = await Task.findByIdAndUpdate(
      id,
      { 
        status: 'todo', 
        rejectionNote,
        rejectionAttachments,
        updatedAt: new Date() 
      },
      { new: true }
    )
      .populate('assignee', 'name email avatar role')
      .populate('createdBy', 'name email');
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (task.projectId) {
      io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
      await updateProjectStats(task.projectId.toString());
    }
    
    res.json(task);
  } catch (error) {
    console.error('Reject task error:', error);
    res.status(500).json({ error: 'Failed to reject task' });
  }
};

// Delete Task
export const deleteTask = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = await Task.findByIdAndDelete(id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (task.projectId) {
        await updateProjectStats(task.projectId.toString());
    }
    
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};
