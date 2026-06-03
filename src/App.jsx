import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Loader2, 
  Download, 
  CheckCircle2, 
  Trash2, 
  Settings, 
  AlertTriangle, 
  Key, 
  Eye, 
  EyeOff, 
  Layers, 
  Fuel, 
  Activity, 
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { parseDocument } from './utils/scanner';
import { exportToExcel } from './utils/excel';
import './App.css';

export default function App() {
  // --- State Hooks ---
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [records, setRecords] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [processStatus, setProcessStatus] = useState({
    status: 'idle', // 'idle' | 'running' | 'success' | 'error'
    stage: '',
    message: '',
    progress: 0
  });
  const [availableModels, setAvailableModels] = useState(['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']);
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  // --- Load Initial State ---
  useEffect(() => {
    // Load API Key
    const savedKey = localStorage.getItem('gemini_api_key') || '';
    if (savedKey) {
      setApiKey(savedKey);
      fetchAvailableModels(savedKey);
    } else {
      // Fallback to Vite env variables if set in production (Vercel)
      const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      if (envKey) {
        setApiKey(envKey);
        fetchAvailableModels(envKey);
      } else {
        // Query models via server-side key fallback
        fetchAvailableModels('');
      }
    }

    // Load Records
    const savedRecords = localStorage.getItem('ocr_invoice_records');
    if (savedRecords) {
      try {
        setRecords(JSON.parse(savedRecords));
      } catch (err) {
        console.error('Failed parsing saved records', err);
      }
    }
  }, []);

  const fetchAvailableModels = async (key) => {
    try {
      const url = key ? `/api/models?clientApiKey=${key}` : '/api/models';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          const list = data.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace('models/', ''));
          if (list.length > 0) {
            setAvailableModels(list);
            // Default to gemini-1.5-flash if available, else pick the first
            setSelectedModel(prev => {
              if (list.includes(prev)) return prev;
              return list.includes('gemini-1.5-flash') ? 'gemini-1.5-flash' : list[0];
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed listing available models', err);
    }
  };

  // --- Save State to Storage ---
  const saveRecords = (newRecords) => {
    setRecords(newRecords);
    localStorage.setItem('ocr_invoice_records', JSON.stringify(newRecords));
  };

  const handleApiKeyChange = (e) => {
    const val = e.target.value.trim();
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
    if (val) {
      fetchAvailableModels(val);
    }
  };

  // --- Drag and Drop File Handlers ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    setErrorMsg('');

    const files = Array.from(e.dataTransfer.files);
    const allowedFiles = files.filter(file => file.type === 'application/pdf' || file.type.startsWith('image/'));

    if (allowedFiles.length === 0) {
      setErrorMsg('Please upload a valid PDF document or Image (JPG/PNG).');
      return;
    }

    // Process first file
    processFile(allowedFiles[0]);
  };

  const handleFileSelect = (e) => {
    setErrorMsg('');
    const files = Array.from(e.target.files);
    const allowedFiles = files.filter(file => file.type === 'application/pdf' || file.type.startsWith('image/'));

    if (allowedFiles.length === 0) {
      setErrorMsg('Please upload a valid PDF document or Image (JPG/PNG).');
      return;
    }

    processFile(allowedFiles[0]);
  };

  // --- Core Processing Logic ---
  const processFile = async (file) => {
    setErrorMsg('');

    setProcessStatus({
      status: 'running',
      stage: 'INIT',
      message: 'Initializing parser...',
      progress: 5
    });

    try {
      // Run unified document parser
      const data = await parseDocument(file, apiKey, (progressObj) => {
        setProcessStatus({
          status: 'running',
          stage: progressObj.stage,
          message: progressObj.message,
          progress: progressObj.progress
        });
      }, selectedModel);

      // Save Record
      const newRecord = {
        id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        fileName: file.name,
        supplier_name: data.supplier_name,
        bill_number: data.bill_number,
        bill_date: data.bill_date,
        amount: data.amount,
        expense_type: data.expense_type || 'Fuel Bill'
      };

      saveRecords([newRecord, ...records]);
      
      setProcessStatus({
        status: 'success',
        stage: 'COMPLETE',
        message: 'Successfully processed: ' + file.name,
        progress: 100
      });

      // Clear file inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Auto clear success indicator after 3 seconds
      setTimeout(() => {
        setProcessStatus(prev => prev.status === 'success' ? { status: 'idle', stage: '', message: '', progress: 0 } : prev);
      }, 3000);

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during document extraction.');
      setProcessStatus({
        status: 'error',
        stage: 'FAILED',
        message: 'Extraction failed.',
        progress: 0
      });
    }
  };

  // --- Inline Edit Handlers ---
  const handleUpdateRecord = (id, field, value) => {
    const updated = records.map(rec => {
      if (rec.id === id) {
        return { ...rec, [field]: value };
      }
      return rec;
    });
    saveRecords(updated);
  };

  // --- Action Handlers ---
  const handleDeleteRecord = (id) => {
    const updated = records.filter(rec => rec.id !== id);
    saveRecords(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all scanned bills?')) {
      saveRecords([]);
    }
  };

  const handleExport = () => {
    try {
      exportToExcel(records, 'Invoice_Expense_Report.xlsx');
    } catch (err) {
      setErrorMsg('Excel export failed: ' + err.message);
    }
  };

  // --- Calculated Metrics ---
  const totalAmount = records.reduce((acc, rec) => {
    const amt = parseFloat(rec.amount);
    return isNaN(amt) ? acc : acc + amt;
  }, 0);

  const fuelBillsCount = records.filter(r => r.expense_type === 'Fuel Bill').length;
  const medicalBillsCount = records.filter(r => r.expense_type === 'Medical Bill').length;

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="logo-section">
          <span className="logo-icon">
            <Sparkles size={22} />
          </span>
          <span className="logo-text">Expense OCR AI</span>
        </div>

        {/* API Settings Section */}
        <div className="sidebar-card">
          <div className="sidebar-card-title">
            <Key size={16} className="text-secondary" />
            <span>API Integration</span>
          </div>
          <div className="api-key-input-wrapper">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="Enter Gemini API Key"
              className="api-key-input"
            />
            <button 
              type="button" 
              className="toggle-pwd-btn" 
              onClick={() => setShowApiKey(!showApiKey)}
              title={showApiKey ? 'Hide Key' : 'Show Key'}
            >
              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          {availableModels.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Model Profile</label>
              <select
                className="expense-type-select"
                style={{ width: '100%', padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)' }}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <p className="upload-text-sub" style={{ fontSize: '0.75rem', marginTop: '-4px' }}>
            Enter your Google Gemini API Key to enable OCR/Extraction. It remains saved in local storage.
          </p>
        </div>

        {/* Metrics Summary Section */}
        <div className="sidebar-card">
          <div className="sidebar-card-title">
            <Layers size={16} className="text-secondary" />
            <span>Expense Summary</span>
          </div>
          <div className="metrics-grid">
            <div className="metric-row">
              <span className="metric-label">Total Amount</span>
              <span className="metric-value">₹ {totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Total Bills</span>
              <span className="metric-value">{records.length}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Fuel size={14} className="metric-value fuel" /> Fuel Bills
              </span>
              <span className="metric-value fuel">{fuelBillsCount}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Activity size={14} className="metric-value medical" /> Medical Bills
              </span>
              <span className="metric-value medical">{medicalBillsCount}</span>
            </div>
          </div>
        </div>

        {/* Quick Instructions */}
        <div className="sidebar-card" style={{ marginTop: 'auto', background: 'transparent', borderStyle: 'dashed' }}>
          <span className="sidebar-card-title" style={{ fontSize: '0.8rem' }}>Instructions</span>
          <ol style={{ paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Provide a Gemini API Key.</li>
            <li>Drag & drop a bill PDF or image.</li>
            <li>Verify extracted fields in the table.</li>
            <li>Export the dataset to an Excel document.</li>
          </ol>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-dashboard">
        <header className="dashboard-header">
          <div className="header-title-sec">
            <h1>OCR Bill Processing Hub</h1>
            <p>Convert unstructured PDF files and invoice images into clean, structured accounting spreadsheets instantly.</p>
          </div>
        </header>

        {/* API Key Missing Alert */}
        {!apiKey && (
          <div className="api-warning-banner" style={{ border: '1px solid rgba(16, 185, 129, 0.2)', background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.05), rgba(99, 102, 241, 0.02))' }}>
            <div className="api-warning-content">
              <Sparkles size={20} className="metric-value medical" />
              <div>
                <strong>Server Key Active:</strong> The scanner is running in global secure mode. Custom API key configuration is optional.
              </div>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        <div 
          className={`dropzone-container ${isDragActive ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="application/pdf, image/*" 
            className="file-input-hidden" 
          />
          <div className="upload-circle">
            <Upload size={28} />
          </div>
          <div className="upload-text">
            <p className="upload-text-highlight">Drag & drop your expense PDF or Image here, or click to browse</p>
            <p className="upload-text-sub">Supports PDFs, screenshots, photos, and scanned bills (automatic OCR)</p>
          </div>
        </div>

        {/* Processing Indicator Card */}
        {processStatus.status === 'running' && (
          <div className="process-indicator-card">
            <div className="process-header">
              <div className="process-title">
                <Loader2 className="animate-spin text-secondary" size={18} style={{ animation: 'spin 1.5s linear infinite' }} />
                <span>Extracting invoice metadata...</span>
              </div>
              <span className="process-status-badge">{processStatus.stage}</span>
            </div>
            
            <div className="progressbar-bg">
              <div 
                className="progressbar-fill" 
                style={{ width: `${processStatus.progress}%` }}
              ></div>
            </div>
            
            <div className="process-steps-list">
              <div className={`process-step ${processStatus.progress >= 40 ? 'completed' : 'active'}`}>
                <span className="step-icon-dot"></span>
                <span>PDF Reading</span>
              </div>
              <div className={`process-step ${processStatus.progress >= 85 ? 'completed' : processStatus.stage.startsWith('OCR') ? 'active' : ''}`}>
                <span className="step-icon-dot"></span>
                <span>OCR Text Mapping</span>
              </div>
              <div className={`process-step ${processStatus.progress === 100 ? 'completed' : processStatus.stage === 'AI_EXTRACTION' ? 'active' : ''}`}>
                <span className="step-icon-dot"></span>
                <span>AI Data Structured Output</span>
              </div>
            </div>
            
            <p className="upload-text-sub" style={{ fontStyle: 'italic' }}>
              Current Step: {processStatus.message}
            </p>
          </div>
        )}

        {/* Success / Error Messages Banner */}
        {processStatus.status === 'success' && (
          <div className="error-banner" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#a7f3d0' }}>
            <CheckCircle2 size={18} />
            <span>{processStatus.message}</span>
          </div>
        )}

        {errorMsg && (
          <div className="error-banner">
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results / Scans Area */}
        <section className="results-card">
          <div className="results-card-header">
            <div className="results-title-group">
              <h2>Parsed Invoices & Receipts</h2>
              <p>Values can be edited inline. Changes are autosaved to local storage.</p>
            </div>
            {records.length > 0 && (
              <div className="results-action-btn-group">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleClearAll}
                  title="Clear all records"
                >
                  <Trash2 size={15} /> Clear All
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleExport}
                >
                  <FileSpreadsheet size={15} /> Export to Excel
                </button>
              </div>
            )}
          </div>

          {records.length === 0 ? (
            <div className="empty-state-container">
              <FileText className="empty-state-icon" size={48} />
              <p style={{ fontWeight: 500 }}>No bills uploaded yet</p>
              <p className="upload-text-sub">Upload a PDF invoice above to view extracted items.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th style={{ width: '8%' }}>S.No</th>
                    <th style={{ width: '22%' }}>Supplier Name</th>
                    <th style={{ width: '15%' }}>Bill Number</th>
                    <th style={{ width: '15%' }}>Bill Date</th>
                    <th style={{ width: '15%' }}>Amount</th>
                    <th style={{ width: '15%' }}>Expense Type</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, index) => (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600 }}>{index + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={rec.supplier_name}
                          onChange={(e) => handleUpdateRecord(rec.id, 'supplier_name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={rec.bill_number}
                          onChange={(e) => handleUpdateRecord(rec.id, 'bill_number', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="table-input"
                          value={rec.bill_date}
                          onChange={(e) => handleUpdateRecord(rec.id, 'bill_date', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={rec.amount}
                          onChange={(e) => handleUpdateRecord(rec.id, 'amount', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="expense-type-select"
                          value={rec.expense_type}
                          onChange={(e) => handleUpdateRecord(rec.id, 'expense_type', e.target.value)}
                        >
                          <option value="Fuel Bill">Fuel Bill</option>
                          <option value="Medical Bill">Medical Bill</option>
                        </select>
                      </td>
                      <td style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <button 
                          className="action-icon-btn delete" 
                          onClick={() => handleDeleteRecord(rec.id)}
                          title="Delete record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        
        {/* Footer info */}
        <footer className="footer">
          <p>© {new Date().getFullYear()} Expense OCR AI. Powered by Google Gemini 1.5 Flash and Tesseract.js.</p>
        </footer>
      </main>
    </div>
  );
}
