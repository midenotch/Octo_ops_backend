"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = exports.Settings = exports.TeamInvite = exports.Risk = exports.Task = exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const UserSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: { type: String, enum: ['owner', 'member', 'qa'], required: true },
    avatar: String,
    status: { type: String, enum: ['active', 'invited', 'inactive'], default: 'active' },
    invitedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    invitedAt: Date,
    acceptedAt: Date,
    createdAt: { type: Date, default: Date.now }
});
exports.User = mongoose_1.default.model('User', UserSchema);
const TaskSchema = new mongoose_1.default.Schema({
    title: { type: String, required: true },
    description: String,
    status: {
        type: String,
        enum: ['todo', 'in-progress', 'in-review', 'done', 'blocked'],
        default: 'todo'
    },
    assignee: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    assigneeName: String, // Denormalized for quick access
    deadline: Date,
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    milestone: String,
    dependencies: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Task' }],
    projectId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Project', required: true },
    attachments: [String], // URLs or file paths
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
exports.Task = mongoose_1.default.model('Task', TaskSchema);
const RiskSchema = new mongoose_1.default.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    affectedTasks: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Task' }],
    predictedImpact: String,
    recommendations: [String],
    confidence: { type: Number, min: 0, max: 100 },
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    resolvedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' },
    projectId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Project', required: true },
    detectedBy: { type: String, enum: ['ai', 'manual'], default: 'manual' },
    createdAt: { type: Date, default: Date.now }
});
exports.Risk = mongoose_1.default.model('Risk', RiskSchema);
const TeamInviteSchema = new mongoose_1.default.Schema({
    email: { type: String, required: true },
    role: { type: String, enum: ['member', 'qa'], required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
    projectId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Project', required: true },
    invitedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true },
    inviteCode: { type: String, required: true, unique: true },
    expiresAt: Date,
    acceptedAt: Date,
    createdAt: { type: Date, default: Date.now }
});
exports.TeamInvite = mongoose_1.default.model('TeamInvite', TeamInviteSchema);
const SettingsSchema = new mongoose_1.default.Schema({
    projectId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    notifications: {
        email: { type: Boolean, default: true },
        taskUpdates: { type: Boolean, default: true },
        riskAlerts: { type: Boolean, default: true },
        teamChanges: { type: Boolean, default: true }
    },
    integrations: {
        github: { enabled: Boolean, repoUrl: String, token: String },
        slack: { enabled: Boolean, webhookUrl: String }
    },
    aiSettings: {
        autoRiskDetection: { type: Boolean, default: true },
        taskRecommendations: { type: Boolean, default: true },
        healthScoreTracking: { type: Boolean, default: true }
    },
    updatedAt: { type: Date, default: Date.now }
});
exports.Settings = mongoose_1.default.model('Settings', SettingsSchema);
const ProjectSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    description: String,
    ownerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true },
    team: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User' }],
    totalMilestones: { type: Number, default: 0 },
    milestonesCompleted: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100, min: 0, max: 100 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    deadline: Date,
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Virtual for calculating progress
ProjectSchema.virtual('calculatedProgress').get(function () {
    if (this.totalMilestones === 0)
        return 0;
    return Math.round((this.milestonesCompleted / this.totalMilestones) * 100);
});
exports.Project = mongoose_1.default.model('Project', ProjectSchema);
