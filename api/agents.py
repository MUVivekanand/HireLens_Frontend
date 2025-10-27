import os
from autogen_ext.models.openai import AzureOpenAIChatCompletionClient
from autogen_ext.tools.mcp import StdioServerParams, mcp_server_tools
from autogen_agentchat.agents import AssistantAgent
from dotenv import load_dotenv

load_dotenv()

AZURE_API_KEY = os.getenv("AZURE_KEY")
AZURE_API_ENDPOINT = os.getenv("AZURE_ENDPOINT")
AZURE_DEPLOYMENT = os.getenv("AZURE_DEPLOYMENT")

if not AZURE_API_KEY or not AZURE_API_ENDPOINT or not AZURE_DEPLOYMENT:
    raise ValueError("Azure API credentials are not set.")


async def create_model_client():
    """Create Azure OpenAI model client"""
    return AzureOpenAIChatCompletionClient(
        api_key=AZURE_API_KEY,
        model="gpt-4o-2024-05-13",
        azure_deployment=AZURE_DEPLOYMENT,
        azure_endpoint=AZURE_API_ENDPOINT,
        api_version="2023-03-15-preview"
    )


async def create_mcp_agent():
    """Create MCP agent with math and mongodb tools"""
    print("Initializing MCP Agent with all tools...")

    github_server_path = os.path.join(os.path.dirname(__file__), "..", "api", "githubmcp.py")

    github_server = StdioServerParams(
        command="python", args=[github_server_path]
    )

    github_tools = await mcp_server_tools(github_server)
    
    model_client = await create_model_client()
    
    return AssistantAgent(
        name="mcp_agent",
        model_client=model_client,
        tools=github_tools,
        reflect_on_tool_use=True,
        system_message=(
            "You are an intelligent assistant with access to modify/read/list out all the repositories on a Github account. "
            "Use the available tools to help users with their commit file diffs, code analysis, branch details, etc. "
            
            "CRITICAL: When analyzing author contributions using get_recent_commits tool, you MUST follow this EXACT output format:\n\n"
            "Project name: [project_name]\n"
            "Author name: [name]\n"
            "Total commits: [number]\n"
            "No of commits by author: [number]\n\n"
            
            "CONTRIBUTION RATING SCALE (out of 6):\n"
            "- 0-10% contribution: Rating 1\n"
            "- 11-25% contribution: Rating 2\n"
            "- 26-40% contribution: Rating 3\n"
            "- 41-55% contribution: Rating 4\n"
            "- 56-75% contribution: Rating 5\n"
            "- 76-100% contribution: Rating 6\n\n"
            
            "IMPORTANT: Even if the author has exactly 50% of commits, provide them a GOOD rating (Rating 4) because half the project is done by him. "
            "Calculate contribution percentage as: (commits_by_author / total_commits) * 100. "
            "Be fair and generous in rating - significant contributions deserve recognition. "
            "Always provide the rating at the end in this format: Contribution Rating: [X]/6\n\n"
            
            "Always provide clear and helpful responses with accurate contribution analysis."
        ),
    )