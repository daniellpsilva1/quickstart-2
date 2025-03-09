// Use environment variable or fallback to localhost
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://0.0.0.0:8000";

const BACKEND_IS_PYTHON = true;
const URL_PREFIX = BACKEND_IS_PYTHON ? API_URL : "/api";

export const fetcher = (url: string) =>
  fetch(`${URL_PREFIX}${url}`).then((res) => res.json());

export const fetchSummaryData = (
  data_type: string,
  userID: string,
  start_date: string,
  end_date: string,
  key: string
) => {
  console.log(`Fetching ${data_type} data for user ${userID}`);
  const url = `${URL_PREFIX}/summary/${data_type}/${userID}?start_date=${start_date}&end_date=${end_date}`;
  console.log("Request URL:", url);
  
  return fetch(url)
    .then((res) => {
      console.log("Response status:", res.status);
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      console.log(`Received ${data_type} data:`, data);
      if (!data || !data[key]) {
        console.warn(`Key ${key} not found in response:`, data);
        return [];
      }
      console.log(`Data for key ${key}:`, data[key]);
      return data[key];
    })
    .catch((err) => {
      console.error("Error fetching data:", err);
      throw err;
    });
};

export class Client {
  constructor() {}

  getTokenFromBackend = async (userID: string) => {
    const data = await this._fetch("GET", `/token/${userID}`);
    return data;
  };

  createUser = async (client_user_id: string) => {
    const data = await this._fetch("POST", `/user/`, { client_user_id });
    return data;
  };

  getUsers = async () => {
    const data = await this._fetch("GET", `/users/`);
    return data;
  };

  _fetch = async (
    method: string,
    resource: string,
    body?: Record<string, string>
  ) => {
    const resp = await fetch(`${API_URL}${resource}`, {
      method: method,
      body: body ? JSON.stringify(body) : null,
      headers: { "content-type": "application/json" },
    });
    const data = await resp.json();
    return data;
  };
}
