import { Request, Response } from 'express';
import { User } from '../models/schemas';

// Unified Login (Email or Invite Code)
// Unified Login (Email or Invite Code)
export const login = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body; // Can be email or invite code
    
    if (!identifier) {
        return res.status(400).json({ error: 'Identifier (email or code) is required' });
    }

    // 1. Try finding by Email first (Owner/Member Login)
    console.log(`[Login] Attempting login for identifier: ${identifier}`);
    let user = await User.findOne({ email: identifier });
    
    if (user) {
        console.log(`[Login] Found existing User doc for ${identifier}. Role: ${user.role}`);
        return res.json({ user });
    }

    // 2. Try finding by Invite Code
    console.log(`[Login] No User doc found. Checking if "${identifier}" is an invite code...`);
    const { TeamInvite } = require('../models/schemas'); 
    const invite = await TeamInvite.findOne({ inviteCode: identifier });

    if (invite) {
        console.log(`[Login] Match found! Invite for: ${invite.email}, Current Status: ${invite.status}`);
        
        // If invite exists, check if user doc was previously created but deleted
        user = await User.findOne({ email: invite.email });
        
        if (user) {
             console.log(`[Login] User doc for ${invite.email} still exists. Logging in.`);
             return res.json({ user });
        } else {
             // User doc is missing (likely removed)
             if (invite.status !== 'pending') {
                 console.log(`[Login] DENIED: Code "${identifier}" status is "${invite.status}" (NOT PENDING) and User doc is missing.`);
                 return res.status(401).json({ error: 'This invitation has already been accepted or is no longer valid. Please login with your email.' });
             }

             console.log(`[Login] GRANTED: Provisionally allowing login for Pending Invite.`);
             return res.json({ 
                 user: {
                     name: invite.name || 'Invited Member',
                     email: invite.email,
                     role: invite.role,
                     status: 'invited',
                     _id: 'pending_' + invite._id // Temporary ID for onboarding
                 },
                 requiresOnboarding: true,
                 inviteCode: identifier
             });
        }
    }

    console.log(`[Login] FAILED: No User or Pending Invite found for "${identifier}"`);
    return res.status(401).json({ error: 'Invalid credentials. Please contact your project owner.' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Signup (Project Owner)
export const signupOwner = async (req: Request, res: Response) => {
  try {
    const { name, email, projectName } = req.body;

    let user = await User.findOne({ email });
    if (user) {
        return res.status(400).json({ error: 'User already exists' });
    }

    user = await User.create({
        name,
        email,
        role: 'owner',
        avatar: '👩‍💼'
    });

    res.status(201).json({ user, projectName }); // Project creation happens in next step
  } catch (error) {
    res.status(500).json({ error: 'Signup failed' });
  }
};
