import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#382c25',
              borderRadius: '12px',
              border: '1px solid #f1ded1',
              boxShadow: '0 4px 20px rgba(17,34,51,0.12)',
            },
            success: {
              iconTheme: { primary: '#0f8760', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#a32c2c', secondary: '#fff' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
