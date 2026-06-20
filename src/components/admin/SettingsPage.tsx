import { useState } from "react";
import { Check, Download, Archive, Smartphone, Mail, MessageCircle, Globe } from "lucide-react";
import { Btn, Input, Sel, Card } from "../ui";
import { FLabel } from "../ui";

type SettingsTab = "institute" | "notifications" | "integrations" | "system";

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("institute");
  const [saved, setSaved] = useState(false);
  const [inst, setInst] = useState({
    name: "Sudath Kumara Combined Mathematics Institute",
    tagline: "Advanced Level Combined Mathematics",
    address: "No. 15, Kandy Road, Kiribathgoda, Gampaha",
    phone: "0771234567",
    email: "info@mathsinstitute.lk",
    website: "www.mathsinstitute.lk",
    year: "2025",
  });

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: "institute",     label: "Institute" },
    { id: "notifications", label: "Notifications" },
    { id: "integrations",  label: "Integrations" },
    { id: "system",        label: "System" },
  ];

  const NOTIFICATIONS = [
    { label: "Fee due reminders",          desc: "Send reminders when student fees are due",           defaultOn: true },
    { label: "Attendance alerts",          desc: "Alert parents when student is absent",               defaultOn: true },
    { label: "Result published notifications", desc: "Notify students when marks are published",       defaultOn: true },
    { label: "Material upload notifications", desc: "Notify students when new materials are uploaded", defaultOn: false },
    { label: "Class schedule announcements", desc: "Send class schedule updates and changes",          defaultOn: true },
  ];

  const INTEGRATIONS = [
    { name: "WhatsApp Business", icon: Smartphone, desc: "Send messages via WhatsApp Business API", color: "emerald", configured: false },
    { name: "Email (SMTP)",      icon: Mail,       desc: "Configure SMTP server for email notifications", color: "blue",   configured: true },
    { name: "SMS Gateway",       icon: MessageCircle, desc: "Send SMS via local telecom gateway",      color: "amber",  configured: false },
    { name: "Google Drive",      icon: Globe,      desc: "Store and share learning materials on Drive", color: "navy",  configured: true },
  ] as const;

  const iconColor = (c: string) => ({
    emerald: { bg: "bg-emerald-100", text: "text-emerald-600" },
    blue:    { bg: "bg-blue-100",    text: "text-blue-600" },
    amber:   { bg: "bg-amber-100",   text: "text-amber-600" },
    navy:    { bg: "bg-primary/10",  text: "text-primary" },
  }[c] ?? { bg: "bg-muted", text: "text-muted-foreground" });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your institute system</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <Btn key={t.id} v={tab === t.id ? "primary" : "outline"} sz="sm" onClick={() => setTab(t.id)}>
            {t.label}
          </Btn>
        ))}
      </div>

      {tab === "institute" && (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-5">Institute Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><FLabel>Institute Name</FLabel><Input value={inst.name} onChange={(e) => setInst((i) => ({ ...i, name: e.target.value }))} /></div>
            <div className="sm:col-span-2"><FLabel>Tagline</FLabel><Input value={inst.tagline} onChange={(e) => setInst((i) => ({ ...i, tagline: e.target.value }))} /></div>
            <div className="sm:col-span-2"><FLabel>Address</FLabel><Input value={inst.address} onChange={(e) => setInst((i) => ({ ...i, address: e.target.value }))} /></div>
            <div><FLabel>Phone</FLabel><Input value={inst.phone} onChange={(e) => setInst((i) => ({ ...i, phone: e.target.value }))} /></div>
            <div><FLabel>Email</FLabel><Input value={inst.email} onChange={(e) => setInst((i) => ({ ...i, email: e.target.value }))} /></div>
            <div><FLabel>Website</FLabel><Input value={inst.website} onChange={(e) => setInst((i) => ({ ...i, website: e.target.value }))} /></div>
            <div><FLabel>Academic Year</FLabel><Input value={inst.year} onChange={(e) => setInst((i) => ({ ...i, year: e.target.value }))} /></div>
          </div>
          <div className="mt-5">
            <Btn onClick={save}>{saved ? <><Check className="w-4 h-4" />Saved!</> : "Save Changes"}</Btn>
          </div>
        </Card>
      )}

      {tab === "notifications" && (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-5">Notification Preferences</h2>
          <div className="space-y-1">
            {NOTIFICATIONS.map(({ label, desc, defaultOn }) => (
              <div key={label} className="flex items-start justify-between gap-4 py-3 border-b border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <input type="checkbox" defaultChecked={defaultOn} className="mt-1 shrink-0" />
              </div>
            ))}
          </div>
          <Btn className="mt-5" onClick={save}>{saved ? <><Check className="w-4 h-4" />Saved!</> : "Save Changes"}</Btn>
        </Card>
      )}

      {tab === "integrations" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INTEGRATIONS.map(({ name, icon: Icon, desc, color, configured }) => {
            const { bg, text } = iconColor(color);
            return (
              <Card key={name} className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                    <Icon className={`w-5 h-5 ${text}`} />
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${configured ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {configured ? "Configured" : "Not Set Up"}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground">{name}</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3">{desc}</p>
                <Btn v="outline" sz="sm">{configured ? "Edit Configuration" : "Configure"}</Btn>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "system" && (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-5">System Settings</h2>
          <div className="space-y-1">
            {[
              { label: "QR Code Size",  value: "256×256 px" },
              { label: "Date Format",   value: "DD MMM YYYY" },
              { label: "Currency",      value: "LKR (Sri Lankan Rupee)" },
            ].map(({ label, value }) => (
              <div key={label} className="grid grid-cols-2 gap-4 items-center py-3 border-b border-border/50">
                <label className="text-sm font-medium">{label}</label>
                <Sel defaultValue={value}><option>{value}</option></Sel>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Data Management</h3>
            <div className="flex gap-3">
              <Btn v="outline" sz="sm"><Download className="w-4 h-4" />Export Backup</Btn>
              <Btn v="outline" sz="sm"><Archive className="w-4 h-4" />View System Logs</Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
