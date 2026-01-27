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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProjectStats = void 0;
const schemas_1 = require("../models/schemas");
const server_1 = require("../server");
const updateProjectStats = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const project = yield schemas_1.Project.findById(projectId);
        if (!project)
            return;
        const tasks = yield schemas_1.Task.find({ projectId });
        const risks = yield schemas_1.Risk.find({ projectId, resolved: false });
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
            if (r.severity === 'critical')
                score -= 10;
            else if (r.severity === 'high')
                score -= 5;
            else if (r.severity === 'medium')
                score -= 2;
        });
        project.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        project.milestonesCompleted = milestonesDone;
        project.totalMilestones = uniqueMilestones.length || project.totalMilestones;
        project.healthScore = Math.max(1, Math.min(100, Math.round(score)));
        yield project.save();
        // Notify clients
        server_1.io.to(`project:${projectId}`).emit('project-updated', {
            projectId,
            healthScore: project.healthScore,
            progress: project.progress
        });
        console.log(`[StatsUpdater] Updated project ${projectId}: Health ${project.healthScore}%, Progress ${project.progress}%`);
    }
    catch (err) {
        console.error(`[StatsUpdater] Failed to update stats for project ${projectId}`, err);
    }
});
exports.updateProjectStats = updateProjectStats;
