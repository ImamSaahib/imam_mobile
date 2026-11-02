import React, { useEffect, useMemo, useState } from "react";
import { Save, Eye, Send, Plus, Trash2, ChevronUp, ChevronDown, Lock, Layers, FileText, Database, RefreshCw, History } from "lucide-react";

const API = "https://imam-mobile-api.imamsaahib.workers.dev";
const DEFAULT_CONFIG = {
  schemaVersion: 1,
  pages: [
    { id: "dashboard", title: "Dashboard", enabled: true },
    { id: "inventory", title: "Inventory", enabled: true },
    { id: "customers", title: "Customers", enabled: true },
    { id: "customer-entries", title: "Customer Entries", enabled: true },
    { id: "sales", title: "Sales", enabled: true },
    { id: "reports", title: "Reports", enabled: true }
  ],
  components: [
    { id: "dashboard-summary", page: "dashboard", type: "summary", title: "Shop summary", enabled: true },
    { id: "inventory-list", page: "inventory", type: "list", title: "Device list", enabled: true },
    { id: "customer-list", page: "customers", type: "list", title: "Customer directory", enabled: true },
    { id: "ledger-list", page: "customer-entries", type: "list", title: "Customer ledger", enabled: true },
    { id: "sales-list", page: "sales", type: "list", title: "Sales register", enabled: true }
  ],
  fields: [],
  reports: []
};

async function request(path, token, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed (" + response.status + ").");
  return body;
}

