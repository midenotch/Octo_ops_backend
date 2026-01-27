import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['owner', 'member', 'qa'], required: true },
  title: String, // e.g. "Frontend Developer"
  avatar: String,
  status: { type: String, enum: ['active', 'invited', 'inactive'], default: 'active' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  invitedAt: Date,
  acceptedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', UserSchema);

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { 
    type: String, 
    enum: ['todo', 'in-progress', 'in-review', 'done', 'blocked'], 
    default: 'todo' 
  },
  assignee: { type: String, ref: 'User' },
  assigneeName: String, // Denormalized for quick access
  assigneeEmail: String,
  deadline: Date,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  milestone: String,
  dependencies: [{ type: String, ref: 'Task' }],
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  attachments: [String], // URLs or file paths
  createdBy: { type: String, ref: 'User' },
  reviewedBy: { type: String, ref: 'User' },
  rejectionNote: String,
  rejectionAttachments: [String], // URLs or file paths from QA rejection
  timerStartedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Task = mongoose.model('Task', TaskSchema);

const RiskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  affectedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  predictedImpact: String,
  recommendations: [String],
  confidence: { type: Number, min: 0, max: 100 },
  resolved: { type: Boolean, default: false },
  resolvedAt: Date,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  detectedBy: { type: String, enum: ['ai', 'manual'], default: 'manual' },
  createdAt: { type: Date, default: Date.now }
});

export const Risk = mongoose.model('Risk', RiskSchema);

const TeamInviteSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: String, // Full name of the invited person
  role: { type: String, enum: ['member', 'qa'], required: true },
  title: String, // Specific job title
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired'], default: 'pending' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inviteCode: { type: String, required: true, unique: true },
  expiresAt: Date,
  acceptedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

export const TeamInvite = mongoose.model('TeamInvite', TeamInviteSchema);

const SettingsSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
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

export const Settings = mongoose.model('Settings', SettingsSchema);

const ProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  ownerId: { type: String, ref: 'User', required: true },
  team: [{ type: String, ref: 'User' }],
  totalMilestones: { type: Number, default: 0 },
  milestonesCompleted: { type: Number, default: 0 },
  healthScore: { type: Number, default: 100, min: 0, max: 100 },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  deadline: Date,
  status: { type: String, enum: ['active', 'completed', 'archived', 'launching'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Virtual for calculating progress
ProjectSchema.virtual('calculatedProgress').get(function() {
  if (this.totalMilestones === 0) return 0;
  return Math.round((this.milestonesCompleted / this.totalMilestones) * 100);
});

export const Project = mongoose.model('Project', ProjectSchema);
