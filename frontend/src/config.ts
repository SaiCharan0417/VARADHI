// Dynamic API URL: uses environment variable if set, otherwise defaults to relative /api
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';