export default function AdminStudio({ onClose, onNotice, onPublished }) {
  const [token, setToken] = useState("");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [published, setPublished] = useState(DEFAULT_CONFIG);
  const [version, setVersion] = useState(1);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [tab, setTab] = useState("pages");
  const [selectedPage, setSelectedPage] = useState("inventory");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Enter the Admin Configuration Token to load and edit the saved draft.");
  const [reportName, setReportName] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldStorage, setFieldStorage] = useState("metadata");
  const [fieldTable, setFieldTable] = useState("mobile_devices");
  const [componentType, setComponentType] = useState("list");
  const [componentSource, setComponentSource] = useState("devices");
  const [newPageName, setNewPageName] = useState("");

  const page = config.pages.find(p => p.id === selectedPage) || config.pages[0];
  const pageComponents = useMemo(() => config.components.filter(c => c.page === selectedPage), [config.components, selectedPage]);
  const update = patch => setConfig(c => ({ ...c, ...patch }));
  const changePage = (id, patch) => update({ pages: config.pages.map(p => p.id === id ? { ...p, ...patch } : p) });
  const changeComponent = (id, patch) => update({ components: config.components.map(c => c.id === id ? { ...c, ...patch } : c) });

  async function load() {
    if (!token.trim()) return setMessage("Enter the Admin Configuration Token first.");
    setBusy(true);
    try {
      const data = await request("/api/admin/configuration", token);
      setConfig(data.draft || DEFAULT_CONFIG);
      setPublished(data.published || DEFAULT_CONFIG);
      setVersion(data.version || 1);
      const history = await request("/api/admin/configuration/versions", token);
      setVersions(history.versions || []);
      setMessage("Draft loaded. Changes are not live until published.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function saveDraft() {
    setBusy(true);
    try {
      await request("/api/admin/configuration", token, { method: "PUT", body: JSON.stringify({ configuration: config }) });
      setMessage("Draft saved. Normal users still see the published version.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function publish() {
    if (!window.confirm("Publish this configuration for the application?")) return;
    setBusy(true);
    try {
      await request("/api/admin/configuration", token, { method: "PUT", body: JSON.stringify({ configuration: config }) });
      const result = await request("/api/admin/configuration/publish", token, { method: "POST", body: JSON.stringify({ summary: "Published from Admin Studio" }) });
      setPublished(config);
      onPublished?.(config);
      setVersion(result.version);
      const history = await request("/api/admin/configuration/versions", token);
      setVersions(history.versions || []);
      setMessage("Published version " + result.version + " successfully.");
      onNotice?.("Configuration version " + result.version + " published.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function restoreVersion() {
    if (!selectedVersion) return setMessage("Choose a version to restore.");
    if (!window.confirm("Restore version " + selectedVersion + " as a draft? The live configuration will not change until you publish it.")) return;
    setBusy(true);
    try {
      const result = await request("/api/admin/configuration/restore", token, { method: "POST", body: JSON.stringify({ version: Number(selectedVersion) }) });
      setConfig(result.configuration);
      setSelectedPage(result.configuration.pages?.[0]?.id || "inventory");
      setMessage("Version " + selectedVersion + " restored as a draft. Review and publish when ready.");
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  function addReport() {
    const title = reportName.trim();
    if (!title) return;
    update({ reports: [...config.reports, { id: "report-" + Date.now(), title, source: "devices", metric: "count", enabled: true }] });
    setReportName("");
  }
  async function addField() {
    const label = fieldName.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!key || config.fields.some(f => f.key === key)) return setMessage("That field name is invalid or already exists.");
    if (fieldStorage === "physical") {
      const sqlType = fieldType === "number" ? "REAL" : fieldType === "boolean" ? "INTEGER" : "TEXT";
      if (!window.confirm("Add a physical column to " + fieldTable + "? This changes the database schema and cannot be automatically undone.")) return;
      setBusy(true);
      try {
        await request("/api/admin/schema/add-column", token, { method: "POST", body: JSON.stringify({ table: fieldTable, column: key, type: sqlType }) });
      } catch (e) { setMessage(e.message); setBusy(false); return; }
      setBusy(false);
    }
    update({ fields: [...config.fields, { id: "field-" + Date.now(), key, label, type: fieldType, storage: fieldStorage, table: fieldTable, enabled: true }] });
    setFieldName("");
    setMessage(fieldStorage === "physical" ? "Database column created. Save and publish the field definition." : "Metadata field added. Save and publish the field definition.");
  }
  function addPage() {
    const title = newPageName.trim();
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!title || !id || config.pages.some(p=>p.id===id)) return setMessage("Enter a unique page name using letters or numbers.");
    update({ pages:[...config.pages,{id,title,enabled:true}], components:[...config.components] });
    setSelectedPage(id);
    setNewPageName("");
  }
  function removePage(id) {
    if (["dashboard","inventory","customers","customer-entries","sales","reports"].includes(id)) return;
    if (!window.confirm("Remove this page and its component definitions?")) return;
    update({ pages:config.pages.filter(p=>p.id!==id), components:config.components.filter(c=>c.page!==id) });
    setSelectedPage("inventory");
  }
  function addComponent() {
    if (!page) return;
    const id = "component-" + Date.now();
    const title = componentType === "list" ? "New list" : componentType === "form" ? "New form" : componentType === "report" ? "New report" : componentType === "layout" ? "New layout" : "New summary";
    update({ components: [...config.components, { id, page: page.id, type: componentType, source: componentSource, title, enabled: true }] });
  }
  function moveComponent(index, delta) {
    const next = [...pageComponents];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const order = next.map((item, i) => ({ ...item, order: i }));
    update({ components: [...config.components.filter(c => c.page !== selectedPage), ...order] });
  }

  return <div className="admin-studio">
    <div className="admin-studio-head">
      <div><p className="eyebrow">ADMIN CONFIGURATION</p><h1>Visual configuration studio</h1><p className="page-subtitle">Configure pages, reusable components, reports and custom fields.</p></div>
      <button className="secondary-button" onClick={onClose}>Close editor</button>
    </div>
    <div className="admin-security-note"><Lock size={17}/><span>Configuration writes are protected by a Worker secret. Your token stays in this page's memory and is not saved in browser storage.</span></div>
    <section className="panel admin-connection">
      <div><h2>Administrator access</h2><p>Set ADMIN_CONFIG_TOKEN as a secret on the Cloudflare Worker before using this editor.</p></div>
      <div className="admin-token-row"><input type="password" autoComplete="off" placeholder="Admin Configuration Token" value={token} onChange={e=>setToken(e.target.value)}/><button className="secondary-button" disabled={busy || !token.trim()} onClick={load}><RefreshCw size={15}/>Load draft</button></div>
    </section>
    <div className="admin-workspace">
      <aside className="admin-panel">
        <div className="admin-tabs">
          <button className={tab==="pages"?"active":""} onClick={()=>setTab("pages")}><Layers size={16}/>Pages & layout</button>
          <button className={tab==="reports"?"active":""} onClick={()=>setTab("reports")}><FileText size={16}/>Reports</button>
          <button className={tab==="fields"?"active":""} onClick={()=>setTab("fields")}><Database size={16}/>Custom fields</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}><History size={16}/>History</button>
        </div>
        {tab==="pages" && <>
          <h3>Application pages</h3>
          {config.pages.map(p=><div className={"admin-page-choice "+(selectedPage===p.id?"selected":"")} key={p.id}><button onClick={()=>setSelectedPage(p.id)}><span>{p.title}</span><small>{p.enabled?"Visible":"Hidden"}</small></button>{!["dashboard","inventory","customers","customer-entries","sales","reports"].includes(p.id)&&<button className="icon-button" onClick={()=>removePage(p.id)} aria-label={"Remove "+p.title}><Trash2 size={14}/></button>}</div>)}<div className="admin-add-row"><input placeholder="New page name" value={newPageName} onChange={e=>setNewPageName(e.target.value)}/><button className="secondary-button" onClick={addPage}><Plus size={14}/>Add page</button></div>
          {page && <div className="admin-properties"><label>Page title<input value={page.title} onChange={e=>changePage(page.id,{title:e.target.value})}/></label><label className="admin-check"><input type="checkbox" checked={page.enabled} onChange={e=>changePage(page.id,{enabled:e.target.checked})}/> Page enabled</label></div>}
        </>}
        {tab==="reports" && <><h3>Reports</h3><div className="admin-add-row"><input placeholder="New report name" value={reportName} onChange={e=>setReportName(e.target.value)}/><button className="primary-button" onClick={addReport}><Plus size={15}/>Add</button></div>{config.reports.map(r=><div className="admin-list-row" key={r.id}><input value={r.title} onChange={e=>update({reports:config.reports.map(x=>x.id===r.id?{...x,title:e.target.value}:x)})}/><select value={r.source||"devices"} onChange={e=>update({reports:config.reports.map(x=>x.id===r.id?{...x,source:e.target.value}:x)})}><option value="devices">Inventory</option><option value="customers">Customers</option><option value="sales">Sales</option><option value="customer_entries">Customer entries</option></select><label><input type="checkbox" checked={r.enabled} onChange={e=>update({reports:config.reports.map(x=>x.id===r.id?{...x,enabled:e.target.checked}:x)})}/>On</label><button className="icon-button" onClick={()=>update({reports:config.reports.filter(x=>x.id!==r.id)})}><Trash2 size={15}/></button></div>)}</>}
        {tab==="fields" && <><h3>Custom fields</h3><p className="admin-hint">Metadata fields are definitions only in this milestone. Physical fields create an additive database column immediately; publish their definition after creation.</p><div className="admin-add-field"><input placeholder="Field label" value={fieldName} onChange={e=>setFieldName(e.target.value)}/><select value={fieldType} onChange={e=>setFieldType(e.target.value)}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="boolean">Yes / No</option></select><select value={fieldStorage} onChange={e=>setFieldStorage(e.target.value)}><option value="metadata">Metadata</option><option value="physical">Physical column</option></select><select aria-label="Entity table" value={fieldTable} onChange={e=>setFieldTable(e.target.value)}><option value="mobile_devices">Inventory</option><option value="customers">Customers</option><option value="sales">Sales</option><option value="customer_entries">Customer entries</option></select><button className="primary-button" disabled={busy||!token} onClick={addField}><Plus size={15}/>Add field</button></div>{config.fields.map(f=><div className="admin-list-row" key={f.id}><input aria-label="Field label" value={f.label} onChange={e=>update({fields:config.fields.map(x=>x.id===f.id?{...x,label:e.target.value}:x)})}/><small>{f.key} · {f.storage} · {f.table||"unassigned"}</small><select aria-label="Field type" value={f.type} onChange={e=>update({fields:config.fields.map(x=>x.id===f.id?{...x,type:e.target.value}:x)})}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="boolean">Yes / No</option></select><label><input type="checkbox" checked={f.enabled!==false} onChange={e=>update({fields:config.fields.map(x=>x.id===f.id?{...x,enabled:e.target.checked}:x)})}/>On</label><button className="icon-button" onClick={()=>update({fields:config.fields.filter(x=>x.id!==f.id)})}><Trash2 size={15}/></button></div>)}</>}
      </aside>
      <section className="panel admin-canvas">
        <div className="admin-canvas-head"><div><p className="eyebrow">LIVE DRAFT PREVIEW</p><h2>{page?.title || "Configuration"}</h2><p>Version {version} currently published</p></div><span className="status-pill status-warning">Draft</span></div>
        {tab==="pages" && <><div className="admin-component-toolbar"><strong>Reusable components</strong><span>{pageComponents.length} on this page</span><select value={componentSource} onChange={e=>setComponentSource(e.target.value)}><option value="devices">Inventory data</option><option value="customers">Customer data</option><option value="sales">Sales data</option><option value="customer_entries">Customer entries</option></select><select value={componentType} onChange={e=>setComponentType(e.target.value)}><option value="list">List</option><option value="form">Form</option><option value="report">Report</option><option value="summary">Summary</option><option value="layout">Layout</option></select><button className="secondary-button" onClick={addComponent}><Plus size={14}/>Add component</button></div>{pageComponents.map((c,i)=><div className="admin-component" key={c.id}><div className="admin-component-icon"><Layers size={17}/></div><div className="admin-component-info"><strong>{c.title}</strong><small>{c.type} component · {c.id}</small><input value={c.title} onChange={e=>changeComponent(c.id,{title:e.target.value})}/><select aria-label="Component width" value={c.width||"full"} onChange={e=>changeComponent(c.id,{width:e.target.value})}><option value="full">Full width</option><option value="half">Half width</option><option value="third">One third</option></select>{c.type==="list"&&<input aria-label="Visible columns" placeholder="Columns: model, company, imei" value={(c.columns||[]).join(", ")} onChange={e=>changeComponent(c.id,{columns:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/>} {c.type==="list"&&<><select aria-label="Rows per page" value={c.pageSize||10} onChange={e=>changeComponent(c.id,{pageSize:Number(e.target.value)})}><option value="5">5 rows</option><option value="10">10 rows</option><option value="20">20 rows</option><option value="50">50 rows</option></select><label><input type="checkbox" checked={c.searchable!==false} onChange={e=>changeComponent(c.id,{searchable:e.target.checked})}/>Search</label></>}</div><label className="admin-check"><input type="checkbox" checked={c.enabled} onChange={e=>changeComponent(c.id,{enabled:e.target.checked})}/>Visible</label><div className="admin-move"><button className="icon-button" onClick={()=>moveComponent(i,-1)} aria-label="Move up"><ChevronUp size={16}/></button><button className="icon-button" onClick={()=>moveComponent(i,1)} aria-label="Move down"><ChevronDown size={16}/></button><button className="icon-button" onClick={()=>update({components:config.components.filter(x=>x.id!==c.id)})} aria-label="Remove component"><Trash2 size={15}/></button></div></div>)}<p className="admin-hint">Published component visibility and titles are applied to the existing runtime pages. Custom list, report and summary components render on their configured pages. Form components open the existing validated business forms; layout components provide width-based grouping.</p></>}
        {tab==="reports" && <div className="admin-preview-list">{config.reports.filter(r=>r.enabled).map(r=><div className="panel"><strong>{r.title}</strong><small>Source: {r.source} · Metric: {r.metric}</small></div>)}{!config.reports.length&&<p className="empty-hint">Add a report to preview it here.</p>}</div>}
        {tab==="history" && <div className="admin-preview-list"><div className="admin-add-row"><select aria-label="Configuration version" value={selectedVersion} onChange={e=>setSelectedVersion(e.target.value)}><option value="">Choose a version</option>{versions.map(v=><option key={v.version} value={v.version}>Version {v.version} · {v.summary||"Published"}</option>)}</select><button className="secondary-button" disabled={busy||!token||!selectedVersion} onClick={restoreVersion}><RefreshCw size={15}/>Restore as draft</button></div>{versions.map(v=><div className="panel admin-version-row" key={v.version}><strong>Version {v.version}</strong><small>{v.summary||"Configuration published"} · {v.created_at}</small>{v.version===version&&<span className="status-pill status-good">Current live</span>}</div>)}{!versions.length&&<p className="empty-hint">No published versions found.</p>}<p className="admin-hint">Restoring a version only replaces the draft. It does not change the live application until you publish.</p></div>}
        {tab==="fields" && <div className="admin-preview-list">{config.fields.map(f=><div className="panel"><strong>{f.label}</strong><small>{f.key} · {f.type} · {f.storage}</small></div>)}{!config.fields.length&&<p className="empty-hint">No custom fields defined.</p>}</div>}
        <div className="admin-status">{message}</div>
        <div className="admin-actions"><button className="secondary-button" onClick={()=>setConfig(published)}><Eye size={15}/>Discard draft</button><button className="secondary-button" disabled={busy || !token} onClick={saveDraft}><Save size={15}/>Save draft</button><button className="primary-button" disabled={busy || !token} onClick={publish}><Send size={15}/>Publish</button></div>
      </section>
    </div>
  </div>;
}
