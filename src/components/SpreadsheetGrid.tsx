import React, { useState, useRef, useEffect } from 'react';
import { CompanyProfile, IvaQuincenaData, MONTH_NAMES } from '../types';
import {
  formatCurrency,
  generatePeriodKey,
  parseCurrencyInput,
  SPREADSHEET_ROWS,
  auditPeriodHealth,
  recalculateSingleQuincena,
  reconcileAnnualContinuity,
} from '../utils/taxCalculations';
import {
  Edit3,
  Check,
  FileText,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ChevronRight,
} from 'lucide-react';

interface SpreadsheetGridProps {
  company: CompanyProfile;
  onUpdateQuincena: (quincenaData: IvaQuincenaData) => void;
  onOpenQuincenaModal: (quincenaData: IvaQuincenaData) => void;
  onReconcileAll?: () => void;
  selectedMonthFilter?: number | null; // null = all months, 1-12 = single month
}

// Cross-validation function to check if cell value reconciles with details/totals in SENIAT declaration
export function validateCellReconciliation(
  rowId: string,
  qData: IvaQuincenaData | undefined
): { isError: boolean; reason?: string } {
  if (!qData) return { isError: false };

  const hasAnyData =
    qData.item40 > 0 ||
    qData.item42 > 0 ||
    qData.item30 > 0 ||
    qData.item33 > 0 ||
    qData.item47 > 0 ||
    qData.item39 > 0 ||
    Boolean(qData.fileName);
  if (!hasAnyData) return { isError: false };

  // Rule 1: Item 47 (Total Débito Fiscal) vs sum of Débitos (Item 43 + Item 443)
  if (rowId === 'item47') {
    const expectedDebito = Math.round(((qData.item43 || 0) + (qData.item443 || 0)) * 100) / 100;
    if ((qData.item47 > 0 || expectedDebito > 0) && Math.abs(qData.item47 - expectedDebito) > 1.0) {
      return {
        isError: true,
        reason: `Descuadre en Débito Fiscal: Item 47 (Bs. ${formatCurrency(qData.item47)}) no coincide con la suma de débitos (Bs. ${formatCurrency(expectedDebito)}).`,
      };
    }
  }

  // Rule 2: Item 35 (TOTAL COMPRAS) vs sum of Compras (Item 30 + Item 33 + Item 333 + Item 31)
  if (rowId === 'item35') {
    const expectedCompras = Math.round(((qData.item30 || 0) + (qData.item33 || 0) + (qData.item333 || 0) + (qData.item31 || 0)) * 100) / 100;
    if ((qData.item35 > 0 || expectedCompras > 0) && Math.abs((qData.item35 || 0) - expectedCompras) > 1.0) {
      return {
        isError: true,
        reason: `Descuadre en Compras: Item 35 (Bs. ${formatCurrency(qData.item35)}) no coincide con la suma de compras exentas y gravadas (Bs. ${formatCurrency(expectedCompras)}).`,
      };
    }
  }

  // Rule 3: Item 71 (Total Créditos Deducibles) vs Item 70 + Item 37
  if (rowId === 'item71') {
    const expectedCredDeduc = Math.round(((qData.item70 || 0) + (qData.item37 || 0)) * 100) / 100;
    if ((qData.item71 > 0 || expectedCredDeduc > 0) && Math.abs((qData.item71 || 0) - expectedCredDeduc) > 1.0) {
      return {
        isError: true,
        reason: `Descuadre en Créditos Deducibles: Item 71 (Bs. ${formatCurrency(qData.item71)}) no coincide con Item 70 + Item 37 (Bs. ${formatCurrency(expectedCredDeduc)}).`,
      };
    }
  }

  // Rule 4: Item 39 (Total Créditos del Mes) vs Item 71 + Item 20 + Item 38
  if (rowId === 'item39') {
    const expectedCredTotal = Math.round(((qData.item71 || 0) + (qData.item20 || 0) + (qData.item38 || 0)) * 100) / 100;
    if ((qData.item39 > 0 || expectedCredTotal > 0) && Math.abs((qData.item39 || 0) - expectedCredTotal) > 1.0) {
      return {
        isError: true,
        reason: `Descuadre en Créditos Totales: Item 39 (Bs. ${formatCurrency(qData.item39)}) no coincide con Item 71 + Item 20 + Item 38 (Bs. ${formatCurrency(expectedCredTotal)}).`,
      };
    }
  }

  // Rule 5: Item 53 (Cuota Tributaria) & Item 60 (Excedente)
  if (rowId === 'item53') {
    const deb = qData.item47 || 0;
    const cred = qData.item39 || 0;
    const expectedCuota = deb > cred ? Math.round((deb - cred) * 100) / 100 : 0;
    if ((qData.item53 > 0 || expectedCuota > 0) && Math.abs((qData.item53 || 0) - expectedCuota) > 1.0) {
      return {
        isError: true,
        reason: `Descuadre en Cuota Tributaria: Item 53 (Bs. ${formatCurrency(qData.item53)}) no coincide con Débitos - Créditos (Bs. ${formatCurrency(expectedCuota)}).`,
      };
    }
  }

  if (rowId === 'item60') {
    const deb = qData.item47 || 0;
    const cred = qData.item39 || 0;
    const expectedExcedente = cred > deb ? Math.round((cred - deb) * 100) / 100 : 0;
    if ((qData.item60 > 0 || expectedExcedente > 0) && Math.abs((qData.item60 || 0) - expectedExcedente) > 1.0) {
      return {
        isError: true,
        reason: `Descuadre en Excedente: Item 60 (Bs. ${formatCurrency(qData.item60)}) no coincide con Créditos - Débitos (Bs. ${formatCurrency(expectedExcedente)}).`,
      };
    }
  }

  // Rule 6: Item 90 (TOTAL A PAGAR) vs Item 53 - (Item 54 + Item 66)
  if (rowId === 'item90') {
    const cuota = qData.item53 || 0;
    const retenciones = Math.round(((qData.item54 || 0) + (qData.item66 || 0)) * 100) / 100;
    const expectedPagar = cuota > retenciones ? Math.round((cuota - retenciones) * 100) / 100 : 0;
    if ((qData.item90 > 0 || expectedPagar > 0) && Math.abs((qData.item90 || 0) - expectedPagar) > 1.0) {
      return {
        isError: true,
        reason: `Descuadre en Total a Pagar: Item 90 (Bs. ${formatCurrency(qData.item90)}) no coincide con Cuota Tributaria - Retenciones (Bs. ${formatCurrency(expectedPagar)}).`,
      };
    }
  }

  return { isError: false };
}

