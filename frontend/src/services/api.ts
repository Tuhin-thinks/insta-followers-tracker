import axios from 'axios'
import type { ScanStatus, ScanSummary, DiffResult, ScanMeta } from '../types/follower'

const http = axios.create({
  baseURL: '/api',
  // Scans can take a while – give two minutes before timing out
  timeout: 120_000,
})

export const getScanStatus = () =>
  http.get<ScanStatus>('/scan/status').then((r) => r.data)

export const triggerScan = () => http.post('/scan')

export const getSummary = () =>
  http.get<ScanSummary | null>('/summary').then((r) => r.data)

export const getLatestDiff = () =>
  http.get<DiffResult | null>('/diff/latest').then((r) => r.data)

export const getHistory = () =>
  http.get<ScanMeta[]>('/history').then((r) => r.data)

export const getDiff = (diffId: string) =>
  http.get<DiffResult>(`/diff/${diffId}`).then((r) => r.data)
