import { useState } from 'react';
import mammoth from 'mammoth';
import './App.css';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

function App() {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const pdf = require('pdf-parse');

  // Google Gemini API Configuration
  const REACT_APP_GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
  console.log('Gemini API Key:', REACT_APP_GEMINI_API_KEY ? 'Exists' : 'Not Set');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const fileType = selectedFile.type;
      if (
        fileType === 'application/pdf' ||
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/msword'
      ) {
        setFile(selectedFile);
        setError('');
        setContent('');
        setExtractedText('');
        setStep('');
      } else {
        setError('Please upload a PDF or Word document');
        setFile(null);
      }
    }
  };

  const extractTextFromPDF = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target.result);
          const data = await pdf(typedArray);

          if (data && data.text && data.text.trim().length > 0) {
            resolve(data.text.trim());
          } else {
            reject(new Error('No readable text found in PDF'));
          }
        } catch (err) {
          reject(new Error('PDF extraction failed: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read PDF file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const extractTextFromWord = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.extractRawText({ arrayBuffer });
          if (result.value && result.value.trim().length > 0) {
            resolve(result.value.trim());
          } else {
            reject(new Error('No text content found in Word document'));
          }
        } catch (err) {
          reject(new Error('Word extraction failed: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Word file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const processWithGemini = async (text) => {
    console.log('=== Google Gemini Request ===');
    console.log('API Key exists:', !!REACT_APP_GEMINI_API_KEY);
    console.log('Text length:', text.length);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${REACT_APP_GEMINI_API_KEY}`;
    console.log('API URL configured');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `
You are an AI assistant that extracts information from resumes (PDF/Word). 
Please return a strictly formatted JSON object ONLY (no extra text) with the following fields:

{
  "skills": ["top 5 skills, or NA if none"],
  "projects": ["top 3 project names, or NA if none"],
  "time_experience": "total duration of experience, 0 if none",
  "experience_company": ["company names, or NA if none"],
}

Analyze the following resume content and populate the JSON accordingly. Do NOT include explanations, only JSON:

${text}
              `
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          }
        })
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);

        let errorMessage = `API request failed (${response.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Success! Response received');

      let aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) {
        throw new Error('Unexpected response format from Gemini API');
      }

      aiText = aiText.replace(/```json|```/g, '').trim();

      let structuredResume = {};
      try {
        structuredResume = JSON.parse(aiText);
      } catch (e) {
        console.error('Failed to parse JSON from AI response, returning default structure', e);
        structuredResume = {
          skills: ["NA"],
          projects: ["NA"],
          time_experience: "0",
          experience_company: ["NA"],
        };
      }

      // Ensure all fields exist
      structuredResume.skills = structuredResume.skills || ["NA"];
      structuredResume.projects = structuredResume.projects || ["NA"];
      structuredResume.time_experience = structuredResume.time_experience || "0";
      structuredResume.experience_company = structuredResume.experience_company || ["NA"];

      return structuredResume;

    } catch (err) {
      console.error('Full error:', err);
      throw err;
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError('');
    setExtractedText('');
    setContent('');
    setStep('Extracting text from document...');

    try {
      let text = '';

      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else {
        text = await extractTextFromWord(file);
      }

      if (!text || text.trim().length === 0) {
        throw new Error('Could not extract text from the document');
      }

      console.log('Extracted text length:', text.length);
      console.log('First 200 chars:', text.substring(0, 200));

      setExtractedText(text);
      setStep('Text extracted successfully! Ready to process with AI.');
      setLoading(false);
    } catch (err) {
      setError(`Extraction Error: ${err.message}`);
      setStep('');
      setLoading(false);
    }
  };

  const handleProcessWithAI = async () => {
    if (!extractedText) {
      setError('Please extract text first');
      return;
    }

    if (!githubToken.trim()) {
      setError('Please enter your GitHub token');
      return;
    }

    if (!REACT_APP_GEMINI_API_KEY) {
      setError('Google Gemini API key not configured. Please check your .env file.');
      return;
    }

    setLoading(true);
    setError('');
    setSaveSuccess(false);
    setStep('Processing with Google Gemini AI...');

    try {
      const formattedContent = await processWithGemini(extractedText);
      
      // Append GitHub token to the AI response
      const finalContent = {
        ...formattedContent,
        github_token: githubToken
      };
      
      setContent(finalContent);
      setStep('Processing complete!');
    } catch (err) {
      setError(`AI Processing Error: ${err.message}`);
      setStep('');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToFirebase = async () => {
    if (!content) {
      setError('No content to save');
      return;
    }

    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const docData = {
        ...content,
        timestamp: new Date().toISOString(),
        fileName: file?.name || 'unknown'
      };

      const docRef = await addDoc(collection(db, 'resumes'), docData);
      console.log('Document saved with ID:', docRef.id);
      
      setSaveSuccess(true);
      setStep('Data saved to Firebase successfully!');
    } catch (err) {
      console.error('Firebase save error:', err);
      setError(`Firebase Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container">
      <h1>HireLens - AI Driven Resume Analyzer</h1>

      <div className="section-box step1-box">
        <h5 className="section-title">Upload & Extract Text from Resume</h5>
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="file-input"
        />
        <button
          onClick={handleExtract}
          disabled={!file || loading}
          className={`btn extract-btn ${(!file || loading) ? 'disabled' : ''}`}
        >
          {loading && !extractedText ? 'Extracting...' : 'Extract Text'}
        </button>

        {file && (
          <p className="file-info">
            Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {step && (
        <div className="status-message success-message">
          {step}
        </div>
      )}

      {error && (
        <div className="status-message error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {extractedText && (
        <div className="extracted-section">
          <div className="preview-box">
            <h3 className="section-title">Extracted Text Preview</h3>
            <div className="text-preview">
              {extractedText.substring(0, 2000)}
              {extractedText.length > 2000 && '\n\n... (truncated for preview)'}
            </div>
            <p className="character-count">
              Total characters: {extractedText.length}
            </p>
          </div>

          <div className="section-box step2-box">
            <h5 className="section-title">GitHub Token & AI Processing</h5>
            
            <div className="warning-box">
              <p className="warning-text">
                <strong>⚠️ Warning:</strong> You are providing your GitHub token with your consent. 
                We are not responsible for any misuse of this token. Please ensure you trust this application.
              </p>
            </div>

            <div className="token-input-group">
              <label htmlFor="github-token" className="token-label">
                GitHub Personal Access Token:
              </label>
              <input
                id="github-token"
                type="password"
                placeholder="Enter your GitHub token"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="token-input"
              />
            </div>

            <button
              onClick={handleProcessWithAI}
              disabled={loading || !githubToken.trim()}
              className={`btn process-btn ${(loading || !githubToken.trim()) ? 'disabled' : ''}`}
            >
              {loading && extractedText ? 'Processing with AI...' : 'Format with Gemini AI'}
            </button>
          </div>
        </div>
      )}

      {content && (
        <div className="result-box">
          <h2 className="result-title">AI-Formatted Document Content:</h2>
          <div className="result-content">
            {JSON.stringify(content, null, 2)}
          </div>
          
          <button
            onClick={handleSaveToFirebase}
            disabled={saving}
            className={`btn save-btn ${saving ? 'disabled' : ''}`}
          >
            {saving ? 'Saving...' : 'Save to Firebase'}
          </button>

          {saveSuccess && (
            <div className="save-success-message">
              ✓ Successfully saved to Firebase!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;