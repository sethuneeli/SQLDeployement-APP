const express = require('express');
const path = require('path');
const exec = require('child_process').exec;
const execFile = require('child_process').execFile;
const sql = require('mssql');
const multer = require('multer');
const fs = require('fs');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
// Increase body size limits to support larger SQL scripts posted as JSON
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.static('public'));

// Serve static files from the root directory (for HTML, CSS, JS files)
app.use(express.static(__dirname));

// serve root index.html
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// serve index.html explicitly
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// serve environments page
app.get('/environments.html', (req, res) => res.sendFile(path.join(__dirname, 'environments.html')));

// Generic HTML file serving (fallback for any .html files)
app.get('/:filename.html', (req, res) => {
  const fileName = req.params.filename + '.html';
  const filePath = path.join(__dirname, fileName);
  
  // Security check to prevent directory traversal
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return res.status(400).send('Invalid filename');
  }
  
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).send('HTML file not found');
    }
  });
});

// ---- Feature Flags (Enable GPT-5 for all clients) ----
const FEATURES_PATH = path.join(__dirname, 'tools', 'features.json');
function readJsonFile(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch(_) { return fallback; }
}
function writeJsonFile(p, obj) {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch(_) {}
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

// initialize and ensure GPT-5 is enabled globally
let features = readJsonFile(FEATURES_PATH, null);
if (!features) {
  features = { gpt5Enabled: true, updatedAt: new Date().toISOString() };
  writeJsonFile(FEATURES_PATH, features);
} else if (!features.gpt5Enabled) {
  features.gpt5Enabled = true;
  features.updatedAt = new Date().toISOString();
  writeJsonFile(FEATURES_PATH, features);
}

// API to read current features
app.get('/api/features', (req, res) => {
  try {
    features = readJsonFile(FEATURES_PATH, features || {});
  } catch(_) {}
  res.json({ success: true, features });
});

// API to update a feature flag (optional; secured via environment in real systems)
app.post('/api/features', express.json(), (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ success: false, message: 'key is required' });
    features = Object.assign({}, readJsonFile(FEATURES_PATH, features || {}));
    features[key] = value;
    features.updatedAt = new Date().toISOString();
    writeJsonFile(FEATURES_PATH, features);
    res.json({ success: true, features });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Environment configuration endpoints
app.get('/api/environments', (req, res) => {
  // Return current environment configurations
  const envConfigs = Object.keys(sqlConfigs).map(key => ({
    key,
    name: key,
    connected: pools[key] && pools[key].connected
  }));
  res.json({ success: true, environments: envConfigs });
});

app.post('/api/environments', express.json(), (req, res) => {
  // Add or update environment configuration
  const { key, name, server, database, username, password, encrypt, trustCert, integratedSecurity } = req.body;
  
  if (!key || !server || !database) {
    return res.status(400).json({ success: false, message: 'Key, server, and database are required' });
  }
  
  // Build connection configuration
  const config = {
    server: server.includes(':') ? server.split(':')[0] : server,
    port: server.includes(':') ? parseInt(server.split(':')[1]) : 1433,
    database,
    options: {
      encrypt: encrypt !== false,
      trustServerCertificate: trustCert !== false
    }
  };
  
  if (integratedSecurity !== false && !username) {
    config.options.trustedConnection = true;
  } else if (username) {
    config.user = username;
    config.password = password || '';
  }
  
  // Save configuration (in production, this would save to a config file or database)
  sqlConfigs[key.toUpperCase()] = config;
  
  res.json({ success: true, message: `Environment '${key}' configured successfully` });
});

app.delete('/api/environments/:key', (req, res) => {
  // Remove environment configuration
  const key = req.params.key.toUpperCase();
  
  if (!sqlConfigs[key]) {
    return res.status(404).json({ success: false, message: 'Environment not found' });
  }
  
  // Close connection if exists
  if (pools[key] && pools[key].connected) {
    pools[key].close().catch(() => {});
    delete pools[key];
  }
  
  // Remove configuration
  delete sqlConfigs[key];
  
  res.json({ success: true, message: `Environment '${key}' removed successfully` });
});

// Note: destructive statements (CREATE/ALTER/DROP/etc.) are permitted by the server

const sqlConfigs = {
  DEV: {
    user: 'test_user', password: 'P@ssword123$', server: 'dbms-aipoc01', database: 'AutopilotDev', options: { encrypt: false, trustServerCertificate: false }
  },
  TEST: {
    user: 'test_user', password: 'P@ssword123$', server: 'dbms-aipoc01', database: 'AutopilotTest', options: { encrypt: false, trustServerCertificate: false }
  },
  LIVE: {
    user: 'test_user', password: 'P@ssword123$', server: 'dbms-aipoc01', database: 'AutopilotProd', options: { encrypt: false, trustServerCertificate: false }
  },
  // Alias for production to match common terminology
  PROD: {
    user: 'test_user', password: 'P@ssword123$', server: 'dbms-aipoc01', database: 'AutopilotProd', options: { encrypt: false, trustServerCertificate: false }
  },
};

// connection pools per environment (DEV/TEST/LIVE)
const pools = {};

// GIT commit & push endpoint
app.post('/git-update', (req, res) => {
  const msg = req.body.message || 'Update';
  exec(`git add . && git commit -m "${msg}" && git push`, (err, stdout, stderr) => {
    if (err) return res.json({ success: false, stderr });
    res.json({ success: true, stdout });
  });
});

// Test route immediately after git-update
app.get('/test-after-git', (req, res) => {
  res.json({ message: 'Route after git-update works!' });
});

// Real Git API endpoints
app.get('/api/git/history', async (req, res) => {
  console.log('Git history endpoint accessed');
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get Git log with proper format
    const { stdout } = await execAsync(`git log --oneline -n ${limit} --format="%H|%ai|%an|%ae|%s"`, { cwd: __dirname });
    
    if (!stdout.trim()) {
      return res.json({ success: true, history: [] });
    }
    
    const history = stdout.trim().split('\n').map(line => {
      const [hash, date, author, email, ...messageParts] = line.split('|');
      const message = messageParts.join('|');
      
      return {
        hash: hash?.trim(),
        shortHash: hash?.substring(0, 8),
        date: date?.trim(),
        author: author?.trim(),
        email: email?.trim(),
        message: message?.trim()
      };
    });
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('Git history error:', error);
    res.json({ success: false, error: error.message, history: [] });
  }
});

app.get('/api/git/status', async (req, res) => {
  console.log('Git status endpoint accessed');
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const fs = require('fs');
    const path = require('path');
    
    const scriptsDir = path.join(__dirname, 'scripts');
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    
    const scriptFiles = fs.readdirSync(scriptsDir).length;
    
    // Get recent Git commits
    const { stdout } = await execAsync('git log --oneline -n 5 --format="%h|%ai|%an|%s"', { cwd: __dirname });
    const recentCommits = stdout.trim() ? stdout.trim().split('\n').map(line => {
      const [hash, date, author, ...messageParts] = line.split('|');
      return {
        hash: hash?.trim(),
        date: date?.trim(),
        author: author?.trim(),
        message: messageParts.join('|').trim()
      };
    }) : [];
    
    res.json({
      success: true,
      status: 'active',
      totalScripts: scriptFiles,
      recentCommits
    });
  } catch (error) {
    console.error('Git status error:', error);
    res.json({ success: false, error: error.message, totalScripts: 0, recentCommits: [] });
  }
});

app.get('/api/git/object-history/:type/:schema/:name', (req, res, next) => {
  console.log('Git object history endpoint accessed (forwarding to final handler)');
  // Forward to the enhanced handler declared later in the file
  return next();
});

