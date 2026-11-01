import React, { useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Boxes, ChevronDown,
  CircleHelp, LayoutDashboard, Menu, Moon, MoreHorizontal, Package,
  Plus, Search, Settings, ShoppingBag, ShoppingCart, Smartphone, Sun,
  Users, Wallet, X, BookOpen, FileText, ArrowLeft, Save, CalendarDays
} from "lucide-react";

const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-PK");
const today = () => new Date().toISOString().slice(0, 10);
const displayPrice = (purchase) => {
  const value = Number(purchase || 0);
  return value >= 100000 ? value + 4000 : value >= 50000 ? value + 2000 : value + 1000;
};

const initialDevices = [
  { id: 1001, model: "iPhone 13", company: "iPhone", color: "Black", condition: "Used", status: "Available", imei: "356789104512340", purchasePrice: 150000, salePrice: 0, purchaseDate: "2026-10-20", saleDate: "" },
  { id: 1002, model: "Samsung A15", company: "Samsung", color: "Blue", condition: "Pack", status: "Available", imei: "356789104512341", purchasePrice: 42000, salePrice: 0, purchaseDate: "2026-10-22", saleDate: "" },
  { id: 1003, model: "Redmi Note 13", company: "Redmi", color: "Green", condition: "Pack", status: "Booked", imei: "356789104512342", purchasePrice: 58000, salePrice: 0, purchaseDate: "2026-10-24", saleDate: "" }
];
const initialCustomers = [
  { id: 1, name: "Ahmed Khan", mobileNumber: "03001234567", type: "Regular" },
  { id: 2, name: "Sara Raza", mobileNumber: "03217654321", type: "Account" },
  { id: 3, name: "Muhammad Hassan", mobileNumber: "03339876543", type: "Regular" }
];
const initialEntries = [
  { id: 1, customerId: 2, deviceId: 1002, date: "2026-10-25", direction: "In (+)", amount: 12000, note: "Advance / amount received" },
  { id: 2, customerId: 2, deviceId: 1002, date: "2026-10-27", direction: "Out (-)", amount: 5000, note: "Payment adjustment" },
  { id: 3, customerId: 1, deviceId: null, date: "2026-10-28", direction: "In (+)", amount: 2500, note: "Customer ledger entry" }
];
const companies = ["Vivo", "Oppo", "Realme", "Infinix", "Techno", "Itel", "Redmi", "Sego", "Samsung", "iPhone", "Other"];
const colors = ["Purple", "Pink", "Orange", "Gold", "Red", "White", "Black", "Green", "Blue"];

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem("imam-theme") || "light");
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [devices, setDevices] = useState(initialDevices);
  const [customers, setCustomers] = useState(initialCustomers);
  const [entries, setEntries] = useState(initialEntries);
  const [view, setView] = useState("list");
  const [editingId, setEditingId] = useState(null);

  const nav = [
    { title: "WORKSPACE", items: [["Dashboard", LayoutDashboard], ["Inventory", Boxes], ["Customers", Users], ["Customer Entries", BookOpen], ["Sales", ShoppingCart]] },
    { title: "MANAGEMENT", items: [["Payments", Wallet], ["Reports", Activity], ["Settings", Settings]] }
  ];
  const notify = (message = "This interface is under development. Database saving will be connected in a later phase.") => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };
  const go = (name) => { setPage(name); setQuery(""); setView("list"); setEditingId(null); setMenuOpen(false); };
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("imam-theme", next);
  };
  const filteredDevices = useMemo(() => devices.filter(d => [d.model, d.company, d.imei, d.color, d.status].join(" ").toLowerCase().includes(query.toLowerCase())), [devices, query]);
  const filteredCustomers = useMemo(() => customers.filter(c => [c.name, c.mobileNumber, c.type].join(" ").toLowerCase().includes(query.toLowerCase())), [customers, query]);
  const filteredEntries = useMemo(() => entries.filter(e => {
    const customer = customers.find(c => c.id === e.customerId);
    const device = devices.find(d => d.id === e.deviceId);
    return [customer?.name, device?.model, e.direction, e.note, e.date].join(" ").toLowerCase().includes(query.toLowerCase());
  }), [entries, customers, devices, query]);

  const openForm = (id = null) => { setEditingId(id); setView("form"); };
  const closeForm = () => { setView("list"); setEditingId(null); };
  const saveDevice = (record) => {
    if (devices.some(d => d.imei === record.imei && d.id !== editingId)) return notify("This IMEI already exists. Each device must have a unique IMEI.");
    if (editingId) setDevices(items => items.map(d => d.id === editingId ? { ...record, id: editingId } : d));
    else setDevices(items => [{ ...record, id: Math.max(1000, ...items.map(d => d.id)) + 1 }, ...items]);
    closeForm();
    notify("Device saved in this preview session. It is not yet stored in D1.");
  };
  const saveCustomer = (record) => {
    if (editingId) setCustomers(items => items.map(c => c.id === editingId ? { ...record, id: editingId } : c));
    else setCustomers(items => [{ ...record, id: Math.max(0, ...items.map(c => c.id)) + 1 }, ...items]);
    closeForm();
    notify("Customer saved in this preview session. It is not yet stored in D1.");
  };
  const saveEntry = (record) => {
    if (editingId) setEntries(items => items.map(e => e.id === editingId ? { ...record, id: editingId } : e));
    else setEntries(items => [{ ...record, id: Math.max(0, ...items.map(e => e.id)) + 1 }, ...items]);
    closeForm();
    notify("Customer entry saved in this preview session. It is not yet stored in D1.");
  };

  return <div className="app-shell" data-theme={theme}>
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={"sidebar " + (menuOpen ? "sidebar-open" : "")}>
      <div className="brand"><div className="brand-mark"><Smartphone size={21}/></div><div><strong>Imam Mobile</strong><span>SHOP MANAGEMENT</span></div><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
      <div className="development-label"><span/> UNDER DEVELOPMENT</div>
      <div className="shop-switcher"><div className="shop-avatar">IM</div><div className="shop-info"><strong>Main Store</strong><span>Retail workspace</span></div><ChevronDown size={16} className="muted-icon"/></div>
      <nav>{nav.map(group => <div className="nav-group" key={group.title}><p className="nav-label">{group.title}</p>{group.items.map(([name, Icon]) => <button key={name} className={"nav-link " + (page === name ? "active" : "")} onClick={() => go(name)}><Icon size={18}/><span>{name}</span>{name === "Inventory" && <span className="nav-count">{devices.length}</span>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18}/><strong>Development preview</strong><p>Records currently remain in this browser session.</p><button onClick={() => notify("D1 database and authentication are planned after the UI is stabilized.")}>Development plan →</button></div><div className="profile-row"><div className="profile-avatar">IB</div><div className="profile-text"><strong>Shop Admin</strong><span>Administrator · preview</span></div><MoreHorizontal size={19} className="muted-icon"/></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{page}</strong></div></div><div className="topbar-actions"><label className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={"Search " + page.toLowerCase() + "..."}/><kbd>⌘ K</kbd></label><button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme" title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>{theme === "light" ? <Moon size={18}/> : <Sun size={18}/>}</button><button className="icon-button notification-button" onClick={() => notify()} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-user"><div className="profile-avatar">IB</div><ChevronDown size={15} className="muted-icon"/></div></div></header>
      <div className="page-content">
        {page === "Dashboard" && <Dashboard go={go} devices={devices} customers={customers} entries={entries}/>}
        {page === "Inventory" && (view === "form" ? <DeviceForm initial={devices.find(d => d.id === editingId)} onSave={saveDevice} onCancel={closeForm}/> : <Inventory data={filteredDevices} all={devices} onAdd={() => openForm()} onEdit={openForm}/>)}
        {page === "Customers" && (view === "form" ? <CustomerForm initial={customers.find(c => c.id === editingId)} onSave={saveCustomer} onCancel={closeForm}/> : <Customers data={filteredCustomers} entries={entries} onAdd={() => openForm()} onEdit={openForm}/>)}
        {page === "Customer Entries" && (view === "form" ? <EntryForm initial={entries.find(e => e.id === editingId)} customers={customers} devices={devices} onSave={saveEntry} onCancel={closeForm}/> : <CustomerEntries data={filteredEntries} customers={customers} devices={devices} onAdd={() => openForm()} onEdit={openForm}/>)}
        {page === "Sales" && <Sales notify={notify}/>}
        {!["Dashboard", "Inventory", "Customers", "Customer Entries", "Sales"].includes(page) && <div className="coming-soon"><div className="coming-icon"><Settings size={25}/></div><p className="eyebrow">PLANNED MODULE</p><h1>{page}</h1><p>This section will be developed after the core inventory and customer workflows.</p><button className="primary-button" onClick={() => notify()}>Under development</button></div>}
      </div>
      <footer className="app-footer"><span>© 2026 Imam Mobile</span><span><i className="online-dot"/> Under development · Preview data only</span></footer>
    </main>
    {notice && <div className="toast"><i className="toast-dot"/>{notice}</div>}
  </div>;
}

function Heading({ eyebrow, title, subtitle, action, onAction, onBack }) {
  return <div className="page-heading"><div>{onBack && <button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Back to list</button>}<p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action && <button className="primary-button" onClick={onAction}><Plus size={17}/>{action}</button>}</div>;
}
function Stat({ title, value, change, positive, note, Icon, tone }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={"stat-icon " + tone}><Icon size={18}/></div></div><div className="stat-value">{value}</div><div className="stat-change">{positive ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}<strong className={positive ? "positive" : "negative"}>{change}</strong><span>{note}</span></div></div>;
}
function Dashboard({ go, devices, customers, entries }) {
  const available = devices.filter(d => d.status === "Available").length;
  const accountCustomers = customers.filter(c => c.type === "Account").length;
  return <><Heading eyebrow="OVERVIEW" title="Shop overview" subtitle="Your inventory and customer activity at a glance." action="Add device" onAction={() => go("Inventory")}/>
    <div className="date-line"><i className="date-dot"/> Development preview <span>·</span> Sample records</div>
    <section className="stats-grid"><Stat title="Registered devices" value={devices.length} change={available + " available"} positive note="current records" Icon={Smartphone} tone="violet"/><Stat title="Available devices" value={available} change={devices.filter(d => d.status === "Booked").length + " booked"} positive note="current stock" Icon={Package} tone="blue"/><Stat title="Customers" value={customers.length} change={accountCustomers + " account"} positive note="customer types" Icon={Users} tone="green"/><Stat title="Customer entries" value={entries.length} change="Ledger" positive note="preview records" Icon={BookOpen} tone="orange"/></section>
    <section className="dashboard-grid"><div className="panel"><div className="panel-heading"><div><h2>Inventory snapshot</h2><p>Devices grouped by current status</p></div><button className="text-link" onClick={() => go("Inventory")}>Open inventory →</button></div><div className="snapshot-list">{["Available", "Booked", "Sold Out"].map(status => <div className="snapshot-row" key={status}><span>{status}</span><strong>{devices.filter(d => d.status === status).length}</strong></div>)}</div></div>
      <div className="panel"><div className="panel-heading"><div><h2>Customer records</h2><p>Customer account overview</p></div><button className="text-link" onClick={() => go("Customers")}>View all →</button></div><div className="stock-total"><strong>{customers.length}</strong><span>registered customers</span></div><div className="stock-legend"><div><i className="legend-dot in"/>Regular<strong>{customers.filter(c => c.type === "Regular").length}</strong></div><div><i className="legend-dot low"/>Account<strong>{accountCustomers}</strong></div></div></div>
    </section>
    <section className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent customer entries</h2><p>Customer ledger activity</p></div><button className="text-link" onClick={() => go("Customer Entries")}>View all →</button></div><EntryTable rows={entries.slice(0, 3)} customers={customers} devices={devices}/></section>
  </>;
}

function Inventory({ data, all, onAdd, onEdit }) {
  const available = all.filter(d => d.status === "Available").length;
  const booked = all.filter(d => d.status === "Booked").length;
  const sold = all.filter(d => d.status === "Sold Out").length;
  return <><Heading eyebrow="DEVICE REGISTER" title="Mobile inventory" subtitle="One record per device. IMEI identifies each individual phone." action="Add device" onAction={onAdd}/>
    <div className="inventory-summary"><div><span>Total devices</span><strong>{all.length}</strong></div><div><span>Available</span><strong className="positive">{available}</strong></div><div><span>Booked</span><strong className="warning-text">{booked}</strong></div><div><span>Sold out</span><strong>{sold}</strong></div></div>
    <section className="panel table-panel"><div className="table-toolbar"><div><h2>Device list</h2><p>Search and select a record to edit · Preview data</p></div><span className="table-count">{data.length} records</span></div><div className="table-scroll"><table><thead><tr><th>MODEL / COMPANY</th><th>IMEI</th><th>COLOR</th><th>CONDITION</th><th>PURCHASE</th><th>DISPLAY PRICE</th><th>STATUS</th><th/></tr></thead><tbody>{data.map(d=><tr key={d.id}><td><div className="product-cell"><div className="product-thumb"><Smartphone size={18}/></div><div><strong>{d.model}</strong><span>{d.company} · ID {d.id}</span></div></div></td><td className="muted-cell">{d.imei}</td><td>{d.color}</td><td>{d.condition}</td><td className="price-cell">{money(d.purchasePrice)}</td><td className="price-cell">{money(displayPrice(d.purchasePrice))}</td><td><Status status={d.status}/></td><td><button className="row-action" onClick={() => onEdit(d.id)}>Edit</button></td></tr>)}{data.length===0&&<tr><td colSpan="8" className="empty-state">No devices match your search.</td></tr>}</tbody></table></div></section>
  </>;
}
function DeviceForm({ initial, onSave, onCancel }) {
  const [model, setModel] = useState(initial?.model || "");
  const [company, setCompany] = useState(initial?.company || "Vivo");
  const [color, setColor] = useState(initial?.color || "Black");
  const [condition, setCondition] = useState(initial?.condition || "Pack");
  const [status, setStatus] = useState(initial?.status || "Available");
  const [imei, setImei] = useState(initial?.imei || "");
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchasePrice ?? "");
  const [salePrice, setSalePrice] = useState(initial?.salePrice ?? "");
  const [purchaseDate, setPurchaseDate] = useState(initial?.purchaseDate || today());
  const [saleDate, setSaleDate] = useState(initial?.saleDate || "");
  const submit = (e) => { e.preventDefault(); onSave({ model: model.trim(), company, color, condition, status, imei: imei.trim(), purchasePrice: Number(purchasePrice), salePrice: Number(salePrice || 0), purchaseDate, saleDate }); };
  return <><Heading eyebrow="DEVICE REGISTER" title={initial ? "Edit device" : "Add device"} subtitle="Enter the device details. Display price is calculated automatically." onBack={onCancel}/><form className="record-form" onSubmit={submit}><div className="form-section"><div><h2>Device information</h2><p>Core identification and stock status</p></div><div className="form-grid"><Field label="Model" required><input required value={model} onChange={e=>setModel(e.target.value)} placeholder="e.g. Vivo V30"/></Field><Field label="Company" required><select value={company} onChange={e=>setCompany(e.target.value)}>{companies.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Color"><select value={color} onChange={e=>setColor(e.target.value)}>{colors.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Condition"><select value={condition} onChange={e=>setCondition(e.target.value)}><option>Pack</option><option>Used</option></select></Field><Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value)}><option>Available</option><option>Booked</option><option>Sold Out</option></select></Field><Field label="IMEI" required hint="Use the device's unique 15-digit IMEI."><input required inputMode="numeric" pattern="[0-9]{15}" maxLength="15" value={imei} onChange={e=>setImei(e.target.value.replace(/\D/g, ""))} placeholder="15-digit IMEI"/></Field></div></div><div className="form-section"><div><h2>Pricing and dates</h2><p>Purchase price, calculated display price and sale details</p></div><div className="form-grid"><Field label="Purchase price (PKR)" required><input required type="number" min="0" step="1" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} placeholder="0"/></Field><Field label="Display price (calculated)"><input readOnly value={purchasePrice === "" ? "" : money(displayPrice(purchasePrice))}/></Field><Field label="Sale price (PKR)"><input type="number" min="0" step="1" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="Not sold yet"/></Field><Field label="Purchase date"><input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)}/></Field><Field label="Sale date"><input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)}/></Field></div></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit"><Save size={16}/>Save device</button></div></form></>;
}
function Customers({ data, entries, onAdd, onEdit }) {
  return <><Heading eyebrow="CUSTOMER REGISTER" title="Customers" subtitle="Customer profiles and account balances." action="Add customer" onAction={onAdd}/><div className="inventory-summary"><div><span>Total customers</span><strong>{data.length}</strong></div><div><span>Regular</span><strong>{data.filter(c=>c.type==="Regular").length}</strong></div><div><span>Account</span><strong>{data.filter(c=>c.type==="Account").length}</strong></div><div><span>Ledger entries</span><strong>{entries.length}</strong></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h2>Customer directory</h2><p>Customer details with calculated ledger balance</p></div><span className="table-count">{data.length} records</span></div><div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>MOBILE NUMBER</th><th>TYPE</th><th>TOTAL DEBIT · IN (+)</th><th>TOTAL CREDIT · OUT (-)</th><th>BALANCE</th><th/></tr></thead><tbody>{data.map(c=>{const related=entries.filter(e=>e.customerId===c.id);const debit=related.filter(e=>e.direction==="In (+)").reduce((s,e)=>s+Number(e.amount),0);const credit=related.filter(e=>e.direction==="Out (-)").reduce((s,e)=>s+Number(e.amount),0);return <tr key={c.id}><td><div className="customer-cell"><div className="customer-avatar">{c.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}</div><strong>{c.name}</strong></div></td><td className="muted-cell">{c.mobileNumber}</td><td><Status status={c.type}/></td><td>{money(debit)}</td><td>{money(credit)}</td><td className="price-cell">{money(credit-debit)}</td><td><button className="row-action" onClick={()=>onEdit(c.id)}>Edit</button></td></tr>})}{data.length===0&&<tr><td colSpan="7" className="empty-state">No customers match your search.</td></tr>}</tbody></table></div></section></>;
}
function CustomerForm({ initial, onSave, onCancel }) {
  const [name,setName]=useState(initial?.name||"");
  const [mobileNumber,setMobileNumber]=useState(initial?.mobileNumber||"");
  const [type,setType]=useState(initial?.type||"Regular");
  return <><Heading eyebrow="CUSTOMER REGISTER" title={initial?"Edit customer":"Add customer"} subtitle="Save the customer's basic contact information." onBack={onCancel}/><form className="record-form compact-form" onSubmit={e=>{e.preventDefault();onSave({name:name.trim(),mobileNumber:mobileNumber.trim(),type});}}><div className="form-section"><div><h2>Customer information</h2><p>Customer name, mobile number and account type</p></div><div className="form-grid"><Field label="Customer name" required><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></Field><Field label="Mobile number" required hint="Use a consistent format, e.g. 03XXXXXXXXX."><input required inputMode="tel" value={mobileNumber} onChange={e=>setMobileNumber(e.target.value)} placeholder="03XXXXXXXXX"/></Field><Field label="Customer type"><select value={type} onChange={e=>setType(e.target.value)}><option>Regular</option><option>Account</option></select></Field></div></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit"><Save size={16}/>Save customer</button></div></form></>;
}
function CustomerEntries({ data, customers, devices, onAdd, onEdit }) {
  return <><Heading eyebrow="CUSTOMER LEDGER" title="Customer entries" subtitle="Record amounts against customers and optionally link a device." action="Add entry" onAction={onAdd}/><div className="inventory-summary"><div><span>Total entries</span><strong>{data.length}</strong></div><div><span>In (+)</span><strong className="positive">{data.filter(e=>e.direction==="In (+)").length}</strong></div><div><span>Out (-)</span><strong className="warning-text">{data.filter(e=>e.direction==="Out (-)").length}</strong></div><div><span>Customers linked</span><strong>{new Set(data.map(e=>e.customerId)).size}</strong></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h2>Ledger records</h2><p>Each entry belongs to one customer; device link is optional.</p></div><span className="table-count">{data.length} records</span></div><EntryTable rows={data} customers={customers} devices={devices} onEdit={onEdit}/></section></>;
}
function EntryTable({ rows, customers, devices, onEdit }) {
  return <div className="table-scroll"><table><thead><tr><th>ENTRY</th><th>CUSTOMER</th><th>RELATED DEVICE</th><th>DATE</th><th>ENTRY TYPE</th><th>AMOUNT</th><th>NOTE</th>{onEdit&&<th/>}</tr></thead><tbody>{rows.map(e=>{const customer=customers.find(c=>c.id===e.customerId);const device=devices.find(d=>d.id===e.deviceId);return <tr key={e.id}><td className="invoice-id">CE-{String(e.id).padStart(4,"0")}</td><td>{customer?.name||"Unknown customer"}</td><td className="muted-cell">{device?device.model+" · "+device.imei:"—"}</td><td className="muted-cell">{e.date}</td><td><Status status={e.direction}/></td><td className="price-cell">{money(e.amount)}</td><td className="muted-cell">{e.note||"—"}</td>{onEdit&&<td><button className="row-action" onClick={()=>onEdit(e.id)}>Edit</button></td>}</tr>})}{rows.length===0&&<tr><td colSpan={onEdit?8:7} className="empty-state">No customer entries found.</td></tr>}</tbody></table></div>;
}
function EntryForm({ initial, customers, devices, onSave, onCancel }) {
  const [customerId,setCustomerId]=useState(String(initial?.customerId||customers[0]?.id||""));
  const [deviceId,setDeviceId]=useState(initial?.deviceId?String(initial.deviceId):"");
  const [date,setDate]=useState(initial?.date||today());
  const [direction,setDirection]=useState(initial?.direction||"In (+)");
  const [amount,setAmount]=useState(initial?.amount??"");
  const [note,setNote]=useState(initial?.note||"");
  return <><Heading eyebrow="CUSTOMER LEDGER" title={initial?"Edit customer entry":"Add customer entry"} subtitle="Link a financial entry to a customer and, if relevant, a device." onBack={onCancel}/><form className="record-form compact-form" onSubmit={e=>{e.preventDefault();onSave({customerId:Number(customerId),deviceId:deviceId?Number(deviceId):null,date,direction,amount:Number(amount),note:note.trim()});}}><div className="form-section"><div><h2>Entry details</h2><p>Customer and ledger movement</p></div><div className="form-grid"><Field label="Customer" required><select required value={customerId} onChange={e=>setCustomerId(e.target.value)}>{customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.mobileNumber}</option>)}</select></Field><Field label="Related device"><select value={deviceId} onChange={e=>setDeviceId(e.target.value)}><option value="">No device linked</option>{devices.map(d=><option key={d.id} value={d.id}>{d.model} · {d.imei}</option>)}</select></Field><Field label="Entry date" required><input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Entry type" required><select value={direction} onChange={e=>setDirection(e.target.value)}><option>In (+)</option><option>Out (-)</option></select></Field><Field label="Amount (PKR)" required><input required type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/></Field><Field label="Note"><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason or reference"/></Field></div></div><div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" type="submit" disabled={!customers.length}><Save size={16}/>Save entry</button></div></form></>;
}
function Field({ label, required, hint, children }) {
  return <label className="form-field"><span>{label}{required&&<b> *</b>}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
function Sales({ notify }) {
  return <><Heading eyebrow="CHECKOUT" title="Sales" subtitle="Sales and invoice workflows will be connected after the inventory and customer modules."/><div className="coming-soon inline-coming"><div className="coming-icon"><ShoppingCart size={25}/></div><h2>Sales module planned</h2><p>Device sale, invoice generation, payment allocation and automatic stock updates are part of the next functionality phase.</p><button className="secondary-button" onClick={()=>notify()}>Under development</button></div></>;
}
function Status({ status }) {
  const cls = ["Paid", "In stock", "Available", "Regular", "Out (-)"].includes(status) ? "status-good" : ["Pending", "Low stock", "Booked", "Account", "In (+)"].includes(status) ? "status-warning" : "status-danger";
  return <span className={"status-pill " + cls}><i/>{status}</span>;
}
