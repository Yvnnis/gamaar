"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

type Message = {
  role: "user" | "oracle";
  content: string;
};

export default function OracleWidget() {
  // État d'ouverture du chat
  const [isOpen, setIsOpen] = useState(false);
  
  // États du chat
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "oracle", content: "L'Oracle t'écoute. Une envie de film ? 🔮" }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Avatar utilisateur
  const [userAvatar, setUserAvatar] = useState("https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png");

  // Charger l'avatar au démarrage
  useEffect(() => {
    const loadAvatar = async () => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase.from("profiles").select("avatar_url").eq("id", session.user.id).single();
            if (data?.avatar_url) setUserAvatar(data.avatar_url);
        }
    };
    loadAvatar();
  }, []);

  // Auto-scroll vers le bas
  useEffect(() => {
    if (isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "oracle", content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: "oracle", content: "Erreur de connexion..." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 9999, fontFamily: "sans-serif" }}>
      
      {/* --- FENÊTRE DE CHAT (Affichée seulement si isOpen est true) --- */}
      {isOpen && (
        <div style={{ 
            marginBottom: "15px", 
            width: "350px", 
            height: "500px", 
            backgroundColor: "#1f1f1f", 
            borderRadius: "15px", 
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)", 
            display: "flex", 
            flexDirection: "column",
            border: "1px solid #333",
            overflow: "hidden",
            animation: "slideIn 0.3s ease-out"
        }}>
            {/* Header */}
            <div style={{ padding: "15px", backgroundColor: "#e50914", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.2rem" }}>🔮</span> L'Oracle
                </div>
                <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "white", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, padding: "15px", overflowY: "auto", backgroundColor: "#141414" }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: "15px", alignItems: "flex-end" }}>
                        {msg.role === "oracle" && <span style={{ marginRight: "8px", fontSize: "1.2rem" }}>🔮</span>}
                        <div style={{ 
                            backgroundColor: msg.role === "user" ? "#e50914" : "#333", 
                            color: "white",
                            padding: "10px 14px", 
                            borderRadius: "15px", 
                            borderBottomLeftRadius: msg.role === "oracle" ? "2px" : "15px",
                            borderBottomRightRadius: msg.role === "user" ? "2px" : "15px",
                            maxWidth: "80%",
                            fontSize: "0.9rem",
                            lineHeight: "1.4"
                        }}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && <div style={{ color: "#777", fontSize: "0.8rem", marginLeft: "30px" }}>L'Oracle réfléchit...</div>}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} style={{ padding: "10px", backgroundColor: "#1f1f1f", borderTop: "1px solid #333", display: "flex", gap: "10px" }}>
                <input 
                    type="text" 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    placeholder="Pose ta question..." 
                    autoFocus
                    style={{ flex: 1, backgroundColor: "#333", border: "none", borderRadius: "20px", padding: "10px 15px", color: "white", outline: "none", fontSize: "0.9rem" }}
                />
                <button type="submit" disabled={!input.trim()} style={{ backgroundColor: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem" }}>🚀</button>
            </form>
        </div>
      )}

      {/* --- BOUTON ROND FLOTTANT --- */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
            width: "60px", 
            height: "60px", 
            borderRadius: "50%", 
            backgroundColor: "#e50914", 
            border: "none", 
            boxShadow: "0 4px 15px rgba(229, 9, 20, 0.4)", 
            cursor: "pointer", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            fontSize: "2rem",
            transition: "transform 0.2s"
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        {isOpen ? "✕" : "🔮"}
      </button>

      {/* Animation CSS simple */}
      <style jsx global>{`
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}