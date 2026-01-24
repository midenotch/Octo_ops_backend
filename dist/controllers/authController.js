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
exports.signupOwner = exports.login = void 0;
const schemas_1 = require("../models/schemas");
// Unified Login (Email or Invite Code)
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { identifier } = req.body; // Can be email or invite code
        if (!identifier) {
            return res.status(400).json({ error: 'Identifier (email or code) is required' });
        }
        // 1. Try finding by Email first (Owner Login)
        let user = yield schemas_1.User.findOne({ email: identifier });
        if (user) {
            return res.json({ user });
        }
        // 2. Try identifying role/intent from code (for MVP/Demo)
        const code = identifier.toLowerCase();
        let role = 'member';
        if (code.includes('qa'))
            role = 'qa';
        // 3. Fallback: Find our "demo" users by role if it's a specific token
        user = yield schemas_1.User.findOne({ role, status: 'active' });
        if (!user) {
            // Create user with a valid MongoDB ID automatically by calling .create without an ID
            user = yield schemas_1.User.create({
                name: role === 'qa' ? 'Global Reviewer' : 'Main Developer',
                email: `${role}-demo@octoops.dev`,
                role: role,
                avatar: role === 'qa' ? '👩‍🎨' : '👨‍💻',
                status: 'active'
            });
        }
        res.json({ user });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});
exports.login = login;
// Signup (Project Owner)
const signupOwner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, projectName } = req.body;
        let user = yield schemas_1.User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }
        user = yield schemas_1.User.create({
            name,
            email,
            role: 'owner',
            avatar: '👩‍💼'
        });
        res.status(201).json({ user, projectName }); // Project creation happens in next step
    }
    catch (error) {
        res.status(500).json({ error: 'Signup failed' });
    }
});
exports.signupOwner = signupOwner;
