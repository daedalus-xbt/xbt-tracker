# xbt-tracker

## Config Environment Variables

```bash
firebase functions:config:set telegram.bottoken=
firebase functions:config:set telegram.channel=
firebase functions:config:set http.token=
```

## Deploy

```bash
firebase deploy --only functions
```

## Dev

```bash
firebase functions:config:get  > .runtimeconfig.json
# edit .runtimeconfig.json with dev environments

firebase emulators:start
```
