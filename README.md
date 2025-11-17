## Apple Pay Sandbox Demo

This project now includes the front-end demo (`applepay/`) and a lightweight Node.js backend that handles merchant validation for the Apple Pay Sandbox.

### Prerequisites

- Node.js 18+ (for native `fetch`/modern TLS).
- Apple Pay Sandbox merchant ID, merchant identity certificate, and payment processing certificate created in the Apple Developer portal.
- Sandbox Apple ID with a test card added to Wallet on a real device.

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create certificates directory**
   ```
   mkdir -p certs
   ```

3. **Convert your merchant identity certificate**
   - Download the `.cer` and `.key` (or `.p12`) files from the Apple Developer portal.
   - Convert them to PEM if necessary:
     ```bash
     openssl pkcs12 -in MerchantID.p12 -out certs/merchant_id_cert.pem -clcerts -nokeys
     openssl pkcs12 -in MerchantID.p12 -out certs/merchant_id_key.pem -nocerts -nodes
     ```

4. **Generate a local HTTPS certificate** (Apple Pay JS insists on HTTPS even in dev). With [mkcert](https://github.com/FiloSottile/mkcert):
   ```bash
   mkcert -install
   mkcert -key certs/dev-key.pem -cert-file certs/dev-cert.pem localhost 127.0.0.1
   ```

5. **Configure environment**
   - Copy `env.sample` to `.env` and fill in real values:
     ```
     cp env.sample .env
     ```
   - Make sure the paths in `.env` match where you saved the certificates.

### Running

```bash
npm start
```

- The server hosts the static demo at `https://localhost:3000/create-merchant.html` and exposes `POST /apple-pay/validate-merchant` for merchant validation.
- If the HTTPS cert/key env vars are missing, the server falls back to HTTP (Apple Pay JS will refuse to run, so keep HTTPS enabled).

### Using the Demo

1. Hit `/create-merchant.html`, enter your sandbox merchant ID, store name, etc.
2. Add items in `/products.html` and tap the Apple Pay button on a supported iPhone/Safari.
3. The payment sheet will exercise the full sandbox flow without charging real money.

### Troubleshooting

- **Sheet closes immediately**: typically invalid merchant ID, wrong domain, or missing HTTPS.
- **`Merchant validation failed`**: check the server logs; most often the certificate paths or Apple validation URL are incorrect.
- **`Apple Pay is unavailable`**: you must test on Safari (macOS with Touch ID or iOS). Simulators do not support real Apple Pay.

