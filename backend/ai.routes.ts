// FIX: Use explicit express types to resolve type conflicts.
import express from 'express';
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from 'openai';
import { protect } from './auth.routes';
import { LogEntry, LogLevel } from './types';
import fetch from 'node-fetch';
import { getDb } from './database';

const router = express.Router();

// --- AI Client Initialization ---
let ai: GoogleGenAI | null = null;
if (process.env.API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        console.log("Google Gemini AI client initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize Gemini AI client:", e);
    }
} else {
    console.warn("Google Gemini API_KEY not found in .env file. Gemini features will be disabled.");
}

let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
    try {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        console.log("OpenAI client initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize OpenAI client:", e);
    }
} else {
    console.warn("OPENAI_API_KEY not found in .env file. OpenAI features will be disabled.");
}

// --- Helper: Centralized AI Error Handling ---
const handleAiError = (e: any, res: express.Response) => {
    console.error("AI Service Error:", e);
    
    let status = 500;
    let message = "An internal AI service error occurred.";

    // Check for status code in the error object
    if (e.status) {
        status = e.status;
    }

    // Convert error to string to check for common error signatures
    const errorString = JSON.stringify(e);
    const errorMessage = e.message || errorString;

    // Detect Quota/Rate Limit Errors (429)
    if (
        status === 429 || 
        errorMessage.includes("429") || 
        errorMessage.includes("RESOURCE_EXHAUSTED") || 
        errorMessage.includes("quota")
    ) {
        status = 429;
        message = "✨ AI Quota Exceeded (Free Tier). Please wait ~30 seconds before trying again.";
    } 
    // Detect Blocked Content (Safety Filters)
    else if (e.response?.promptFeedback?.blockReason) {
        status = 400;
        message = `AI blocked the request: ${e.response.promptFeedback.blockReason}`;
    }
    // Clean up raw JSON error messages from SDKs
    else if (errorMessage.includes('{"error":')) {
        try {
            // Attempt to extract the clean message from JSON dump
            // e.g. [400 Bad Request] ... {"error": {"message": "Invalid argument..."}}
            const jsonStart = errorMessage.indexOf('{');
            const jsonPart = errorMessage.substring(jsonStart);
            const parsed = JSON.parse(jsonPart);
            if (parsed.error && parsed.error.message) {
                message = `AI Provider Error: ${parsed.error.message}`;
            } else {
                message = errorMessage;
            }
        } catch {
            message = errorMessage;
        }
    } else {
        message = errorMessage;
    }

    res.status(status).json({ message });
};

const getPythonServiceUrl = () => {
    // Default to localhost:5000 for local development if not specified
    let url = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    if (!url.startsWith('http')) {
        url = `http://${url}`;
    }
    const finalUrl = url.replace(/\/$/, '');
    console.log(`[AI] Using Python Service URL: ${finalUrl}`);
    return finalUrl;
};


// GET /api/ai/status
router.get('/status', (req: express.Request, res: express.Response) => {
    const pythonServiceUrl = getPythonServiceUrl();
    res.json({
        status: 'online',
        pythonServiceUrl,
        geminiConfigured: !!ai,
        openaiConfigured: !!openai,
        geminiStatus: !!ai ? 'ok' : 'not_configured',
        openaiStatus: !!openai ? 'ok' : 'not_configured',
        timestamp: new Date().toISOString()
    });
});

// All subsequent routes are protected
router.use(protect);

