import os
import tempfile
import shutil
from typing import TypedDict, List, Optional, Dict, Any
from dotenv import load_dotenv
import httpx
from starlette.requests import Request as StarletteRequest

from starlette.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware
from starlette.responses import JSONResponse
from fastmcp.server.auth import BearerAuthProvider
from fastmcp.server.dependencies import get_access_token, AccessToken
from pydantic import BaseModel, Field
from fastmcp import FastMCP
from starlette.types import ASGIApp, Receive, Scope, Send
import json
import requests
import subprocess
load_dotenv()

mcp = FastMCP(name="GitHub Tools Integration")

# Configuration
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GITHUB_API_BASE = os.getenv('GITHUB_API_BASE')

print(f"Using GitHub API Base:", GITHUB_API_BASE)
print(f"Using GitHub Token:", GITHUB_TOKEN)


def make_github_request(endpoint: str, method: str = "GET") -> Dict[Any, Any]:
    """Make authenticated GitHub API request."""
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "MCP-Git-Tool"
    }
    url = f"{GITHUB_API_BASE}/{endpoint.lstrip('/')}"
    response = requests.request(method, url, headers=headers)
    response.raise_for_status()
    return response.json()

def clone_repo_temp(repo_url: str, branch: str = "main") -> str:
    """Clone repository to temporary directory."""
    temp_dir = tempfile.mkdtemp()
    try:
        cmd = ["git", "clone", "--depth", "50", "-b", branch, repo_url, temp_dir]
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return temp_dir
    except subprocess.CalledProcessError as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise Exception(f"Failed to clone repository: {e.stderr}")

# Pydantic Models for structured responses
class CommitInfo(BaseModel):
    """Commit information structure."""
    sha: str = Field(description="Commit SHA hash")
    message: str = Field(description="Commit message")
    author: str = Field(description="Commit author")
    date: str = Field(description="Commit date")
    url: str = Field(description="Commit URL")


class FileChange(BaseModel):
    """File change information."""
    filename: str = Field(description="Changed file path")
    status: str = Field(description="Change status (added/modified/deleted)")
    additions: int = Field(description="Lines added")
    deletions: int = Field(description="Lines deleted")
    patch: Optional[str] = Field(description="File diff patch", default=None)


class CommitDiff(BaseModel):
    """Complete commit diff information."""
    commit: CommitInfo
    files: List[FileChange]
    total_additions: int = Field(description="Total lines added")
    total_deletions: int = Field(description="Total lines deleted")


class RepoInfo(BaseModel):
    """Repository information."""
    name: str
    full_name: str
    description: Optional[str]
    default_branch: str
    clone_url: str
    updated_at: str


class BranchInfo(TypedDict):
    """Branch information structure."""
    name: str
    sha: str
    protected: bool

@mcp.tool()
def get_latest_commit(owner: str, repo: str, branch: str = "main") -> CommitInfo:
    """Get the latest commit from a repository branch."""
    try:
        data = make_github_request(f"repos/{owner}/{repo}/commits/{branch}")
        return CommitInfo(
            sha=data["sha"],
            message=data["commit"]["message"],
            author=data["commit"]["author"]["name"],
            date=data["commit"]["author"]["date"],
            url=data["html_url"]
        )
    except Exception as e:
        raise Exception(f"Failed to get latest commit: {str(e)}")


# Additional MCP Tools for full GitHub access
@mcp.tool()
def get_commit_diff(owner: str, repo: str, commit_sha: str) -> CommitDiff:
    """Get detailed diff for a specific commit."""
    try:
        commit_data = make_github_request(f"repos/{owner}/{repo}/commits/{commit_sha}")
        commit_info = CommitInfo(
            sha=commit_data["sha"],
            message=commit_data["commit"]["message"],
            author=commit_data["commit"]["author"]["name"],
            date=commit_data["commit"]["author"]["date"],
            url=commit_data["html_url"]
        )
        files = []
        total_additions = 0
        total_deletions = 0
        for file_data in commit_data.get("files", []):
            file_change = FileChange(
                filename=file_data["filename"],
                status=file_data["status"],
                additions=file_data.get("additions", 0),
                deletions=file_data.get("deletions", 0),
                patch=file_data.get("patch", "")
            )
            files.append(file_change)
            total_additions += file_change.additions
            total_deletions += file_change.deletions
        return CommitDiff(
            commit=commit_info,
            files=files,
            total_additions=total_additions,
            total_deletions=total_deletions
        )
    except Exception as e:
        raise Exception(f"Failed to get commit diff: {str(e)}")


@mcp.tool()
def get_recent_commits(owner: str, repo: str, count: int = 10, branch: str = "main") -> List[CommitInfo]:
    """Get recent commits from a repository."""
    try:
        data = make_github_request(f"repos/{owner}/{repo}/commits?sha={branch}&per_page={count}")
        commits = []
        for commit_data in data:
            commit = CommitInfo(
                sha=commit_data["sha"],
                message=commit_data["commit"]["message"],
                author=commit_data["commit"]["author"]["name"],
                date=commit_data["commit"]["author"]["date"],
                url=commit_data["html_url"]
            )
            commits.append(commit)
        return commits
    except Exception as e:
        raise Exception(f"Failed to get recent commits: {str(e)}")


@mcp.tool()
def get_file_content(owner: str, repo: str, file_path: str, branch: str = "main") -> dict:
    """Get content of a specific file from repository."""
    try:
        data = make_github_request(f"repos/{owner}/{repo}/contents/{file_path}?ref={branch}")
        if data.get("type") != "file":
            raise Exception(f"Path {file_path} is not a file")
        import base64
        content = base64.b64decode(data["content"]).decode('utf-8')
        return {
            "path": file_path,
            "content": content,
            "sha": data["sha"],
            "size": data["size"],
            "download_url": data.get("download_url", "")
        }
    except Exception as e:
        raise Exception(f"Failed to get file content: {str(e)}")

if __name__ == "__main__":
    mcp.run(transport="stdio")