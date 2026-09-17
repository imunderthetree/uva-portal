import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import {
  ArrowSquareOut,
  CheckCircle,
  Circle,
  Clock,
  ClockCounterClockwise,
  Code,
  EnvelopeSimple,
  FileText,
  FolderSimple,
  GithubLogo,
  GraduationCap,
  House,
  Info,
  Key,
  Lightning,
  LinkedinLogo,
  Lock,
  LockOpen,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  SignOut,
  Sparkle,
  Trash,
  Trophy,
  UploadSimple,
  User,
  UserPlus,
  UsersThree,
  X,
} from '@phosphor-icons/react'

const LANGUAGES = [
  { value: 'c++11', label: 'C++11 (GCC 5.3)' },
  { value: 'c++', label: 'C++ (GCC 4.8)' },
  { value: 'c', label: 'C (GCC 4.8)' },
  { value: 'java', label: 'Java (OpenJDK 1.8)' },
  { value: 'pascal', label: 'Pascal (FPC 2.6)' },
  { value: 'python3', label: 'Python 3.5' },
]

function verdictTone(verdict) {
  const v = (verdict || '').toLowerCase()
  if (v === 'accepted') return 'ok'
  if (v === 'in judge queue' || v === 'submitted' || v.includes('queue')) return 'pending'
  if (v === 'wrong answer' || v.includes('error') || v.includes('exceeded')) return 'bad'
  return 'neutral'
}

function VerdictBadge({ verdict }) {
  const tone = verdictTone(verdict)
  return <span className={`badge badge-${tone}`}>{verdict}</span>
}

// ---------------------------------------------------------------------------
// Problem Statement Drawer (Non-blocking slide-over panel)
// ---------------------------------------------------------------------------

