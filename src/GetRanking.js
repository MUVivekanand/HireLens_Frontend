import React, { useState } from "react";
import { collection, query, where, getDocs, getFirestore } from "firebase/firestore";
import { app } from "../src/firebase.js";
import "./GetRanking.css";

const db = getFirestore(app);
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

/**
 * Safely format a field that might be:
 *  - a comma-separated string: "A,B,C"
 *  - an array: ["A","B","C"]
 *  - empty or undefined
 */
function formatListField(field) {
  if (!field) return "N/A";
  if (Array.isArray(field)) return field.join(", ");
  if (typeof field === "string") {
    return field
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }
  return String(field);
}

/**
 * Parse experience duration string and return score (0-2)
 * No experience = 0
 * < 1 year (including months only) = 1
 * > 1 year = 2
 */
function calculateExperienceScore(experienceStr) {
  // No experience case
  if (!experienceStr || experienceStr === "0" || experienceStr.toLowerCase() === "n/a") {
    return 0;
  }

  const lower = String(experienceStr).toLowerCase().trim();

  // Extract years from the string
  const yearMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:\+?)?\s*year/);
  
  if (yearMatch) {
    const years = parseFloat(yearMatch[1]);
    
    if (years > 1) {
      return 2; // Greater than 1 year
    } else if (years > 0 && years <= 1) {
      return 1; // Between 0 and 1 year (inclusive of exactly 1 year)
    } else {
      return 0; // 0 years
    }
  }

  // Check for months only (no years mentioned) - less than 1 year
  if (lower.includes("month") && !lower.includes("year")) {
    return 1; // Less than 1 year
  }

  // Default to 0 if no clear experience found
  return 0;
}

/**
 * Get Gemini assessment for skills and company
 */
async function getGeminiAssessment(skills, company) {
  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `You are a professional recruiter assessing candidate qualifications.

Given the following information:
- Skills: ${skills}
- Company/Experience: ${company}

Provide ONLY a valid JSON response (no markdown, no extra text):

{
  "skill_score": <number between 0 and 1>,
  "company_score": <number between 0 and 1>,
  "skill_reasoning": "<brief explanation>",
  "company_reasoning": "<brief explanation>"
}

Scoring Guidelines:
- skill_score (0-1): Based on relevance, demand, and diversity of skills. 0.8-1.0 = highly sought-after skills, 0.5-0.7 = good skills, 0.0-0.4 = basic skills
- company_score (0-1): Based on company prestige and reputation. 0.8-1.0 = FAANG/top-tier, 0.6-0.7 = well-known companies, 0.4-0.5 = established companies, 0.0-0.3 = startups/lesser-known`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error("Unexpected response format from Gemini API");
    }

    // Clean up markdown code blocks if present
    responseText = responseText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const assessment = JSON.parse(responseText);
    return assessment;
  } catch (err) {
    console.error("Gemini assessment error:", err);
    throw err;
  }
}

