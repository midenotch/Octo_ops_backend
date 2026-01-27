import { Project, Task, Risk } from '../models/schemas';
import { io } from '../server';

export const updateProjectStats = async (projectId: string) => {
    try {
        const project = await Project.findById(projectId);
        if (!project) return;

        const tasks = await Task.find({ projectId });
        const risks = await Risk.find({ projectId, resolved: false });
        
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const overdueTasks = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < Date.now()).length;
        const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

        // Milestones
        const uniqueMilestones = Array.from(new Set(tasks.map(t => t.milestone).filter(Boolean)));
        let milestonesDone = 0;
        uniqueMilestones.forEach(m => {
            const milestoneTasks = tasks.filter(t => t.milestone === m);
            if (milestoneTasks.every(t => t.status === 'done')) {
                milestonesDone++;
            }
        });

        // Health Score
        let score = 100;
        const activeTasks = tasks.filter(t => t.status !== 'done').length;
        
        if (totalTasks > 0) {
            score -= (activeTasks / totalTasks) * 20;
        }
        score -= (overdueTasks * 5);
        score -= (blockedTasks * 3);
        
        risks.forEach(r => {
            if (r.severity === 'critical') score -= 10;
            else if (r.severity === 'high') score -= 5;
            else if (r.severity === 'medium') score -= 2;
        });

        project.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        project.milestonesCompleted = milestonesDone;
        project.totalMilestones = uniqueMilestones.length || project.totalMilestones;
        project.healthScore = Math.max(1, Math.min(100, Math.round(score)));
        
        await project.save();

        // Notify clients
        io.to(`project:${projectId}`).emit('project-updated', { 
            projectId, 
            healthScore: project.healthScore,
            progress: project.progress
        });

        console.log(`[StatsUpdater] Updated project ${projectId}: Health ${project.healthScore}%, Progress ${project.progress}%`);
    } catch (err) {
        console.error(`[StatsUpdater] Failed to update stats for project ${projectId}`, err);
    }
};