router.post('/explain', async (req: express.Request, res: express.Response) => {
    const { logEntry, provider } = req.body as { logEntry: LogEntry, provider: 'gemini' | 'openai' | 'python' };

    if (!logEntry) {
        return res.status(400).json({ message: "logEntry is required." });
    }

    const prompt = `Explain the following log entry in simple terms. What is the likely cause, and what is the potential impact? Format the response as simple HTML paragraphs. Log: \n\n${JSON.stringify(logEntry)}`;

    try {
        let explanation: string = '';
        if (provider === 'openai' && openai) {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
            });
            explanation = completion.choices[0].message.content || 'No explanation available.';
        } else if (provider === 'gemini' && ai) {
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt
            });
            explanation = response.text || 'No explanation was returned from the Gemini API.';
        } else if (provider === 'python') {
            const pythonServiceUrl = getPythonServiceUrl();
            console.log(`Calling Python service (explain) at: ${pythonServiceUrl}/explain`);
            
            const response = await fetch(`${pythonServiceUrl}/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logEntry })
            });
            if (!response.ok) throw new Error(`Python service error: ${response.statusText}`);
            const data = await response.json() as any;
            explanation = data.explanation;
        } else {
            return res.status(400).json({ message: `Provider ${provider} is not configured or available.` });
        }
        res.json({ explanation });
    } catch (e: any) {
        handleAiError(e, res);
    }
});


router.post('/generate-filters', async (req: express.Request, res: express.Response) => {
    const { query, provider } = req.body as { query: string, provider: 'gemini' | 'openai' | 'python' };
    if (!query) {
        return res.status(400).json({ message: "Query is required." });
    }

    const prompt = `Based on the user's natural language query, convert it into a JSON object with filters for a log search engine. The query is: "${query}". The available log levels are "INFO", "WARN", "ERROR", "DEBUG", "FATAL". The available sources are "api-gateway", "user-service", "db-replicator", "frontend-logger", "auth-service". The JSON object should have optional keys: "keyword" (string), "levels" (array of strings), and "sources" (array of strings). Only include keys if they are clearly specified in the query. For example, if the query is "show me fatal errors from the auth-service containing 'Invalid credentials'", the JSON should be {"keyword": "Invalid credentials", "levels": ["FATAL"], "sources": ["auth-service"]}.`;

    try {
        let filterJsonString: string = '{}';
        if (provider === 'openai' && openai) {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "system", content: "You are a helpful assistant that generates JSON." }, { role: "user", content: prompt }],
                response_format: { type: "json_object" },
            });
            filterJsonString = completion.choices[0].message.content || '{}';
        } else if (provider === 'gemini' && ai) {
             const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            keyword: { type: Type.STRING, nullable: true },
                            levels: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                            sources: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }
                        }
                    }
                }
            });
            filterJsonString = response.text || '{}';
        } else {
            return res.status(400).json({ message: `Provider ${provider} is not configured or available.` });
        }
        res.json({ filters: JSON.parse(filterJsonString) });
    } catch (e: any) {
        handleAiError(e, res);
    }
});

