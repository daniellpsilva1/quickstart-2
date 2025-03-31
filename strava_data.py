import requests
import json

# Vital API credentials and user ID
api_key = 'sk_eu_afSrvjQkNZISal7evazJm1ppPTUhkFqo5JH0HYIe2i4'
user_id = '23d69e08-b909-4811-b8f2-729f65f5b75c'

# Date range for data retrieval (modify as needed)
start_date = '2020-01-01'
end_date = '2025-03-22'

# API endpoint - Corrected base URL for sandbox environment
base_url = 'https://api.sandbox.eu.tryvital.io/v2/'
endpoint = f'summary/workouts/{user_id}/raw'
url = base_url + endpoint

# Query parameters
params = {
    'provider': 'strava',
    'start_date': start_date,
    'end_date': end_date
}

# Headers
headers = {
    'x-vital-api-key': api_key,
    'Accept': 'application/json'
}

# File path to store the JSON data
output_file = 'strava_data.json'

# Make the GET request with error handling
try:
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()  # Raises an HTTPError for bad responses (e.g., 404, 500)

    if response.status_code == 200:
        # Parse the response as JSON
        data = response.json()

        # Write the data to a JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)  # Pretty-print with indentation
        print(f"Data successfully saved to {output_file}")
    else:
        print(f"Error {response.status_code}: {response.text}")

except requests.exceptions.HTTPError as http_err:
    print(f"HTTP error occurred: {http_err}")
except requests.exceptions.RequestException as req_err:
    print(f"Request error occurred: {req_err}")
except IOError as io_err:
    print(f"Error writing to file: {io_err}")
except ValueError as val_err:
    print(f"Error parsing JSON response: {val_err}")

    