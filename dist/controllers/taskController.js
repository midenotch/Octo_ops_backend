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
exports.deleteTask = exports.approveTask = exports.submitTask = exports.updateTask = exports.createTask = exports.getTasks = void 0;
const schemas_1 = require("../models/schemas");
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
        const task = yield schemas_1.Task.findByIdAndUpdate(id, Object.assign(Object.assign({}, updates), { updatedAt: new Date() }), { new: true })
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email')
            .populate('dependencies');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
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
        const task = yield schemas_1.Task.findByIdAndUpdate(id, { status: 'in-review', updatedAt: new Date() }, { new: true })
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
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
        const task = yield schemas_1.Task.findByIdAndUpdate(id, { status: 'done', updatedAt: new Date() }, { new: true })
            .populate('assignee', 'name email avatar role')
            .populate('createdBy', 'name email');
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    }
    catch (error) {
        console.error('Approve task error:', error);
        res.status(500).json({ error: 'Failed to approve task' });
    }
});
exports.approveTask = approveTask;
// Delete Task
const deleteTask = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const task = yield schemas_1.Task.findByIdAndDelete(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});
exports.deleteTask = deleteTask;
