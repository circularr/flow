// Configuration for the AI Flow Editor
const CONFIG = {
    // OpenAI API configuration
    openai: {
        defaultModel: 'gpt-4.1-nano-2025-04-14',
        models: [
            { id: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano', price: 0.10 },
            { id: 'gpt-4.1-2025-04-14', name: 'GPT-4.1', price: 2.00 },
            { id: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini', price: 0.50 },
            { id: 'o1-2024-12-17', name: 'O1', price: 15.00 },
            { id: 'o1-mini', name: 'O1 Mini', price: 5.00 },
            { id: 'o1-pro-2025-03-19', name: 'O1 Pro', price: 150.00 },
            { id: 'o3-2025-04-16', name: 'O3', price: 10.00 },
            { id: 'o3-mini-2025-01-31', name: 'O3 Mini', price: 1.10 },
            { id: 'o4-mini-2025-04-16', name: 'O4 Mini', price: 1.10 },
        ],
        endpoint: 'https://api.openai.com/v1/chat/completions'
    },
    
    // Node configuration
    nodes: {
        minWidth: 280,
        minHeight: 200,
        spacing: 120, // Default spacing between nodes
        defaultPosition: { x: 100, y: 100 }
    },
    
    // JSPlumb connection configuration
    connections: {
        connector: ['Bezier', { curviness: 50 }],
        paintStyle: { stroke: '#6366f1', strokeWidth: 2 },
        hoverPaintStyle: { stroke: '#4f46e5', strokeWidth: 3 },
        endpoint: 'Dot',
        endpointStyle: { 
            fill: '#6366f1', 
            radius: 5 
        },
        anchors: ['Bottom', 'Top']
    },
    
    // Variation settings
    variations: {
        maxCount: 5,
        defaultCount: 3,
        defaultPrompt: 'Generate a different version of the above text.',
    }
};
