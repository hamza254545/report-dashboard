"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("partner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (mode === "admin") {
      if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
        localStorage.setItem("adstream_session", JSON.stringify({ type: "admin" }));
        router.push("/admin");
      } else {
        setError("Incorrect admin password.");
      }
      return;
    }

    setLoading(true);
    const { data, error: dbError } = await supabase
      .from("partners")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("password", password)
      .maybeSingle();
    setLoading(false);

    if (dbError || !data) {
      setError("Incorrect email or password.");
      return;
    }
    localStorage.setItem("adstream_session", JSON.stringify({ type: "partner", partner: data }));
    router.push("/dashboard");
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
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, color: "#8B93A7", marginBottom: 6 }}>Admin password</div>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}

          {error && <div style={{ color: "#FF9F5A", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
            {mode === "admin" ? "Enter Admin Panel" : "Log In"}
          </button>
        </div>
        <div style={{ textAlign: "center", color: "#5B6272", fontSize: 12, marginTop: 14 }}>Partner Reporting Portal</div>
      </div>
    </div>
  );
}
