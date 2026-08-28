"use client";
import { useState, useEffect } from "react";
import { Loader2, Upload, Save } from "lucide-react";

export default function BrandingTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    appName: "Manufacturing Max",
    tagline: "Enterprise Manufacturing Suite",
    logoUrl: "",
    accentColor: "#3b82f6",
    companyName: "Apex Manufacturing Ltd",
    companyGstin: "27AAACA12341Z1",
    companyAddress:
      "100 Industrial Parkway, MIDC Industrial Area, Pune 411018, Maharashtra",
    companyState: "Maharashtra",
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.branding) {
          setSettings({
            appName: data.branding.appName || "Manufacturing Max",
            tagline: data.branding.tagline || "OEE & Downtime Tracking",
            logoUrl: data.branding.logoUrl || "",
            accentColor: data.branding.accentColor || "#3b82f6",
            companyName: data.branding.companyName || "Apex Manufacturing Ltd",
            companyGstin: data.branding.companyGstin || "27AAACA12341Z1",
            companyAddress:
              data.branding.companyAddress ||
              "100 Industrial Parkway, MIDC Industrial Area, Pune 411018, Maharashtra",
            companyState: data.branding.companyState || "Maharashtra",
          });
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding: settings }),
      });
      alert("Settings saved. Please refresh the page to see changes.");
    } catch (e) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setSettings({ ...settings, logoUrl: data.url });
      }
    } catch (e) {
      alert("Failed to upload logo");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl bg-slate-800/60 shadow-sm border border-slate-700 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-6">Branding Settings</h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">App Name</label>
          <input
            type="text"
            value={settings.appName}
            onChange={(e) =>
              setSettings({ ...settings, appName: e.target.value })
            }
            className="w-full border border-slate-600 rounded p-2 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tagline</label>
          <input
            type="text"
            value={settings.tagline}
            onChange={(e) =>
              setSettings({ ...settings, tagline: e.target.value })
            }
            className="w-full border border-slate-600 rounded p-2 bg-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Logo</label>
          <div className="flex items-center gap-4">
            {settings.logoUrl && (
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="h-12 w-auto object-contain bg-slate-800/60 rounded p-1"
              />
            )}
            <label className="cursor-pointer bg-slate-100 hover:bg-slate-800/60 hover:bg-slate-700 px-4 py-2 rounded font-medium flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Logo
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Accent Color</label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={settings.accentColor}
              onChange={(e) =>
                setSettings({ ...settings, accentColor: e.target.value })
              }
              className="h-10 w-20 cursor-pointer rounded"
            />
            <div className="flex gap-2">
              {["#3b82f6", "#10b981", "#f43f5e", "#f59e0b", "#8b5cf6"].map(
                (color) => (
                  <button
                    key={color}
                    onClick={() =>
                      setSettings({ ...settings, accentColor: color })
                    }
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ),
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Company Legal Name
          </label>
          <input
            type="text"
            value={settings.companyName}
            onChange={(e) =>
              setSettings({ ...settings, companyName: e.target.value })
            }
            className="w-full border border-slate-600 rounded p-2 bg-transparent font-semibold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Company GSTIN Number
            </label>
            <input
              type="text"
              placeholder="e.g. 27AAACA12341Z1"
              value={settings.companyGstin}
              onChange={(e) =>
                setSettings({ ...settings, companyGstin: e.target.value })
              }
              className="w-full border border-slate-600 rounded p-2 bg-transparent font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Company State
            </label>
            <input
              type="text"
              placeholder="e.g. Maharashtra"
              value={settings.companyState}
              onChange={(e) =>
                setSettings({ ...settings, companyState: e.target.value })
              }
              className="w-full border border-slate-600 rounded p-2 bg-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Company Registered Address
          </label>
          <textarea
            rows={2}
            value={settings.companyAddress}
            onChange={(e) =>
              setSettings({ ...settings, companyAddress: e.target.value })
            }
            className="w-full border border-slate-600 rounded p-2 bg-transparent text-xs"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold"
          style={{ backgroundColor: settings.accentColor }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Branding &amp; Legal Info
        </button>
      </div>
    </div>
  );
}
