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
exports.deleteRisk = exports.analyzeRisks = exports.resolveRisk = exports.updateRisk = exports.createRisk = exports.getRisks = void 0;
const schemas_1 = require("../models/schemas");
const geminiService_1 = require("../services/geminiService");
// Get all risks for a project
const getRisks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.query;
        const query = projectId ? { projectId } : {};
        const risks = yield schemas_1.Risk.find(query)
            .populate('affectedTasks')
            .populate('resolvedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(risks);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch risks' });
    }
});
exports.getRisks = getRisks;
// Create a new risk
const createRisk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const risk = yield schemas_1.Risk.create(req.body);
        const populatedRisk = yield schemas_1.Risk.findById(risk._id)
            .populate('affectedTasks')
            .populate('resolvedBy', 'name email');
        res.status(201).json(populatedRisk);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create risk' });
    }
});
exports.createRisk = createRisk;
// Update a risk
const updateRisk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const risk = yield schemas_1.Risk.findByIdAndUpdate(id, req.body, { new: true })
            .populate('affectedTasks')
            .populate('resolvedBy', 'name email');
        if (!risk) {
            return res.status(404).json({ error: 'Risk not found' });
        }
        res.json(risk);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update risk' });
    }
});
exports.updateRisk = updateRisk;
// Resolve a risk
const resolveRisk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const risk = yield schemas_1.Risk.findByIdAndUpdate(id, {
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: userId
        }, { new: true }).populate('affectedTasks').populate('resolvedBy', 'name email');
        if (!risk) {
            return res.status(404).json({ error: 'Risk not found' });
        }
        res.json(risk);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to resolve risk' });
    }
});
exports.resolveRisk = resolveRisk;
// AI-powered risk analysis
const analyzeRisks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectData } = req.body;
        const detectedRisks = yield (0, geminiService_1.detectProjectRisks)(projectData);
        // Save detected risks to database
        const savedRisks = [];
        for (const riskData of detectedRisks) {
            const risk = yield schemas_1.Risk.create(Object.assign(Object.assign({}, riskData), { projectId: projectData.projectId, detectedBy: 'ai' }));
            savedRisks.push(risk);
        }
        res.json(savedRisks);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to analyze risks' });
    }
});
exports.analyzeRisks = analyzeRisks;
// Delete a risk
const deleteRisk = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const risk = yield schemas_1.Risk.findByIdAndDelete(id);
        if (!risk) {
            return res.status(404).json({ error: 'Risk not found' });
        }
        res.json({ message: 'Risk deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete risk' });
    }
});
exports.deleteRisk = deleteRisk;
