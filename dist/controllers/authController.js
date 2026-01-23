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
// Login (Member/QA via Invite Code)
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { inviteCode } = req.body;
        // Simulating Invite Code validation
        // In a real app, invite codes would be stored in the DB linked to a project/role
        // For this MVP, we use the simple logic requested
        let role = 'member';
        if (inviteCode && inviteCode.toLowerCase().includes('qa')) {
            role = 'qa';
        }
        // Find or Create a Mock User for this session
        // In a real flow, this would verify a token. Here we simulate a user found via invite.
        let user = yield schemas_1.User.findOne({ email: `${role}@octoops.dev` });
        if (!user) {
            user = yield schemas_1.User.create({
                name: role === 'qa' ? 'QA Specialist' : 'Team Developer',
                email: `${role}@octoops.dev`,
                role: role,
                avatar: role === 'qa' ? '👩‍🎨' : '👨‍💻'
            });
        }
        res.json({ user });
    }
    catch (error) {
        res.status(500).json({ error: 'Login failed' });
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
