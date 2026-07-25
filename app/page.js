"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Lock, Loader2 } from "lucide-react";
import { apiFetch, setStoredSession } from "@/lib/apiClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("partner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (mode === "admin") {
        const { token } = await apiFetch("/api/auth/admin-login", {
          method: "POST",
          body: JSON.stringify({ password }),
        });
        setStoredSession({ type: "admin", token });
        router.push("/admin");
      } else {
        const { token, partner } = await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setStoredSession({ type: "partner", token, partner });
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360 }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <Radio size={18} color="#2DE1C2" />
          <span style={{ fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, fontSize: 16 }}>AdStreamHQ</span>
        </div>
        <div className="card">
          <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "#0A0E14", borderRadius: 8, padding: 3 }}>
            {["partner", "admin"].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer",
                  background: mode === m ? "#2DE1C2" : "transparent",
                  color: mode === m ? "#0A0E14" : "#8B93A7",
                  fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, textTransform: "capitalize",
                }}
              >
                {m} Login
              </button>
            ))}
          </div>

          {mode === "partner" ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, color: "#8B93A7", marginBottom: 6 }}>Email</div>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="partner@example.com" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, color: "#8B93A7", marginBottom: 6 }}>Password</div>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: "#8B93A7", marginBottom: 6 }}>Admin password</div>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            </div>
          )}

          {error && <div style={{ color: "#FF9F5A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
            {mode === "admin" ? "Enter Admin Panel" : "Log In"}
          </button>
        </div>
        <div style={{ textAlign: "center", color: "#5B6272", fontSize: 12, marginTop: 14 }}>Publisher Reporting Portal</div>
      </div>
    </div>
  );
}
