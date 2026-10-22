import requests
import json
import sys

# Target Website URL
# Set to your AWS Amplify deployment URL (or "http://localhost:3000" if testing locally)
BASE_URL = "https://main.debwuzy1r5ca.amplifyapp.com"

def get_all_auctions(base_url=BASE_URL):
    """
    Fetches all auctions directly from the website without needing to log in.
    Retrieves: Name, Auction Code, Password, Start Time, Status, and Auction Type.
    """
    endpoint = f"{base_url.rstrip('/')}/api/auctions"
    
    print("\n" + "=" * 65)
    print("  FETCHING ALL AUCTIONS (NO LOGIN REQUIRED)")
    print(f"  Target: {endpoint}")
    print("=" * 65)

    try:
        response = requests.get(endpoint, timeout=10)

        if response.status_code == 200:
            data = response.json()
            auctions = data.get("auctions", [])
            total = data.get("total", len(auctions))

            if not auctions:
                print("\n  No auctions found in the system.\n")
                return

            print(f"\n  Found {total} auction(s):\n")

            for idx, a in enumerate(auctions, 1):
                print(f"[{idx}] {a.get('name')}")
                print(f"    - Auction Code : {a.get('auction_code') or 'None'}")
                print(f"    - Password     : {a.get('password') or 'None'}")
                print(f"    - Start Time   : {a.get('start_time') or 'N/A'}")
                print(f"    - Status       : {a.get('status')}")
                print(f"    - Auction Type : {a.get('auction_type')}")
                print("-" * 65)

        else:
            print(f"\n  [Error {response.status_code}]: {response.text}\n")

    except requests.exceptions.ConnectionError:
        print(f"\n  [Connection Error]: Could not connect to {base_url}.")
        print("  Please make sure your server is running or URL is accessible.\n")
    except Exception as e:
        print(f"\n  [Unexpected Error]: {e}\n")

def main():
    print("=" * 65)
    print("  Auction Hub - Auction Viewer (Python)")
    print(f"  Connected to: {BASE_URL}")
    print("=" * 65)

    while True:
        get_all_auctions(BASE_URL)
        
        choice = input("\nPress [Enter] to refresh, or type 'exit' to quit: ").strip().lower()
        if choice in ("exit", "quit", "q"):
            print("Exiting...")
            break

if __name__ == "__main__":
    main()
