import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

// API Key Rotation - Support up to 5 keys
const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
].filter(Boolean) as string[];

let currentKeyIndex = 0;
const MAX_RETRIES = API_KEYS.length;

function getNextAPIKey(): string {
  if (API_KEYS.length === 0) {
    throw new Error('No Gemini API keys configured');
  }
  return API_KEYS[currentKeyIndex];
}

function rotateAPIKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`🔄 Rotated to API key ${currentKeyIndex + 1}/${API_KEYS.length}`);
}

async function callGeminiWithRetry(prompt: string, imageData: { data: string; mimeType: string } | null = null): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const apiKey = getNextAPIKey();
      const client = new GoogleGenAI({ apiKey });
      
      const parts: any[] = [{ text: prompt }];
      if (imageData) {
        parts.push({
          inlineData: {
            data: imageData.data,
            mimeType: imageData.mimeType
          }
        });
      }

      const result = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts }]
      });

      const responseText = result.text || '';
      return responseText;
    } catch (error: any) {
      console.error(`API key ${currentKeyIndex + 1} failed:`, error.message);
      
      if (error.message?.includes('quota') || error.message?.includes('limit') || error.message?.includes('429')) {
        rotateAPIKey();
        if (attempt < MAX_RETRIES - 1) {
          console.log(`Retrying with next API key (attempt ${attempt + 2}/${MAX_RETRIES})...`);
          continue;
        }
      }
      throw error;
    }
  }
  throw new Error('All API keys exhausted');
}

/**
 * Extract project details from an uploaded image
 */
export async function extractProjectFromImage(imagePath: string) {
  try {
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const prompt = `You are an AI assistant helping to extract project information from images. 
    Analyze this image and extract the following information if available:
    
    1. Project Name
    2. Project Description
    3. Key Features or Requirements
    4. Timeline or Deadlines
    5. Team Members (if mentioned)
    6. Milestones or Goals
    7. Any text content visible in the image
    
    Return the information in JSON format with the following structure:
    {
      "name": "Project Name",
      "description": "Detailed description",
      "features": ["feature1", "feature2"],
      "deadline": "YYYY-MM-DD or null",
      "milestones": ["milestone1", "milestone2"],
      "teamSize": number or null,
      "extractedText": "All visible text from the image",
      "additionalNotes": "Any other relevant information"
    }
    
    If certain information is not available in the image, use null or empty arrays.`;

    const response = await callGeminiWithRetry(prompt, {
      data: base64Image,
      mimeType,
    });
    
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Error extracting project from image:', error);
    throw error;
  }
}

/**
 * Generate AI-powered team assembly recommendations
 */
export async function generateTeamAssembly(projectData: {
  name: string;
  description: string;
  features?: string[];
  extractedText?: string;
}) {
  try {
    const prompt = `Based on this project information, recommend an ideal team structure:
    
    Project: ${projectData.name}
    Description: ${projectData.description}
    Features: ${projectData.features?.join(', ') || 'Not specified'}
    ${projectData.extractedText ? `Additional Context: ${projectData.extractedText}` : ''}
    
    Provide recommendations in JSON format:
    {
      "recommendedDeadline": "YYYY-MM-DD (realistic deadline based on scope)",
      "estimatedDuration": "X weeks/months",
      "keyMilestones": [
        { "name": "Milestone 1", "description": "What to achieve", "estimatedWeeks": 2 },
        { "name": "Milestone 2", "description": "What to achieve", "estimatedWeeks": 3 }
      ],
      "teamRecommendations": {
        "totalMembers": number,
        "roles": [
          { "role": "Frontend Developer", "count": 1, "responsibilities": ["Build UI", "..."] },
          { "role": "Backend Developer", "count": 1, "responsibilities": ["API development", "..."] },
          { "role": "QA Engineer", "count": 1, "responsibilities": ["Testing", "..."] }
        ]
      },
      "reasoning": "Brief explanation of recommendations"
    }`;

    const response = await callGeminiWithRetry(prompt);
    
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Error generating team assembly:', error);
    throw error;
  }
}

/**
 * Auto-generate tasks based on project and milestones
 */
export async function generateInitialTasks(projectData: {
  name: string;
  description: string;
  milestones: any[];
  teamMembers: any[];
}) {
  try {
    const prompt = `Generate initial tasks for this project:
    
    Project: ${projectData.name}
    Description: ${projectData.description}
    Milestones: ${JSON.stringify(projectData.milestones)}
    Team: ${projectData.teamMembers.length} members with roles: ${projectData.teamMembers.map((m: any) => m.role).join(', ')}
    
    Generate 8-12 initial tasks distributed across milestones. Return JSON array:
    [
      {
        "title": "Task title",
        "description": "Detailed description",
        "milestone": "Which milestone this belongs to",
        "priority": "low|medium|high|critical",
        "estimatedDays": number,
        "suggestedRole": "Which team role should handle this",
        "dependencies": ["task titles this depends on"]
      }
    ]`;

    const response = await callGeminiWithRetry(prompt);
    
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
    return [];
  } catch (error) {
    console.error('Error generating initial tasks:', error);
    return [];
  }
}

export async function analyzeProjectHealth(projectData: any) {
  try {
    const prompt = `Analyze this project data and provide a health score (0-100) with reasoning:
    
    Project: ${projectData.name}
    Total Tasks: ${projectData.totalTasks}
    Completed Tasks: ${projectData.completedTasks}
    Blocked Tasks: ${projectData.blockedTasks}
    Active Risks: ${projectData.activeRisks}
    Team Size: ${projectData.teamSize}
    Days to Deadline: ${projectData.daysToDeadline}
    
    Return JSON:
    {
      "healthScore": number (0-100),
      "status": "excellent" | "good" | "warning" | "critical",
      "reasoning": "Brief explanation",
      "recommendations": ["recommendation1", "recommendation2"]
    }`;

    const response = await callGeminiWithRetry(prompt);
    
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Error analyzing project health:', error);
    throw error;
  }
}

export async function detectProjectRisks(projectData: any) {
  try {
    const prompt = `Analyze this project and identify potential risks:
    
    Project: ${projectData.name}
    Tasks: ${JSON.stringify(projectData.tasks)}
    Team: ${projectData.teamSize} members
    Deadline: ${projectData.deadline}
    
    Identify risks and return JSON array:
    [
      {
        "title": "Risk title",
        "description": "Detailed description",
        "severity": "low" | "medium" | "high" | "critical",
        "predictedImpact": "Impact description",
        "recommendations": ["recommendation1", "recommendation2"],
        "confidence": number (0-100)
      }
    ]`;

    const response = await callGeminiWithRetry(prompt);
    
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
    return [];
  } catch (error) {
    console.error('Error detecting risks:', error);
    return [];
  }
}

export async function generateTaskRecommendations(projectData: any) {
  try {
    const prompt = `Based on this project state, suggest next tasks:
    
    Project: ${projectData.name}
    Description: ${projectData.description}
    Current Tasks: ${JSON.stringify(projectData.currentTasks)}
    Completed: ${projectData.completedTasks}
    
    Suggest 3-5 next tasks in JSON:
    [
      {
        "title": "Task title",
        "description": "Task description",
        "priority": "low" | "medium" | "high" | "critical",
        "estimatedDays": number,
        "reasoning": "Why this task is important"
      }
    ]`;

    const response = await callGeminiWithRetry(prompt);
    
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }
    return [];
  } catch (error) {
    console.error('Error generating task recommendations:', error);
    return [];
  }
}
