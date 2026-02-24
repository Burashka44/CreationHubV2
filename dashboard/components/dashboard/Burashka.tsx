'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send } from 'lucide-react';
import { useMetricsWS } from '@/lib/hooks/useMetrics';
import { usePathname } from 'next/navigation';

type AgentState = 'sleeping' | 'thinking' | 'happy' | 'warning' | 'alert';

export default function Burashka() {
  const { metrics } = useMetricsWS();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: 'Привет! Я Бурашка, твой системный администратор. Чем могу помочь?' }
  ]);
  const [input, setInput] = useState('');
  const [state, setState] = useState<AgentState>('sleeping');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine state based on metrics
  useEffect(() => {
    if (!metrics) return;
    const cpu = metrics.cpu || 0;
    const mem = metrics.mem?.percent || 0;
    
    // Check for offline services (stub)
    const hasOffline = false; // need to get services status here ideally

    if (cpu > 90 || mem > 95) setState('alert');
    else if (cpu > 70 || mem > 80) setState('warning');
    else if (hasOffline) setState('warning');
    else if (cpu > 30) setState('thinking');
    else setState('happy'); // default active 
    // 'sleeping' logic could be idle time, but let's stick to happy/thinking for now
  }, [metrics]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(p => [...p, { role: 'user', text: userMsg }]);
    setInput('');
    setState('thinking');

    try {
      // Simulate AI response for now (or connect to real API later)
      setTimeout(() => {
        let reply = 'Я пока учусь управлять сервером, но скоро смогу многое!';
        if (userMsg.toLowerCase().includes('статус')) reply = 'Системы в норме, CPU ' + (metrics?.cpu || 0) + '%';
        if (userMsg.toLowerCase().includes('привет')) reply = 'Привет-привет! 👋';
        setMessages(p => [...p, { role: 'agent', text: reply }]);
        setState('happy');
      }, 1000);
    } catch {
      setState('warning');
    }
  };

  const getStateColor = () => {
    switch (state) {
      case 'alert': return 'var(--color-offline)';
      case 'warning': return 'var(--color-warning)';
      case 'thinking': return 'var(--accent)';
      case 'happy': return 'var(--color-online)';
      case 'sleeping': return 'var(--text-muted)';
      default: return 'var(--accent)';
    }
  };

  // Avatar component
  const Avatar = () => (
    <div 
      onClick={() => setIsOpen(v => !v)}
      style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--bg-elevated)', border: `3px solid ${getStateColor()}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        position: 'relative', transition: 'all 0.2s ease'
      }}
    >
      <Bot size={32} color={getStateColor()} />
      {/* Status dot indicator */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0,
        width: 16, height: 16, borderRadius: '50%',
        background: getStateColor(), border: '2px solid var(--bg-card)'
      }} />
    </div>
  );

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
      
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          width: 320, height: 400, background: 'var(--bg-card)', 
          borderRadius: 16, border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          overflow: 'hidden', animation: 'fadeIn 0.2s ease-out'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={18} color="var(--accent)" />
              <span style={{ fontWeight: 600 }}>Бурашка</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="btn btn-ghost btn-icon-sm">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px', borderRadius: 12,
                fontSize: 13, lineHeight: 1.4,
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)',
                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                borderBottomRightRadius: m.role === 'user' ? 2 : 12,
                borderBottomLeftRadius: m.role === 'agent' ? 2 : 12,
              }}>
                {m.text}
              </div>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input 
              className="input" 
              value={input} onChange={e => setInput(e.target.value)}
              placeholder="Спроси что-нибудь..."
              style={{ flex: 1, fontSize: 13 }}
              autoFocus
            />
            <button type="submit" className="btn btn-primary btn-icon-sm">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <Avatar />
    </div>
  );
}
