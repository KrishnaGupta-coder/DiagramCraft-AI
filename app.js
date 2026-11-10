/**
 * DiagramCraft AI — Plain-English & Code to GitHub-Safe Mermaid Architect
 * Automatically quotes labels containing parentheses/special chars so GitHub never shows parse errors
 */
(function () {
  'use strict';

  const CONFIG_KEY = 'kg_ai_config';

  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    themeVariables: {
      primaryColor: '#131d33',
      primaryTextColor: '#f1f5f9',
      primaryBorderColor: '#00e5ff',
      lineColor: '#8b5cf6',
      secondaryColor: '#1e1b4b',
      tertiaryColor: '#0f172a'
    }
  });

  const TEMPLATES = {
    rag: `flowchart LR
    A["📄 User PDF / Docs"] --> B["✂️ Recursive Chunker (512 tok)"]
    B --> C["🧮 Embedding Model (bge-m3)"]
    C --> D["🗄️ Qdrant Vector DB"]
    E["🔍 User Query"] --> C
    D --> F["🎯 Top-K Cosine Retrieval"]
    F --> G["🧠 LLM Synthesis (Claude / Gemini)"]`,
    auth: `sequenceDiagram
    participant U as Client Browser
    participant A as Auth Gateway
    participant DB as Postgres Users
    U->>A: POST /login (email, password)
    A->>DB: Verify bcrypt hash
    DB-->>A: User record & role
    A-->>U: 200 OK (Signed JWT + Refresh Cookie)`,
    db: `erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ DEPLOYMENTS : triggers
    USERS {
      uuid id PK
      string github_handle
      string email
    }
    PROJECTS {
      uuid id PK
      string repo_name
      string live_url
    }`,
    cicd: `flowchart TD
    A["💻 git push origin main"] --> B["⚡ GitHub Actions Runner"]
    B --> C["🧪 Run Lint & Unit Tests"]
    C --> D["📦 Upload Static Artifact"]
    D --> E["🌐 Deploy to GitHub Pages"]`
  };

  const tabPrompt = document.getElementById('tabPrompt');
  const tabCode = document.getElementById('tabCode');
  const panePrompt = document.getElementById('panePrompt');
  const paneCode = document.getElementById('paneCode');
  const englishInput = document.getElementById('englishInput');
  const mermaidCodeInput = document.getElementById('mermaidCodeInput');
  const diagramTypeSelect = document.getElementById('diagramTypeSelect');
  const templateSelect = document.getElementById('templateSelect');
  const btnGenerateLocal = document.getElementById('btnGenerateLocal');
  const btnGenerateAi = document.getElementById('btnGenerateAi');
  const btnFixQuotes = document.getElementById('btnFixQuotes');
  const btnCopyMd = document.getElementById('btnCopyMd');
  const btnDownloadSvg = document.getElementById('btnDownloadSvg');
  const btnDownloadPng = document.getElementById('btnDownloadPng');
  const mermaidPreview = document.getElementById('mermaidPreview');
  const renderErrorBox = document.getElementById('renderErrorBox');
  const lintStatus = document.getElementById('lintStatus');
  const aiEngineBadge = document.getElementById('aiEngineBadge');

  let renderCounter = 0;

  function getAiConfig() {
    try {
      const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
      if (cfg.provider && cfg.provider !== 'offline') {
        aiEngineBadge.textContent = `Engine: ${cfg.provider.toUpperCase()} + Mermaid`;
        return cfg;
      }
    } catch {}
    aiEngineBadge.textContent = 'Engine: Deterministic + Templates';
    return { provider: 'offline' };
  }

  function switchTab(mode) {
    const isPrompt = mode === 'prompt';
    tabPrompt.classList.toggle('active', isPrompt);
    tabCode.classList.toggle('active', !isPrompt);
    panePrompt.classList.toggle('hidden', !isPrompt);
    paneCode.classList.toggle('hidden', isPrompt);
  }

  // Ensures node labels in [ ... ] are double-quoted for GitHub's strict Mermaid parser
  function sanitizeGitHubMermaid(code) {
    return code.replace(/([A-Za-z0-9_]+)\[([^\]"\n]+)\]/g, (_, id, label) => {
      const cleanLabel = label.trim().replace(/"/g, "'");
      return `${id}["${cleanLabel}"]`;
    });
  }

  // Deterministic Plain-English -> Mermaid Compiler
  function buildFromPlainEnglish(text, type) {
    const raw = text.trim();
    if (!raw) return TEMPLATES.rag;

    const lines = raw.split(/\n+/).map(l => l.trim()).filter(Boolean);
    let steps = [];
    if (lines.length === 1 && /->|➔|=>|,/.test(lines[0])) {
      steps = lines[0].split(/\s*(?:->|➔|=>|,)\s*/).filter(Boolean);
    } else {
      steps = lines.flatMap(l => l.split(/\s*(?:->|➔|=>)\s*/)).filter(Boolean);
    }

    if (type === 'sequenceDiagram') {
      const out = ['sequenceDiagram'];
      for (let i = 0; i < steps.length; i++) {
        const clean = steps[i].replace(/"/g, "'");
        const from = i % 2 === 0 ? 'Client' : 'Engine';
        const to = i % 2 === 0 ? 'Engine' : 'Storage';
        out.push(`    ${from}->>${to}: ${clean}`);
      }
      return out.join('\n');
    }

    const out = [type];
    const nodeIds = steps.map((_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''));
    for (let i = 0; i < steps.length - 1; i++) {
      const a = steps[i].replace(/"/g, "'");
      const b = steps[i + 1].replace(/"/g, "'");
      out.push(`    ${nodeIds[i]}["${a}"] --> ${nodeIds[i + 1]}["${b}"]`);
    }
    if (steps.length === 1) {
      out.push(`    A["${steps[0].replace(/"/g, "'")}"]`);
    }
    return out.join('\n');
  }

  async function renderDiagram() {
    const code = mermaidCodeInput.value.trim();
    if (!code) return;

    renderErrorBox.classList.add('hidden');
    const unquotedRisk = /[A-Za-z0-9_]+\[[^\]"\n]*[()/\\][^\]"\n]*\]/.test(code);
    if (unquotedRisk) {
      lintStatus.textContent = '⚠️ Unquoted () or / detected — click Fix GitHub Quotes';
      lintStatus.className = 'hint-ok hint-warn';
    } else {
      lintStatus.textContent = '✅ GitHub-safe Mermaid syntax';
      lintStatus.className = 'hint-ok';
    }

    try {
      renderCounter++;
      const { svg } = await mermaid.render(`mmd_${renderCounter}`, code);
      mermaidPreview.innerHTML = svg;
    } catch (err) {
      renderErrorBox.textContent = `Mermaid Syntax Error: ${err.message || err}`;
      renderErrorBox.classList.remove('hidden');
    }
  }

  async function callSharedAi(prompt) {
    const cfg = getAiConfig();
    if (cfg.provider === 'ollama') {
      const res = await fetch(cfg.endpoint || 'http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.model || 'qwen2.5:3b', messages: [{ role: 'user', content: prompt }], stream: false })
      });
      const data = await res.json();
      return data.message?.content || data.response || '';
    }
    if (cfg.provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model || 'gemini-2.5-flash'}:generateContent?key=${cfg.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    if (cfg.provider === 'groq' || cfg.provider === 'openai') {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
    return null;
  }

  btnGenerateLocal.addEventListener('click', () => {
    mermaidCodeInput.value = buildFromPlainEnglish(englishInput.value, diagramTypeSelect.value);
    switchTab('code');
    renderDiagram();
  });

  btnGenerateAi.addEventListener('click', async () => {
    const cfg = getAiConfig();
    if (cfg.provider === 'offline') {
      mermaidCodeInput.value = buildFromPlainEnglish(englishInput.value, diagramTypeSelect.value);
      switchTab('code');
      renderDiagram();
      return;
    }

    btnGenerateAi.textContent = 'Architecting...';
    btnGenerateAi.disabled = true;
    try {
      const prompt = `Convert this architecture description into a clean Mermaid (${diagramTypeSelect.value}) diagram. Rules: Output ONLY valid Mermaid code (no markdown fences), and ALWAYS wrap every node label in double quotes like A["Label (Info)"].\n\nDescription:\n${englishInput.value}`;
      let result = await callSharedAi(prompt);
      result = result.replace(/^```mermaid\s*/i, '').replace(/```$/i, '').trim();
      mermaidCodeInput.value = sanitizeGitHubMermaid(result);
      switchTab('code');
      renderDiagram();
    } catch (err) {
      alert(`AI Architect fallback (${err.message})`);
      mermaidCodeInput.value = buildFromPlainEnglish(englishInput.value, diagramTypeSelect.value);
      renderDiagram();
    } finally {
      btnGenerateAi.textContent = 'AI Architect ✨';
      btnGenerateAi.disabled = false;
    }
  });

  btnFixQuotes.addEventListener('click', () => {
    mermaidCodeInput.value = sanitizeGitHubMermaid(mermaidCodeInput.value);
    renderDiagram();
  });

  btnCopyMd.addEventListener('click', () => {
    const md = '```mermaid\n' + mermaidCodeInput.value.trim() + '\n```';
    navigator.clipboard.writeText(md).then(() => {
      btnCopyMd.textContent = 'Copied Markdown!';
      setTimeout(() => { btnCopyMd.textContent = 'Copy GitHub Markdown'; }, 1600);
    });
  });

  btnDownloadSvg.addEventListener('click', () => {
    const svgEl = mermaidPreview.querySelector('svg');
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `diagramcraft-${Date.now()}.svg`;
    a.click();
  });

  btnDownloadPng.addEventListener('click', () => {
    const svgEl = mermaidPreview.querySelector('svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (img.width || 1200) * 2;
      canvas.height = (img.height || 800) * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#070a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.download = `diagramcraft-${Date.now()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  });

  templateSelect.addEventListener('change', (e) => {
    if (TEMPLATES[e.target.value]) {
      mermaidCodeInput.value = TEMPLATES[e.target.value];
      switchTab('code');
      renderDiagram();
    }
  });

  tabPrompt.addEventListener('click', () => switchTab('prompt'));
  tabCode.addEventListener('click', () => switchTab('code'));
  mermaidCodeInput.addEventListener('input', renderDiagram);

  getAiConfig();
  englishInput.value = 'User PDF Upload -> PDF.js Local Extractor -> Paragraph Chunker -> TF-IDF Vectorizer -> Cosine Similarity Radar -> Ranked Results';
  mermaidCodeInput.value = TEMPLATES.rag;
  renderDiagram();
})();