router.post('/chat', async (req: express.Request, res: express.Response) => {
    const { history, message, provider } = req.body;
    if (!message) {
        return res.status(400).json({ message: "Message is required." });
    }
    
    try {
        let reply: string = '';
         if (provider === 'openai' && openai) {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [...history, { role: "user", content: message }],
            });
            reply = completion.choices[0].message.content || 'I am unable to respond right now.';
        } else if (provider === 'gemini' && ai) {
            const chat = ai.chats.create({ model: 'gemini-1.5-flash' });
            const response = await chat.sendMessage({ message });
            reply = response.text || 'I am unable to respond right now.';
        } else if (provider === 'python') {
            const pythonServiceUrl = getPythonServiceUrl();
            console.log(`Calling Python service (chat) at: ${pythonServiceUrl}/chat`);

            const response = await fetch(`${pythonServiceUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history, message })
            });
            if (!response.ok) throw new Error(`Python service error: ${response.statusText}`);
            const data = await response.json() as any;
            reply = data.reply;
        } else {
            return res.status(400).json({ message: `Provider ${provider} is not configured or available.` });
        }
        res.json({ reply });
    } catch (e: any) {
        handleAiError(e, res);
    }
});


router.post('/extract-text', async (req: express.Request, res: express.Response) => {
    const { image, mimeType, provider } = req.body;
    if (!image || !mimeType) {
        return res.status(400).json({ message: "Image and mimeType are required." });
    }

    const prompt = "Extract all text from this image. If it looks like code or a terminal log, preserve the formatting as much as possible.";

    try {
        let text: string = '';
        const imagePart = { inlineData: { data: image, mimeType } };

        if (provider === 'openai' && openai) {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } },
                        ],
                    },
                ],
            });
            text = response.choices[0].message.content || '';
        } else if (provider === 'gemini' && ai) {
            const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: { parts: [ { text: prompt }, imagePart ]}
            });
            text = response.text || '';
        } else {
            return res.status(400).json({ message: `Provider ${provider} is not configured or available.` });
        }
        res.json({ text });
    } catch (e: any) {
        handleAiError(e, res);
    }
});

// Other routes remain mocked as they are more complex to implement without real data or are less critical.
const mockFlowchart = {
    nodes: [
        { id: '1', text: 'Start', type: 'oval' }, { id: '2', text: 'Read Input i', type: 'parallelogram' },
        { id: '3', text: 'i < 10?', type: 'rhombus' }, { id: '4', text: 'Print i', type: 'rect' },
        { id: '5', text: 'i = i + 1', type: 'rect' }, { id: '6', text: 'End', type: 'oval' }
    ],
    links: [
        { source: '1', target: '2' }, { source: '2', target: '3' }, { source: '3', target: '4', label: 'Yes' },
        { source: '4', target: '5' }, { source: '5', target: '3' }, { source: '3', target: '6', label: 'No' }
    ]
};
const mockRca = {
    summary: "The fatal error appears to be caused by a database connection timeout, which was preceded by a spike in CPU usage warnings. This suggests the database was under heavy load, became unresponsive, and caused the dependent `auth-service` to fail.",
    keyEvents: [], nextSteps: ["Check the database server's CPU and memory utilization during the incident period.", "Inspect the database logs for any long-running queries or errors.", "Consider increasing the connection pool size or optimizing the slow queries."]
};

router.post('/edit-image', async (req: express.Request, res: express.Response) => {
    const { image, mimeType, prompt } = req.body;
    
    if (!image || !prompt) {
        return res.status(400).json({ message: "Image and prompt are required." });
    }

    try {
        if (ai) {
             const response = await ai.models.generateContent({
                model: 'gemini-1.5-flash-image',
                contents: {
                    parts: [
                        { inlineData: { data: image, mimeType: mimeType || 'image/png' } },
                        { text: prompt },
                    ],
                },
            });
            
            const parts = response.candidates?.[0]?.content?.parts;
            let editedImage = '';
            
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        editedImage = part.inlineData.data;
                        break;
                    }
                }
            }

            if (editedImage) {
                res.json({ editedImage });
            } else {
                const text = parts?.find(p => p.text)?.text || "No response text";
                res.status(500).json({ message: "AI did not return an image. " + text });
            }

        } else {
             return res.status(400).json({ message: "Gemini API is not configured." });
        }
    } catch (e: any) {
        handleAiError(e, res);
    }
});

router.post('/generate-flowchart', (req: express.Request, res: express.Response) => res.json(mockFlowchart));

router.post('/root-cause-analysis', async (req: express.Request, res: express.Response) => {
    const { targetLog, logHistory, provider } = req.body;
    if (provider === 'python') {
        try {
            const pythonServiceUrl = getPythonServiceUrl();
            console.log(`Calling Python service (rca) at: ${pythonServiceUrl}/rca`);

            const response = await fetch(`${pythonServiceUrl}/rca`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetLog, logHistory })
            });
            if (!response.ok) throw new Error(`Python service error: ${response.statusText}`);
            const data = await response.json() as any;
            return res.json(data);
        } catch (error: any) {
            console.error("Failed to call Python service (rca):", error);
            return res.status(503).json({ message: "Python service unavailable", error: error.message });
        }
    }
    res.json(mockRca);
});

router.post('/generate-playbook', async (req: express.Request, res: express.Response) => {
    const { targetLog, provider } = req.body;
    if (provider === 'python') {
        try {
            const pythonServiceUrl = getPythonServiceUrl();
            console.log(`Calling Python service (playbook) at: ${pythonServiceUrl}/playbook`);

            const response = await fetch(`${pythonServiceUrl}/playbook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetLog })
            });
            if (!response.ok) throw new Error(`Python service error: ${response.statusText}`);
            const data = await response.json() as any;
            return res.json(data);
        } catch (error: any) {
            console.error("Failed to call Python service (playbook):", error);
            return res.status(503).json({ message: "Python service unavailable", error: error.message });
        }
    }
    res.json({ title: "Database Connection Failure", summary: "This playbook outlines steps to diagnose and resolve a database connection failure originating from the user-service.", severity: 4, triageSteps: [{ step: 1, action: "Check the status of the PostgreSQL container.", command: "docker ps | grep postgres-db" },{ step: 2, action: "Tail the logs of the user-service to look for specific connection error messages.", command: "docker logs -f ai-log-analyzer-backend" },{ step: 3, action: "Attempt to connect to the database directly from the backend container to rule out network issues.", command: "docker exec -it ai-log-analyzer-backend psql -h postgres-db -U admin -d ailoganalyzer" }], escalationPath: "If the database is down and cannot be restarted, escalate to the on-call SRE."});
});
router.post('/discover-insights', (req: express.Request, res: express.Response) => res.json([{id: 'd1', type: 'NEW_ERROR', title: 'New Error Type Detected', summary: "A `NullPointerException` has been observed for the first time in `user-service`.", implication: "This could indicate a new unhandled edge case in user profile retrieval, potentially impacting user sessions.", investigationFilters: { keyword: "NullPointerException", source: "user-service", level: "ERROR" }}]));

