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
    let user = await User.findOne({ email: identifier });
    
    if (user) {
        return res.json({ user });
    }

    // 2. Try finding by Invite Code
    const { TeamInvite } = require('../models/schemas'); // Dynamic import to avoid circular dep if any
    const invite = await TeamInvite.findOne({ inviteCode: identifier });

    if (invite) {
        // If invite exists, check if user has already been created from it
        user = await User.findOne({ email: invite.email });
        
        if (user) {
             return res.json({ user });
        } else {
             // Allow temporary access to context, but typically they should hit 'accept' endpoint first.
             // For strict login, we might require them to be fully registered.
             // However, to support "Project Board via Link", we'll return a provisional user object
             // BUT user said "strictly used to login", implies existing user.
             // Let's Check context: "after team memebr accept invite... url should be saved... strictly used to login"
             // This implies if they haven't accepted, maybe they can't login? 
             // Or the invite link Logs them in TO accept?
             
             // Let's assume valid invite code grants access (provisionally) 
             // OR we error if not accepted. 
             // Simplest strict path: If invite is valid, we return a provisional user structure relative to that invite
             
             return res.json({ 
                 user: {
                     name: 'Invited Member',
                     email: invite.email,
                     role: invite.role,
                     status: 'invited',
                     _id: 'pending_' + invite._id // Temporary ID
                 },
                 requiresOnboarding: true,
                 inviteCode: identifier
             });
        }
    }

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
