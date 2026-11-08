import React from "react";
import { createRoot } from "react-dom/client";
import "@cloudflare/kumo/styles/standalone";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Table } from "@cloudflare/kumo/components/table";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Pagination } from "@cloudflare/kumo/components/pagination";
import { Badge } from "@cloudflare/kumo/components/badge";
import { HouseIcon, DatabaseIcon, UsersIcon, MagnifyingGlassIcon, ArrowClockwiseIcon, GearIcon, DotsThreeIcon } from "@phosphor-icons/react";

const rows = [["Galaxy A15", "Samsung", "350000000010001", "40,000", "Available"], ["Redmi 13C", "Redmi", "350000000010002", "28,500", "Sold Out"]];
const mode = new URLSearchParams(location.search).get("mode") || "light";
document.documentElement.setAttribute("data-mode", mode);
function App() {
  return (
    <Sidebar.Provider defaultOpen className="min-h-screen">
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Imam Mobile</Sidebar.GroupLabel>
            <Sidebar.Menu>
              <Sidebar.MenuButton icon={HouseIcon}>Dashboard</Sidebar.MenuButton>
              <Sidebar.MenuButton icon={DatabaseIcon} active>Inventory</Sidebar.MenuButton>
              <Sidebar.MenuButton icon={UsersIcon}>Customers <Badge>New</Badge></Sidebar.MenuButton>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar>
      <main style={{ padding: 24, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div><h1 style={{ fontSize: 24, fontWeight: 600 }}>Inventory</h1><p>Devices in stock</p></div>
          <Button variant="primary">Add device</Button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input aria-label="Search" placeholder="Search devices" style={{ flex: 1 }} />
          <Button shape="square" aria-label="Refresh" icon={ArrowClockwiseIcon} />
        </div>
        <Table>
          <Table.Header><Table.Row><Table.Head>Model</Table.Head><Table.Head>Company</Table.Head><Table.Head>IMEI</Table.Head><Table.Head>Price</Table.Head><Table.Head>Status</Table.Head><Table.Head><GearIcon /></Table.Head></Table.Row></Table.Header>
          <Table.Body>{rows.map((r) => <Table.Row key={r[2]}>{r.map((c, i) => <Table.Cell key={i}>{c}</Table.Cell>)}<Table.Cell><DotsThreeIcon /></Table.Cell></Table.Row>)}</Table.Body>
        </Table>
        <Pagination page={1} setPage={() => {}} perPage={25} totalCount={2}><Pagination.Info>{({ pageShowingRange, totalCount }) => `Showing ${pageShowingRange} of ${totalCount}`}</Pagination.Info><Pagination.Controls /></Pagination>
      </main>
    </Sidebar.Provider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
