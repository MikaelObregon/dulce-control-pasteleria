import React, { useMemo, useState } from 'react';
import {
  CakeSlice,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Home,
  RefreshCcw,
  Settings,
  ShoppingBag,
  Upload,
  X,
} from 'lucide-react';
import { StoreProvider, useStore } from './context/StoreContext';
import { TodayAndCashView } from './components/views/TodayAndCashView';
import { CakesAndPricingView } from './components/views/CakesAndPricingView';
import { SuppliesAndShoppingView } from './components/views/SuppliesAndShoppingView';
import { calculateOrderFinancials } from './services/calculations';
import { getSupabaseConfig, SUPABASE_SETUP_SQL } from './services/supabaseSync';

type MainTab = 'hoy_caja' | 'tortas_precios' | 'insumos_compras';

const MainShell: React.FC = () => {
  const {
    settings,
    orders,
    cashSummary,
    formatMoney,
    updateSettings,
    exportBackupJson,
    importBackupJson,
    resetDemoTransactions,
    resetAllToFactory,
    cloudStatus,
    cloudError,
    configureCloudSync,
    syncWithCloudNow,
  } = useStore();

  const [activeTab, setActiveTab] = useState<MainTab>('tortas_precios');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const existingCloud = getSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(existingCloud?.url || '');
  const [sbKey, setSbKey] = useState(existingCloud?.anonKey || '');

  const debtCount = useMemo(
    () => orders.filter((o) => calculateOrderFinancials(o).isDeliveredWithDebt).length,
    [orders]
  );

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await configureCloudSync(sbUrl, sbKey);
    showToast(res.message);
  };

  const handleCopySql = () => {
    navigator.clipboard?.writeText(SUPABASE_SETUP_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `respaldo-dulcecontrol-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Copia de seguridad descargada.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const res = importBackupJson(content);
      showToast(res.message);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 flex flex-col">
      {/* Top Sticky Mobile Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-3.5 py-2.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-pink-600 via-rose-600 to-amber-600 text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0">
              🍰
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold text-stone-900 truncate leading-tight">
                {settings.businessName}
              </h1>
              <p className="text-[11px] text-stone-500 truncate">
                Libre p/ gastar:{' '}
                <strong className="text-emerald-700 font-extrabold">
                  {formatMoney(Math.max(0, cashSummary.availableFreeProfit))}
                </strong>{' '}
                · Mercadería:{' '}
                <strong className="text-amber-800 font-extrabold">
                  {formatMoney(cashSummary.untouchableReplacementFund)}
                </strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {debtCount > 0 && (
              <button
                onClick={() => setActiveTab('hoy_caja')}
                className="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 text-[11px] font-extrabold px-2.5 py-1 rounded-full animate-pulse cursor-pointer"
                title="Clientes que retiraron con deuda pendiente"
              >
                ⚠️ {debtCount} Deuda{debtCount > 1 ? 's' : ''}
              </button>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border transition cursor-pointer ${
                cloudStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : cloudStatus === 'syncing'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : cloudStatus === 'error'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-stone-100 text-stone-600 border-stone-200'
              }`}
              title="Configurar Base de Datos en la Nube y Preferencias"
            >
              {cloudStatus === 'synced' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" /> Nube OK
                </>
              ) : cloudStatus === 'syncing' ? (
                <>
                  <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Sync...
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5" /> Local
                </>
              )}
              <Settings className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-3.5 pt-3.5 pb-24">
        {activeTab === 'hoy_caja' && <TodayAndCashView />}
        {activeTab === 'tortas_precios' && <CakesAndPricingView />}
        {activeTab === 'insumos_compras' && <SuppliesAndShoppingView />}
      </main>

      {/* Bottom Ergonomic 3-Tab Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200/90 shadow-lg">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-2 px-3 py-2">
          <button
            onClick={() => {
              setActiveTab('hoy_caja');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === 'hoy_caja'
                ? 'bg-stone-900 text-white font-extrabold shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 font-semibold'
            }`}
          >
            <Home className="w-5 h-5 shrink-0" />
            <span className="text-xs leading-none">Mi Día y Caja</span>
            {debtCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">
                {debtCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('tortas_precios');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === 'tortas_precios'
                ? 'bg-pink-700 text-white font-extrabold shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 font-semibold'
            }`}
          >
            <CakeSlice className="w-5 h-5 shrink-0" />
            <span className="text-xs leading-none">Tortas y Precios</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('insumos_compras');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl transition cursor-pointer ${
              activeTab === 'insumos_compras'
                ? 'bg-amber-600 text-white font-extrabold shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 font-semibold'
            }`}
          >
            <ShoppingBag className="w-5 h-5 shrink-0" />
            <span className="text-xs leading-none">Stock e Insumos</span>
          </button>
        </div>
      </nav>

      {/* Modal: Cloud Sync (Supabase), Currency & Backup */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-extrabold text-stone-900">
                Sincronización en la Nube y Ajustes
              </h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {toastMsg && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {toastMsg}
              </div>
            )}

            {/* SUPABASE CLOUD CONFIGURATION */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-extrabold text-stone-900 flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-emerald-600" />
                    Base de Datos en la Nube (Supabase)
                  </span>
                  <p className="text-[11px] text-stone-500">
                    Sincroniza en vivo tu teléfono y tu computadora sin perder datos jamás.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1 text-[11px] font-bold bg-white border border-stone-300 px-2.5 py-1.5 rounded-xl cursor-pointer shrink-0"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> SQL Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> 1. Copiar SQL
                    </>
                  )}
                </button>
              </div>

              {cloudError && (
                <p className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-xl">
                  {cloudError}
                </p>
              )}

              <form onSubmit={handleConnectSupabase} className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Project URL de Supabase
                  </label>
                  <input
                    type="url"
                    value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)}
                    placeholder="https://xxxx.supabase.co"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Anon Public Key de Supabase
                  </label>
                  <input
                    type="password"
                    value={sbKey}
                    onChange={(e) => setSbKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold rounded-xl cursor-pointer"
                  >
                    Conectar y Sincronizar Nube
                  </button>
                  {cloudStatus === 'synced' && (
                    <button
                      type="button"
                      onClick={() => syncWithCloudNow()}
                      className="px-3 py-2.5 bg-white border border-stone-300 text-stone-800 text-xs font-bold rounded-xl cursor-pointer"
                      title="Refrescar desde la nube"
                    >
                      <RefreshCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Business & Currency */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nombre de tu Pastelería
                </label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => updateSettings({ businessName: e.target.value })}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Moneda
                  </label>
                  <select
                    value={settings.currencySymbol}
                    onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value="$">$ (Pesos / Dólar)</option>
                    <option value="USD ">USD (Dólares)</option>
                    <option value="Bs. ">Bs. (Bolívares)</option>
                    <option value="S/ ">S/ (Soles)</option>
                    <option value="€">€ (Euros)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Decimales
                  </label>
                  <select
                    value={settings.decimals}
                    onChange={(e) =>
                      updateSettings({ decimals: Number(e.target.value) as 0 | 2 })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold"
                  >
                    <option value={0}>Sin decimales ($4.500)</option>
                    <option value={2}>Con 2 decimales ($12,50)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 space-y-2">
              <span className="text-xs font-bold text-stone-700 block">
                Respaldo Manual en Archivo (.json)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Guardar Copia
                </button>
                <label className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold cursor-pointer">
                  <Upload className="w-4 h-4" /> Restaurar Copia
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Dejar Pedidos en 0, Caja en $0 y Stock en 0 conservando tus recetas y precios de insumos?'
                    )
                  ) {
                    resetDemoTransactions();
                    showToast('Caja, pedidos y stock limpios en 0.');
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Limpiar Caja, Pedidos y Stock a 0
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Restaurar las recetas e insumos originales de fábrica?'
                    )
                  ) {
                    resetAllToFactory();
                    showToast('Recetas e insumos originales restaurados.');
                  }
                }}
                className="py-2.5 px-3 rounded-xl border border-stone-200 text-stone-600 text-xs font-semibold cursor-pointer"
              >
                Restaurar Base
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function App() {
  return (
    <StoreProvider>
      <MainShell />
    </StoreProvider>
  );
}

export default App;
