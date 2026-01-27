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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignInitialTasksToMember = void 0;
const schemas_1 = require("../models/schemas");
const mongoose_1 = __importDefault(require("mongoose"));
const geminiService_1 = require("./geminiService");
// Standard role keywords for fallback matching
const ROLE_KEYWORDS = {
    'frontend': ['frontend', 'ui', 'react', 'vue', 'angular', 'css', 'html', 'tailwind', 'client', 'design', 'style', 'component', 'interface'],
    'backend': ['backend', 'api', 'server', 'database', 'node', 'express', 'mongo', 'sql', 'auth', 'endpoint', 'middleware', 'data', 'schema'],
    'fullstack': ['fullstack', 'full-stack', 'full stack', 'web', 'application', 'feature', 'system', 'end-to-end'],
    'designer': ['design', 'ui', 'ux', 'figma', 'sketch', 'style', 'layout', 'asset', 'visual', 'prototype', 'wireframe'],
    'qa': ['test', 'qa', 'quality', 'bug', 'audit', 'verify', 'debug', 'e2e', 'cypress', 'jest', 'unit', 'coverage'],
    'devops': ['devops', 'deploy', 'ci/cd', 'docker', 'kubernetes', 'aws', 'cloud', 'infra', 'pipeline', 'monitor', 'log'],
    'mobile': ['mobile', 'ios', 'android', 'react native', 'flutter', 'app', 'native', 'screen'],
    'lead': ['manage', 'lead', 'coordinate', 'setup', 'plan', 'architecture', 'strategy', 'roadmap']
};
const assignInitialTasksToMember = (user, projectId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    let assignedTasks = [];
    const maxAssignments = 3;
    try {
        console.log(`[AutoAssign] Starting assignment for ${user.name} (${user.role}) in project ${projectId}`);
        const project = yield schemas_1.Project.findById(projectId);
        if (!project) {
            console.error(`[AutoAssign] Project ${projectId} not found.`);
            return { assignedTasks: [], message: 'Project not found.' };
        }
        const projectOwnerId = (_a = project.ownerId) === null || _a === void 0 ? void 0 : _a.toString();
        console.log(`[AutoAssign] Querying Project ID: ${projectId}, Owner ID: ${projectOwnerId}`);
        const totalTasks = yield schemas_1.Task.countDocuments({ projectId: new mongoose_1.default.Types.ObjectId(projectId) });
        console.log(`[AutoAssign] Project has ${totalTasks} total tasks.`);
        // 1. Find Unassigned Tasks (OR tasks assigned to Owner which are effectively "backlog")
        const unassignedQuery = {
            projectId: new mongoose_1.default.Types.ObjectId(projectId),
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
        const unassignedTasks = yield schemas_1.Task.find(unassignedQuery);
        console.log(`[AutoAssign] Found ${unassignedTasks.length} candidates (including Owner's tasks).`);
        if (unassignedTasks.length === 0) {
            return { assignedTasks: [], message: 'No unassigned tasks available.' };
        }
        // 2. AI Semantic Matching
        let aiMatchedIds = [];
        try {
            aiMatchedIds = yield (0, geminiService_1.matchTasksToRole)({ role: user.role, title: user.title || user.role }, unassignedTasks);
            console.log(`[AutoAssign] AI returned ${aiMatchedIds.length} matches.`);
        }
        catch (error) {
            console.error('[AutoAssign] AI matching error:', error);
            // Continue to keyword matching
        }
        // Apply AI matches
        for (const taskId of aiMatchedIds) {
            if (assignedTasks.length >= maxAssignments)
                break;
            const task = unassignedTasks.find(t => t._id.toString() === taskId.toString());
            if (task) {
                yield assignTaskToUser(task, user);
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
                    if (assignedTasks.length >= maxAssignments)
                        break;
                    // Skip if already assigned in this flow
                    if (assignedTasks.some(at => at._id.toString() === task._id.toString()))
                        continue;
                    const title = (task.title || '').toLowerCase();
                    const desc = (task.description || '').toLowerCase();
                    if (keywords.some(k => title.includes(k) || desc.includes(k))) {
                        yield assignTaskToUser(task, user);
                        assignedTasks.push(task);
                        console.log(`[AutoAssign] Keyword match: ${task.title}`);
                    }
                }
            }
            else {
                console.log('[AutoAssign] No specific role category matched for keywords.');
            }
        }
        console.log(`[AutoAssign] Completed. Assigned ${assignedTasks.length} tasks.`);
        return { assignedTasks };
    }
    catch (error) {
        console.error('[AutoAssign] Critical failure:', error);
        return { assignedTasks, error };
    }
});
exports.assignInitialTasksToMember = assignInitialTasksToMember;
function assignTaskToUser(task, user) {
    return __awaiter(this, void 0, void 0, function* () {
        task.assignee = user._id.toString();
        task.assigneeName = user.name;
        task.assigneeEmail = user.email;
        yield task.save();
    });
}
