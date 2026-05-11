import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  // eslint-disable-next-line no-console
  console.error('Missing REACT_APP_CLERK_PUBLISHABLE_KEY — add it to bibi_hackathon/.env and restart npm start.');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY || ''}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);

reportWebVitals();
