import { useState, useEffect } from 'react';
import {
  Database, UploadCloud, CheckCircle2, AlertTriangle,
  FileSpreadsheet, ArrowRight, ShieldAlert, Cpu, HardDrive
} from 'lucide-react';
import { datasetApi } from '../api/client';
import type { Dataset, DatasetValidation } from '../types';
import { useToast } from '../App';

export default function DatasetModelLab() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);

  // File Upload & Validation
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<DatasetValidation | null>(null);

  // Import Meta
  const [datasetName, setDatasetName] = useState('');
  const [datasetVersion, setDatasetVersion] = useState('1.0.0');
  const [source, setSource] = useState('');
  const [licenseInfo, setLicenseInfo] = useState('');
  const [importing, setImporting] = useState(false);

  const { addToast } = useToast();

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const resp = await datasetApi.list();
      setDatasets(resp.data);
    } catch (err: any) {
      addToast(err.message || 'Failed to load datasets', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setDatasetName(f.name.replace(/\.[^/.]+$/, ''));
      setValidationResult(null);
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setValidating(true);
    try {
      const resp = await datasetApi.validate(file);
      setValidationResult(resp.data);
      if (resp.data.valid) {
        addToast('Dataset passed format validation!', 'success');
      } else {
        addToast('Validation issues identified.', 'warning');
      }
    } catch (err: any) {
      addToast(err.message || 'Validation failed', 'error');
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !datasetName) return;
    setImporting(true);
    try {
      await datasetApi.import(file, {
        name: datasetName,
        version: datasetVersion,
        source: source || undefined,
        license_info: licenseInfo || undefined,
      });
      addToast('Dataset successfully imported into pipeline!', 'success');
      setFile(null);
      setValidationResult(null);
      setDatasetName('');
      setSource('');
      setLicenseInfo('');
      fetchDatasets();
    } catch (err: any) {
      addToast(err.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-glow-purple">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Dataset &amp; Model Lab</h1>
            <p className="text-sm text-slate-400">
              Corpus ingestion, annotation schema verification, and model training lifecycle management.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload & Validation */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glow p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              Ingest Corpus (CSV / JSONL)
            </h2>
            <p className="text-xs text-slate-400">
              Upload multi-label moderation datasets. Target schema requires <code>text</code> and <code>label</code> columns, with optional <code>language</code> metadata.
            </p>

            <div className="border-2 border-dashed border-indigo-900/60 rounded-xl p-6 text-center hover:border-indigo-600/50 transition-colors bg-navy-900/40">
              <input
                type="file"
                accept=".csv,.jsonl,.json"
                onChange={handleFileChange}
                className="hidden"
                id="dataset-upload"
              />
              <label htmlFor="dataset-upload" className="cursor-pointer flex flex-col items-center">
                <FileSpreadsheet className="w-10 h-10 text-indigo-400 mb-2 opacity-80" />
                <span className="text-xs font-semibold text-slate-200">
                  {file ? file.name : 'Select CSV or JSONL corpus file'}
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  Supported formats: UTF-8 CSV, JSONL up to 50MB
                </span>
              </label>
            </div>

            {file && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400 font-mono">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={validating}
                  className="btn-primary text-xs"
                >
                  {validating ? 'Validating Schema...' : 'Validate Corpus Format'}
                </button>
              </div>
            )}

            {/* Validation Outcome Panel */}
            {validationResult && (
              <div className="p-4 rounded-lg bg-navy-900/70 border border-indigo-900/40 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold">
                    {validationResult.valid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">Format Validated</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300">Validation Flags Detected</span>
                      </>
                    )}
                  </div>
                  <span className="text-slate-400">Total Rows: {validationResult.total_rows}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="p-2 bg-navy-800 rounded">Missing Values: <strong className="text-white">{validationResult.missing_values}</strong></div>
                  <div className="p-2 bg-navy-800 rounded">Duplicates: <strong className="text-white">{validationResult.duplicate_count}</strong></div>
                  <div className="p-2 bg-navy-800 rounded">Classes: <strong className="text-white">{Object.keys(validationResult.label_distribution || {}).length}</strong></div>
                  <div className="p-2 bg-navy-800 rounded">Languages: <strong className="text-white">{Object.keys(validationResult.language_distribution || {}).length}</strong></div>
                </div>

                {validationResult.warnings.length > 0 && (
                  <div className="text-[11px] text-amber-300 space-y-0.5">
                    {validationResult.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                  </div>
                )}

                {/* Import Submission Form */}
                {validationResult.valid && (
                  <form onSubmit={handleImport} className="pt-3 border-t border-indigo-900/40 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Dataset Name *</label>
                        <input
                          type="text"
                          required
                          value={datasetName}
                          onChange={e => setDatasetName(e.target.value)}
                          className="input-field text-xs"
                        />
                      </div>
                      <div>
                        <label className="label">Version</label>
                        <input
                          type="text"
                          value={datasetVersion}
                          onChange={e => setDatasetVersion(e.target.value)}
                          className="input-field text-xs"
                        />
                      </div>
                      <div>
                        <label className="label">Origin / Source</label>
                        <input
                          type="text"
                          value={source}
                          onChange={e => setSource(e.target.value)}
                          placeholder="e.g. HateXplain, HASOC 2021"
                          className="input-field text-xs"
                        />
                      </div>
                      <div>
                        <label className="label">License Info</label>
                        <input
                          type="text"
                          value={licenseInfo}
                          onChange={e => setLicenseInfo(e.target.value)}
                          placeholder="e.g. CC-BY 4.0, Non-commercial"
                          className="input-field text-xs"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={importing}
                      className="btn-primary w-full text-xs py-2"
                    >
                      {importing ? 'Registering Corpus...' : 'Import into Dataset Registry'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Registered Datasets List */}
          <div className="card-glow p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              Registered Datasets &amp; Partitions
            </h2>

            {loading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-14 w-full" />)}
              </div>
            ) : datasets.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No datasets registered yet.</p>
            ) : (
              <div className="space-y-3">
                {datasets.map(ds => (
                  <div key={ds.id} className="p-3 rounded-lg bg-navy-900/50 border border-indigo-900/30 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white">
                        {ds.name} <span className="text-[10px] text-slate-500 font-mono">v{ds.version}</span>
                      </div>
                      <span className="badge bg-indigo-900/40 text-indigo-300 border border-indigo-700/40">
                        {ds.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400">
                      <div>Total: <span className="text-slate-200">{ds.total_records}</span></div>
                      <div>Train Split: <span className="text-slate-200">{ds.train_count}</span></div>
                      <div>Val Split: <span className="text-slate-200">{ds.val_count}</span></div>
                      <div>Test Split: <span className="text-slate-200">{ds.test_count}</span></div>
                    </div>

                    {ds.source && (
                      <div className="text-[10px] text-slate-500">
                        Source: {ds.source} {ds.license_info && `• License: ${ds.license_info}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Model Architecture & Training Spec */}
        <div className="space-y-6">
          <div className="card-glow p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              Model Architecture Status
            </h3>

            <div className="p-3 bg-navy-900/60 rounded-lg border border-indigo-900/30 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Active Engine:</span>
                <span className="font-semibold text-amber-400">Rule-Based Baseline</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Model:</span>
                <span className="font-semibold text-purple-300">XLM-RoBERTa-base</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Output Heads:</span>
                <span className="font-semibold text-slate-200">3-Head Binary Multi-Label</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Loss Function:</span>
                <span className="font-mono text-slate-300">BCEWithLogitsLoss</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-400">
              <h4 className="font-semibold text-slate-300">Training Prerequisites</h4>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-400">
                <li>Minimum 5,000 balanced annotations across target scripts</li>
                <li>Transliterated Telugu/Kannada training split</li>
                <li>GPU environment with &gt;= 12GB VRAM or FP16 quantization</li>
              </ul>
            </div>
          </div>

          <div className="card p-4 space-y-2 text-xs text-slate-400">
            <h4 className="font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              Ethics &amp; License Compliance
            </h4>
            <p className="text-[11px] leading-relaxed">
              Ensure all imported data adheres to platform TOS and academic licensing agreements (e.g. non-redistribution of Twitter raw user identifiers). All datasets are stored locally in the isolated workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
