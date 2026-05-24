import React from 'react';
import GTDInbox from '../components/GTDInbox';

export default function GTDPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h2>GTD Intake & Triage</h2>
        <p className="page-description">Rapidly capture ideas and process them into actionable steps.</p>
      </div>
      <GTDInbox />
    </div>
  );
}
