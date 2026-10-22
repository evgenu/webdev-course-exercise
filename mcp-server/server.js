const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');

// Load lecture data on startup
const lectures = JSON.parse(fs.readFileSync(path.join(__dirname, 'lectures.json'), 'utf8'));

// Build a tool definition
function defineTool(name, description, inputSchema) {
    return {
        name: name,
        description: description,
        inputSchema: inputSchema,
    };
}

// Define available tools for this server
const tools = [
    defineTool('find_lecture', 'Return the title and topics of one course lecture by its number (1 to 12). Use it when asked what a lecture covers.', { type: 'object', properties: { number: { type: 'integer', description: 'Lecture number, 1 to 12' } }, required: ['number'] }),
    defineTool('list_lectures', 'List the number and title of every course lecture. Use it when asked what the course covers.', { type: 'object', properties: {} }),
];

// Format a tool response with success status
function textResult(id, text, isError) {
    return {
        jsonrpc: '2.0',
        id: id,
        result: {
            content: [{ type: 'text', text: text }],
            isError: isError,
        },
    };
}

// Send formatted JSON to output channel
function send(reply) {
    process.stdout.write(JSON.stringify(reply) + '\n');
}

// Route and handle messages based on method type
function handle(msg) {
    // Handle initialize request - required handshake response
    if (msg.method === 'initialize') {
        return {
            jsonrpc: '2.0',
            id: msg.id,
            result: {
                protocolVersion: msg.params.protocolVersion,
                capabilities: { tools: {} },
                serverInfo: { name: 'lectures', version: '0.1.0' },
            },
        };
    }

    // Notifications have no ID and get no reply
    if (msg.method === 'notifications/initialized') {
        return null;
    }

    // Handle tools list request
    if (msg.method === 'tools/list') {
        return { jsonrpc: '2.0', id: msg.id, result: { tools: tools } };
    }

    // Handle tool execution calls
    if (msg.method === 'tools/call') {
        const name = msg.params.name;
        const args = msg.params.arguments || {};

        // Execute find_lecture - validate lecture number against known lectures
        if (name === 'find_lecture') {
            const lecture = lectures.find((l) => l.number === args.number);
            if (!lecture) {
                return textResult(msg.id, `There is no lecture ${args.number}. The course has lectures 1 to 12.`, true);
            }
            return textResult(msg.id, `Lecture ${lectures.find((l) => l.number === args.number).number}: ${lectures.find((l) => l.number === args.number).title}. Topics: ${lectures.find((l) => l.number === args.number).topics}`, false);
        }

        // Execute list_lectures - format output as numbered list
        if (name === 'list_lectures') {
            return textResult(msg.id, lectures.map((l) => `${l.number}. ${l.title}`).join('\n'), false);
        }

        // Unknown tool method - protocol error with error code -32602
        return { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `Unknown tool: ${name}` } };
    }

    // Request not recognized - protocol error with error code -32601
    if (msg.id !== undefined) {
        return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Unknown method: ${msg.method}` } };
    }

    // Return null for notifications or unhandled cases
    return null;
}

// Start listening for input lines from stdin
const lines = readline.createInterface({ input: process.stdin });

lines.on('line', (line) => {
    const reply = handle(JSON.parse(line));
    // Send response if we generated one
    if (reply) {
        send(reply);
    }
});