export const SpreadsheetGrid: React.FC<SpreadsheetGridProps> = ({
  company,
  onUpdateQuincena,
  onOpenQuincenaModal,
  onReconcileAll,
  selectedMonthFilter = null,
}) => {
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    periodKey: string;
    value: string;
  } | null>(null);

  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compute real-time audit health
  const health = auditPeriodHealth(company.fiscalYear, company.periodData);

  // Determine months to display
  const monthsToDisplay = selectedMonthFilter
    ? [selectedMonthFilter]
    : Array.from({ length: 12 }, (_, i) => i + 1);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell?.rowId, editingCell?.periodKey]);

  // Handle cell edit save with instant SENIAT formula recalculation
  const handleSaveCell = (moveDirection?: 'down' | 'right') => {
    if (!editingCell) return;
    const { rowId, periodKey, value } = editingCell;
    const numericValue = parseCurrencyInput(value);

    const quincenaData = company.periodData[periodKey];
    if (quincenaData) {
      const updated = { ...quincenaData };
      const rowConfig = SPREADSHEET_ROWS.find((r) => r.id === rowId);
      if (rowConfig && rowConfig.setValue) {
        rowConfig.setValue(updated, numericValue);
        // Automatically calibrate all dependent fields for this quincena
        const calibrated = recalculateSingleQuincena(updated);
        onUpdateQuincena(calibrated);
      }
    }

    if (moveDirection === 'down') {
      // Find next editable row in the same quincena
      const editableRows = SPREADSHEET_ROWS.filter((r) => Boolean(r.setValue));
      const currentIdx = editableRows.findIndex((r) => r.id === rowId);
      if (currentIdx !== -1 && currentIdx + 1 < editableRows.length) {
        const nextRow = editableRows[currentIdx + 1];
        const nextVal = quincenaData ? nextRow.getValue(quincenaData) : 0;
        setEditingCell({
          rowId: nextRow.id,
          periodKey,
          value: nextVal === 0 ? '' : nextVal.toString(),
        });
        return;
      }
    } else if (moveDirection === 'right') {
      // Find next periodKey in the same row
      const allPeriodKeys: string[] = [];
      monthsToDisplay.forEach((m) => {
        [1, 2].forEach((q) => {
          allPeriodKeys.push(generatePeriodKey(company.fiscalYear, m, q as 1 | 2));
        });
      });
      const currentKeyIdx = allPeriodKeys.indexOf(periodKey);
      if (currentKeyIdx !== -1 && currentKeyIdx + 1 < allPeriodKeys.length) {
        const nextPKey = allPeriodKeys[currentKeyIdx + 1];
        const nextQData = company.periodData[nextPKey];
        const rowConfig = SPREADSHEET_ROWS.find((r) => r.id === rowId);
        const nextVal = (nextQData && rowConfig) ? rowConfig.getValue(nextQData) : 0;
        setEditingCell({
          rowId,
          periodKey: nextPKey,
          value: nextVal === 0 ? '' : nextVal.toString(),
        });
        return;
      }
    }

    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveCell('down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleSaveCell('right');
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-xs border border-zinc-200 overflow-hidden flex flex-col">
      {/* Table Subtitle Header */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-3 text-center select-none flex items-center justify-between flex-wrap gap-2">
        <div className="text-left">
          <div className="text-xs font-bold text-zinc-900 uppercase tracking-tight">
            RESUMEN DE PLANILLAS DE IVA — EJERCICIO FISCAL {company.fiscalYear}
          </div>
          <div className="text-[11px] text-zinc-500 font-medium">
            {company.razonSocial} · <span className="font-mono">{company.rif}</span>
          </div>
        </div>

        <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
          Matriz de 24 Quincenas Formulario 30 SENIAT
        </div>
      </div>

      {/* Real-time Health and Auto-reconcile Ribbon */}
      <div className="bg-zinc-100/80 border-b border-zinc-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {health.isValid ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 font-semibold border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Consistencia Fiscal Perfecta (24/24 Quincenas Calibradas)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{health.warnings.length} aviso(s) de arrastre o alícuotas detectado(s)</span>
            </span>
          )}
          <span className="text-zinc-500 hidden md:inline">
            • {health.totalPeriodsWithData} período(s) con declaraciones registradas
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onReconcileAll && (
            <button
              onClick={onReconcileAll}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-xs flex items-center gap-1.5 text-xs transition-colors"
              title="Conciliar en cascada los saldos arrastrados (Item 60 -> Item 20, Item 67 -> Item 54) y recalcular fórmulas en las 24 quincenas"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>✨ Conciliar Arrastres Anuales</span>
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Main Scrollable Container */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] relative">
        <table className="w-full border-collapse text-xs select-text">
          {/* Main Table Head */}
          <thead>
            {/* Top Month Header Row (Pink / Magenta matching screenshot) */}
            <tr className="bg-pink-100/80 text-pink-950 font-bold border-b border-pink-200 sticky top-0 z-30 shadow-xs">
              <th className="sticky left-0 z-40 bg-zinc-100 text-zinc-800 text-left px-3 py-2 border-r border-zinc-300 min-w-[240px] max-w-[280px] font-semibold">
                CONCEPTO / RUBRO
              </th>
              <th className="sticky left-[240px] z-40 bg-zinc-100 text-zinc-700 text-center px-2 py-2 border-r border-zinc-300 w-[75px] font-semibold">
                ITEM
              </th>

              {monthsToDisplay.map((m) => (
                <th
                  key={`month-hdr-${m}`}
                  colSpan={2}
                  className="px-2 py-1.5 text-center border-r border-pink-300/80 bg-pink-100/90 text-pink-900 font-bold tracking-tight text-[11px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{company.fiscalYear}</span>
                    <span className="uppercase">{MONTH_NAMES[m - 1]}</span>
                  </div>
                </th>
              ))}

              <th className="bg-blue-100 text-blue-950 text-right px-4 py-2 border-l-2 border-blue-300 font-bold min-w-[130px]">
                TOTAL ANUAL
              </th>
            </tr>

            {/* Sub-header for 1ra / 2da Quincena */}
            <tr className="bg-pink-50/70 text-zinc-700 font-semibold border-b border-zinc-300 sticky top-[33px] z-20 shadow-xs">
              <th className="sticky left-0 z-30 bg-zinc-50 border-r border-zinc-300 px-3 py-1 text-left text-[10px] text-zinc-500 uppercase">
                DESCRIPCIÓN SENIAT
              </th>
              <th className="sticky left-[240px] z-30 bg-zinc-50 border-r border-zinc-300 px-2 py-1 text-center text-[10px] text-zinc-500 uppercase">
                CÓDIGO
              </th>

              {monthsToDisplay.map((m) =>
                [1, 2].map((q) => {
                  const pKey = generatePeriodKey(company.fiscalYear, m, q as 1 | 2);
                  const qData = company.periodData[pKey];
                  const hasData = Boolean(
                    qData && (qData.item40 > 0 || qData.item42 > 0 || qData.item30 > 0 || qData.item33 > 0 || qData.item20 > 0 || qData.fileName)
                  );
                  const hasWarning = health.warnings.some((w) => w.periodKey === pKey);

                  return (
                    <th
                      key={`subhdr-${m}-${q}`}
                      onMouseEnter={() => setHoveredColumn(pKey)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      onClick={() => qData && onOpenQuincenaModal(qData)}
                      className={`px-2 py-1 text-center border-r border-zinc-200 min-w-[105px] cursor-pointer transition-colors group ${
                        hoveredColumn === pKey
                          ? 'bg-pink-200/90 text-pink-950'
                          : hasWarning
                          ? 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                          : hasData
                          ? 'bg-emerald-50/80 text-emerald-950 hover:bg-emerald-100'
                          : 'bg-white text-zinc-600 hover:bg-pink-50'
                      }`}
                      title={hasData ? `Clic para ver formulario completo: ${qData?.fileName || 'Planilla'}` : 'Sin datos. Clic para abrir detalle o editar'}
                    >
                      <div className="flex items-center justify-center gap-1 text-[10px]">
                        <span className="font-mono">{q === 1 ? '1ra Q' : '2da Q'}</span>
                        {hasWarning ? (
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" title="Aviso en este período" />
                        ) : hasData ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Planilla cargada" />
                        ) : null}
                        <FileText className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-zinc-500" />
                      </div>
                    </th>
                  );
                })
              )}

              <th className="bg-blue-50 text-blue-900 text-right px-3 py-1 border-l-2 border-blue-300 text-[10px] uppercase font-bold">
                SUMATORIA
              </th>
            </tr>
          </thead>

          {/* Main Rows Body */}
          <tbody className="divide-y divide-zinc-200">
            {SPREADSHEET_ROWS.map((rowConfig) => {
              // Calculate row total across all displayed quincenas
              let rowTotal = 0;
              for (let m = 1; m <= 12; m++) {
                for (let q = 1 as 1 | 2; q <= 2; q++) {
                  const pKey = generatePeriodKey(company.fiscalYear, m, q);
                  const qData = company.periodData[pKey];
                  if (qData) {
                    rowTotal += rowConfig.getValue(qData) || 0;
                  }
                }
              }

              // Determine special row styling based on user reference image
              const isCuentasPorCobrar = rowConfig.isHighlightYellow;
              const isBoldRow = rowConfig.isBold;
              const isSubtotal = rowConfig.isSubtotal;
              const isTotalFinal = rowConfig.isTotal;

              // Row background style
              let rowBg = 'bg-white hover:bg-zinc-50/70';
              if (isCuentasPorCobrar) {
                rowBg = 'bg-[#FEF08A] hover:bg-[#FDE047] text-zinc-950 font-bold'; // Highlighted in yellow like reference image
              } else if (isTotalFinal) {
                rowBg = 'bg-emerald-50/50 hover:bg-emerald-50 font-bold';
              } else if (isSubtotal) {
                rowBg = 'bg-zinc-50/80 font-semibold';
              }

              return (
                <tr
                  key={rowConfig.id}
                  className={`transition-colors border-b ${
                    isCuentasPorCobrar
                      ? 'border-yellow-300'
                      : isSubtotal || isTotalFinal
                      ? 'border-zinc-300 font-semibold'
                      : 'border-zinc-200'
                  } ${rowBg}`}
                >
                  {/* Pinned Label Column */}
                  <td
                    className={`sticky left-0 z-10 px-3 py-1.5 border-r border-zinc-300 text-left whitespace-nowrap ${
                      isCuentasPorCobrar
                        ? 'bg-[#FEF08A] text-zinc-950 font-bold shadow-xs'
                        : isTotalFinal
                        ? 'bg-emerald-50 font-bold text-zinc-950'
                        : isSubtotal
                        ? 'bg-zinc-100/90 font-bold text-zinc-900'
                        : 'bg-white text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 group">
                      <span className={isBoldRow ? 'font-bold' : 'font-normal'}>
                        {rowConfig.label}
                      </span>
                      {rowConfig.formulaDescription && (
                        <span
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-700 cursor-help"
                          title={rowConfig.formulaDescription}
                        >
                          <HelpCircle className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Pinned Item Code Column */}
                  <td
                    className={`sticky left-[240px] z-10 px-2 py-1.5 border-r border-zinc-300 text-center font-mono text-[11px] whitespace-nowrap ${
                      isCuentasPorCobrar
                        ? 'bg-[#FEF08A] text-zinc-950 font-bold'
                        : isTotalFinal
                        ? 'bg-emerald-50 font-bold text-zinc-950'
                        : isSubtotal
                        ? 'bg-zinc-100/90 font-bold text-zinc-700'
                        : 'bg-white text-zinc-600'
                    }`}
                  >
                    {rowConfig.itemCode || ''}
                  </td>

                  {/* Quincena Data Cells */}
                  {monthsToDisplay.map((m) =>
                    [1, 2].map((q) => {
                      const pKey = generatePeriodKey(company.fiscalYear, m, q as 1 | 2);
                      const qData = company.periodData[pKey];
                      const val = qData ? rowConfig.getValue(qData) : 0;
                      const isEditing =
                        editingCell?.rowId === rowConfig.id && editingCell?.periodKey === pKey;
                      const canEdit = Boolean(rowConfig.setValue);
                      const isHovered = hoveredColumn === pKey;
                      const validation = validateCellReconciliation(rowConfig.id, qData);

                      let cellBg = '';
                      if (validation.isError) {
                        cellBg = 'bg-red-100/90 text-red-900 font-bold border border-red-400 shadow-inner';
                      } else if (isHovered && !isCuentasPorCobrar) {
                        cellBg = 'bg-pink-50/50';
                      }

                      return (
                        <td
                          key={`cell-${rowConfig.id}-${m}-${q}`}
                          onMouseEnter={() => setHoveredColumn(pKey)}
                          onMouseLeave={() => setHoveredColumn(null)}
                          onClick={() => {
                            if (canEdit && !isEditing) {
                              setEditingCell({
                                rowId: rowConfig.id,
                                periodKey: pKey,
                                value: val === 0 ? '' : val.toString(),
                              });
                            }
                          }}
                          title={validation.isError ? validation.reason : canEdit ? 'Clic para editar monto' : undefined}
                          className={`px-2 py-1.5 border-r border-zinc-200 text-right font-mono text-[11px] transition-colors relative select-none ${cellBg} ${
                            canEdit ? 'cursor-pointer hover:ring-1 hover:ring-indigo-400 hover:bg-indigo-50/30' : ''
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                ref={inputRef}
                                type="text"
                                className="w-full bg-white text-zinc-900 font-mono px-1 py-0.5 border-2 border-indigo-600 rounded text-right text-xs focus:outline-none shadow-sm z-20"
                                value={editingCell.value}
                                onChange={(e) =>
                                  setEditingCell({ ...editingCell, value: e.target.value })
                                }
                                onBlur={() => handleSaveCell()}
                                onKeyDown={handleKeyDown}
                              />
                              <button
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSaveCell();
                                }}
                                className="p-0.5 text-emerald-600 hover:text-emerald-800"
                                title="Guardar (Enter)"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              {validation.isError && (
                                <AlertTriangle className="w-3 h-3 text-red-600 shrink-0 inline-block" />
                              )}
                              <span
                                className={`${
                                  isBoldRow || validation.isError ? 'font-bold' : ''
                                } ${val < 0 ? 'text-red-600' : ''}`}
                              >
                                {formatCurrency(val, true)}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })
                  )}

                  {/* Row Total Column */}
                  <td
                    className={`px-3 py-1.5 border-l-2 border-blue-300 text-right font-mono font-bold text-xs whitespace-nowrap ${
                      isCuentasPorCobrar
                        ? 'bg-[#FEF08A] text-zinc-950 font-bold'
                        : isTotalFinal
                        ? 'bg-emerald-100 text-emerald-950'
                        : 'bg-blue-50/90 text-blue-950'
                    }`}
                  >
                    {formatCurrency(rowTotal, true)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grid footer controls & keyboard shortcuts */}
      <div className="bg-zinc-50 border-t border-zinc-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Planilla cargada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#FEF08A] border border-yellow-400 rounded-xs" />
            <span className="font-semibold text-zinc-800">Cuentas por Cobrar (Ventas + Débitos)</span>
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            <Edit3 className="w-3 h-3 text-indigo-500" />
            <span>Clic en celda para editar • <kbd className="px-1 py-0.5 bg-zinc-200 border border-zinc-300 rounded font-mono text-[10px]">Enter</kbd> para bajar • <kbd className="px-1 py-0.5 bg-zinc-200 border border-zinc-300 rounded font-mono text-[10px]">Tab</kbd> para avanzar</span>
          </div>
        </div>

        <div className="text-zinc-500 text-[11px] italic">
          Valores en Bolívares (VES) sincronizados con Forma 30 SENIAT
        </div>
      </div>
    </div>
  );
};