// Git diff endpoint for specific commits
app.get('/api/git/diff/:hash', async (req, res) => {
  console.log('Git diff endpoint accessed');
  try {
    const { hash } = req.params;
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get the diff for the specific commit
    const { stdout } = await execAsync(`git show ${hash} --format="%H|%ai|%an|%ae|%s"`, { cwd: __dirname });
    
    if (!stdout.trim()) {
      return res.json({ success: false, error: 'Commit not found' });
    }
    
    const lines = stdout.trim().split('\n');
    const commitInfo = lines[0].split('|');
    
    // Extract commit details
    const commit = {
      hash: commitInfo[0]?.trim(),
      date: commitInfo[1]?.trim(),
      author: commitInfo[2]?.trim(),
      email: commitInfo[3]?.trim(),
      message: commitInfo.slice(4).join('|').trim()
    };
    
    // Extract diff content (everything after the first line)
    const diffContent = lines.slice(1).join('\n');
    
    res.json({
      success: true,
      commit,
      diff: diffContent
    });
  } catch (error) {
    console.error('Git diff error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Git diff for specific file
app.get('/api/git/diff/:hash/file/:filepath', async (req, res) => {
  console.log('Git file diff endpoint accessed');
  try {
    const { hash, filepath } = req.params;
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get the diff for the specific file in the commit
    const { stdout } = await execAsync(`git show ${hash} -- "${filepath}"`, { cwd: __dirname });
    
    if (!stdout.trim()) {
      return res.json({ success: false, error: 'File or commit not found' });
    }
    
    res.json({
      success: true,
      filepath,
      diff: stdout
    });
  } catch (error) {
    console.error('Git file diff error:', error);
    res.json({ success: false, error: error.message });
  }
});

// SQL connect endpoint
app.get('/sql-connect/:env', async (req, res) => {
  const env = req.params.env;
  if (!sqlConfigs[env]) return res.status(400).send('Invalid environment');
  try {
    // reuse existing pool when available
    if (pools[env] && pools[env].connected) {
      return res.json({ success: true, message: `Already connected to ${env}` });
    }
    const pool = new sql.ConnectionPool(sqlConfigs[env]);
    pools[env] = pool;
    await pool.connect();
    return res.json({ success: true, message: `Connected to ${env}` });
  } catch (e) {
    // cleanup if we created a pool
    try { if (pools[env]) { await pools[env].close(); delete pools[env]; } } catch(_){}
    return res.json({ success: false, message: e.message });
  }
});

// Execute SQL script endpoint
app.post('/execute-sql', async (req, res) => {
  const { env, script } = req.body || {};
  // Normalize script: can arrive as string, array (PS Get-Content), or object
  const normalizeScript = (s) => {
    if (typeof s === 'string') return s;
    if (Array.isArray(s)) return s.join('\n');
    if (s && typeof s === 'object') {
      // Attempt common wrappers
      if (typeof s.value === 'string') return s.value;
      if (Array.isArray(s.value)) return s.value.join('\n');
      try { return String(s); } catch { return ''; }
    }
    return '';
  };
  const scriptText = normalizeScript(script);

  if (!env || !scriptText) return res.status(400).json({ success: false, message: 'env and script are required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  // No duplicate destructive checks here; handled by checkDestructiveAllowed earlier
  if (scriptText.length > 20000) return res.status(400).json({ success: false, message: 'Script too long' });

  try {
    // helper to execute script and handle 'GO' batch separators
    async function executeScriptOnPool(pool, scriptText) {
      // split on lines that contain only GO (case-insensitive)
      const parts = scriptText.split(/^\s*GO\s*$/gim).map(p => p.trim()).filter(Boolean);
      let lastRecordset = null;
      const rowsAffectedAll = [];
      for (const p of parts) {
        // use batch to allow multiple statements; fall back to query if batch fails
        try {
          const r = await pool.request().batch(p);
          lastRecordset = (r && r.recordset) ? r.recordset : lastRecordset;
          if (r && r.rowsAffected) rowsAffectedAll.push(...r.rowsAffected);
        } catch (inner) {
          // try query as fallback
          const r2 = await pool.request().query(p);
          lastRecordset = (r2 && r2.recordset) ? r2.recordset : lastRecordset;
          if (r2 && r2.rowsAffected) rowsAffectedAll.push(...r2.rowsAffected);
        }
      }
      return { recordset: lastRecordset, rowsAffected: rowsAffectedAll };
    }

    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) {
      pool = new sql.ConnectionPool(sqlConfigs[env]);
      await pool.connect();
      created = true;
    }
    const result = await executeScriptOnPool(pool, scriptText);
    if (created) await pool.close();
    return res.json({ success: true, recordset: result.recordset, rowsAffected: result.rowsAffected });
  } catch (e) {
    console.error('/execute-sql error', e && e.stack ? e.stack : e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Execute SQL script by filename in ./scripts (avoids large JSON payloads)
console.log('Registering route: POST /execute-sql-file');
app.post('/execute-sql-file', async (req, res) => {
  try {
    const { env, filename } = req.body || {};
    if (!env || !filename) return res.status(400).json({ success: false, message: 'env and filename are required' });
    if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });

    // Basic security: prevent path traversal
    const safeName = path.basename(filename);
    const fullPath = path.join(__dirname, 'scripts', safeName);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'Script file not found' });

    const scriptText = fs.readFileSync(fullPath, 'utf8');
    if (!scriptText) return res.status(400).json({ success: false, message: 'Script file is empty' });
    if (scriptText.length > 200000) return res.status(400).json({ success: false, message: 'Script too long' });

    // GO-aware execution helper
    async function executeScriptOnPool(pool, text) {
      const parts = text.split(/^\s*GO\s*$/gim).map(p => p.trim()).filter(Boolean);
      let lastRecordset = null;
      const rowsAffectedAll = [];
      for (const p of parts) {
        try {
          const r = await pool.request().batch(p);
          lastRecordset = (r && r.recordset) ? r.recordset : lastRecordset;
          if (r && r.rowsAffected) rowsAffectedAll.push(...r.rowsAffected);
        } catch (inner) {
          const r2 = await pool.request().query(p);
          lastRecordset = (r2 && r2.recordset) ? r2.recordset : lastRecordset;
          if (r2 && r2.rowsAffected) rowsAffectedAll.push(...r2.rowsAffected);
        }
      }
      return { recordset: lastRecordset, rowsAffected: rowsAffectedAll };
    }

    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) {
      pool = new sql.ConnectionPool(sqlConfigs[env]);
      await pool.connect();
      created = true;
    }
    const result = await executeScriptOnPool(pool, scriptText);
    if (created) await pool.close();
    return res.json({ success: true, recordset: result.recordset, rowsAffected: result.rowsAffected });
  } catch (e) {
    console.error('/execute-sql-file error', e && e.stack ? e.stack : e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Lightweight GET executor to avoid JSON body size/encoding issues
// Usage: /run-script?env=DEV&file=006_create_lead_table.sql
console.log('Registering route: GET /run-script');
app.get('/run-script', async (req, res) => {
  try {
    const env = req.query.env;
    const filename = req.query.file || req.query.filename;
    if (!env || !filename) return res.status(400).json({ success: false, message: 'env and file are required' });
    if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });

    const safeName = path.basename(String(filename));
    const fullPath = path.join(__dirname, 'scripts', safeName);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'Script file not found' });

    const scriptText = fs.readFileSync(fullPath, 'utf8');
    if (!scriptText) return res.status(400).json({ success: false, message: 'Script file is empty' });

    async function executeScriptOnPool(pool, text) {
      const parts = text.split(/^\s*GO\s*$/gim).map(p => p.trim()).filter(Boolean);
      let lastRecordset = null;
      const rowsAffectedAll = [];
      for (const p of parts) {
        try {
          const r = await pool.request().batch(p);
          lastRecordset = (r && r.recordset) ? r.recordset : lastRecordset;
          if (r && r.rowsAffected) rowsAffectedAll.push(...r.rowsAffected);
        } catch (inner) {
          const r2 = await pool.request().query(p);
          lastRecordset = (r2 && r2.recordset) ? r2.recordset : lastRecordset;
          if (r2 && r2.rowsAffected) rowsAffectedAll.push(...r2.rowsAffected);
        }
      }
      return { recordset: lastRecordset, rowsAffected: rowsAffectedAll };
    }

    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) {
      pool = new sql.ConnectionPool(sqlConfigs[env]);
      await pool.connect();
      created = true;
    }
    const result = await executeScriptOnPool(pool, scriptText);
    if (created) await pool.close();
    return res.json({ success: true, recordset: result.recordset, rowsAffected: result.rowsAffected });
  } catch (e) {
    console.error('/run-script error', e && e.stack ? e.stack : e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 20000 * 2 }, // 40KB max file size
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/plain' && path.extname(file.originalname) !== '.sql') {
      return cb(new Error('Only .sql or .txt files allowed'));
    }
    cb(null, true);
  }
});

// Endpoint to upload and execute SQL script file
app.post('/upload-sql', upload.single('scriptFile'), async (req, res) => {
  const env = req.body.env;
  if (!env || !sqlConfigs[env]) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'Invalid or missing environment' });
  }
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  try {
    const script = fs.readFileSync(req.file.path, 'utf8');
    fs.unlinkSync(req.file.path);

    if (script.length > 20000) {
      return res.status(400).json({ success: false, message: 'Script too long' });
    }

    // execute using same GO-aware helper as /execute-sql
    async function executeScriptOnPool(pool, scriptText) {
      const parts = scriptText.split(/^\s*GO\s*$/gim).map(p => p.trim()).filter(Boolean);
      let lastRecordset = null;
      const rowsAffectedAll = [];
      for (const p of parts) {
        try {
          const r = await pool.request().batch(p);
          lastRecordset = (r && r.recordset) ? r.recordset : lastRecordset;
          if (r && r.rowsAffected) rowsAffectedAll.push(...r.rowsAffected);
        } catch (inner) {
          const r2 = await pool.request().query(p);
          lastRecordset = (r2 && r2.recordset) ? r2.recordset : lastRecordset;
          if (r2 && r2.rowsAffected) rowsAffectedAll.push(...r2.rowsAffected);
        }
      }
      return { recordset: lastRecordset, rowsAffected: rowsAffectedAll };
    }

    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) {
      pool = new sql.ConnectionPool(sqlConfigs[env]);
      await pool.connect();
      created = true;
    }
    const result = await executeScriptOnPool(pool, script);
    if (created) await pool.close();
    return res.json({ success: true, recordset: result.recordset, rowsAffected: result.rowsAffected });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Ensure scripts directory exists
const scriptsDir = path.join(__dirname, 'scripts');
if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

// Ensure logs directory exists and provide a simple audit logger
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const auditLogPath = path.join(logsDir, 'audit.log');
async function writeAudit(entry) {
  try {
    const line = JSON.stringify(entry) + '\n';
    await fs.promises.appendFile(auditLogPath, line, 'utf8');
  } catch (e) {
    // best-effort, do not throw
    console.error('Audit write failed', e.message);
  }
}

// Helper to format objects list as DB.Schema.Name for commit messages
function formatObjectsForCommit(envKey, objects) {
  try {
    const db = (sqlConfigs && envKey && sqlConfigs[envKey] && sqlConfigs[envKey].database) ? sqlConfigs[envKey].database : String(envKey || 'unknown');
    const arr = Array.isArray(objects) ? objects : (objects ? [objects] : []);
    const norm = arr
      .map(o => {
        if (!o) return null;
        if (typeof o === 'string') {
          // Accept already dotted strings like Schema.Name
          return `${db}.${o}`;
        }
        if (o && typeof o === 'object') {
          const schema = o.schema || 'dbo';
          const name = o.name || o.table || o.object || '';
          if (!name) return null;
          return `${db}.${schema}.${name}`;
        }
        return null;
      })
      .filter(Boolean);
    return norm.join(', ');
  } catch (_) {
    return Array.isArray(objects) ? objects.join(', ') : (objects || 'multiple');
  }
}

// DB-backed audit: ensure table exists and insert rows
const auditTableEnsured = {};
async function ensureAuditTableInDb(env) {
  if (!env || auditTableEnsured[env]) return;
  if (!sqlConfigs[env]) return;
  const createSql = `IF OBJECT_ID('dbo.ddl_audit','U') IS NULL BEGIN
    CREATE TABLE dbo.ddl_audit (
      id INT IDENTITY(1,1) PRIMARY KEY,
      [timestamp] DATETIME2 NULL,
      [action] NVARCHAR(50) NULL,
      [env] NVARCHAR(50) NULL,
      [dryRun] BIT NULL,
      [success] BIT NULL,
      [rowsAffected] NVARCHAR(MAX) NULL,
      [error] NVARCHAR(MAX) NULL,
      [scriptPreview] NVARCHAR(MAX) NULL,
      [userName] NVARCHAR(200) NULL,
      [correlationId] NVARCHAR(200) NULL,
      [gitCommit] NVARCHAR(200) NULL,
      [clientIp] NVARCHAR(200) NULL
    ); END`;
  let pool = pools[env];
  let created = false;
  try {
    if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
    await pool.request().batch(createSql);
    auditTableEnsured[env] = true;
  } catch (e) {
    console.error('ensureAuditTableInDb failed for', env, e.message);
  } finally {
    if (created && pool) try { await pool.close(); } catch (_) {}
  }
}

async function writeAuditDb(entry) {
  if (!entry || !entry.env) return;
  const env = entry.env;
  if (!sqlConfigs[env]) return;
  try {
    await ensureAuditTableInDb(env);
    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
    const req = pool.request();
    req.input('timestamp', sql.DateTime2, entry.timestamp ? new Date(entry.timestamp) : new Date());
    req.input('action', sql.NVarChar(50), entry.action || null);
    req.input('env', sql.NVarChar(50), entry.env || null);
    req.input('dryRun', sql.Bit, entry.dryRun ? 1 : 0);
    req.input('success', sql.Bit, entry.success ? 1 : 0);
    const rowsAffectedVal = Array.isArray(entry.rowsAffected) ? JSON.stringify(entry.rowsAffected) : (entry.rowsAffected ? String(entry.rowsAffected) : null);
    req.input('rowsAffected', sql.NVarChar(sql.MAX), rowsAffectedVal);
  req.input('error', sql.NVarChar(sql.MAX), entry.error || null);
  req.input('scriptPreview', sql.NVarChar(sql.MAX), entry.scriptPreview || null);
  req.input('userName', sql.NVarChar(200), entry.user || null);
  req.input('correlationId', sql.NVarChar(200), entry.correlationId || null);
  req.input('gitCommit', sql.NVarChar(200), entry.gitCommit || null);
  req.input('clientIp', sql.NVarChar(200), entry.clientIp || null);
  await req.query(`INSERT INTO dbo.ddl_audit ([timestamp],[action],[env],[dryRun],[success],[rowsAffected],[error],[scriptPreview],[userName],[correlationId],[gitCommit],[clientIp]) VALUES (@timestamp,@action,@env,@dryRun,@success,@rowsAffected,@error,@scriptPreview,@userName,@correlationId,@gitCommit,@clientIp)`);
    if (created && pool) try { await pool.close(); } catch (_) {}
  } catch (e) {
    console.error('DB audit failed', e.message);
  }
}

// Wrap the original writeAudit to also attempt DB write (fire-and-forget)
const originalWriteAudit = writeAudit;
writeAudit = async function(entry) {
  try { await originalWriteAudit(entry); } catch (e) { console.error('file audit failed', e.message); }
  // attempt DB write but don't await (best-effort)
  writeAuditDb(entry).catch(() => {});
};

// endpoint to read recent audit file lines
app.get('/audit', (req, res) => {
  try {
    if (!fs.existsSync(auditLogPath)) return res.json({ success: true, entries: [] });
    const raw = fs.readFileSync(auditLogPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    // return last 200 lines by default
    const tail = lines.slice(-200);
    const entries = tail.map(l => {
      try { return JSON.parse(l); } catch (e) { return { raw: l }; }
    });
    return res.json({ success: true, entries });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// List available script files
app.get('/scripts', (req, res) => {
  try {
    const files = fs.readdirSync(scriptsDir).filter(f => path.extname(f).toLowerCase() === '.sql');
    res.json({ success: true, scripts: files });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Debug endpoint for scripts directory
app.get('/scripts/debug', (req, res) => {
  try {
    const exists = fs.existsSync(scriptsDir);
    let files = [];
    let statOk = null;
    try { files = exists ? fs.readdirSync(scriptsDir) : []; statOk = files.map(f => ({ name: f, stat: fs.statSync(path.join(scriptsDir, f)).isFile() })); } catch (e) { statOk = { error: e.message }; }
    return res.json({ success: true, scriptsDir: scriptsDir, exists, files, stat: statOk });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Return script file content (safe): GET /scripts/content?filename=foo.sql
app.get('/scripts/content', (req, res) => {
  try {
    const filename = req.query.filename;
    if (!filename) return res.status(400).json({ success: false, message: 'filename required' });
    if (path.basename(filename) !== filename || path.extname(filename).toLowerCase() !== '.sql') return res.status(400).json({ success: false, message: 'Invalid filename' });
    const fullPath = path.join(scriptsDir, filename);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'Script not found' });
    const content = fs.readFileSync(fullPath, 'utf8');
    return res.json({ success: true, content });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Run a named script from scripts/ on selected environment
app.post('/run-script', async (req, res) => {
  const { env, filename } = req.body || {};
  if (!env || !filename) return res.status(400).json({ success: false, message: 'env and filename are required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });

  // Prevent path traversal, ensure filename ends with .sql and exists in scriptsDir
  if (path.basename(filename) !== filename || path.extname(filename).toLowerCase() !== '.sql') {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  const fullPath = path.join(scriptsDir, filename);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'Script not found' });

  try {
    const script = fs.readFileSync(fullPath, 'utf8');

    if (script.length > 20000) {
      return res.status(400).json({ success: false, message: 'Script too long' });
    }

    // GO-aware execution helper
    async function executeScriptOnPool(pool, scriptText) {
      const parts = scriptText.split(/^\s*GO\s*$/gim).map(p => p.trim()).filter(Boolean);
      let lastRecordset = null;
      const rowsAffectedAll = [];
      for (const p of parts) {
        try {
          const r = await pool.request().batch(p);
          lastRecordset = (r && r.recordset) ? r.recordset : lastRecordset;
          if (r && r.rowsAffected) rowsAffectedAll.push(...r.rowsAffected);
        } catch (inner) {
          const r2 = await pool.request().query(p);
          lastRecordset = (r2 && r2.recordset) ? r2.recordset : lastRecordset;
          if (r2 && r2.rowsAffected) rowsAffectedAll.push(...r2.rowsAffected);
        }
      }
      return { recordset: lastRecordset, rowsAffected: rowsAffectedAll };
    }

    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) {
      pool = new sql.ConnectionPool(sqlConfigs[env]);
      await pool.connect();
      created = true;
    }
    const result = await executeScriptOnPool(pool, script);
    if (created) await pool.close();
    return res.json({ success: true, recordset: result.recordset, rowsAffected: result.rowsAffected });
  } catch (e) {
    // Log server-side for diagnostics and return structured JSON (avoid raw 500 network error page)
    console.error('/run-script error', e && e.stack ? e.stack : e);
    try { return res.json({ success: false, message: e.message || String(e) }); } catch (err) { return res.status(500).json({ success: false, message: 'Unexpected server error' }); }
  }
});

// --- Git remote management endpoints ---
const validRemoteName = name => /^[A-Za-z0-9._-]+$/.test(name);
const validRemoteUrl = url => /^(https?:\/\/|git@)[^\s]+$/.test(url);

// List remotes with their URLs
app.get('/git/remotes', async (req, res) => {
  try {
    // get list of remote names
    execFile('git', ['remote'], { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) return res.status(500).json({ success: false, message: stderr || err.message });
      const names = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (names.length === 0) return res.json({ success: true, remotes: [] });
      const results = [];
      let remaining = names.length;
      names.forEach(name => {
        execFile('git', ['remote', 'get-url', name], { cwd: __dirname }, (e2, out2, s2) => {
          const url = (!e2 && out2) ? out2.trim() : null;
          results.push({ name, url });
          remaining -= 1;
          if (remaining === 0) res.json({ success: true, remotes: results });
        });
      });
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Add a new remote
app.post('/git/remote/add', (req, res) => {
  const { name, url } = req.body || {};
  if (!name || !url) return res.status(400).json({ success: false, message: 'name and url required' });
  if (!validRemoteName(name) || !validRemoteUrl(url)) return res.status(400).json({ success: false, message: 'Invalid name or url format' });
  execFile('git', ['remote', 'add', name, url], { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ success: false, message: stderr || err.message });
    res.json({ success: true, stdout });
  });
});

// Set URL for existing remote
app.post('/git/remote/set-url', (req, res) => {
  const { name, url } = req.body || {};
  if (!name || !url) return res.status(400).json({ success: false, message: 'name and url required' });
  if (!validRemoteName(name) || !validRemoteUrl(url)) return res.status(400).json({ success: false, message: 'Invalid name or url format' });
  execFile('git', ['remote', 'set-url', name, url], { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ success: false, message: stderr || err.message });
    res.json({ success: true, stdout });
  });
});

// Remove a remote
app.post('/git/remote/remove', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ success: false, message: 'name required' });
  if (!validRemoteName(name)) return res.status(400).json({ success: false, message: 'Invalid name' });
  execFile('git', ['remote', 'remove', name], { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ success: false, message: stderr || err.message });
    res.json({ success: true, stdout });
  });
});

// Run script via PowerShell dbatools wrapper
app.post('/ps/run-script', async (req, res) => {
  const { env, filename } = req.body || {};
  if (!env || !filename) return res.status(400).json({ success: false, message: 'env and filename required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });

  if (path.basename(filename) !== filename || path.extname(filename).toLowerCase() !== '.sql') {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  const fullPath = path.join(scriptsDir, filename);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ success: false, message: 'Script not found' });

  // Map env to sql instance & database from sqlConfigs
  const cfg = sqlConfigs[env];
  const sqlInstance = cfg.server; // expects host[:port]
  const database = cfg.database;

  // Try pwsh then powershell
  const psCandidates = [ 'pwsh', 'powershell' ];
  const ps = psCandidates.find(p => {
    try { execFile(p, ['-v'], { stdio: 'ignore' }); return true; } catch { return false; }
  }) || 'powershell';

  const scriptPath = path.join(__dirname, 'tools', 'run-dbatools.ps1');
  const args = [ '-NoProfile', '-NonInteractive', '-File', scriptPath, '-SqlInstance', sqlInstance, '-Database', database, '-File', fullPath ];
  execFile(ps, args, { cwd: __dirname, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      // If PowerShell returned JSON error, try parse
      try { const parsed = JSON.parse(stdout || stderr); return res.status(500).json({ success: false, details: parsed }); } catch (e) { return res.status(500).json({ success: false, message: stderr || err.message }); }
    }
    try {
      const parsed = JSON.parse(stdout);
      return res.json({ success: true, result: parsed });
    } catch (e) {
      return res.status(500).json({ success: false, message: 'Invalid JSON from PowerShell', raw: stdout.substring(0, 10000) });
    }
  });
});

// Disconnect endpoint - closes pooled connection for an environment
app.post('/sql-disconnect/:env', async (req, res) => {
  const env = req.params.env;
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  try {
    if (pools[env]) {
      try { await pools[env].close(); } catch (_) {}
      delete pools[env];
    }
    return res.json({ success: true, message: `Disconnected from ${env}` });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// --- DDL compare / plan / apply endpoints ---

// simple utility: split column list respecting parentheses
function splitColumns(columnText) {
  const cols = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < columnText.length; i++) {
    const ch = columnText[i];
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) cols.push(cur.trim());
  return cols.filter(Boolean);
}

// parse CREATE TABLE statements from script
function parseCreateTables(script) {
  const re = /create\s+table\s+([\[\]"\w\.]+)\s*\(([^;]+?)\)\s*(;|$)/ig;
  const matches = [];
  let m;
  while ((m = re.exec(script))) {
    let fullname = m[1].trim();
    // remove brackets/quotes
    fullname = fullname.replace(/^[\[\]"]+|[\[\]"]+$/g, '');
    let schema = 'dbo';
    let table = fullname;
    if (fullname.indexOf('.') !== -1) {
      const parts = fullname.split('.');
      schema = parts[0].replace(/^[\[\]"]+|[\[\]"]+$/g, '') || 'dbo';
      table = parts[1].replace(/^[\[\]"]+|[\[\]"]+$/g, '');
    }
    const colsText = m[2].trim();
    const colList = splitColumns(colsText).map(c => ({ raw: c }));
    matches.push({ schema, table, raw: m[0], columns: colList });
  }
  return matches;
}

// parse ALTER TABLE statements (ADD/DROP/ALTER COLUMN)
function parseAlterStatements(script) {
  const alters = [];
  // simple regexes for ADD, DROP COLUMN, ALTER COLUMN
  const reAdd = /alter\s+table\s+([\[\]"\w\.]+)\s+add\s+\(?([^;]+?)\)?\s*(;|$)/ig;
  const reDrop = /alter\s+table\s+([\[\]"\w\.]+)\s+drop\s+column\s+([^;]+?)\s*(;|$)/ig;
  const reAlter = /alter\s+table\s+([\[\]"\w\.]+)\s+alter\s+column\s+([^;]+?)\s*(;|$)/ig;
  let m;
  while ((m = reAdd.exec(script))) {
    let fullname = m[1].trim().replace(/^[\[\]"]+|[\[\]"]+$/g, '');
    let schema = 'dbo', table = fullname;
    if (fullname.indexOf('.') !== -1) { const parts = fullname.split('.'); schema = parts[0]; table = parts[1]; }
    alters.push({ type: 'ADD', schema, table, raw: m[0], colsText: m[2].trim() });
  }
  while ((m = reDrop.exec(script))) {
    let fullname = m[1].trim().replace(/^[\[\]"]+|[\[\]"]+$/g, '');
    let schema = 'dbo', table = fullname;
    if (fullname.indexOf('.') !== -1) { const parts = fullname.split('.'); schema = parts[0]; table = parts[1]; }
    alters.push({ type: 'DROP', schema, table, raw: m[0], colsText: m[2].trim() });
  }
  while ((m = reAlter.exec(script))) {
    let fullname = m[1].trim().replace(/^[\[\]"]+|[\[\]"]+$/g, '');
    let schema = 'dbo', table = fullname;
    if (fullname.indexOf('.') !== -1) { const parts = fullname.split('.'); schema = parts[0]; table = parts[1]; }
    alters.push({ type: 'ALTER', schema, table, raw: m[0], colsText: m[2].trim() });
  }
  return alters;
}

// fetch current columns for a table from the DB
async function getDbColumns(env, schema, table) {
  if (!sqlConfigs[env]) throw new Error('Invalid environment');
  // use pooled connection if available
  let pool = pools[env];
  let created = false;
  if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
  const q = `SELECT c.name AS column_name, t.name AS type_name, c.max_length, c.precision, c.scale, c.is_nullable, OBJECT_DEFINITION(c.default_object_id) AS default_definition,
             c.is_computed, cc.definition AS computed_definition
             FROM sys.columns c
             LEFT JOIN sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
             JOIN sys.types t ON c.user_type_id = t.user_type_id
             WHERE c.object_id = OBJECT_ID(@fullname)`;
  const fullname = `[${schema}].[${table}]`;
  const result = await pool.request().input('fullname', sql.NVarChar, fullname).query(q);
  if (created) await pool.close();
  return (result.recordset || []).map(r => ({ name: r.column_name, type: r.type_name, max_length: r.max_length, precision: r.precision, scale: r.scale, is_nullable: r.is_nullable, default_definition: r.default_definition, is_computed: !!r.is_computed, computed_definition: r.computed_definition }));
}

// list tables in an environment
app.get('/db/objects', async (req, res) => {
  const env = (req.query.env || '').toString();
  if (!env || !sqlConfigs[env]) return res.status(400).json({ success: false, message: 'env query param required and must be a valid environment' });
  try {
    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
    // gather tables, views, procedures, functions, triggers, indexes
    const objects = [];
    // tables
    const qTables = `SELECT s.name AS schema_name, t.name AS name FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id`;
    const rTables = await pool.request().query(qTables);
    (rTables.recordset || []).forEach(rw => objects.push({ type: 'TABLE', schema: rw.schema_name, name: rw.name }));
    // views
    const qViews = `SELECT s.name AS schema_name, v.name AS name FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id`;
    const rViews = await pool.request().query(qViews);
    (rViews.recordset || []).forEach(rw => objects.push({ type: 'VIEW', schema: rw.schema_name, name: rw.name }));
    // procedures
    const qProcs = `SELECT s.name AS schema_name, p.name AS name FROM sys.procedures p JOIN sys.schemas s ON p.schema_id = s.schema_id`;
    const rProcs = await pool.request().query(qProcs);
    (rProcs.recordset || []).forEach(rw => objects.push({ type: 'PROCEDURE', schema: rw.schema_name, name: rw.name }));
    // functions (scalar/table-valued)
    const qFuncs = `SELECT s.name AS schema_name, o.name AS name, o.type FROM sys.objects o JOIN sys.schemas s ON o.schema_id = s.schema_id WHERE o.type IN ('FN','IF','TF','FS','FT')`;
    const rFuncs = await pool.request().query(qFuncs);
    (rFuncs.recordset || []).forEach(rw => objects.push({ type: 'FUNCTION', schema: rw.schema_name, name: rw.name }));
    // table-level triggers
    const qTriggers = `SELECT s.name AS schema_name, t.name AS trigger_name, OBJECT_NAME(t.parent_id) AS parent_table FROM sys.triggers t JOIN sys.objects o ON t.parent_id = o.object_id JOIN sys.schemas s ON o.schema_id = s.schema_id WHERE t.parent_id IS NOT NULL`;
    const rTriggers = await pool.request().query(qTriggers);
    (rTriggers.recordset || []).forEach(rw => objects.push({ type: 'TRIGGER', schema: rw.schema_name, table: rw.parent_table, name: rw.trigger_name }));
    // indexes
    const qIdx = `SELECT s.name AS schema_name, o.name AS table_name, i.name AS index_name FROM sys.indexes i JOIN sys.objects o ON i.object_id = o.object_id JOIN sys.schemas s ON o.schema_id = s.schema_id WHERE i.is_primary_key = 0 AND i.name IS NOT NULL`;
    const rIdx = await pool.request().query(qIdx);
    (rIdx.recordset || []).forEach(rw => objects.push({ type: 'INDEX', schema: rw.schema_name, table: rw.table_name, name: rw.index_name }));

    if (created) await pool.close();
    return res.json({ success: true, objects });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Build a minimal CREATE TABLE script (plus PK/index statements) from current table metadata
async function getCreateTableScript(env, schema, table) {
  const cols = await getDbColumns(env, schema, table);
  const meta = await getTableMetadataSql(env, schema, table);
  const fullname = `[${schema}].[${table}]`;
  const colDefs = cols.map(c => {
    // computed column handling
    if (c.is_computed) {
      // computed columns have their definition in computed_definition
      return `[${c.name}] AS (${c.computed_definition})`;
    }
    // build type string
    let type = c.type;
    const t = type.toLowerCase();
    if (['varchar','nvarchar','varbinary','char','nchar'].includes(t)) {
      if (c.max_length === -1) {
        type = `${type}(MAX)`;
      } else {
        // For nvarchar/nchar, SQL Server stores length in bytes, so divide by 2 for character count
        const displayLength = (t === 'nvarchar' || t === 'nchar') ? c.max_length / 2 : c.max_length;
        type = `${type}(${displayLength})`;
      }
    } else if (t === 'decimal' || t === 'numeric') {
      type = `${type}(${c.precision || 18},${c.scale || 0})`;
    }
    const def = c.default_definition ? ` DEFAULT ${c.default_definition}` : '';
    const nullity = c.is_nullable ? 'NULL' : 'NOT NULL';
    return `[${c.name}] ${type} ${nullity}${def}`;
  });
  const create = `CREATE TABLE ${fullname} (\n  ${colDefs.join(',\n  ')}\n);`;
  const extras = [];
  if (meta.primaryKey) extras.push(meta.primaryKey);
  if (meta.indexes && meta.indexes.length) extras.push(...meta.indexes);
  // defaults may have been included in column defs, but include constraints if any remained
  Object.keys(meta.defaults || {}).forEach(col => {
    const d = meta.defaults[col];
    if (d && d.definition) extras.push(`ALTER TABLE ${fullname} ADD CONSTRAINT [${d.constraint}] DEFAULT ${d.definition} FOR [${col}]`);
  });
  // include check constraints
  try {
    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
    const qChecks = `SELECT cc.name AS constraint_name, OBJECT_DEFINITION(cc.object_id) AS definition FROM sys.check_constraints cc WHERE cc.parent_object_id = OBJECT_ID(@fullname)`;
    const rChecks = await pool.request().input('fullname', sql.NVarChar, fullname).query(qChecks);
    (rChecks.recordset || []).forEach(r => { if (r.definition) extras.push(r.definition); });
    // include triggers
    const qTrig = `SELECT t.name AS trigger_name, OBJECT_DEFINITION(t.object_id) AS definition FROM sys.triggers t WHERE t.parent_id = OBJECT_ID(@fullname) AND t.is_ms_shipped = 0`;
    const rTrig = await pool.request().input('fullname', sql.NVarChar, fullname).query(qTrig);
    (rTrig.recordset || []).forEach(r => { if (r.definition) extras.push(r.definition); });
    if (created) await pool.close();
  } catch (e) {
    // ignore extras failure
  }
  return { create, extras: extras.join('\n') };
}

// get object dependencies (what the object references)
async function getObjectDependencies(env, schema, name) {
  if (!env || !sqlConfigs[env]) throw new Error('Invalid environment');
  const fullname = `[${schema}].[${name}]`;
  let pool = pools[env]; let created = false;
  if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
  try {
    const q = `SELECT referenced_schema_name, referenced_entity_name, referenced_class_desc
               FROM sys.sql_expression_dependencies
               WHERE referencing_id = OBJECT_ID(@fullname)`;
    const r = await pool.request().input('fullname', sql.NVarChar, fullname).query(q);
    const deps = (r.recordset || []).map(rr => ({ schema: rr.referenced_schema_name || 'dbo', name: rr.referenced_entity_name, class: rr.referenced_class_desc } )).filter(d => d.name);
    return deps;
  } finally { if (created) try { await pool.close(); } catch(_) {} }
}

// get table row count and sample rows (top N)
async function getTableSample(env, schema, table, topN=5) {
  if (!env || !sqlConfigs[env]) throw new Error('Invalid environment');
  const fullname = `[${schema}].[${table}]`;
  let pool = pools[env]; let created = false;
  if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
  try {
    const countQ = `SELECT COUNT(*) AS cnt FROM ${fullname}`;
    const sampQ = `SELECT TOP (${topN}) * FROM ${fullname}`;
    const rc = await pool.request().query(countQ);
    const rs = await pool.request().query(sampQ);
    const cnt = (rc.recordset && rc.recordset[0]) ? rc.recordset[0].cnt : null;
    return { count: cnt, sample: rs.recordset || [] };
  } finally { if (created) try { await pool.close(); } catch(_) {} }
}

// return CREATE script for a specific object
app.get('/db/object', async (req, res) => {
  const env = (req.query.env || '').toString();
  const schema = (req.query.schema || 'dbo').toString();
  const name = (req.query.table || req.query.name || '').toString();
  const type = (req.query.type || '').toString().toUpperCase();
  if (!env || !sqlConfigs[env] || !name) return res.status(400).json({ success: false, message: 'env and name required' });
  try {
    // default to TABLE if no type provided
    const objType = type || 'TABLE';
    if (objType === 'TABLE') {
      const s = await getCreateTableScript(env, schema, name);
      // dependencies and sample rows
      let deps = [];
      try { deps = await getObjectDependencies(env, schema, name); } catch (e) { deps = []; }
      let sample = null;
      try { sample = await getTableSample(env, schema, name, 5); } catch (e) { sample = null; }
      return res.json({ success: true, type: 'TABLE', create: s.create, extras: s.extras, dependencies: deps, sample });
    }
    // for views/procs/functions/triggers, use OBJECT_DEFINITION
    if (['VIEW','PROCEDURE','FUNCTION','TRIGGER'].includes(objType)) {
      let pool = pools[env];
      let created = false;
      if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
      // find object_id
      const fullname = `[${schema}].[${name}]`;
      const q = `SELECT OBJECT_DEFINITION(OBJECT_ID(@fullname)) AS def`;
      const r = await pool.request().input('fullname', sql.NVarChar, fullname).query(q);
      if (created) await pool.close();
      const def = (r.recordset && r.recordset[0] && r.recordset[0].def) ? r.recordset[0].def : null;
      if (!def) return res.status(404).json({ success: false, message: 'Object not found or no definition available' });
      return res.json({ success: true, type: objType, create: def, extras: '' });
    }
    // index: return single index create SQL
    if (objType === 'INDEX') {
      // name parameter expected to be index name, along with table
      const table = (req.query.table || '').toString();
      if (!table) return res.status(400).json({ success: false, message: 'table parameter required for index' });
      // reuse getTableMetadataSql to get index SQLs and pick the matching one
      const meta = await getTableMetadataSql(env, schema, table);
      const matches = (meta.indexes || []).filter(sq => sq.indexOf('[' + (name) + ']') !== -1 || sq.indexOf(' ' + (name) + ' ') !== -1);
      const sqlText = matches.length ? matches[0] : ((meta.indexes && meta.indexes.length) ? meta.indexes.join('\n') : '');
      return res.json({ success: true, type: 'INDEX', create: sqlText, extras: '' });
    }
    return res.status(400).json({ success: false, message: 'Unsupported object type' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Generate diff/plan from source environment to target environment for selected objects
app.post('/ddl/diff', express.json(), async (req, res) => {
  const { fromEnv, toEnv, objects } = req.body || {};
  if (!fromEnv || !toEnv || !objects || !Array.isArray(objects) || objects.length === 0) return res.status(400).json({ success: false, message: 'fromEnv, toEnv, and objects[] are required' });
  if (!sqlConfigs[fromEnv] || !sqlConfigs[toEnv]) return res.status(400).json({ success: false, message: 'Invalid environment(s)' });
  try {
    const plans = [];
    for (const o of objects) {
      const schema = o.schema || 'dbo';
      const name = o.name || o.table || o.object || '';
      const objType = (o.type || 'TABLE').toUpperCase();
      if (!name) { plans.push({ schema, name: null, type: objType, error: 'Invalid object name', implementation: '--', rollback: '--' }); continue; }

      // for TABLEs, use enhanced diff-aware planning
      if (objType === 'TABLE') {
        let diffSummary = { added: [], removed: [], altered: [] };
        let implementation = '';
        let rollback = '';
        let notes = [];

        try {
          const srcCols = await getDbColumns(fromEnv, schema, name);
          const tgtCols = await getDbColumns(toEnv, schema, name);
          
          if (tgtCols.length === 0) {
            if (srcCols.length === 0) {
              // Source table also missing; avoid emitting invalid empty CREATE TABLE
              implementation = '-- Source table not found in source environment; no implementation generated';
              rollback = '-- No rollback needed';
              notes.push('Source table not found; skipping');
            } else {
              // Table doesn't exist in target, create it from source definition
              const s = await getCreateTableScript(fromEnv, schema, name);
              implementation = s.create + '\n' + (s.extras || '');
              rollback = `DROP TABLE [${schema}].[${name}]`;
              notes.push('Table does not exist in target; create and drop generated');
              diffSummary.added = srcCols.map(c => c.name);
            }
          } else {
            // Table exists, generate ALTER statements based on differences
            const srcMap = {}; srcCols.forEach(c => srcMap[c.name.toLowerCase()] = c);
            const tgtMap = {}; tgtCols.forEach(c => tgtMap[c.name.toLowerCase()] = c);
            
            const implParts = [];
            const rollbackParts = [];
            
            // Columns in source but not in target will be ADDED to target
            Object.keys(srcMap).forEach(n => { 
              if (!tgtMap[n]) {
                const srcCol = srcMap[n];
                diffSummary.added.push(srcCol.name);
                const colDef = buildColumnDefinition(srcCol);
                implParts.push(`ALTER TABLE [${schema}].[${name}] ADD [${srcCol.name}] ${colDef}`);
                rollbackParts.unshift(`ALTER TABLE [${schema}].[${name}] DROP COLUMN [${srcCol.name}]`);
                notes.push(`Column ${srcCol.name} will be ADDED`);
              }
            });
            
            // Columns in target but not in source will be REMOVED from target
            Object.keys(tgtMap).forEach(n => { 
              if (!srcMap[n]) {
                const tgtCol = tgtMap[n];
                diffSummary.removed.push(tgtCol.name);
                implParts.push(`ALTER TABLE [${schema}].[${name}] DROP COLUMN [${tgtCol.name}]`);
                const origColDef = buildColumnDefinition(tgtCol);
                rollbackParts.unshift(`ALTER TABLE [${schema}].[${name}] ADD [${tgtCol.name}] ${origColDef}`);
                notes.push(`Column ${tgtCol.name} will be DROPPED`);
              }
            });
            
            // Columns that exist in both but have different signatures will be ALTERED
            Object.keys(srcMap).forEach(n => { 
              if (tgtMap[n]) { 
                const sC = srcMap[n]; 
                const tC = tgtMap[n]; 
                const sSig = `${sC.type}|${sC.max_length}|${sC.precision}|${sC.scale}|${sC.is_nullable}|${sC.is_computed? '1':''}`;
                const tSig = `${tC.type}|${tC.max_length}|${tC.precision}|${tC.scale}|${tC.is_nullable}|${tC.is_computed? '1':''}`;
                if (sSig !== tSig) {
                  // Build human-readable type descriptions for better diff display
                  const sType = buildColumnTypeDescription(sC);
                  const tType = buildColumnTypeDescription(tC);
                  diffSummary.altered.push({ 
                    column: sC.name, 
                    from: tType, 
                    to: sType,
                    fromSig: tSig,
                    toSig: sSig 
                  });
                  
                  // Generate ALTER COLUMN statement
                  const srcColDef = buildColumnDefinition(sC);
                  const tgtColDef = buildColumnDefinition(tC);
                  implParts.push(`ALTER TABLE [${schema}].[${name}] ALTER COLUMN [${sC.name}] ${srcColDef}`);
                  rollbackParts.unshift(`ALTER TABLE [${schema}].[${name}] ALTER COLUMN [${sC.name}] ${tgtColDef}`);
                  notes.push(`Column ${sC.name} will be ALTERED: ${tType} → ${sType}`);
                }
              } 
            });
            
            implementation = implParts.join('\n');
            rollback = rollbackParts.join('\n');
            
            if (implParts.length === 0) {
              implementation = '-- No changes required';
              rollback = '-- No rollback needed';
              notes.push('No differences detected');
            }
          }
        } catch (e) {
          implementation = `-- Error analyzing table: ${e.message}`;
          rollback = '-- Error during analysis';
          notes.push(`Error: ${e.message}`);
        }

        plans.push({ schema, name, type: 'TABLE', implementation, rollback, notes, diffSummary });
        continue;
      }

      // For non-table objects: compare definitions
      try {
        // fetch source definition
        let poolSrc = pools[fromEnv]; let createdSrc = false; if (!poolSrc || !poolSrc.connected) { poolSrc = new sql.ConnectionPool(sqlConfigs[fromEnv]); await poolSrc.connect(); createdSrc = true; }
        const fullName = `[${schema}].[${name}]`;
        const srcQ = `SELECT OBJECT_DEFINITION(OBJECT_ID(@fullname)) AS def`;
        const srcR = await poolSrc.request().input('fullname', sql.NVarChar, fullName).query(srcQ);
        if (createdSrc) await poolSrc.close();
        const srcDef = (srcR.recordset && srcR.recordset[0] && srcR.recordset[0].def) ? srcR.recordset[0].def : null;

        // fetch target definition
        let poolTgt = pools[toEnv]; let createdTgt = false; if (!poolTgt || !poolTgt.connected) { poolTgt = new sql.ConnectionPool(sqlConfigs[toEnv]); await poolTgt.connect(); createdTgt = true; }
        const tgtR = await poolTgt.request().input('fullname', sql.NVarChar, fullName).query(srcQ);
        if (createdTgt) await poolTgt.close();
        const tgtDef = (tgtR.recordset && tgtR.recordset[0] && tgtR.recordset[0].def) ? tgtR.recordset[0].def : null;

        // decide implementation/rollback
        let impl = '-- No changes detected';
        let rollback = '-- No rollback generated';
        if (srcDef && !tgtDef) {
          // create on target
          impl = srcDef;
          rollback = `DROP ${objType} ${fullName}`;
        } else if (srcDef && tgtDef && srcDef.trim() !== tgtDef.trim()) {
          // replace: create new (can be DROP+CREATE)
          impl = `-- Replace ${objType}\nDROP ${objType} ${fullName}\nGO\n${srcDef}`;
          rollback = `-- rollback restore target definition\n${tgtDef}`;
        } else if (!srcDef) {
          impl = `-- Source does not contain ${objType} ${fullName}`;
        }
        const diffSummary = { existsInSource: !!srcDef, existsInTarget: !!tgtDef, changed: !!(srcDef && tgtDef && srcDef.trim() !== tgtDef.trim()) };
        plans.push({ schema, name, type: objType, implementation: impl, rollback, diffSummary });
      } catch (e) {
        plans.push({ schema, name, type: objType, error: e.message, implementation: '--', rollback: '--' });
      }
    }
    // combined scripts with proper batch separators
    let combinedImpl = plans
      .map(p => p.implementation)
      .filter(impl => impl && impl.trim() !== '--')
      .join('\nGO\n\n');
    if (plans.some(p => p.implementation && p.implementation.trim() !== '--')) {
      combinedImpl += '\nGO';
    }
    const combinedRollback = plans
      .map(p => p.rollback)
      .filter(rb => rb && rb.trim() !== '--')
      .reverse()
      .join('\nGO\n\n') + (plans.some(p => p.rollback && p.rollback.trim() !== '--') ? '\nGO' : '');

    // Auto-create schemas in target: unconditionally prepend conditional CREATE SCHEMA for non-dbo schemas referenced by objects
    try {
      const candidateSchemas = Array.from(new Set((Array.isArray(objects) ? objects : []).map(o => (o && o.schema ? String(o.schema) : 'dbo').trim()).filter(s => s && s.toLowerCase() !== 'dbo')));
      const safeSchemas = candidateSchemas.filter(s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s));
      if (safeSchemas.length > 0) {
        const preface = safeSchemas.map(sch => `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'${sch}') EXEC('CREATE SCHEMA [${sch}]');`).join('\n');
        combinedImpl = preface + (combinedImpl ? '\nGO\n\n' + combinedImpl : '\nGO');
      }
    } catch (_) { /* ignore */ }

    // build dependency graph for topological order (best-effort)
    const nameKey = p => (p.type || 'TABLE') + '::' + (p.schema || '') + '::' + (p.name || '');
    const nodes = {};
    plans.forEach(p => { nodes[nameKey(p)] = { obj: p, deps: [] }; });
    // populate deps from p.diffSummary.dependencies when available or from getObjectDependencies
    for (const p of plans) {
      try {
        if (p.type === 'TABLE') {
          const deps = p.diffSummary && p.diffSummary.dependencies ? p.diffSummary.dependencies : (await getObjectDependencies(fromEnv, p.schema, p.name));
          (deps || []).forEach(d => {
            const key = 'TABLE::' + (d.schema||'dbo') + '::' + d.name;
            if (nodes[key]) nodes[nameKey(p)].deps.push(key);
          });
        } else if (p.diffSummary && p.diffSummary.existsInSource && p.diffSummary.existsInTarget === false) {
          // no dependencies
        }
      } catch (e) { /* ignore */ }
    }
    // Kahn's algorithm for topo sort
    const inDegree = {}; Object.keys(nodes).forEach(k => inDegree[k] = 0);
    Object.keys(nodes).forEach(k => nodes[k].deps.forEach(d => { if (inDegree[d] !== undefined) inDegree[d]++; }));
    const queue = Object.keys(inDegree).filter(k => inDegree[k] === 0);
    const order = [];
    while (queue.length) {
      const n = queue.shift(); order.push(n);
      (nodes[n].deps || []).forEach(m => { inDegree[m]--; if (inDegree[m] === 0) queue.push(m); });
    }
    const applyOrder = order.map(k => nodes[k] ? nodes[k].obj : null).filter(Boolean).map(o => ({ type: o.type, schema: o.schema, name: o.name }));

  return res.json({ success: true, plans, combinedImpl, combinedRollback, applyOrder });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// get default constraints, primary key, and index create SQLs for a table
async function getTableMetadataSql(env, schema, table) {
  if (!sqlConfigs[env]) throw new Error('Invalid environment');
  let pool = pools[env];
  let created = false;
  if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
  const fullname = `[${schema}].[${table}]`;
  // defaults
  const qDefaults = `SELECT col.name AS column_name, dc.name AS constraint_name, OBJECT_DEFINITION(dc.object_id) AS definition
    FROM sys.default_constraints dc
    JOIN sys.columns col ON dc.parent_object_id = col.object_id AND dc.parent_column_id = col.column_id
    WHERE dc.parent_object_id = OBJECT_ID(@fullname)`;
  const qIndexes = `SELECT i.name AS index_name, i.is_unique, i.type_desc,
      (SELECT '[' + c.name + ']'+ CASE WHEN ic.is_descending_key=1 THEN ' DESC' ELSE '' END + ','
       FROM sys.index_columns ic JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
       WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
       ORDER BY ic.key_ordinal
       FOR XML PATH('')) AS key_columns,
      (SELECT '[' + c.name + '],' FROM sys.index_columns ic JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=1 FOR XML PATH('')) AS included_columns
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID(@fullname) AND i.is_primary_key = 0 AND i.is_hypothetical = 0`;
  const qPK = `SELECT kc.name AS constraint_name,
      (SELECT '[' + c.name + ']'+',' FROM sys.index_columns ic JOIN sys.columns c ON ic.object_id=c.object_id AND ic.column_id=c.column_id WHERE ic.object_id=kc.parent_object_id AND ic.index_id=kc.unique_index_id ORDER BY ic.key_ordinal FOR XML PATH('')) AS pk_columns
    FROM sys.key_constraints kc WHERE kc.parent_object_id = OBJECT_ID(@fullname) AND kc.type = 'PK'`;

  const defaults = await pool.request().input('fullname', sql.NVarChar, fullname).query(qDefaults);
  const idxs = await pool.request().input('fullname', sql.NVarChar, fullname).query(qIndexes);
  const pks = await pool.request().input('fullname', sql.NVarChar, fullname).query(qPK);
  if (created) await pool.close();

  const defaultMap = {};
  (defaults.recordset || []).forEach(r => { defaultMap[r.column_name] = { constraint: r.constraint_name, definition: r.definition }; });

  const indexSqls = [];
  (idxs.recordset || []).forEach(r => {
    let keys = (r.key_columns || '').replace(/,$/, '');
    let inc = (r.included_columns || '').replace(/,$/, '');
    if (!keys) return;
    // remove xml artifacts
    keys = keys.replace(/\,\s*$/,'');
    const unique = r.is_unique ? 'UNIQUE ' : '';
    const idxName = r.index_name;
    const incPart = inc ? (' INCLUDE (' + inc.replace(/,$/, '') + ')') : '';
    indexSqls.push(`CREATE ${unique}NONCLUSTERED INDEX [${idxName}] ON ${fullname} (${keys})${incPart};`);
  });

  let pkSql = null;
  if ((pks.recordset || []).length) {
    const pk = pks.recordset[0];
    let cols = (pk.pk_columns || '').replace(/,$/, '');
    if (cols) pkSql = `ALTER TABLE ${fullname} ADD CONSTRAINT [${pk.constraint_name}] PRIMARY KEY (${cols});`;
  }

  return { defaults: defaultMap, indexes: indexSqls, primaryKey: pkSql };
}

// generate a simple normalized column signature string from DB metadata
function dbColumnSignature(col) {
  if (!col) return '';
  let type = col.type;
  if (col.max_length && col.max_length > 0) {
    // For nvarchar/nchar, SQL Server stores length in bytes, so divide by 2 for character count
    const displayLength = (col.type.toLowerCase() === 'nvarchar' || col.type.toLowerCase() === 'nchar') ? col.max_length / 2 : col.max_length;
    type += `(${displayLength})`;
  }
  return `${col.name} ${type} ${col.is_nullable ? 'NULL' : 'NOT NULL'}`;
}

// build human-readable column type description for diff display
function buildColumnTypeDescription(col) {
  if (!col) return '';
  let typeDesc = col.type;
  
  // Add length/precision for applicable types
  if (col.type && (col.type.toLowerCase().includes('varchar') || col.type.toLowerCase().includes('char'))) {
    if (col.max_length && col.max_length > 0) {
      if (col.max_length === -1) {
        typeDesc += '(MAX)';
      } else {
        // For nvarchar/nchar, SQL Server stores length in bytes, so divide by 2 for character count
        const charLength = col.type.toLowerCase().startsWith('n') ? col.max_length / 2 : col.max_length;
        typeDesc += `(${charLength})`;
      }
    }
  } else if (col.type && (col.type.toLowerCase().includes('decimal') || col.type.toLowerCase().includes('numeric'))) {
    if (col.precision !== undefined && col.scale !== undefined) {
      typeDesc += `(${col.precision},${col.scale})`;
    }
  } else if (col.type && col.type.toLowerCase().includes('float')) {
    if (col.precision !== undefined && col.precision > 0) {
      typeDesc += `(${col.precision})`;
    }
  }
  
  // Add NULL/NOT NULL
  typeDesc += col.is_nullable ? ' NULL' : ' NOT NULL';
  
  return typeDesc;
}

// build complete column definition for CREATE/ALTER statements
function buildColumnDefinition(col) {
  if (!col) return '';
  let typeDef = col.type;
  
  // Add length/precision for applicable types
  if (col.type && (col.type.toLowerCase().includes('varchar') || col.type.toLowerCase().includes('char'))) {
    if (col.max_length && col.max_length > 0) {
      if (col.max_length === -1) {
        typeDef += '(MAX)';
      } else {
        // For nvarchar/nchar, SQL Server stores length in bytes, so divide by 2 for character count
        const charLength = col.type.toLowerCase().startsWith('n') ? col.max_length / 2 : col.max_length;
        typeDef += `(${charLength})`;
      }
    }
  } else if (col.type && (col.type.toLowerCase().includes('decimal') || col.type.toLowerCase().includes('numeric'))) {
    if (col.precision !== undefined && col.scale !== undefined) {
      typeDef += `(${col.precision},${col.scale})`;
    }
  } else if (col.type && col.type.toLowerCase().includes('float')) {
    if (col.precision !== undefined && col.precision > 0) {
      typeDef += `(${col.precision})`;
    }
  }
  
  // Add NULL/NOT NULL
  typeDef += col.is_nullable ? ' NULL' : ' NOT NULL';
  
  // Add default if present
  if (col.default_definition) {
    typeDef += ` DEFAULT ${col.default_definition}`;
  }
  
  return typeDef;
}

// Helper: execute a multi-batch script with optional dry-run using an explicit transaction
async function executeScriptBatches(pool, scriptText, dryRun) {
  // Split on GO batch separators, trim and filter empties
  const initial = (scriptText || '')
    .split(/\r?\nGO\r?\n|\r?\nGO\s*$|^GO\s*\r?\n/i)
    .filter(b => b && b.trim());

  // Ensure any CREATE VIEW appears at the start of its own batch
  const batches = [];
  const viewRegex = /\bCREATE\s+(?:OR\s+ALTER\s+)?VIEW\b/i;
  for (let raw of initial) {
    let batch = raw.trim();
    const m = batch.match(viewRegex);
    if (!m) { batches.push(batch); continue; }

    const idx = m.index;
    const pre = batch.substring(0, idx).trim();
    const post = batch.substring(idx).trim();
    if (!pre) { batches.push(batch); continue; }

    // Remove comments from pre to check for only allowed SETs
    const preNoComments = pre
      .replace(/--.*$/mg, '')
      .replace(/\/[\*][\s\S]*?[\*]\//g, '')
      .trim();
    const allowedPre = /^(\s*(SET\s+ANSI_NULLS\s+(ON|OFF)\s*;?)?\s*(SET\s+QUOTED_IDENTIFIER\s+(ON|OFF)\s*;?)?\s*)$/i;
    if (preNoComments && !allowedPre.test(preNoComments)) {
      // Split into two batches: pre (before CREATE VIEW) and post (starting at CREATE VIEW)
      batches.push(pre);
      batches.push(post);
    } else {
      // Allowed pre-statements can remain in the same batch with CREATE VIEW
      batches.push(batch);
    }
  }
  let totalRowsAffected = 0;
  let lastResult = null;

  if (dryRun) {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const batch of batches) {
        const req = new sql.Request(tx);
        const result = await req.batch(batch);
        lastResult = result;
        if (Array.isArray(result.rowsAffected)) {
          totalRowsAffected += result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0);
        } else if (typeof result.rowsAffected === 'number') {
          totalRowsAffected += result.rowsAffected;
        }
      }
    } catch (e) {
      try { await tx.rollback(); } catch (_) {}
      throw e;
    }
    // Always rollback so nothing persists
    try { await tx.rollback(); } catch (_) {}
    return { lastResult, totalRowsAffected };
  }

  // Real apply (no dry-run): execute batches directly on pool
  for (const batch of batches) {
    const req = new sql.Request(pool);
    const result = await req.batch(batch);
    lastResult = result;
    if (Array.isArray(result.rowsAffected)) {
      totalRowsAffected += result.rowsAffected.reduce((a, b) => a + (Number(b) || 0), 0);
    } else if (typeof result.rowsAffected === 'number') {
      totalRowsAffected += result.rowsAffected;
    }
  }
  return { lastResult, totalRowsAffected };
}

// create implementation and rollback scripts for CREATE TABLE statements
async function planCreateTable(env, tbl) {
  const schema = tbl.schema || 'dbo';
  const table = tbl.table;
  const providedCols = tbl.columns; // array of { raw }
  // parse provided columns into name and definition (basic)
  const parsedProvided = providedCols.map(c => {
    // match: [name] <rest>
    const m = c.raw.match(/^\s*([\[\]"\w]+)\s+(.*)$/s);
    if (!m) return { raw: c.raw };
    const name = m[1].replace(/^[\[\]"]+|[\[\]"]+$/g, '');
    const def = m[2].trim();
    return { name, def, raw: c.raw };
  });

  // get current columns
  let dbCols = [];
  try { dbCols = await getDbColumns(env, schema, table); } catch (e) { dbCols = []; }

  const dbColMap = {};
  dbCols.forEach(c => dbColMap[c.name.toLowerCase()] = c);

  const implParts = [];
  const rollbackParts = [];

  if (dbCols.length === 0) {
    // table does not exist -> implementation is the provided CREATE TABLE, rollback drops table
    implParts.push(tbl.raw);
    rollbackParts.push(`DROP TABLE [${schema}].[${table}]`);
    return { impl: implParts.join('\n'), rollback: rollbackParts.join('\n'), notes: ['Table does not exist; create and drop generated'] };
  }

  // table exists: compare columns
  const notes = [];
  // track columns to drop (present in db but not in provided)
  const providedNames = parsedProvided.map(p => p.name && p.name.toLowerCase()).filter(Boolean);
  // additions or alterations
  for (const p of parsedProvided) {
    if (!p.name) { notes.push(`Could not parse provided column definition: ${p.raw}`); continue; }
    const name = p.name;
    const db = dbColMap[name.toLowerCase()];
    if (!db) {
      // add column
      implParts.push(`ALTER TABLE [${schema}].[${table}] ADD ${p.name} ${p.def}`);
      rollbackParts.unshift(`ALTER TABLE [${schema}].[${table}] DROP COLUMN ${p.name}`); // rollback drop the added column
      notes.push(`Column ${name} will be ADDED`);
    } else {
      // crude check: see if definition contains the db type name
      const providedLower = p.def.toLowerCase();
      if (!providedLower.includes(db.type.toLowerCase())) {
        // type likely changed
        implParts.push(`ALTER TABLE [${schema}].[${table}] ALTER COLUMN ${p.name} ${p.def}`);
        // rollback: attempt to restore original type
        let origType = db.type;
        if (db.max_length && db.max_length > 0) {
          // For nvarchar/nchar, SQL Server stores length in bytes, so divide by 2 for character count
          const displayLength = (db.type.toLowerCase() === 'nvarchar' || db.type.toLowerCase() === 'nchar') ? db.max_length / 2 : db.max_length;
          origType += `(${displayLength})`;
        } else if (db.precision) {
          origType += `(${db.precision},${db.scale || 0})`;
        }
        const nullability = db.is_nullable ? 'NULL' : 'NOT NULL';
        rollbackParts.unshift(`ALTER TABLE [${schema}].[${table}] ALTER COLUMN ${p.name} ${origType} ${nullability}`);
        notes.push(`Column ${name} will be ALTERED (type/definition differs)`);
      }
    }
  }

  // dropped columns
  for (const db of dbCols) {
    if (!providedNames.includes(db.name.toLowerCase())) {
      // drop column
      implParts.push(`ALTER TABLE [${schema}].[${table}] DROP COLUMN ${db.name}`);
      // rollback: add column back with type and nullability (default/constraints not restored)
      const origType = db.type + (db.max_length && db.max_length > 0 ? `(${db.max_length})` : (db.precision? `(${db.precision},${db.scale})`: ''));
      const nullability = db.is_nullable ? 'NULL' : 'NOT NULL';
      rollbackParts.unshift(`ALTER TABLE [${schema}].[${table}] ADD ${db.name} ${origType} ${nullability}`);
      notes.push(`Column ${db.name} will be DROPPED`);
    }
  }

  // try to include defaults/indexes/pk in rollback if possible
  try {
    const meta = await getTableMetadataSql(env, schema, table);
    // include PK and indexes (recreate) after adding columns back
    if (meta.primaryKey) rollbackParts.push(`-- recreate primary key\n${meta.primaryKey}`);
    if (meta.indexes && meta.indexes.length) rollbackParts.push('-- recreate indexes\n' + meta.indexes.join('\n'));
    // include defaults as constraints
    Object.keys(meta.defaults || {}).forEach(col => {
      const d = meta.defaults[col];
      if (d && d.definition) rollbackParts.push(`ALTER TABLE [${schema}].[${table}] ADD CONSTRAINT [${d.constraint}] DEFAULT ${d.definition} FOR [${col}]`);
    });
  } catch (e) {
    // ignore metadata failures for rollback
  }

  return { impl: implParts.join('\n') || '-- No changes detected', rollback: rollbackParts.join('\n') || '-- No rollback', notes };
}

// POST /ddl/plan - analyze given script and produce implementation & rollback scripts
app.post('/ddl/plan', express.json(), async (req, res) => {
  const { env, script } = req.body || {};
  if (!env || !script) return res.status(400).json({ success: false, message: 'env and script required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  try {
    const plans = [];
    const creates = parseCreateTables(script);
    for (const c of creates) {
      const p = await planCreateTable(env, c);
      plans.push({ schema: c.schema, table: c.table, implementation: p.impl, rollback: p.rollback, notes: p.notes });
    }
    // handle ALTER statements too
    const alters = parseAlterStatements(script);
    for (const a of alters) {
      // simple planning for alter
      const p = await planAlterStatement(env, a);
      plans.push({ schema: a.schema, table: a.table, implementation: p.impl, rollback: p.rollback, notes: p.notes });
    }
    if (!plans.length) return res.json({ success: true, plans: [], message: 'No CREATE or ALTER TABLE statements found' });
    return res.json({ success: true, plans });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Plan an ALTER TABLE statement object produced by parseAlterStatements
async function planAlterStatement(env, stmt) {
  const schema = stmt.schema || 'dbo';
  const table = stmt.table;
  const notes = [];
  const implParts = [];
  const rollbackParts = [];
  // get current columns
  let dbCols = [];
  try { dbCols = await getDbColumns(env, schema, table); } catch (e) { dbCols = []; }
  const dbMap = {};
  dbCols.forEach(c => dbMap[c.name.toLowerCase()] = c);

  if (stmt.type === 'ADD') {
    // split cols by comma at top level
    const cols = splitColumns(stmt.colsText);
    for (const craw of cols) {
      implParts.push(`ALTER TABLE [${schema}].[${table}] ADD ${craw}`);
      // extract column name
      const m = craw.match(/^\s*([\[\]"\w]+)\s+/);
      if (m) {
        const name = m[1].replace(/^[\[\]"]+|[\[\]"]+$/g, '');
        rollbackParts.unshift(`ALTER TABLE [${schema}].[${table}] DROP COLUMN ${name}`);
        notes.push(`Column ${name} will be ADDED`);
      } else {
        notes.push(`Could not parse ADD column definition: ${craw}`);
      }
    }
  } else if (stmt.type === 'DROP') {
    // colsText may contain comma-separated names
    const names = stmt.colsText.split(',').map(s => s.trim().replace(/^[\[\]"]+|[\[\]"]+$/g, ''));
    for (const name of names) {
      implParts.push(`ALTER TABLE [${schema}].[${table}] DROP COLUMN ${name}`);
      // rollback: re-add with original type if available
      const db = dbMap[name.toLowerCase()];
      if (db) {
        const origType = db.type + (db.max_length && db.max_length > 0 ? `(${db.max_length})` : (db.precision? `(${db.precision},${db.scale})`: ''));
        const nullability = db.is_nullable ? 'NULL' : 'NOT NULL';
        rollbackParts.unshift(`ALTER TABLE [${schema}].[${table}] ADD ${name} ${origType} ${nullability}`);
        notes.push(`Column ${name} will be DROPPED`);
      } else {
        notes.push(`Column ${name} will be DROPPED (no type info available for rollback)`);
      }
    }
    // try to include indexes/defaults/pk
    try {
      const meta = await getTableMetadataSql(env, schema, table);
      if (meta.primaryKey) rollbackParts.push(`-- recreate primary key\n${meta.primaryKey}`);
      if (meta.indexes && meta.indexes.length) rollbackParts.push('-- recreate indexes\n' + meta.indexes.join('\n'));
      Object.keys(meta.defaults || {}).forEach(col => {
        const d = meta.defaults[col];
        if (d && d.definition) rollbackParts.push(`ALTER TABLE [${schema}].[${table}] ADD CONSTRAINT [${d.constraint}] DEFAULT ${d.definition} FOR [${col}]`);
      });
    } catch (e) {}
  } else if (stmt.type === 'ALTER') {
    // colsText contains something like: ColumnName TYPE NULL/NOT NULL
    const cols = splitColumns(stmt.colsText);
    for (const c of cols) {
      implParts.push(`ALTER TABLE [${schema}].[${table}] ALTER COLUMN ${c}`);
      const m = c.match(/^\s*([\[\]"\w]+)\s+(.*)$/s);
      if (m) {
        const name = m[1].replace(/^[\[\]"]+|[\[\]"]+$/g, '');
        const db = dbMap[name.toLowerCase()];
        if (db) {
          const origType = db.type + (db.max_length && db.max_length > 0 ? `(${db.max_length})` : (db.precision? `(${db.precision},${db.scale})`: ''));
          const nullability = db.is_nullable ? 'NULL' : 'NOT NULL';
          rollbackParts.unshift(`ALTER TABLE [${schema}].[${table}] ALTER COLUMN ${name} ${origType} ${nullability}`);
          notes.push(`Column ${name} will be ALTERED`);
        } else {
          notes.push(`Column ${name} will be ALTERED (no original type available for rollback)`);
        }
      } else {
        notes.push(`Could not parse ALTER COLUMN: ${c}`);
      }
    }
  }

  return { impl: implParts.join('\n') || '-- No implementation', rollback: rollbackParts.join('\n') || '-- No rollback', notes };
}

// === Git Integration Functions ===

async function gitCommitScript(filePath, commitMessage, metadata = {}) {
  try {
    const gitDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    
    // Add file to git
    await execAsync(`git add "${fileName}"`, { cwd: gitDir });
    
    // Create commit with metadata
  const objectsList = Array.isArray(metadata.objects) ? metadata.objects.join(', ') : (metadata.objects || 'unknown');
  const fullMessage = `${commitMessage}

Environment: ${metadata.env || 'unknown'}
User: ${metadata.user || 'system'}
Timestamp: ${new Date().toISOString()}
Objects: ${objectsList}
Action: ${metadata.action || 'unknown'}`;
    
  // Build commit with multiple -m parts to avoid newline/quoting issues on Windows shells
  let commitCmd = 'git commit';
  const addPart = (msg) => { if (msg !== undefined && msg !== null) commitCmd += ` -m "${String(msg).replace(/"/g, '\\"')}"`; };
  addPart(commitMessage);
  addPart(`Environment: ${metadata.env || 'unknown'}`);
  addPart(`User: ${metadata.user || 'system'}`);
  addPart(`Timestamp: ${new Date().toISOString()}`);
  addPart(`Objects: ${objectsList}`);
  addPart(`Action: ${metadata.action || 'unknown'}`);
  const { stdout } = await execAsync(commitCmd, { cwd: gitDir });
    
    // Get the commit hash
    const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { cwd: gitDir });
    
    return {
      success: true,
      commitHash: commitHash.trim(),
      message: stdout
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function getGitHistory(filePath, limit = 50) {
  try {
    const gitDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    
    const { stdout } = await execAsync(
      `git log --oneline -n ${limit} --follow --format="%H|%ai|%an|%ae|%s" -- "${fileName}"`,
      { cwd: gitDir }
    );
    
    if (!stdout.trim()) {
      return { success: true, history: [] };
    }
    
    const history = stdout.trim().split('\n').map(line => {
      const [hash, date, author, email, ...messageParts] = line.split('|');
      return {
        hash: hash.trim(),
        date: date.trim(),
        author: author.trim(),
        email: email.trim(),
        message: messageParts.join('|').trim(),
        shortHash: hash.substring(0, 8)
      };
    });
    
    return { success: true, history };
  } catch (error) {
    return { success: false, error: error.message, history: [] };
  }
}

async function getObjectChangeHistory(objectType, schema, name, limit = 20) {
  try {
    const scriptsDir = path.join(__dirname, 'scripts');
    const pattern = `*${schema}*${name}*`;
    
    // Search for files related to this object
    const { stdout } = await execAsync(
      `git log --oneline -n ${limit} --all --format="%H|%ai|%an|%s" --grep="${schema}.${name}" --grep="${name}"`,
      { cwd: __dirname }
    );
    
    let history = [];
    
    if (stdout.trim()) {
      history = stdout.trim().split('\n').map(line => {
        const [hash, date, author, ...messageParts] = line.split('|');
        return {
          hash: hash.trim(),
          date: date.trim(),
          author: author.trim(),
          message: messageParts.join('|').trim(),
          shortHash: hash.substring(0, 8)
        };
      });
    }
    
    // Also search for file-based history
    const fileHistory = await getObjectFileHistory(objectType, schema, name, limit);
    
    // Merge and sort by date
    const allHistory = [...history, ...fileHistory.history].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { success: true, history: allHistory.slice(0, limit) };
  } catch (error) {
    return { success: false, error: error.message, history: [] };
  }
}

async function getObjectFileHistory(objectType, schema, name, limit = 20) {
  try {
    const scriptsDir = path.join(__dirname, 'scripts');
    
    // Search for files that might contain this object
    const searchPatterns = [
      `*${name}*`,
      `*${schema}_${name}*`,
      `*${schema}.${name}*`,
      `*${objectType}_${name}*`
    ];
    
    let allHistory = [];
    
    for (const pattern of searchPatterns) {
      try {
        const { stdout } = await execAsync(
          `git log --oneline -n ${limit} --all --format="%H|%ai|%an|%s" -- "${pattern}.sql"`,
          { cwd: scriptsDir }
        );
        
        if (stdout.trim()) {
          const history = stdout.trim().split('\n').map(line => {
            const [hash, date, author, ...messageParts] = line.split('|');
            return {
              hash: hash.trim(),
              date: date.trim(),
              author: author.trim(),
              message: messageParts.join('|').trim(),
              shortHash: hash.substring(0, 8),
              pattern: pattern
            };
          });
          allHistory.push(...history);
        }
      } catch (error) {
        // Continue with next pattern if this one fails
      }
    }
    
    return { success: true, history: allHistory };
  } catch (error) {
    return { success: false, error: error.message, history: [] };
  }
}

async function getCommitDiff(commitHash) {
  try {
    const { stdout } = await execAsync(`git show ${commitHash} --format="%H|%ai|%an|%ae|%s" --name-status`, { cwd: __dirname });
    
    const lines = stdout.split('\n');
    const [hash, date, author, email, ...messageParts] = lines[0].split('|');
    
    const files = [];
    let diffContent = '';
    let inDiff = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^[AMD]\s+/)) {
        const [status, filePath] = line.split('\t');
        files.push({ status, path: filePath });
      } else if (line.startsWith('diff --git')) {
        inDiff = true;
        diffContent += line + '\n';
      } else if (inDiff) {
        diffContent += line + '\n';
      }
    }
    
    return {
      success: true,
      commit: {
        hash: hash.trim(),
        date: date.trim(),
        author: author.trim(),
        email: email.trim(),
        message: messageParts.join('|').trim(),
        shortHash: hash.substring(0, 8)
      },
      files,
      diff: diffContent
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// POST /ddl/apply - execute provided implementation script (single batch)
app.post('/ddl/apply', express.json(), async (req, res) => {
  const { env, script } = req.body || {};
  if (!env || !script) return res.status(400).json({ success: false, message: 'env and script required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  try {
    const dryRun = (req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true);
    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
    
    // Pre-flight: ensure any referenced schemas exist on target (only on real apply, gated by flag)
    try {
      const shouldAutoCreate = (req.body && req.body.autoCreateSchemas === true) || (req.query && String(req.query.autoCreateSchemas).toLowerCase() === 'true');
      if (!dryRun && shouldAutoCreate && script && typeof script === 'string') {
        // Extract schema names from common DDL/DML patterns
        const extractSchemas = (text) => {
          const schemas = new Set();
          const patterns = [
            /(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)\s+([\[\]"\w]+)\s*\.\s*([\[\]"\w]+)/ig,
            /CREATE\s+(?:UNIQUE\s+)?(?:(?:CLUSTERED|NONCLUSTERED)\s+)?INDEX\s+[\[\]\w"\.]+\s+ON\s+([\[\]"\w]+)\s*\.\s*([\[\]"\w]+)/ig,
            /ALTER\s+INDEX\s+[\[\]\w"\.]+\s+ON\s+([\[\]"\w]+)\s*\.\s*([\[\]"\w]+)/ig,
            /INSERT\s+INTO\s+([\[\]"\w]+)\s*\.\s*([\[\]"\w]+)/ig,
            /UPDATE\s+([\[\]"\w]+)\s*\.\s*([\[\]"\w]+)/ig,
            /DELETE\s+FROM\s+([\[\]"\w]+)\s*\.\s*([\[\]"\w]+)/ig
          ];
          patterns.forEach(re => { let m; while ((m = re.exec(text))) { let sch = m[1] || ''; sch = sch.replace(/^[\[\"]+|[\]\"]+$/g,''); if (sch) schemas.add(sch); } });
          return Array.from(schemas);
        };
        const ensureSchemasExist = async (pool, names) => {
          const isValid = (n) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n);
          for (const n of names) {
            if (!isValid(n)) continue; // skip unsafe names
            const r = await pool.request().input('name', sql.NVarChar, n).query('SELECT 1 AS x FROM sys.schemas WHERE name=@name');
            const exists = r && r.recordset && r.recordset.length > 0;
            if (!exists) {
              // create schema safely (validated identifier)
              await pool.request().query(`EXEC('CREATE SCHEMA [${n}]')`);
            }
          }
        };
        const schemasToEnsure = extractSchemas(script);
        if (schemasToEnsure.length) {
          await ensureSchemasExist(pool, schemasToEnsure);
        }
      }
    } catch (schemaErr) {
      // If schema creation fails, return a clear message
      if (created) { try { await pool.close(); } catch(_){} }
      return res.status(500).json({ success: false, message: `Schema check/creation failed: ${schemaErr.message}` });
    }
    
    // Execute batches; in dry-run, use transaction+rollback to avoid breaking CREATE VIEW batch rules
    const { lastResult, totalRowsAffected } = await executeScriptBatches(pool, script, dryRun);
    
    if (created) await pool.close();
    
  // gather optional metadata
    const meta = { user: req.body.user || req.headers['x-user'] || null, correlationId: req.body.correlationId || req.headers['x-correlation-id'] || null, gitCommit: req.body.gitCommit || req.headers['x-git-commit'] || null, clientIp: req.ip || req.headers['x-forwarded-for'] || null };
    
    // Save implementation (and optional rollback) script(s) to Git if not a dry run
    if (!dryRun) {
      try {
        const objectsForCommit = formatObjectsForCommit(env, req.body.objects || []);
        const scripts = [ { content: script, action: 'implementation', suffix: '' } ];
        const rollbackScript = req.body.rollbackScript || null;
        if (rollbackScript && typeof rollbackScript === 'string' && rollbackScript.trim()) {
          scripts.push({ content: rollbackScript, action: 'rollback', suffix: '' });
        }
        const gitSave = await GitManager.saveScripts(scripts, {
          environment: env,
          user: meta.user || 'system',
          action: 'implementation',
          correlationId: meta.correlationId,
          timestamp: new Date().toISOString(),
          rowsAffected: totalRowsAffected,
          objects: objectsForCommit
        });
        meta.gitCommitHash = gitSave && gitSave.commitHash;
      } catch (gitError) {
        console.log('Git commit error:', gitError);
        // Non-fatal
      }
    }
    
    // write audit
    writeAudit(Object.assign({ timestamp: new Date().toISOString(), action: 'apply', env, dryRun: !!dryRun, success: true, rowsAffected: totalRowsAffected, scriptPreview: script.substring(0, 1000) }, meta));
    return res.json({ success: true, dryRun: !!dryRun, recordset: lastResult?.recordset, rowsAffected: totalRowsAffected, gitCommitHash: meta.gitCommitHash });
  } catch (e) {
    // audit failure
  const metaErr = { user: req.body && req.body.user || req.headers['x-user'] || null, correlationId: req.body && req.body.correlationId || req.headers['x-correlation-id'] || null, gitCommit: req.body && req.body.gitCommit || req.headers['x-git-commit'] || null, clientIp: req.ip || req.headers['x-forwarded-for'] || null };
  writeAudit(Object.assign({ timestamp: new Date().toISOString(), action: 'apply', env, dryRun: !!((req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true)), success: false, error: e.message, scriptPreview: (req.body && req.body.script) ? String(req.body.script).substring(0, 1000) : null }, metaErr));
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /ddl/rollback - execute provided rollback script
app.post('/ddl/rollback', express.json(), async (req, res) => {
  const { env, script } = req.body || {};
  if (!env || !script) return res.status(400).json({ success: false, message: 'env and script required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  try {
    const dryRun = (req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true);
    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[env]); await pool.connect(); created = true; }
    
    // Execute all batches with transaction-based dry-run
    const { lastResult, totalRowsAffected } = await executeScriptBatches(pool, script, dryRun);
    
    if (created) await pool.close();
    
    // Save rollback script and commit to Git (if not dry run)
    if (!dryRun) {
      try {
        const objectsForCommit = formatObjectsForCommit(env, req.body.objects || []);
        await GitManager.saveScript(script, {
          environment: env,
          user: req.body.user || req.headers['x-user'] || 'unknown',
          action: 'rollback',
          correlationId: req.body.correlationId || req.headers['x-correlation-id'] || '',
          timestamp: new Date().toISOString(),
          rowsAffected: totalRowsAffected,
          objects: objectsForCommit
        });
      } catch (gitError) {
        console.error('Git commit error for rollback:', gitError);
        // Non-fatal
      }
    }
    
  const metaRb = { user: req.body.user || req.headers['x-user'] || null, correlationId: req.body.correlationId || req.headers['x-correlation-id'] || null, gitCommit: req.body.gitCommit || req.headers['x-git-commit'] || null, clientIp: req.ip || req.headers['x-forwarded-for'] || null };
  writeAudit(Object.assign({ timestamp: new Date().toISOString(), action: 'rollback', env, dryRun: !!dryRun, success: true, rowsAffected: totalRowsAffected, scriptPreview: script.substring(0, 1000) }, metaRb));
    return res.json({ success: true, dryRun: !!dryRun, recordset: lastResult?.recordset, rowsAffected: totalRowsAffected });
  } catch (e) {
    const metaRbErr = { user: req.body && req.body.user || req.headers['x-user'] || null, correlationId: req.body && req.body.correlationId || req.headers['x-correlation-id'] || null, gitCommit: req.body && req.body.gitCommit || req.headers['x-git-commit'] || null, clientIp: req.ip || req.headers['x-forwarded-for'] || null };
    writeAudit(Object.assign({ timestamp: new Date().toISOString(), action: 'rollback', env, dryRun: !!((req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true)), success: false, error: e.message, scriptPreview: (req.body && req.body.script) ? String(req.body.script).substring(0, 1000) : null }, metaRbErr));
    
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Query DB-backed audit with optional filters: env, action, since, until, top
app.get('/audit/db', async (req, res) => {
  const { env, action, since, until, top } = req.query || {};
  // requires at least one environment to be specified (we'll default to DEV if not provided)
  const targetEnv = env || 'DEV';
  if (!sqlConfigs[targetEnv]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  try {
    let pool = pools[targetEnv];
    let created = false;
    if (!pool || !pool.connected) { pool = new sql.ConnectionPool(sqlConfigs[targetEnv]); await pool.connect(); created = true; }
    const clauses = [];
    if (action) clauses.push('[action]=@action');
    if (since) clauses.push('[timestamp] >= @since');
    if (until) clauses.push('[timestamp] <= @until');
    const where = clauses.length ? ('WHERE ' + clauses.join(' AND ')) : '';
    const qTop = top ? `TOP (${parseInt(top)||200})` : 'TOP (200)';
    const q = `SELECT ${qTop} * FROM dbo.ddl_audit ${where} ORDER BY id DESC`;
    const reqq = pool.request();
    if (action) reqq.input('action', sql.NVarChar(50), action);
    if (since) reqq.input('since', sql.DateTime2, new Date(since));
    if (until) reqq.input('until', sql.DateTime2, new Date(until));
    const r = await reqq.query(q);
    if (created) await pool.close();
    return res.json({ success: true, rows: r.recordset });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Client-submitted audit logging endpoint (best-effort): POST /audit/log
app.post('/audit/log', express.json(), async (req, res) => {
  const entry = req.body || {};
  if (!entry || typeof entry !== 'object') return res.status(400).json({ success: false, message: 'Invalid audit entry' });
  try {
    // ensure timestamp
    if (!entry.timestamp) entry.timestamp = new Date().toISOString();
    // write to file and attempt DB write (fire-and-forget inside writeAudit)
    await writeAudit(entry);
    // best-effort DB write but do not block response
    writeAuditDb(entry).catch(() => {});
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ===================================================================
// GIT INTEGRATION FOR SCRIPT TRACKING AND CHANGE MANAGEMENT
// ===================================================================

// Git utility functions
const GitManager = {
  // Initialize Git repository if not exists
  async initRepository() {
    try {
      // Check if .git exists
      const gitPath = path.join(__dirname, '.git');
      if (!fs.existsSync(gitPath)) {
        await execAsync('git init', { cwd: __dirname });
        await execAsync('git config user.name "SQL Portal"', { cwd: __dirname });
        await execAsync('git config user.email "portal@sqldeployment.local"', { cwd: __dirname });
        console.log('Git repository initialized');
      }
      
      // Ensure scripts directory exists
      const scriptsDir = path.join(__dirname, 'scripts');
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Git init error:', error);
      return { success: false, error: error.message };
    }
  },

  // Save and commit script to Git
  async saveScript(scriptContent, metadata) {
    try {
      await this.initRepository();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const env = metadata.environment || 'unknown';
      const action = metadata.action || 'script';
      const user = metadata.user || 'system';
      const correlationId = (metadata.correlationId || '').substring(0, 8) || 'manual';
      
      // Create filename with metadata
      const filename = `${timestamp}_${action}_${env}_${user}_${correlationId}.sql`;
      const scriptPath = path.join(__dirname, 'scripts', filename);
      
      // Add metadata header to script
      const header = `-- SQL Portal Script Tracking
-- Timestamp: ${metadata.timestamp || new Date().toISOString()}
-- Environment: ${env}
-- User: ${user}
-- Action: ${action}
-- Correlation ID: ${metadata.correlationId || 'N/A'}
-- Rows Affected: ${metadata.rowsAffected || 'N/A'}
-- Object(s): ${metadata.objects || 'N/A'}

`;
      
  // Write script with header and also a clean variant
  fs.writeFileSync(scriptPath, header + scriptContent, 'utf8');
  const cleanFilename = `${timestamp}_${action}_${env}_${user}_${correlationId}_clean.sql`;
  const cleanPath = path.join(__dirname, 'scripts', cleanFilename);
  fs.writeFileSync(cleanPath, scriptContent, 'utf8');

  // Add to Git (both variants)
  await execAsync(`git add "${filename}"`, { cwd: path.join(__dirname, 'scripts') });
  await execAsync(`git add "${cleanFilename}"`, { cwd: path.join(__dirname, 'scripts') });
      
      // Create detailed commit message
      const commitMessage = `${action.toUpperCase()}: ${env} - ${user}

Script: ${filename}
Environment: ${env}
User: ${user}
Action: ${action}
Timestamp: ${metadata.timestamp || new Date().toISOString()}
Correlation ID: ${metadata.correlationId || 'N/A'}
Rows Affected: ${metadata.rowsAffected || 'N/A'}
Objects: ${metadata.objects || 'N/A'}

--- Script Preview ---
${scriptContent.substring(0, 500)}${scriptContent.length > 500 ? '...' : ''}`;

      // Commit to Git using multiple -m parts so Windows quoting/newlines are preserved
      const parts = [
        `${action.toUpperCase()}: ${env} - ${user}`,
        `Script: ${filename}`,
        `Environment: ${env}`,
        `User: ${user}`,
        `Action: ${action}`,
        `Timestamp: ${metadata.timestamp || new Date().toISOString()}`,
        `Correlation ID: ${metadata.correlationId || 'N/A'}`,
        `Rows Affected: ${metadata.rowsAffected || 'N/A'}`,
        `Objects: ${metadata.objects ? (Array.isArray(metadata.objects) ? metadata.objects.join(', ') : metadata.objects) : 'N/A'}`
      ];
      let commitCmd = 'git commit';
      parts.forEach(p => { commitCmd += ` -m "${String(p).replace(/"/g, '\\"')}"`; });
      const { stdout } = await execAsync(commitCmd, { cwd: __dirname });
      
      // Get commit hash
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { cwd: __dirname });
      
      return {
        success: true,
        filename,
        commitHash: commitHash.trim(),
        scriptPath,
        message: 'Script saved and committed to Git'
      };
    } catch (error) {
      console.error('Git save error:', error);
      return { success: false, error: error.message };
    }
  },

  // Get Git history for scripts
  async getHistory(limit = 50) {
    try {
      const { stdout } = await execAsync(
        `git log --oneline -n ${limit} --format="%H|%ai|%an|%ae|%s"`,
        { cwd: __dirname }
      );
      
      if (!stdout.trim()) {
        return { success: true, history: [] };
      }
      
      const commits = stdout.trim().split('\n').map(line => {
        const [hash, date, author, email, ...messageParts] = line.split('|');
        const message = messageParts.join('|');
        
        // Extract metadata from commit message
        const envMatch = message.match(/(\w+)\s*-\s*(\w+)/);
        const actionMatch = message.match(/^(\w+):/);
        
        return {
          hash: hash.trim(),
          shortHash: hash.substring(0, 8),
          date: date.trim(),
          author: author.trim(),
          email: email.trim(),
          message: message.trim(),
          environment: envMatch ? envMatch[1] : null,
          user: envMatch ? envMatch[2] : null,
          action: actionMatch ? actionMatch[1].toLowerCase() : null
        };
      });
      
      return { success: true, history: commits };
    } catch (error) {
      return { success: false, error: error.message, history: [] };
    }
  },

  // Get object-specific change history
  async getObjectHistory(objectType, schema, name, limit = 20) {
    try {
      const searchPattern = `${schema}.${name}`;
      const { stdout } = await execAsync(
        `git log --oneline -n ${limit} --format="%H|%ai|%an|%ae|%s" --grep="${searchPattern}"`,
        { cwd: __dirname }
      );
      
      if (!stdout.trim()) {
        return { success: true, history: [] };
      }
      
      const commits = stdout.trim().split('\n').map(line => {
        const [hash, date, author, email, ...messageParts] = line.split('|');
        const message = messageParts.join('|');
        
        return {
          hash: hash.trim(),
          shortHash: hash.substring(0, 8),
          date: date.trim(),
          author: author.trim(),
          email: email.trim(),
          message: message.trim(),
          objectType,
          schema,
          name
        };
      });
      
      return { success: true, history: commits };
    } catch (error) {
      return { success: false, error: error.message, history: [] };
    }
  },

  // Get commit details with diff
  async getCommitDetails(commitHash) {
    try {
      // Get commit info
      const { stdout: commitInfo } = await execAsync(
        `git show ${commitHash} --format="%H|%ai|%an|%ae|%s" --name-only`,
        { cwd: __dirname }
      );
      
      const lines = commitInfo.split('\n');
      const [hash, date, author, email, ...messageParts] = lines[0].split('|');
      const message = messageParts.join('|');
      
      // Get files changed
      const files = lines.slice(1).filter(line => line.trim() && !line.startsWith('diff'));
      
      // Get diff
      const { stdout: diff } = await execAsync(
        `git show ${commitHash}`,
        { cwd: __dirname }
      );
      
      // Parse metadata from commit message
      const metadata = this.parseCommitMetadata(message);
      
      return {
        success: true,
        commit: {
          hash: hash.trim(),
          shortHash: hash.substring(0, 8),
          date: date.trim(),
          author: author.trim(),
          email: email.trim(),
          message: message.trim(),
          metadata
        },
        files,
        diff
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Parse metadata from commit message
  parseCommitMetadata(message) {
    const metadata = {};
    
    // Extract structured metadata
    const patterns = {
      environment: /Environment:\s*([^\n]+)/i,
      user: /User:\s*([^\n]+)/i,
      action: /Action:\s*([^\n]+)/i,
      timestamp: /Timestamp:\s*([^\n]+)/i,
      correlationId: /Correlation ID:\s*([^\n]+)/i,
      rowsAffected: /Rows Affected:\s*([^\n]+)/i,
      objects: /Objects:\s*([^\n]+)/i
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = message.match(pattern);
      if (match) {
        metadata[key] = match[1].trim();
      }
    }
    
    return metadata;
  },

  // Save and commit multiple scripts to Git in a single commit (e.g., implementation + rollback)
  async saveScripts(scripts, metadata) {
    try {
      await this.initRepository();

      if (!Array.isArray(scripts) || scripts.length === 0) {
        return { success: false, error: 'No scripts provided' };
      }

      const baseTs = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const env = metadata.environment || 'unknown';
      const user = metadata.user || 'system';
      const correlationId = (metadata.correlationId || '').substring(0, 8) || 'manual';

      const createdFiles = [];
      for (const entry of scripts) {
        if (!entry || typeof entry.content !== 'string' || !entry.content.trim()) continue;
        const action = (entry.action || metadata.action || 'script').toLowerCase();
        const suffix = entry.suffix ? `_${entry.suffix}` : '';
        const filename = `${baseTs}_${action}_${env}_${user}_${correlationId}${suffix}.sql`;
        const scriptPath = path.join(__dirname, 'scripts', filename);

        const header = `-- SQL Portal Script Tracking\n-- Timestamp: ${metadata.timestamp || new Date().toISOString()}\n-- Environment: ${env}\n-- User: ${user}\n-- Action: ${action}\n-- Correlation ID: ${metadata.correlationId || 'N/A'}\n-- Rows Affected: ${metadata.rowsAffected || 'N/A'}\n-- Object(s): ${metadata.objects || 'N/A'}\n\n`;
        // Write headered (tracked) file
        fs.writeFileSync(scriptPath, header + entry.content, 'utf8');
        // Also write a clean version without header for direct DB consumption
        const cleanFilename = `${baseTs}_${action}_${env}_${user}_${correlationId}${suffix}_clean.sql`;
        const cleanPath = path.join(__dirname, 'scripts', cleanFilename);
        fs.writeFileSync(cleanPath, entry.content, 'utf8');

        // Stage the file in the scripts directory
        await execAsync(`git add "${filename}"`, { cwd: path.join(__dirname, 'scripts') });
        await execAsync(`git add "${cleanFilename}"`, { cwd: path.join(__dirname, 'scripts') });
        createdFiles.push({ filename, scriptPath, action });
        createdFiles.push({ filename: cleanFilename, scriptPath: cleanPath, action: action + '_clean' });
      }

      if (createdFiles.length === 0) {
        return { success: false, error: 'No valid scripts to save' };
      }

      // Build a concise multi-line commit message using multiple -m parts (Windows-safe)
  const hasRollback = scripts.some(s => ((s.action || metadata.action || '').toLowerCase() === 'rollback'));
  const baseTitle = `${(metadata.action || 'script').toUpperCase()}: ${env} - ${user}`;
  const primaryTitle = hasRollback ? `${(metadata.action || 'script').toUpperCase()}(+RB): ${env} - ${user}` : baseTitle;
      const parts = [
        primaryTitle,
        `Environment: ${env}`,
        `User: ${user}`,
        `Action: ${metadata.action || 'script'}`,
        `Timestamp: ${metadata.timestamp || new Date().toISOString()}`,
        `Correlation ID: ${metadata.correlationId || 'N/A'}`,
        `Rows Affected: ${metadata.rowsAffected || 'N/A'}`,
        `Objects: ${metadata.objects ? (Array.isArray(metadata.objects) ? metadata.objects.join(', ') : metadata.objects) : 'N/A'}`,
        `Files: ${createdFiles.map(f => f.filename).join(', ')}`
      ];
      let commitCmd = 'git commit';
      parts.forEach(p => { commitCmd += ` -m "${String(p).replace(/"/g, '\\"')}"`; });
      await execAsync(commitCmd, { cwd: __dirname });

      // Get commit hash
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { cwd: __dirname });

      return {
        success: true,
        commitHash: commitHash.trim(),
        files: createdFiles.map(f => f.filename),
        message: 'Scripts saved and committed to Git'
      };
    } catch (error) {
      console.error('Git saveScripts error:', error);
      return { success: false, error: error.message };
    }
  }
};

// ===================================================================
// GIT API ENDPOINTS
// ===================================================================

// Get Git repository status and history
app.get('/api/git/status', async (req, res) => {
  try {
    const history = await GitManager.getHistory(10);
    const scriptFiles = fs.readdirSync(path.join(__dirname, 'scripts')).length;
    
    res.json({
      success: true,
      status: 'active',
      totalScripts: scriptFiles,
      recentCommits: history.history || []
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get complete Git history
app.get('/api/git/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await GitManager.getHistory(limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get object-specific change history
app.get('/api/git/object-history/:type/:schema/:name', async (req, res) => {
  try {
    const { type, schema, name } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const result = await GitManager.getObjectHistory(type, schema, name, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific commit details
app.get('/api/git/commit/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const result = await GitManager.getCommitDetails(hash);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize Git repository
app.post('/api/git/init', async (req, res) => {
  try {
    const result = await GitManager.initRepository();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================================================================
// ENHANCED DDL ENDPOINTS WITH GIT INTEGRATION
// ===================================================================

// Enhanced DDL Apply with Git tracking
app.post('/ddl/apply', express.json(), async (req, res) => {
  const { env, script } = req.body || {};
  if (!env || !script) return res.status(400).json({ success: false, message: 'env and script required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  
  const startTime = Date.now();
  let gitResult = null;
  
  try {
    const dryRun = (req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true);
    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) { 
      pool = new sql.ConnectionPool(sqlConfigs[env]); 
      await pool.connect(); 
      created = true; 
    }
    
    // Execute batches with transaction-based dry-run
    const { lastResult, totalRowsAffected } = await executeScriptBatches(pool, script, dryRun);
    
    if (created) await pool.close();
    
    // Save to Git if not dry run (implementation + optional rollback as a single commit)
    if (!dryRun) {
      const gitMetadata = {
        environment: env,
        user: req.body.user || req.headers['x-user'] || 'anonymous',
        action: 'implementation',
        correlationId: req.body.correlationId || req.headers['x-correlation-id'] || null,
        timestamp: new Date().toISOString(),
        rowsAffected: totalRowsAffected,
        objects: formatObjectsForCommit(env, req.body.objects || []),
        executionTime: Date.now() - startTime
      };
      const scriptsToSave = [{ content: script, action: 'implementation', suffix: '' }];
      const rollbackScript = req.body.rollbackScript || null;
      if (rollbackScript && typeof rollbackScript === 'string' && rollbackScript.trim()) {
        scriptsToSave.push({ content: rollbackScript, action: 'rollback', suffix: '' });
      }
      gitResult = await GitManager.saveScripts(scriptsToSave, gitMetadata);
    }
    
    // Write audit log
    const meta = { 
      user: req.body.user || req.headers['x-user'] || null, 
      correlationId: req.body.correlationId || req.headers['x-correlation-id'] || null, 
      gitCommit: gitResult?.commitHash || null, 
      clientIp: req.ip || req.headers['x-forwarded-for'] || null 
    };
    
    writeAudit(Object.assign({ 
      timestamp: new Date().toISOString(), 
      action: 'implementation', 
      env, 
      dryRun: !!dryRun, 
      success: true, 
      rowsAffected: totalRowsAffected, 
      scriptPreview: script.substring(0, 1000),
      gitCommit: gitResult?.commitHash || null,
      gitFile: Array.isArray(gitResult?.files) ? gitResult.files.join(', ') : (gitResult?.filename || null)
    }, meta));
    
    return res.json({ 
      success: true, 
      dryRun: !!dryRun, 
      recordset: lastResult?.recordset, 
      rowsAffected: totalRowsAffected,
      git: gitResult || { success: false, message: 'Git tracking skipped (dry run)' }
    });
    
  } catch (e) {
    const metaErr = { 
      user: req.body && req.body.user || req.headers['x-user'] || null, 
      correlationId: req.body && req.body.correlationId || req.headers['x-correlation-id'] || null, 
      gitCommit: null, 
      clientIp: req.ip || req.headers['x-forwarded-for'] || null 
    };
    
    writeAudit(Object.assign({ 
      timestamp: new Date().toISOString(), 
      action: 'implementation', 
      env, 
      dryRun: !!((req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true)), 
      success: false, 
      error: e.message, 
      scriptPreview: (req.body && req.body.script) ? String(req.body.script).substring(0, 1000) : null 
    }, metaErr));
    
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Enhanced DDL Rollback with Git tracking
app.post('/ddl/rollback', express.json(), async (req, res) => {
  const { env, script } = req.body || {};
  if (!env || !script) return res.status(400).json({ success: false, message: 'env and script required' });
  if (!sqlConfigs[env]) return res.status(400).json({ success: false, message: 'Invalid environment' });
  
  const startTime = Date.now();
  let gitResult = null;
  
  try {
    const dryRun = (req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true);
    let pool = pools[env];
    let created = false;
    if (!pool || !pool.connected) { 
      pool = new sql.ConnectionPool(sqlConfigs[env]); 
      await pool.connect(); 
      created = true; 
    }
    
    const { lastResult, totalRowsAffected } = await executeScriptBatches(pool, script, dryRun);
    
    if (created) await pool.close();
    
    // Save to Git if not dry run
    if (!dryRun) {
      const gitMetadata = {
        environment: env,
        user: req.body.user || req.headers['x-user'] || 'anonymous',
        action: 'rollback',
        correlationId: req.body.correlationId || req.headers['x-correlation-id'] || null,
        timestamp: new Date().toISOString(),
        rowsAffected: totalRowsAffected,
        objects: formatObjectsForCommit(env, req.body.objects || []),
        executionTime: Date.now() - startTime
      };
      
      gitResult = await GitManager.saveScript(script, gitMetadata);
    }
    
    // Write audit log
    const metaRb = { 
      user: req.body.user || req.headers['x-user'] || null, 
      correlationId: req.body.correlationId || req.headers['x-correlation-id'] || null, 
      gitCommit: gitResult?.commitHash || null, 
      clientIp: req.ip || req.headers['x-forwarded-for'] || null 
    };
    
    writeAudit(Object.assign({ 
      timestamp: new Date().toISOString(), 
      action: 'rollback', 
      env, 
      dryRun: !!dryRun, 
      success: true, 
      rowsAffected: totalRowsAffected, 
      scriptPreview: script.substring(0, 1000),
      gitCommit: gitResult?.commitHash || null,
      gitFile: gitResult?.filename || null
    }, metaRb));
    
    return res.json({ 
      success: true, 
      dryRun: !!dryRun, 
      recordset: lastResult?.recordset, 
      rowsAffected: totalRowsAffected,
      git: gitResult || { success: false, message: 'Git tracking skipped (dry run)' }
    });
    
  } catch (e) {
    const metaRbErr = { 
      user: req.body && req.body.user || req.headers['x-user'] || null, 
      correlationId: req.body && req.body.correlationId || req.headers['x-correlation-id'] || null, 
      gitCommit: null, 
      clientIp: req.ip || req.headers['x-forwarded-for'] || null 
    };
    
    writeAudit(Object.assign({ 
      timestamp: new Date().toISOString(), 
      action: 'rollback', 
      env, 
      dryRun: !!((req.query && req.query.dryRun === 'true') || (req.body && req.body.dryRun === true)), 
      success: false, 
      error: e.message, 
      scriptPreview: (req.body && req.body.script) ? String(req.body.script).substring(0, 1000) : null 
    }, metaRbErr));
    
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Add Git routes just before server start
try {
  console.log('Adding final Git routes...');
  
  // Simple working test route
  app.get('/api/simple-working-test', (req, res) => {
    res.json({ message: 'This route definitely works!', timestamp: new Date().toISOString() });
  });
  
  // Git status endpoint
  app.get('/api/git/status', async (req, res) => {
    console.log('Git status route accessed');
    try {
      const scriptsDir = path.join(__dirname, 'scripts');
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      
      const scriptFiles = fs.readdirSync(scriptsDir).length;
      
      res.json({
        success: true,
        status: 'active',
        totalScripts: scriptFiles,
        message: 'Git status working'
      });
    } catch (error) {
      console.error('Git status error:', error);
      res.json({ success: false, error: error.message });
    }
  });

  // Git history endpoint
  app.get('/api/git/history', async (req, res) => {
    console.log('Git history route accessed');
    try {
      const limit = parseInt(req.query.limit) || 20;
      
      try {
        const { stdout } = await execAsync(`git log --oneline -n ${limit} --format="%H|%ai|%an|%ae|%s"`, { cwd: __dirname });
        
        if (!stdout.trim()) {
          return res.json({ success: true, history: [] });
        }
        
        const history = stdout.trim().split('\n').map(line => {
          const [hash, date, author, email, ...messageParts] = line.split('|');
          const message = messageParts.join('|');
          
          return {
            hash: hash?.trim(),
            shortHash: hash?.substring(0, 8),
            date: date?.trim(),
            author: author?.trim(),
            email: email?.trim(),
            message: message?.trim()
          };
        });
        
        res.json({ success: true, history });
      } catch (gitError) {
        console.log('Git command failed:', gitError.message);
        res.json({ success: true, history: [], message: 'No git history available' });
      }
    } catch (error) {
      console.error('Git history error:', error);
      res.json({ success: false, error: error.message, history: [] });
    }
  });

  // Object-specific Git history
  app.get('/api/git/object-history/:type/:schema/:name', async (req, res) => {
    console.log('Git object history route accessed');
    try {
      const { type, schema, name } = req.params;
      const limit = parseInt(req.query.limit) || 20;
      const searchPattern = `${schema}.${name}`;
      
      try {
        const { stdout } = await execAsync(
          `git log --oneline -n ${limit} --format="%H|%ai|%an|%ae|%s" --grep="${searchPattern}"`,
          { cwd: __dirname }
        );
        
        if (!stdout.trim()) {
          return res.json({ success: true, history: [] });
        }
        
        const history = stdout.trim().split('\n').map(line => {
          const [hash, date, author, email, ...messageParts] = line.split('|');
          const message = messageParts.join('|');
          
          return {
            hash: hash?.trim(),
            shortHash: hash?.substring(0, 8),
            date: date?.trim(),
            author: author?.trim(),
            email: email?.trim(),
            message: message?.trim(),
            objectType: type,
            schema,
            name
          };
        });
        
        res.json({ success: true, history });
      } catch (gitError) {
        console.log('Git object history command failed:', gitError.message);
        res.json({ success: true, history: [], message: 'No git history available for this object' });
      }
    } catch (error) {
      console.error('Git object history error:', error);
      res.json({ success: false, error: error.message, history: [] });
    }
  });

  // Git commit details
  app.get('/api/git/commit/:hash', async (req, res) => {
    console.log('Git commit details route accessed');
    try {
      const { hash } = req.params;
      
      try {
        const { stdout: commitInfo } = await execAsync(
          `git show ${hash} --format="%H|%ai|%an|%ae|%s" --name-only`,
          { cwd: __dirname }
        );
        
        const lines = commitInfo.split('\n');
        const [fullHash, date, author, email, ...messageParts] = lines[0].split('|');
        const message = messageParts.join('|');
        
        const files = lines.slice(1).filter(line => line.trim() && !line.startsWith('diff'));
        
        res.json({
          success: true,
          commit: {
            hash: fullHash?.trim(),
            shortHash: fullHash?.substring(0, 8),
            date: date?.trim(),
            author: author?.trim(),
            email: email?.trim(),
            message: message?.trim()
          },
          files
        });
      } catch (gitError) {
        console.log('Git commit details command failed:', gitError.message);
        res.json({ success: false, error: 'Commit not found or git not available' });
      }
    } catch (error) {
      console.error('Git commit details error:', error);
      res.json({ success: false, error: error.message });
    }
  });
  
  console.log('Git routes added successfully');
} catch (error) {
  console.error('Error adding routes:', error);
}

// Start the server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));