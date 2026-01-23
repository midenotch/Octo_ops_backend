"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const projectController_1 = require("../controllers/projectController");
const taskController_1 = require("../controllers/taskController");
const riskController_1 = require("../controllers/riskController");
const teamController_1 = require("../controllers/teamController");
const settingsController_1 = require("../controllers/settingsController");
const aiController_1 = require("../controllers/aiController");
const upload_1 = require("../middleware/upload");
const router = express_1.default.Router();
// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Auth Routes
router.post('/auth/login', authController_1.login);
router.post('/auth/signup', authController_1.signupOwner);
// Project Routes
router.post('/projects', projectController_1.createProject);
router.get('/projects', projectController_1.getProject);
router.put('/projects', projectController_1.updateProject);
router.get('/projects/user', projectController_1.getUserProjects);
// Task Routes
router.get('/tasks', taskController_1.getTasks);
router.post('/tasks', taskController_1.createTask);
router.put('/tasks/:id', taskController_1.updateTask);
router.delete('/tasks/:id', taskController_1.deleteTask);
router.post('/tasks/:id/submit', taskController_1.submitTask);
router.post('/tasks/:id/approve', taskController_1.approveTask);
// Risk Routes
router.get('/risks', riskController_1.getRisks);
router.post('/risks', riskController_1.createRisk);
router.put('/risks/:id', riskController_1.updateRisk);
router.delete('/risks/:id', riskController_1.deleteRisk);
router.post('/risks/:id/resolve', riskController_1.resolveRisk);
router.post('/risks/analyze', riskController_1.analyzeRisks);
// Team Routes
router.get('/team', teamController_1.getTeamMembers);
router.post('/team/invite', teamController_1.inviteTeamMember);
router.post('/team/accept', teamController_1.acceptInvite);
router.delete('/team/member', teamController_1.removeTeamMember);
router.put('/team/member/role', teamController_1.updateMemberRole);
router.delete('/team/invite/:inviteId', teamController_1.cancelInvite);
// Settings Routes
router.get('/settings', settingsController_1.getSettings);
router.put('/settings', settingsController_1.updateSettings);
router.put('/settings/notifications', settingsController_1.updateNotificationPreferences);
router.put('/settings/integrations', settingsController_1.updateIntegrations);
router.put('/settings/ai', settingsController_1.updateAISettings);
// AI Routes
router.post('/ai/analyze-image', upload_1.upload.single('image'), aiController_1.analyzeProjectImage);
router.post('/ai/health-score', aiController_1.calculateHealthScore);
router.get('/ai/task-recommendations', aiController_1.getTaskRecommendations);
router.post('/ai/team-assembly', aiController_1.getTeamAssemblyRecommendations);
router.post('/ai/generate-tasks', aiController_1.generateProjectTasks);
exports.default = router;
