import express from 'express';
import { login, signupOwner } from '../controllers/authController';
import { createProject, getProject, updateProject, getUserProjects, archiveProject } from '../controllers/projectController';
import { getTasks, createTask, updateTask, submitTask, approveTask, rejectTask, deleteTask } from '../controllers/taskController';
import { getRisks, createRisk, updateRisk, resolveRisk, analyzeRisks, deleteRisk } from '../controllers/riskController';
import { uploadFile } from '../controllers/uploadController';
import { getTeamMembers, inviteTeamMember, acceptInvite, removeTeamMember, updateMemberRole, cancelInvite } from '../controllers/teamController';
import { getSettings, updateSettings, updateNotificationPreferences, updateIntegrations, updateAISettings } from '../controllers/settingsController';
import { analyzeProjectImage, calculateHealthScore, getTaskRecommendations, getTeamAssemblyRecommendations, generateProjectTasks } from '../controllers/aiController';
import { upload } from '../middleware/upload';

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth Routes
router.post('/auth/login', login);
router.post('/auth/signup', signupOwner);

// Project Routes
router.post('/projects', createProject);
router.get('/projects', getProject);
router.put('/projects', updateProject);
router.get('/projects/user', getUserProjects);
router.post('/projects/archive', archiveProject);

// Task Routes
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);
router.post('/tasks/:id/submit', submitTask);
router.post('/tasks/:id/reject', rejectTask);
router.post('/tasks/:id/approve', approveTask);

// Risk Routes
router.get('/risks', getRisks);
router.post('/risks', createRisk);
router.put('/risks/:id', updateRisk);
router.delete('/risks/:id', deleteRisk);
router.post('/risks/:id/resolve', resolveRisk);
router.post('/risks/analyze', analyzeRisks);

// Team Routes
router.get('/team', getTeamMembers);
router.post('/team/invite', inviteTeamMember);
router.post('/team/accept', acceptInvite);
router.delete('/team/member', removeTeamMember);
router.put('/team/member/role', updateMemberRole);
router.delete('/team/invite/:inviteId', cancelInvite);

// Settings Routes
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.put('/settings/notifications', updateNotificationPreferences);
router.put('/settings/integrations', updateIntegrations);
router.put('/settings/ai', updateAISettings);

// AI Routes
router.post('/ai/analyze-image', upload.single('image'), analyzeProjectImage);
router.post('/ai/health-score', calculateHealthScore);
router.get('/ai/task-recommendations', getTaskRecommendations);
router.post('/ai/team-assembly', getTeamAssemblyRecommendations);
router.post('/ai/generate-tasks', generateProjectTasks);

// Generic Upload Route
router.post('/upload', upload.single('file'), uploadFile);

export default router;
