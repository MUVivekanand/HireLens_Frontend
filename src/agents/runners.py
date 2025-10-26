# from autogen_agentchat.agents import AssistantAgent
# from autogen_core import CancellationToken
# from autogen_agentchat.ui import Console

# async def run_mcp_agent(mcp_agent: AssistantAgent):
#     """Run main MCP agent with all tools enabled"""
#     print("\n=== MCP AGENT ACTIVE ===")
#     print("\nAvailable Tools:")
#     for tool in mcp_agent._tools:
#         desc = getattr(tool, "description", "No description")
#         print(f"- {tool.name}: {desc}")
#     print("\nType 'exit' to quit.\n")

#     while True:
#         user_input = input("Task> ").strip()
#         if not user_input:
#             continue
#         if user_input.lower() in {"exit", "quit"}:
#             print("Agent stopped!")
#             break


#         await Console(
#             mcp_agent.run_stream(
#                 task=user_input,
#                 cancellation_token=CancellationToken(),
#             )
#         )

from autogen_agentchat.agents import AssistantAgent
from autogen_core import CancellationToken
from autogen_agentchat.ui import Console

async def run_mcp_agent(mcp_agent: AssistantAgent, task: str):
    """Run main MCP agent with all tools enabled and return results as JSON"""
    print("\n=== MCP AGENT ACTIVE ===")
    print(f"\nProcessing task: {task}")
    
    try:
        # Collect all messages from the stream
        
        result = await Console(
            mcp_agent.run_stream(
                task=task,
                cancellation_token=CancellationToken(),
            )
        )

        messages = result.messages
        
        final_response = "No response generated"
        for message in reversed(messages):
            if (hasattr(message, 'type') and message.type == 'TextMessage' 
                and hasattr(message, 'source') and message.source != 'user'):
                final_response = message.content
                break

        print("Response by runner: ", final_response)
        # Return structured results
        return final_response
        
    except Exception as e:
        print(f"\n=== ERROR IN AGENT ===")
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "task": task,
            "messages": [],
            "final_response": f"Error: {str(e)}",
            "error": str(e)
        }