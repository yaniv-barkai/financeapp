# Security Audit: @sergienko4/israeli-bank-scrapers@8.6.8

Date: 2026-08-23T19:21:43Z

Result: PASS

## Checks
- npm integrity/provenance: verified
- package.json provenance flag: verified
- postinstall local-only: verified
- exfil SDK patterns: none
- blocklisted URLs: none
- npm audit high+: clean

## All hardcoded HTTPS URLs in bundle
```
https://api.cal-online.co.il
https://apipin.payboxapp.com/api/2.0/
https://apipin.payboxapp.com/api/2.0/getKey
https://apipin.payboxapp.com/api/2.0/getUserHistory
https://apipin.payboxapp.com/api/2.0/loginBySms
https://apipin.payboxapp.com/api/2.0/phoneValidate
https://apipin.payboxapp.com/api/2.0/pinValidation
https://apipin.payboxapp.com/api/2.0/sync
https://apipin.payboxapp.com/api/2.0/virtualCardTranRequest
https://back.behatsdaa.org.il/api/purchases/purchaseHistory
https://digital-web.cal-online.co.il
https://digital.yahav.co.il
https://digital.yahav.co.il//BaNCSDigitalApp/account
https://fe-sec.pepper.co.il/graphql
https://hb2.bankleumi.co.il/ChannelWCF/Broker.svc/ProcessRequest
https://identity.tfd-bank.com/v1/
https://identity.tfd-bank.com/v1/devices/token
https://identity.tfd-bank.com/v1/getIdToken
https://identity.tfd-bank.com/v1/otp/prepare
https://identity.tfd-bank.com/v1/otp/verify
https://identity.tfd-bank.com/v1/sessions/token
https://invalid.local/
https://login.bankhapoalim.co.il/ServerServices
https://mobile.tfd-bank.com/mobile-graph/graphql
https://mto.mizrahi-tefahot.co.il
https://online.bankmassad.co.il
https://online.bankotsar.co.il
https://online.fibi.co.il
https://online.pagi.co.il
https://sa.pepper.co.il/
https://sa.pepper.co.il/api/v2/auth/assert
https://sa.pepper.co.il/api/v2/auth/bind
https://sa.pepper.co.il/api/v2/auth/logout
https://start.telebank.co.il/Titan/gatewayAPI
https://web.americanexpress.co.il
https://web.isracard.co.il
https://www.americanexpress.co.il
https://www.bankhapoalim.co.il
https://www.bankmassad.co.il
https://www.bankotsar.co.il
https://www.behatsdaa.org.il
https://www.cal-online.co.il/
https://www.discountbank.co.il
https://www.fibi.co.il
https://www.hist.org.il
https://www.hist.org.il/card/balanceAndUses
https://www.isracard.co.il
https://www.leumi.co.il
https://www.max.co.il
https://www.max.co.il/api/registered
https://www.mercantile.co.il
https://www.mizrahi-tefahot.co.il
https://www.mizrahi-tefahot.co.il/login/index.html
https://www.onezerobank.com
https://www.pagi.co.il
https://www.payboxapp.com/
https://www.pepper.co.il
https://www.yahav.co.il
```

Re-run `bash scripts/audit-scraper-package.sh` before any version bump.
