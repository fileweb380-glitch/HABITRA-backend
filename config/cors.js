const allowedOrigins = [
  'https://habitra-black.vercel.app',
  'https://habitra-jmujqypdt-abdu2.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL?.replace(/\/+$/, '')
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = corsOptions;
