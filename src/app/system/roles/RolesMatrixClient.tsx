"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Check,
  Plus,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  users: { id: string; name: string; username: string; email: string | null }[];
}

interface PermissionCatalogItem {
  key: string;
  name: string;
  desc: string;
}

interface PermissionCategory {
  category: string;
  keys: PermissionCatalogItem[];
}

export default function RolesMatrixClient() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [catalog, setCatalog] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleRecord | null>(null);

  // Form State for creating new role
  const [newRoleName, setNewRoleName] = useState("");
  const [customDeptName, setCustomDeptName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set(["ops.view", "terminal.use"]));

  useEffect(() => {
    fetch("/api/system/roles")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRoles(data.roles);
          setCatalog(data.permissionsCatalog);
          if (data.roles.length > 0) setSelectedRole(data.roles[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const togglePermission = (key: string) => {
    const next = new Set(selectedPermissions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedPermissions(next);
    soundFx.playClick();
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error("Please enter a role name");
      return;
    }

    try {
      const res = await fetch("/api/system/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          departmentName: customDeptName || "Custom Operations",
          description: roleDescription || `Custom role for ${customDeptName || "General Operations"}`,
          permissions: Array.from(selectedPermissions),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to create custom role");
        return;
      }

      const created: RoleRecord = {
        ...data.role,
        users: [],
      };

      setRoles([...roles, created]);
      setSelectedRole(created);
      soundFx.playSuccess();
      toast.success(`Created custom role "${newRoleName}" with ${selectedPermissions.size} permissions!`);
      setNewRoleName("");
      setCustomDeptName("");
      setRoleDescription("");
    } catch (err: any) {
      toast.error(err.message || "Failed to save role");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30">
              ROLE & CAPABILITY BUILDER
            </span>
            <span className="text-xs text-white/50 font-mono">CUSTOM DEPARTMENTS // ATOMIC PERMISSIONS</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Custom Department & Role Permission Matrix
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Create any custom department name without rigid sub-department hierarchies. Define custom multi-hat roles and check off the exact operational capabilities each role is allowed to access.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/40 border border-blue-500/30 text-right font-mono">
          <div className="text-[10px] text-white/50 uppercase font-bold">Total Configured Roles</div>
          <div className="text-2xl font-black text-cyan-300">{roles.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Roles List */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-bold text-white/70 uppercase tracking-wider flex items-center justify-between">
            <span>Configured Roles</span>
            <span className="text-cyan-400">{roles.length} Active</span>
          </h2>

          {loading ? (
            <div className="p-8 text-center text-xs text-white/40 font-mono">Loading roles...</div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {roles.map((role) => {
                const isSelected = selectedRole?.id === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role);
                      soundFx.playClick();
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-500/15 border-blue-400 ring-1 ring-blue-400/30"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-white">{role.name}</span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/10 text-white/80">
                        {role.permissions.length} Perms
                      </span>
                    </div>

                    <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                      {role.description || "Custom operational role"}
                    </p>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10 text-[10px] text-white/60 font-mono">
                      <span>{role.users.length} Users Assigned</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Permission Checklist & Role Creator */}
        <div className="lg:col-span-2 space-y-6">
          {/* New Custom Role Builder Form */}
          <form onSubmit={handleCreateRole} className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-mono font-bold text-white uppercase">
                  Create Custom Department Role & Assign Capabilities
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 font-bold">
                {selectedPermissions.size} Capabilities Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Custom Role Title *</label>
                <input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="E.g. Senior 5-Axis Programmer"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Custom Department / Cell Name</label>
                <input
                  value={customDeptName}
                  onChange={(e) => setCustomDeptName(e.target.value)}
                  placeholder="E.g. Titanium Machining Bay 1"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Role Summary / Notes</label>
                <input
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="E.g. Setup programs, tool wear offsets & kiosk clock-in"
                  className="w-full h-9 rounded-xl bg-black/40 border border-white/15 px-3 text-xs text-white"
                />
              </div>
            </div>

            {/* Visual Capability Checklist Grid */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-mono font-bold text-white/80 uppercase">
                Check What This Role Can Access & Perform:
              </h4>

              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {catalog.map((cat, cIdx) => (
                  <div key={cIdx} className="space-y-2 p-3.5 rounded-2xl bg-black/30 border border-white/10">
                    <div className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wide">
                      {cat.category}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.keys.map((item) => {
                        const isChecked = selectedPermissions.has(item.key);
                        return (
                          <div
                            key={item.key}
                            onClick={() => togglePermission(item.key)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isChecked
                                ? "bg-cyan-500/15 border-cyan-400 text-white"
                                : "bg-white/[0.02] hover:bg-white/[0.05] border-white/10 text-white/50"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-white">{item.name}</div>
                              <div className="text-[10px] text-white/50 leading-tight">{item.desc}</div>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-md shrink-0 flex items-center justify-center mt-0.5 ${
                                isChecked ? "bg-cyan-400 text-black" : "border border-white/20"
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button
                type="submit"
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs shadow-lg shadow-blue-500/20 cursor-pointer flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Save Custom Role & Permissions</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
