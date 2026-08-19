const http = require('http');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const helmet = require('helmet')
const routeMiddleware = require('./routes/index');
const { startWs } = require('./utils/ws');
const config = require("./config");

const app = express();

const server = http.createServer(app);
const isProduction = process.env.NODE_ENV === 'production';
const sessionSameSite = ['lax', 'strict', 'none'].includes(String(config.session.sameSite).toLowerCase())
  ? String(config.session.sameSite).toLowerCase()
  : 'lax';

if (isProduction) {
  app.set('trust proxy', 1);
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('port', process.env.PORT || '3000');

const sessionMiddleware = session({
  name: config.session.cookieName,
  secret: config.session.secret,
  cookie: {
    path: '/',
    httpOnly: true,
    secure: config.session.secure,
    sameSite: sessionSameSite,
    maxAge: config.session.maxAgeMs,
  },
  resave: false,
  saveUninitialized: false,
  rolling: true,
});

// 完善http头部，提高安全性
app.use(helmet());
// session 中间件
app.use(sessionMiddleware);
// 日志中间件
app.use(logger('dev'));
// parse application/json，express@4.16.0内置，替代了 body-parser
app.use(express.json());
// parse application/x-www-form-urlencoded，替代了 body-parser
app.use(express.urlencoded({ extended: false }));
// 解析得到 req.cookies
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeAllowedOrigins() {
  return (config.allowClient || [])
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);
    const host = url.host.toLowerCase();
    const fullOrigin = url.origin.toLowerCase();
    const allowed = normalizeAllowedOrigins();
    return allowed.includes(host) || allowed.includes(fullOrigin);
  } catch (error) {
    return false;
  }
}

// CORS 中间件
app.use(function(req, res, next) {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
        res.status(403).send("Origin not allowed");
        return;
    }

    if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Vary", "Origin");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
        res.sendStatus(204);
    } else {
        next();
    }
});

// 路由中间件
routeMiddleware(app);

server.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

// socket io
startWs(server)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
