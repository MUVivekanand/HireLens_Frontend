# from fastapi import FastAPI, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# import re
# import asyncio
# import traceback
# import sys
# import logging

# # Setup logging
# logging.basicConfig(level=logging.DEBUG)
# logger = logging.getLogger(__name__)

# app = FastAPI(title="Contribution Analyzer API")

# # Enable CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# class ContributionRequest(BaseModel):
#     project: str
#     author: str

# class ContributionResponse(BaseModel):
#     project_name: str
#     author_name: str
#     total_commits: int
#     commits_by_author: int
#     contribution_percentage: float
#     rating: int
#     rating_description: str

# def parse_agent_response(agent_response: str) -> dict:
#     """Parse the agent response text to extract structured data"""
#     logger.debug(f"Raw agent response:\n{agent_response}\n")
    
#     lines = str(agent_response).split('\n')
#     data = {}
    
#     for line in lines:
#         line = line.strip()
        
#         if line.startswith('Project name:'):
#             data['project_name'] = line.split(':', 1)[1].strip()
#         elif line.startswith('Author name:'):
#             data['author_name'] = line.split(':', 1)[1].strip()
#         elif line.startswith('Total commits:'):
#             try:
#                 data['total_commits'] = int(line.split(':', 1)[1].strip())
#             except ValueError as e:
#                 logger.error(f"Failed to parse total_commits: {e}")
#         elif line.startswith('No of commits by author:'):
#             try:
#                 data['commits_by_author'] = int(line.split(':', 1)[1].strip())
#             except ValueError as e:
#                 logger.error(f"Failed to parse commits_by_author: {e}")
#         elif 'Contribution Percentage' in line and '%' in line:
#             match = re.search(r'(\d+(?:\.\d+)?)\s*%', line)
#             if match:
#                 data['contribution_percentage'] = float(match.group(1))
#         elif line.startswith('Contribution Rating:'):
#             match = re.search(r'(\d+)/6', line)
#             if match:
#                 data['rating'] = int(match.group(1))
    
#     logger.debug(f"Parsed data: {data}")
    
#     percentage = data.get('contribution_percentage', 0)
#     if percentage < 10:
#         description = "Minimal contributor - Limited involvement in the project"
#     elif percentage < 25:
#         description = "Low contributor - Occasional commits to the project"
#     elif percentage < 40:
#         description = "Moderate contributor - Regular involvement in development"
#     elif percentage < 55:
#         description = "Significant contributor - Major role in project development"
#     elif percentage < 75:
#         description = "Major contributor - Core member of the development team"
#     else:
#         description = "Lead contributor - Primary developer of the project"
    
#     data['rating_description'] = description
#     return data

# async def call_mcp_agent(project: str, author: str) -> str:
#     """Call the MCP agent with the contribution analysis request"""
#     try:
#         logger.info(f"Starting agent call for project: {project}, author: {author}")
        
#         # IMPORTANT: Update this import path to match your actual project structure
#         from agents import create_mcp_agent
#         from autogen_core import UserMessage
        
#         logger.info("Creating MCP agent...")
#         agent = await create_mcp_agent()
#         logger.info(f"Agent created successfully. Agent type: {type(agent)}")
        
#         prompt = f"Use the tool get_recent_commits of {project} of author {author} and return the number of commits by him out of total commits in the repo"
#         logger.info(f"Calling agent with prompt: {prompt}")
        
#         # Create a UserMessage object for the agent
#         user_message = UserMessage(content=prompt)
        
#         # Use on_messages method which accepts a list of messages
#         logger.info("Using agent.on_messages() method")
#         response = await agent.on_messages([user_message])
        
#         logger.info(f"Agent response type: {type(response)}")
#         logger.info(f"Agent response: {response}")
        
#         # Extract the actual text response
#         if isinstance(response, list) and len(response) > 0:
#             # If it's a list of message objects
#             result = response[-1]  # Get last message
#             if hasattr(result, 'content'):
#                 return str(result.content)
#             return str(result)
        
#         return str(response)
        
#     except Exception as e:
#         logger.error(f"Failed to call agent: {str(e)}")
#         logger.error(traceback.format_exc())
#         raise

# @app.post("/api/analyze-contribution", response_model=ContributionResponse)
# async def analyze_contribution(request: ContributionRequest):
#     """Main endpoint to analyze author contributions"""
#     try:
#         logger.info(f"Request received - Project: {request.project}, Author: {request.author}")
        
#         agent_response = await call_mcp_agent(request.project, request.author)
#         logger.info(f"Got agent response: {agent_response}")
        
#         parsed_data = parse_agent_response(agent_response)
#         logger.info(f"Parsed data: {parsed_data}")
        
#         required_fields = ['project_name', 'author_name', 'total_commits', 
#                           'commits_by_author', 'contribution_percentage', 'rating']
        
#         missing_fields = [field for field in required_fields if field not in parsed_data]
#         if missing_fields:
#             logger.warning(f"Missing fields: {missing_fields}. Parsed data: {parsed_data}")
        
#         response = ContributionResponse(
#             project_name=parsed_data.get('project_name', 'N/A'),
#             author_name=parsed_data.get('author_name', 'N/A'),
#             total_commits=parsed_data.get('total_commits', 0),
#             commits_by_author=parsed_data.get('commits_by_author', 0),
#             contribution_percentage=parsed_data.get('contribution_percentage', 0.0),
#             rating=parsed_data.get('rating', 0),
#             rating_description=parsed_data.get('rating_description', '')
#         )
        
#         logger.info(f"Success: {response}")
#         return response
    
#     except Exception as e:
#         error_msg = f"{str(e)}\n{traceback.format_exc()}"
#         logger.error(f"ERROR: {error_msg}")
#         print(f"\n\n{'='*60}\nERROR DETAILS:\n{error_msg}\n{'='*60}\n", file=sys.stderr)
#         raise HTTPException(status_code=500, detail=error_msg)

# @app.get("/api/health")
# async def health_check():
#     """Health check endpoint"""
#     return {"status": "ok"}

# @app.get("/api/test")
# async def test():
#     """Test endpoint with mock data"""
#     logger.info("Test endpoint called")
#     return {
#         "project_name": "ASTRA_Autogen",
#         "author_name": "MUVivekanand",
#         "total_commits": 10,
#         "commits_by_author": 4,
#         "contribution_percentage": 40.0,
#         "rating": 4,
#         "rating_description": "Significant contributor"
#     }

# if __name__ == "__main__":
#     import uvicorn
#     logger.info("Starting API...")
#     uvicorn.run(app, host="0.0.0.0", port=8000)