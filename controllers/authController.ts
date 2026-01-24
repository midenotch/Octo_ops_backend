import { Request, Response } from 'express';
import { User } from '../models/schemas';

// Unified Login (Email or Invite Code)
export const login = async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body; // Can be email or invite code
    
    if (!identifier) {
        return res.status(400).json({ error: 'Identifier (email or code) is required' });
    }

    // 1. Try finding by Email first (Owner Login)
    let user = await User.findOne({ email: identifier });
    
    if (user) {
        return res.json({ user });
    }

    // 2. Try identifying role/intent from code (for MVP/Demo)
    const code = identifier.toLowerCase();
    let role = 'member';
    if (code.includes('qa')) role = 'qa';

    // 3. Fallback: Find our "demo" users by role if it's a specific token
    user = await User.findOne({ role, status: 'active' });
    
    if (!user) {
        // Create user with a valid MongoDB ID automatically by calling .create without an ID
        user = await User.create({
            name: role === 'qa' ? 'Global Reviewer' : 'Main Developer',
            email: `${role}-demo@octoops.dev`,
            role: role,
            avatar: role === 'qa' ? '👩‍🎨' : '👨‍💻',
            status: 'active'
        });
    }

    res.json({ user });
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
