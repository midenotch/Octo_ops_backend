import { Request, Response } from 'express';

export const uploadFile = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const protocol = req.get('host')?.includes('localhost') ? 'http' : 'https';
        const fileUrl = `${protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        
        res.status(200).json({
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Internal server error during upload' });
    }
};
