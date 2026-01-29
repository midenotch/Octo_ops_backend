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
exports.uploadFile = void 0;
const uploadFile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const protocol = ((_a = req.get('host')) === null || _a === void 0 ? void 0 : _a.includes('localhost')) ? 'http' : 'https';
        const fileUrl = `${protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.status(200).json({
            url: fileUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });
    }
    catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Internal server error during upload' });
    }
});
exports.uploadFile = uploadFile;
