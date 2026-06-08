import { useState, useEffect, useRef } from 'react';
import { analyzeOmniCapture, executeOmniCapture } from '../utils/api';

export default function CaptureModal({ onClose }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState(null); // null | 'analyzing' | 'disambiguating' | 'saving' | 'saved' | 'error'
  const [resultsMsg, setResultsMsg] = useState('');
  const inputRef = useRef(null);

  // Disambiguation state
  const [ambiguities, setAmbiguities] = useState({});
  const [exactMatches, setExactMatches] = useState({});
  const [newPeople, setNewPeople] = useState({});
  const [operations, setOperations] = useState([]);
  
  // resolutions: { [ambiguousName]: { type: 'existing', id: 'pId' } | { type: 'new', name: 'John Doe' } }
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && status !== 'saving') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setStatus('analyzing');
    try {
      const res = await analyzeOmniCapture(text);
      // We might get 200 OK with ready_to_execute: true
      if (res.data.ready_to_execute) {
        await finalizeExecution(res.data.operations, res.data.exactMatches, Object.keys(res.data.newPeople || {}));
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.requires_disambiguation) {
        const data = err.response.data;
        setAmbiguities(data.ambiguities);
        setExactMatches(data.exactMatches || {});
        setNewPeople(data.newPeople || {});
        setOperations(data.operations || []);
        
        // Initialize default resolutions (first option)
        const initialRes = {};
        for (const [name, matches] of Object.entries(data.ambiguities)) {
          if (matches.length > 0) {
            initialRes[name] = { type: 'existing', id: matches[0].id };
          }
        }
        setResolutions(initialRes);
        setStatus('disambiguating');
      } else {
        setStatus('error');
        setTimeout(() => setStatus(null), 2000);
      }
    }
  };

  const finalizeExecution = async (ops, resolvedMap, newPeopleArray) => {
    setStatus('saving');
    try {
      const payload = {
        text,
        operations: ops,
        resolvedPeopleMap: resolvedMap,
        newPeopleToCreate: newPeopleArray
      };
      const res = await executeOmniCapture(payload);
      if (res.data?.results) {
        setResultsMsg(res.data.results.join(', '));
      } else {
        setResultsMsg('Capture processed');
      }
      setStatus('saved');
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setTimeout(() => setStatus(null), 2000);
    }
  };

  const handleDisambiguateSubmit = async (e) => {
    e.preventDefault();
    const finalResolvedMap = { ...exactMatches };
    const finalNewPeople = Object.keys(newPeople);

    for (const [name, res] of Object.entries(resolutions)) {
      if (res.type === 'existing') {
        finalResolvedMap[name] = res.id;
      } else if (res.type === 'new') {
        // e.g. they typed "John Smith" for ambiguous "John"
        finalNewPeople.push(res.name);
        // Map the original parsed name ("John") to the new string temporarily,
        // wait, execute endpoint handles array of new names, and we need to map "John" to the ID.
        // It's easier if we tell execute endpoint: newPeopleToCreate = ["John Smith"],
        // but how do we link "John" to "John Smith"?
        // The endpoint creates IDs for newPeopleToCreate, but personIdMap[newName] = pId.
        // It will look for personIdMap["John"].
        // So we need to map "John" to the new ID...
        // Let's adjust `finalizeExecution` or we can just replace "John" in `people_mentioned`?
        // Let's pass a `mappedNames` object instead if needed.
        // Wait, execute endpoint looks up `personIdMap[pName]`. 
        // If we add `res.name` to `newPeopleToCreate`, it will be `personIdMap[res.name] = pId`.
        // Then it tries to look up `personIdMap["John"]`. That will be undefined unless we map it.
        // Let's just modify the `operations` locally before sending, replacing "John" with "John Smith" in people_mentioned!
        
        opsModifier:
        for (const op of operations) {
          if (Array.isArray(op.data?.people_mentioned)) {
            op.data.people_mentioned = op.data.people_mentioned.map(p => p === name ? res.name : p);
          }
        }
      }
    }

    await finalizeExecution(operations, finalResolvedMap, finalNewPeople);
  };

  const updateResolution = (name, val) => {
    setResolutions(prev => ({ ...prev, [name]: val }));
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && status !== 'saving') onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: '560px',
          background: 'rgba(15,15,20,0.98)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-dimmed)', textTransform: 'uppercase' }}>
            {status === 'disambiguating' ? 'Clarify People Mentioned' : 'Omni Capture (Brain Dump)'}
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {status === 'disambiguating' ? (
          <form onSubmit={handleDisambiguateSubmit}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              We found multiple people matching the names you mentioned. Which one did you mean?
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              {Object.entries(ambiguities).map(([name, matches]) => (
                <div key={name} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>"{name}"</div>
                  
                  {matches.map(m => (
                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name={`disambig_${name}`}
                        checked={resolutions[name]?.type === 'existing' && resolutions[name]?.id === m.id}
                        onChange={() => updateResolution(name, { type: 'existing', id: m.id })}
                      />
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{m.name}</span>
                    </label>
                  ))}
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name={`disambig_${name}`}
                      checked={resolutions[name]?.type === 'new'}
                      onChange={() => updateResolution(name, { type: 'new', name: '' })}
                    />
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Create new person:</span>
                  </label>
                  
                  {resolutions[name]?.type === 'new' && (
                    <input 
                      type="text" 
                      className="form-input"
                      autoFocus
                      placeholder={`Full name for "${name}"`}
                      value={resolutions[name].name || ''}
                      onChange={(e) => updateResolution(name, { type: 'new', name: e.target.value })}
                      style={{ marginTop: '8px', width: '100%', padding: '8px 12px', fontSize: '13px' }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
                {status === 'saving' ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              className="form-input"
              style={{ width: '100%', fontSize: '1.15rem', padding: '14px 18px', marginBottom: '16px', minHeight: '120px', resize: 'vertical' }}
              placeholder="I'm feeling really anxious today. I did a 25 minute pomodoro on my math homework, but I got distracted by Twitter. Also remind me to buy milk tomorrow..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={status === 'analyzing' || status === 'saving' || status === 'saved'}
            />
            {status === 'saved' && (
              <div style={{ padding: '12px', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                ✓ <strong>Success:</strong> {resultsMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-dimmed)' }}>Esc to dismiss</span>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={status === 'analyzing' || status === 'saving' || !text.trim()}
                style={{ minWidth: '100px' }}
              >
                {status === 'analyzing' ? 'Analyzing...' : status === 'saving' ? 'Saving...' : status === 'saved' ? '✓ Saved' : status === 'error' ? 'Failed' : 'Collect'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
