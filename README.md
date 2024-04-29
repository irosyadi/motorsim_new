# Visualisation of a three phase induction motor using Three.js

## Settings
Copy and rename .env.example to .env before running the server or client. Here some dissected setting file and their explaination:

```
# Client Settings
CLIENT_BROKER_URL=mqtt://localhost:8883 # Broker Url (MQTT connection through websocket)
CLIENT_BROKER_ID= # Broker client ID (Leave empty if anonymous allowed)
CLIENT_BROKER_USER= # Broker username (Leave empty if anonymous allowed)
CLIENT_BROKER_PASS= # Broker password (Leave empty if anonymous allowed)
CLIENT_BROKER_TOPIC=measurement_stream # topic to subscribe
```

## Running client
```
npm run dev
```

## Building client
```
npm run build
```