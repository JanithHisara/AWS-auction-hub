import requests
import json
import sys

# Configure your target website URL and optional API secret
# - For local testing: "http://localhost:3000"
# - For deployed Amplify URL: e.g. "https://main.debwuzy1r5ca.amplifyapp.com" (or your custom domain)
BASE_URL = "http://localhost:3000"

# If NFC_API_SECRET is set in your .env, specify it here; otherwise leave it empty ""
API_KEY = ""

def lookup_nfc_card(card_uid: str):
    """Sends an HTTP GET request to the website to retrieve NFC card info."""
    endpoint = f"{BASE_URL.rstrip('/')}/api/nfc"
    params = {"uid": card_uid.strip()}
    headers = {}
    if API_KEY:
        headers["x-api-key"] = API_KEY

    try:
        response = requests.get(endpoint, params=params, headers=headers, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            card = data.get("card", {})
            user = card.get("user") or {}
            auction = card.get("auction") or {}
            
            print("\n" + "=" * 55)
            print("  NFC CARD FOUND")
            print("=" * 55)
            print(f" Card UID   : {card.get('nfc_uid')}")
            print(f" Status     : {' ACTIVE' if card.get('is_active') else ' INACTIVE'}")
            print(f" Label      : {card.get('label') or 'None'}")
            print(f" Card ID    : {card.get('id')}")
            print("-" * 55)
            print(" ASSIGNED USER")
            print(f" Display Name: {user.get('displayName') or 'N/A'}")
            print(f" Email       : {user.get('email') or 'N/A'}")
            print(f" Phone       : {user.get('phone') or 'N/A'}")
            print(f" Role        : {user.get('role') or 'N/A'}")
            print(f" User ID     : {user.get('id') or 'N/A'}")
            
            if auction:
                print("-" * 55)
                print(" ASSIGNED AUCTION")
                print(f" Auction Name: {auction.get('name')}")
                print(f" Status      : {auction.get('status')}")
                print(f" Auction ID  : {auction.get('id')}")
            print("=" * 55 + "\n")

        elif response.status_code == 404:
            print(f"\n [404] Card not found with UID: {card_uid}\n")
        elif response.status_code == 401:
            print("\n [401] Unauthorized: Check your API_KEY setting\n")
        elif response.status_code == 400:
            print(f"\n [400] Bad Request: {response.text}\n")
        else:
            print(f"\n [Error {response.status_code}]: {response.text}\n")

    except requests.exceptions.ConnectionError:
        print(f"\n Connection error: Could not connect to {BASE_URL}. Is the server running?\n")
    except requests.exceptions.Timeout:
        print("\n Request timed out.\n")
    except Exception as e:
        print(f"\n Unexpected error: {e}\n")

def main():
    print("=" * 55)
    print("  NFC Card Lookup Tool")
    print(f"  Target URL: {BASE_URL}/api/nfc")
    print("  (Type 'exit' or press Ctrl+C to quit)")
    print("=" * 55)

    while True:
        try:
            card_uid = input("Scan / Enter NFC Card UID: ").strip()
            if not card_uid:
                continue
            if card_uid.lower() in ("exit", "quit", "q"):
                print("Exiting...")
                sys.exit(0)
            
            lookup_nfc_card(card_uid)
        except KeyboardInterrupt:
            print("\nExiting...")
            sys.exit(0)

if __name__ == "__main__":
    main()
