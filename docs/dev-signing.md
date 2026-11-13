# Local signing certificate ("Hushboard Dev")

macOS ties the keyboard helper's Input Monitoring permission to its code signature. Ad-hoc signatures change with every build, so without a certificate macOS asks again after each helper update. A self-signed code-signing certificate gives the helper a stable identity:

```
designated => identifier "app.hushboard.keyhelper" and certificate leaf = H"…"
```

The certificate only signs code on this Mac. It isn't trusted for anything else (Keychain Access shows it as "not trusted", which is expected).

## Create it (once per Mac)

Save this as `hushboard-dev.cnf`:

```ini
[ req ]
distinguished_name = dn
x509_extensions = codesign
prompt = no

[ dn ]
CN = Hushboard Dev

[ codesign ]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
```

Then, in the same folder:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -config hushboard-dev.cnf -keyout key.pem -out cert.pem
```

```bash
openssl pkcs12 -export -inkey key.pem -in cert.pem -name "Hushboard Dev" -passout pass:hushboard-dev -out dev.p12
```

```bash
security import dev.p12 -k ~/Library/Keychains/login.keychain-db -P hushboard-dev -T /usr/bin/codesign && rm key.pem dev.p12
```

Check:

```bash
security find-identity -p codesigning | grep "Hushboard Dev"
```

## Remove it

Keychain Access → search "Hushboard Dev" → delete the certificate and its private key. The app falls back to ad-hoc signing.

## Releases

The app signs the helper when it installs it, using `HUSHBOARD_SIGN_IDENTITY` from the environment the app runs in, then "Hushboard Dev", then ad-hoc. Release builds signed with the Tekcify Developer ID are covered in [releasing.md](releasing.md#code-signing).
