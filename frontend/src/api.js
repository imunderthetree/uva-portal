const BASE = '/api'

async function request(path, options = {}) {
  const { headers, ...restOptions } = options
  const resp = await fetch(BASE + path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...restOptions,
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const err = new Error(data.error || `Request failed (${resp.status})`)
    err.status = resp.status
    err.data = data
    throw err
  }
  return data
}

export const api = {
  me: () => request('/me'),
  login: (username, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/logout', { method: 'POST' }),
  problems: (q) => request(`/problems?q=${encodeURIComponent(q || '')}`),
  problemPdfUrl: (num) => `${BASE}/problem/${num}/pdf`,
  submit: (problem_number, language, code) =>
    request('/submit', {
      method: 'POST',
      body: JSON.stringify({ problem_number, language, code }),
    }),
  poll: (run_id, timeout = 60) => request(`/poll/${run_id}?timeout=${timeout}`),
  status: () => request('/status'),
  solved: () => request('/solved'),
  getSubmissionCode: (run_id) => request(`/submissions/${run_id}/code`),


  // Groups & Sheets
  getGroups: () => request('/groups'),
  createGroup: (payload) => {
    const body = typeof payload === 'string' ? { name: payload } : payload
    return request('/groups', { method: 'POST', body: JSON.stringify(body) })
  },
  deleteGroup: (id) => request(`/groups/${id}`, { method: 'DELETE' }),
  setSheetGroup: (sheetId, group_id) =>
    request(`/sheets/${sheetId}/group`, {
      method: 'PATCH',
      body: JSON.stringify({ group_id }),
    }),
  getSheets: () => request('/sheets'),
  getSheet: (id, accessCode = '') =>
    request(`/sheets/${id}`, {
      headers: accessCode ? { 'X-Access-Code': accessCode } : {},
    }),
  createSheet: (payload) => {
    const body = typeof payload === 'string' ? { name: payload } : payload
    return request('/sheets', { method: 'POST', body: JSON.stringify(body) })
  },
  deleteSheet: (id) => request(`/sheets/${id}`, { method: 'DELETE' }),
  verifySheetAccess: (sheetId, access_code) =>
    request(`/sheets/${sheetId}/verify-access`, {
      method: 'POST',
      body: JSON.stringify({ access_code }),
    }),
  addProblemToSheet: (sheetId, problem_number, note = '') =>
    request(`/sheets/${sheetId}/problems`, {
      method: 'POST',
      body: JSON.stringify({ problem_number, note }),
    }),
  removeProblemFromSheet: (sheetId, problem_number) =>
    request(`/sheets/${sheetId}/problems/${problem_number}`, { method: 'DELETE' }),

  // Contests
  getContests: () => request('/contests'),
  getContest: (id, accessCode = '') =>
    request(`/contests/${id}`, {
      headers: accessCode ? { 'X-Access-Code': accessCode } : {},
    }),
  createContest: (data) =>
    request('/contests', { method: 'POST', body: JSON.stringify(data) }),
  deleteContest: (id) => request(`/contests/${id}`, { method: 'DELETE' }),
  verifyContestAccess: (contestId, access_code) =>
    request(`/contests/${contestId}/verify-access`, {
      method: 'POST',
      body: JSON.stringify({ access_code }),
    }),

  // Teams
  getTeams: () => request('/teams'),
  getTeam: (id) => request(`/teams/${id}`),
  createTeam: (payload) =>
    request('/teams', { method: 'POST', body: JSON.stringify(payload) }),
  deleteTeam: (id) => request(`/teams/${id}`, { method: 'DELETE' }),
  addTeamMember: (teamId, username) =>
    request(`/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  removeTeamMember: (teamId, username) =>
    request(`/teams/${teamId}/members/${encodeURIComponent(username)}`, { method: 'DELETE' }),

  // Profile
  getProfile: () => request('/profile'),
  updateAvatar: (avatar) =>
    request('/profile/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar }),
    }),
}
