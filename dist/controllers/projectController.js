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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.archiveProject = exports.getUserProjects = exports.updateProject = exports.getProject = exports.createProject = void 0;
const schemas_1 = require("../models/schemas");
// Create Project (Onboarding)
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, deadline, totalMilestones, ownerId, invites } = req.body;
        const project = yield schemas_1.Project.create({
            name,
            description,
            totalMilestones: totalMilestones || 0,
            deadline,
            ownerId,
            team: [ownerId]
        });
        yield schemas_1.Settings.create({ projectId: project._id });
        if (invites && invites.length > 0) {
            for (const invite of invites) {
                if (invite.email) {
                    let invitee = yield schemas_1.User.findOne({ email: invite.email });
                    if (!invitee) {
                        invitee = yield schemas_1.User.create({
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
            yield project.save();
        }
        const populatedProject = yield schemas_1.Project.findById(project._id).populate('team');
        res.status(201).json(populatedProject);
    }
    catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});
exports.createProject = createProject;
// Get Project Details
const getProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.query;
        let project;
        if (projectId) {
            project = yield schemas_1.Project.findById(projectId).populate('team');
        }
        else {
            // Get latest project for MVP
            project = yield schemas_1.Project.findOne().populate('team').sort({ createdAt: -1 });
        }
        if (!project) {
            res.status(404).json({ error: 'No project found' });
            return;
        }
        // Calculate progress and milestones based on tasks
        const tasks = yield schemas_1.Task.find({ projectId: project._id });
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
        const autoRisks = [];
        const now = new Date();
        tasks.forEach(task => {
            if (!task.deadline)
                return;
            const deadline = new Date(task.deadline);
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
                }
                else if (diffHours < 24 && task.status === 'todo') {
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
        const dbRisks = yield schemas_1.Risk.find({ projectId: project._id, resolved: false });
        dbRisks.forEach(r => {
            if (r.severity === 'critical')
                score -= 10;
            else if (r.severity === 'high')
                score -= 5;
            else if (r.severity === 'medium')
                score -= 2;
        });
        // Derived (On-the-fly) stats for the response
        const projectObj = (project.toObject ? project.toObject() : project);
        projectObj.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        projectObj.milestonesCompleted = milestonesDone;
        projectObj.autoRisks = autoRisks;
        projectObj.healthScore = project.healthScore;
        res.json(projectObj);
    }
    catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});
exports.getProject = getProject;
// Update Project
const updateProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const _a = req.body, { projectId } = _a, updates = __rest(_a, ["projectId"]);
        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }
        const project = yield schemas_1.Project.findByIdAndUpdate(projectId, Object.assign(Object.assign({}, updates), { updatedAt: new Date() }), { new: true }).populate('team');
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json(project);
    }
    catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});
exports.updateProject = updateProject;
// Get all projects for a user
const getUserProjects = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId } = req.query;
        if (!userId) {
            res.status(400).json({ error: 'User ID is required' });
            return;
        }
        const projects = yield schemas_1.Project.find({
            $or: [
                { ownerId: userId },
                { team: userId }
            ]
        }).populate('team').sort({ createdAt: -1 });
        res.json(projects);
    }
    catch (error) {
        console.error('Get user projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});
exports.getUserProjects = getUserProjects;
// Archive/Complete Project
const archiveProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }
        const project = yield schemas_1.Project.findByIdAndUpdate(projectId, { status: 'archived', updatedAt: new Date() }, { new: true });
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json(project);
    }
    catch (error) {
        console.error('Archive project error:', error);
        res.status(500).json({ error: 'Failed to archive project' });
    }
});
exports.archiveProject = archiveProject;
