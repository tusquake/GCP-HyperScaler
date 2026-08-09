const http = require('http');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ENV_NAME = process.env.APP_ENV || 'development';
const SECRET_TOKEN = process.env.API_SECRET_TOKEN || 'default_secret';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  const responseData = {
    status: 'HEALTHY',
    message: 'Hello from GKE Autopilot Microservice!',
    hostname: os.hostname(),
    environment: ENV_NAME,
    secret_key: SECRET_TOKEN,
    timestamp: new Date().toISOString()
  };
  res.end(JSON.stringify(responseData, null, 2));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (Environment: ${ENV_NAME})`);
});
