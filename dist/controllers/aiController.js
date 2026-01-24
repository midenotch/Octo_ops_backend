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
exports.generateProjectTasks = exports.getTeamAssemblyRecommendations = exports.getTaskRecommendations = exports.calculateHealthScore = exports.analyzeProjectImage = void 0;
const geminiService_1 = require("../services/geminiService");
const upload_1 = require("../middleware/upload");
const schemas_1 = require("../models/schemas");
// Extract project details from uploaded image
const analyzeProjectImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }
        const imagePath = req.file.path;
        // Extract project information using Gemini AI
        const projectData = yield (0, geminiService_1.extractProjectFromImage)(imagePath);
        // Clean up uploaded file
        (0, upload_1.deleteUploadedFile)(imagePath);
        res.json(projectData);
    }
    catch (error) {
        console.error('Image analysis error:', error);
        // Clean up file on error
        if (req.file) {
            (0, upload_1.deleteUploadedFile)(req.file.path);
        }
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});
exports.analyzeProjectImage = analyzeProjectImage;
// Calculate and update project health score
const calculateHealthScore = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        // Fetch project data
        const project = yield schemas_1.Project.findById(projectId).populate('team');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const tasks = yield schemas_1.Task.find({ projectId });
        const risks = yield schemas_1.Risk.find({ projectId, resolved: false });
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
        const healthAnalysis = yield (0, geminiService_1.analyzeProjectHealth)(projectData);
        // Update project health score
        project.healthScore = healthAnalysis.healthScore;
        yield project.save();
        res.json(Object.assign(Object.assign({}, healthAnalysis), { project: {
                id: project._id,
                name: project.name,
                healthScore: project.healthScore
            } }));
    }
    catch (error) {
        console.error('Health score calculation error:', error);
        res.status(500).json({ error: 'Failed to calculate health score' });
    }
});
exports.calculateHealthScore = calculateHealthScore;
const getTaskRecommendations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const project = yield schemas_1.Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const tasks = yield schemas_1.Task.find({ projectId });
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
        const recommendations = yield (0, geminiService_1.generateTaskRecommendations)(projectData);
        res.json(recommendations);
    }
    catch (error) {
        console.error('Task recommendations error:', error);
        res.status(500).json({ error: 'Failed to generate task recommendations' });
    }
});
exports.getTaskRecommendations = getTaskRecommendations;
// Generate AI-powered team assembly recommendations
const getTeamAssemblyRecommendations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        const recommendations = yield (0, geminiService_1.generateTeamAssembly)(projectData);
        res.json(recommendations);
    }
    catch (error) {
        console.error('Team assembly error:', error);
        res.status(500).json({ error: 'Failed to generate team recommendations' });
    }
});
exports.getTeamAssemblyRecommendations = getTeamAssemblyRecommendations;
// Generate initial tasks for project launch
const generateProjectTasks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { projectId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const project = yield schemas_1.Project.findById(projectId).populate('team');
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
        const aiTasks = yield (0, geminiService_1.generateInitialTasks)(projectData);
        // SAVE AND ASSIGN TASKS
        const createdTasks = [];
        for (const aiTask of aiTasks) {
            // Try to match role (case insensitive)
            const suggestedRole = (aiTask.suggestedRole || '').toLowerCase();
            const team = project.team;
            const assignee = team.find((m) => m.role && (m.role.toLowerCase().includes(suggestedRole) ||
                suggestedRole.includes(m.role.toLowerCase())));
            const task = yield schemas_1.Task.create({
                projectId: project._id,
                title: aiTask.title,
                description: aiTask.description,
                status: 'todo',
                priority: aiTask.priority || 'medium',
                milestone: aiTask.milestone,
                assignee: (assignee === null || assignee === void 0 ? void 0 : assignee._id) || ((_a = team[0]) === null || _a === void 0 ? void 0 : _a._id), // Default to first member if no match
                assigneeName: (assignee === null || assignee === void 0 ? void 0 : assignee.name) || ((_b = team[0]) === null || _b === void 0 ? void 0 : _b.name),
                deadline: new Date(Date.now() + (aiTask.estimatedDays || 3) * 24 * 60 * 60 * 1000),
                updatedAt: new Date()
            });
            createdTasks.push(task);
        }
        res.json(createdTasks);
    }
    catch (error) {
        console.error('Task generation error:', error);
        res.status(500).json({ error: 'Failed to generate and assign tasks' });
    }
});
exports.generateProjectTasks = generateProjectTasks;
