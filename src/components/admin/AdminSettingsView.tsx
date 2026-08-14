import React, { useState } from 'react';
import {
  UploadCloud,
  Save,
  ArrowLeft,
  Check,
  ChevronDown,
  Settings as SettingsIcon
} from 'lucide-react';

export const AdminSettingsView: React.FC = () => {
  const [regionName, setRegionName] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  return (
    <div className="w-full h-full bg-[#f4f5fa] p-6 overflow-y-auto max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            System Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register a new region in the system's jurisdiction.
          </p>
        </div>

        <button className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs cursor-pointer self-start sm:self-auto">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
          <span>Back to Settings</span>
        </button>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 animate-fade-in text-xs font-bold">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
          <span>Region configuration has been saved successfully!</span>
        </div>
      )}

      {/* Main Settings Form Card */}
      <form onSubmit={handleSave} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
        {/* Field 1: Region Name */}
        <div className="space-y-2">
          <label className="block text-xs font-extrabold text-slate-700 tracking-wider uppercase">
            REGION NAME
          </label>
          <input
            type="text"
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
            placeholder="e.g., Northern District, Central Area"
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white transition-all"
            required
          />
        </div>

        {/* Field 2: Category */}
        <div className="space-y-2">
          <label className="block text-xs font-extrabold text-slate-700 tracking-wider uppercase">
            CATEGORY
          </label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 pr-10 text-xs font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
              required
            >
              <option value="">Select a category</option>
              <option value="Traffic / Road">Traffic / Road</option>
              <option value="Environment / Sanitation">Environment / Sanitation</option>
              <option value="Architecture / Construction">Architecture / Construction</option>
              <option value="Facility Issue">Facility Issue</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Field 3: Attach Region Image or Map File */}
        <div className="space-y-2">
          <label className="block text-xs font-extrabold text-slate-700 tracking-wider uppercase">
            ATTACH REGION IMAGE OR MAP FILE
          </label>

          <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/*,.pdf"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-slate-900">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-extrabold text-slate-800">
                  Upload file or drag and drop
                </p>
                <p className="text-[11px] text-slate-400">
                  PNG, JPG, PDF up to 10MB
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setRegionName('');
              setCategory('');
              setSelectedFile(null);
            }}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#1a237e] hover:bg-blue-900 text-white shadow-md flex items-center gap-2 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      </form>
    </div>
  );
};