router.post('/execute-python', async (req: express.Request, res: express.Response) => {
    const { script, input } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    console.log(`Calling Python service (predict) at: ${pythonServiceUrl}/predict`);
    
    try {
        const body = input && input.logs ? { logs: input.logs } : { logs: input || [] };
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Python service error at ${pythonServiceUrl}/predict:`, errorBody);
            throw new Error(`Python service returned ${response.status}: ${response.statusText}. Details: ${errorBody}`);
        }

        const data = await response.json();
        res.json({ 
            output: "Python execution successful", 
            result: data,
            serviceUrl: pythonServiceUrl
        });
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        // If it's a timeout or connection error, provide a helpful hint
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.get('/check-python', async (req, res) => {
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        console.log(`[AI] Checking Python health at: ${pythonServiceUrl}/health`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${pythonServiceUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        
        const data = await response.json();
        res.json({ 
            status: "connected", 
            pythonUrl: pythonServiceUrl,
            health: data 
        });
    } catch (error: any) {
        console.error("[AI] Python health check failed:", {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        res.status(500).json({ 
            status: "error", 
            pythonUrl: pythonServiceUrl,
            error: error.message,
            code: error.code
        });
    }
});

router.post('/train', protect, async (req: express.Request, res: express.Response) => {
    const { logs, epochs, batch_size, dropout, model_type, model_name, dataset_name } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    console.log(`[TRAIN] Received request:`, { 
        logsCount: logs?.length || 0, 
        epochs, 
        batch_size, 
        dropout, 
        model_type,
        model_name,
        dataset_name
    });
    console.log(`Calling Python service (train) at: ${pythonServiceUrl}/train`);

    try {
        let logsToTrain = logs;

        // If custom dataset is selected and logs are empty, fetch from DB
        if (dataset_name === 'custom' && (!logsToTrain || logsToTrain.length === 0)) {
            console.log(`[TRAIN] Fetching logs from database for organization: ${(req as any).user.organizationId}`);
            const db = getDb();
            const dbLogs = await db.all<LogEntry>(
                'SELECT timestamp, level, message, source FROM logs WHERE "organizationId" = ? ORDER BY timestamp DESC LIMIT 10000',
                [(req as any).user.organizationId]
            );
            logsToTrain = dbLogs;
            console.log(`[TRAIN] Fetched ${logsToTrain.length} logs from database.`);
        }

        // Only validate logs if using custom dataset
        if (dataset_name === 'custom' && (!logsToTrain || logsToTrain.length === 0)) {
            return res.status(400).json({ error: "No logs available for training. Please ensure you have logs in the database or provide them in the request." });
        }

        const response = await fetch(`${pythonServiceUrl}/train`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                logs: logsToTrain, 
                epochs, 
                batch_size, 
                dropout, 
                model_type,
                model_name,
                dataset_name
            }),
            timeout: 300000 // 5 minutes
        });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorMessage = `Python service returned ${response.status}: ${response.statusText}`;
            try {
                const errorJson = JSON.parse(errorBody);
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (e) {
                if (errorBody) errorMessage += `. Details: ${errorBody}`;
            }
            console.error(`Python service error at ${pythonServiceUrl}/train:`, errorBody);
            return res.status(response.status).json({ error: errorMessage });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        // If it's a timeout or connection error, provide a helpful hint
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

// --- Pro AI Proxy Routes ---

router.post('/semantic-search', async (req: express.Request, res: express.Response) => {
    const { query, logs } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/semantic-search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, logs }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/cluster', async (req: express.Request, res: express.Response) => {
    const { logs } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/cluster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/urgency', async (req: express.Request, res: express.Response) => {
    const { log } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/urgency`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/forecast', async (req: express.Request, res: express.Response) => {
    const { history } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/forecast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/attribute', async (req: express.Request, res: express.Response) => {
    const { log } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/attribute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/tag', async (req: express.Request, res: express.Response) => {
    const { log } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/tag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/health-score', async (req: express.Request, res: express.Response) => {
    const { logs } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/health-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/dependency-map', async (req: express.Request, res: express.Response) => {
    const { logs } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90000);

        const response = await fetch(`${pythonServiceUrl}/dependency-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI] Python service returned error ${response.status} at ${req.path}:`, errorText);
            let data;
            try {
                data = JSON.parse(errorText);
            } catch (e) {}
            
            return res.status(response.status).json({
                message: data?.message || data?.error || "Python service error",
                error: errorText,
                code: `PYTHON_ERROR_${response.status}`,
                hint: "Check Python service logs on Render."
            });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        const pythonServiceUrl = getPythonServiceUrl();
        console.error(`[AI] Error in ${req.path}:`, {
            message: error.message,
            code: error.code,
            url: pythonServiceUrl
        });
        
        let hint = "Ensure python-service is running and accessible.";
        if (error.name === 'AbortError') hint = "Python service took too long to respond (Cold Start). Try again in 30 seconds.";
        if (error.code === 'ECONNREFUSED') hint = "Connection refused. The Python service might be down or starting up.";
        
        res.status(error.status || 503).json({ 
            message: "Python service unavailable", 
            error: error.message,
            code: error.code || `HTTP_${error.status || 503}`,
            hint: hint,
            url: pythonServiceUrl
        });
    }
});

