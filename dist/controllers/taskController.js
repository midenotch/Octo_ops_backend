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
exports.deleteTask = exports.rejectTask = exports.approveTask = exports.submitTask = exports.updateTask = exports.createTask = exports.getTasks = void 0;
const schemas_1 = require("../models/schemas");
const server_1 = require("../server");
const projectUtils_1 = require("../utils/projectUtils");
// Get All Tasks
const getTasks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.query;
        const query = projectId ? { projectId } : {};
        const tasks = yield schemas_1.Task.find(query)
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email')
            .populate('dependencies')
            .sort({ createdAt: -1 });
        res.json(tasks);
    }
    catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});
exports.getTasks = getTasks;
// Create Task
const createTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const taskData = req.body;
        // Get assignee name if assignee ID is provided
        if (taskData.assignee) {
            const assignee = yield schemas_1.User.findById(taskData.assignee);
            if (assignee) {
                taskData.assigneeName = assignee.name;
            }
        }
        const task = yield schemas_1.Task.create(Object.assign(Object.assign({}, taskData), { updatedAt: new Date() }));
        const populatedTask = yield schemas_1.Task.findById(task._id)
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email')
            .populate('dependencies');
        if (task.projectId) {
            yield (0, projectUtils_1.updateProjectStats)(task.projectId.toString());
        }
        res.status(201).json(populatedTask);
    }
    catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});
exports.createTask = createTask;
// Update Task (Status/Assignee)
const updateTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const updates = req.body;
        // Update assignee name if assignee is being updated
        if (updates.assignee) {
            const assignee = yield schemas_1.User.findById(updates.assignee);
            if (assignee) {
                updates.assigneeName = assignee.name;
            }
        }
        const existingTask = yield schemas_1.Task.findById(id);
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }
        // Set timer if status changes to in-progress
        if (updates.status === 'in-progress' && existingTask.status !== 'in-progress' && !existingTask.timerStartedAt) {
            updates.timerStartedAt = new Date();
        }
        const task = yield schemas_1.Task.findByIdAndUpdate(id, Object.assign(Object.assign({}, updates), { updatedAt: new Date() }), { new: true })
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email')
            .populate('reviewedBy', 'name email')
            .populate('dependencies');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (task.projectId) {
            server_1.io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
            yield (0, projectUtils_1.updateProjectStats)(task.projectId.toString());
        }
        res.json(task);
    }
    catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});
exports.updateTask = updateTask;
// Submit for Review
const submitTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status, description, attachments } = req.body;
        const task = yield schemas_1.Task.findByIdAndUpdate(id, {
            status: status || 'in-review',
            description,
            attachments,
            rejectionNote: null, // Clear on resubmission
            rejectionAttachments: [], // Clear on resubmission
            updatedAt: new Date()
        }, { new: true })
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (task.projectId) {
            server_1.io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
            yield (0, projectUtils_1.updateProjectStats)(task.projectId.toString());
        }
        res.json(task);
    }
    catch (error) {
        console.error('Submit task error:', error);
        res.status(500).json({ error: 'Failed to submit task' });
    }
});
exports.submitTask = submitTask;
// Approve Task
const approveTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const task = yield schemas_1.Task.findByIdAndUpdate(id, {
            status: 'done',
            reviewedBy: userId,
            updatedAt: new Date()
        }, { new: true })
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email')
            .populate('reviewedBy', 'name email');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (task.projectId) {
            server_1.io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
            yield schemas_1.Risk.updateMany({ affectedTasks: id, resolved: false }, { resolved: true, resolvedAt: new Date(), resolvedBy: userId });
            server_1.io.to(`project:${task.projectId}`).emit('risks-updated', { projectId: task.projectId });
            yield (0, projectUtils_1.updateProjectStats)(task.projectId.toString());
        }
        res.json(task);
    }
    catch (error) {
        console.error('Approve task error:', error);
        res.status(500).json({ error: 'Failed to approve task' });
    }
});
exports.approveTask = approveTask;
// Reject Task
const rejectTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { rejectionNote, rejectionAttachments } = req.body;
        const task = yield schemas_1.Task.findByIdAndUpdate(id, {
            status: 'todo',
            rejectionNote,
            rejectionAttachments,
            updatedAt: new Date()
        }, { new: true })
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (task.projectId) {
            server_1.io.to(`project:${task.projectId}`).emit('tasks-updated', { projectId: task.projectId });
            yield (0, projectUtils_1.updateProjectStats)(task.projectId.toString());
        }
        res.json(task);
    }
    catch (error) {
        console.error('Reject task error:', error);
        res.status(500).json({ error: 'Failed to reject task' });
    }
});
exports.rejectTask = rejectTask;
// Delete Task
const deleteTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const task = yield schemas_1.Task.findByIdAndDelete(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (task.projectId) {
            yield (0, projectUtils_1.updateProjectStats)(task.projectId.toString());
        }
        res.json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});
exports.deleteTask = deleteTask;
