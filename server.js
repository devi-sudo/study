const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/pdf-viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'pdf-viewer.html'));
});

// API endpoint to process uploaded files
app.post('/api/process', (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'No content provided' });
        }
        
        // Process content and extract resources
        const resources = processContent(content);
        
        res.json({ success: true, resources });
    } catch (error) {
        console.error('Error processing file:', error);
        res.status(500).json({ error: 'Failed to process file' });
    }
});

function processContent(content) {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const resources = [];
    
    lines.forEach(line => {
        const parts = line.split(': ');
        if (parts.length >= 2) {
            const title = parts[0];
            const url = parts.slice(1).join(': ');
            let type = 'other';
            
            if (url.includes('.mp4')) type = 'video';
            else if (url.includes('.pdf')) type = 'pdf';
            
            resources.push({ title, url, type });
        }
    });
    
    return resources;
}

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
