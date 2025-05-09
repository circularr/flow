# AI Flow Editor

A browser-based tool for creating AI prompt workflows using a node-based interface. Create prompts, generate variations, and build complex flows with OpenAI's GPT-4.1-nano model and more.

## Features

- Click to add prompt nodes
- Generate variations from existing nodes
- Connect nodes to create flows
- Run individual nodes or entire flows
- Clean, intuitive interface

## How to Use

1. **Open the application**: Simply open the `index.html` file in your web browser.
2. **Add a Node**: Click the "+ Add Node" button and enter your prompt.
3. **Run a Node**: Click the play button on a node to generate a response using the OpenAI API.
4. **Create Variations**: Click the connector dot at the bottom of a node to create variations.
5. **Run the Flow**: Click "Run Flow" to process all nodes in the flow from top to bottom.

## API Key

Add your own in gui. 


## Local Development

To run on a local server (if you have Node.js, Python, or PHP installed):

- With Node.js: `npx http-server`
- With Python 3: `python3 -m http.server 8000`
- With PHP: `php -S localhost:8000`

Or simply open the `index.html` file directly in your browser.
