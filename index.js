const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Mddleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      mediaSrc: ["'self'", "data:", "https:", "http:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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

// API endpoint to search resources
app.post('/api/search', (req, res) => {
  try {
    const { resources, searchTerm } = req.body;
    
    if (!resources || !searchTerm) {
      return res.status(400).json({ error: 'Resources and search term are required' });
    }
    
    // Filter resources based on search term
    const filteredResources = resources.filter(resource => 
      resource.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    res.json({ success: true, resources: filteredResources });
  } catch (error) {
    console.error('Error searching resources:', error);
    res.status(500).json({ error: 'Failed to search resources' });
  }
});

// Health check endpoint for Vercel
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

// Export the app for Vercel
module.exports = app;

// Start server locally if not in Vercel environment
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