function StatementDrawer({ problemNumber, problemTitle, onClose, onSubmitProblem }) {
  if (!problemNumber) return null
  const pdfUrl = api.problemPdfUrl(problemNumber)

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="statement-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">
            <FileText size={18} className="muted" />
            <span className="mono bold">Problem {problemNumber}</span>
            {problemTitle && <span className="muted text-sm"> — {problemTitle}</span>}
          </div>
          <div className="drawer-actions">
            {onSubmitProblem && (
              <button
                type="button"
                className="btn-small"
                onClick={() => {
                  onSubmitProblem(problemNumber)
                  onClose()
                }}
              >
                <PaperPlaneTilt size={14} weight="bold" />
                Submit solution →
              </button>
            )}
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="link-btn"
              title="Open PDF in new tab"
            >
              <ArrowSquareOut size={15} />
              Open tab
            </a>
            <button className="modal-close-btn" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <iframe
            src={pdfUrl}
            title={`Problem ${problemNumber} Statement`}
            className="statement-frame"
          />
        </div>
      </aside>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Passkey Unlock Modal (For private sheets and contests)
// ---------------------------------------------------------------------------

function PasskeyModal({ title, targetType, onUnlock, onCancel }) {
  const [passkey, setPasskey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await onUnlock(passkey.trim())
    } catch (error) {
      setErr(error.message || 'Invalid access passkey.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-container modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={16} color="var(--pending)" />
            Private {targetType}
          </div>
          <button className="modal-close-btn" onClick={onCancel} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="text-sm muted" style={{ marginTop: 0 }}>
              <span className="bold text-white">"{title}"</span> is private. Please enter the access passkey provided by the owner to unlock it.
            </p>
            <label>
              Access Passkey
              <input
                type="password"
                placeholder="Enter passkey…"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                autoFocus
                required
              />
            </label>
            {err && <div className="form-error">{err}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-text" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-small" disabled={busy || !passkey.trim()}>
              <Key size={14} weight="bold" />
              {busy ? 'Verifying…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login Modal & Screen
// ---------------------------------------------------------------------------

function LoginModal({ isOpen, onClose, onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api.login(username, password)
      onLoggedIn(res.username)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="login-card" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        <button
          className="modal-close-btn"
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px' }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <div className="login-mark-wrap">
          <div className="login-mark">UVa</div>
          <div className="login-mark-label">Online Judge Portal</div>
        </div>
        <h1>Sign in with your UVa account</h1>
        <p className="login-sub">
          Direct authentication against onlinejudge.org — credentials are encrypted and never stored.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="e.g. tourist"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••••••"
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Connecting to UVa…' : 'Sign in to Judge'}
          </button>
        </form>
      </div>
    </div>
  )
}

function LoginScreen({ onLoggedIn, onBrowseAsGuest }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await api.login(username, password)
      onLoggedIn(res.username)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-mark-wrap">
          <img src="/logo.svg" alt="UVa Judge Portal" className="app-logo-icon lg" style={{ marginBottom: '8px' }} />
          <div className="login-mark-label">Online Judge Portal</div>
        </div>
        <h1>Sign in with your UVa account</h1>
        <p className="login-sub">
          Direct authentication against onlinejudge.org — credentials are encrypted and never stored.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="e.g. tourist"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••••••"
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'Connecting to UVa…' : 'Sign in to Judge'}
          </button>
        </form>
        {onBrowseAsGuest && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              className="btn-text link-btn text-sm"
              onClick={onBrowseAsGuest}
            >
              Or browse public problems as guest →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add to Sheet Dropdown
// ---------------------------------------------------------------------------

function AddToSheetMenu({ problemNumber, sheets, onSheetCreated, onAdded }) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
        setCreating(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  async function handleAddToSheet(sheetId, sheetName) {
    setBusy(true)
    try {
      await api.addProblemToSheet(sheetId, problemNumber)
      setFeedback(`Added to ${sheetName}`)
      onAdded?.(sheetId)
      setTimeout(() => {
        setOpen(false)
        setFeedback('')
      }, 1200)
    } catch (err) {
      setFeedback(`Error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateAndAdd(e) {
    e.preventDefault()
    if (!newSheetName.trim()) return
    setBusy(true)
    try {
      const created = await api.createSheet(newSheetName.trim())
      onSheetCreated?.(created)
      await api.addProblemToSheet(created.id, problemNumber)
      setFeedback(`Added to ${created.name}`)
      setNewSheetName('')
      setCreating(false)
      onAdded?.(created.id)
      setTimeout(() => {
        setOpen(false)
        setFeedback('')
      }, 1200)
    } catch (err) {
      setFeedback(`Error: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dropdown-wrap" ref={dropdownRef}>
      <button
        type="button"
        className="link-btn"
        onClick={() => {
          setOpen(!open)
          setCreating(false)
          setFeedback('')
        }}
      >
        <Plus size={13} weight="bold" />
        Add to sheet
      </button>

      {open && (
        <div className="dropdown-menu">
          <div className="dropdown-title">Add problem #{problemNumber}</div>

          {feedback && <div className="dropdown-feedback">{feedback}</div>}

          {!creating ? (
            <>
              <div className="dropdown-list">
                {sheets.length === 0 && (
                  <div className="dropdown-empty">No sheets created yet.</div>
                )}
                {sheets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="dropdown-item"
                    disabled={busy}
                    onClick={() => handleAddToSheet(s.id, s.name)}
                  >
                    <span>{s.name}</span>
                    <span className="mono muted text-xs">{s.problem_count || 0} probs</span>
                  </button>
                ))}
              </div>
              <div className="dropdown-footer">
                <button
                  type="button"
                  className="dropdown-new-btn"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={13} weight="bold" />
                  New sheet…
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleCreateAndAdd} className="dropdown-create-form">
              <input
                type="text"
                placeholder="Sheet name…"
                value={newSheetName}
                onChange={(e) => setNewSheetName(e.target.value)}
                autoFocus
                disabled={busy}
                required
              />
              <div className="dropdown-form-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setCreating(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-small" disabled={busy || !newSheetName.trim()}>
                  {busy ? 'Adding…' : 'Create & Add'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Problems Panel
// ---------------------------------------------------------------------------

function ProblemsPanel({ onPickProblem, onViewStatement, sheets, onRefreshSheets }) {
  const [q, setQ] = useState('')
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.problems(q)
        if (!cancelled) setProblems(res)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Problems Database</h2>
          <div className="panel-sub">10,000+ UVa archive problems mirrored via uHunt API</div>
        </div>
      </div>

      <div className="search-row">
        <div className="search-input-wrap">
          <MagnifyingGlass size={16} className="search-icon" />
          <input
            className="search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by problem number or title keyword (e.g. '100', 'graph', 'knapsack')…"
          />
        </div>
        <div className="search-meta mono muted text-sm">
          {loading ? 'Searching UVa index…' : `${problems.length} problems shown`}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="mono" style={{ width: '90px' }}>#</th>
              <th>Title</th>
              <th className="mono" style={{ width: '130px', textAlign: 'right' }}>Solved Count</th>
              <th style={{ width: '280px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {problems.map((p) => (
              <tr key={p.id}>
                <td className="mono bold">{p.number}</td>
                <td>
                  <span className="problem-title-text">{p.title}</span>
                </td>
                <td className="mono muted" style={{ textAlign: 'right' }}>
                  {p.solved_by.toLocaleString()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onViewStatement(p.number, p.title)}
                      title="View problem statement PDF in-portal"
                    >
                      <FileText size={14} />
                      Statement
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => onPickProblem(p.number)}
                      title="Open in Code Editor"
                    >
                      <PaperPlaneTilt size={14} />
                      Submit
                    </button>
                    <AddToSheetMenu
                      problemNumber={p.number}
                      sheets={sheets}
                      onSheetCreated={onRefreshSheets}
                      onAdded={onRefreshSheets}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {problems.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="empty">
                  No problems matched your filter. Try another keyword or volume number.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Submit Panel (Split-screen Workspace with In-Portal Statement)
// ---------------------------------------------------------------------------

function SubmitPanel({ presetProblem, onSubmitted, onViewStatement }) {
  const [problemNumber, setProblemNumber] = useState(presetProblem || '')
  const [language, setLanguage] = useState('c++11')
  const [code, setCode] = useState('')
  const [showStatement, setShowStatement] = useState(Boolean(presetProblem))
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const pollActiveRef = useRef(false)

  useEffect(() => {
    if (presetProblem) {
      setProblemNumber(presetProblem)
      setShowStatement(true)
    }
  }, [presetProblem])

  async function pollVerdict(runId) {
    setPolling(true)
    pollActiveRef.current = true
    try {
      const resolved = await api.poll(runId, 60)
      if (pollActiveRef.current) {
        setResult(resolved)
        onSubmitted?.()
      }
    } catch (err) {
      if (pollActiveRef.current) {
        setError(err.message || 'Polling timed out — check Submissions tab.')
      }
    } finally {
      if (pollActiveRef.current) {
        setPolling(false)
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResult(null)
    setBusy(true)
    pollActiveRef.current = false
    try {
      const res = await api.submit(problemNumber, language, code)
      setResult(res)
      onSubmitted?.()

      const v = (res.verdict || '').toLowerCase()
      if (v === 'in judge queue' || v === 'submitted' || v.includes('queue')) {
        pollVerdict(res.run_id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isSplit = Boolean(showStatement && problemNumber)
  const pdfUrl = problemNumber ? api.problemPdfUrl(problemNumber) : null

  return (
    <div className={`panel ${isSplit ? 'submit-split-panel' : ''}`}>
      <div className="panel-head">
        <div>
          <h2>Submit Solution</h2>
          <div className="panel-sub">
            {isSplit
              ? 'Split-screen workspace: Statement viewer & Code submission'
              : 'Direct submission to onlinejudge.org automated judge'}
          </div>
        </div>
        {problemNumber && (
          <button
            type="button"
            className="btn-text link-btn text-sm"
            onClick={() => setShowStatement(!showStatement)}
          >
            {showStatement ? 'Collapse statement ⇥' : 'View statement (Split view) ⇤'}
          </button>
        )}
      </div>

      <div className={`submit-layout ${isSplit ? 'is-split' : ''}`}>
        {isSplit && (
          <div className="submit-statement-col">
            <div className="submit-statement-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} className="muted" />
                <span className="mono bold text-sm">Problem {problemNumber} Statement</span>
              </div>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="link-btn text-xs"
              >
                <ArrowSquareOut size={13} />
                Open tab
              </a>
            </div>
            <iframe
              src={pdfUrl}
              title={`Problem ${problemNumber} Statement`}
              className="submit-statement-frame"
            />
          </div>
        )}

        <div className="submit-editor-col">
          <form className="submit-form" onSubmit={handleSubmit}>
            <div className="field-row">
              <label>
                Problem Number
                <input
                  className="mono"
                  value={problemNumber}
                  onChange={(e) => {
                    setProblemNumber(e.target.value)
                    if (e.target.value) setShowStatement(true)
                  }}
                  placeholder="e.g. 10189"
                  required
                />
              </label>
              <label>
                Compiler / Language
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Source Code
              <textarea
                className="mono code-area"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                rows={isSplit ? 22 : 18}
                placeholder="/* Paste your C++, Java, or Python solution here... */"
                required
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button type="submit" disabled={busy || polling}>
              <PaperPlaneTilt size={15} weight="bold" />
              {busy ? 'Submitting to UVa…' : polling ? 'Judging Solution…' : 'Submit Solution'}
            </button>
          </form>

          {result && (
            <div
              className={`result-card ${polling ? 'result-polling' : ''}`}
              aria-live="polite"
            >
              <div className="result-info">
                Run <span className="mono bold">{result.run_id}</span> — Problem{' '}
                <span className="mono bold">{result.problem_id}</span>{' '}
                {result.problem_name && <span className="muted">({result.problem_name})</span>}
              </div>
              <div className="result-verdict-wrap">
                {polling && <span className="spinner" />}
                <VerdictBadge verdict={result.verdict} />
                {result.runtime && (
                  <span className="mono muted text-sm">
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {result.runtime}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sheets Panel (with Privacy and Delete support)
// ---------------------------------------------------------------------------

function SheetsPanel({ onPickProblem, onViewStatement, sheets, onRefreshSheets }) {
  const [selectedSheetId, setSelectedSheetId] = useState(null)
  const [sheetData, setSheetData] = useState(null)
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [newSheetGroupId, setNewSheetGroupId] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [newProblemNumber, setNewProblemNumber] = useState('')
  const [newProblemNote, setNewProblemNote] = useState('')
  const [error, setError] = useState('')
  const [sheetModalError, setSheetModalError] = useState('')
  const [groupModalError, setGroupModalError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [passkeyModalTarget, setPasskeyModalTarget] = useState(null)
  const unlockedCodesRef = useRef({})

  async function loadGroups() {
    try {
      const list = await api.getGroups()
      setGroups(list || [])
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const filteredSheets = sheets.filter((s) => {
    if (selectedGroupId === 'all') return true
    if (selectedGroupId === 'ungrouped') return !s.group_id
    return s.group_id === Number(selectedGroupId)
  })

  useEffect(() => {
    if (filteredSheets.length > 0) {
      if (!selectedSheetId || !filteredSheets.some((s) => s.id === selectedSheetId)) {
        setSelectedSheetId(filteredSheets[0].id)
      }
    } else {
      setSelectedSheetId(null)
    }
  }, [selectedGroupId, sheets])

  useEffect(() => {
    if (selectedSheetId) {
      loadSheet(selectedSheetId)
    } else {
      setSheetData(null)
    }
  }, [selectedSheetId])

  async function loadSheet(id, code = '') {
    setLoadingSheet(true)
    setError('')
    const effectiveCode = code || unlockedCodesRef.current[id] || ''
    try {
      const data = await api.getSheet(id, effectiveCode)
      setSheetData(data)
      if (effectiveCode) unlockedCodesRef.current[id] = effectiveCode
    } catch (err) {
      if (err.status === 403 && err.data?.is_private) {
        setPasskeyModalTarget({ id, name: err.data.name || 'Private Sheet' })
      } else {
        setError(err.message)
      }
    } finally {
      setLoadingSheet(false)
    }
  }

  async function handleUnlockPasskey(enteredCode) {
    if (!passkeyModalTarget) return
    const id = passkeyModalTarget.id
    await api.verifySheetAccess(id, enteredCode)
    unlockedCodesRef.current[id] = enteredCode
    setPasskeyModalTarget(null)
    await loadSheet(id, enteredCode)
  }

  async function handleCreateSheet(e) {
    e.preventDefault()
    if (!newSheetName.trim()) return
    setActionBusy(true)
    setSheetModalError('')
    try {
      const res = await api.createSheet({
        name: newSheetName.trim(),
        group_id: newSheetGroupId ? Number(newSheetGroupId) : null,
        is_private: isPrivate,
        access_code: isPrivate ? accessCode.trim() : '',
      })
      setNewSheetName('')
      setIsPrivate(false)
      setAccessCode('')
      setShowCreateModal(false)
      await loadGroups()
      await onRefreshSheets?.()
      setSelectedSheetId(res.id)
    } catch (err) {
      setSheetModalError(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  async function handleCreateGroup(e) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setActionBusy(true)
    setGroupModalError('')
    try {
      const g = await api.createGroup({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
      })
      setShowCreateGroupModal(false)
      setNewGroupName('')
      setNewGroupDesc('')
      await loadGroups()
      setSelectedGroupId(String(g.id))
    } catch (err) {
      setGroupModalError(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  async function handleDeleteGroup(gid, gname) {
    if (!window.confirm(`Are you sure you want to delete the group "${gname}"? Its sheets will remain intact under General.`)) return
    try {
      await api.deleteGroup(gid)
      if (String(selectedGroupId) === String(gid)) setSelectedGroupId('all')
      await loadGroups()
      await onRefreshSheets?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDeleteSheet(sheetId, sheetName) {
    if (!window.confirm(`Are you sure you want to delete the sheet "${sheetName}"?`)) return
    try {
      await api.deleteSheet(sheetId)
      setSelectedSheetId(null)
      await loadGroups()
      await onRefreshSheets?.()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddProblem(e) {
    e.preventDefault()
    if (!newProblemNumber.trim() || !selectedSheetId) return
    setActionBusy(true)
    try {
      await api.addProblemToSheet(selectedSheetId, newProblemNumber.trim(), newProblemNote.trim())
      setNewProblemNumber('')
      setNewProblemNote('')
      await loadSheet(selectedSheetId)
      onRefreshSheets?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  async function handleRemoveProblem(problemNumber) {
    if (!selectedSheetId) return
    try {
      await api.removeProblemFromSheet(selectedSheetId, problemNumber)
      await loadSheet(selectedSheetId)
      onRefreshSheets?.()
    } catch (err) {
      setError(err.message)
    }
  }

  const solvedCount = sheetData?.problems?.filter((p) => p.solved).length || 0
  const totalCount = sheetData?.problems?.length || 0
  const percent = totalCount > 0 ? (solvedCount / totalCount) * 100 : 0
  const hasUngrouped = sheets.some((s) => !s.group_id)

  return (
    <div className="panel sheets-layout">
      <div className="panel-head">
        <div>
          <h2>Problem Sheets & Groups</h2>
          <div className="panel-sub">Organize your training topics into Groups and Sub-Sheets</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              setGroupModalError('')
              setShowCreateGroupModal(true)
            }}
          >
            <Plus size={14} weight="bold" />
            New Group
          </button>
          <button
            type="button"
            className="btn-small"
            onClick={() => {
              setSheetModalError('')
              setNewSheetGroupId(selectedGroupId !== 'all' && selectedGroupId !== 'ungrouped' ? String(selectedGroupId) : '')
              setShowCreateModal(true)
            }}
          >
            <Plus size={14} weight="bold" />
            New Sheet
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* Groups Category Bar */}
      <div style={{ margin: '4px 0 14px' }}>
        <div className="text-xs bold muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Topic Groups
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={`sheet-nav-pill ${selectedGroupId === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedGroupId('all')}
          >
            <FolderSimple size={14} weight={selectedGroupId === 'all' ? 'fill' : 'regular'} />
            <span className="sheet-nav-name">All Sheets</span>
            <span className="sheet-nav-count mono">{sheets.length}</span>
          </button>

          {groups.map((g) => (
            <div key={g.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                className={`sheet-nav-pill ${String(selectedGroupId) === String(g.id) ? 'active' : ''}`}
                onClick={() => setSelectedGroupId(String(g.id))}
                title={g.description || g.name}
              >
                <FolderSimple size={14} weight={String(selectedGroupId) === String(g.id) ? 'fill' : 'regular'} />
                <span className="sheet-nav-name">{g.name}</span>
                <span className="sheet-nav-count mono">{g.sheet_count || 0}</span>
              </button>
              {String(selectedGroupId) === String(g.id) && (
                <button
                  type="button"
                  className="link-btn link-btn-danger"
                  style={{ padding: '2px 6px', marginLeft: '-4px' }}
                  onClick={() => handleDeleteGroup(g.id, g.name)}
                  title="Delete this group"
                >
                  <Trash size={12} />
                </button>
              )}
            </div>
          ))}

          {hasUngrouped && groups.length > 0 && (
            <button
              type="button"
              className={`sheet-nav-pill ${selectedGroupId === 'ungrouped' ? 'active' : ''}`}
              onClick={() => setSelectedGroupId('ungrouped')}
            >
              <span className="sheet-nav-name">General / Other</span>
              <span className="sheet-nav-count mono">{sheets.filter((s) => !s.group_id).length}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Sheets Navigation Bar */}
      <div style={{ margin: '8px 0 16px' }}>
        <div className="text-xs bold muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Sub-Sheets {selectedGroupId !== 'all' && selectedGroupId !== 'ungrouped' && groups.find((g) => String(g.id) === String(selectedGroupId)) ? `in ${groups.find((g) => String(g.id) === String(selectedGroupId)).name}` : ''}
        </div>
        <div className="sheets-nav-bar">
          {filteredSheets.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sheet-nav-pill ${selectedSheetId === s.id ? 'active' : ''}`}
              onClick={() => setSelectedSheetId(s.id)}
            >
              {s.is_private ? (
                <Lock size={13} color="var(--pending)" weight="bold" />
              ) : (
                <FolderSimple size={14} weight={selectedSheetId === s.id ? 'fill' : 'regular'} />
              )}
              <span className="sheet-nav-name">{s.name}</span>
              <span className="sheet-nav-count mono">{s.problem_count || 0}</span>
            </button>
          ))}
          {filteredSheets.length === 0 && (
            <div className="muted text-sm">
              {sheets.length === 0
                ? 'No problem sheets created yet. Create a sheet to begin organizing problems!'
                : 'No sheets in this group yet. Click "+ New Sheet" above to add one to this group!'}
            </div>
          )}
        </div>
      </div>

      {selectedSheetId && sheetData && (
        <div className="sheet-content-wrap">
          <div className="sheet-meta-bar">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="sheet-heading" style={{ margin: 0 }}>{sheetData.name}</h3>
                {sheetData.group_name && (
                  <span className="badge-pending" style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>
                    Group: {sheetData.group_name}
                  </span>
                )}
                {sheetData.is_private && (
                  <span className="badge-private">
                    <Lock size={11} /> Private
                  </span>
                )}
                <button
                  type="button"
                  className="link-btn link-btn-danger text-xs"
                  onClick={() => handleDeleteSheet(sheetData.id, sheetData.name)}
                  title="Delete this sheet"
                  style={{ marginLeft: '8px' }}
                >
                  <Trash size={14} /> Delete
                </button>
              </div>
              <div className="muted text-sm" style={{ marginTop: '4px' }}>
                Created {sheetData.created_at?.slice(0, 10)} &bull; {solvedCount} of {totalCount} solved ({Math.round(percent)}%)
              </div>
              <div className="progress-bar-wrap" style={{ width: '220px', marginTop: '6px' }}>
                <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>

            <form className="sheet-quick-add" onSubmit={handleAddProblem}>
              <input
                className="mono"
                placeholder="Prob #"
                value={newProblemNumber}
                onChange={(e) => setNewProblemNumber(e.target.value)}
                style={{ width: '90px' }}
                required
              />
              <input
                placeholder="Topic / Note (e.g. DP, Graph)"
                value={newProblemNote}
                onChange={(e) => setNewProblemNote(e.target.value)}
                style={{ width: '200px' }}
              />
              <button type="submit" className="btn-small" disabled={actionBusy}>
                <Plus size={12} weight="bold" />
                Add
              </button>
            </form>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Status</th>
                  <th className="mono" style={{ width: '80px' }}>#</th>
                  <th>Title</th>
                  <th>Topic / Note</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sheetData.problems?.map((p) => (
                  <tr key={p.problem_number}>
                    <td>
                      {p.solved ? (
                        <span className="badge badge-ok">
                          <CheckCircle size={12} weight="fill" />
                          Solved
                        </span>
                      ) : (
                        <span className="badge badge-neutral">
                          <Circle size={12} />
                          Unsolved
                        </span>
                      )}
                    </td>
                    <td className="mono bold">{p.problem_number}</td>
                    <td>{p.title}</td>
                    <td className="muted text-sm">
                      {p.note ? <span className="chip">{p.note}</span> : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => onViewStatement(p.problem_number, p.title)}
                        >
                          <FileText size={14} />
                          Statement
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => onPickProblem(p.problem_number)}
                        >
                          <PaperPlaneTilt size={14} />
                          Submit
                        </button>
                        <button
                          type="button"
                          className="link-btn link-btn-danger"
                          onClick={() => handleRemoveProblem(p.problem_number)}
                          title="Remove problem from sheet"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!sheetData.problems || sheetData.problems.length === 0) && (
                  <tr>
                    <td colSpan={5} className="empty">
                      This sheet is empty. Add problems above or from the Problems tab!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Problem Sheet</div>
              <button
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateSheet}>
              <div className="modal-body">
                <label>
                  Sheet Name
                  <input
                    type="text"
                    placeholder="e.g. Dynamic Programming Classics"
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    autoFocus
                    required
                  />
                </label>
                {groups.length > 0 && (
                  <label style={{ marginTop: '12px' }}>
                    Topic Group
                    <select
                      value={newSheetGroupId}
                      onChange={(e) => setNewSheetGroupId(e.target.value)}
                    >
                      <option value="">— None (General) —</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div style={{ marginTop: '12px' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    <span>Make this sheet private (require passkey)</span>
                  </label>
                </div>
                {isPrivate && (
                  <label style={{ marginTop: '12px' }}>
                    Access Passkey (optional)
                    <input
                      type="password"
                      placeholder="e.g. dpmaster2026"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-small" disabled={actionBusy || !newSheetName.trim()}>
                  Create Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passkeyModalTarget && (
        <PasskeyModal
          title={passkeyModalTarget.name}
          targetType="Sheet"
          onUnlock={handleUnlockPasskey}
          onCancel={() => setPasskeyModalTarget(null)}
        />
      )}

      {showCreateGroupModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateGroupModal(false)}>
          <div className="modal-container modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Topic Group</div>
              <button
                className="modal-close-btn"
                onClick={() => setShowCreateGroupModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body">
                {groupModalError && <div className="form-error">{groupModalError}</div>}
                <label>
                  Group Name
                  <input
                    type="text"
                    placeholder="e.g. Graph Theory"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    autoFocus
                    required
                  />
                </label>
                <label style={{ marginTop: '12px' }}>
                  Description (optional)
                  <input
                    type="text"
                    placeholder="e.g. BFS, DFS, shortest paths…"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                  />
                </label>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setShowCreateGroupModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-small" disabled={actionBusy || !newGroupName.trim()}>
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contests Panel (with Live Countdown, ACM Standings, Privacy, & Deletion)
// ---------------------------------------------------------------------------

function formatDuration(seconds) {
  if (seconds < 0) seconds = 0
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')

  if (d > 0) return `${d}d ${hh}:${mm}:${ss}`
  return `${hh}:${mm}:${ss}`
}

function ContestsPanel({ onPickProblem, onViewStatement, sheets }) {
  const [contests, setContests] = useState([])
  const [activeContestId, setActiveContestId] = useState(null)
  const [contestDetail, setContestDetail] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [now, setNow] = useState(new Date())

  const [formName, setFormName] = useState('')
  const [formSheetId, setFormSheetId] = useState('')
  const [formProblemsDirect, setFormProblemsDirect] = useState('')
  const [problemSource, setProblemSource] = useState('sheet')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formPenalty, setFormPenalty] = useState(20)
  const [isPrivate, setIsPrivate] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [modalError, setModalError] = useState('')
  const [passkeyModalTarget, setPasskeyModalTarget] = useState(null)
  const unlockedContestCodesRef = useRef({})

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function loadContests() {
    try {
      const list = await api.getContests()
      setContests(list)
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadContestDetail(id, code = '') {
    const effectiveCode = code || unlockedContestCodesRef.current[id] || ''
    try {
      const data = await api.getContest(id, effectiveCode)
      setContestDetail(data)
      if (effectiveCode) unlockedContestCodesRef.current[id] = effectiveCode
    } catch (err) {
      if (err.status === 403 && err.data?.is_private) {
        setPasskeyModalTarget({ id, name: err.data.name || 'Private Contest' })
      } else {
        setError(err.message)
      }
    }
  }

  async function handleUnlockContest(enteredCode) {
    if (!passkeyModalTarget) return
    const id = passkeyModalTarget.id
    await api.verifyContestAccess(id, enteredCode)
    unlockedContestCodesRef.current[id] = enteredCode
    setPasskeyModalTarget(null)
    setActiveContestId(id)
    await loadContestDetail(id, enteredCode)
  }

  useEffect(() => {
    loadContests()
  }, [])

  useEffect(() => {
    if (activeContestId) {
      loadContestDetail(activeContestId)
      if (autoRefresh) {
        const interval = setInterval(() => loadContestDetail(activeContestId), 10000)
        return () => clearInterval(interval)
      }
    } else {
      setContestDetail(null)
    }
  }, [activeContestId, autoRefresh])

  function getContestState(c) {
    const start = new Date(c.start_time).getTime()
    const end = new Date(c.end_time).getTime()
    const current = now.getTime()

    if (current < start) {
      return {
        status: 'upcoming',
        badge: 'badge-pending',
        label: 'Upcoming',
        remainingSecs: Math.floor((start - current) / 1000),
        timerPrefix: 'Starts in',
      }
    } else if (current <= end) {
      return {
        status: 'running',
        badge: 'badge-ok',
        label: 'Live Now',
        remainingSecs: Math.floor((end - current) / 1000),
        timerPrefix: 'Time left',
      }
    } else {
      return {
        status: 'ended',
        badge: 'badge-neutral',
        label: 'Finished',
        remainingSecs: 0,
        timerPrefix: 'Ended',
      }
    }
  }

  async function handleCreateContest(e) {
    e.preventDefault()
    setModalError('')
    setError('')
    if (!formName.trim() || !formStart || !formEnd) {
      setModalError('Please fill in all required fields.')
      return
    }
    if (problemSource === 'sheet' && !formSheetId) {
      setModalError('Please select a problem sheet or enter problem numbers directly.')
      return
    }
    if (problemSource === 'direct' && !formProblemsDirect.trim()) {
      setModalError('Please enter at least one problem number (e.g. 100, 10189).')
      return
    }
    setCreating(true)
    try {
      const payload = {
        name: formName.trim(),
        start_time: new Date(formStart).toISOString(),
        end_time: new Date(formEnd).toISOString(),
        penalty_minutes: Number(formPenalty) || 20,
        is_private: isPrivate,
        access_code: isPrivate ? accessCode.trim() : '',
      }
      if (problemSource === 'sheet') {
        payload.sheet_id = Number(formSheetId)
      } else {
        payload.problem_numbers = formProblemsDirect.trim()
      }
      const res = await api.createContest(payload)
      setShowCreateModal(false)
      setFormName('')
      setFormSheetId('')
      setFormProblemsDirect('')
      setFormStart('')
      setFormEnd('')
      setIsPrivate(false)
      setAccessCode('')
      setModalError('')
      await loadContests()
      setActiveContestId(res.id)
    } catch (err) {
      setModalError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteContest(contestId, contestName) {
    if (!window.confirm(`Are you sure you want to delete "${contestName}"?`)) return
    try {
      await api.deleteContest(contestId)
      if (activeContestId === contestId) setActiveContestId(null)
      await loadContests()
    } catch (err) {
      setError(err.message)
    }
  }

  function openCreateModal() {
    const current = new Date()
    const oneHourLater = new Date(current.getTime() + 2 * 3600 * 1000)
    const toLocalISO = (d) => {
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setFormStart(toLocalISO(current))
    setFormEnd(toLocalISO(oneHourLater))
    setProblemSource(sheets && sheets.length > 0 ? 'sheet' : 'direct')
    if (sheets && sheets.length > 0) setFormSheetId(String(sheets[0].id))
    setModalError('')
    setShowCreateModal(true)
  }

  return (
    <div className="panel">
      {activeContestId && contestDetail ? (
        <div className="contest-detail-view">
          <div className="panel-head">
            <div className="contest-header-left">
              <button
                type="button"
                className="link-btn back-btn"
                onClick={() => setActiveContestId(null)}
              >
                ← Back to Contests
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0 }}>{contestDetail.name}</h2>
                {contestDetail.is_private && (
                  <span className="badge-private">
                    <Lock size={11} /> Private
                  </span>
                )}
              </div>
              <div className="muted text-sm">
                Problem Sheet: <span className="bold">{contestDetail.sheet_name}</span> &bull;{' '}
                {contestDetail.penalty_minutes}m ACM Penalty
              </div>
            </div>

            {(() => {
              const state = getContestState(contestDetail)
              return (
                <div className="contest-header-right">
                  <div className={`countdown-badge ${state.badge}`}>
                    {state.status === 'running' && <span className="status-dot" />}
                    <span className="countdown-label">{state.timerPrefix}:</span>
                    <span className="countdown-time mono">
                      {state.status === 'ended' ? '00:00:00' : formatDuration(state.remainingSecs)}
                    </span>
                  </div>
                  <label className="toggle text-xs" style={{ marginTop: '6px' }}>
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    Live Refresh
                  </label>
                </div>
              )
            })()}
          </div>

          <div className="scoreboard-strip">
            <div className="score-stat">
              <Trophy size={26} color="var(--accent)" />
              <div>
                <span className="score-stat-num mono">{contestDetail.total_solved || 0}</span>
                <span className="score-stat-label muted">
                  / {contestDetail.problems?.length || 0} Solved
                </span>
              </div>
            </div>
            <div className="score-stat">
              <Clock size={26} color="var(--pending)" />
              <div>
                <span className="score-stat-num mono">{contestDetail.total_penalty || 0}</span>
                <span className="score-stat-label muted">Total Penalty (mins)</span>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="mono" style={{ width: '60px' }}>Pos</th>
                  <th className="mono" style={{ width: '80px' }}>#</th>
                  <th>Problem Title</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Result</th>
                  <th className="mono" style={{ width: '100px', textAlign: 'right' }}>Time</th>
                  <th className="mono" style={{ width: '100px', textAlign: 'right' }}>Attempts</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contestDetail.problems?.map((p, idx) => (
                  <tr key={p.problem_number}>
                    <td className="mono muted">{String.fromCharCode(65 + idx)}</td>
                    <td className="mono bold">{p.problem_number}</td>
                    <td>{p.title}</td>
                    <td style={{ textAlign: 'center' }}>
                      {p.solved ? (
                        <span className="badge badge-ok">
                          <CheckCircle size={12} weight="fill" />
                          Accepted
                        </span>
                      ) : p.wrong_attempts > 0 ? (
                        <span className="badge badge-bad">
                          -{p.wrong_attempts}
                        </span>
                      ) : (
                        <span className="badge badge-neutral">—</span>
                      )}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {p.solve_time || '—'}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {p.attempts || 0}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => onViewStatement(p.problem_number, p.title)}
                        >
                          <FileText size={14} />
                          Statement
                        </button>
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => onPickProblem(p.problem_number)}
                        >
                          <PaperPlaneTilt size={13} weight="bold" />
                          Solve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="panel-head">
            <div>
              <h2>Practice Contests</h2>
              <div className="panel-sub">Timed simulation & ACM-ICPC style competition</div>
            </div>
            <button
              type="button"
              className="btn-small"
              onClick={openCreateModal}
            >
              <Plus size={14} weight="bold" />
              Create Contest
            </button>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Status</th>
                  <th>Contest Name</th>
                  <th>Sheet</th>
                  <th>Window</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contests.map((c) => {
                  const state = getContestState(c)
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className={`badge ${state.badge}`}>{state.label}</span>
                      </td>
                      <td className="bold">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{c.name}</span>
                          {c.is_private && (
                            <span className="badge-private" title="Private contest">
                              <Lock size={11} /> Private
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{c.sheet_name}</td>
                      <td className="muted text-sm mono">
                        {new Date(c.start_time).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        —{' '}
                        {new Date(c.end_time).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="link-btn"
                            onClick={() => setActiveContestId(c.id)}
                          >
                            Open Contest →
                          </button>
                          <button
                            type="button"
                            className="link-btn link-btn-danger"
                            onClick={() => handleDeleteContest(c.id, c.name)}
                            title="Delete this contest"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {contests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No contests scheduled yet. Create one to test your timed performance!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Schedule Practice Contest</div>
              <button
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateContest}>
              <div className="modal-body">
                {modalError && (
                  <div className="form-error" style={{ marginBottom: '14px' }}>
                    {modalError}
                  </div>
                )}
                <label>
                  Contest Name
                  <input
                    type="text"
                    placeholder="e.g. ICPC Warmup 2026 #1"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </label>

                <div style={{ margin: '8px 0 12px' }}>
                  <span className="text-xs bold muted" style={{ display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Problem Set Source
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`sheet-nav-pill ${problemSource === 'sheet' ? 'active' : ''}`}
                      style={{ cursor: sheets.length === 0 ? 'not-allowed' : 'pointer', opacity: sheets.length === 0 ? 0.6 : 1 }}
                      onClick={() => sheets.length > 0 && setProblemSource('sheet')}
                    >
                      <FolderSimple size={14} />
                      <span>Existing Sheet {sheets.length === 0 ? '(0)' : `(${sheets.length})`}</span>
                    </button>
                    <button
                      type="button"
                      className={`sheet-nav-pill ${problemSource === 'direct' ? 'active' : ''}`}
                      onClick={() => setProblemSource('direct')}
                    >
                      <Code size={14} />
                      <span>Enter Problem #s Directly</span>
                    </button>
                  </div>
                </div>

                {problemSource === 'sheet' && sheets.length > 0 ? (
                  <label>
                    Problem Sheet
                    <select
                      value={formSheetId}
                      onChange={(e) => setFormSheetId(e.target.value)}
                      required
                    >
                      {sheets.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.problem_count || 0} problems)
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    UVa Problem Numbers
                    <input
                      type="text"
                      placeholder="e.g. 100, 10189, 10004, 108"
                      value={formProblemsDirect}
                      onChange={(e) => setFormProblemsDirect(e.target.value)}
                      required
                    />
                    <span className="muted text-xs" style={{ marginTop: '2px' }}>
                      Comma or space separated UVa problem numbers. A contest sheet will be auto-generated.
                    </span>
                  </label>
                )}

                <div className="field-row">
                  <label>
                    Start Time
                    <input
                      type="datetime-local"
                      value={formStart}
                      onChange={(e) => setFormStart(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    End Time
                    <input
                      type="datetime-local"
                      value={formEnd}
                      onChange={(e) => setFormEnd(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <label>
                  Wrong Answer Penalty (minutes)
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={formPenalty}
                    onChange={(e) => setFormPenalty(e.target.value)}
                    required
                  />
                </label>
                <div style={{ marginTop: '8px' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                    <span>Make this contest private (require passkey)</span>
                  </label>
                </div>
                {isPrivate && (
                  <label style={{ marginTop: '12px' }}>
                    Access Passkey (optional)
                    <input
                      type="password"
                      placeholder="e.g. icpcsecret"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                    />
                  </label>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-small" disabled={creating}>
                  {creating ? 'Creating…' : 'Schedule Contest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {passkeyModalTarget && (
        <PasskeyModal
          title={passkeyModalTarget.name}
          targetType="Contest"
          onUnlock={handleUnlockContest}
          onCancel={() => setPasskeyModalTarget(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Submissions Panel & Code Viewer
// ---------------------------------------------------------------------------

function SubmissionCodeModal({ submission, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    if (!submission?.run_id) return

    api
      .getSubmissionCode(submission.run_id)
      .then((res) => {
        if (active) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [submission?.run_id])

  function handleCopy() {
    if (data?.code) {
      navigator.clipboard.writeText(data.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!submission) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal submission-code-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3 style={{ margin: 0 }}>
              Run #{submission.run_id} — Problem {submission.problem_id}
            </h3>
            <div className="text-xs muted" style={{ marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>{submission.problem_name}</span>
              <span>&bull;</span>
              <VerdictBadge verdict={submission.verdict} />
              <span>&bull;</span>
              <span className="mono">{submission.language}</span>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="submission-modal-body">
          {loading ? (
            <div className="empty" style={{ padding: '32px' }}>Loading source code…</div>
          ) : data?.code ? (
            <div className="code-viewer-wrap">
              <div className="code-viewer-toolbar">
                <span className="mono text-xs muted">
                  {data.language || submission.language} &bull; {data.code.length} characters
                </span>
                <button type="button" className="btn-small text-xs" onClick={handleCopy}>
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <pre className="submission-code-pre">{data.code}</pre>
            </div>
          ) : (
            <div className="empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
              <p className="bold" style={{ marginBottom: '6px' }}>Source Code Not Archived</p>
              <p className="text-sm muted" style={{ maxWidth: '420px', margin: '0 auto' }}>
                Full source code storage is active for solutions submitted directly through this workspace.
              </p>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmissionsPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedSub, setSelectedSub] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.status()
      setRows(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Recent Submissions</h2>
          <div className="panel-sub">Your live submission stream scraped from onlinejudge.org</div>
        </div>
        <button type="button" className="btn-small" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="mono">Run ID</th>
              <th className="mono">Date</th>
              <th className="mono">#</th>
              <th>Problem</th>
              <th>Verdict</th>
              <th className="mono">Time</th>
              <th>Lang</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.run_id}>
                <td className="mono muted">{r.run_id}</td>
                <td className="mono text-sm muted">{r.date}</td>
                <td className="mono bold">{r.problem_id}</td>
                <td>{r.problem_name}</td>
                <td>
                  <VerdictBadge verdict={r.verdict} />
                </td>
                <td className="mono">{r.runtime}</td>
                <td className="muted">{r.language}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="link-btn text-xs"
                    onClick={() => setSelectedSub(r)}
                  >
                    <Code size={13} /> View Code
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="empty">
                  No submissions found yet. Submit a solution to see your runs here!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedSub && (
        <SubmissionCodeModal
          submission={selectedSub}
          onClose={() => setSelectedSub(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Solved Problems Panel
// ---------------------------------------------------------------------------

function SolvedPanel({ onPickProblem, onViewStatement }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    api
      .solved()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const problems = data?.solved_problems || []
  const filtered = problems.filter((p) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return String(p.number).includes(q) || (p.title || '').toLowerCase().includes(q)
  })

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Solved Problems</h2>
          <div className="panel-sub">
            Verified accepted problems cross-referenced with your official UVa submission history
          </div>
        </div>
        {data && (
          <div className="badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px' }}>
            <CheckCircle size={16} weight="fill" />
            <span className="mono bold">{data.total_solved || 0} Solved</span>
          </div>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      <div style={{ margin: '14px 0 18px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
          <MagnifyingGlass className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Search solved by title or # (e.g. 100, 3n+1)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {search && (
          <span className="muted text-xs mono">
            {filtered.length} of {problems.length} shown
          </span>
        )}
      </div>

      {loading && <div className="muted text-sm">Querying uHunt profile & solved problems…</div>}

      {!loading && data && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>Status</th>
                <th className="mono" style={{ width: '90px' }}>#</th>
                <th>Problem Title</th>
                <th className="mono" style={{ width: '130px' }}>Distinct Solvers</th>
                <th style={{ width: '220px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id || p.number}>
                  <td style={{ textAlign: 'center' }}>
                    <CheckCircle size={18} color="var(--ok)" weight="fill" />
                  </td>
                  <td className="mono bold" style={{ color: 'var(--accent)' }}>
                    #{p.number}
                  </td>
                  <td className="bold">
                    <span
                      className="link-btn-text"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onViewStatement?.(p.number, p.title)}
                      title="View problem statement"
                    >
                      {p.title}
                    </span>
                  </td>
                  <td className="mono muted text-sm">
                    {p.dacu ? p.dacu.toLocaleString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row-actions" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-text text-xs"
                        onClick={() => onViewStatement?.(p.number, p.title)}
                        title="Read statement"
                      >
                        <FileText size={13} />
                        Statement
                      </button>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => onPickProblem(p.number)}
                        title="Submit code for this problem"
                      >
                        <PaperPlaneTilt size={13} />
                        Solve Again
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    {search ? 'No solved problems matching your search.' : 'No solved problems found on this UVa account yet. Pick a problem and submit to get started!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile & Analytics Panel
// ---------------------------------------------------------------------------

const AVATAR_PRESETS = [
  '⚡', '🏆', '👾', '🚀', '🎯', '💻', '🦊', '🦉'
]

function ProfilePanel({ onViewStatement, onPickProblem }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [customAvatarUrl, setCustomAvatarUrl] = useState('')
  const fileInputRef = useRef(null)

  async function loadProfile() {
    setLoading(true)
    setError('')
    try {
      const res = await api.getProfile()
      setProfile(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  async function handleSelectAvatar(avatarStr) {
    try {
      await api.updateAvatar(avatarStr)
      setProfile((prev) => (prev ? { ...prev, avatar: avatarStr } : prev))
      setShowAvatarPicker(false)
    } catch (err) {
      setError(err.message)
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 150000) {
      alert('Image file is too large (max 150 KB). Please pick a smaller image.')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const b64 = reader.result
      await handleSelectAvatar(b64)
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="muted text-sm" style={{ padding: '24px' }}>
          Loading profile telemetry & analytics…
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="panel">
        <div className="form-error">Could not load profile: {error}</div>
      </div>
    )
  }

  const verdicts = profile.verdicts || {}
  const totalSubs = profile.total_submissions || 0
  const acceptedSubs = profile.accepted_submissions || 0
  const accuracy = profile.acceptance_rate || 0.0

  const waCount = verdicts['Wrong answer'] || 0
  const tleCount = verdicts['Time limit exceeded'] || 0
  const otherCount = Math.max(0, totalSubs - acceptedSubs - waCount - tleCount)

  const okPct = totalSubs > 0 ? (acceptedSubs / totalSubs) * 100 : 0
  const waPct = totalSubs > 0 ? (waCount / totalSubs) * 100 : 0
  const tlePct = totalSubs > 0 ? (tleCount / totalSubs) * 100 : 0
  const otherPct = totalSubs > 0 ? (otherCount / totalSubs) * 100 : 0

  const topics = profile.topics || {}
  const difficulty = profile.difficulty || {}
  const maxTopicVal = Math.max(1, ...Object.values(topics))

  return (
    <div className="profile-panel">
      {/* Top User Hero Card */}
      <div className="profile-hero-card">
        <div className="profile-user-group">
          <div
            className="profile-avatar-circle"
            onClick={() => setShowAvatarPicker(true)}
            title="Click to change profile avatar"
            style={{ cursor: 'pointer' }}
          >
            {profile.avatar ? (
              profile.avatar.startsWith('data:') || profile.avatar.startsWith('http') ? (
                <img src={profile.avatar} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <span>{profile.avatar}</span>
              )
            ) : (
              <span>{profile.username?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="profile-names">
            <h2>{profile.name || profile.username}</h2>
            <div className="muted">
              @{profile.username} &bull; {profile.uid ? `uHunt UID: #${profile.uid}` : 'Local Account'}
            </div>
            <button
              type="button"
              className="btn-text link-btn text-xs"
              style={{ padding: 0, marginTop: '4px' }}
              onClick={() => setShowAvatarPicker(true)}
            >
              Change profile pic…
            </button>
          </div>
        </div>

        <div className="profile-metrics-strip">
          <div className="profile-metric-pill">
            <div className="profile-metric-num mono" style={{ color: 'var(--ok)' }}>
              {profile.total_solved}
            </div>
            <div className="profile-metric-label">Problems Solved</div>
          </div>
          <div className="profile-metric-pill">
            <div className="profile-metric-num mono">{totalSubs}</div>
            <div className="profile-metric-label">Submissions</div>
          </div>
          <div className="profile-metric-pill">
            <div className="profile-metric-num mono" style={{ color: 'var(--accent)' }}>
              {accuracy}%
            </div>
            <div className="profile-metric-label">Accuracy Rate</div>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="profile-analytics-grid">
        {/* Accuracy & Verdict Breakdown */}
        <div className="analytics-card">
          <div className="analytics-head">
            <h3>
              <CheckCircle size={18} color="var(--ok)" />
              Submission Accuracy & Verdicts
            </h3>
            <span className="mono bold text-sm">{accuracy}% AC</span>
          </div>

          <div className="accuracy-stacked-bar">
            <div className="stacked-segment ok" style={{ width: `${okPct}%` }} title={`Accepted: ${acceptedSubs} (${okPct.toFixed(1)}%)`} />
            <div className="stacked-segment bad" style={{ width: `${waPct}%` }} title={`Wrong Answer: ${waCount} (${waPct.toFixed(1)}%)`} />
            <div className="stacked-segment pending" style={{ width: `${tlePct}%` }} title={`Time Limit: ${tleCount} (${tlePct.toFixed(1)}%)`} />
            <div className="stacked-segment other" style={{ width: `${otherPct}%` }} title={`Runtime/Compile/Other: ${otherCount} (${otherPct.toFixed(1)}%)`} />
          </div>

          <div className="verdicts-list">
            <div className="verdict-row-item">
              <span className="muted">Accepted</span>
              <span className="mono bold" style={{ color: 'var(--ok)' }}>{acceptedSubs}</span>
            </div>
            <div className="verdict-row-item">
              <span className="muted">Wrong answer</span>
              <span className="mono bold" style={{ color: 'var(--bad)' }}>{waCount}</span>
            </div>
            <div className="verdict-row-item">
              <span className="muted">Time limit exceeded</span>
              <span className="mono bold" style={{ color: 'var(--pending)' }}>{tleCount}</span>
            </div>
            <div className="verdict-row-item">
              <span className="muted">Runtime / Compile</span>
              <span className="mono bold">{otherCount}</span>
            </div>
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="analytics-card">
          <div className="analytics-head">
            <h3>
              <Trophy size={18} color="var(--accent)" />
              Difficulty & Rating Curve
            </h3>
            <span className="muted text-sm">Distinct Solvers (DACU)</span>
          </div>

          <div className="diff-tier-grid">
            {[
              { key: 'Level 1 (Beginner)', label: 'Beginner', color: '#10b981' },
              { key: 'Level 2 (Easy)', label: 'Easy', color: '#06b6d4' },
              { key: 'Level 3 (Medium)', label: 'Medium', color: '#3b82f6' },
              { key: 'Level 4 (Hard)', label: 'Hard', color: '#eab308' },
              { key: 'Level 5 (Master)', label: 'Master', color: '#f43f5e' },
            ].map((d) => (
              <div key={d.key} className="diff-tier-card" style={{ borderColor: d.color }}>
                <div className="diff-tier-count mono" style={{ color: d.color }}>
                  {difficulty[d.key] || 0}
                </div>
                <div className="diff-tier-name">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Topic Mastery Breakdown */}
      <div className="analytics-card">
        <div className="analytics-head">
          <h3>
            <Code size={18} color="var(--accent)" />
            Topic Mastery & Algorithm Categories
          </h3>
          <span className="muted text-sm">Solved Problem Count</span>
        </div>

        <div className="topic-list">
          {[
            'Dynamic Programming',
            'Graph Theory',
            'Data Structures',
            'Mathematics',
            'Greedy & Sorting',
            'String Processing',
            'Geometry',
            'Ad Hoc & Simulation',
          ].map((topicName) => {
            const count = topics[topicName] || 0
            const pct = (count / maxTopicVal) * 100
            return (
              <div key={topicName} className="topic-row">
                <div className="topic-info">
                  <span className="bold">{topicName}</span>
                  <span className="mono muted text-sm">{count} solved</span>
                </div>
                <div className="topic-track">
                  <div className="topic-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Solved Activity */}
      {profile.recent_solved && profile.recent_solved.length > 0 && (
        <div className="analytics-card">
          <div className="analytics-head">
            <h3>
              <Sparkle size={18} color="var(--ok)" />
              Recently Solved Problems
            </h3>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="mono" style={{ width: '80px' }}>#</th>
                  <th>Problem Title</th>
                  <th>Topic</th>
                  <th>Difficulty</th>
                  <th className="mono" style={{ width: '130px' }}>Solved On</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {profile.recent_solved.map((p) => (
                  <tr key={p.pid}>
                    <td className="mono bold">{p.number}</td>
                    <td>{p.title}</td>
                    <td>
                      <span className="chip">{p.topic}</span>
                    </td>
                    <td>
                      <span className="badge badge-neutral text-xs">{p.difficulty}</span>
                    </td>
                    <td className="mono muted text-xs">
                      {p.solved_at?.slice(0, 10)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="link-btn text-xs"
                          onClick={() => onViewStatement?.(p.number, p.title)}
                        >
                          Statement
                        </button>
                        <button
                          type="button"
                          className="btn-small text-xs"
                          onClick={() => onPickProblem?.(p.number)}
                        >
                          Submit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="modal-backdrop" onClick={() => setShowAvatarPicker(false)}>
          <div className="modal-container modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Choose Profile Avatar</div>
              <button className="modal-close-btn" onClick={() => setShowAvatarPicker(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="muted text-sm" style={{ marginBottom: '12px' }}>
                Select an avatar preset:
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {AVATAR_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    style={{
                      fontSize: '24px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                    }}
                    onClick={() => handleSelectAvatar(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="muted text-sm" style={{ marginBottom: '8px' }}>
                Or upload an image file (PNG/JPG max 150 KB):
              </div>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadSimple size={16} />
                Upload from computer
              </button>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-text" onClick={() => setShowAvatarPicker(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Landing Page (Public Showcase & Entryway)
// ---------------------------------------------------------------------------

const MOCKUP_CODE = [
  { n: 1, tokens: [{ c: 'kw', t: '#include' }, { t: ' ' }, { c: 'str', t: '<iostream>' }] },
  { n: 2, tokens: [{ c: 'kw', t: '#include' }, { t: ' ' }, { c: 'str', t: '<vector>' }] },
  { n: 3, tokens: [{ c: 'kw', t: '#include' }, { t: ' ' }, { c: 'str', t: '<string>' }] },
  { n: 4, tokens: [{ c: 'kw', t: 'using namespace' }, { c: 'type', t: ' std' }, { t: ';' }] },
  { n: 5, tokens: [] },
  { n: 6, tokens: [{ c: 'kw', t: 'const' }, { c: 'type', t: ' int' }, { t: ' dr[] = {-1,-1,-1, 0, 0, 1, 1, 1};' }] },
  { n: 7, tokens: [{ c: 'kw', t: 'const' }, { c: 'type', t: ' int' }, { t: ' dc[] = {-1, 0, 1,-1, 1,-1, 0, 1};' }] },
  { n: 8, tokens: [] },
  { n: 9, tokens: [{ c: 'type', t: 'int' }, { t: ' ' }, { c: 'func', t: 'main' }, { t: '() {' }] },
  { n: 10, tokens: [{ t: '    ' }, { c: 'type', t: 'int' }, { t: ' n, m, field = ' }, { c: 'num', t: '1' }, { t: ';' }] },
  { n: 11, tokens: [{ t: '    ' }, { c: 'kw', t: 'while' }, { t: ' (cin >> n >> m && (n || m)) {' }] },
  { n: 12, tokens: [{ t: '        ' }, { c: 'kw', t: 'if' }, { t: ' (field > ' }, { c: 'num', t: '1' }, { t: ') cout << ' }, { c: 'str', t: '"\\n"' }, { t: ';' }] },
  { n: 13, tokens: [{ t: '        ' }, { c: 'type', t: 'vector<string>' }, { t: ' grid(n);' }] },
  { n: 14, tokens: [{ t: '        ' }, { c: 'kw', t: 'for' }, { t: ' (' }, { c: 'type', t: 'int' }, { t: ' i = ' }, { c: 'num', t: '0' }, { t: '; i < n; ++i) cin >> grid[i];' }] },
  { n: 15, tokens: [{ t: '        cout << ' }, { c: 'str', t: '"Field #"' }, { t: ' << field++ << ' }, { c: 'str', t: '":\\n"' }, { t: ';' }] },
  { n: 16, tokens: [] },
  { n: 17, tokens: [{ t: '        ' }, { c: 'kw', t: 'for' }, { t: ' (' }, { c: 'type', t: 'int' }, { t: ' r = ' }, { c: 'num', t: '0' }, { t: '; r < n; ++r) {' }] },
  { n: 18, tokens: [{ t: '            ' }, { c: 'kw', t: 'for' }, { t: ' (' }, { c: 'type', t: 'int' }, { t: ' c = ' }, { c: 'num', t: '0' }, { t: '; c < m; ++c) {' }] },
  { n: 19, tokens: [{ t: '                ' }, { c: 'kw', t: 'if' }, { t: ' (grid[r][c] == ' }, { c: 'str', t: "'*'" }, { t: ') {' }] },
  { n: 20, tokens: [{ t: '                    cout << ' }, { c: 'str', t: "'*'" }, { t: ';' }] },
  { n: 21, tokens: [{ t: '                } ' }, { c: 'kw', t: 'else' }, { t: ' {' }] },
  { n: 22, tokens: [{ t: '                    ' }, { c: 'type', t: 'int' }, { t: ' count = ' }, { c: 'num', t: '0' }, { t: ';' }] },
  { n: 23, tokens: [{ t: '                    ' }, { c: 'kw', t: 'for' }, { t: ' (' }, { c: 'type', t: 'int' }, { t: ' k = ' }, { c: 'num', t: '0' }, { t: '; k < ' }, { c: 'num', t: '8' }, { t: '; ++k) {' }] },
  { n: 24, tokens: [{ t: '                        ' }, { c: 'type', t: 'int' }, { t: ' nr = r + dr[k], nc = c + dc[k];' }] },
  { n: 25, tokens: [{ t: '                        ' }, { c: 'kw', t: 'if' }, { t: ' (nr >= ' }, { c: 'num', t: '0' }, { t: ' && nr < n && nc >= ' }, { c: 'num', t: '0' }, { t: ' && nc < m)' }] },
  { n: 26, tokens: [{ t: '                            ' }, { c: 'kw', t: 'if' }, { t: ' (grid[nr][nc] == ' }, { c: 'str', t: "'*'" }, { t: ') count++;' }] },
  { n: 27, tokens: [{ t: '                    }' }] },
  { n: 28, tokens: [{ t: '                    cout << count;' }] },
  { n: 29, tokens: [{ t: '                }' }] },
  { n: 30, tokens: [{ t: '            }' }] },
  { n: 31, tokens: [{ t: '            cout << ' }, { c: 'str', t: '"\\n"' }, { t: ';' }] },
  { n: 32, tokens: [{ t: '        }' }] },
  { n: 33, tokens: [{ t: '    }' }] },
  { n: 34, tokens: [{ t: '    ' }, { c: 'kw', t: 'return' }, { t: ' ' }, { c: 'num', t: '0' }, { t: ';' }] },
  { n: 35, tokens: [{ t: '}' }] },
]

// ---------------------------------------------------------------------------
// About Page (Developer Info & Portfolio)
// ---------------------------------------------------------------------------

function AboutPanel() {
  const socialLinks = [
    {
      name: 'Portfolio',
      url: 'https://yusufmohammaddsai.vercel.app/',
      handle: 'yusufmohammaddsai.vercel.app',
      icon: ArrowSquareOut,
      primary: true,
    },
    {
      name: 'GitHub',
      url: 'https://github.com/imunderthetree',
      handle: 'github.com/imunderthetree',
      icon: GithubLogo,
    },
    {
      name: 'LinkedIn',
      url: 'https://linkedin.com/in/yusufmohammaddsai',
      handle: 'linkedin.com/in/yusufmohammaddsai',
      icon: LinkedinLogo,
    },
    {
      name: 'Codeforces',
      url: 'https://codeforces.com/profile/cloudielst',
      handle: 'cf/cloudielst',
      icon: Code,
    },
    {
      name: 'LeetCode',
      url: 'https://leetcode.com/u/joeisunderthetree',
      handle: 'lc/joeisunderthetree',
      icon: Trophy,
    },
    {
      name: 'Email',
      url: 'mailto:yusufalazhar7@gmail.com',
      handle: 'yusufalazhar7@gmail.com',
      icon: EnvelopeSimple,
    },
  ]

  const stats = [
    { num: '10+', label: 'Software Projects Shipped' },
    { num: '150+', label: 'ICPC Applicants Coached / Season' },
    { num: '200+', label: 'Developer Conference Attendees' },
    { num: '10,000+', label: 'UVa Problems Indexed & Cached' },
  ]

  return (
    <div className="about-panel">
      {/* Creator Spotlight Header Card */}
      <div className="about-hero-card">
        <div className="about-user-group">
          <div className="about-avatar-circle">
            <User size={38} weight="bold" />
          </div>
          <div className="about-names">
            <div className="about-status-strip">
              <span className="status-dot" />
              <span className="mono text-xs">Creator & ICPC Community Leader</span>
            </div>
            <h2>Yusuf Mohammad</h2>
            <p className="muted">
              Data Science & AI student at <strong>Zewail City of Science and Technology</strong> • ICPC ZC Community Leader • IEEE CS Vice Head
            </p>
          </div>
        </div>

        <div className="about-cta-box">
          <a
            href="https://yusufmohammaddsai.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="portfolio-hero-btn"
          >
            <Sparkle size={18} weight="fill" />
            <span>Visit Full Portfolio</span>
            <ArrowSquareOut size={16} weight="bold" />
          </a>
          <span className="text-xs muted mono">yusufmohammaddsai.vercel.app</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="about-stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="about-stat-card">
            <div className="about-stat-num mono">{s.num}</div>
            <div className="about-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Two Column Grid: About the Creator & About the UVa Portal Project */}
      <div className="about-content-grid">
        {/* Left Column: Creator Story & Leadership */}
        <div className="about-card">
          <div className="about-card-head">
            <GraduationCap size={20} className="accent-icon" />
            <h3>About the Developer</h3>
          </div>
          <p>
            I am a Data Science & AI undergraduate at Zewail City, specializing in machine learning systems, high-performance computing, and competitive algorithms.
          </p>
          <p>
            As <strong>ICPC ZC Community Leader</strong>, I established our campus competitive programming culture—designing training curricula, mentoring over 150+ applicants each season, and fostering algorithmic problem-solving. As <strong>IEEE CS Vice Head</strong>, I co-organized major developer conferences including APPX 2025 with 200+ attendees.
          </p>
          <p>
            I believe software engineering and competitive programming share the same foundation: breaking down complex, high-friction problems into elegant, robust, and lightning-fast solutions.
          </p>

          <h4 style={{ marginTop: '20px', marginBottom: '12px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }} className="muted mono">
            Connect & Profiles
          </h4>
          <div className="about-social-grid">
            {socialLinks.map((l) => {
              const Icon = l.icon
              return (
                <a
                  key={l.name}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`about-social-pill ${l.primary ? 'primary' : ''}`}
                >
                  <Icon size={16} weight={l.primary ? 'fill' : 'regular'} />
                  <div>
                    <div className="social-name">{l.name}</div>
                    <div className="social-handle mono">{l.handle}</div>
                  </div>
                  <ArrowSquareOut size={13} className="external-arrow" />
                </a>
              )
            })}
          </div>
        </div>

        {/* Right Column: The UVa Judge Portal Story */}
        <div className="about-card">
          <div className="about-card-head">
            <Lightning size={20} className="accent-icon" />
            <h3>Why UVa Judge Portal?</h3>
          </div>
          <p>
            UVa Online Judge is one of the most respected repositories in competitive programming history, housing over 10,000 algorithmic problems that defined ICPC Regionals and World Finals for decades.
          </p>
          <p>
            However, the legacy 1990s portal suffered from modern web friction: popup blockers intercepting PDF problem statements, broken session redirects, no live judge queue feedback, and no way to organize custom team practice sheets.
          </p>
          <p>
            <strong>UVa Judge Portal</strong> was designed to revitalize this legendary archive for modern contestants:
          </p>
          <ul className="about-feature-list">
            <li>
              <strong>Split-Screen In-Portal Statements:</strong> Server-proxied and cached PDFs rendered right alongside your editor.
            </li>
            <li>
              <strong>Live Async Verdict Streaming:</strong> Instant judgment feedback polling without manual page reloads.
            </li>
            <li>
              <strong>Private Sheets with Passkeys:</strong> Curate training problem sets with access-code protection.
            </li>
            <li>
              <strong>Timed ICPC Contests:</strong> Realistic contest simulation with countdown clocks, scoreboards, and 20-min ACM penalty math.
            </li>
            <li>
              <strong>Persistent Code Archival:</strong> Review and copy past submissions directly from your submission log.
            </li>
          </ul>

          <div className="about-tech-strip">
            <span className="mono text-xs muted">Built with:</span>
            <span className="chip text-xs">React 18</span>
            <span className="chip text-xs">Vite</span>
            <span className="chip text-xs">Python 3.11</span>
            <span className="chip text-xs">Flask</span>
            <span className="chip text-xs">SQLite WAL</span>
            <span className="chip text-xs">Fly.io</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LandingPage({ onLoginClick, onExploreProblems, onExploreContests, onExploreAbout, onViewStatement, onPickProblem }) {
  const previewProblems = [
    { number: 100, title: 'The 3n + 1 problem', topic: 'Algorithm / Math', dacu: 72400 },
    { number: 10189, title: 'Minesweeper', topic: 'Simulation / Grid', dacu: 38200 },
    { number: 10055, title: 'Hashmat the Brave Warrior', topic: 'Basic Math', dacu: 51200 },
    { number: 10038, title: 'Jolly Jumpers', topic: 'Data Structures', dacu: 34100 },
    { number: 10082, title: 'WERTYU', topic: 'String Processing', dacu: 29500 },
  ]

  return (
    <div className="landing-page">
      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="landing-brand">
          <img src="/logo.svg" alt="UVa Logo" className="app-logo-icon" />
          <span className="bold">Judge Portal</span>
          <span className="status-dot-wrap" style={{ marginLeft: '12px' }}>
            <span className="status-dot" />
            <span className="text-xs muted">Online</span>
          </span>
        </div>
        <div className="landing-nav-links">
          <button type="button" className="link-btn text-sm" onClick={onExploreProblems}>
            Problems
          </button>
          <button type="button" className="link-btn text-sm" onClick={onExploreContests}>
            Contests
          </button>
          <button type="button" className="link-btn text-sm" onClick={onExploreAbout}>
            About
          </button>
          <button type="button" className="btn-small" onClick={onLoginClick}>
            Sign In with UVa
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-badge">
          <Sparkle size={14} weight="fill" />
          Modern Online Judge Workspace
        </div>
        <h1 className="landing-title">
          Competitive Programming at Terminal Velocity
        </h1>
        <p className="landing-sub">
          Solve UVa problems without popups or clunky redirects. Integrated in-portal PDF statements, real-time asynchronous verdict streaming, private custom sheets with passkey control, and timed ACM-ICPC contests.
        </p>
        <div className="landing-actions">
          <button type="button" className="btn-hero" onClick={onLoginClick}>
            <PaperPlaneTilt size={16} weight="bold" />
            Launch Judge Workspace
          </button>
          <button type="button" className="btn-secondary" onClick={onExploreProblems}>
            <Code size={16} />
            Explore 10,000+ Problems
          </button>
        </div>

        {/* Live Mockup Box */}
        <div className="landing-mockup-wrap">
          <div className="landing-mockup-header">
            <div className="mockup-dots">
              <span className="mockup-dot red" />
              <span className="mockup-dot yellow" />
              <span className="mockup-dot green" />
            </div>
            <div className="mono text-xs muted">UVa Portal Split-View Workspace — UVa 10189</div>
            <span className="badge badge-ok text-xs">
              <CheckCircle size={12} weight="fill" /> Accepted (0.000s)
            </span>
          </div>
          <div className="landing-mockup-body">
            <div className="mockup-col-statement">
              <div className="mockup-statement-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="chip mono text-xs">Volume 101</span>
                  <span className="text-xs muted mono">ID: 10189</span>
                </div>
                <h3 className="mockup-problem-title">Minesweeper</h3>
                <div className="mockup-meta-strip">
                  <span className="mockup-meta-item">⏱ 1.000s</span>
                  <span className="mockup-meta-item">💾 32 MB</span>
                  <span className="mockup-meta-item">👥 38,200 Solved</span>
                </div>
              </div>

              <div className="mockup-statement-content">
                <p className="mockup-desc">
                  Have you ever played Minesweeper? On an <code>n × m</code> grid with mines (<code>*</code>) and safe cells (<code>.</code>), count the adjacent mines for each safe cell.
                </p>

                <div className="mockup-io-grid">
                  <div className="mockup-io-box">
                    <div className="mockup-io-label">Sample Input</div>
                    <pre className="mockup-io-pre">{`4 4
*...
....
.*..
....
0 0`}</pre>
                  </div>
                  <div className="mockup-io-box">
                    <div className="mockup-io-label">Sample Output</div>
                    <pre className="mockup-io-pre">{`Field #1:
*100
2210
1*10
1110`}</pre>
                  </div>
                </div>
              </div>

              <div className="mockup-statement-footer">
                <button
                  type="button"
                  className="mockup-action-btn"
                  onClick={() => onViewStatement(10189, 'Minesweeper')}
                >
                  <FileText size={13} /> View Statement PDF
                </button>
                <button
                  type="button"
                  className="mockup-action-btn active"
                  onClick={() => onPickProblem(10189)}
                >
                  <PaperPlaneTilt size={13} weight="bold" /> Load in Workspace
                </button>
              </div>
            </div>

            <div className="mockup-col-editor">
              <div className="mockup-editor-tabs">
                <div className="mockup-tab active">
                  <Code size={13} weight="bold" style={{ color: '#79c0ff' }} />
                  <span>solution.cpp</span>
                </div>
                <div className="mockup-tab-extra">
                  <span className="mockup-lang-pill">C++11 (GCC 5.3)</span>
                </div>
              </div>

              <div className="mockup-code-scroll">
                {MOCKUP_CODE.map((line) => (
                  <div key={line.n} className="mockup-code-line">
                    <span className="mockup-line-num">{line.n}</span>
                    <span className="mockup-code-content">
                      {line.tokens.length === 0 ? (
                        '\u00A0'
                      ) : (
                        line.tokens.map((tok, i) => (
                          <span key={i} className={tok.c ? `syntax-${tok.c}` : ''}>
                            {tok.t}
                          </span>
                        ))
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mockup-editor-console">
                <div className="mockup-console-header">
                  <div className="mockup-console-status">
                    <span className="mockup-status-dot pulse" />
                    <span className="mono bold text-xs" style={{ color: '#3fb950' }}>VERDICT: ACCEPTED</span>
                  </div>
                  <div className="mockup-console-stats mono text-xs">
                    <span>Time: <b style={{ color: '#e6edf3' }}>0.000s</b></span>
                    <span>Mem: <b style={{ color: '#e6edf3' }}>3,892 KB</b></span>
                    <span>Run: <b style={{ color: '#e6edf3' }}>#28914021</b></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="landing-features-wrap">
        <div className="landing-section-title">
          <h2>Engineered for High-Speed Problem Solving</h2>
          <p className="muted">Everything competitive programmers need in one unified interface.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-box">
              <FileText size={22} weight="bold" />
            </div>
            <h3>In-Portal Statements</h3>
            <p>
              No more "not authorised" or popup windows. Problem PDFs are proxied and cached server-side for split-screen viewing right next to your code editor.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <ClockCounterClockwise size={22} weight="bold" />
            </div>
            <h3>Live Async Verdicts</h3>
            <p>
              Watch your submission resolve live. Automated polling streams judge queue states into instant verdicts without page reloads.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Lock size={22} weight="bold" />
            </div>
            <h3>Private Sheets & Passkeys</h3>
            <p>
              Curate training collections. Toggle sheets and contests private with access passkeys so only authorized peers or team members can participate.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Trophy size={22} weight="bold" />
            </div>
            <h3>Timed ICPC Contests</h3>
            <p>
              Simulate official contest pressure with real-time countdown clocks, 20-minute ACM penalty calculation, and live problem scoreboards.
            </p>
          </div>
        </div>
      </section>

      {/* Popular Problems Teaser */}
      <section className="landing-features-wrap">
        <div className="landing-section-title">
          <h2>Featured Classic Problems</h2>
          <p className="muted">Test drive the in-portal statement viewer instantly — no login required.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="mono" style={{ width: '80px' }}>#</th>
                <th>Problem Title</th>
                <th>Category</th>
                <th className="mono" style={{ textAlign: 'right', width: '120px' }}>Solvers</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {previewProblems.map((p) => (
                <tr key={p.number}>
                  <td className="mono bold">{p.number}</td>
                  <td className="bold">{p.title}</td>
                  <td>
                    <span className="chip">{p.topic}</span>
                  </td>
                  <td className="mono muted" style={{ textAlign: 'right' }}>
                    {p.dacu.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="link-btn text-xs"
                        onClick={() => onViewStatement(p.number, p.title)}
                      >
                        <FileText size={14} /> View Statement
                      </button>
                      <button
                        type="button"
                        className="btn-small text-xs"
                        onClick={() => onPickProblem(p.number)}
                      >
                        <PaperPlaneTilt size={13} weight="bold" /> Solve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Landing Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-brand">
            <img src="/logo.svg" alt="UVa Logo" className="app-logo-icon" />
            <span className="bold">UVa Judge Portal</span>
          </div>
          <div className="landing-footer-links">
            <button type="button" className="link-btn text-xs muted" onClick={onExploreProblems}>
              Problems
            </button>
            <button type="button" className="link-btn text-xs muted" onClick={onExploreContests}>
              Contests
            </button>
            <button type="button" className="link-btn text-xs muted" onClick={onExploreAbout}>
              About Developer
            </button>
            <a
              href="https://yusufmohammaddsai.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="link-btn text-xs"
              style={{ color: '#e07a2f', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <span>Portfolio</span>
              <ArrowSquareOut size={13} />
            </a>
          </div>
          <div className="text-xs muted mono">
            Engineered by <strong style={{ color: 'var(--text)' }}>Yusuf Mohammad</strong> • ICPC ZC Leader
          </div>
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Teams Panel (ICPC Competitive Teams & Peer Tracker)
// ---------------------------------------------------------------------------

function TeamsPanel({ currentUsername }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [teamDetail, setTeamDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Create team modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDesc, setNewTeamDesc] = useState('')
  const [createError, setCreateError] = useState('')
  const [createBusy, setCreateBusy] = useState(false)

  // Add member
  const [newMemberUsername, setNewMemberUsername] = useState('')
  const [addMemberBusy, setAddMemberBusy] = useState(false)
  const [memberError, setMemberError] = useState('')

  async function loadTeams() {
    setLoading(true)
    setError('')
    try {
      const data = await api.getTeams()
      setTeams(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(teamId) {
    setLoadingDetail(true)
    setMemberError('')
    try {
      const data = await api.getTeam(teamId)
      setTeamDetail(data)
    } catch (err) {
      setError(err.message)
      setTeamDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (selectedTeamId) {
      loadDetail(selectedTeamId)
    } else {
      setTeamDetail(null)
    }
  }, [selectedTeamId])

  async function handleCreateTeam(e) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    setCreateBusy(true)
    setCreateError('')
    try {
      const created = await api.createTeam({
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
      })
      setShowCreateModal(false)
      setNewTeamName('')
      setNewTeamDesc('')
      await loadTeams()
      if (created?.id) {
        setSelectedTeamId(created.id)
      }
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreateBusy(false)
    }
  }

  async function handleDeleteTeam(id, name) {
    if (!window.confirm(`Are you sure you want to disband team "${name}"? This cannot be undone.`)) return
    try {
      await api.deleteTeam(id)
      if (selectedTeamId === id) {
        setSelectedTeamId(null)
      }
      await loadTeams()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!newMemberUsername.trim() || !selectedTeamId) return
    setAddMemberBusy(true)
    setMemberError('')
    try {
      await api.addTeamMember(selectedTeamId, newMemberUsername.trim())
      setNewMemberUsername('')
      await loadDetail(selectedTeamId)
      await loadTeams()
    } catch (err) {
      setMemberError(err.message)
    } finally {
      setAddMemberBusy(false)
    }
  }

  async function handleRemoveMember(u) {
    const isSelf = u.toLowerCase() === (currentUsername || '').toLowerCase()
    const promptMsg = isSelf
      ? 'Are you sure you want to leave this team?'
      : `Remove ${u} from this team?`
    if (!window.confirm(promptMsg)) return
    try {
      await api.removeTeamMember(selectedTeamId, u)
      if (isSelf) {
        await loadTeams()
        setSelectedTeamId(null)
      } else {
        await loadDetail(selectedTeamId)
        await loadTeams()
      }
    } catch (err) {
      setMemberError(err.message)
    }
  }

  const isOwner = teamDetail && (teamDetail.created_by?.toLowerCase() === (currentUsername || '').toLowerCase())

  return (
    <div className="panel">
      {/* Top Header */}
      <div className="panel-head">
        <div>
          <h2>ICPC Teams &amp; Rosters</h2>
          <div className="panel-sub">
            Form training rosters, track solved counts across teammates, and prepare for contest simulations.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedTeamId && (
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setSelectedTeamId(null)}
            >
              &larr; All Teams
            </button>
          )}
          <button
            type="button"
            className="btn-small"
            onClick={() => {
              setCreateError('')
              setShowCreateModal(true)
            }}
          >
            <Plus size={14} weight="bold" />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {/* Selected Team Detail View */}
      {selectedTeamId ? (
        loadingDetail || !teamDetail ? (
          <div className="empty" style={{ padding: '40px' }}>Loading team details…</div>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '16px',
                background: 'var(--surface-hover)',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{teamDetail.name}</h3>
                  <span className="chip text-xs">
                    {teamDetail.members?.length || 0} {teamDetail.members?.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                {teamDetail.description && (
                  <p className="muted text-sm" style={{ margin: '6px 0 0' }}>
                    {teamDetail.description}
                  </p>
                )}
                <div className="text-xs muted" style={{ marginTop: '8px' }}>
                  Managed by <strong style={{ color: 'var(--text)' }}>{teamDetail.created_by}</strong>
                </div>
              </div>

              {isOwner && (
                <button
                  type="button"
                  className="link-btn link-btn-danger text-xs"
                  onClick={() => handleDeleteTeam(teamDetail.id, teamDetail.name)}
                  title="Disband this team"
                >
                  <Trash size={14} />
                  <span>Disband Team</span>
                </button>
              )}
            </div>

            {/* Add Member form */}
            <div style={{ marginBottom: '16px' }}>
              <form className="sheet-quick-add" onSubmit={handleAddMember}>
                <input
                  placeholder="UVa Username to add…"
                  value={newMemberUsername}
                  onChange={(e) => setNewMemberUsername(e.target.value)}
                  style={{ width: '220px' }}
                  required
                />
                <button type="submit" className="btn-small" disabled={addMemberBusy}>
                  <UserPlus size={14} weight="bold" />
                  <span>{addMemberBusy ? 'Adding…' : 'Add Member'}</span>
                </button>
              </form>
              {memberError && (
                <div className="form-error" style={{ marginTop: '8px', maxWidth: '400px' }}>
                  {memberError}
                </div>
              )}
            </div>

            {/* Team Roster Table */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th className="mono" style={{ textAlign: 'right' }}>UVa Solved</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamDetail.members?.map((m) => {
                    const isMe = m.username?.toLowerCase() === (currentUsername || '').toLowerCase()
                    return (
                      <tr key={m.username}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: 'var(--accent-glow)',
                                color: 'var(--accent)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '11px',
                                textTransform: 'uppercase',
                              }}
                            >
                              {m.username.slice(0, 2)}
                            </div>
                            <span className="bold">{m.username}</span>
                            {isMe && <span className="chip text-xs">You</span>}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`chip text-xs ${
                              m.role === 'owner' ? 'chip-primary' : ''
                            }`}
                          >
                            {m.role === 'owner' ? 'Team Captain' : 'Contestant'}
                          </span>
                        </td>
                        <td className="mono bold" style={{ textAlign: 'right', color: 'var(--accent)' }}>
                          {m.solved_count != null ? m.solved_count : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {(isOwner || isMe) && m.role !== 'owner' && (
                            <button
                              type="button"
                              className="link-btn link-btn-danger text-xs"
                              onClick={() => handleRemoveMember(m.username)}
                            >
                              <Trash size={13} />
                              <span>{isMe ? 'Leave' : 'Remove'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {(!teamDetail.members || teamDetail.members.length === 0) && (
                    <tr>
                      <td colSpan={4} className="empty">
                        No members in this team yet. Add members using the input above!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Team List View */
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Team Name</th>
                <th>Description</th>
                <th>Captain</th>
                <th className="mono" style={{ textAlign: 'right' }}>Roster</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const userIsOwner =
                  t.created_by?.toLowerCase() === (currentUsername || '').toLowerCase()
                return (
                  <tr
                    key={t.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedTeamId(t.id)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UsersThree size={16} color="var(--accent)" />
                        <span className="bold" style={{ color: 'var(--text)' }}>
                          {t.name}
                        </span>
                      </div>
                    </td>
                    <td className="muted text-sm">{t.description || '—'}</td>
                    <td>
                      <span className="text-sm">
                        {t.created_by}
                        {userIsOwner ? ' (You)' : ''}
                      </span>
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      <span className="chip text-xs">
                        {t.member_count} {t.member_count === 1 ? 'member' : 'members'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="link-btn text-xs"
                          onClick={() => setSelectedTeamId(t.id)}
                        >
                          View Roster &rarr;
                        </button>
                        {userIsOwner && (
                          <button
                            type="button"
                            className="link-btn link-btn-danger text-xs"
                            onClick={() => handleDeleteTeam(t.id, t.name)}
                            title="Disband team"
                          >
                            <Trash size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {teams.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="empty">
                    No teams found. Click "Create Team" to form an ICPC roster!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create Competitive Team</div>
              <button
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTeam}>
              <div className="modal-body">
                {createError && <div className="form-error">{createError}</div>}
                <label>
                  Team Name
                  <input
                    type="text"
                    placeholder="e.g. ZC ICPC Team Alpha"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    autoFocus
                    required
                  />
                </label>
                <label style={{ marginTop: '12px' }}>
                  Description (optional)
                  <input
                    type="text"
                    placeholder="e.g. Training for ACPC 2026 Regionals"
                    value={newTeamDesc}
                    onChange={(e) => setNewTeamDesc(e.target.value)}
                  />
                </label>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-small"
                  disabled={createBusy || !newTeamName.trim()}
                >
                  {createBusy ? 'Creating…' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard Navigation & Layout
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'problems', label: 'Problems', icon: Code },
  { key: 'sheets', label: 'Sheets', icon: FolderSimple },
  { key: 'contests', label: 'Contests', icon: Trophy },
  { key: 'submit', label: 'Submit', icon: PaperPlaneTilt },
  { key: 'submissions', label: 'Submissions', icon: ClockCounterClockwise },
  { key: 'solved', label: 'Solved', icon: CheckCircle },
  { key: 'teams', label: 'Teams', icon: UsersThree },
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'about', label: 'About', icon: Info },
]

function Dashboard({ username, onLogout }) {
  const [tab, setTab] = useState('problems')
  const [presetProblem, setPresetProblem] = useState('')
  const [statementProblem, setStatementProblem] = useState(null)
  const [sheets, setSheets] = useState([])

  async function loadSheets() {
    try {
      const data = await api.getSheets()
      setSheets(data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadSheets()
  }, [])

  function pickProblem(number) {
    setPresetProblem(number)
    setTab('submit')
  }

  function viewStatement(number, title = '') {
    setStatementProblem({ number, title })
  }

  return (
    <div className="dashboard">
      <aside className="rail">
        <div className="rail-brand" onClick={() => setTab('problems')} style={{ cursor: 'pointer' }}>
          <div className="rail-mark">
            <img src="/logo.svg" alt="UVa Logo" className="app-logo-icon" />
            <span>Judge</span>
          </div>
          <div className="status-dot-wrap" title="Connected to onlinejudge.org">
            <span className="status-dot" />
            <span>Online</span>
          </div>
        </div>
        <nav>
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                className={`rail-btn ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                <Icon className="rail-icon" />
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="rail-foot">
          <div
            className="rail-user-pill"
            onClick={() => setTab('profile')}
            style={{ cursor: 'pointer' }}
            title="Open your profile and analytics"
          >
            <User size={13} />
            <span>{username}</span>
          </div>
          <button
            type="button"
            className="link-btn text-xs"
            onClick={onLogout}
            title="Sign out of UVa session"
          >
            <SignOut size={14} />
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="app-topbar">
          <div className="breadcrumbs">
            <span className="breadcrumb-root" onClick={() => setTab('problems')} style={{ cursor: 'pointer' }}>
              UVa Judge
            </span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'submit' && presetProblem ? ` #${presetProblem}` : ''}
            </span>
          </div>
        </header>
        {tab === 'problems' && (
          <ProblemsPanel
            onPickProblem={pickProblem}
            onViewStatement={viewStatement}
            sheets={sheets}
            onRefreshSheets={loadSheets}
          />
        )}
        {tab === 'sheets' && (
          <SheetsPanel
            onPickProblem={pickProblem}
            onViewStatement={viewStatement}
            sheets={sheets}
            onRefreshSheets={loadSheets}
          />
        )}
        {tab === 'contests' && (
          <ContestsPanel
            onPickProblem={pickProblem}
            onViewStatement={viewStatement}
            sheets={sheets}
          />
        )}
        {tab === 'submit' && (
          <SubmitPanel
            presetProblem={presetProblem}
            onSubmitted={() => {}}
            onViewStatement={viewStatement}
          />
        )}
        {tab === 'submissions' && <SubmissionsPanel />}
        {tab === 'solved' && (
          <SolvedPanel
            onPickProblem={pickProblem}
            onViewStatement={viewStatement}
          />
        )}
        {tab === 'teams' && <TeamsPanel currentUsername={username} />}
        {tab === 'profile' && (
          <ProfilePanel
            onViewStatement={viewStatement}
            onPickProblem={pickProblem}
          />
        )}
        {tab === 'about' && <AboutPanel />}
      </main>

      {/* Global In-Portal Problem Statement Drawer */}
      {statementProblem && (
        <StatementDrawer
          problemNumber={statementProblem.number}
          problemTitle={statementProblem.title}
          onClose={() => setStatementProblem(null)}
          onSubmitProblem={pickProblem}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main App Root Component
// ---------------------------------------------------------------------------

export default function App() {
  const [status, setStatus] = useState('checking') // checking | anon | in
  const [username, setUsername] = useState('')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [statementProblem, setStatementProblem] = useState(null)
  const [guestTab, setGuestTab] = useState('home') // home | problems | contests | sheets
  const [guestPresetProblem, setGuestPresetProblem] = useState('')
  const [sheets, setSheets] = useState([])

  useEffect(() => {
    api
      .me()
      .then((res) => {
        if (res.logged_in) {
          setUsername(res.username)
          setStatus('in')
        } else {
          setStatus('anon')
        }
      })
      .catch(() => setStatus('anon'))
  }, [])

  useEffect(() => {
    if (status === 'anon') {
      api.getSheets().then(setSheets).catch(() => {})
    }
  }, [status])

  async function handleLogout() {
    await api.logout().catch(() => {})
    setStatus('anon')
    setUsername('')
  }

  function viewStatement(number, title = '') {
    setStatementProblem({ number, title })
  }

  function pickProblem(number) {
    if (status === 'in') {
      // handled in Dashboard
    } else {
      // Prompt login to submit
      setGuestPresetProblem(number)
      setShowLoginModal(true)
    }
  }

  if (status === 'checking') {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }} />
        <span>INITIALIZING JUDGE PORTAL…</span>
      </div>
    )
  }

  if (status === 'anon') {
    if (guestTab === 'problems' || guestTab === 'contests' || guestTab === 'about') {
      return (
        <div className="dashboard">
          <aside className="rail">
            <div className="rail-brand" onClick={() => setGuestTab('home')} style={{ cursor: 'pointer' }}>
              <div className="rail-mark">
                <img src="/logo.svg" alt="UVa Logo" className="app-logo-icon" />
                <span>Judge</span>
              </div>
              <div className="status-dot-wrap">
                <span className="status-dot" />
                <span>Guest</span>
              </div>
            </div>
            <nav>
              <button className={`rail-btn ${guestTab === 'home' ? 'active' : ''}`} onClick={() => setGuestTab('home')}>
                <House className="rail-icon" />
                <span>Home</span>
              </button>
              <button className={`rail-btn ${guestTab === 'problems' ? 'active' : ''}`} onClick={() => setGuestTab('problems')}>
                <Code className="rail-icon" />
                <span>Problems</span>
              </button>
              <button className={`rail-btn ${guestTab === 'contests' ? 'active' : ''}`} onClick={() => setGuestTab('contests')}>
                <Trophy className="rail-icon" />
                <span>Contests</span>
              </button>
              <button className={`rail-btn ${guestTab === 'about' ? 'active' : ''}`} onClick={() => setGuestTab('about')}>
                <Info className="rail-icon" />
                <span>About</span>
              </button>
            </nav>
            <div className="rail-foot">
              <button type="button" className="btn-small" style={{ width: '100%' }} onClick={() => setShowLoginModal(true)}>
                Sign In
              </button>
            </div>
          </aside>
          <main className="content">
            <header className="app-topbar">
              <div className="breadcrumbs">
                <span className="breadcrumb-root" onClick={() => setGuestTab('home')} style={{ cursor: 'pointer' }}>
                  UVa Judge
                </span>
                <span className="breadcrumb-sep">/</span>
                <span className="breadcrumb-current">
                  {guestTab.charAt(0).toUpperCase() + guestTab.slice(1)}
                </span>
              </div>
            </header>
            {guestTab === 'problems' && (
              <ProblemsPanel
                onPickProblem={pickProblem}
                onViewStatement={viewStatement}
                sheets={sheets}
                onRefreshSheets={() => api.getSheets().then(setSheets).catch(() => {})}
              />
            )}
            {guestTab === 'contests' && (
              <ContestsPanel
                onPickProblem={pickProblem}
                onViewStatement={viewStatement}
                sheets={sheets}
              />
            )}
            {guestTab === 'about' && <AboutPanel />}
          </main>
          {statementProblem && (
            <StatementDrawer
              problemNumber={statementProblem.number}
              problemTitle={statementProblem.title}
              onClose={() => setStatementProblem(null)}
              onSubmitProblem={pickProblem}
            />
          )}
          <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onLoggedIn={(u) => {
              setUsername(u)
              setStatus('in')
            }}
          />
        </div>
      )
    }

    return (
      <>
        <LandingPage
          onLoginClick={() => setShowLoginModal(true)}
          onExploreProblems={() => setGuestTab('problems')}
          onExploreContests={() => setGuestTab('contests')}
          onExploreAbout={() => setGuestTab('about')}
          onViewStatement={viewStatement}
          onPickProblem={pickProblem}
        />
        {statementProblem && (
          <StatementDrawer
            problemNumber={statementProblem.number}
            problemTitle={statementProblem.title}
            onClose={() => setStatementProblem(null)}
            onSubmitProblem={pickProblem}
          />
        )}
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoggedIn={(u) => {
            setUsername(u)
            setStatus('in')
          }}
        />
      </>
    )
  }

  return <Dashboard username={username} onLogout={handleLogout} />
}
