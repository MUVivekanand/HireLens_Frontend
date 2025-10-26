import React from "react";
import { Link } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <span className="logo-text">HireLens</span>
        </div>
        <ul className="navbar-menu">
          <li className="navbar-item">
            <Link to="/" className="navbar-link">
              <span className="link-icon">🏠</span>
              <span className="link-text">Home</span>
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/getRanking" className="navbar-link">
              <span className="link-icon">📊</span>
              <span className="link-text">Skill Assessment</span>
            </Link>
          </li>
          <li className="navbar-item">
            <Link to="/contribution" className="navbar-link">
              <span className="link-icon">📈</span>
              <span className="link-text">Project Contribution Analysis</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}