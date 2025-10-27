# import asyncio
# import json
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from agents import create_mcp_agent
# from runners import run_mcp_agent

# app = Flask(__name__)
# CORS(app)

# @app.route('/api/analyze-contribution', methods=['POST'])
# def analyze_contribution():
#     try:
#         # Get JSON data from request
#         data = request.get_json()
        
#         # Extract fields
#         project = data.get('project')
#         author = data.get('author')
#         owner = data.get('owner')
        
#         # Print received data
#         print("=" * 50)
#         print("Received JSON Data:")
#         print(f"Project: {project}")
#         print(f"Author: {author}")
#         print(f"Owner: {owner}")
#         print("=" * 50)
        
#         # Initialize agent if needed
#         mcp_agent = asyncio.run(create_mcp_agent())
        
#         # Create task for the agent
#         task = f"Analyze GitHub contributions for {author} in the {owner}/{project} repository"
        
#         # Run the async agent function synchronously
#         result = asyncio.run(run_mcp_agent(mcp_agent, task))
#         print("Result to frontend:", result)
#         # Return the result
#         return jsonify(result), 200
        
#     except Exception as e:
#         print(f"Error: {str(e)}")
#         import traceback
#         traceback.print_exc()
#         return jsonify({
#             "success": False,
#             "error": str(e)
#         }), 500

# @app.route('/health', methods=['GET'])
# def health_check():
#     return jsonify({"status": "Backend is running"}), 200

# # if __name__ == "__main__":
# #     app.run(debug=True, port=8765, host='localhost')

import asyncio
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from agents import create_mcp_agent
from runners import run_mcp_agent

app = Flask(__name__)
CORS(app)

# Fix for asyncio event loop issues on Vercel
def run_async(coro):
    """Helper to run async functions in Flask"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Backend is running"}), 200

@app.route('/api/analyze-contribution', methods=['POST'])
def analyze_contribution():
    try:
        # Get JSON data from request
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        # Extract fields
        project = data.get('project')
        author = data.get('author')
        owner = data.get('owner')
        
        # Validate required fields
        if not all([project, author, owner]):
            return jsonify({"error": "Missing required fields"}), 400
        
        # Print received data (visible in Vercel function logs)
        print("=" * 50)
        print(f"Project: {project}, Author: {author}, Owner: {owner}")
        print("=" * 50)
        
        # Initialize agent and run
        mcp_agent = run_async(create_mcp_agent())
        task = f"Analyze GitHub contributions for {author} in the {owner}/{project} repository"
        result = run_async(run_mcp_agent(mcp_agent, task))
        
        print("Result:", result)
        
        # Return just the result
        return jsonify(result), 200
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
