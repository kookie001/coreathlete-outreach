const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

// Load .env if present
try {
  require('dotenv').config();
} catch (e) {}

const authHandler = require('./api/auth');
const leadsHandler = require('./api/leads');
const statsHandler = require('./api/stats');
const settingsHandler = require('./api/settings');
const exportHandler = require('./api/export');
const importHandler = require('./api/import');

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        resolve(data);
      }
    });
  });
}

function serveStatic(res, filePath, contentType) {
  if (fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  req.query = parsedUrl.query;
  req.body = await parseBody(req);

  // Helper response methods for compatibility with Vercel serverless
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.setHeader('Content-Type', 'application/json');
    this.end(JSON.stringify(data));
    return this;
  };
  res.send = function(data) {
    this.end(data);
    return this;
  };

  // API Routes
  if (pathname.startsWith('/api/auth')) {
    return authHandler(req, res);
  }
  if (pathname === '/api/leads' || pathname.startsWith('/api/leads/')) {
    if (pathname === '/api/leads/import' || pathname === '/api/import') {
      return importHandler(req, res);
    }
    if (pathname === '/api/leads/export' || pathname === '/api/export') {
      return exportHandler(req, res);
    }
    return leadsHandler(req, res);
  }
  if (pathname === '/api/stats') {
    return statsHandler(req, res);
  }
  if (pathname === '/api/settings') {
    return settingsHandler(req, res);
  }
  if (pathname === '/api/export') {
    return exportHandler(req, res);
  }
  if (pathname === '/api/import') {
    return importHandler(req, res);
  }

  // Static files
  if (pathname === '/' || pathname === '/index.html') {
    return serveStatic(res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
  }
  if (pathname === '/app.js') {
    return serveStatic(res, path.join(__dirname, 'app.js'), 'application/javascript; charset=utf-8');
  }
  if (pathname === '/styles.css') {
    return serveStatic(res, path.join(__dirname, 'styles.css'), 'text/css; charset=utf-8');
  }

  // Fallback to 404 or index
  serveStatic(res, path.join(__dirname, 'index.html'), 'text/html; charset=utf-8');
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`CoreAthlete Outreach Server running at http://localhost:${PORT}`);
  });
}

module.exports = server;
