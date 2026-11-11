import React, { useState } from 'react';
import { CompanyProfile, IvaQuincenaData, MONTH_NAMES } from '../types';
import { hasDemoOrSimulatorData } from '../utils/taxCalculations';
import {
  Building2,
  FileSpreadsheet,
  FileDown,
  Upload,
  Sparkles,
  Calendar,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Database,
  FolderArchive,
} from 'lucide-react';

interface CompanyHeaderProps {
  company: CompanyProfile;
  companies: CompanyProfile[];
  onSelectCompany: (id: string) => void;
  onOpenCompanyManager: () => void;
  onUpdateCompanyInfo: (razonSocial: string, rif: string, fiscalYear: number) => void;
  onOpenUploadModal: () => void;
  activeTab?: 'matrix' | 'archive' | 'audit' | 'guide';
  onSelectTab?: (tab: 'matrix' | 'archive' | 'audit' | 'guide') => void;
  onExportExcel: () => Promise<void> | void;
  onExportPdf: () => void;
  onLoadDemoData: () => void;
  onClearYear: () => void;
  selectedMonthFilter: number | null;
  onSelectMonthFilter: (m: number | null) => void;
  currentUserEmail?: string | null;
  onOpenAdminModal?: () => void;
  onSignInGoogle?: () => void;
}

