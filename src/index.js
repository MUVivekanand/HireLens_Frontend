import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import GetRanking from "../src/GetRanking.js";
import Navbar from "../src/Navbar.js";
import ContributionAnalyzer from './ContributionAnalyzer.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Router>
      <Navbar />
       <div className="p-4">
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/getRanking" element={<GetRanking />} />
        <Route path="/contribution" element={<ContributionAnalyzer />} />
      </Routes>
      </div>
    </Router>
  </React.StrictMode>
);

// For performance monitoring
reportWebVitals();

