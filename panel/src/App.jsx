import { useState, useEffect, useRef } from "react";
import {
  MessageCircle, Settings, RefreshCw, Wifi, WifiOff,
  Save, CheckCircle, XCircle, Upload, FileText, Sparkles
} from "lucide-react";

const API = "/api";
const NUM_INSTANCES = 4;

function StatusBadge({ status }) {
  const map = {
    connected:    { label: "Conectado",    cls: "bg-green-100 text-green-700" },
    qr_ready:     { label: "Escaneá el QR", cls: "bg-yellow-100 text-yellow-700" },
    connecting:   { label: "Conectando…",  cls: "bg-blue-100 text-blue-700" },
    disconnected: { label: "Desconectado", cls: "bg-red-100 text-red-700" },
  };
  const { label, cls } = map[status] || map.disconnected;
  const Icon = status === "connected" ? CheckCircle : XCircle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      <Icon size={12} /> {label}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      {children}
    </div>
  );
}

function Btn({ onClick, children, variant = "primary", disabled = false, className = "" }) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:   "bg-violet-600 text-white hover:bg-violet-700",
    secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    danger:    "bg-red-500 text-white hover:bg-red-600",
    success:   "bg-green-500 text-white hover:bg-green-600",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function WaInstance({ id }) {
  const [inst, setInst] = useState({ id, status: "disconnected", qrDataUrl: null });

  useEffect(() => {
    let interval;
    const poll = async () => {
      try {
        const d = await fetch(`${API}/whatsapp/${id}/qr`).then(r => r.json());
        setInst(prev => ({ ...prev, status: d.status, qrDataUrl: d.qrDataUrl }));
      } catch { /* ignore */ }
    };
    poll();
    interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [id]);

  const connect = async () => {
    await fetch(`${API}/whatsapp/${id}/connect`, { method: "POST" });
  };

  const disconnect = async () => {
    await fetch(`${API}/whatsapp/${id}/disconnect`, { method: "POST" });
  };

  const colorMap = {
    connected:    "border-green-300 bg-green-50",
    qr_ready:     "border-yellow-300 bg-yellow-50",
    connecting:   "border-blue-300 bg-blue-50",
    disconnected: "border-gray-200 bg-white",
  };
  const borderCls = colorMap[inst.status] || colorMap.disconnected;

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${borderCls}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white border border-gray-100 rounded-xl flex items-center justify-center shadow-sm">
            <MessageCircle size={18} className="text-green-500" />
          </div>
          <div>
            <div className="font-bold text-gray-800 text-sm">Número {id}</div>
            <StatusBadge status={inst.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {inst.status !== "connected" && (
            <Btn onClick={connect} variant="success" className="text-xs px-3 py-1.5">
              <Wifi size={13} /> Conectar
            </Btn>
          )}
          {inst.status === "connected" && (
            <Btn onClick={disconnect} variant="danger" className="text-xs px-3 py-1.5">
              <WifiOff size={13} /> Desconectar
            </Btn>
          )}
        </div>
      </div>

      {inst.status === "qr_ready" && inst.qrDataUrl && (
        <div className="flex flex-col items-center mt-2">
          <p className="text-xs text-gray-500 mb-2 text-center">
            WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong>
          </p>
          <div className="p-2 bg-white border-2 border-green-400 rounded-xl shadow">
            <img src={inst.qrDataUrl} alt={`QR ${id}`} className="w-44 h-44" />
          </div>
          <p className="text-xs text-gray-400 mt-1">QR se actualiza automáticamente</p>
        </div>
      )}

      {inst.status === "connected" && (
        <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
          <CheckCircle size={13} /> Activo — enviando mensajes de bienvenida automáticamente
        </p>
      )}

      {inst.status === "connecting" && (
        <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
          <RefreshCw size={12} className="animate-spin" /> Conectando…
        </p>
      )}

      {inst.status === "disconnected" && (
        <p className="text-xs text-gray-400 mt-1">Presioná Conectar para vincular este número.</p>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("numeros");
  const [toast, setToast] = useState(null);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfInfo, setPdfInfo] = useState({ fileName: null, exists: false });
  const fileRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch(`${API}/config`).then(r => r.json()).then(d => setConfig(d)).catch(() => {});
    fetch(`${API}/pdf/info`).then(r => r.json()).then(d => setPdfInfo(d)).catch(() => {});
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ welcomeMessage: config.welcomeMessage, businessName: config.businessName }),
      });
      const d = await r.json();
      if (d.ok) showToast("Mensaje guardado ✓");
      else showToast("Error al guardar", "error");
    } catch {
      showToast("Error al guardar", "error");
    }
    setSaving(false);
  };

  const uploadPdf = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("pdf", file);
      const r = await fetch(`${API}/pdf/upload`, { method: "POST", body: fd });
      const d = await r.json();
      if (d.ok) {
        showToast(`PDF subido: ${d.fileName} ✓`);
        setPdfInfo({ fileName: d.fileName, exists: true });
      } else {
        showToast(d.error || "Error al subir PDF", "error");
      }
    } catch (err) {
      console.error("PDF upload error:", err);
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearPdf = async () => {
    try {
      await fetch(`${API}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfUrl: null, pdfName: null }),
      });
      setPdfInfo({ fileName: null, exists: false });
      showToast("PDF eliminado");
    } catch {
      showToast("Error al eliminar PDF", "error");
    }
  };

  const tabs = [
    { id: "numeros",  label: "Números",   icon: MessageCircle },
    { id: "mensaje",  label: "Mensaje",   icon: Sparkles },
    { id: "pdf",      label: "PDF Precios", icon: FileText },
    { id: "ajustes",  label: "Ajustes",   icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${toast.type === "error" ? "bg-red-500" : "bg-green-500"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-100 flex flex-col py-6 px-3 fixed h-full">
          <div className="flex items-center gap-2 px-3 mb-8">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight">TechStore</div>
              <div className="text-xs text-gray-400">Panel de control</div>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id ? "bg-violet-50 text-violet-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <t.icon size={17} />
                {t.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto px-3 text-xs text-gray-400">v2.0 · TechStore Bot</div>
        </aside>

        {/* Main */}
        <main className="ml-56 flex-1 p-8">

          {/* NÚMEROS — 3 instancias */}
          {tab === "numeros" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Números de WhatsApp</h1>
              <p className="text-gray-500 text-sm mb-6">
                Podés conectar hasta <strong>3 números</strong> simultáneamente. Cada uno enviará el mensaje de bienvenida + PDF a cualquier persona que les escriba.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {Array.from({ length: NUM_INSTANCES }, (_, i) => i + 1).map(id => (
                  <WaInstance key={id} id={id} onToast={showToast} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-5">
                ⚠️ Si el servidor se reinicia, vas a tener que escanear los QR nuevamente.
              </p>
            </div>
          )}

          {/* MENSAJE */}
          {tab === "mensaje" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Mensaje de bienvenida</h1>
              <p className="text-gray-500 text-sm mb-6">
                Este mensaje se envía automáticamente a cada persona que le escriba a cualquiera de tus números. Se adjunta el PDF de precios si está cargado.
              </p>
              <Card className="max-w-2xl">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Texto del mensaje</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                  rows={10}
                  placeholder="Escribí el mensaje de bienvenida..."
                  value={config?.welcomeMessage || ""}
                  onChange={e => setConfig(c => ({ ...c, welcomeMessage: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1 mb-4">
                  Podés usar *negrita*, _cursiva_ — formato WhatsApp estándar.
                </p>
                <Btn onClick={saveConfig} disabled={saving || !config}>
                  <Save size={15} /> {saving ? "Guardando…" : "Guardar mensaje"}
                </Btn>
              </Card>

              <Card className="max-w-2xl mt-5 bg-gray-50 border-dashed">
                <div className="text-sm font-semibold text-gray-600 mb-2">Vista previa</div>
                <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {config?.welcomeMessage || <span className="text-gray-300 italic">Sin mensaje configurado…</span>}
                </div>
              </Card>
            </div>
          )}

          {/* PDF */}
          {tab === "pdf" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">PDF Lista de precios</h1>
              <p className="text-gray-500 text-sm mb-6">
                Este PDF se adjunta automáticamente al mensaje de bienvenida. Subí uno nuevo para reemplazar el actual.
              </p>
              <Card className="max-w-lg">
                <div className="flex items-center gap-3 mb-5 p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <FileText size={28} className={pdfInfo.exists ? "text-violet-500" : "text-gray-300"} />
                  <div>
                    <div className="font-semibold text-sm text-gray-700">
                      {pdfInfo.exists ? pdfInfo.fileName : "Sin PDF cargado"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {pdfInfo.exists ? "PDF activo — se adjunta en cada bienvenida" : "Subí un PDF para adjuntarlo automáticamente"}
                    </div>
                  </div>
                  {pdfInfo.exists && (
                    <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      <CheckCircle size={11} /> Activo
                    </span>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => { uploadPdf(e.target.files?.[0]); }}
                />
                <div className="flex gap-2">
                  <Btn
                    onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}
                    disabled={uploading}
                    variant="primary"
                  >
                    <Upload size={15} />
                    {uploading ? "Subiendo…" : pdfInfo.exists ? "Reemplazar PDF" : "Subir PDF"}
                  </Btn>
                  {pdfInfo.exists && (
                    <Btn onClick={clearPdf} variant="danger">
                      Eliminar
                    </Btn>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">Tamaño máximo: 20 MB</p>
              </Card>
            </div>
          )}

          {/* AJUSTES */}
          {tab === "ajustes" && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Ajustes</h1>
              <p className="text-gray-500 text-sm mb-6">Configuración general del negocio</p>
              <Card className="max-w-lg">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre del negocio</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-300"
                  value={config?.businessName || ""}
                  onChange={e => setConfig(c => ({ ...c, businessName: e.target.value }))}
                  placeholder="Tech Stories"
                />
                <Btn onClick={saveConfig} disabled={saving || !config}>
                  <Save size={15} /> {saving ? "Guardando…" : "Guardar"}
                </Btn>
              </Card>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
