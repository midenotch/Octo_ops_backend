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
exports.updateAISettings = exports.updateIntegrations = exports.updateNotificationPreferences = exports.updateSettings = exports.getSettings = void 0;
const schemas_1 = require("../models/schemas");
// Get settings for a project
const getSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        let settings = yield schemas_1.Settings.findOne({ projectId });
        // Create default settings if not exists
        if (!settings) {
            settings = yield schemas_1.Settings.create({ projectId });
        }
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
exports.getSettings = getSettings;
// Update settings
const updateSettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const _a = req.body, { projectId } = _a, updates = __rest(_a, ["projectId"]);
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const settings = yield schemas_1.Settings.findOneAndUpdate({ projectId }, Object.assign(Object.assign({}, updates), { updatedAt: new Date() }), { new: true, upsert: true });
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});
exports.updateSettings = updateSettings;
// Update notification preferences
const updateNotificationPreferences = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, notifications } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const settings = yield schemas_1.Settings.findOneAndUpdate({ projectId }, { notifications, updatedAt: new Date() }, { new: true, upsert: true });
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update notification preferences' });
    }
});
exports.updateNotificationPreferences = updateNotificationPreferences;
// Update integrations
const updateIntegrations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, integrations } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const settings = yield schemas_1.Settings.findOneAndUpdate({ projectId }, { integrations, updatedAt: new Date() }, { new: true, upsert: true });
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update integrations' });
    }
});
exports.updateIntegrations = updateIntegrations;
// Update AI settings
const updateAISettings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, aiSettings } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const settings = yield schemas_1.Settings.findOneAndUpdate({ projectId }, { aiSettings, updatedAt: new Date() }, { new: true, upsert: true });
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update AI settings' });
    }
});
exports.updateAISettings = updateAISettings;
