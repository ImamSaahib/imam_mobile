import React, { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Bell, Boxes, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, Menu, Moon, MoreHorizontal, Package, Plus, Search, Settings, ShoppingBag, ShoppingCart, Smartphone, Sun, Users, Wallet, X } from "lucide-react";

const products = [
  { id:"IM-1001", name:"iPhone 13", detail:"128GB · Midnight", category:"Smartphone", stock:4, price:184000, status:"Low stock" },
  { id:"IM-1002", name:"Samsung A15", detail:"128GB · Blue", category:"Smartphone", stock:12, price:48999, status:"In stock" },
  { id:"IM-1003", name:"USB-C Fast Charger", detail:"25W · Original", category:"Accessory", stock:2, price:4200, status:"Low stock" },
  { id:"IM-1004", name:"AirPods Pro Case", detail:"Silicone · Black", category:"Accessory", stock:0, price:950, status:"Out of stock" },
  { id:"IM-1005", name:"Redmi Note 13", detail:"256GB · Green", category:"Smartphone", stock:8, price:62999, status:"In stock" }
];
const customers = [
  { initials:"AK", name:"Ahmed Khan", phone:"+92 300 1234567", orders:8, spent:428000 },
  { initials:"SR", name:"Sara Raza", phone:"+92 321 7654321", orders:3, spent:156000 },
  { initials:"MH", name:"Muhammad Hassan", phone:"+92 333 9876543", orders:5, spent:214500 },
  { initials:"FA", name:"Fatima Ali", phone:"+92 312 4567890", orders:2, spent:89000 }
];
const sales = [
  { id:"INV-2048", customer:"Ahmed Khan", item:"iPhone 13 · 128GB", date:"Today, 11:42 AM", amount:184000, status:"Paid" },
  { id:"INV-2047", customer:"Walk-in customer", item:"Samsung A15 · 128GB", date:"Today, 10:18 AM", amount:48999, status:"Paid" },
  { id:"INV-2046", customer:"Sara Raza", item:"Fast charger · 25W", date:"Yesterday", amount:4200, status:"Pending" },
  { id:"INV-2045", customer:"Muhammad Hassan", item:"Redmi Note 13", date:"Yesterday", amount:62999, status:"Paid" }
];
const money = (n) => "Rs. " + Number(n).toLocaleString("en-PK");