router.post('/timeline', async (req: express.Request, res: express.Response) => {
    const { logs } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(`${pythonServiceUrl}/timeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ message: "Python service error", error: errorText });
        }
        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        res.status(503).json({ message: "Python service unavailable", error: error.message });
    }
});

// POST /api/ai/predict_hf
router.post('/predict_hf', async (req: express.Request, res: express.Response) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    const pythonServiceUrl = getPythonServiceUrl();
    try {
        const response = await fetch(`${pythonServiceUrl}/predict_hf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error("Prediction error:", error);
        res.status(503).json({ error: "Prediction service unavailable" });
    }
});

// POST /api/ai/train-dataset - Train on Kaggle CSV datasets
router.post('/train-dataset', protect, async (req: express.Request, res: express.Response) => {
    const { csv_data, target_column, feature_columns, model_type } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    
    try {
        console.log(`[TRAIN-DATASET] Training ${model_type} on ${feature_columns?.length} features`);
        
        const response = await fetch(`${pythonServiceUrl}/train-dataset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv_data, target_column, feature_columns, model_type })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error("[TRAIN-DATASET] Error:", error);
        res.status(503).json({ error: "Dataset training service unavailable" });
    }
});

// POST /api/ai/classify - Classify a log using trained model
router.post('/classify', protect, async (req: express.Request, res: express.Response) => {
    const { text, model_type } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    
    try {
        const response = await fetch(`${pythonServiceUrl}/classify-log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, model_type })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error("[CLASSIFY] Error:", error);
        res.status(503).json({ error: "Classification service unavailable" });
    }
});

// POST /api/ai/load-dataset - Load a research dataset (Loghub HDFS/BGL)
router.post('/load-dataset', protect, async (req: express.Request, res: express.Response) => {
    const { dataset_id, max_samples } = req.body;
    const pythonServiceUrl = getPythonServiceUrl();
    
    try {
        const response = await fetch(`${pythonServiceUrl}/datasets/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataset_id: dataset_id || 'hdfs', max_samples: max_samples || 2000 })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error("[LOAD-DATASET] Error:", error);
        res.status(503).json({ error: "Dataset loading service unavailable" });
    }
});

// GET /api/ai/available-datasets - List available research datasets
router.get('/available-datasets', protect, async (req: express.Request, res: express.Response) => {
    const pythonServiceUrl = getPythonServiceUrl();
    
    try {
        const response = await fetch(`${pythonServiceUrl}/datasets/available`);

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        res.json(data);
    } catch (error: any) {
        console.error("[AVAILABLE-DATASETS] Error:", error);
        res.status(503).json({ error: "Dataset service unavailable" });
    }
});

export default router;