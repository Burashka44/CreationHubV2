'use client';
import React, { useEffect, useRef, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api, API_URL } from '@/lib/api';
import { Bot, Send, Paperclip, X, Trash2, Plus, Settings2, ChevronDown } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  timestamp: Date;
  model?: string;
  tokens?: number;
}

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  details: { parameter_size: string; family: string };
}

export default function AIHubPage() {
  const [models, setModels]       = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [images, setImages]       = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [sysPrompt, setSysPrompt] = useState('You are a helpful AI assistant on CreationHub server.');
  const [showSettings, setShowSettings] = useState(false);
  const [temperature, setTemperature]   = useState('0.7');
  const [maxTokens, setMaxTokens]       = useState('2048');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load Ollama models via system-api proxy
    fetch(`${API_URL}/api/ai/models`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('ch_access')}` },
    })
      .then(r => r.json())
      .then((d: any) => {
        const list: OllamaModel[] = d?.models || [];
        setModels(list);
        if (list.length && !selectedModel) setSelectedModel(list[0].name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && images.length === 0) return;
    if (!selectedModel) return;

    const userMsg: Message = {
      id: crypto.randomUUID(), role: 'user', content: input,
      images: [...images], timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); setImages([]); setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ch_access')}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: sysPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content, images: m.images })),
            { role: 'user', content: input, images: images },
          ],
          temperature: parseFloat(temperature),
          max_tokens:  parseInt(maxTokens),
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      // Stream response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = crypto.randomUUID();

      setMessages(prev => [...prev, {
        id: assistantId, role: 'assistant', content: '',
        timestamp: new Date(), model: selectedModel,
      }]);

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        
        const lines = chunkValue.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data.trim() === '[DONE]') {
            done = true; 
            break;
          }
          if (data.startsWith('[ERROR]')) {
             throw new Error(data.slice(7));
          }

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || json.message?.content || '';
            assistantContent += delta;
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: assistantContent } : m
            ));
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant', content: `❌ Ошибка: ${err.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleImagePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = ev => {
          const b64 = (ev.target?.result as string)?.split(',')[1];
          if (b64) setImages(prev => [...prev, b64]);
        };
        reader.readAsDataURL(file);
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = (ev.target?.result as string)?.split(',')[1];
        if (b64) setImages(prev => [...prev, b64]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  return (
    <AppShell>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px - 40px)', gap: 16 }}>

        {/* ── Sidebar: model selector */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card-title"><Bot size={14} /> Модели Ollama</div>

            {models.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                Нет доступных моделей.<br />
                Убедитесь что Ollama запущена.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                {models.map(m => (
                  <button
                    key={m.name}
                    onClick={() => setSelectedModel(m.name)}
                    className={`nav-link ${selectedModel === m.name ? 'active' : ''}`}
                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '8px 10px', borderRadius: 8 }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {m.details?.parameter_size} · {(m.size / 1e9).toFixed(1)}GB
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Settings toggle */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <button className="btn btn-ghost btn-sm w-full" onClick={() => setShowSettings(v => !v)}>
                <Settings2 size={13} /> Параметры <ChevronDown size={13} style={{ marginLeft: 'auto', transform: showSettings ? 'rotate(180deg)' : '', transition: '0.2s' }} />
              </button>
              {showSettings && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Температура: {temperature}
                    <input type="range" min="0" max="2" step="0.1" value={temperature}
                      onChange={e => setTemperature(e.target.value)}
                      style={{ width: '100%', marginTop: 4 }} />
                  </label>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Max токенов
                    <input type="number" className="input" style={{ height: 28, marginTop: 4, fontSize: 12 }}
                      value={maxTokens} onChange={e => setMaxTokens(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Системный промпт
                    <textarea className="input" rows={4} style={{ marginTop: 4, fontSize: 11, resize: 'vertical' }}
                      value={sysPrompt} onChange={e => setSysPrompt(e.target.value)} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Messages */}
          <div className="card" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {messages.length === 0 && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', color: 'var(--text-muted)', gap: 12,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', fontSize: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-elevated)',
                }}>🤖</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>AI Hub · {selectedModel || 'Выберите модель'}</div>
                <div style={{ fontSize: 13 }}>Задайте вопрос или прикрепите изображение</div>
              </div>
            )}

            {messages.map(msg => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🤖</div>
                <div className="card" style={{ padding: '10px 14px', background: 'var(--bg-elevated)' }}>
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image previews */}
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: 8, padding: '8px 0', flexWrap: 'wrap' }}>
              {images.map((b64, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  {/* eslint-disable-next-line */}
                  <img src={`data:image/png;base64,${b64}`} alt=""
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                  <button
                    onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, background: 'var(--color-offline)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, padding: 0, cursor: 'pointer', fontSize: 10, display:'flex',alignItems:'center',justifyContent:'center' }}
                  ><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text" className="input" placeholder="Сообщение... (Ctrl+V для вставки изображений)"
                value={input} onChange={e => setInput(e.target.value)}
                onPaste={handleImagePaste}
                disabled={loading || !selectedModel}
              />
            </div>
            <input ref={fileRef} type="file" hidden accept="image/*" multiple onChange={handleFileChange} />
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => fileRef.current?.click()} title="Прикрепить изображение" disabled={loading}>
              <Paperclip size={15} />
            </button>
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setMessages([])} title="Очистить чат">
              <Trash2 size={15} />
            </button>
            <button type="submit" className="btn btn-primary btn-icon" disabled={loading || !selectedModel || (!input.trim() && images.length === 0)}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Send size={15} />}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'var(--bg-elevated)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: isUser ? '#fff' : undefined,
      }}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div style={{ maxWidth: '78%' }}>
        {msg.images && msg.images.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {msg.images.map((b64, i) => (
              // eslint-disable-next-line
              <img key={i} src={`data:image/png;base64,${b64}`} alt=""
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
            ))}
          </div>
        )}
        <div className="card" style={{
          padding: '10px 14px',
          background: isUser ? 'var(--accent-muted)' : 'var(--bg-elevated)',
          border: `1px solid ${isUser ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        }}>
          <pre style={{
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontSize: 13, lineHeight: 1.6, fontFamily: 'inherit',
          }}>
            {msg.content || <span style={{ opacity: 0.4 }}>▌</span>}
          </pre>
          {msg.model && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
              {msg.model} · {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
