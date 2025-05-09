document.addEventListener('DOMContentLoaded', function() {
    // Initialize global variables
    let jsPlumbInstance;
    let nodeCounter = 0;
    let nodeMap = new Map(); // Stores node data: id -> {prompt, response, position}
    
    // DOM elements
    const canvas = document.getElementById('canvas');
    const addNodeBtn = document.getElementById('add-node-btn');
    const clearCanvasBtn = document.getElementById('clear-canvas-btn');
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    
    // UI state variables
    let isMergeMode = false;
    let mergeSourceNodeId = null; // To track which node initiated the merge
    
    // Modal elements
    const nodeModal = document.getElementById('node-modal');
    const nodePromptInput = document.getElementById('node-prompt');
    const nodeCountSlider = document.getElementById('node-count-slider');
    const nodeCountDisplay = document.getElementById('node-count-display');
    const nodeInstructionsInput = document.getElementById('node-instructions');
    const createNodeBtn = document.getElementById('create-node-btn');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    
    const variationModal = document.getElementById('variation-modal');
    const variationCountInput = document.getElementById('variation-count');
    const variationPromptInput = document.getElementById('variation-prompt');
    const createVariationsBtn = document.getElementById('create-variations-btn');
    
    const mergeModal = document.getElementById('merge-modal');
    const mergeCustomInput = document.getElementById('merge-custom');
    const createMergeBtn = document.getElementById('create-merge-btn');
    
    let selectedNodeForVariation = null;
    let selectedNodesForMerge = new Set();
    
    // Initialize JSPlumb
    function initJSPlumb() {
        jsPlumbInstance = jsPlumb.getInstance({
            DragOptions: { cursor: 'move', zIndex: 2000 },
            PaintStyle: CONFIG.connections.paintStyle,
            HoverPaintStyle: CONFIG.connections.hoverPaintStyle,
            Connector: CONFIG.connections.connector,
            Endpoint: CONFIG.connections.endpoint,
            EndpointStyle: CONFIG.connections.endpointStyle,
            Anchors: CONFIG.connections.anchors,
        });
        
        // Make nodes draggable
        jsPlumbInstance.draggable(document.querySelectorAll('.node'), {
            drag: function(event) {
                const nodeId = event.el.id;
                const nodeData = nodeMap.get(nodeId);
                if (nodeData) {
                    nodeData.position = {
                        x: parseInt(event.el.style.left),
                        y: parseInt(event.el.style.top)
                    };
                }
            }
        });
    }
    
    // Calculate optimal grid layout for nodes
    function calculateGridLayout() {
        const canvasWidth = canvas.clientWidth || 1000; // Fallback if not available
        const nodeWidth = 300; // Approximate width with margins
        return Math.max(2, Math.floor(canvasWidth / nodeWidth)); // At least 2 columns
    }
    
    // Helper function to check if a position overlaps with existing nodes
    function checkForOverlap(position, existingNodes, nodeWidth, nodeHeight) {
        for (const node of existingNodes) {
            const dx = Math.abs(position.x - node.position.x);
            const dy = Math.abs(position.y - node.position.y);
            
            // Increased overlap detection area - safer distance
            if (dx < (nodeWidth * 1.2) && dy < (nodeHeight * 1.2)) {
                return true;
            }
        }
        return false;
    }
    
    // Helper function to find optimal node position in a large workflow
    function findOptimalPosition(existingNodes = [], preferGrid = false) {
        // Calculate size of the canvas
        const canvasWidth = canvas.clientWidth || 1000; // Fallback if not available
        const canvasHeight = canvas.clientHeight || 800;
        
        // Node dimensions with extra margin
        const nodeWidth = 350; // Increased width for better spacing
        const nodeHeight = 280; // Increased height for better spacing
        
        // If no existing nodes, place near top-left with some margin
        if (existingNodes.length === 0) {
            return {
                x: Math.max(50, canvasWidth * 0.1),
                y: Math.max(50, canvasHeight * 0.1)
            };
        }
        
        // Find the boundaries of the current layout
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        existingNodes.forEach(node => {
            const x = node.position.x;
            const y = node.position.y;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
        
        // Ensure we have valid boundaries if all nodes are at same position
        if (minX === maxX) {
            minX = Math.max(30, minX - 100);
            maxX = minX + 300;
        }
        if (minY === maxY) {
            minY = Math.max(30, minY - 100);
            maxY = minY + 200;
        }
        
        // For grid layout (used when creating multiple nodes at once)
        if (preferGrid) {
            // Calculate number of columns based on canvas width
            const numCols = Math.max(1, Math.floor((canvasWidth - 100) / nodeWidth)); // Ensure at least 1 column
            const numNodes = nodeMap.size;
            
            // Increase spacing for better separation
            const spacingX = Math.min(nodeWidth * 1.5, (canvasWidth * 0.9) / numCols);
            const spacingY = nodeHeight * 1.6; // Even more vertical spacing
            
            // Calculate position in a grid pattern with offset for each new node
            const newIndex = numNodes; // For a new node
            const row = Math.floor(newIndex / numCols);
            const col = newIndex % numCols;
            
            // Add slight offset to prevent perfect alignment (makes it easier to select nodes)
            const offsetX = Math.random() * 10 - 5; // -5 to +5 pixels
            const offsetY = Math.random() * 10 - 5;
            
            const position = {
                x: 50 + col * spacingX + offsetX,
                y: 50 + row * spacingY + offsetY
            };
            
            // Check if position overlaps with any existing node
            let attempts = 0;
            let overlapping = true;
            
            while (overlapping && attempts < 20) { // Increased attempts
                overlapping = checkForOverlap(position, existingNodes, nodeWidth, nodeHeight);
                if (overlapping) {
                    if (attempts < 10) {
                        // Try shifting horizontally first
                        position.x += (attempts % 2 === 0) ? nodeWidth/2 : -nodeWidth/2;
                    } else {
                        // Then try shifting vertically
                        position.y += spacingY;
                    }
                    attempts++;
                }
            }
            
            // Always ensure position is on-screen
            position.x = Math.max(50, Math.min(canvasWidth - 150, position.x));
            position.y = Math.max(50, position.y);
            
            return position;
        }
        
        // For standard layout with improved spacing
        const gridSize = Math.max(
            Math.min(300, 400 - nodeMap.size * 10), // Decrease spacing as nodes increase
            CONFIG.nodes.spacing
        );
        
        const gridWidth = Math.max(4, Math.ceil((maxX - minX) / gridSize) + 3);
        const gridHeight = Math.max(4, Math.ceil((maxY - minY) / gridSize) + 3);
        
        // Initialize a 2D grid to track occupied positions - default to false (unoccupied)
        const grid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(false));
        
        // Mark occupied positions
        existingNodes.forEach(node => {
            const nodeX = node.position.x;
            const nodeY = node.position.y;
            
            // Mark the node's position and a surrounding area
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    const posX = minX + x * gridSize;
                    const posY = minY + y * gridSize;
                    
                    // Mark as occupied if within node boundaries (with margin)
                    if (Math.abs(posX - nodeX) < nodeWidth/2 && Math.abs(posY - nodeY) < nodeHeight/2) {
                        grid[y][x] = true;
                    }
                }
            }
        });
        
        // Find the first unoccupied position using a spiral pattern
        const directions = [
            [0, 1],  // right
            [1, 0],  // down
            [0, -1], // left
            [-1, 0]  // up
        ];
        
        let x = Math.floor(gridWidth / 2);
        let y = Math.floor(gridHeight / 2);
        let dirIdx = 0;
        let steps = 1;
        let stepCount = 0;
        let totalSteps = 0;
        
        // Limit iterations to avoid infinite loop
        const maxSteps = gridWidth * gridHeight;
        
        while (totalSteps < maxSteps) {
            if (!grid[y]?.[x]) {
                return {
                    x: minX + x * gridSize + gridSize / 2,
                    y: minY + y * gridSize + gridSize / 2
                };
            }
            
            x += directions[dirIdx][0];
            y += directions[dirIdx][1];
            
            stepCount++;
            totalSteps++;
            
            if (stepCount === steps) {
                stepCount = 0;
                dirIdx = (dirIdx + 1) % 4;
                if (dirIdx % 2 === 0) {
                    steps++; // Increase steps after completing a full spiral arm
                }
            }
        }
        
        // If all positions are taken, create a new row at the bottom
        return {
            x: minX + (Math.random() * 0.8 + 0.1) * (maxX - minX), // Random position between 10-90% of width
            y: maxY + gridSize * 1.5
        };
    }
    
    // Create multiple nodes with auto-arrangement in grid layout and auto-run
    function createMultipleNodes(basePrompt, customInstructions = '', count = 1) {
        // Store existing nodes before creating new ones
        const existingNodes = [];
        nodeMap.forEach((data, id) => {
            existingNodes.push({
                id: id,
                position: data.position
            });
        });
        
        const nodesToCreate = [];
        for (let i = 0; i < count; i++) {
            // Generate slightly varied prompts for each node
            let nodePrompt = basePrompt;
            
            // Add node number if creating multiple
            if (count > 1) {
                nodePrompt = `${basePrompt}\n\n(Variation ${i + 1} of ${count})`;
            }
            
            // Add custom instructions if provided
            if (customInstructions) {
                nodePrompt = `${nodePrompt}\n\n---Your Instructions---\n${customInstructions}`;
            }
            
            nodesToCreate.push(nodePrompt);
        }
        
        // Get the current canvas scroll position
        const initialScrollTop = canvas.scrollTop;
        const initialScrollLeft = canvas.scrollLeft;
        
        // Create nodes in a grid pattern
        const createdNodeIds = [];
        for (let i = 0; i < nodesToCreate.length; i++) {
            // Use grid position finding for consistent layout
            const position = findOptimalPosition(existingNodes, true);
            const nodeId = createNode(nodesToCreate[i], position);
            createdNodeIds.push(nodeId);
            
            // Add the newly created node to existing nodes for next placement
            existingNodes.push({
                id: nodeId,
                position: position
            });
        }
        
        // After creating nodes, auto-scroll to show new nodes if needed
        if (createdNodeIds.length > 0) {
            setTimeout(() => {
                const lastNode = document.getElementById(createdNodeIds[createdNodeIds.length - 1]);
                if (lastNode) {
                    // Get position of the last created node
                    const rect = lastNode.getBoundingClientRect();
                    const canvasRect = canvas.getBoundingClientRect();
                    
                    // Check if node is out of view, and if so, scroll to it
                    if (rect.bottom > canvasRect.bottom || rect.top < canvasRect.top) {
                        lastNode.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }
            }, 100);
        }
        
        // Optionally connect nodes in a sequence
        for (let i = 0; i < createdNodeIds.length - 1; i++) {
            jsPlumbInstance.connect({
                source: createdNodeIds[i],
                target: createdNodeIds[i + 1]
            });
        }
        
        // Auto-run all created nodes
        for (const nodeId of createdNodeIds) {
            setTimeout(() => {
                runNode(nodeId);
            }, 100);
        }
        
        return createdNodeIds;
    }
    
    // Create a new node
    function createNode(prompt = '', position = null) {
        nodeCounter++;
        const nodeId = `node-${nodeCounter}`;
        
        // Set default position if not provided
        if (!position) {
            // Get all existing nodes
            const existingNodes = [];
            nodeMap.forEach((data, id) => {
                existingNodes.push({
                    id: id,
                    position: data.position
                });
            });
            
            position = findOptimalPosition(existingNodes);
        }
        
        // Create node element
        const nodeElement = document.createElement('div');
        nodeElement.id = nodeId;
        nodeElement.className = 'node';
        nodeElement.style.left = `${position.x}px`;
        nodeElement.style.top = `${position.y}px`;
        
        // Extract custom instructions if present
        let customInstructions = '';
        let displayContent = '';
        let isFirstNode = nodeCounter === 1;
        
        if (prompt) {
            // Check if prompt contains custom instructions section
            const instructionsMatch = prompt.match(/---Your Instructions---\s*([\s\S]*?)\s*(?:---|-{3}|$)/i);
            if (instructionsMatch && instructionsMatch[1]) {
                customInstructions = instructionsMatch[1].trim();
            }
            
            // For the first node only, show prompt if no custom instructions
            // For all other nodes, only show custom instructions
            if (isFirstNode && !customInstructions) {
                displayContent = prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '');
            } else if (customInstructions) {
                displayContent = customInstructions;
            } else {
                // For non-first nodes with no custom instructions, show a placeholder
                displayContent = "No custom instructions";
            }
        }
        
        // Create node content with minimize/maximize toggle
        nodeElement.innerHTML = `
            <div class="node-header">
                <h3>Node ${nodeCounter}</h3>
                <span class="node-view-toggle" title="Minimize/Maximize">□</span>
                <div class="node-actions">
                    <button class="node-action-btn run-node-btn" title="Run this node">▶</button>
                    <button class="node-action-btn delete-node-btn" title="Delete node">✕</button>
                </div>
            </div>
            <div class="node-body">
                ${displayContent ? `<div class="node-instructions">${displayContent}</div>` : ''}
                <div class="node-response loading">Response will appear here...</div>
            </div>
            <div class="node-connector" title="Add variations"></div>
        `;
        
        canvas.appendChild(nodeElement);
        
        // Store node data
        nodeMap.set(nodeId, {
            prompt: prompt,
            response: '',
            position: position,
            variations: []
        });
        
        // Make node draggable
        jsPlumbInstance.draggable(nodeElement, {
            drag: function() {
                const nodeData = nodeMap.get(nodeId);
                if (nodeData) {
                    nodeData.position = {
                        x: parseInt(nodeElement.style.left),
                        y: parseInt(nodeElement.style.top)
                    };
                }
            }
        });
        
        // Add event listeners to node
        const runNodeBtn = nodeElement.querySelector('.run-node-btn');
        runNodeBtn.addEventListener('click', () => runNode(nodeId));
        
        const deleteNodeBtn = nodeElement.querySelector('.delete-node-btn');
        deleteNodeBtn.addEventListener('click', () => deleteNode(nodeId));
        
        // Add connector with context menu for actions
        const nodeConnector = nodeElement.querySelector('.node-connector');
        
        // Create connector menu
        nodeConnector.addEventListener('click', (e) => {
            e.stopPropagation();
            showConnectorMenu(e, nodeId);
        });
        
        // Show connector context menu for a node
    function showConnectorMenu(event, nodeId) {
        // Remove any existing connector menus
        removeConnectorMenu();
        
        // Create menu element
        const menu = document.createElement('div');
        menu.id = 'connector-menu';
        menu.className = 'connector-menu';
        
        // Position the menu near the connector
        const rect = event.target.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        menu.style.left = `${rect.left - canvasRect.left + rect.width/2}px`;
        menu.style.top = `${rect.bottom - canvasRect.top + 5}px`;
        
        // Add menu options
        menu.innerHTML = `
            <div class="menu-option" id="option-variations">Create Variations</div>
            <div class="menu-option" id="option-merge">Merge With Other Nodes</div>
        `;
        
        // Add to canvas
        canvas.appendChild(menu);
        
        // Add event listeners
        document.getElementById('option-variations').addEventListener('click', () => {
            removeConnectorMenu();
            openVariationModal(nodeId);
        });
        
        document.getElementById('option-merge').addEventListener('click', () => {
            removeConnectorMenu();
            // Start merge mode with this node as the source
            startMergeFromNode(nodeId);
        });
        
        // Close menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', removeConnectorMenu, { once: true });
        }, 100);
    }
    
    // Remove connector menu
    function removeConnectorMenu() {
        const menu = document.getElementById('connector-menu');
        if (menu) {
            menu.remove();
        }
    }
    
    // Start merge mode from a specific node
    function startMergeFromNode(sourceNodeId) {
        // Store the source node
        mergeSourceNodeId = sourceNodeId;
        
        // Add source node to selected nodes
        selectedNodesForMerge.clear();
        selectedNodesForMerge.add(sourceNodeId);
        
        // Enter merge mode
        isMergeMode = true;
        canvas.classList.add('merge-mode');
        
        // Show visual indication for the source node
        const sourceNode = document.getElementById(sourceNodeId);
        if (sourceNode) {
            sourceNode.classList.add('selected', 'merge-source');
        }
        
        // Show instruction overlay
        const instructionOverlay = document.createElement('div');
        instructionOverlay.id = 'merge-instruction-overlay';
        instructionOverlay.innerHTML = `
            <div class="merge-instructions">
                <h3>Merge Mode</h3>
                <p>Select nodes to combine with the highlighted source node.</p>
                <button id="complete-merge-selection-btn" class="primary-btn">Complete Merge (1 selected)</button>
                <button id="cancel-merge-btn" class="text-btn">Cancel</button>
            </div>
        `;
        canvas.appendChild(instructionOverlay);
        
        // Add event listeners
        const completeBtn = document.getElementById('complete-merge-selection-btn');
        completeBtn.addEventListener('click', openMergeInstructionsModal);
        
        const cancelBtn = document.getElementById('cancel-merge-btn');
        cancelBtn.addEventListener('click', exitMergeMode);
        
        // Make other nodes selectable
        nodeMap.forEach((nodeData, nodeId) => {
            if (nodeId !== sourceNodeId) { // Don't make the source node selectable again
                const nodeElement = document.getElementById(nodeId);
                if (nodeElement) {
                    nodeElement.classList.add('selectable');
                    nodeElement.addEventListener('click', handleNodeSelectForMerge);
                }
            }
        });
    }
    
    // Add minimize/maximize toggle functionality
        const viewToggle = nodeElement.querySelector('.node-view-toggle');
        viewToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent drag from triggering
            
            if (nodeElement.classList.contains('minimized')) {
                // Expand node
                nodeElement.classList.remove('minimized');
                viewToggle.textContent = '□'; // Square for maximize
                viewToggle.title = 'Maximize';
            } else if (nodeElement.classList.contains('maximized')) {
                // Return to normal size
                nodeElement.classList.remove('maximized');
                viewToggle.textContent = '□'; // Square for maximize
                viewToggle.title = 'Maximize';
            } else {
                // Maximize node
                nodeElement.classList.add('maximized');
                viewToggle.textContent = '◱'; // Different square symbol for restore
                viewToggle.title = 'Restore';
            }
        });
        
        // Double click header to minimize
        const nodeHeader = nodeElement.querySelector('.node-header');
        nodeHeader.addEventListener('dblclick', (e) => {
            e.stopPropagation(); // Prevent other actions
            
            if (nodeElement.classList.contains('minimized')) {
                nodeElement.classList.remove('minimized');
                viewToggle.textContent = '□';
            } else {
                nodeElement.classList.add('minimized');
                nodeElement.classList.remove('maximized');
                viewToggle.textContent = '◳'; // Different symbol for minimized
                viewToggle.title = 'Restore';
            }
        });
        
        // Add endpoints for the node
        jsPlumbInstance.addEndpoint(nodeId, {
            anchor: 'Bottom',
            isSource: true,
            maxConnections: -1 // Multiple connections allowed
        });
        
        jsPlumbInstance.addEndpoint(nodeId, {
            anchor: 'Top',
            isTarget: true
        });
        
        return nodeId;
    }
    
    // Run a node (generate AI response)
    async function runNode(nodeId) {
        const nodeData = nodeMap.get(nodeId);
        if (!nodeData || !nodeData.prompt) {
            alert('Please set a prompt for this node first.');
            return;
        }
        
        // Check if this is a variation node with hidden source content
        const hasSourceContent = nodeData.sourceContent && nodeData.prompt.includes('---Hidden Original Content---');
        
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter your OpenAI API key in the settings.');
            return;
        }
        
        const model = modelSelect.value;
        
        // Get the node element and response div
        const nodeElement = document.getElementById(nodeId);
        const responseDiv = nodeElement.querySelector('.node-response');
        
        // Show loading state
        responseDiv.classList.add('loading');
        responseDiv.textContent = 'Generating response...';
        
        try {
            // Prepare the OpenAI request
            let promptToSend;
            let systemMessage = 'You are a helpful assistant.';
            
            // For variation nodes, reconstruct the prompt with the actual source content
            if (hasSourceContent) {
                // Extract the custom instructions from the prompt
                const instructionsMatch = nodeData.prompt.match(/---Your Instructions---\s*([\s\S]*?)\s*(?:---|-{3}|$)/i);
                const instructions = instructionsMatch && instructionsMatch[1] ? 
                                      instructionsMatch[1].trim() : 
                                      CONFIG.variations.defaultPrompt;
                
                // Create a new prompt that includes the source content but keeps it hidden in the UI
                promptToSend = `Original content: "${nodeData.sourceContent}"

${instructions}`;
                
                // Set a specific system message for variations
                systemMessage = 'You are a creative assistant. Create a meaningful variation of the original content following the instructions provided.';
            } else {
                // For normal nodes, use prompt as is
                promptToSend = nodeData.prompt;
            }
            
            // Make the API call
            const response = await fetch(CONFIG.openai.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemMessage },
                        { role: 'user', content: promptToSend }
                    ],
                    temperature: 0.7,
                    max_tokens: 500
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            const aiResponse = data.choices[0].message.content.trim();
            
            // Update node data and UI
            nodeData.response = aiResponse;
            responseDiv.textContent = aiResponse;
            responseDiv.classList.remove('loading');
            
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            responseDiv.textContent = `Error: ${error.message}`;
            responseDiv.classList.remove('loading');
        }
    }
    
    // Delete a node
    function deleteNode(nodeId) {
        const nodeElement = document.getElementById(nodeId);
        if (nodeElement) {
            // Remove all connections
            jsPlumbInstance.remove(nodeElement);
            // Remove the node from DOM
            nodeElement.remove();
            // Remove from our data map
            nodeMap.delete(nodeId);
        }
    }
    
    // Create variations for a node
    async function createVariations(sourceNodeId, count, customPrompt) {
        const sourceNodeData = nodeMap.get(sourceNodeId);
        if (!sourceNodeData || !sourceNodeData.response) {
            alert('Please run the source node first to generate content for variations.');
            return;
        }
        
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter your OpenAI API key in the settings.');
            return;
        }
        
        const model = modelSelect.value;
        const sourceNode = document.getElementById(sourceNodeId);
        const sourcePosition = {
            x: parseInt(sourceNode.style.left),
            y: parseInt(sourceNode.style.top)
        };
        
        // Get all existing nodes for better positioning
        const existingNodes = [];
        nodeMap.forEach((data, id) => {
            existingNodes.push({
                id: id,
                position: data.position
            });
        });
        
        // Calculate position boundaries for variations
        const variationPromises = [];
        const createdVariationIds = [];
        
        // Node dimensions with extra margin for UI elements
        const nodeWidth = 350; // Width plus margin
        const nodeHeight = 250; // Height plus margin
        
        // Determine how many columns to use based on count
        let columns = Math.min(3, count); // Max 3 columns
        if (count <= 2) columns = count; // 1 or 2 variations = 1 or 2 columns
        
        // Calculate where to start placing variations
        const startY = sourcePosition.y + nodeHeight * 1.5; // Start below source node with good spacing
        
        // Calculate if we need to shift left to center variations
        const totalWidth = columns * nodeWidth;
        const startX = sourcePosition.x - (totalWidth / 2) + (nodeWidth / 2);
        
        // Create variation nodes in a structured grid
        for (let i = 0; i < count; i++) {
            // Calculate row and column for this variation
            const col = i % columns;
            const row = Math.floor(i / columns);
            
            // Calculate exact position with spacing
            const position = {
                x: startX + (col * nodeWidth) + (Math.random() * 20 - 10), // Add slight randomness for natural look
                y: startY + (row * nodeHeight) + (Math.random() * 10 - 5)
            };
            
            // Make sure position is visible on screen
            position.x = Math.max(50, position.x); // Keep away from left edge
            
            // Add variation number to make each one distinct
            const variationNumber = i + 1;
            const variationPrompt = customPrompt || CONFIG.variations.defaultPrompt;
            
            // Create an instruction with custom instructions highlighted
            const fullPrompt = `---Hidden Original Content---\n[Content not shown to avoid repetition]\n\n---Your Instructions---\n${variationPrompt} (Variation ${variationNumber} of ${count})\n\n---Task---\nCreate a variation of the original content.`;
            
            // Create variation node
            const variationNodeId = createNode(fullPrompt, position);
            createdVariationIds.push(variationNodeId);
            
            // Store reference to source content in node data without displaying it
            const variationNodeData = nodeMap.get(variationNodeId);
            if (variationNodeData) {
                variationNodeData.sourceContent = sourceNodeData.response;
                variationNodeData.isVariation = true;
                variationNodeData.variationNumber = variationNumber;
                variationNodeData.totalVariations = count;
            }
            
            // Create connection from source to variation
            jsPlumbInstance.connect({
                source: sourceNodeId,
                target: variationNodeId,
                paintStyle: { stroke: '#6366f1', strokeWidth: 2, dashstyle: '2 2' }, // Dashed line for variations
                overlays: [ 
                    ["Label", { label: `V${variationNumber}`, location: 0.5, cssClass: "connection-label" }]
                ]
            });
            
            // Add the newly created node to existing nodes for next placement
            existingNodes.push({
                id: variationNodeId,
                position: position
            });
        }
        
        // Add visual indicator to source node to show it has variations
        const sourceElement = document.getElementById(sourceNodeId);
        if (sourceElement && !sourceElement.classList.contains('has-variations')) {
            sourceElement.classList.add('has-variations');
        }
        
        // Run all variation nodes in parallel
        for (const variationId of createdVariationIds) {
            variationPromises.push(runNode(variationId));
        }
        
        // Wait for all variations to complete
        await Promise.all(variationPromises);
        
        return createdVariationIds;
    }
    
    // Open node creation modal
    function openNodeModal(e) {
        if (e) e.preventDefault();
        nodePromptInput.value = '';
        nodeInstructionsInput.value = '';
        nodeCountSlider.value = 1;
        nodeCountDisplay.textContent = '1';
        nodeModal.style.display = 'block';
        
        // Ensure input gets focus
        setTimeout(() => {
            nodePromptInput.focus();
        }, 100);
    }
    
    // Open variation modal
    function openVariationModal(nodeId) {
        selectedNodeForVariation = nodeId;
        variationCountInput.value = CONFIG.variations.defaultCount;
        variationPromptInput.value = '';
        
        // Get the node data and set title to show which node we're creating variations for
        const nodeData = nodeMap.get(nodeId);
        const nodeElement = document.getElementById(nodeId);
        
        if (nodeElement && nodeData) {
            const nodeTitle = nodeElement.querySelector('.node-header h3').textContent;
            const variationModalTitle = variationModal.querySelector('h2');
            if (variationModalTitle) {
                variationModalTitle.textContent = `Create Variations for ${nodeTitle}`;
            }
        }
        
        variationModal.style.display = 'block';
    }
    
    // Close all modals
    function closeModals() {
        nodeModal.style.display = 'none';
        variationModal.style.display = 'none';
        mergeModal.style.display = 'none';
    }
    
    // Run all nodes in the flow
    async function runFlow() {
        // Find root nodes (nodes that have no incoming connections)
        const allNodes = Array.from(nodeMap.keys());
        const rootNodes = allNodes.filter(nodeId => {
            const endpoints = jsPlumbInstance.getEndpoints(nodeId);
            const targetEndpoint = endpoints.find(ep => ep.isTarget);
            return !targetEndpoint || jsPlumbInstance.getConnections({ target: nodeId }).length === 0;
        });
        
        if (rootNodes.length === 0) {
            alert('No root nodes found in the flow.');
            return;
        }
        
        // Start processing from root nodes
        for (const rootNodeId of rootNodes) {
            await processNodeAndChildren(rootNodeId, new Set());
        }
    }
    
    // Process a node and its children recursively
    async function processNodeAndChildren(nodeId, visited) {
        if (visited.has(nodeId)) return; // Avoid cycles
        visited.add(nodeId);
        
        // Run the current node
        await runNode(nodeId);
        
        // Find all outgoing connections
        const connections = jsPlumbInstance.getConnections({ source: nodeId });
        
        // Process children
        for (const connection of connections) {
            const childId = connection.target.id;
            await processNodeAndChildren(childId, visited);
        }
    }
    
    // Clear the canvas
    function clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas? This will delete all nodes and connections.')) {
            // Remove all nodes
            nodeMap.forEach((_, nodeId) => {
                const nodeElement = document.getElementById(nodeId);
                if (nodeElement) {
                    jsPlumbInstance.remove(nodeElement);
                    nodeElement.remove();
                }
            });
            
            // Clear data
            nodeMap.clear();
            nodeCounter = 0;
            
            // Reinitialize JSPlumb
            jsPlumbInstance.reset();
            initJSPlumb();
        }
    }
    
    // Exit merge mode and clean up
    function exitMergeMode() {
        isMergeMode = false;
        mergeSourceNodeId = null;
        canvas.classList.remove('merge-mode');
        
        // Remove instruction overlay
        const instructionOverlay = document.getElementById('merge-instruction-overlay');
        if (instructionOverlay) {
            instructionOverlay.remove();
        }
        
        // Remove selection styling and event handlers
        nodeMap.forEach((nodeData, nodeId) => {
            const nodeElement = document.getElementById(nodeId);
            if (nodeElement) {
                nodeElement.classList.remove('selectable', 'selected', 'merge-source');
                nodeElement.removeEventListener('click', handleNodeSelectForMerge);
            }
        });
        
        // Clear selections
        selectedNodesForMerge.clear();
    }
    
    // Handle node selection in merge mode
    function handleNodeSelectForMerge(event) {
        if (!isMergeMode) return;
        
        // Prevent default behaviors like dragging
        event.stopPropagation();
        event.preventDefault();
        
        const nodeElement = event.currentTarget;
        const nodeId = nodeElement.id;
        
        // Toggle selection
        if (selectedNodesForMerge.has(nodeId)) {
            selectedNodesForMerge.delete(nodeId);
            nodeElement.classList.remove('selected');
        } else {
            selectedNodesForMerge.add(nodeId);
            nodeElement.classList.add('selected');
        }
        
        // Update button text with selection count
        const completeBtn = document.getElementById('complete-merge-selection-btn');
        if (completeBtn) {
            completeBtn.textContent = `Complete Merge (${selectedNodesForMerge.size} selected)`;
            completeBtn.disabled = selectedNodesForMerge.size < 2;
        }
    }
    

    
    // Open merge instructions modal after selecting nodes
    function openMergeInstructionsModal() {
        // Store the current selection count before exiting merge mode
        const selectionCount = selectedNodesForMerge.size;
        
        // Check if we have enough nodes selected
        if (selectionCount < 2) {
            alert('Please select at least 2 nodes to combine.');
            return;
        }
        
        // Make a copy of selected nodes since exitMergeMode will clear it
        const selectedNodesCopy = new Set(selectedNodesForMerge);
        
        // Exit merge selection mode
        exitMergeMode();
        
        // Restore the selection
        selectedNodesForMerge = selectedNodesCopy;
        
        // Update selected count
        const selectedCountElement = document.getElementById('selected-nodes-count');
        if (selectedCountElement) {
            selectedCountElement.textContent = selectionCount;
        }
        
        console.log('Opening merge modal with', selectionCount, 'nodes selected');
        
        // Clear input and open modal
        mergeCustomInput.value = '';
        mergeModal.style.display = 'block';
    }
    
    // Merge nodes with selected nodes and custom instructions
    function mergeNodes() {
        console.log('Merging nodes, selection count:', selectedNodesForMerge.size);
        
        if (selectedNodesForMerge.size < 2) {
            alert('Please select at least 2 nodes to combine.');
            return;
        }
        
        // Get custom content
        const customContent = mergeCustomInput.value.trim();
        
        // Create merged content
        let mergedPrompt = '';
        const nodesToMerge = [];
        
        // Only add content from selected nodes
        selectedNodesForMerge.forEach(nodeId => {
            const nodeData = nodeMap.get(nodeId);
            if (nodeData) {
                const nodeElement = document.getElementById(nodeId);
                const headerText = nodeElement.querySelector('.node-header h3').textContent;
                
                // Add content from this node
                mergedPrompt += `---${headerText}---\n`;
                // Always include response if available
                if (nodeData.response) {
                    mergedPrompt += nodeData.response + '\n\n';
                }
                // Include prompt only if no response (to avoid repetition)
                else if (nodeData.prompt) {
                    mergedPrompt += nodeData.prompt + '\n\n';
                }
                
                nodesToMerge.push({
                    id: nodeId,
                    data: nodeData,
                    element: nodeElement
                });
            }
        });
        
        // Add custom content if provided and make it the primary instruction
        if (customContent) {
            mergedPrompt += `---Your Instructions---\n${customContent}`;
        }
        else {
            // Default instruction if none provided
            mergedPrompt += '---Task---\nPlease combine the above content in a cohesive way.';
        }
        
        // Get all existing nodes for optimal positioning
        const existingNodes = [];
        nodeMap.forEach((data, id) => {
            if (!selectedNodesForMerge.has(id)) { // Exclude selected nodes
                existingNodes.push({
                    id: id,
                    position: data.position
                });
            }
        });
        
        // Calculate centroid of selected nodes
        let sumX = 0, sumY = 0;
        nodesToMerge.forEach(node => {
            sumX += node.data.position.x;
            sumY += node.data.position.y;
        });
        
        const centroid = {
            x: sumX / nodesToMerge.length,
            y: sumY / nodesToMerge.length + CONFIG.nodes.spacing * 1.5
        };
        
        // Find optimal position near the centroid
        const position = findOptimalPosition([...existingNodes, { position: centroid }]);
        
        // Create new merged node
        const mergedNodeId = createNode(mergedPrompt, position);
        
        // Connect all original nodes to the merged node
        nodesToMerge.forEach(node => {
            jsPlumbInstance.connect({
                source: node.id,
                target: mergedNodeId
            });
        });
        
        // Close modal
        closeModals();
        
        // Run the new merged node automatically
        runNode(mergedNodeId);
    }

    // Initialize the application
    function init() {
        // Initialize JSPlumb
        initJSPlumb();
        
        // Event listeners for buttons
        addNodeBtn.addEventListener('click', openNodeModal);
        
        // Clear canvas button - support both old and new ID formats
        const clearCanvasBtn = document.getElementById('clear-canvas-btn');
        const clearCanvasNewBtn = document.getElementById('clear-canvas');
        if (clearCanvasBtn) clearCanvasBtn.addEventListener('click', clearCanvas);
        if (clearCanvasNewBtn) clearCanvasNewBtn.addEventListener('click', clearCanvas);
        
        // New node button in toolbar
        const newNodeBtn = document.getElementById('new-node-btn');
        if (newNodeBtn) {
            newNodeBtn.addEventListener('click', openNodeModal);
        }
        
        // Add click-outside handler for connector menu
        document.addEventListener('click', (e) => {
            // If we clicked outside a connector and a menu is open, close it
            if (!e.target.closest('.node-connector') && !e.target.closest('#connector-menu')) {
                removeConnectorMenu();
            }
        });
        
        // Modal event listeners
        // Update node count display when slider changes
        nodeCountSlider.addEventListener('input', () => {
            nodeCountDisplay.textContent = nodeCountSlider.value;
        });
        
        createNodeBtn.addEventListener('click', () => {
            const prompt = nodePromptInput.value.trim();
            const nodeCount = parseInt(nodeCountSlider.value);
            const customInstructions = nodeInstructionsInput.value.trim();
            
            if (prompt) {
                // Create multiple nodes if count > 1
                if (nodeCount > 1) {
                    createMultipleNodes(prompt, customInstructions, nodeCount);
                } else {
                    // Create a single node with prompt and custom instructions
                    let finalPrompt = prompt;
                    if (customInstructions) {
                        finalPrompt = `${prompt}\n\n---Your Instructions---\n${customInstructions}`;
                    }
                    const nodeId = createNode(finalPrompt);
                    
                    // Auto-run the node immediately
                    setTimeout(() => {
                        runNode(nodeId);
                    }, 100);
                }
                closeModals();
            } else {
                alert('Please enter a prompt.');
            }
        });
        
        createVariationsBtn.addEventListener('click', () => {
            if (selectedNodeForVariation) {
                const count = parseInt(variationCountInput.value) || CONFIG.variations.defaultCount;
                const customPrompt = variationPromptInput.value.trim();
                createVariations(selectedNodeForVariation, count, customPrompt);
                closeModals();
            }
        });
        
        createMergeBtn.addEventListener('click', mergeNodes);
        
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', closeModals);
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === nodeModal) closeModals();
            if (event.target === variationModal) closeModals();
            if (event.target === mergeModal) closeModals();
        });
    }
    
    // Start the application
    init();
});