export const CompanyHeader: React.FC<CompanyHeaderProps> = ({
  company,
  companies,
  onSelectCompany,
  onOpenCompanyManager,
  onUpdateCompanyInfo,
  onOpenUploadModal,
  activeTab = 'matrix',
  onSelectTab,
  onExportExcel,
  onExportPdf,
  onLoadDemoData,
  onClearYear,
  selectedMonthFilter,
  onSelectMonthFilter,
  currentUserEmail,
  onOpenAdminModal,
  onSignInGoogle,
}) => {
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [razonSocial, setRazonSocial] = useState(company.razonSocial);
  const [rif, setRif] = useState(company.rif);
  const [fiscalYear, setFiscalYear] = useState(company.fiscalYear);

  React.useEffect(() => {
    setRazonSocial(company.razonSocial);
    setRif(company.rif);
    setFiscalYear(company.fiscalYear);
  }, [company.razonSocial, company.rif, company.fiscalYear]);

  const handleSaveInfo = () => {
    onUpdateCompanyInfo(razonSocial, rif, fiscalYear);
    setIsEditingInfo(false);
  };

  const handleExportExcelWithLoading = async () => {
    try {
      setIsGeneratingExcel(true);
      await onExportExcel();
    } catch (e) {
      console.error('Error generando Excel:', e);
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <div className="w-full bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Top Row: Active Company & Year Context */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Active Company Info */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            {isEditingInfo ? (
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <input
                  type="text"
                  className="px-3 py-1 text-xs border border-zinc-300 rounded-lg font-semibold text-zinc-900 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Razón Social"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                />
                <input
                  type="text"
                  className="px-3 py-1 text-xs border border-zinc-300 rounded-lg font-mono text-zinc-900 focus:ring-2 focus:ring-emerald-500 w-32"
                  placeholder="RIF (ej. J-411499455)"
                  value={rif}
                  onChange={(e) => setRif(e.target.value)}
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-zinc-600">Año:</span>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-xs border border-zinc-300 rounded-lg font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  onClick={handleSaveInfo}
                  className="px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {companies.length > 1 ? (
                  <select
                    value={company.id}
                    onChange={(e) => onSelectCompany(e.target.value)}
                    className="text-base font-bold text-zinc-900 tracking-tight bg-zinc-50 hover:bg-zinc-100 border border-zinc-300 rounded-xl px-3 py-1 cursor-pointer focus:ring-2 focus:ring-emerald-500 max-w-xs sm:max-w-md truncate"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razonSocial} ({c.rif}) — Año {c.fiscalYear}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h1 className="text-base font-bold text-zinc-900 tracking-tight truncate">
                    {company.razonSocial}
                  </h1>
                )}

                <button
                  onClick={() => {
                    setRazonSocial(company.razonSocial);
                    setRif(company.rif);
                    setFiscalYear(company.fiscalYear);
                    setIsEditingInfo(true);
                  }}
                  className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
                  title="Editar Razón Social y RIF"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onOpenCompanyManager}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-950 text-white font-bold text-[11px] rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors ml-1"
                  title="Administrar o agregar múltiples empresas"
                >
                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Empresas ({companies.length})</span>
                </button>
              </div>
            )}

            {/* Unboxed Metadata Line */}
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1.5 flex-wrap">
              <span className="font-mono font-medium text-zinc-700">RIF: {company.rif}</span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <div className="flex items-center gap-1 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-200">
                <span className="font-bold text-emerald-900">Año Fiscal:</span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={company.fiscalYear}
                  onChange={(e) => {
                    const newY = Number(e.target.value);
                    if (newY >= 2000 && newY <= 2100) {
                      onUpdateCompanyInfo(company.razonSocial, company.rif, newY);
                    }
                  }}
                  className="w-16 px-1 py-0 text-xs font-black text-emerald-900 bg-white border border-emerald-300 rounded text-center focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              <span>24 Quincenas SENIAT</span>
              <span aria-hidden="true" className="text-zinc-300">·</span>
              {(() => {
                const isDemo = hasDemoOrSimulatorData(company.periodData);
                const hasRegisteredData = (Object.values(company.periodData || {}) as IvaQuincenaData[]).some(
                  (p: IvaQuincenaData) => (p.item40 || 0) > 0 || (p.item30 || 0) > 0 || Boolean(p.numeroDeclaracion)
                );
                if (isDemo) {
                  return <span className="text-pink-700 font-semibold">Simulación Demo</span>;
                }
                if (!hasRegisteredData) {
                  return <span className="text-emerald-700 font-semibold">Formato Limpio (0s)</span>;
                }
                return <span className="text-blue-700 font-semibold">Datos Registrados</span>;
              })()}
            </div>
          </div>
        </div>

        {/* Right: Admin Button */}
        <div className="flex items-center gap-2 shrink-0">
          {currentUserEmail?.toLowerCase() === 'sac1contable@gmail.com' ? (
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs rounded-xl shadow-2xs flex items-center gap-1.5 border border-amber-400 transition-colors"
              title="Panel DB Admin (sac1contable@gmail.com)"
            >
              <ShieldCheck className="w-4 h-4 text-zinc-950" />
              <span>🔑 Admin DB</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignInGoogle}
              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors border border-zinc-200"
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>{currentUserEmail ? currentUserEmail : 'Acceso Admin'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workflow Action Bar (Clear Visual Hierarchy) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* STEP 1: PROMINENT PRIMARY CTA */}
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2.5 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Upload className="w-4 h-4 text-emerald-100" />
            <span>1. Subir Planillas (PDF)</span>
          </button>

          {/* STEP 2: EXPORT ACTIONS */}
          <button
            type="button"
            disabled={isGeneratingExcel}
            onClick={handleExportExcelWithLoading}
            className={`px-4 py-2.5 text-white rounded-xl font-semibold text-xs flex items-center gap-2 shadow-2xs transition-all ${
              isGeneratingExcel
                ? 'bg-zinc-600 cursor-not-allowed opacity-80'
                : 'bg-zinc-900 hover:bg-zinc-950'
            }`}
            title="Descargar libro de cálculo Excel (.xlsx)"
          >
            <FileSpreadsheet className={`w-4 h-4 ${isGeneratingExcel ? 'animate-spin text-amber-300' : 'text-emerald-400'}`} />
            <span>{isGeneratingExcel ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={onExportPdf}
            className="px-3.5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-300 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Exportar informe en PDF"
          >
            <FileDown className="w-4 h-4 text-pink-600" />
            <span>PDF</span>
          </button>
        </div>

        {/* SECONDARY UTILITY OPTIONS DROPDOWN */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="px-3 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <span>••• Más Opciones</span>
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  onLoadDemoData();
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-pink-900 hover:bg-pink-50 flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                <span>Cargar Datos Demo</span>
              </button>
              <a
                href="/proyecto-iva-actualizado.zip"
                download="proyecto-iva-actualizado.zip"
                onClick={() => setShowMoreMenu(false)}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-50 flex items-center gap-2 border-t border-zinc-100"
              >
                <FolderArchive className="w-3.5 h-3.5 text-emerald-600" />
                <span>Descargar Código (ZIP)</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false);
                  onClearYear();
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 flex items-center gap-2 border-t border-zinc-100"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>Limpiar Formato (0s)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Month Filter Selector Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs border-t border-zinc-100 pt-3">
        <span className="text-zinc-400 font-medium text-[11px] shrink-0 mr-1 uppercase tracking-wider">
          Filtrar:
        </span>
        <button
          onClick={() => onSelectMonthFilter(null)}
          className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-colors shrink-0 ${
            selectedMonthFilter === null
              ? 'bg-zinc-900 text-white shadow-2xs'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
          }`}
        >
          Todo el Año (24Q)
        </button>

        {MONTH_NAMES.map((monthName, idx) => {
          const monthNum = idx + 1;
          const isSelected = selectedMonthFilter === monthNum;
          return (
            <button
              key={`filter-${monthNum}`}
              onClick={() => onSelectMonthFilter(isSelected ? null : monthNum)}
              className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors shrink-0 ${
                isSelected
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
              }`}
            >
              {monthName.substring(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

