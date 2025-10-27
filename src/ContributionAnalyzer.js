import React, { useState } from 'react';
import { db } from './firebase'; // Adjust the path based on your firebase config file location
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ContributionAnalyzer() {
  const [resumeUsername, setResumeUsername] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingResume, setFetchingResume] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleFetchResume = async () => {
    if (!resumeUsername.trim()) {
      setError('Please enter a resume username');
      return;
    }

    setFetchingResume(true);
    setError(null);
    setProjects([]);
    setSelectedProject('');

    try {
      const fileName = `${resumeUsername}.docx`;
      
      // Query Firestore for the resume document
      const resumesRef = collection(db, 'resumes');
      const q = query(resumesRef, where('fileName', '==', fileName));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError(`No resume found for username: ${resumeUsername}`);
        setFetchingResume(false);
        return;
      }

      // Get the first matching document
      const resumeDoc = querySnapshot.docs[0];
      const resumeData = resumeDoc.data();

      if (resumeData.projects && Array.isArray(resumeData.projects)) {
        setProjects(resumeData.projects);
        if (resumeData.projects.length > 0) {
          setSelectedProject(resumeData.projects[0]);
        }
      } else {
        setError('No projects found in the resume');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch resume data');
      console.error('Error fetching resume:', err);
    } finally {
      setFetchingResume(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedProject.trim() || !authorName.trim() || !ownerName.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const backendUrl = 'https://hire-lens-backend.vercel.app/api/analyze-contribution';
      
      const result = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: selectedProject,
          author: authorName,
          owner: ownerName,
        }),
      });

      if (!result.ok) {
        throw new Error(`API Error: ${result.statusText}`);
      }

      const data = await result.json();
      console.log('Backend Response:', data);
      setResponse(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch data. Make sure backend is running.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', marginBottom: '10px' }}>
            Contribution Analyzer
          </h1>
          <p style={{ color: '#94a3b8' }}>Analyze GitHub author contributions with AI-powered insights</p>
        </div>

        {/* Resume Username Section */}
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '30px', marginBottom: '30px', border: '1px solid #334155' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginBottom: '20px' }}>
            Step 1: Fetch Projects from Resume
          </h3>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#cbd5e1', marginBottom: '8px' }}>
                Enter Resume Username
              </label>
              <input
                type="text"
                value={resumeUsername}
                onChange={(e) => setResumeUsername(e.target.value)}
                placeholder="e.g., john_doe"
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  background: '#334155', 
                  border: '1px solid #475569', 
                  borderRadius: '8px', 
                  color: 'white', 
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={handleFetchResume}
                disabled={fetchingResume}
                style={{ 
                  background: fetchingResume ? '#475569' : '#7c3aed', 
                  color: 'white', 
                  fontWeight: '500', 
                  padding: '10px 24px', 
                  borderRadius: '8px', 
                  border: 'none',
                  cursor: fetchingResume ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                {fetchingResume ? 'Fetching...' : 'Fetch Projects'}
              </button>
            </div>
          </div>
          
          {projects.length > 0 && (
            <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid #7c3aed', borderRadius: '8px', padding: '15px' }}>
              <p style={{ color: '#a78bfa', fontSize: '14px', marginBottom: '8px' }}>
                ✓ Found {projects.length} project(s)
              </p>
              <div style={{ color: '#c4b5fd', fontSize: '13px' }}>
                {projects.map((project, index) => (
                  <span key={index}>
                    {project}
                    {index < projects.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '30px', marginBottom: '30px', border: '1px solid #334155' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginBottom: '20px' }}>
            Step 2: Analyze Contribution
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#cbd5e1', marginBottom: '8px' }}>
                Project Name
              </label>
              {projects.length > 0 ? (
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px', 
                    background: '#334155', 
                    border: '1px solid #475569', 
                    borderRadius: '8px', 
                    color: 'white', 
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {projects.map((project, index) => (
                    <option key={index} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  placeholder="Fetch projects first or enter manually"
                  style={{ 
                    width: '100%', 
                    padding: '10px 14px', 
                    background: '#334155', 
                    border: '1px solid #475569', 
                    borderRadius: '8px', 
                    color: 'white', 
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#cbd5e1', marginBottom: '8px' }}>
                Author Name
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g., AuthorName"
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  background: '#334155', 
                  border: '1px solid #475569', 
                  borderRadius: '8px', 
                  color: 'white', 
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#cbd5e1', marginBottom: '8px' }}>
                Owner Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g., ProjectOwner"
                style={{ 
                  width: '100%', 
                  padding: '10px 14px', 
                  background: '#334155', 
                  border: '1px solid #475569', 
                  borderRadius: '8px', 
                  color: 'white', 
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{ 
              width: '100%', 
              background: loading ? '#475569' : '#2563eb', 
              color: 'white', 
              fontWeight: '500', 
              padding: '14px', 
              borderRadius: '8px', 
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'Analyzing...' : 'Analyze Contribution'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ background: '#7f1d1d', border: '1px solid #991b1b', color: '#fecaca', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ fontWeight: '500', marginBottom: '5px' }}>Error</p>
            <p style={{ fontSize: '14px' }}>{error}</p>
          </div>
        )}

        {/* Response Section */}
        {response && (
          <div>
            {/* Success Status */}
            <div style={{ background: 'rgba(6, 78, 59, 0.3)', border: '1px solid #15803d', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <p style={{ color: '#86efac', fontWeight: '500', marginBottom: '5px' }}>✓ Analysis Complete</p>
              <p style={{ color: '#4ade80', fontSize: '14px' }}>AI-powered contribution analysis</p>
            </div>

            {/* Agent Response */}
            <div style={{ background: '#1e293b', borderRadius: '12px', padding: '30px', border: '1px solid #334155' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'white', marginBottom: '20px' }}>
                Analysis Result
              </h3>
              <div style={{ background: 'rgba(51, 65, 85, 0.5)', borderRadius: '8px', padding: '24px' }}>
                <pre style={{ 
                  color: '#e2e8f0', 
                  fontSize: '15px', 
                  lineHeight: '1.6', 
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  margin: 0
                }}>
                  {response}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder */}
        {!response && !loading && (
          <div style={{ background: '#1e293b', borderRadius: '12px', padding: '60px', border: '2px dashed #334155', textAlign: 'center' }}>
            <p style={{ color: '#64748b', fontSize: '16px' }}>Enter resume username to fetch projects, then analyze contributions</p>
          </div>
        )}
      </div>
    </div>
  );
}