export default function App() {
  const [page,setPage] = useState("Dashboard");
  const [theme,setTheme] = useState(() => localStorage.getItem("imam-theme") || "light");
  const [query,setQuery] = useState("");
  const [menuOpen,setMenuOpen] = useState(false);
  const [notice,setNotice] = useState("");
  const nav = [{ title:"WORKSPACE", items:[["Dashboard",LayoutDashboard],["Inventory",Boxes],["Customers",Users],["Sales",ShoppingCart]] },{ title:"MANAGEMENT", items:[["Payments",Wallet],["Reports",Activity],["Settings",Settings]] }];
  const notify = () => { setNotice("Preview only: this action will be connected to the database in the next phase."); window.setTimeout(() => setNotice(""),3500); };
  const go = (name) => { setPage(name); setQuery(""); setMenuOpen(false); };
  const toggleTheme = () => { const next = theme === "light" ? "dark" : "light"; setTheme(next); localStorage.setItem("imam-theme",next); };
  const filteredProducts = useMemo(() => products.filter(p => (p.name+p.category+p.id).toLowerCase().includes(query.toLowerCase())),[query]);
  const filteredCustomers = useMemo(() => customers.filter(c => (c.name+c.phone).toLowerCase().includes(query.toLowerCase())),[query]);

  return <div className="app-shell" data-theme={theme}>
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={"sidebar " + (menuOpen ? "sidebar-open" : "")}>
      <div className="brand"><div className="brand-mark"><Smartphone size={21}/></div><div><strong>Imam Mobile</strong><span>SHOP MANAGEMENT</span></div><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
      <div className="shop-switcher"><div className="shop-avatar">IM</div><div className="shop-info"><strong>Main Store</strong><span>Retail workspace</span></div><ChevronDown size={16} className="muted-icon"/></div>
      <nav>{nav.map(group => <div className="nav-group" key={group.title}><p className="nav-label">{group.title}</p>{group.items.map(([name,Icon]) => <button key={name} className={"nav-link " + (page===name?"active":"")} onClick={() => go(name)}><Icon size={18}/><span>{name}</span>{name==="Inventory" && <span className="nav-count">5</span>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18}/><strong>Need help?</strong><p>Get help setting up your shop.</p><button onClick={notify}>View guide →</button></div><div className="profile-row"><div className="profile-avatar">IB</div><div className="profile-text"><strong>Shop Admin</strong><span>Administrator</span></div><MoreHorizontal size={19} className="muted-icon"/></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{page}</strong></div></div><div className="topbar-actions"><label className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={"Search " + page.toLowerCase() + "..."}/><kbd>⌘ K</kbd></label><button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme" title={theme==="light"?"Switch to dark theme":"Switch to light theme"}>{theme==="light"?<Moon size={18}/>:<Sun size={18}/>}</button><button className="icon-button notification-button" onClick={notify} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-user"><div className="profile-avatar">IB</div><ChevronDown size={15} className="muted-icon"/></div></div></header>
      <div className="page-content">
        {page==="Dashboard" && <Dashboard go={go} notify={notify}/>}
        {page==="Inventory" && <Inventory data={filteredProducts} notify={notify}/>}
        {page==="Customers" && <Customers data={filteredCustomers} notify={notify}/>}
        {page==="Sales" && <Sales notify={notify}/>}
        {!["Dashboard","Inventory","Customers","Sales"].includes(page) && <div className="coming-soon"><div className="coming-icon"><Settings size={25}/></div><p className="eyebrow">WORKSPACE</p><h1>{page}</h1><p>This section is planned for the next development phase.</p><button className="primary-button" onClick={notify}>Preview status</button></div>}
      </div>
      <footer className="app-footer"><span>© 2026 Imam Mobile</span><span><i className="online-dot"/> Preview environment</span></footer>
    </main>
    {notice && <div className="toast"><i className="toast-dot"/>{notice}</div>}
  </div>;
}

function Heading({eyebrow,title,subtitle,action,onAction}) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action && <button className="primary-button" onClick={onAction}><Plus size={17}/>{action}</button>}</div>;
}
function Stat({title,value,change,positive,note,Icon,tone}) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={"stat-icon "+tone}><Icon size={18}/></div></div><div className="stat-value">{value}</div><div className="stat-change">{positive?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>}<strong className={positive?"positive":"negative"}>{change}</strong><span>{note}</span></div></div>;
}
function Dashboard({go,notify}) {
  return <><Heading eyebrow="OVERVIEW" title="Good morning, Admin 👋" subtitle="Here’s what’s happening in your shop today." action="New sale" onAction={()=>go("Sales")}/>
    <div className="date-line"><i className="date-dot"/> Saturday, October 31, 2026 <span>·</span> Store overview</div>
    <section className="stats-grid"><Stat title="Total sales" value="Rs. 284,500" change="+12.8%" positive note="vs. last month" Icon={Wallet} tone="violet"/><Stat title="Total orders" value="38" change="+8.2%" positive note="vs. last month" Icon={ShoppingBag} tone="blue"/><Stat title="Products in stock" value="126" change="-2.4%" note="vs. last month" Icon={Package} tone="orange"/><Stat title="Registered customers" value="84" change="+16.5%" positive note="vs. last month" Icon={Users} tone="green"/></section>
    <section className="dashboard-grid"><div className="panel"><div className="panel-heading"><div><h2>Sales overview</h2><p>Revenue performance over the last 7 days</p></div><button className="select-button">This week <ChevronDown size={14}/></button></div><div className="chart-summary"><strong>Rs. 284,500</strong><span className="trend-positive"><ArrowUpRight size={15}/>12.8%</span><span className="summary-caption">Total revenue</span></div><div className="chart-wrap"><div className="chart-y-labels"><span>80k</span><span>60k</span><span>40k</span><span>20k</span><span>0</span></div><div className="chart"><div className="chart-gridlines"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 640 190" preserveAspectRatio="none" aria-label="Illustrative weekly sales chart"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6658e8" stopOpacity=".22"/><stop offset="100%" stopColor="#6658e8" stopOpacity="0"/></linearGradient></defs><path d="M0 145 C35 132 48 145 80 115 S135 130 160 100 S215 115 240 84 S295 98 320 70 S375 98 400 78 S455 88 480 48 S535 70 560 38 S610 55 640 20 L640 190 L0 190Z" fill="url(#fill)"/><path d="M0 145 C35 132 48 145 80 115 S135 130 160 100 S215 115 240 84 S295 98 320 70 S375 98 400 78 S455 88 480 48 S535 70 560 38 S610 55 640 20" fill="none" stroke="#7164e8" strokeWidth="3" strokeLinecap="round"/></svg><div className="chart-x-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div></div>
      <div className="panel stock-panel"><div className="panel-heading"><div><h2>Stock summary</h2><p>Current inventory status</p></div><button className="more-button" onClick={notify}><MoreHorizontal size={20}/></button></div><div className="stock-total"><strong>126</strong><span>total products</span></div><div className="stock-bar"><i className="bar-in"/><i className="bar-low"/><i className="bar-out"/></div><div className="stock-legend"><div><i className="legend-dot in"/>In stock<strong>98</strong></div><div><i className="legend-dot low"/>Low stock<strong>21</strong></div><div><i className="legend-dot out"/>Out of stock<strong>7</strong></div></div><button className="text-link" onClick={()=>go("Inventory")}>View inventory →</button></div>
    </section>
    <section className="panel transactions-panel"><div className="panel-heading"><div><h2>Recent transactions</h2><p>Latest sales from your store</p></div><button className="text-link" onClick={()=>go("Sales")}>View all →</button></div><TransactionTable compact/></section>
  </>;
}
function Inventory({data,notify}) {
  return <><Heading eyebrow="PRODUCTS" title="Inventory" subtitle="Manage your mobile phones, accessories and spare parts." action="Add product" onAction={notify}/><div className="inventory-summary"><div><span>Total products</span><strong>126</strong></div><div><span>Low stock</span><strong className="warning-text">21</strong></div><div><span>Out of stock</span><strong className="danger-text">7</strong></div><div><span>Inventory value</span><strong>Rs. 4.82M</strong></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h2>All products</h2><p>Sample inventory records</p></div><button className="filter-button" onClick={notify}>Filter <ChevronDown size={14}/></button></div><div className="table-scroll"><table><thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>STOCK</th><th>SELLING PRICE</th><th>STATUS</th></tr></thead><tbody>{data.map(p=><tr key={p.id}><td><div className="product-cell"><div className="product-thumb"><Smartphone size={18}/></div><div><strong>{p.name}</strong><span>{p.detail}</span></div></div></td><td className="muted-cell">{p.id}</td><td>{p.category}</td><td><strong>{p.stock}</strong> <span className="muted-cell">units</span></td><td className="price-cell">{money(p.price)}</td><td><Status status={p.status}/></td></tr>)}{data.length===0&&<tr><td colSpan="6" className="empty-state">No products match your search.</td></tr>}</tbody></table></div></section></>;
}
function Customers({data,notify}) {
  return <><Heading eyebrow="RELATIONSHIPS" title="Customers" subtitle="Keep customer details and purchase history organized." action="Add customer" onAction={notify}/><div className="inventory-summary"><div><span>Total customers</span><strong>84</strong></div><div><span>New this month</span><strong className="positive">+12</strong></div><div><span>Repeat customers</span><strong>36</strong></div><div><span>Lifetime sales</span><strong>Rs. 2.6M</strong></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h2>Customer directory</h2><p>Sample customer records</p></div><button className="filter-button" onClick={notify}>Export <ChevronDown size={14}/></button></div><div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>ORDERS</th><th>TOTAL SPENT</th></tr></thead><tbody>{data.map(c=><tr key={c.phone}><td><div className="customer-cell"><div className="customer-avatar">{c.initials}</div><strong>{c.name}</strong></div></td><td className="muted-cell">{c.phone}</td><td>{c.orders}</td><td className="price-cell">{money(c.spent)}</td></tr>)}{data.length===0&&<tr><td colSpan="4" className="empty-state">No customers match your search.</td></tr>}</tbody></table></div></section></>;
}
function Sales({notify}) {
  return <><Heading eyebrow="CHECKOUT" title="Sales" subtitle="Review transactions and manage customer invoices." action="Create invoice" onAction={notify}/><div className="inventory-summary"><div><span>Sales today</span><strong>Rs. 284,500</strong></div><div><span>Transactions</span><strong>14</strong></div><div><span>Paid</span><strong className="positive">12</strong></div><div><span>Pending</span><strong className="warning-text">2</strong></div></div><section className="panel table-panel"><div className="table-toolbar"><div><h2>Recent transactions</h2><p>Sample sales records</p></div><button className="filter-button" onClick={notify}>Date range <ChevronDown size={14}/></button></div><TransactionTable/></section></>;
}
function TransactionTable({compact=false}) {
  const rows=compact?sales.slice(0,3):sales;
  return <div className="table-scroll"><table><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>ITEM</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td className="invoice-id">{t.id}</td><td>{t.customer}</td><td className="muted-cell">{t.item}</td><td className="muted-cell">{t.date}</td><td className="price-cell">{money(t.amount)}</td><td><Status status={t.status}/></td></tr>)}</tbody></table></div>;
}
function Status({status}) {
  const cls=status==="Paid"||status==="In stock"?"status-good":status==="Pending"||status==="Low stock"?"status-warning":"status-danger";
  return <span className={"status-pill "+cls}><i/>{status}</span>;
}
