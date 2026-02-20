const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

const TEMP_DIR = path.join('/tmp', 'lua-dumper');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function cleanupFiles(...files) {
    files.forEach(f => {
        if (f && fs.existsSync(f)) fs.unlink(f, () => {});
    });
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/dump', async (req, res) => {
    const { code, options = {} } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'No code provided' });
    }

    if (code.length > 10 * 1024 * 1024) {
        return res.status(400).json({ success: false, error: 'Code too large (max 10MB)' });
    }

    const requestId = uuidv4();
    const inputFile = path.join(TEMP_DIR, `in_${requestId}.lua`);
    const outputFile = path.join(TEMP_DIR, `out_${requestId}.lua`);

    try {
        fs.writeFileSync(inputFile, code, 'utf8');

        let cmd = `lua5.3 dumper.lua "${inputFile}" "${outputFile}"`;
        if (options.key) cmd += ` "${options.key}"`;
        if (options.placeId) cmd += ` ${options.placeId}`;

        const result = await new Promise((resolve) => {
            exec(cmd, {
                cwd: __dirname,
                timeout: 25000,
                maxBuffer: 20 * 1024 * 1024,
                killSignal: 'SIGKILL'
            }, (error, stdout, stderr) => {
                resolve({ error, stdout, stderr });
            });
        });

        let dumpedCode = '';
        let stats = null;

        if (fs.existsSync(outputFile)) {
            dumpedCode = fs.readFileSync(outputFile, 'utf8');
            const statsMatch = result.stdout.match(/Lines:\s*(\d+)\s*\|\s*Remotes:\s*(\d+)\s*\|\s*Strings:\s*(\d+)/);
            if (statsMatch) {
                stats = {
                    totalLines: parseInt(statsMatch[1]),
                    remoteCalls: parseInt(statsMatch[2]),
                    suspiciousStrings: parseInt(statsMatch[3])
                };
            }
        }

        cleanupFiles(inputFile, outputFile);

        if (!dumpedCode) {
            return res.status(500).json({
                success: false,
                error: 'Dumper produced no output',
                details: result.stderr || result.error?.message
            });
        }

        res.json({
            success: true,
            dumpedCode,
            stats,
            consoleOutput: result.stdout,
            warnings: result.stderr || null
        });

    } catch (error) {
        cleanupFiles(inputFile, outputFile);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use((err, req, res, next) => {
    res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    require('./bot.js');
});