export default function GetRanking() {
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState("");
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [assessmentError, setAssessmentError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setUserData(null);
    setAssessment(null);
    setAssessmentError("");

    try {
      const trimmed = String(fullName || "").trim();
      if (!trimmed) {
        setError("Please enter your full name.");
        setLoading(false);
        return;
      }

      const fileNameToSearch = trimmed.toLowerCase().endsWith(".docx")
        ? trimmed
        : `${trimmed}.docx`;

      const q = query(
        collection(db, "resumes"),
        where("fileName", "==", fileNameToSearch)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("❌ No user found. Please check your full name and try again.");
      } else {
        const data = querySnapshot.docs[0].data();

        const normalized = {
          skills: data.skills ?? data.skill ?? null,
          projects: data.projects ?? data.project ?? null,
          fileName: data.fileName ?? null,
          experience_company: data.experience_company ?? data.company ?? null,
          time_experience: data.time_experience ?? data.experience_time ?? null,
          timestamp: data.timestamp ?? data.createdAt ?? null,
          github_token: data.github_token ?? data.githubToken ?? data.githubTokenLower ?? null,
          ...data,
        };

        setUserData(normalized);
      }
    } catch (err) {
      console.error("Error fetching Firestore data:", err);
      setError("⚠️ Something went wrong while fetching data. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkillAssessment = async () => {
    if (!userData) return;

    setAssessmentLoading(true);
    setAssessmentError("");
    setAssessment(null);

    try {
      const skills = formatListField(userData.skills);
      const company = formatListField(userData.experience_company);

      // Calculate experience score using the function
      const experienceScore = calculateExperienceScore(userData.time_experience);

      // Get Gemini assessment for skills and company
      const geminiAssessment = await getGeminiAssessment(skills, company);

      const skillScore = Math.min(Math.max(geminiAssessment.skill_score || 0, 0), 1);
      const companyScore = Math.min(Math.max(geminiAssessment.company_score || 0, 0), 1);

      // Calculate total score out of 4
      // skill: 0-1, experience: 0-2, company: 0-1
      const totalScore = skillScore + experienceScore + companyScore;

      setAssessment({
        skillScore,
        experienceScore,
        companyScore,
        totalScore,
        maxScore: 4,
        skillReasoning: geminiAssessment.skill_reasoning || "No reasoning provided",
        companyReasoning: geminiAssessment.company_reasoning || "No reasoning provided",
      });
    } catch (err) {
      console.error("Assessment error:", err);
      setAssessmentError(`Assessment Error: ${err.message}`);
    } finally {
      setAssessmentLoading(false);
    }
  };

  return (
    <div className="gr-container">
      <div className="gr-card">

        <form onSubmit={handleSearch} className="gr-form">
          <label htmlFor="fullname" className="gr-label">
            Enter full name (no need to type <span className="gr-italic">.docx</span>)
          </label>
          <input
            id="fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Aravindhkrishnan P"
            className="gr-input"
          />

          <div className="gr-button-group">
            <button
              type="submit"
              disabled={loading}
              className={`gr-btn gr-btn-primary ${loading ? "gr-btn-disabled" : ""}`}
            >
              {loading ? "Searching..." : "Find My Record"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFullName("");
                setUserData(null);
                setError("");
                setAssessment(null);
              }}
              className="gr-btn gr-btn-secondary"
            >
              Reset
            </button>
          </div>
        </form>

        {error && <p className="gr-error">{error}</p>}

        {userData && (
          <div className="gr-results">
            <div className="gr-results-header">
              <h2 className="gr-results-title">✅ User Details</h2>
            </div>

            <div className="gr-fields-grid">
              <div className="gr-field">
                <label className="gr-field-label">📄 File Name</label>
                <div className="gr-field-value">{userData.fileName ?? "N/A"}</div>
              </div>

              <div className="gr-field">
                <label className="gr-field-label">🏢 Company</label>
                <div className="gr-field-value">
                  {userData.experience_company ?? "N/A"}
                </div>
              </div>

              <div className="gr-field">
                <label className="gr-field-label">⏱ Experience</label>
                <div className="gr-field-value">
                  {userData.time_experience ?? "N/A"}
                </div>
              </div>

              <div className="gr-field">
                <label className="gr-field-label">🕒 Timestamp</label>
                <div className="gr-field-value">
                  {userData.timestamp
                    ? (() => {
                        try {
                          if (typeof userData.timestamp.toDate === "function") {
                            return new Date(
                              userData.timestamp.toDate()
                            ).toLocaleString();
                          }
                        } catch {}
                        try {
                          return new Date(userData.timestamp).toLocaleString();
                        } catch {
                          return String(userData.timestamp);
                        }
                      })()
                    : "N/A"}
                </div>
              </div>

              <div className="gr-field gr-field-full">
                <label className="gr-field-label">🛠 Skills</label>
                <div className="gr-field-value">
                  {formatListField(userData.skills)}
                </div>
              </div>

              <div className="gr-field gr-field-full">
                <label className="gr-field-label">🚀 Projects</label>
                <div className="gr-field-value">
                  {formatListField(userData.projects)}
                </div>
              </div>
            </div>

            {/* Skill Level Assessment Button */}
            <div className="gr-assessment-section">
              <button
                onClick={handleSkillAssessment}
                disabled={assessmentLoading}
                className={`gr-btn gr-btn-assessment ${
                  assessmentLoading ? "gr-btn-disabled" : ""
                }`}
              >
                {assessmentLoading
                  ? "Assessing Skills..."
                  : "🎯 Skill Level Assessment"}
              </button>
            </div>

            {assessmentError && (
              <p className="gr-error gr-assessment-error">{assessmentError}</p>
            )}

            {/* Assessment Results */}
            {assessment && (
              <div className="gr-assessment-results">
                <h3 className="gr-assessment-title">📊 Assessment Results</h3>

                <div className="gr-score-grid">
                  <div className="gr-score-card">
                    <div className="gr-score-label">Skill Score</div>
                    <div className="gr-score-value">
                      {assessment.skillScore.toFixed(2)} / 1.0
                    </div>
                    <div className="gr-score-reasoning">
                      {assessment.skillReasoning}
                    </div>
                  </div>

                  <div className="gr-score-card">
                    <div className="gr-score-label">Experience Score</div>
                    <div className="gr-score-value">
                      {assessment.experienceScore} / 2.0
                    </div>
                    <div className="gr-score-reasoning">
                      Based on duration: {userData.time_experience}
                    </div>
                  </div>

                  <div className="gr-score-card">
                    <div className="gr-score-label">Company Score</div>
                    <div className="gr-score-value">
                      {assessment.companyScore.toFixed(2)} / 1.0
                    </div>
                    <div className="gr-score-reasoning">
                      {assessment.companyReasoning}
                    </div>
                  </div>

                  <div className="gr-score-card gr-score-total">
                    <div className="gr-score-label">Total Score</div>
                    <div className="gr-score-value gr-total-value">
                      {assessment.totalScore.toFixed(2)} / {assessment.maxScore}
                    </div>
                  </div>
                </div>
                  </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}