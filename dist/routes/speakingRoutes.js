"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const speakingController_1 = require("../controllers/speakingController");
const upload_1 = require("../middleware/upload");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Diagnostic & Public TTS / STT endpoints
router.post('/transcribe', upload_1.uploadAudio.single('audio'), speakingController_1.transcribeAudio);
router.get('/tts/voices', speakingController_1.getTtsVoices);
router.post('/tts/synthesize', speakingController_1.synthesizeTts);
router.get('/tts/synthesize', speakingController_1.synthesizeTts);
router.get('/tts/stream', speakingController_1.synthesizeTts);
// Public Detailed Diagnostic Endpoint
router.get('/tts/diagnostic', async (req, res) => {
    const https = require('https');
    const dns = require('dns');
    const WebSocket = require('ws');
    const crypto = require('crypto');
    const report = {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV || 'production'
    };
    // 1. DNS check
    try {
        const ip = await new Promise((resolve, reject) => {
            dns.lookup('speech.platform.bing.com', (err, address) => err ? reject(err) : resolve(address));
        });
        report.dns = { success: true, ip };
    }
    catch (err) {
        report.dns = { success: false, error: err.message };
    }
    // 2. HTTPS reachability to Bing voices list
    try {
        const httpsRes = await new Promise((resolve, reject) => {
            const req = https.get('https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4', { timeout: 4000 }, (r) => {
                resolve({ statusCode: r.statusCode, date: r.headers['date'], ref: r.headers['x-msedge-ref'] });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(new Error('HTTPS Timeout 4s')); });
        });
        report.httpsToBing = { success: true, ...httpsRes };
    }
    catch (err) {
        report.httpsToBing = { success: false, error: err.message };
    }
    // 3. Native WebSocket check to Edge-TTS
    try {
        const WIN_EPOCH = 11644473600;
        const S_TO_NS = 1e9;
        const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
        let ticks = Date.now() / 1e3;
        ticks += WIN_EPOCH;
        ticks -= ticks % 300;
        ticks *= S_TO_NS / 100;
        const secMsGec = crypto.createHash('sha256').update(`${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`, 'ascii').digest('hex').toUpperCase();
        const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-143.0.3650.75&ConnectionId=${crypto.randomUUID().replace(/-/g, '')}`;
        const wsRes = await new Promise((resolve) => {
            const ws = new WebSocket(wssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
                    'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache'
                },
                handshakeTimeout: 4000
            });
            ws.on('open', () => {
                ws.close();
                resolve({ status: 'OPEN_SUCCESS' });
            });
            ws.on('unexpected-response', (req, res) => {
                try {
                    ws.terminate();
                }
                catch (_) { }
                resolve({ status: 'UNEXPECTED_RESPONSE', httpCode: res.statusCode, headers: res.headers });
            });
            ws.on('error', (err) => {
                resolve({ status: 'ERROR', error: err.message });
            });
            setTimeout(() => {
                try {
                    ws.terminate();
                }
                catch (_) { }
                resolve({ status: 'TIMEOUT_4S' });
            }, 4000);
        });
        report.websocket = wsRes;
    }
    catch (err) {
        report.websocket = { status: 'EXCEPTION', error: err.message };
    }
    res.json(report);
});
// Authenticated endpoints
router.use(auth_1.authenticateToken);
router.get('/attempts/history', speakingController_1.getSpeakingAttemptsHistory);
router.get('/test/:testId/prompts', speakingController_1.getPrompts);
router.post('/submit', upload_1.uploadAudio.single('audio'), speakingController_1.submitAttempt);
exports.default = router;
