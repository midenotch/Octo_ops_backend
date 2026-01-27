import { Task, Project } from '../models/schemas';
import mongoose from 'mongoose';
import { matchTasksToRole } from './geminiService';

// Standard role keywords for fallback matching
const ROLE_KEYWORDS: Record<string, string[]> = {
    'frontend': ['frontend', 'ui', 'react', 'vue', 'angular', 'css', 'html', 'tailwind', 'client', 'design', 'style', 'component', 'interface'],
    'backend': ['backend', 'api', 'server', 'database', 'node', 'express', 'mongo', 'sql', 'auth', 'endpoint', 'middleware', 'data', 'schema'],
    'fullstack': ['fullstack', 'full-stack', 'full stack', 'web', 'application', 'feature', 'system', 'end-to-end'],
    'designer': ['design', 'ui', 'ux', 'figma', 'sketch', 'style', 'layout', 'asset', 'visual', 'prototype', 'wireframe'],
    'qa': ['test', 'qa', 'quality', 'bug', 'audit', 'verify', 'debug', 'e2e', 'cypress', 'jest', 'unit', 'coverage'],
    'devops': ['devops', 'deploy', 'ci/cd', 'docker', 'kubernetes', 'aws', 'cloud', 'infra', 'pipeline', 'monitor', 'log'],
    'mobile': ['mobile', 'ios', 'android', 'react native', 'flutter', 'app', 'native', 'screen'],
    'lead': ['manage', 'lead', 'coordinate', 'setup', 'plan', 'architecture', 'strategy', 'roadmap']
};

export const assignInitialTasksToMember = async (
    user: { _id: string; name: string; email: string; role: string; title?: string },
    projectId: string
) => {
    let assignedTasks: any[] = [];
    const maxAssignments = 3;

    try {
        console.log(`[AutoAssign] Starting assignment for ${user.name} (${user.role}) in project ${projectId}`);

        const project = await Project.findById(projectId);
        if (!project) {
            console.error(`[AutoAssign] Project ${projectId} not found.`);
            return { assignedTasks: [], message: 'Project not found.' };
        }

        const projectOwnerId = project.ownerId?.toString();
        console.log(`[AutoAssign] Querying Project ID: ${projectId}, Owner ID: ${projectOwnerId}`);
        
        const totalTasks = await Task.countDocuments({ projectId: new mongoose.Types.ObjectId(projectId) });
        console.log(`[AutoAssign] Project has ${totalTasks} total tasks.`);

        // 1. Find Unassigned Tasks (OR tasks assigned to Owner which are effectively "backlog")
        const unassignedQuery: any = {
            projectId: new mongoose.Types.ObjectId(projectId),
            $or: [
                { assignee: null },
                { assignee: { $exists: false } },
                { assignee: "" },
                { assignee: "null" },
                { assignee: "undefined" },
                { assignee: "none" },
                { assignee: "unassigned" }
            ],
            status: { $in: ['todo', 'in-progress'] }
        };

        if (projectOwnerId) {
            unassignedQuery.$or.push({ assignee: projectOwnerId });
        }

        const unassignedTasks = await Task.find(unassignedQuery);
        console.log(`[AutoAssign] Found ${unassignedTasks.length} candidates (including Owner's tasks).`);

        if (unassignedTasks.length === 0) {
            return { assignedTasks: [], message: 'No unassigned tasks available.' };
        }

        // 2. AI Semantic Matching
        let aiMatchedIds: string[] = [];
        try {
            aiMatchedIds = await matchTasksToRole(
                { role: user.role, title: user.title || user.role }, 
                unassignedTasks
            );
            console.log(`[AutoAssign] AI returned ${aiMatchedIds.length} matches.`);
        } catch (error) {
            console.error('[AutoAssign] AI matching error:', error);
            // Continue to keyword matching
        }

        // Apply AI matches
        for (const taskId of aiMatchedIds) {
            if (assignedTasks.length >= maxAssignments) break;
            
            const task = unassignedTasks.find(t => t._id.toString() === taskId.toString());
            if (task) {
                await assignTaskToUser(task, user);
                assignedTasks.push(task);
            }
        }

        // 3. Keyword Matching (Fallback)
        if (assignedTasks.length < maxAssignments) {
            console.log('[AutoAssign] Attempting keyword matching...');
            const userRoleLower = (user.role || '').toLowerCase();
            const userTitleLower = (user.title || '').toLowerCase();
            const combinedContext = `${userRoleLower} ${userTitleLower}`;

            // Determine best matching category
            let roleCategory = '';
            for (const [category, keywords] of Object.entries(ROLE_KEYWORDS)) {
                if (keywords.some(k => combinedContext.includes(k))) {
                    roleCategory = category;
                    break;
                }
            }

            if (roleCategory) {
                console.log(`[AutoAssign] User matched to category: ${roleCategory}`);
                const keywords = ROLE_KEYWORDS[roleCategory];

                for (const task of unassignedTasks) {
                    if (assignedTasks.length >= maxAssignments) break;
                    
                    // Skip if already assigned in this flow
                    if (assignedTasks.some(at => at._id.toString() === task._id.toString())) continue;

                    const title = (task.title || '').toLowerCase();
                    const desc = (task.description || '').toLowerCase();

                    if (keywords.some(k => title.includes(k) || desc.includes(k))) {
                        await assignTaskToUser(task, user);
                        assignedTasks.push(task);
                        console.log(`[AutoAssign] Keyword match: ${task.title}`);
                    }
                }
            } else {
                console.log('[AutoAssign] No specific role category matched for keywords.');
            }
        }

        console.log(`[AutoAssign] Completed. Assigned ${assignedTasks.length} tasks.`);
        return { assignedTasks };

    } catch (error) {
        console.error('[AutoAssign] Critical failure:', error);
        return { assignedTasks, error };
    }
};

async function assignTaskToUser(task: any, user: { _id: string; name: string; email: string }) {
    task.assignee = user._id.toString();
    task.assigneeName = user.name;
    task.assigneeEmail = user.email;
    await task.save();
}
