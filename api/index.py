import asyncio
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from agents import create_mcp_agent
from runners import run_mcp_agent

app = Flask(__name__)
CORS(app)

@app.route('/api/analyze-contribution', methods=['POST'])
def analyze_contribution():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        # Extract fields
        project = data.get('project')
        author = data.get('author')
        owner = data.get('owner')
        
        # Print received data
        print("=" * 50)
        print("Received JSON Data:")
        print(f"Project: {project}")
        print(f"Author: {author}")
        print(f"Owner: {owner}")
        print("=" * 50)
        
        # Initialize agent if needed
        mcp_agent = asyncio.run(create_mcp_agent())
        
        # Create task for the agent
        task = f"Analyze GitHub contributions for {author} in the {owner}/{project} repository"
        
        # Run the async agent function synchronously
        result = asyncio.run(run_mcp_agent(mcp_agent, task))
        print("Result to frontend:", result)
        # Return the result
        return jsonify(result), 200
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Backend is running"}), 200

# if __name__ == "__main__":
#     app.run(debug=True, port=8765, host='localhost')