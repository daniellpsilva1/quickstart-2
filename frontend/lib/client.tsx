// Use environment variable or fallback to localhost
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://0.0.0.0:8000";

const BACKEND_IS_PYTHON = true;
const URL_PREFIX = BACKEND_IS_PYTHON ? API_URL : "/api";

export const fetcher = (url: string) =>
  fetch(`${URL_PREFIX}${url}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .catch(err => {
      console.error("Error in fetcher:", err);
      throw err;
    });

export const fetchSummaryData = (
  data_type: string,
  userID: string,
  start_date: string,
  end_date: string,
  key: string
) => {
  console.log(`Fetching ${data_type} data for user ${userID}`);
  console.log(`Time range: ${start_date} to ${end_date}`);
  const url = `${URL_PREFIX}/summary/${data_type}/${userID}?start_date=${start_date}&end_date=${end_date}`;
  console.log("Request URL:", url);
  
  return fetch(url)
    .then((res) => {
      console.log(`Response status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      return res.json();
    })
    .then((data) => {
      console.log(`Raw response data:`, JSON.stringify(data, null, 2));
      
      // Try fetching full data if just the key isn't working
      if (!data || typeof data[key] === 'undefined') {
        console.warn(`Key '${key}' not found in response. Available keys:`, Object.keys(data));
        
        // If data exists but the key is missing, return the full data for inspection
        if (data && typeof data === 'object') {
          console.log("Returning full data object for inspection");
          return data;
        }
        return [];
      }
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
